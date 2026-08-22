const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyJ",
  "KeyK",
  "KeyL",
  "KeyZ",
  "KeyX",
  "KeyG",
  "KeyP",
  "Escape",
  "Enter",
  "KeyM",
]);

export type Actions = {
  moveX: number;
  aimUp: boolean;
  aimDown: boolean;
  jump: boolean;
  jumpPressed: boolean;
  fire: boolean;
  grenadePressed: boolean;
  pausePressed: boolean;
  confirmPressed: boolean;
  mutePressed: boolean;
};

const empty = (): Actions => ({
  moveX: 0,
  aimUp: false,
  aimDown: false,
  jump: false,
  jumpPressed: false,
  fire: false,
  grenadePressed: false,
  pausePressed: false,
  confirmPressed: false,
  mutePressed: false,
});

export class Input {
  keys = new Set<string>();
  forced = new Set<string>();
  touchMoveX = 0;
  touchAimUp = false;
  touchAimDown = false;
  touchJump = false;
  touchFire = false;
  touchGrenade = false;
  private prevJump = false;
  private prevGrenade = false;
  private prevPause = false;
  private prevConfirm = false;
  private prevMute = false;
  private prevTouchGrenade = false;
  actions: Actions = empty();
  private attached = false;

  private onDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
  };

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
  }

  setKeys(codes: string[]) {
    this.forced.clear();
    for (const c of codes) this.forced.add(c);
  }

  private held(code: string) {
    return this.keys.has(code) || this.forced.has(code);
  }

  sample(): Actions {
    const left = this.held("KeyA") || this.held("ArrowLeft") || this.touchMoveX < -0.25;
    const right = this.held("KeyD") || this.held("ArrowRight") || this.touchMoveX > 0.25;
    let moveX = 0;
    if (left) moveX -= 1;
    if (right) moveX += 1;
    if (Math.abs(this.touchMoveX) > 0.25) moveX = Math.sign(this.touchMoveX);

    const aimUp = this.held("KeyW") || this.held("ArrowUp") || this.touchAimUp;
    const aimDown = this.held("KeyS") || this.held("ArrowDown") || this.touchAimDown;
    const jump = this.held("Space") || this.held("KeyK") || this.touchJump;
    const fire =
      this.held("KeyJ") || this.held("KeyZ") || this.held("ControlLeft") || this.touchFire;
    const grenade = this.held("KeyL") || this.held("KeyX") || this.held("KeyG") || this.touchGrenade;
    const pause = this.held("Escape") || this.held("KeyP");
    const confirm = this.held("Enter");
    const mute = this.held("KeyM");

    const a: Actions = {
      moveX,
      aimUp,
      aimDown,
      jump,
      jumpPressed: jump && !this.prevJump,
      fire,
      grenadePressed: (grenade && !this.prevGrenade) || (this.touchGrenade && !this.prevTouchGrenade),
      pausePressed: pause && !this.prevPause,
      confirmPressed: confirm && !this.prevConfirm,
      mutePressed: mute && !this.prevMute,
    };
    this.prevJump = jump;
    this.prevGrenade = grenade;
    this.prevTouchGrenade = this.touchGrenade;
    this.prevPause = pause;
    this.prevConfirm = confirm;
    this.prevMute = mute;
    this.actions = a;
    return a;
  }
}
