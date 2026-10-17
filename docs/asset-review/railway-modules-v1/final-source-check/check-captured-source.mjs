import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url)), repository = resolve(directory, '../../../..');
const server = spawn(process.execPath, [join(repository, 'docs/asset-review/tiara-head-v1/replay-server.mjs'), join(directory, 'figma-runtime-capture.json'), join(directory, '../figma-check/tiara-vector-capture.json'), join(directory, '../figma-check/tiara-fresh-export.png')], { cwd: repository, windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
try {
  let output = '';
  const ready = await new Promise((accept, reject) => {
    server.on('error', reject);
    server.on('exit', code => reject(Error(`Source replay exited before readiness: ${code}`)));
    server.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) {
        try { accept(JSON.parse(output.slice(0, output.indexOf('\n')))); } catch (error) { reject(error); }
      }
    });
  });
  const log = openSync(join(directory, 'figma-check.log'), 'w');
  let exit;
  try {
    const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run figma:check'] : ['run', 'figma:check'];
    const check = spawn(command, args, { cwd: repository, windowsHide: true, env: { ...process.env, FIGMA_MCP_URL: ready.url }, stdio: ['ignore', log, log] });
    [exit] = await once(check, 'exit');
  } finally { closeSync(log); }
  const receipt = { command: 'npm run figma:check', comparisonTransport: 'authenticated-capture-replay', sourceNodes: ready.sourceNodes, capturedAt: ready.capturedAt, finishedAt: new Date().toISOString(), exitCode: exit };
  writeFileSync(join(directory, 'figma-check-exit.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
  process.exitCode = exit;
} finally { server.kill('SIGTERM'); }
