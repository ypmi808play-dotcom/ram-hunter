import { FEATURES, GAME, STEALTH } from './config.ts';
import type { NoiseAction } from './config.ts';
import type { FurnitureData } from './houses.ts';

export const COVER_FURNITURE_KINDS = ['shelf', 'partition', 'sofa'] as const;
export type CoverFurnitureKind = typeof COVER_FURNITURE_KINDS[number];

export function isCoverFurniture(kind: FurnitureData['kind']): boolean {
  return (COVER_FURNITURE_KINDS as readonly string[]).includes(kind);
}

export class StealthController {
  crouching = false;

  update(ctrlDown: boolean, jumpJustPressed: boolean, grounded: boolean, enabled = FEATURES.stealth): boolean {
    if (!enabled) {
      this.crouching = false;
      return false;
    }
    if (jumpJustPressed || !grounded) {
      this.crouching = false;
      return false;
    }
    this.crouching = ctrlDown;
    return this.crouching;
  }

  setCrouching(ctrlDown: boolean, grounded = true): boolean {
    return this.update(ctrlDown, false, grounded);
  }

  forceStand() {
    this.crouching = false;
  }

  get canDash(): boolean {
    return !this.crouching;
  }

  get canCollect(): boolean {
    return true;
  }

  movementSpeed(dashDown: boolean): number {
    if (this.crouching && FEATURES.stealth) {
      return Math.round(GAME.walkSpeed * STEALTH.crouchSpeedRatio);
    }
    return dashDown ? GAME.dashSpeed : GAME.walkSpeed;
  }

  get visionMultiplier(): number {
    return this.crouching && FEATURES.stealth ? STEALTH.crouchVisionRatio : 1;
  }

  effectiveSightDistance(baseRange: number): number {
    return Math.round(baseRange * this.visionMultiplier);
  }

  get eyeHeightOffset(): number {
    return this.crouching && FEATURES.stealth ? STEALTH.crouchEyeHeightOffset : STEALTH.standEyeHeightOffset;
  }

  stepNoiseAction(dashDown: boolean): NoiseAction {
    if (this.crouching && FEATURES.stealth) return 'crouchWalk';
    if (dashDown && this.canDash) return 'dash';
    return 'walk';
  }
}
