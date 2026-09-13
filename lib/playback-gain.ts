export const VOLUME_MIN = 0.2;
export const VOLUME_MAX = 2.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const wired = new WeakSet<HTMLMediaElement>();

function audioContext() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  return { ctx, master };
}

export function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return 1;
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, volume));
}

export function speechVolume(volume: number) {
  return Math.min(1, clampVolume(volume));
}

export function applyPlaybackGain(el: HTMLMediaElement, volume: number) {
  const next = clampVolume(volume);
  try {
    const { master: gain } = audioContext();
    gain.gain.value = next;
    if (!wired.has(el)) {
      const source = audioContext().ctx.createMediaElementSource(el);
      source.connect(gain);
      wired.add(el);
    }
    el.volume = 1;
  } catch {
    el.volume = speechVolume(next);
  }
}
