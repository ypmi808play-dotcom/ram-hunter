import { FEATURES, STEALTH } from './config.ts';
import type { NoiseAction } from './config.ts';

export interface SoundEvent {
  id: string;
  action: NoiseAction;
  x: number;
  y: number;
  volume: number;
  radius: number;
  sourceId: string;
  sceneId: string;
  createdAt: number;
  crossZone: boolean;
}

export type GameEventType =
  | 'PLAYER_NOISE_CREATED'
  | 'NPC_HEARD_NOISE'
  | 'PLAYER_DETECTED'
  | 'PC_RAM_COLLECTED'
  | 'HOUSE_EVENT_TRIGGERED'
  | 'EXTRACTION_REQUESTED'
  | 'RUN_FINALIZED';

export interface GameEventPayload {
  type: GameEventType;
  now: number;
  sceneId: string;
  data?: Record<string, unknown>;
}

/**
 * Checks whether a sound emitted in `sourceSceneId` can be heard by an NPC in `listenerSceneId`.
 * - Outdoor ('street'), indoor main floor ('house:N'), and hidden/attic room ('house:N:attic')
 *   are strictly isolated acoustic zones for normal sounds.
 * - Security alarms ('alarm' / crossZone = true) propagate within the same building (main floor <-> attic),
 *   while outdoor wanted level rises via the alarm wanted event rather than direct indoor footstep hearing.
 */
export function canHearAcrossZones(sourceSceneId: string, listenerSceneId: string, crossZone = false): boolean {
  if (sourceSceneId === listenerSceneId) return true;
  if (!crossZone) return false;
  const sourceBase = sourceSceneId.startsWith('house:') ? sourceSceneId.split(':').slice(0, 2).join(':') : sourceSceneId;
  const listenerBase = listenerSceneId.startsWith('house:') ? listenerSceneId.split(':').slice(0, 2).join(':') : listenerSceneId;
  return sourceBase === listenerBase && sourceBase.startsWith('house:');
}

export class NoiseSystem {
  private counter = 0;
  private readonly recentEvents: SoundEvent[] = [];
  private readonly npcCooldowns = new Map<string, number>();
  private readonly listeners = new Map<GameEventType, Set<(payload: GameEventPayload) => void>>();
  private readonly maxRecent = 24;

  on(type: GameEventType, listener: (payload: GameEventPayload) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  emitGameEvent(type: GameEventType, now: number, sceneId: string, data?: Record<string, unknown>) {
    const set = this.listeners.get(type);
    if (!set) return;
    const payload: GameEventPayload = { type, now, sceneId, data };
    for (const fn of set) fn(payload);
  }

  clearListeners() {
    this.listeners.clear();
  }

  emitNoise(
    action: NoiseAction,
    x: number,
    y: number,
    sceneId: string,
    now: number,
    sourceId = 'player',
    override?: { volume?: number; radius?: number; crossZone?: boolean }
  ): SoundEvent | undefined {
    if (!FEATURES.noise && action !== 'alarm') return undefined;
    const profile = STEALTH.noiseLevels[action];
    const event: SoundEvent = {
      id: `sound:${++this.counter}`,
      action,
      x: Math.round(x),
      y: Math.round(y),
      volume: override?.volume ?? profile.volume,
      radius: override?.radius ?? profile.radius,
      sourceId,
      sceneId,
      createdAt: now,
      crossZone: override?.crossZone ?? (action === 'alarm')
    };
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecent) this.recentEvents.shift();
    this.emitGameEvent('PLAYER_NOISE_CREATED', now, sceneId, { event });
    return event;
  }

  canNpcPerceive(npcId: string, event: SoundEvent, npcSceneId: string, npcX: number, npcY: number): boolean {
    if (!canHearAcrossZones(event.sceneId, npcSceneId, event.crossZone)) return false;
    const dist = Math.hypot(npcX - event.x, npcY - event.y);
    if (dist > event.radius) return false;
    const key = `${npcId}:${event.sourceId}:${event.action}`;
    const readyAt = this.npcCooldowns.get(key) ?? -Infinity;
    if (event.createdAt < readyAt) return false;
    this.npcCooldowns.set(key, event.createdAt + STEALTH.noiseCooldownMs);
    return true;
  }

  activeEvents(sceneId: string, now: number, maxAgeMs = 650): SoundEvent[] {
    return this.recentEvents.filter(e => e.sceneId === sceneId && now - e.createdAt <= maxAgeMs);
  }

  reset() {
    this.recentEvents.length = 0;
    this.npcCooldowns.clear();
    this.clearListeners();
  }
}
