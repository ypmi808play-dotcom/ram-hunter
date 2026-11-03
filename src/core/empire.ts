import { GROWTH_LEVELS } from './config.ts';
import { seededRandom } from './random.ts';

export interface BuildingPlan { col: number; row: number; height: number; width: number; variant: number; racks: number }
export interface DataCenterPlan {
  totalRamGB: number; level: number; label: string; name: string; quote: string;
  rackCount: number; buildingCount: number; coolingCount: number; powerCount: number;
  columns: number; rows: number; buildings: BuildingPlan[];
}

export function createDataCenterPlan(totalRamGB: number): DataCenterPlan {
  const total = Number.isFinite(totalRamGB) ? Math.max(0, Math.floor(totalRamGB)) : 0;
  const levelIndex = GROWTH_LEVELS.findLastIndex(level => total >= level.min);
  const level = GROWTH_LEVELS[levelIndex];
  const rackCount = Math.ceil(total / 4);
  const buildingCount = total < 32 ? 0 : total < 128 ? 1 : 2 + Math.floor((total - 128) / 80);
  const columns = Math.max(1, Math.ceil(Math.sqrt(buildingCount * 1.45)));
  const rows = Math.max(1, Math.ceil(buildingCount / columns));
  const random = seededRandom(total ^ 0xa1e9b375);
  const buildings = Array.from({ length: buildingCount }, (_, i) => ({
    col: i % columns, row: Math.floor(i / columns),
    height: 34 + Math.floor(random() * 3) * 12 + Math.min(54, Math.floor(total / 128) * 3),
    width: 62 + Math.min(14, Math.floor((total % 80) / 6)),
    variant: Math.floor(random() * 3), racks: Math.floor(rackCount / Math.max(1, buildingCount)) + (i < rackCount % Math.max(1, buildingCount) ? 1 : 0)
  }));
  return {
    totalRamGB: total, level: levelIndex + 1, label: level.label, name: level.name, quote: level.quote,
    rackCount, buildingCount, columns, rows, buildings,
    coolingCount: Math.floor(total / 64), powerCount: Math.floor(total / 256)
  };
}
