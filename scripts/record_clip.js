import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';

const FFMPEG_PATH = '/usr/lib/jellyfin-ffmpeg/ffmpeg';
const OUTPUT_FILE = path.resolve('records/eldoria_promo_clip.mp4');
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_SECONDS = 18;

async function run() {
  console.log(`[Recorder] Launching interactive gameplay recording (${DURATION_SECONDS}s, ${FPS}fps)...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${WIDTH},${HEIGHT}`
    ],
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1
    }
  });

  const page = await browser.newPage();

  console.log('[Recorder] Navigating to https://eldoriaidle.site...');
  await page.goto('https://eldoriaidle.site', { waitUntil: 'networkidle2' });

  await page.waitForSelector('#btn-play-guest', { timeout: 10000 });
  await page.click('#btn-play-guest');

  await page.waitForFunction(() => {
    const authModal = document.getElementById('auth-modal');
    return authModal && authModal.classList.contains('hidden');
  }, { timeout: 10000 });

  console.log('[Recorder] Logged in! Waiting 2s...');
  await new Promise(r => setTimeout(r, 2000));

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '19',
    OUTPUT_FILE
  ]);

  ffmpeg.stderr.on('data', () => {});

  const totalFrames = FPS * DURATION_SECONDS;
  const frameIntervalMs = 1000 / FPS;

  console.log('[Recorder] Starting frame capture and menu automation...');

  for (let i = 0; i < totalFrames; i++) {
    const start = Date.now();

    const buffer = await page.screenshot({ type: 'png' });
    ffmpeg.stdin.write(buffer);

    // Frame 30 (1s): Click Mining in right skill bar
    if (i === 30) {
      await page.evaluate(() => {
        const cards = document.querySelectorAll('.skill-card-compact');
        for (const c of cards) {
          if (c.textContent && c.textContent.includes('Mining')) {
            c.click();
            break;
          }
        }
      });
    }

    // Frame 60 (2s): Select "10" quantity pill for Mining
    if (i === 60) {
      await page.evaluate(() => {
        const pill10 = document.querySelector('.qty-pill[data-qty="10"]');
        if (pill10) pill10.click();
      });
    }

    // Frame 90 (3s): Click "Start" on Mining Pyrite
    if (i === 90) {
      await page.evaluate(() => {
        const startBtn = document.getElementById('btn-job-start');
        if (startBtn) startBtn.click();
      });
    }

    // Frame 150 (5s): Click Woodcutting in skill list
    if (i === 150) {
      await page.evaluate(() => {
        const cards = document.querySelectorAll('.skill-card-compact');
        for (const c of cards) {
          if (c.textContent && c.textContent.includes('Woodcutting')) {
            c.click();
            break;
          }
        }
      });
    }

    // Frame 180 (6s): Select "10" quantity pill for Woodcutting
    if (i === 180) {
      await page.evaluate(() => {
        const pill10 = document.querySelector('.qty-pill[data-qty="10"]');
        if (pill10) pill10.click();
      });
    }

    // Frame 210 (7s): Click "Queue" to queue Woodcutting right after Mining!
    if (i === 210) {
      await page.evaluate(() => {
        const queueBtn = document.getElementById('btn-job-enqueue');
        if (queueBtn) queueBtn.click();
      });
    }

    // Frame 260 (8.6s): Close skill popup and open right-hand Inventory drawer
    if (i === 260) {
      await page.evaluate(() => {
        const closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.click();
        const invTool = document.querySelector('.tool-btn[data-panel="inventory"]');
        if (invTool) invTool.click();
      });
    }

    // Frame 340 (11.3s): Open the Marketplace/Storage Vault
    if (i === 340) {
      await page.evaluate(() => {
        const vaultBtn = document.getElementById('btn-drawer-open-hearth');
        if (vaultBtn) vaultBtn.click();
      });
    }

    // Frame 400 (13.3s): Switch to Marketplace tab inside Vault
    if (i === 400) {
      await page.evaluate(() => {
        const mktTab = document.getElementById('dv-tab-market');
        if (mktTab) mktTab.click();
      });
    }

    const elapsed = Date.now() - start;
    const wait = Math.max(0, frameIntervalMs - elapsed);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }

    if ((i + 1) % (FPS * 3) === 0) {
      console.log(`[Recorder] Recorded ${(i + 1) / FPS}s / ${DURATION_SECONDS}s`);
    }
  }

  ffmpeg.stdin.end();
  await new Promise(resolve => ffmpeg.on('close', resolve));
  await browser.close();

  console.log(`[Recorder] Done! Saved showcase clip: ${OUTPUT_FILE}`);
}

run().catch(err => {
  console.error('[Recorder Error]', err);
  process.exit(1);
});
