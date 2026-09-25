import { DEFAULT_LOADOUT, HIDDEN_CLASS_IDS, sameLoadout, validLoadout as checkLoadout } from './player-loadout.mjs';
import { encodeFrame, CoopFrameReceiver, COOP_TRANSPORT_LIMITS } from './coop-transport.mjs';

// The server reserves every member's character and refuses a hidden one without its unlock
// (global_join), so inside a room a hidden character is as valid as the other four.
const validLoadout = value => checkLoadout(value, HIDDEN_CLASS_IDS);

// One authoritative garden. Private topics bind selections and input to the
// authenticated sender. A fresh round trip locks every choice before Start.
const COOP_PROTOCOL = 2;
const token = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const validToken = value => typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value);
const memberList = members => Array.isArray(members) && members.length > 0 && members.length <= 4 &&
  new Set(members.map(p => p?.id)).size === members.length && new Set(members.map(p => p?.slot)).size === members.length &&
  members.every(p => p && typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 64 &&
    Number.isInteger(p.slot) && p.slot >= 1 && p.slot <= 4 && typeof p.ready === 'boolean' && typeof p.name === 'string' && p.name.length <= 24);

export class CoopSession {
  constructor(client, user, hooks = {}, selection = DEFAULT_LOADOUT) {
    this.client = client; this.user = user; this.hooks = hooks;
    this.selection = Object.freeze(validLoadout(selection) || { ...DEFAULT_LOADOUT });
    this.mode = ['last-seed', 'high-tide'].includes(selection.mode) ? selection.mode : 'garden';
    this.token = token(); this.loadouts = Object.create(null); this.memberTokens = Object.create(null);
    this.room = null; this.channels = new Map(); this.pending = [];
    this.actionId = 0; this.sequence = 0; this.received = new Map();
    this.frameReceiver = new CoopFrameReceiver(); this.sendingState = false; this.nextStateAt = 0;
    this.playing = false; this.closed = false; this.lastHost = Date.now();
    this.lastSend = 0; this.lastPoll = 0; this.polling = false;
    this.acknowledged = false; this.preparing = null; this.preparedId = null; this.launchId = null;
  }
  get host() { return this.room?.host === this.user.id; }
  get canReady() { return !this.closed && !this.playing && this.acknowledged; }
  get canStart() {
    return this.host && !this.closed && !this.playing && this.room.state === 'lobby' &&
      this.room.members.every(p => p.ready && validLoadout(this.loadouts[p.id]) && this.memberTokens[p.id]);
  }
  async rpc(action, args = {}) {
    const { data, error } = await this.client.rpc('max_coop', { p_action: action, p_args: { room: this.room?.id, ...args } });
    if (error) throw new Error(error.message || 'Could not reach the room.');
    return data;
  }
  async enter(code) {
    await this.client.realtime.setAuth();
    if (code && typeof code === 'object' && code.global) {
      const { data, error } = await this.client.rpc('max_coop_global', {
        p_class_id: this.selection.classId,
        p_difficulty: this.selection.difficulty,
        ...(this.mode !== 'garden' ? { p_mode: this.mode } : {}),
        ...(code.id ? { p_room: code.id, p_mode: this.mode } : {}),
      });
      if (error) throw new Error(error.message || 'Could not join the garden.');
      this.room = data;
      if (this.mode !== 'garden' && this.room.mode !== this.mode) throw new Error('This mode is not available on the server yet.');
      this.mode = this.room.mode || 'garden';
      const me = this.room.members?.find(p => p.id === this.user.id);
      const canonical = validLoadout({
        classId: me?.classId || this.selection.classId,
        difficulty: this.room.difficulty || this.selection.difficulty,
      });
      if (!canonical) throw new Error('The server rejected this character.');
      this.selection = Object.freeze(canonical);
    } else if (code && typeof code === 'object' && code.id) {
      const { data, error } = await this.client.rpc('max_coop_join', { p_room: code.id });
      if (error) throw new Error(error.message || 'Could not join this run.');
      this.room = data;
    } else this.room = await this.rpc(code ? 'join' : 'create', code ? { code: code.trim().toUpperCase() } : {});
    try {
      // A reload must prove its current selection again, even if its previous
      // membership was already Ready. No previous loadout is guessed.
      if (!this.host && this.room.state !== 'playing') this.room = await this.rpc('ready', { ready: false });
      else {
        this.loadouts[this.user.id] = this.selection; this.memberTokens[this.user.id] = this.token; this.acknowledged = true;
      }
      await this.subscribe('state');
      if (!this.host) await this.subscribe(this.user.id);
      else await this.syncChannels();
      this.entered = true;
      this.timer = setInterval(() => this.poll(), 2000);
      this.notifyRoom(); this.sendLobby();
      if (this.room.state === 'playing') {
        this.acknowledged = true;
        this.loadouts[this.user.id] = this.selection; this.memberTokens[this.user.id] = this.token;
        this.begin();
      }
      return this.room;
    } catch (error) { await this.leave(); throw error; }
  }
  async subscribe(suffix) {
    if (this.channels.has(suffix)) return;
    const channel = this.client.channel(`max-coop:${this.room.id}:${suffix}`, {
      config: { private: true, broadcast: { self: false, ack: false } },
    });
    this.channels.set(suffix, channel);
    channel.on('broadcast', { event: 'frame' }, ({ payload }) => this.receive(suffix, payload));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Room connection timed out.')), 12000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer);
          const active = this.entered || this.playing;
          if (!active) { reject(new Error('Room connection lost.')); return; }
          if (!this.closed && this.channels.get(suffix) === channel) {
            this.channels.delete(suffix);
            void this.client.removeChannel(channel);
            if (!(typeof document !== 'undefined' && document.hidden)) setTimeout(() => { void this.resume(); }, 350);
          }
          resolve();
        }
      });
    });
  }
  async syncChannels() {
    if (!this.host) return;
    await Promise.all(this.room.members.filter(p => p.id !== this.user.id).map(p => this.subscribe(p.id)));
    for (const [id, channel] of this.channels) if (id !== 'state' && !this.room.members.some(p => p.id === id)) {
      this.channels.delete(id);
      if (!this.playing) { delete this.loadouts[id]; delete this.memberTokens[id]; }
      this.cancelPrepare('The team changed. Start again when everyone is ready.');
      await this.client.removeChannel(channel);
    }
  }
  notifyRoom() {
    if (!this.room || this.closed) return;
    this.room = { ...this.room, members: this.room.members.map(p => {
      const choice = this.loadouts[p.id];
      const serverChoice = validLoadout({ classId: p.classId, difficulty: this.room.difficulty || choice?.difficulty });
      return {
        ...p,
        classId: choice?.classId || serverChoice?.classId || p.classId,
        skinId: choice?.skinId || serverChoice?.skinId,
        difficulty: this.room.difficulty || choice?.difficulty,
        selectionReady: !!(choice || serverChoice) && (!!this.memberTokens[p.id] || p.id === this.user.id),
      };
    }) };
    this.hooks.room?.(this.room);
  }
  async poll(force = false) {
    if (this.closed || this.polling) return;
    if (!force && this.playing && Date.now() - this.lastPoll < 2000) return;
    this.polling = true;
    try {
      const room = await this.rpc('get'); if (this.closed) return;
      const previousHost = this.room?.host;
      this.room = room; this.lastPoll = Date.now();
      if (previousHost && previousHost !== room.host) {
        const stateChannel = this.channels.get('state');
        if (stateChannel) {
          this.channels.delete('state');
          await this.client.removeChannel(stateChannel);
        }
        await this.subscribe('state');
        if (this.host) this.pending = [];
      }
      if (!this.host) {
        await this.subscribe(this.user.id);
        for (const [id, channel] of [...this.channels]) if (id !== 'state' && id !== this.user.id) {
          this.channels.delete(id); await this.client.removeChannel(channel);
        }
      }
      await this.syncChannels();
      this.notifyRoom();
      this.sendLobby();
    } catch (error) { this.fail(error.message); }
    finally { this.polling = false; }
  }
  async ready(value) {
    if (value && !this.canReady) throw new Error('Waiting for the host to receive your selection.');
    this.room = await this.rpc('ready', { ready: !!value });
    this.notifyRoom(); this.sendLobby();
  }
  lobbyPacket() {
    const members = this.room.members.map(({ id, slot, ready, name, classId }) => ({ id, slot, ready, name, classId }));
    return { members, loadouts: this.loadouts, tokens: this.memberTokens, challenge: this.preparing?.id || null, launch: this.launchId };
  }
  sendLobby() {
    if (this.closed || !this.room) return;
    this.send(this.host ? { lobby: this.lobbyPacket() } : { selection: this.selection });
  }
  cancelPrepare(reason) { if (this.preparing) this.preparing.reject(new Error(reason)); }
  async start() {
    if (!this.host || this.playing || this.starting) return;
    this.starting = true;
    try {
      this.room = await this.rpc('get'); await this.syncChannels(); this.notifyRoom();
      if (!this.canStart) throw new Error('Wait for everyone to be ready and their selections to arrive.');
      const ids = this.room.members.map(p => p.id), tokens = { ...this.memberTokens };
      const id = token();
      await new Promise((resolve, reject) => {
        const confirmed = new Set([this.user.id]);
        const finish = error => {
          clearInterval(this.preparing?.retry); clearTimeout(this.preparing?.timeout);
          if (error) reject(error); else resolve();
        };
        this.preparing = { id, tokens, confirmed, reject: finish, check: () => { if (ids.every(who => confirmed.has(who))) finish(); } };
        this.preparing.timeout = setTimeout(() => finish(new Error('A player did not answer. Wait for them to reconnect, then start again.')), 7000);
        this.preparing.retry = setInterval(() => this.sendLobby(), 500);
        this.sendLobby(); this.preparing.check();
      });
      // The RPC serializes membership/readiness with Start. A concurrent join
      // remains unready; a changed selection invalidates the round trip above.
      if (!this.canStart || ids.some(who => tokens[who] !== this.memberTokens[who])) throw new Error('The team changed. Start again.');
      this.room = await this.rpc('start'); await this.syncChannels();
      if (this.closed) return;
      if (this.room.members.some(p => !ids.includes(p.id) || tokens[p.id] !== this.memberTokens[p.id] || !validLoadout(this.loadouts[p.id]))) {
        this.fail('The team changed while starting. Please create a new garden.'); return;
      }
      this.launchId = id; this.notifyRoom(); this.begin();
    } finally { this.preparing = null; this.starting = false; }
  }
  begin() {
    if (this.playing || this.closed) return;
    this.playing = true; this.lastHost = Date.now();
    this.loadouts = Object.fromEntries(this.room.members.map(p => [p.id, { ...(this.loadouts[p.id] || {}) }]));
    this.hooks.start?.(this);
  }
  acceptLobby(lobby) {
    if (!lobby || !memberList(lobby.members) || !lobby.members.some(p => p.id === this.user.id) || !lobby.members.some(p => p.id === this.room.host)) return false;
    const choices = Object.create(null), tokens = Object.create(null);
    for (const member of lobby.members) {
      const choice = validLoadout(lobby.loadouts?.[member.id]), stamp = lobby.tokens?.[member.id];
      if (choice && validToken(stamp)) { choices[member.id] = choice; tokens[member.id] = stamp; }
    }
    this.acknowledged = sameLoadout(choices[this.user.id], this.selection) && tokens[this.user.id] === this.token;
    if (!this.playing) {
      this.loadouts = choices; this.memberTokens = tokens;
      this.room = { ...this.room, members: lobby.members }; this.notifyRoom();
      if (this.acknowledged && validToken(lobby.challenge) && lobby.members.find(p => p.id === this.user.id).ready) {
        this.preparedId = lobby.challenge;
        this.send({ selection: this.selection, prepared: lobby.challenge });
      } else if (!this.acknowledged) this.send({ selection: this.selection });
    }
    return this.acknowledged && lobby.members.every(p => choices[p.id]) && validToken(lobby.launch) && lobby.launch === this.preparedId;
  }
  receive(sender, packet) {
    if (this.closed) return;
    // Only completed snapshots may advance acknowledgements or the game.
    // Guest input retains its per-session sequence so a reload starts at one.
    if (sender === 'state') packet = this.frameReceiver.receiveFragment(sender, packet);
    if (this.closed || !packet || packet.v !== 1 || !Number.isSafeInteger(packet.seq) || !validToken(packet.sid)) return;
    if (packet.proto !== COOP_PROTOCOL) { if (sender === 'state' && !this.host) this.fail('MAX was updated. Reload to rejoin the garden.'); return; }
    const stream = sender + ':' + packet.sid;
    if (packet.seq <= (this.received.get(stream) || 0)) return;
    if (JSON.stringify(packet).length > (sender === 'state' ? COOP_TRANSPORT_LIMITS.MAX_FRAME_BYTES : COOP_TRANSPORT_LIMITS.MAX_INPUT_BYTES)) return;
    this.received.set(stream, packet.seq);
    if (this.received.size > 32) this.received.delete(this.received.keys().next().value);
    if (sender === 'state' && !this.host) {
      if (packet.end) { this.fail('The host left the garden.'); return; }
      const matched = this.acceptLobby(packet.lobby);
      if (!packet.state) return;
      if (!this.playing && !matched) { this.fail('Your selection was not confirmed. Rejoin the garden before starting.'); return; }
      this.lastHost = Date.now(); this.begin();
      const ack = packet.state.acks?.[this.user.id];
      if (Number.isSafeInteger(ack)) this.pending = this.pending.filter(a => a.id > ack);
      this.hooks.state?.(packet.state);
    } else if (this.host && sender !== 'state' && this.room.members.some(p => p.id === sender)) {
      if (packet.end) {
        if (packet.sid !== this.memberTokens[sender]) return;
        delete this.loadouts[sender]; delete this.memberTokens[sender];
        if (this.playing) this.hooks.depart?.(sender);
        else { this.cancelPrepare('A player left the garden.'); this.notifyRoom(); }
        return;
      }
      if (!this.playing || !this.loadouts[sender] || packet.sid !== this.memberTokens[sender]) {
        const supplied = validLoadout(packet.selection); if (!supplied) return;
        const member = this.room.members.find(p => p.id === sender);
        if (member?.classId && supplied.classId !== member.classId) return;
        const choice = validLoadout({
          classId: member?.classId || supplied.classId,
          difficulty: this.room.difficulty || supplied.difficulty,
        });
        if (!choice) return;
        const changed = this.memberTokens[sender] !== packet.sid || !sameLoadout(choice, this.loadouts[sender]);
        if (changed) {
          this.cancelPrepare('A player changed their selection. Wait for them to be ready.');
          this.loadouts[sender] = choice; this.memberTokens[sender] = packet.sid;
          this.notifyRoom(); this.sendLobby();
        }
        if (this.playing) { this.hooks.join?.(sender, choice); return; }
        if (this.preparing && packet.prepared === this.preparing.id && packet.sid === this.preparing.tokens[sender]) {
          this.preparing.confirmed.add(sender); this.preparing.check();
        }
      } else this.hooks.input?.(sender, packet);
    }
  }
  async resume() {
    if (this.closed || !this.room || this.resuming) return;
    this.resuming = true; this.lastHost = Date.now();
    try {
      await this.client.realtime.setAuth();
      // iOS may freeze a PWA without delivering a clean channel close event.
      // Rebuild every private channel on foreground so stale sockets can never
      // strand a player in the shared garden.
      const stale = [...this.channels.values()];
      this.channels.clear();
      await Promise.allSettled(stale.map(channel => this.client.removeChannel(channel)));
      const room = await this.rpc('get'); if (this.closed) return;
      this.room = room; this.lastPoll = Date.now();
      if (this.host) this.pending = [];
      await this.subscribe('state');
      if (this.host) await this.syncChannels();
      else await this.subscribe(this.user.id);
      this.notifyRoom(); this.sendLobby();
    } catch (_) {
      // Keep membership reserved. A later foreground event / poll can retry.
    } finally { this.resuming = false; }
  }
  action(type, data = {}) {
    if (!this.playing || this.closed || this.host || this.pending.length >= 16) return false;
    this.pending.push({ id: ++this.actionId, type, ...data }); this.lastSend = 0; return true;
  }
  tick(avatar, capture, now = Date.now()) {
    if (!this.playing || this.closed) return;
    if (!this.host && !(typeof document !== 'undefined' && document.hidden) && now - this.lastHost > 90000) { this.fail('The garden connection expired.'); return; }
    if (this.host && (this.sendingState || now < this.nextStateAt)) return;
    if (now - this.lastSend < (this.host ? 100 : 66)) return;
    this.lastSend = now;
    const state = this.host ? capture() : null;
    // A finished solo run must stop reserving and heartbeating its shared room.
    // Otherwise Play can reconnect to a dead gardener waiting for a revive.
    if (state?.ended && this.room.members.length === 1) { void this.leave(); return; }
    this.send(this.host ? { lobby: this.lobbyPacket(), state } : { selection: this.selection, avatar, actions: this.pending });
  }
  send(packet) {
    const channel = this.channels.get(this.host ? 'state' : this.user.id);
    if (!channel || this.closed) return;
    let frames;
    try { frames = encodeFrame({ ...packet, v: 1, proto: COOP_PROTOCOL, sid: this.token, seq: ++this.sequence }); }
    catch (error) { this.fail(error.message || 'This garden could not be sent.'); return; }
    const emit = payload => { void channel.send({ type: 'broadcast', event: 'frame', payload }).catch(() => {}); };
    if (frames.length === 1) { emit(frames[0]); return; }
    // Spread big archives instead of flooding Realtime with a burst. Ordinary
    // gardens keep 10 Hz; unusually large snapshots get a bounded slower rate.
    const spacing = Math.min(50, 7000 / (frames.length - 1));
    this.sendingState = true; this.nextStateAt = this.lastSend + Math.min(7500, Math.max(100, frames.length * spacing));
    let index = 0;
    const next = () => {
      if (this.closed) { this.sendingState = false; return; }
      emit(frames[index++]);
      if (index < frames.length) this.transferTimer = setTimeout(next, spacing);
      else { this.sendingState = false; this.transferTimer = null; }
    };
    next();
  }
  fail(reason) {
    if (this.closed) return;
    this.hooks.error?.(reason); void this.leave();
  }
  async leave() {
    if (this.closed) return this.leaving;
    this.send({ end: true }); this.closed = true; this.playing = false;
    this.cancelPrepare('You left the garden.'); clearInterval(this.timer); clearTimeout(this.transferTimer);
    this.frameReceiver.reset(); this.sendingState = false;
    const channels = [...this.channels.values()]; this.channels.clear();
    this.leaving = Promise.allSettled([this.room ? this.rpc('leave') : Promise.resolve(), ...channels.map(c => this.client.removeChannel(c))]);
    await this.leaving;
  }
}
