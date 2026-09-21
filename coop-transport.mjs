// Large finished gardens travel as one logical snapshot. Fragmentation never
// exposes a partial garden, acknowledges an incomplete frame, or truncates it.
const MAX_WIRE_BYTES = 60000;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_BYTES = 12000;
const LEGACY_STATE_BYTES = 180000;
const MAX_PARTS = 256;
const FRAGMENT_TTL_MS = 10000;
const MAX_SENDERS = 5;
const MAX_STREAMS = 32;
const MAX_SENDER_STREAMS = 8;
const FRAGMENT_KIND = 'max-state-fragment';
const encoder = new TextEncoder();

export const COOP_TRANSPORT_LIMITS = Object.freeze({
  MAX_WIRE_BYTES, MAX_FRAME_BYTES, MAX_INPUT_BYTES, MAX_PARTS, FRAGMENT_TTL_MS,
});

function bytes(text) { return encoder.encode(text).byteLength; }
function frame(packet) {
  return packet && typeof packet === 'object' && !Array.isArray(packet) &&
    packet.v === 1 && Number.isSafeInteger(packet.seq) && packet.seq > 0 &&
    (packet.sid === undefined || typeof packet.sid === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(packet.sid));
}
function envelope(seq, index, count, total, data, sid) {
  return { v: 1, kind: FRAGMENT_KIND, seq, sid, index, count, total, data };
}
function safeEnd(text, start, end) {
  // Keep a literal Unicode surrogate pair together. The byte lengths of the
  // individual fragments then add up to the original JSON's UTF-8 length.
  if (end < text.length && end > start && text.charCodeAt(end - 1) >= 0xd800 &&
      text.charCodeAt(end - 1) <= 0xdbff && text.charCodeAt(end) >= 0xdc00 &&
      text.charCodeAt(end) <= 0xdfff) return end - 1;
  return end;
}

export function encodeFrame(packet) {
  if (!frame(packet)) throw new TypeError('Invalid co-op frame.');
  const text = JSON.stringify(packet), total = bytes(text), state = !!packet.state;
  if (total > (state ? MAX_FRAME_BYTES : MAX_INPUT_BYTES)) {
    throw new RangeError(state ? 'This garden exceeds the co-op frame limit.' : 'Co-op input is too large.');
  }
  if (total <= MAX_WIRE_BYTES) return [packet];
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = safeEnd(text, start, Math.min(text.length, start + 24000));
    // Size the actual JSON envelope, including the quotes and backslashes
    // escaped a second time when the JSON fragment becomes a string field.
    while (bytes(JSON.stringify(envelope(packet.seq, MAX_PARTS - 1, MAX_PARTS, total, text.slice(start, end), packet.sid))) > MAX_WIRE_BYTES) {
      end = safeEnd(text, start, start + Math.floor((end - start) * .8));
      if (end <= start) throw new RangeError('Could not encode the co-op frame.');
    }
    chunks.push(text.slice(start, end)); start = end;
    if (chunks.length > MAX_PARTS) throw new RangeError('This garden needs too many co-op fragments.');
  }
  return chunks.map((data, index) => envelope(packet.seq, index, chunks.length, total, data, packet.sid));
}

export class CoopFrameReceiver {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.senders = new Map();
  }
  reset() { this.senders.clear(); }
  makeStream(sender, stream) {
    const entries = [...this.senders.entries()];
    const own = entries.filter(([, entry]) => entry.sender === sender);
    if (!own.length && new Set(entries.map(([, entry]) => entry.sender)).size >= MAX_SENDERS) return null;
    if (own.length >= MAX_SENDER_STREAMS || this.senders.size >= MAX_STREAMS) {
      const candidates = own.length >= MAX_SENDER_STREAMS ? own : entries;
      const unused = candidates.find(([, entry]) => !entry.pending);
      if (!unused) return null;
      this.senders.delete(unused[0]);
    }
    const entry = { sender, latest: 0, delivered: 0, pending: null };
    this.senders.set(stream, entry); return entry;
  }
  prune(now) {
    for (const entry of this.senders.values()) {
      if (entry.pending && now - entry.pending.started >= FRAGMENT_TTL_MS) {
        entry.pending = null;
        // Keep latest: delayed fragments cannot restart an expired frame.
      }
    }
  }
  receiveFragment(sender, payload) {
    const now = this.now(); this.prune(now);
    if (typeof sender !== 'string' || !/^[a-zA-Z0-9:_-]{1,80}$/.test(sender) || !frame(payload)) return null;
    let wireBytes;
    try { wireBytes = bytes(JSON.stringify(payload)); } catch { return null; }
    const fragmented = payload.kind === FRAGMENT_KIND;
    if (wireBytes > (fragmented ? MAX_WIRE_BYTES : sender === 'state' ? LEGACY_STATE_BYTES : MAX_INPUT_BYTES)) return null;
    if (fragmented && (sender !== 'state' ||
        !Number.isSafeInteger(payload.index) || !Number.isSafeInteger(payload.count) ||
        payload.count < 2 || payload.count > MAX_PARTS || payload.index < 0 || payload.index >= payload.count ||
        !Number.isSafeInteger(payload.total) || payload.total <= MAX_WIRE_BYTES || payload.total > MAX_FRAME_BYTES ||
        typeof payload.data !== 'string' || payload.data.length === 0)) return null;

    const stream = payload.sid === undefined ? sender : sender + ':' + payload.sid;
    let entry = this.senders.get(stream);
    if (!entry) {
      entry = this.makeStream(sender, stream); if (!entry) return null;
    }
    if (payload.seq < entry.latest || payload.seq <= entry.delivered) return null;
    if (!fragmented) {
      entry.latest = entry.delivered = payload.seq; entry.pending = null;
      return payload;
    }
    if (payload.seq > entry.latest) {
      entry.latest = payload.seq;
      entry.pending = { started: now, count: payload.count, total: payload.total, parts: new Map(), size: 0 };
    }
    const pending = entry.pending;
    if (!pending) return null;
    if (pending.count !== payload.count || pending.total !== payload.total) {
      entry.pending = null; return null;
    }
    if (pending.parts.has(payload.index)) {
      if (pending.parts.get(payload.index) !== payload.data) entry.pending = null;
      return null;
    }
    const size = bytes(payload.data);
    const buffered = [...this.senders.values()].reduce((sum, item) => sum + (item.pending?.size || 0), 0);
    if (pending.size + size > pending.total || buffered + size > MAX_FRAME_BYTES) { entry.pending = null; return null; }
    pending.parts.set(payload.index, payload.data); pending.size += size;
    if (pending.parts.size !== pending.count) return null;
    entry.pending = null;
    if (pending.size !== pending.total) return null;
    const parts = Array.from({ length: pending.count }, (_, index) => pending.parts.get(index));
    let packet;
    try { packet = JSON.parse(parts.join('')); } catch { return null; }
    if (!frame(packet) || packet.seq !== payload.seq || packet.sid !== payload.sid || !packet.state || packet.kind === FRAGMENT_KIND) return null;
    entry.delivered = packet.seq;
    return packet;
  }
}
