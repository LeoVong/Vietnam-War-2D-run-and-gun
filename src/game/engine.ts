import {
  AIR_SPEED,
  APEX_HANG,
  COYOTE,
  FIXED_DT,
  GRAVITY_DOWN,
  GRAVITY_UP,
  GROUND_Y,
  HS_KEY,
  JUMP_BUF,
  JUMP_V,
  LEVEL_W,
  MAX_DT,
  MAX_FALL,
  MOVE_SPEED,
  PLAYER_H,
  PLAYER_W,
  SETTINGS_KEY,
  VIEW_H,
  VIEW_W,
  WEAPON,
  type WeaponId,
} from "./const";
import { loadArt, type Art } from "./assets";
import { GameAudio } from "./audio";
import { Input } from "./input";
import { buildLevel, type Level, type PickupKind, type Rect } from "./level";

export type Mode = "boot" | "title" | "playing" | "paused" | "dead" | "win";

export type Snapshot = {
  mode: Mode;
  score: number;
  hi: number;
  hp: number;
  lives: number;
  grenades: number;
  weapon: WeaponId;
  load: number;
  muted: boolean;
  stage: string;
  bossHp: number;
  bossMax: number;
};

type Actor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: number;
  hp: number;
  maxHp: number;
  grounded: boolean;
  flash: number;
  animT: number;
  alive: boolean;
};

type Player = Actor & {
  coyote: number;
  jumpBuf: number;
  crouch: boolean;
  shootCd: number;
  nadeCd: number;
  grenades: number;
  weapon: WeaponId;
  weaponT: number;
  invuln: number;
  lives: number;
  squish: number;
};

type Enemy = Actor & {
  kind: "grunt" | "gunner" | "heli" | "tank" | "boss";
  shootCd: number;
  homeY: number;
  phase: number;
  hurtT: number;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  from: "player" | "enemy";
  life: number;
  kind: "ball" | "shell" | "nade";
  bounces: number;
  alive: boolean;
};

type Pickup = { x: number; y: number; kind: PickupKind; alive: boolean; t: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
};
type Boom = { x: number; y: number; t: number; big: boolean };
type Floater = { x: number; y: number; text: string; t: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const aabb = (ax: number, ay: number, aw: number, ah: number, b: Rect) =>
  ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  art: Art | null = null;
  audio = new GameAudio();
  input = new Input();
  level: Level = buildLevel();
  mode: Mode = "boot";
  load = 0;
  score = 0;
  hi = 0;
  player!: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  booms: Boom[] = [];
  floaters: Floater[] = [];
  camX = 0;
  camY = 0;
  look = 0;
  trauma = 0;
  hitstop = 0;
  time = 0;
  acc = 0;
  raf = 0;
  last = 0;
  reduced = false;
  bossLock = false;
  checkpoint = 180;
  listeners = new Set<() => void>();
  vignette = 0;
  hudT = 0;
  private solids: Rect[] = [];
  private _snap: Snapshot = {
    mode: "boot",
    score: 0,
    hi: 0,
    hp: 100,
    lives: 3,
    grenades: 5,
    weapon: "rifle",
    load: 0,
    muted: false,
    stage: "",
    bossHp: 0,
    bossMax: 900,
  };

  getSnapshot = () => this._snap;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    try {
      this.hi = Number(localStorage.getItem(HS_KEY) || 0) || 0;
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) this.audio.setMuted(JSON.parse(s).muted === true);
    } catch {
      /* ignore */
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  emit() {
    this._snap = this.snapshot();
    for (const fn of this.listeners) fn();
  }

  snapshot(): Snapshot {
    const boss = this.enemies.find((e) => e.kind === "boss");
    let stage = "叢林小徑";
    if (this.player && this.player.x > 8600) stage = "前線指揮";
    else if (this.player && this.player.x > 4300) stage = "河岸村落";
    return {
      mode: this.mode,
      score: this.score,
      hi: Math.max(this.hi, this.score),
      hp: this.player?.hp ?? 100,
      lives: this.player?.lives ?? 3,
      grenades: this.player?.grenades ?? 5,
      weapon: this.player?.weapon ?? "rifle",
      load: this.load,
      muted: this.audio.muted,
      stage,
      bossHp: boss && boss.alive ? boss.hp : 0,
      bossMax: boss?.maxHp ?? 900,
    };
  }

  async init() {
    this.fit();
    this.art = await loadArt((p) => {
      this.load = p;
      this.emit();
    });
    this.reset(false);
    this.mode = "title";
    this.emit();
  }

  fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(VIEW_W * dpr);
    this.canvas.height = Math.floor(VIEW_H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  startLoop() {
    this.input.attach();
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      let dt = (now - this.last) / 1000;
      this.last = now;
      dt = Math.min(MAX_DT, Math.max(0, dt));
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.update(FIXED_DT);
        this.acc -= FIXED_DT;
        steps += 1;
      }
      this.draw();
    };
    this.raf = requestAnimationFrame(tick);
    window.addEventListener("resize", () => this.fit());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.audio.unlock();
    });
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
  }

  private mkPlayer(x: number, y: number, lives: number): Player {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      w: PLAYER_W,
      h: PLAYER_H,
      facing: 1,
      hp: 100,
      maxHp: 100,
      grounded: true,
      flash: 0,
      animT: 0,
      alive: true,
      coyote: 0,
      jumpBuf: 0,
      crouch: false,
      shootCd: 0,
      nadeCd: 0,
      grenades: 5,
      weapon: "rifle",
      weaponT: 0,
      invuln: 1.2,
      lives,
      squish: 1,
    };
  }

  reset(keepScore: boolean) {
    if (!keepScore) this.score = 0;
    this.level = buildLevel();
    this.solids = [...this.level.grounds, ...this.level.platforms];
    this.player = this.mkPlayer(180, GROUND_Y, 2);
    this.enemies = this.level.enemies.map((s) => this.mkEnemy(s.kind, s.x, s.y));
    this.pickups = this.level.pickups.map((p) => ({ ...p, alive: true, t: 0 }));
    this.bullets = [];
    this.particles = [];
    this.booms = [];
    this.floaters = [];
    this.camX = 0;
    this.look = 0;
    this.trauma = 0;
    this.bossLock = false;
    this.checkpoint = 180;
    this.time = 0;
    this.vignette = 0;
  }

  private mkEnemy(kind: Enemy["kind"], x: number, y: number): Enemy {
    const stats = {
      grunt: { w: 32, h: 50, hp: 34, facing: -1 },
      gunner: { w: 34, h: 48, hp: 48, facing: -1 },
      heli: { w: 110, h: 48, hp: 90, facing: -1 },
      tank: { w: 120, h: 58, hp: 180, facing: -1 },
      boss: { w: 210, h: 88, hp: 900, facing: -1 },
    }[kind];
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      w: stats.w,
      h: stats.h,
      facing: stats.facing,
      hp: stats.hp,
      maxHp: stats.hp,
      grounded: kind !== "heli" && kind !== "boss",
      flash: 0,
      animT: Math.random(),
      alive: true,
      shootCd: 0.4 + Math.random(),
      homeY: y,
      phase: Math.random() * Math.PI * 2,
      hurtT: 0,
    };
  }

  beginRun() {
    this.audio.unlock();
    this.audio.ui();
    this.reset(false);
    this.mode = "playing";
    this.emit();
  }

  private saveHi() {
    this.hi = Math.max(this.hi, this.score);
    try {
      localStorage.setItem(HS_KEY, String(this.hi));
    } catch {
      /* ignore */
    }
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: this.audio.muted }));
    } catch {
      /* ignore */
    }
    this.emit();
  }

  update(dt: number) {
    const a = this.input.sample();
    if (a.mutePressed) this.toggleMute();

    if (this.mode === "title") {
      this.time += dt;
      this.camX = (this.camX + 28 * dt) % 800;
      if (a.confirmPressed || a.jumpPressed) this.beginRun();
      if (a.pausePressed) this.mode = "title";
      return;
    }
    if (this.mode === "paused") {
      if (a.pausePressed || a.confirmPressed) {
        this.mode = "playing";
        this.emit();
      }
      return;
    }
    if (this.mode === "dead" || this.mode === "win") {
      if (a.confirmPressed || a.jumpPressed) this.beginRun();
      return;
    }
    if (this.mode !== "playing") return;

    if (a.pausePressed) {
      this.mode = "paused";
      this.emit();
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    this.vignette = Math.max(0, this.vignette - dt * 2.2);
    this.updatePlayer(dt, a);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.wireProbe();
    this.hudT += dt;
    if (this.hudT > 0.12) {
      this.hudT = 0;
      this.emit();
    }
  }

  private updatePlayer(dt: number, a: ReturnType<Input["sample"]>) {
    const p = this.player;
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.nadeCd = Math.max(0, p.nadeCd - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.weaponT = Math.max(0, p.weaponT - dt);
    if (p.weaponT <= 0) p.weapon = "rifle";
    p.animT += dt;
    p.squish += (1 - p.squish) * (1 - Math.exp(-14 * dt));

    const speed = p.grounded ? MOVE_SPEED : AIR_SPEED;
    p.vx = a.moveX * speed;
    if (a.moveX !== 0) p.facing = a.moveX > 0 ? 1 : -1;
    p.crouch = p.grounded && a.aimDown && !a.aimUp;
    p.h = p.crouch ? 36 : PLAYER_H;

    if (p.grounded) p.coyote = COYOTE;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (a.jumpPressed) p.jumpBuf = JUMP_BUF;
    else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.squish = 0.72;
      this.audio.jump();
    }
    if (!a.jump && p.vy < 0) p.vy *= 0.52;

    const grav = p.vy < 0 ? GRAVITY_UP : GRAVITY_DOWN;
    const hang = Math.abs(p.vy) < 80 ? APEX_HANG : 1;
    p.vy = Math.min(MAX_FALL, p.vy + grav * hang * dt);

    const wasGround = p.grounded;
    this.moveActor(p, dt, true);
    if (p.grounded && !wasGround && p.vy >= 0) {
      p.squish = 1.18;
      this.audio.land();
      this.burst(p.x, p.y, 6, "#6b5a3a", 80);
    }

    if (p.y > VIEW_H + 80) this.hurt(p, 100, 0);

    let ax = p.facing;
    let ay = 0;
    if (a.aimUp) ay = -1;
    if (a.aimDown && !p.grounded) ay = 1;
    if (ay !== 0 && a.moveX === 0) ax = 0;
    const mag = Math.hypot(ax, ay) || 1;
    ax /= mag;
    ay /= mag;

    if (a.fire && p.shootCd <= 0) this.fireWeapon(p, ax, ay);
    if (a.grenadePressed && p.grenades > 0 && p.nadeCd <= 0) {
      p.grenades -= 1;
      p.nadeCd = 0.45;
      this.spawnBullet(p.x + p.facing * 18, p.y - p.h * 0.7, p.facing * 280, -420, 9, 55, "player", "nade", 2.4);
      this.audio.shoot();
      this.emit();
    }

    for (const cp of this.level.checkpoints) {
      if (p.x > cp && this.checkpoint < cp) this.checkpoint = cp;
    }

    if (p.x > this.level.bossLockX) this.bossLock = true;
    if (this.bossLock) p.x = clamp(p.x, this.level.bossLockX + 40, LEVEL_W - 80);
    p.x = clamp(p.x, 40, LEVEL_W - 40);
  }

  private fireWeapon(p: Player, ax: number, ay: number) {
    const w = WEAPON[p.weapon];
    p.shootCd = w.cd;
    const ox = p.x + ax * 28;
    const oy = p.y - p.h * (p.crouch ? 0.45 : 0.62);
    for (let i = 0; i < w.count; i++) {
      const spread = (i - (w.count - 1) / 2) * w.spread;
      const c = Math.cos(spread);
      const s = Math.sin(spread);
      const dx = ax * c - ay * s;
      const dy = ax * s + ay * c;
      this.spawnBullet(ox, oy, dx * w.speed, dy * w.speed, 4, w.dmg, "player", "ball", w.life);
    }
    this.audio.shoot();
    this.trauma = Math.min(1, this.trauma + 0.08);
    this.burst(ox, oy, 3, "#f0d080", 60);
  }

  private spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    dmg: number,
    from: Bullet["from"],
    kind: Bullet["kind"],
    life: number,
  ) {
    this.bullets.push({ x, y, vx, vy, r, dmg, from, kind, life, bounces: kind === "nade" ? 1 : 0, alive: true });
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.shootCd = Math.max(0, e.shootCd - dt);
      const dx = p.x - e.x;
      const onScreen = e.x > this.camX - 120 && e.x < this.camX + VIEW_W + 160;
      if (!onScreen && e.kind !== "boss") continue;

      if (e.kind === "grunt") {
        e.facing = dx < 0 ? -1 : 1;
        if (Math.abs(dx) > 160) e.vx = e.facing * 76;
        else e.vx = 0;
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY_DOWN * dt);
        this.moveActor(e, dt, false);
        if (e.shootCd <= 0 && Math.abs(dx) < 480 && Math.abs(p.y - e.y) < 90) {
          e.shootCd = 1.35;
          this.spawnBullet(e.x + e.facing * 18, e.y - 28, e.facing * 340, 0, 4, 10, "enemy", "ball", 1.4);
        }
      } else if (e.kind === "gunner") {
        e.vx = 0;
        e.facing = dx < 0 ? -1 : 1;
        if (e.shootCd <= 0 && Math.abs(dx) < 620) {
          e.shootCd = 1.05;
          const ang = Math.atan2(p.y - e.h * 0.6 - (e.y - e.h * 0.6), p.x - e.x);
          this.spawnBullet(e.x + e.facing * 16, e.y - 30, Math.cos(ang) * 380, Math.sin(ang) * 380, 4, 12, "enemy", "ball", 1.5);
        }
      } else if (e.kind === "heli") {
        e.x += Math.sin(this.time * 0.35 + e.phase) * 40 * dt;
        e.y = e.homeY + Math.sin(this.time * 1.6 + e.phase) * 36;
        e.facing = dx < 0 ? -1 : 1;
        if (e.shootCd <= 0) {
          e.shootCd = 1.2;
          this.spawnBullet(e.x, e.y + 20, 0, 280, 5, 14, "enemy", "shell", 2);
        }
      } else if (e.kind === "tank") {
        e.facing = dx < 0 ? -1 : 1;
        e.vx = Math.abs(dx) > 260 ? e.facing * 42 : 0;
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY_DOWN * dt);
        this.moveActor(e, dt, false);
        if (e.shootCd <= 0 && Math.abs(dx) < 700) {
          e.shootCd = 1.8;
          this.spawnBullet(e.x + e.facing * 50, e.y - 36, e.facing * 420, -40, 7, 22, "enemy", "shell", 1.8);
        }
      } else if (e.kind === "boss") {
        this.updateBoss(e, dt, dx);
      }

      if (e.kind !== "heli" && e.kind !== "boss") {
        const box = { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
        const pb = { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
        if (aabb(pb.x, pb.y, pb.w, pb.h, box)) this.hurt(p, 12, Math.sign(p.x - e.x) || 1);
      }
    }

    const boss = this.enemies.find((en) => en.kind === "boss");
    if (boss && !boss.alive && this.mode === "playing") {
      this.mode = "win";
      this.saveHi();
      this.audio.explode(true);
      this.emit();
    }
  }

  private updateBoss(e: Enemy, dt: number, dx: number) {
    const angry = e.hp < e.maxHp * 0.5;
    e.x = 9800 + Math.sin(this.time * (angry ? 0.7 : 0.45)) * (angry ? 360 : 280);
    e.y = 230 + Math.sin(this.time * 1.3) * 50;
    e.facing = dx < 0 ? -1 : 1;
    if (e.shootCd <= 0) {
      const pattern = Math.floor(this.time / (angry ? 1.4 : 2.1)) % 3;
      if (pattern === 0) {
        e.shootCd = angry ? 0.28 : 0.42;
        this.spawnBullet(e.x - 40, e.y + 20, -220, 180, 5, 14, "enemy", "ball", 2);
        this.spawnBullet(e.x + 40, e.y + 20, 80, 220, 5, 14, "enemy", "ball", 2);
      } else if (pattern === 1) {
        e.shootCd = 0.55;
        this.spawnBullet(e.x, e.y + 28, 0, 340, 8, 20, "enemy", "shell", 2.2);
      } else {
        e.shootCd = 0.7;
        for (let i = -2; i <= 2; i++) {
          this.spawnBullet(e.x, e.y + 10, i * 140, 240, 5, 12, "enemy", "ball", 2);
        }
      }
    }
  }

  private updateBullets(dt: number) {
    const p = this.player;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.life -= dt;
      if (b.kind === "nade" || b.kind === "shell") b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.y > VIEW_H + 40 || b.x < this.camX - 80 || b.x > this.camX + VIEW_W + 80) {
        if (b.kind === "nade") this.explode(b.x, b.y, 78, 55, b.from);
        b.alive = false;
        continue;
      }
      const hitGround = this.solids.find((s) => aabb(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, s));
      if (hitGround) {
        if (b.kind === "nade" && b.bounces > 0 && b.vy > 0) {
          b.y = hitGround.y - b.r - 1;
          b.vy *= -0.45;
          b.vx *= 0.7;
          b.bounces -= 1;
        } else {
          if (b.kind === "nade") this.explode(b.x, b.y, 78, 55, b.from);
          else this.burst(b.x, b.y, 4, "#c4b07a", 70);
          b.alive = false;
        }
        continue;
      }
      if (b.from === "player") {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.abs(b.x - e.x) < e.w * 0.5 + b.r && b.y < e.y + 8 && b.y > e.y - e.h - 8) {
            b.alive = false;
            this.damageEnemy(e, b.dmg, b.x);
            break;
          }
        }
      } else if (p.invuln <= 0) {
        if (Math.abs(b.x - p.x) < p.w * 0.5 + b.r && b.y < p.y + 4 && b.y > p.y - p.h - 4) {
          b.alive = false;
          this.hurt(p, b.dmg, Math.sign(b.vx) || -p.facing);
        }
      }
    }
    if (this.bullets.length > 180) this.bullets = this.bullets.filter((b) => b.alive);
  }

  private damageEnemy(e: Enemy, dmg: number, hx: number) {
    e.hp -= dmg;
    e.flash = 0.08;
    e.hurtT = 0.12;
    this.hitstop = Math.min(0.06, this.hitstop + 0.025);
    this.trauma = Math.min(1, this.trauma + (e.kind === "boss" ? 0.18 : 0.12));
    this.floaters.push({ x: e.x, y: e.y - e.h, text: String(dmg), t: 0.6 });
    this.burst(hx, e.y - e.h * 0.5, 5, "#e8e0c8", 120);
    if (e.hp <= 0) {
      e.alive = false;
      const pts = { grunt: 150, gunner: 250, heli: 500, tank: 800, boss: 5000 }[e.kind];
      this.score += pts;
      this.explode(e.x, e.y - e.h * 0.4, e.kind === "boss" ? 140 : 64, 0, "player");
      if (e.kind === "tank" || e.kind === "heli" || e.kind === "boss") {
        this.pickups.push({ x: e.x, y: e.y - 20, kind: "hp", alive: true, t: 0 });
      }
      this.emit();
    }
  }

  private explode(x: number, y: number, r: number, dmg: number, from: Bullet["from"]) {
    this.booms.push({ x, y, t: 0, big: r > 90 });
    this.audio.explode(r > 90);
    this.trauma = Math.min(1, this.trauma + 0.35);
    this.burst(x, y, 18, "#d07030", 220);
    if (dmg <= 0) return;
    if (from === "player") {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - x, e.y - e.h * 0.5 - y) < r + e.w * 0.3) this.damageEnemy(e, dmg, x);
      }
    } else if (Math.hypot(this.player.x - x, this.player.y - y) < r) {
      this.hurt(this.player, dmg * 0.6, 0);
    }
  }

  private hurt(p: Player, dmg: number, dir: number) {
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.9;
    p.flash = 0.12;
    p.vx += dir * 180;
    p.vy = Math.min(p.vy, -180);
    this.audio.hit();
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.vignette = 1;
    this.emit();
    if (p.hp <= 0) {
      p.lives -= 1;
      this.explode(p.x, p.y - 20, 50, 0, "enemy");
      if (p.lives < 0) {
        this.mode = "dead";
        this.saveHi();
        this.emit();
        return;
      }
      p.hp = 100;
      p.x = this.checkpoint;
      p.y = GROUND_Y;
      p.vx = 0;
      p.vy = 0;
      p.invuln = 1.8;
      p.weapon = "rifle";
      this.bossLock = this.checkpoint >= this.level.bossLockX;
      this.emit();
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const u of this.pickups) {
      if (!u.alive) continue;
      u.t += dt;
      if (Math.abs(u.x - p.x) < 28 && Math.abs(u.y - (p.y - 20)) < 36) {
        u.alive = false;
        this.audio.pickup();
        this.score += 50;
        if (u.kind === "hp") p.hp = Math.min(p.maxHp, p.hp + 40);
        if (u.kind === "mg") {
          p.weapon = "mg";
          p.weaponT = 9;
        }
        if (u.kind === "spread") {
          p.weapon = "spread";
          p.weaponT = 8;
        }
        if (u.kind === "nade") p.grenades = Math.min(9, p.grenades + 3);
        this.floaters.push({ x: u.x, y: u.y - 20, text: "+50", t: 0.7 });
        this.emit();
      }
    }
  }

  private updateParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += q.g * dt;
    }
    if (this.particles.length > 220) this.particles = this.particles.filter((q) => q.life > 0);
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.45);
    for (const f of this.floaters) f.t -= dt;
    this.floaters = this.floaters.filter((f) => f.t > 0);
  }

  private burst(x: number, y: number, n: number, color: string, spd: number) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * s,
        vy: Math.sin(ang) * s - 40,
        life: 0.25 + Math.random() * 0.35,
        max: 0.5,
        size: 2 + Math.random() * 3,
        color,
        g: 420,
      });
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    this.look += (p.facing * 150 - this.look) * (1 - Math.exp(-3 * dt));
    let target = p.x - VIEW_W * 0.38 + this.look;
    if (this.bossLock) target = this.level.bossLockX;
    this.camX += (target - this.camX) * (1 - Math.exp(-4.2 * dt));
    this.camX = clamp(this.camX, 0, LEVEL_W - VIEW_W);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }

  private moveActor(e: Actor, dt: number, isPlayer: boolean) {
    const steps = Math.max(1, Math.ceil((Math.abs(e.vx) + Math.abs(e.vy)) * dt / 18));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      e.x += e.vx * sdt;
      const boxX = { x: e.x - e.w / 2, y: e.y - e.h + 2, w: e.w, h: e.h - 4 };
      for (const s of this.solids) {
        if (s.oneWay) continue;
        if (!aabb(boxX.x, boxX.y, boxX.w, boxX.h, s)) continue;
        if (e.vx > 0) e.x = s.x - e.w / 2;
        else if (e.vx < 0) e.x = s.x + s.w + e.w / 2;
        e.vx = 0;
      }
      e.y += e.vy * sdt;
      let grounded = false;
      const boxY = { x: e.x - e.w / 2 + 2, y: e.y - e.h, w: e.w - 4, h: e.h };
      for (const s of this.solids) {
        if (!aabb(boxY.x, boxY.y, boxY.w, boxY.h, s)) continue;
        if (s.oneWay) {
          const prevBottom = e.y - e.vy * sdt;
          if (e.vy >= 0 && prevBottom <= s.y + 6) {
            if (isPlayer && this.input.actions.aimDown && this.input.actions.jump) continue;
            e.y = s.y;
            e.vy = 0;
            grounded = true;
          }
        } else if (e.vy >= 0) {
          e.y = s.y;
          e.vy = 0;
          grounded = true;
        } else {
          e.y = s.y + s.h + e.h;
          e.vy = 0;
        }
      }
      e.grounded = grounded;
    }
  }

  private wireProbe() {
    const p = this.player;
    (window as unknown as { __controlsTest?: object }).__controlsTest = {
      getX: () => p.x,
      getVx: () => p.vx,
      getSpeed: () => Math.abs(p.vx),
      getFacing: () => p.facing,
      getYaw: () => (p.facing > 0 ? 0 : Math.PI),
      setKeys: (codes: string[]) => this.input.setKeys(codes),
    };
  }

  draw() {
    const ctx = this.ctx;
    const art = this.art;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!art) {
      ctx.fillStyle = "#0c1210";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    const shake = this.reduced ? 0 : this.trauma * this.trauma;
    const sx = (Math.random() * 2 - 1) * 14 * shake;
    const sy = (Math.random() * 2 - 1) * 10 * shake;
    ctx.save();
    ctx.translate(sx, sy);
    this.drawLayer(art.sky, 0.04);
    this.drawLayer(art.far, 0.16);
    this.drawLayer(art.mid, 0.38);
    this.drawWorld();
    this.drawLayer(art.near, 1.12, true);
    ctx.restore();
    if (this.vignette > 0) {
      ctx.fillStyle = `rgba(120,20,12,${0.22 * this.vignette})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawLayer(img: HTMLImageElement, factor: number, overlay = false) {
    const ctx = this.ctx;
    const scale = Math.max(VIEW_W / img.width, VIEW_H / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const x = -((this.camX * factor) % dw);
    const y = VIEW_H - dh;
    ctx.drawImage(img, x, y, dw, dh);
    ctx.drawImage(img, x + dw - 1, y, dw, dh);
    if (overlay) {
      /* near plate already has alpha */
    }
  }

  private drawWorld() {
    const ctx = this.ctx;
    const art = this.art!;
    const cam = this.camX;

    for (const pit of this.level.pits) {
      const x = pit.x - cam;
      ctx.fillStyle = "#1a2a28";
      ctx.fillRect(x, pit.y, pit.w, pit.h);
      ctx.fillStyle = "rgba(40,90,80,0.55)";
      ctx.fillRect(x, pit.y + 36, pit.w, pit.h);
    }

    for (const d of this.level.deco) {
      if (d.kind === "sandbags") continue;
      const img = d.kind === "palm" ? art.palm : art.hut;
      const h = d.kind === "palm" ? 210 * (d.s ?? 1) : 150 * (d.s ?? 1);
      const w = h * (img.width / img.height);
      this.blit(img, d.x - cam, d.y, w, h, d.flip ?? false, 1);
    }

    for (const s of this.level.grounds) {
      this.drawGround(s);
    }
    for (const s of this.level.platforms) {
      const x = s.x - cam;
      ctx.fillStyle = "#3a2a18";
      ctx.fillRect(x, s.y, s.w, s.h);
      ctx.fillStyle = "#5a6a38";
      ctx.fillRect(x, s.y, s.w, 5);
    }
    for (const d of this.level.deco) {
      if (d.kind !== "sandbags") continue;
      const h = 58;
      const w = h * (art.sandbags.width / art.sandbags.height);
      this.blit(art.sandbags, d.x - cam, d.y, w, h, false, 1);
    }

    for (const u of this.pickups) {
      if (!u.alive) continue;
      const bob = Math.sin(this.time * 4 + u.x) * 6;
      this.blit(art.pickup, u.x - cam, u.y + bob, 44, 40, false, 1);
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.x < cam - 160 || e.x > cam + VIEW_W + 160) continue;
      this.drawEnemy(e);
    }

    this.drawPlayer();

    for (const b of this.bullets) {
      if (!b.alive) continue;
      const x = b.x - cam;
      if (b.kind === "nade") {
        ctx.fillStyle = "#6b8f4a";
        ctx.beginPath();
        ctx.arc(x, b.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const img = art.bullet[b.from === "player" ? 0 : 1];
        const ang = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(x, b.y);
        ctx.rotate(ang);
        ctx.drawImage(img, -10, -5, 20, 10);
        ctx.restore();
      }
    }

    for (const q of this.particles) {
      if (q.life <= 0) continue;
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - cam, q.y, q.size, q.size);
      ctx.globalAlpha = 1;
    }

    for (const b of this.booms) {
      const i = Math.min(3, Math.floor(b.t / 0.1));
      const img = art.explode[i];
      const s = (b.big ? 160 : 88) * (0.7 + b.t);
      ctx.globalAlpha = 1 - b.t / 0.45;
      ctx.drawImage(img, b.x - cam - s / 2, b.y - s / 2, s, s);
      ctx.globalAlpha = 1;
    }

    ctx.font = "700 16px Barlow, sans-serif";
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.t * 3);
      ctx.fillStyle = "#e8e0c8";
      ctx.fillText(f.text, f.x - cam, f.y - (0.7 - f.t) * 40);
      ctx.globalAlpha = 1;
    }
  }

  private drawGround(s: Rect) {
    const ctx = this.ctx;
    const art = this.art!;
    const x = s.x - this.camX;
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(x, s.y + 8, s.w, VIEW_H - s.y);
    const img = art.ground;
    const dh = 150;
    const dw = img.width * (dh / img.height);
    for (let gx = x; gx < x + s.w; gx += dw - 2) {
      ctx.drawImage(img, gx, s.y - 52, dw, dh);
    }
  }

  private blit(
    img: HTMLImageElement,
    x: number,
    feetY: number,
    w: number,
    h: number,
    flip: boolean,
    alpha: number,
    flash = false,
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, feetY);
    if (flip) ctx.scale(-1, 1);
    if (flash) ctx.filter = "brightness(2.4)";
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  private drawPlayer() {
    const p = this.player;
    const art = this.art!;
    const a = this.input.actions;
    let frames = art.playerIdle;
    let fps = 7;
    if (!p.grounded) {
      frames = art.playerJump;
      fps = 0;
    } else if (a.fire) {
      frames = art.playerShoot;
      fps = 14;
    } else if (Math.abs(p.vx) > 30) {
      frames = art.playerRun;
      fps = 12;
    }
    let idx = 0;
    if (!p.grounded) {
      if (p.vy < -220) idx = 1;
      else if (p.vy < 80) idx = 2;
      else idx = 3;
    } else {
      idx = Math.floor(p.animT * fps) % frames.length;
    }
    const blink = p.invuln > 0 && Math.floor(this.time * 18) % 2 === 0;
    const h = PLAYER_H * 1.92 * (p.crouch ? 0.82 : 1) * p.squish;
    const w = 88 * (p.crouch ? 1.08 : 1) / p.squish;
    this.blit(frames[idx] ?? frames[0], p.x - this.camX, p.y, w, h, p.facing < 0, blink ? 0.35 : 1, p.flash > 0);
  }

  private drawEnemy(e: Enemy) {
    const art = this.art!;
    const x = e.x - this.camX;
    if (e.kind === "grunt" || e.kind === "gunner") {
      const frames = art.grunt;
      const idx = e.vx !== 0 ? Math.floor(e.animT * 8) % 2 : e.shootCd < 0.2 ? 2 : 0;
      this.blit(frames[idx], x, e.y, 78, 90, e.facing > 0, 1, e.flash > 0);
    } else if (e.kind === "heli") {
      const idx = Math.floor(e.animT * 12) % art.heli.length;
      this.blit(art.heli[idx], x, e.y, 170, 92, e.facing > 0, 1, e.flash > 0);
    } else if (e.kind === "tank") {
      const idx = Math.floor(e.animT * 8) % art.tank.length;
      this.blit(art.tank[idx], x, e.y, 168, 92, e.facing > 0, 1, e.flash > 0);
    } else {
      const idx = Math.floor(e.animT * 10) % art.boss.length;
      this.blit(art.boss[idx], x, e.y, 280, 150, e.facing > 0, 1, e.flash > 0);
    }
  }
}
