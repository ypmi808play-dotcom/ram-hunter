import { EXTRACTION, FEATURES, RISK_MODE } from './config.ts';
import type { EndReason } from './session.ts';

export type ExtractionPoint = typeof EXTRACTION.points[number];

export const EXTRACTION_STATUS_LABELS: Record<EndReason, { title: string; badge: string; extracted: boolean }> = {
  goal: { title: 'MISSION COMPLETE', badge: 'FULL EXTRACTION / ゴール到達', extracted: true },
  extract: { title: 'EXTRACTION SUCCESSFUL', badge: 'SAFE EXTRACTION / 途中撤退成功', extracted: true },
  boss_win: { title: 'BOSS DEFEATED — TOTAL VICTORY', badge: 'BOSS VICTORY / ボス撃破完全確保', extracted: true },
  life: { title: 'OUT OF LUCK. STILL IN BUSINESS.', badge: 'EMERGENCY RETREAT / ライフ0', extracted: false },
  time: { title: 'TIME’S UP. AMBITION ISN’T.', badge: 'DEADLINE EXPIRED / 時間切れ', extracted: false },
  boss_loss: { title: 'COMPUTE OVERLOAD — BOSS DEFEAT', badge: 'BOSS DEFEAT / ボス敗北', extracted: false }
};

export interface RamSettlement {
  totalCollectedRamGB: number;
  spentRamGB: number;
  availableRamGB: number;
  lostRamGB: number;
  securedRamGB: number;
  lossRate: number;
  statusBadge: string;
}

/**
 * Calculates final RAM settlement once at the end of a run.
 * - Normal mode (riskMode = false): 0 RAM lost, securedRamGB = availableRamGB.
 * - Risk mode (riskMode = true): loses configured percentage of availableRamGB on life/time/boss_loss;
 *   never deducts spentRamGB twice, never modifies totalCollectedRamGB, and floors to non-negative integers.
 */
export function settleRunRam(
  totalCollectedRamGB: number,
  spentRamGB: number,
  reason: EndReason,
  riskMode: boolean
): RamSettlement {
  const total = Math.max(0, Math.floor(Number.isFinite(totalCollectedRamGB) ? totalCollectedRamGB : 0));
  const spent = Math.max(0, Math.min(total, Math.floor(Number.isFinite(spentRamGB) ? spentRamGB : 0)));
  const available = Math.max(0, total - spent);
  const rawRate = riskMode ? (RISK_MODE.lossRates[reason] ?? 0) : 0;
  const lossRate = Math.max(0, Math.min(1, Number.isFinite(rawRate) ? rawRate : 0));
  const lost = riskMode ? Math.min(available, Math.max(0, Math.floor(available * lossRate))) : 0;
  const secured = Math.max(0, available - lost);
  return {
    totalCollectedRamGB: total,
    spentRamGB: spent,
    availableRamGB: available,
    lostRamGB: lost,
    securedRamGB: secured,
    lossRate,
    statusBadge: EXTRACTION_STATUS_LABELS[reason]?.badge ?? EXTRACTION_STATUS_LABELS.goal.badge
  };
}

export class ExtractionSystem {
  holdProgressMs = 0;
  activePointId = '';
  modalOpen = false;
  dismissedPointId = '';

  findPoint(
    playerX: number,
    playerY: number,
    groundY: number,
    houseDoorXs: readonly number[],
    enabled = FEATURES.extraction
  ): ExtractionPoint | undefined {
    if (!enabled) return undefined;
    // Never conflict with house door interaction
    if (houseDoorXs.some(doorX => Math.abs(doorX - playerX) < 85)) return undefined;
    if (Math.abs(playerY - groundY) >= 55) return undefined;
    return EXTRACTION.points.find(p => Math.abs(p.x - playerX) <= EXTRACTION.interactRadius);
  }

  updateHold(point: ExtractionPoint | undefined, holdingInteract: boolean, deltaMs: number): { progress: number; triggered: boolean } {
    if (!point) {
      this.reset();
      this.dismissedPointId = '';
      return { progress: 0, triggered: false };
    }
    if (this.activePointId !== point.id) {
      this.activePointId = point.id;
      this.holdProgressMs = 0;
    }
    if (!holdingInteract) {
      this.holdProgressMs = 0;
      return { progress: 0, triggered: false };
    }
    this.holdProgressMs = Math.min(EXTRACTION.holdMs, this.holdProgressMs + Math.max(0, deltaMs));
    return {
      progress: this.holdProgressMs / EXTRACTION.holdMs,
      triggered: this.holdProgressMs >= EXTRACTION.holdMs
    };
  }

  reset() {
    this.holdProgressMs = 0;
    this.activePointId = '';
    this.modalOpen = false;
  }
}
