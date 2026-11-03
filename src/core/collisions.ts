/** Phaser normalizes Group-vs-Sprite callbacks to Sprite-first. Never infer the projectile by argument order. */
export function projectileMember<T>(first: T, second: T, belongsToProjectiles: (object: T) => boolean): T | undefined {
  if (belongsToProjectiles(first)) return first;
  if (belongsToProjectiles(second)) return second;
  return undefined;
}
