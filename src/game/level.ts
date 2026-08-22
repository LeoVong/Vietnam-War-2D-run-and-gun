import { GROUND_Y, LEVEL_W } from "./const";

export type Rect = { x: number; y: number; w: number; h: number; oneWay?: boolean };

export type EnemyKind = "grunt" | "gunner" | "heli" | "tank" | "boss";
export type PickupKind = "hp" | "mg" | "spread" | "nade";

export type EnemySpawn = { kind: EnemyKind; x: number; y: number };
export type PickupSpawn = { kind: PickupKind; x: number; y: number };
export type Deco = { kind: "palm" | "hut" | "sandbags"; x: number; y: number; s?: number; flip?: boolean };

export type Level = {
  width: number;
  grounds: Rect[];
  platforms: Rect[];
  enemies: EnemySpawn[];
  pickups: PickupSpawn[];
  deco: Deco[];
  checkpoints: number[];
  pits: Rect[];
  bossLockX: number;
};

function g(x: number, w: number): Rect {
  return { x, y: GROUND_Y, w, h: 140 };
}

export function buildLevel(): Level {
  const grounds: Rect[] = [
    g(0, 2080),
    g(2280, 1960),
    g(4480, 2520),
    g(7220, 1480),
    g(8920, LEVEL_W - 8920),
  ];

  const platforms: Rect[] = [
    { x: 980, y: 470, w: 220, h: 22, oneWay: true },
    { x: 1480, y: 410, w: 180, h: 22, oneWay: true },
    { x: 2080, y: 500, w: 220, h: 22, oneWay: true },
    { x: 3180, y: 460, w: 200, h: 22, oneWay: true },
    { x: 4240, y: 500, w: 240, h: 22, oneWay: true },
    { x: 5380, y: 430, w: 210, h: 22, oneWay: true },
    { x: 6120, y: 480, w: 180, h: 22, oneWay: true },
    { x: 6980, y: 500, w: 240, h: 22, oneWay: true },
    { x: 8020, y: 450, w: 200, h: 22, oneWay: true },
    { x: 8580, y: 500, w: 260, h: 22, oneWay: true },
  ];

  const enemies: EnemySpawn[] = [
    { kind: "grunt", x: 720, y: GROUND_Y },
    { kind: "grunt", x: 980, y: GROUND_Y },
    { kind: "grunt", x: 1280, y: GROUND_Y },
    { kind: "gunner", x: 1580, y: GROUND_Y },
    { kind: "grunt", x: 1840, y: GROUND_Y },
    { kind: "grunt", x: 2500, y: GROUND_Y },
    { kind: "grunt", x: 2780, y: GROUND_Y },
    { kind: "heli", x: 2920, y: 210 },
    { kind: "gunner", x: 3320, y: GROUND_Y },
    { kind: "grunt", x: 3600, y: GROUND_Y },
    { kind: "grunt", x: 3920, y: GROUND_Y },
    { kind: "grunt", x: 4180, y: GROUND_Y },
    { kind: "heli", x: 4300, y: 190 },
    { kind: "gunner", x: 4880, y: GROUND_Y },
    { kind: "grunt", x: 5120, y: GROUND_Y },
    { kind: "tank", x: 5520, y: GROUND_Y },
    { kind: "grunt", x: 5900, y: GROUND_Y },
    { kind: "grunt", x: 6180, y: GROUND_Y },
    { kind: "heli", x: 6400, y: 200 },
    { kind: "gunner", x: 6680, y: GROUND_Y },
    { kind: "grunt", x: 6920, y: GROUND_Y },
    { kind: "grunt", x: 7480, y: GROUND_Y },
    { kind: "tank", x: 7760, y: GROUND_Y },
    { kind: "heli", x: 7900, y: 180 },
    { kind: "gunner", x: 8180, y: GROUND_Y },
    { kind: "grunt", x: 8380, y: GROUND_Y },
    { kind: "tank", x: 8540, y: GROUND_Y },
    { kind: "boss", x: 9800, y: 250 },
  ];

  const pickups: PickupSpawn[] = [
    { kind: "hp", x: 1100, y: GROUND_Y - 28 },
    { kind: "mg", x: 1720, y: 470 - 28 },
    { kind: "nade", x: 2400, y: GROUND_Y - 28 },
    { kind: "hp", x: 3400, y: GROUND_Y - 28 },
    { kind: "spread", x: 4700, y: GROUND_Y - 28 },
    { kind: "nade", x: 5400, y: 430 - 28 },
    { kind: "hp", x: 6300, y: GROUND_Y - 28 },
    { kind: "mg", x: 7600, y: GROUND_Y - 28 },
    { kind: "hp", x: 8440, y: GROUND_Y - 28 },
    { kind: "nade", x: 9100, y: GROUND_Y - 28 },
  ];

  const deco: Deco[] = [];
  for (let x = 80; x < 8800; x += 340 + (x % 180)) {
    deco.push({ kind: "palm", x, y: GROUND_Y + 8, s: 0.85 + ((x * 13) % 40) / 100, flip: x % 500 > 250 });
  }
  deco.push({ kind: "hut", x: 4020, y: GROUND_Y + 6, s: 1.05 });
  deco.push({ kind: "hut", x: 5080, y: GROUND_Y + 6, s: 0.95, flip: true });
  deco.push({ kind: "hut", x: 5860, y: GROUND_Y + 6, s: 1.1 });
  for (const e of enemies) {
    if (e.kind === "gunner") deco.push({ kind: "sandbags", x: e.x + 8, y: GROUND_Y + 4, s: 0.9 });
  }

  const pits: Rect[] = [
    { x: 2080, y: GROUND_Y + 8, w: 200, h: 200 },
    { x: 4240, y: GROUND_Y + 8, w: 240, h: 200 },
    { x: 7000, y: GROUND_Y + 8, w: 220, h: 200 },
    { x: 8700, y: GROUND_Y + 8, w: 220, h: 200 },
  ];

  return {
    width: LEVEL_W,
    grounds,
    platforms,
    enemies,
    pickups,
    deco,
    checkpoints: [180, 3480, 6400, 9000],
    pits,
    bossLockX: 9080,
  };
}
