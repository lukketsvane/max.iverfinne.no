export const SERVER = process.env.FIGMA_MCP_URL || 'http://127.0.0.1:3845/mcp';
export const FIGMA = {
  fileKey: 'TC0PHGMTCMR6im4hb3CSbF', fileName: 'max.iverfinne.no max fuglesprenger',
  url: 'https://www.figma.com/file/TC0PHGMTCMR6im4hb3CSbF', pages: { production: '10:2', draft: '0:1' },
};
export const OFFLINE = `Cannot reach the Figma Dev Mode MCP server at ${SERVER}.
  1. Open the Figma desktop app (the browser version has no local server).
  2. Open ${FIGMA.url} and keep it as the active tab.
  3. Switch to Dev Mode with Shift+D.
  4. Enable the desktop MCP server (Dev Mode inspect panel → MCP server, or Figma menu → Preferences → Enable Dev Mode MCP Server).
Then run the command again.`;
const SLOW = `Figma did not answer within 60 s. Keep ${FIGMA.url} as the active tab in the Figma desktop app and run the command again.`;

export class FigmaError extends Error {}
const failed = e => { throw new FigmaError(e?.name === 'TimeoutError' ? SLOW : OFFLINE); };

let session, seq = 0, calls = 0;
async function rpc(method, params, notify) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (session) headers['mcp-session-id'] = session;
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, ...(notify ? {} : { id: ++seq }) });
  const res = await fetch(SERVER, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) }).catch(failed);
  session = res.headers.get('mcp-session-id') || session;
  const text = await res.text().catch(failed);
  if (notify) return;
  if (!res.ok) throw new FigmaError(`Figma MCP server answered ${res.status}: ${text.slice(0, 200)}`);
  const data = text.split('\n').filter(l => l.startsWith('data:')).pop();
  const message = JSON.parse(data ? data.slice(5) : text);
  if (message.error) throw new FigmaError(`Figma MCP ${method}: ${message.error.message}`);
  return message.result;
}
export async function connect(client = 'max-figma-sync') {
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: client, version: '1' } });
  await rpc('notifications/initialized', {}, true);
}
export const toolCalls = () => calls;
export async function tool(name, nodeId) {
  calls++;
  const extra = name === 'get_design_context' ? { excludeScreenshot: true } : {};
  const r = await rpc('tools/call', { name, arguments: { nodeId, clientLanguages: 'javascript', clientFrameworks: 'unknown', ...extra } });
  const text = r.content.filter(c => c.type === 'text').map(c => c.text);
  if (r.isError && /rate limit/i.test(text.join(' '))) throw new FigmaError(`Figma: ${text.join(' ')}\nThe Dev Mode MCP server caps tool calls per day; image downloads are not tool calls. Try again tomorrow.`);
  if (r.isError) throw new FigmaError(`${text.join(' ')}\nOpen ${FIGMA.url} in the Figma desktop app and keep it as the active tab.`);
  return text;
}
export async function download(hash) {
  const res = await fetch(new URL(`/assets/${hash}.png`, SERVER), { signal: AbortSignal.timeout(60000) }).catch(failed);
  if (!res.ok) throw new FigmaError(`Figma could not serve image ${hash} (${res.status})`);
  return Buffer.from(await res.arrayBuffer().catch(failed));
}

export const unxml = s => s.replace(/&(lt|gt|quot|apos|amp|#(\d+));/g, (m, e, n) => n ? String.fromCharCode(+n) : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e]);
export function tree(xml) {
  const top = { children: [] }, stack = [top];
  for (const [, close, type, attrs, self] of xml.matchAll(/<(\/?)([a-z-]+)([^>]*?)(\/?)>/g)) {
    if (close) { stack.pop(); continue; }
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], unxml(m[2])]));
    const node = { id: a.id, type, name: a.name, x: +a.x, y: +a.y, width: +a.width, height: +a.height, children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    if (!self) stack.push(node);
  }
  if (!top.children[0]) throw new FigmaError('Figma returned no node metadata');
  return top.children[0];
}
export const metadataXml = async id => (await tool('get_metadata', id)).find(t => t.trimStart().startsWith('<')) || '';
export const metadata = async id => tree(await metadataXml(id));
export function* all(node) { for (const c of node.children) { yield c; yield* all(c); } }
