import { chromium } from "playwright";

const url = process.env.BASE_URL || "http://127.0.0.1:8080/";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("text=開始行動", { timeout: 20000 });
await page.screenshot({ path: "/workspace/screenshots/title.png" });
await page.click("text=開始行動");
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/play.png" });

const before = await page.evaluate(() => window.__controlsTest?.getX?.());
await page.evaluate(() => window.__controlsTest?.setKeys?.(["KeyA"]));
await page.waitForTimeout(500);
const afterA = await page.evaluate(() => ({
  x: window.__controlsTest?.getX?.(),
  vx: window.__controlsTest?.getVx?.(),
  facing: window.__controlsTest?.getFacing?.(),
}));
await page.evaluate(() => window.__controlsTest?.setKeys?.(["KeyD"]));
await page.waitForTimeout(500);
const afterD = await page.evaluate(() => ({
  x: window.__controlsTest?.getX?.(),
  vx: window.__controlsTest?.getVx?.(),
  facing: window.__controlsTest?.getFacing?.(),
}));
await page.evaluate(() => window.__controlsTest?.setKeys?.([]));
await page.keyboard.down("KeyJ");
await page.waitForTimeout(300);
await page.screenshot({ path: "/workspace/screenshots/shoot.png" });
await page.keyboard.up("KeyJ");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.waitForSelector("text=開始行動", { timeout: 20000 });
await mobile.screenshot({ path: "/workspace/screenshots/title-mobile.png" });

console.log(JSON.stringify({ errors, before, afterA, afterD }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
if (!(afterA.x < before - 20) || !(afterA.vx < 0) || afterA.facing !== -1) {
  console.error("A did not move left");
  process.exit(1);
}
if (!(afterD.x > afterA.x + 20) || !(afterD.vx > 0) || afterD.facing !== 1) {
  console.error("D did not move right");
  process.exit(1);
}
console.log("CONTROLS OK");
