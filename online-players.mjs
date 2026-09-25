import { playerName } from './player-account.mjs';

const username = name => typeof name === 'string' && /^[a-z0-9][a-z0-9_-]{2,23}$/.test(name);

export function onlinePlayerNames(members = [], present = []) {
  return [...new Set([...members.map(m => m?.name), ...present]
    .filter(name => username(name) || name === 'Guest' || name === 'Player'))]
    .sort((a, b) => a.localeCompare(b));
}

// Public display names only. Presence never grants account or game permissions.
export class OnlinePlayers {
  constructor(client, changed) {
    this.client = client; this.changed = changed; this.name = ''; this.channel = null;
    this.key = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    this.connected = false; this.active = false; this.present = []; this.retry = 0;
    this.removing = Promise.resolve(); this.writing = Promise.resolve();
  }
  setUser(user) {
    const name = user?.id && !user.is_anonymous ? playerName(user) : '';
    const next = username(name) ? name : '';
    if (next === this.name) return;
    this.name = next; this.publish(); this.changed();
  }
  names() { return this.connected ? [...this.present, ...(this.name ? [this.name] : [])] : []; }
  start() {
    this.active = true;
    // Wait for a previous channel to leave before reusing its topic (iOS/BFCache).
    void this.removing.then(() => {
      if (!this.active || this.channel) return;
      const channel = this.client.channel('max-online-v1', { config: { presence: { key: this.key } } });
      this.channel = channel;
      channel.on('presence', { event: 'sync' }, () => {
        if (this.channel !== channel || !this.connected) return;
        this.read(channel);
      });
      channel.subscribe(status => {
        if (this.channel !== channel) return;
        this.connected = status === 'SUBSCRIBED';
        if (this.connected) { this.read(channel); this.publish(); }
        else {
          this.present = []; this.changed();
          // Errors/timeouts are rejoined by the SDK; a closed channel needs replacing.
          if (status === 'CLOSED') {
            this.channel = null;
            this.removing = Promise.allSettled([this.client.removeChannel(channel)]);
            clearTimeout(this.retry);
            this.retry = setTimeout(() => { if (this.active) this.start(); }, 3000);
          }
        }
      });
    }).catch(() => {});
  }
  read(channel) {
    this.present = Object.entries(channel.presenceState()).flatMap(([key, entries]) =>
      key === this.key || !Array.isArray(entries) ? [] : entries.map(entry => entry?.name).filter(username));
    this.changed();
  }
  publish() {
    const channel = this.channel, name = this.name;
    if (!channel || !this.connected) return;
    // Serialize account changes so an earlier track cannot win over a sign-out.
    this.writing = this.writing.catch(() => {}).then(() => {
      if (this.channel !== channel || !this.connected || this.name !== name) return;
      return name ? channel.track({ name }) : channel.untrack();
    }).catch(() => {});
  }
  stop() {
    this.active = false; clearTimeout(this.retry);
    const channel = this.channel; this.channel = null; this.connected = false; this.present = [];
    this.changed();
    if (channel) this.removing = Promise.allSettled([this.removing, this.client.removeChannel(channel)]);
  }
}
