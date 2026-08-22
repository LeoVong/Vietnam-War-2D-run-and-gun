export type Sheet = HTMLImageElement[];

export type Art = {
  playerIdle: Sheet;
  playerRun: Sheet;
  playerShoot: Sheet;
  playerJump: Sheet;
  grunt: Sheet;
  heli: Sheet;
  tank: Sheet;
  boss: Sheet;
  bullet: Sheet;
  explode: Sheet;
  pickup: HTMLImageElement;
  palm: HTMLImageElement;
  sandbags: HTMLImageElement;
  hut: HTMLImageElement;
  sky: HTMLImageElement;
  far: HTMLImageElement;
  mid: HTMLImageElement;
  near: HTMLImageElement;
  ground: HTMLImageElement;
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

async function sheet(prefix: string, n: number): Promise<Sheet> {
  const out: Sheet = [];
  for (let i = 0; i < n; i++) {
    out.push(await load(`/game/sprites/${prefix}-${i}.png`));
  }
  return out;
}

export async function loadArt(onProgress: (p: number) => void): Promise<Art> {
  const bag: Partial<Art> = {};
  const tasks: Array<Promise<unknown>> = [];
  let done = 0;
  const mark = () => {
    done += 1;
    onProgress(done / 19);
  };

  tasks.push(sheet("player-idle", 4).then((v) => { bag.playerIdle = v; mark(); }));
  tasks.push(sheet("player-run", 6).then((v) => { bag.playerRun = v; mark(); }));
  tasks.push(sheet("player-shoot", 4).then((v) => { bag.playerShoot = v; mark(); }));
  tasks.push(sheet("player-jump", 4).then((v) => { bag.playerJump = v; mark(); }));
  tasks.push(sheet("grunt", 4).then((v) => { bag.grunt = v; mark(); }));
  tasks.push(sheet("heli", 4).then((v) => { bag.heli = v; mark(); }));
  tasks.push(sheet("tank", 4).then((v) => { bag.tank = v; mark(); }));
  tasks.push(sheet("boss", 9).then((v) => { bag.boss = v; mark(); }));
  tasks.push(sheet("bullet", 4).then((v) => { bag.bullet = v; mark(); }));
  tasks.push(sheet("explode", 4).then((v) => { bag.explode = v; mark(); }));
  tasks.push(load("/game/sprites/pickup.png").then((v) => { bag.pickup = v; mark(); }));
  tasks.push(load("/game/sprites/palm.png").then((v) => { bag.palm = v; mark(); }));
  tasks.push(load("/game/sprites/sandbags.png").then((v) => { bag.sandbags = v; mark(); }));
  tasks.push(load("/game/sprites/hut.png").then((v) => { bag.hut = v; mark(); }));
  tasks.push(load("/game/map/sky.jpg").then((v) => { bag.sky = v; mark(); }));
  tasks.push(load("/game/map/far.jpg").then((v) => { bag.far = v; mark(); }));
  tasks.push(load("/game/map/mid.jpg").then((v) => { bag.mid = v; mark(); }));
  tasks.push(load("/game/map/near.png").then((v) => { bag.near = v; mark(); }));
  tasks.push(load("/game/map/ground.png").then((v) => { bag.ground = v; mark(); }));

  await Promise.all(tasks);
  onProgress(1);
  return bag as Art;
}
