import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Game, type Snapshot } from "./engine";

const empty: Snapshot = {
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

const WEAPON_LABEL = { rifle: "步槍", mg: "機槍", spread: "散彈" } as const;

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [touch, setTouch] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    setTouch(coarse);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas);
    gameRef.current = g;
    setGame(g);
    void g.init().then(() => g.startLoop());
    return () => g.stop();
  }, []);

  const snap = useSyncExternalStore(
    game ? game.subscribe : () => () => {},
    () => (game ? game.getSnapshot() : empty),
    () => empty,
  );

  const playing = snap.mode === "playing";
  const g = gameRef.current;

  return (
    <div className={`game-root ${touch && playing ? "has-touch" : ""}`}>
      <div className="game-stage">
        <canvas ref={canvasRef} width={1280} height={720} aria-label="越南大戰遊戲畫面" />

        {snap.mode !== "boot" && playing && (
          <div className="hud">
            <div className="hud-row">
              <div className="flex flex-col gap-2">
                <div className="hud-chip">
                  <span className="text-muted">{snap.stage}</span>
                  <strong>{snap.score.toLocaleString()}</strong>
                </div>
                <div className="hud-chip">
                  <span className="text-muted">HP</span>
                  <div className="hp-track">
                    <div className="hp-fill" style={{ width: `${Math.max(0, snap.hp)}%` }} />
                  </div>
                  <span>{snap.lives + 1}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="hud-chip"
                    onClick={() => g?.toggleMute()}
                    aria-label={snap.muted ? "開啟聲音" : "靜音"}
                  >
                    {snap.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <button
                    type="button"
                    className="hud-chip"
                    onClick={() => {
                      if (!g) return;
                      g.mode = "paused";
                      g.emit();
                    }}
                    aria-label="暫停"
                  >
                    <Pause size={16} />
                  </button>
                </div>
                <div className="hud-chip">
                  <span>{WEAPON_LABEL[snap.weapon]}</span>
                  <span className="text-muted">彈 {snap.grenades}</span>
                </div>
              </div>
            </div>
            {snap.bossHp > 0 && snap.stage === "前線指揮" && (
              <div className="mx-auto mb-3 w-full max-w-xl">
                <div className="hud-chip w-full justify-center">
                  <span className="text-muted">武裝直升機</span>
                  <div className="hp-track max-w-none flex-1">
                    <div
                      className="hp-fill bg-danger"
                      style={{ width: `${(snap.bossHp / snap.bossMax) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {snap.mode === "boot" && (
          <div className="menu-layer">
            <div className="panel text-center">
              <p className="display text-sm tracking-[0.28em] text-muted">OPERATION JUNGLE</p>
              <h1 className="display mt-2 text-4xl text-fg">越南大戰</h1>
              <p className="mt-4 text-sm tracking-[0.28em] text-muted">LOADING</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
                <div className="h-full bg-primary" style={{ width: `${Math.round(snap.load * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {snap.mode === "title" && (
          <div className="menu-layer">
            <div className="panel">
              <p className="text-xs tracking-[0.28em] text-muted">OPERATION JUNGLE · 1968</p>
              <h1 className="display mt-2 text-4xl text-fg sm:text-6xl">越南大戰</h1>
              <p className="mt-1 font-display text-base tracking-[0.22em] text-primary sm:text-lg">VIETNAM STRIKE</p>
              <p className="mt-3 hidden text-sm leading-relaxed text-muted sm:block">
                橫向捲軸動作射擊。突破叢林防線，清出村落，在前線擊墜武裝直升機。
              </p>
              <p className="mt-3 text-sm text-muted">
                最高戰績 <strong className="text-fg">{snap.hi.toLocaleString()}</strong>
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button type="button" className="btn btn-primary" onClick={() => g?.beginRun()}>
                  <Play size={16} /> 開始行動
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setHelp((h) => !h)}>
                  {help ? "收起操作" : "操作說明"}
                </button>
              </div>
              {help && (
                <div className="help-grid mt-5 border-t border-border pt-4">
                  <b>A / D</b>
                  <span>左右移動</span>
                  <b>W / S</b>
                  <span>瞄準上 / 蹲下（空中向下射）</span>
                  <b>空白 / K</b>
                  <span>跳躍</span>
                  <b>J / Z</b>
                  <span>射擊（按住連發）</span>
                  <b>L / G</b>
                  <span>手榴彈</span>
                  <b>Esc</b>
                  <span>暫停</span>
                </div>
              )}
            </div>
          </div>
        )}

        {snap.mode === "paused" && (
          <div className="menu-layer">
            <div className="panel text-center">
              <h2 className="display text-3xl">暫停</h2>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!g) return;
                    g.mode = "playing";
                    g.emit();
                  }}
                >
                  繼續行動
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => g?.toggleMute()}>
                  {snap.muted ? "開啟聲音" : "關閉聲音"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!g) return;
                    g.mode = "title";
                    g.emit();
                  }}
                >
                  返回標題
                </button>
              </div>
            </div>
          </div>
        )}

        {snap.mode === "dead" && (
          <div className="menu-layer">
            <div className="panel text-center">
              <h2 className="display text-3xl">行動失敗</h2>
              <p className="mt-3 text-muted">
                戰績 <strong className="text-fg">{snap.score.toLocaleString()}</strong>
              </p>
              <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => g?.beginRun()}>
                再次出擊
              </button>
            </div>
          </div>
        )}

        {snap.mode === "win" && (
          <div className="menu-layer">
            <div className="panel text-center">
              <p className="text-xs tracking-[0.28em] text-muted">MISSION COMPLETE</p>
              <h2 className="display mt-2 text-3xl">任務完成</h2>
              <p className="mt-3 text-muted">
                戰績 <strong className="text-fg">{snap.score.toLocaleString()}</strong>
              </p>
              <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => g?.beginRun()}>
                再打一輪
              </button>
            </div>
          </div>
        )}
      </div>

      {touch && playing && <TouchBar gameRef={gameRef} />}
    </div>
  );
}

function TouchBar({ gameRef }: { gameRef: RefObject<Game | null> }) {
  const baseRef = useRef<HTMLDivElement>(null);

  const setStick = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    const g = gameRef.current;
    if (!el || !g) return;
    const r = el.getBoundingClientRect();
    const dx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (clientY - (r.top + r.height / 2)) / (r.height / 2);
    g.input.touchMoveX = Math.max(-1, Math.min(1, dx));
    g.input.touchAimUp = dy < -0.35;
    g.input.touchAimDown = dy > 0.4;
    const knob = el.querySelector(".stick-knob") as HTMLElement | null;
    if (knob) {
      const cx = Math.max(-1, Math.min(1, dx)) * 28;
      const cy = Math.max(-1, Math.min(1, dy)) * 28;
      knob.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;
    }
  };

  const clearStick = () => {
    const g = gameRef.current;
    if (!g) return;
    g.input.touchMoveX = 0;
    g.input.touchAimUp = false;
    g.input.touchAimDown = false;
    const el = baseRef.current?.querySelector(".stick-knob") as HTMLElement | null;
    if (el) el.style.transform = "translate(-50%, -50%)";
  };

  return (
    <div className="touch-bar">
      <div
        ref={baseRef}
        className="stick-base"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons) setStick(e.clientX, e.clientY);
        }}
        onPointerUp={clearStick}
        onPointerCancel={clearStick}
      >
        <div className="stick-knob" />
      </div>
      <div className="touch-actions">
        <button
          type="button"
          className="touch-btn"
          onPointerDown={() => {
            if (gameRef.current) gameRef.current.input.touchGrenade = true;
          }}
          onPointerUp={() => {
            if (gameRef.current) gameRef.current.input.touchGrenade = false;
          }}
          onPointerCancel={() => {
            if (gameRef.current) gameRef.current.input.touchGrenade = false;
          }}
        >
          彈
        </button>
        <button
          type="button"
          className="touch-btn"
          onPointerDown={() => {
            if (gameRef.current) gameRef.current.input.touchJump = true;
          }}
          onPointerUp={() => {
            if (gameRef.current) gameRef.current.input.touchJump = false;
          }}
          onPointerCancel={() => {
            if (gameRef.current) gameRef.current.input.touchJump = false;
          }}
        >
          跳
        </button>
        <button
          type="button"
          className="touch-btn fire"
          onPointerDown={() => {
            if (gameRef.current) gameRef.current.input.touchFire = true;
          }}
          onPointerUp={() => {
            if (gameRef.current) gameRef.current.input.touchFire = false;
          }}
          onPointerCancel={() => {
            if (gameRef.current) gameRef.current.input.touchFire = false;
          }}
        >
          射
        </button>
      </div>
    </div>
  );
}
