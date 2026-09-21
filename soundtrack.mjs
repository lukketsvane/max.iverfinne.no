export const SOUNDTRACK = Object.freeze([
  { title: 'Ozan Koukle', artist: 'Ice', src: 'assets/audio/ozan-koukle.mp3' },
  { title: 'Concierto De Aranjuez', artist: 'Jim Hall', src: 'assets/audio/concierto-de-aranjuez.m4a' },
]);

// One streamed element survives menus, retries and track changes. Never decode
// the entire 25-minute playlist into mobile memory or block starting a run.
export function createSoundtrack({ enabled = true, host = window } = {}) {
  const doc = host.document;
  let audio, context, gain, source, started = false, away = false, disposed = false;
  let track = 0, attempt = 0, pending = false;
  const failed = new Set();
  const allowed = () => enabled && started && !doc.hidden && !away && !disposed;
  const quietly = promise => promise?.catch?.(() => {});

  function prepare() {
    if (audio) return;
    audio = new host.Audio();
    audio.preload = 'none'; audio.setAttribute('playsinline', '');
    audio.src = SOUNDTRACK[track].src;
    audio.addEventListener('ended', next);
    audio.addEventListener('error', unavailable);
    // GainNode also works on iOS, where element.volume is not controllable.
    const AC = host.AudioContext || host.webkitAudioContext;
    try {
      if (AC) {
        context = new AC(); gain = context.createGain(); gain.gain.value = .28;
        source = context.createMediaElementSource(audio);
        source.connect(gain); gain.connect(context.destination);
      } else audio.volume = .28;
    } catch (_) { quietly(context?.close()); context = null; audio.volume = .28; }
  }
  function play() {
    if (!allowed() || failed.size === SOUNDTRACK.length) return;
    prepare();
    // Both calls stay synchronous inside the input event for iOS activation.
    if (context && context.state !== 'running') quietly(context.resume());
    if (pending || !audio.paused) return;
    const token = ++attempt; pending = true;
    try {
      Promise.resolve(audio.play()).then(() => {
        if (token !== attempt) return;
        pending = false;
        if (!allowed()) stop();
      }, error => {
        if (token !== attempt) return;
        pending = false;
        if (error?.name === 'NotSupportedError') unavailable();
        // Permission/interruption failures wait for the next gesture.
      });
    } catch (_) { pending = false; }
  }
  function stop() {
    ++attempt; pending = false;
    audio?.pause();
    if (context && context.state !== 'closed') quietly(context.suspend());
  }
  function next() {
    if (disposed || !audio) return;
    ++attempt; pending = false;
    if (failed.size === SOUNDTRACK.length) { stop(); return; }
    do { track = (track + 1) % SOUNDTRACK.length; } while (failed.has(track));
    audio.src = SOUNDTRACK[track].src; play();
  }
  function unavailable() {
    if (!audio || disposed) return;
    failed.add(track); next();
  }
  function unlock(event) {
    if (event?.type === 'keydown' && (event.repeat || event.metaKey || event.ctrlKey || event.altKey)) return;
    if (!enabled || disposed) return;
    started = true; play();
  }
  function visibility() { if (doc.hidden) stop(); else play(); }
  function pagehide() { away = true; stop(); }
  function pageshow() { away = false; play(); }
  // Capture sees menu inputs even when their handlers stop propagation.
  const gestures = ['pointerdown', 'pointerup', 'keydown'];
  gestures.forEach(type => doc.addEventListener(type, unlock, { capture: true, passive: true }));
  doc.addEventListener('visibilitychange', visibility);
  host.addEventListener('pagehide', pagehide); host.addEventListener('pageshow', pageshow);
  return {
    unlock,
    setEnabled(value) { enabled = !!value; if (enabled) unlock(); else stop(); },
    destroy() {
      disposed = true; stop();
      gestures.forEach(type => doc.removeEventListener(type, unlock, true));
      doc.removeEventListener('visibilitychange', visibility);
      host.removeEventListener('pagehide', pagehide); host.removeEventListener('pageshow', pageshow);
      if (audio) {
        audio.removeEventListener('ended', next); audio.removeEventListener('error', unavailable);
        audio.removeAttribute('src'); audio.load();
      }
      quietly(context?.close());
    },
  };
}
