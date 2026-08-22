export const VIEW_W = 1280;
export const VIEW_H = 720;
export const LEVEL_W = 10800;
export const GROUND_Y = 598;
export const FIXED_DT = 1 / 60;
export const MAX_DT = 0.1;

export const MOVE_SPEED = 268;
export const AIR_SPEED = 248;
export const GRAVITY_UP = 1880;
export const GRAVITY_DOWN = 3120;
export const JUMP_V = -760;
export const COYOTE = 0.1;
export const JUMP_BUF = 0.13;
export const MAX_FALL = 980;
export const APEX_HANG = 0.72;

export const PLAYER_W = 34;
export const PLAYER_H = 52;
export const PLAYER_DRAW_W = 88;
export const PLAYER_DRAW_H = 100;

export const HS_KEY = "vietnam-strike-hs-v1";
export const SETTINGS_KEY = "vietnam-strike-set-v1";

export const WEAPON = {
  rifle: { cd: 0.13, dmg: 16, speed: 780, spread: 0, count: 1, life: 0.9 },
  mg: { cd: 0.055, dmg: 11, speed: 860, spread: 0.04, count: 1, life: 0.75 },
  spread: { cd: 0.22, dmg: 10, speed: 700, spread: 0.22, count: 5, life: 0.55 },
} as const;

export type WeaponId = keyof typeof WEAPON;
