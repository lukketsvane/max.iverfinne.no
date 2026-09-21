// One authoritative garden. Avatars move locally; only the host changes the world.
// Private topics bind each input stream to its authenticated player.
export class CoopSession {
  constructor(client, user, hooks = {}) {
    this.client = client; this.user = user; this.hooks = hooks;
    this.room = null; this.channels = new Map(); this.pending = [];
    this.actionId = 0; this.sequence = 0; this.received = new Map();
    this.playing = false; this.closed = false; this.lastHost = Date.now();
    this.lastSend = 0; this.lastPoll = 0; this.polling = false;
  }
  get host() { return this.room?.host === this.user.id; }
  async rpc(action, args = {}) {
    const { data, error } = await this.client.rpc('max_coop', { p_action: action, p_args: { room: this.room?.id, ...args } });
    if (error) throw new Error(error.message || 'Could not reach the room.');
    return data;
  }
  async enter(code) {
    await this.client.realtime.setAuth();
    this.room = await this.rpc(code ? 'join' : 'create', code ? { code: code.trim().toUpperCase() } : {});
    try {
      await this.subscribe('state');
      if (!this.host) await this.subscribe(this.user.id);
      else await this.syncChannels();
      this.timer = setInterval(() => this.poll(), 2000);
      this.hooks.room?.(this.room);
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
          clearTimeout(timer); reject(new Error('Room connection lost.'));
          if (this.playing && !this.closed) this.fail('Connection lost.');
        }
      });
    });
  }
  async syncChannels() {
    if (!this.host) return;
    await Promise.all(this.room.members.filter(p => p.id !== this.user.id).map(p => this.subscribe(p.id)));
    for (const [id, channel] of this.channels) if (id !== 'state' && !this.room.members.some(p => p.id === id)) {
      this.channels.delete(id); await this.client.removeChannel(channel);
    }
  }
  async poll() {
    if (this.closed || this.polling) return;
    // Room rows contain no gameplay. Less frequent heartbeat while playing.
    if (this.playing && Date.now() - this.lastPoll < 8000) return;
    this.polling = true;
    try {
      const room = await this.rpc('get'); if (this.closed) return;
      this.room = room; this.lastPoll = Date.now();
      await this.syncChannels();
      this.hooks.room?.(room);
    } catch (error) { this.fail(error.message); }
    finally { this.polling = false; }
  }
  async ready(value) { this.room = await this.rpc('ready', { ready: !!value }); this.hooks.room?.(this.room); }
  async start() {
    if (!this.host || this.playing) return;
    this.room = await this.rpc('start'); await this.syncChannels();
    this.begin();
  }
  begin() {
    if (this.playing || this.closed) return;
    this.playing = true; this.lastHost = Date.now();
    this.hooks.start?.(this);
  }
  receive(sender, packet) {
    if (this.closed || !packet || packet.v !== 1 || !Number.isSafeInteger(packet.seq) || packet.seq <= (this.received.get(sender) || 0)) return;
    // Limits also protect a host from a broken/malicious room member.
    if (JSON.stringify(packet).length > (sender === 'state' ? 180000 : 12000)) return;
    this.received.set(sender, packet.seq);
    if (sender === 'state' && !this.host) {
      if (packet.end) { this.fail('The host left the garden.'); return; }
      if (!packet.state) return;
      this.lastHost = Date.now(); this.begin();
      const ack = packet.state.acks?.[this.user.id];
      if (Number.isSafeInteger(ack)) this.pending = this.pending.filter(a => a.id > ack);
      this.hooks.state?.(packet.state);
    } else if (this.host && sender !== 'state' && this.playing && this.room.members.some(p => p.id === sender)) {
      if (packet.end) { this.hooks.depart?.(sender); return; }
      this.hooks.input?.(sender, packet);
    }
  }
  action(type, data = {}) {
    if (!this.playing || this.closed || this.host || this.pending.length >= 16) return false;
    this.pending.push({ id: ++this.actionId, type, ...data }); this.lastSend = 0; return true;
  }
  tick(avatar, capture, now = Date.now()) {
    if (!this.playing || this.closed) return;
    if (!this.host && now - this.lastHost > 10000) { this.fail('The host disconnected.'); return; }
    if (now - this.lastSend < (this.host ? 100 : 66)) return;
    this.lastSend = now;
    const packet = this.host ? { state: capture() } : { avatar, actions: this.pending };
    this.send(packet);
  }
  send(packet) {
    const channel = this.channels.get(this.host ? 'state' : this.user.id);
    if (!channel || this.closed) return;
    void channel.send({ type: 'broadcast', event: 'frame', payload: { ...packet, v: 1, seq: ++this.sequence } }).catch(() => {});
  }
  fail(reason) {
    if (this.closed) return;
    this.hooks.error?.(reason); void this.leave();
  }
  async leave() {
    if (this.closed) return;
    this.send({ end: true }); this.closed = true; this.playing = false;
    clearInterval(this.timer);
    const channels = [...this.channels.values()]; this.channels.clear();
    await Promise.allSettled([this.room ? this.rpc('leave') : Promise.resolve(), ...channels.map(c => this.client.removeChannel(c))]);
  }
}
