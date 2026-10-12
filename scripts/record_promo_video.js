import puppeteer from 'puppeteer';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const FFMPEG_PATH = '/usr/lib/jellyfin-ffmpeg/ffmpeg';
const RAW_OUTPUT_FILE = path.resolve('records/raw_gameplay.mp4');
const FINAL_OUTPUT_FILE = path.resolve('records/eldoria_promo_edited.mp4');
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_SECONDS = 18;

async function record() {
  console.log(`[Recorder] Step 1: Capturing clean gameplay footage (${DURATION_SECONDS}s, ${FPS}fps)...`);

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
    '-crf', '18',
    RAW_OUTPUT_FILE
  ]);

  ffmpeg.stderr.on('data', () => {});

  const totalFrames = FPS * DURATION_SECONDS;
  const frameIntervalMs = 1000 / FPS;

  console.log('[Recorder] Capturing frames and navigating menus...');

  for (let i = 0; i < totalFrames; i++) {
    const start = Date.now();

    const buffer = await page.screenshot({ type: 'png' });
    ffmpeg.stdin.write(buffer);

    // Frame 25 (0.8s): Click Mining in right skill bar
    if (i === 25) {
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

    // Frame 55 (1.8s): Select "10" quantity pill for Mining
    if (i === 55) {
      await page.evaluate(() => {
        const pill10 = document.querySelector('.qty-pill[data-qty="10"]');
        if (pill10) pill10.click();
      });
    }

    // Frame 85 (2.8s): Click "Start" on Mining Pyrite
    if (i === 85) {
      await page.evaluate(() => {
        const startBtn = document.getElementById('btn-job-start');
        if (startBtn) startBtn.click();
      });
    }

    // Frame 140 (4.6s): Click Woodcutting in skill list
    if (i === 140) {
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

    // Frame 170 (5.6s): Select "10" quantity pill for Woodcutting
    if (i === 170) {
      await page.evaluate(() => {
        const pill10 = document.querySelector('.qty-pill[data-qty="10"]');
        if (pill10) pill10.click();
      });
    }

    // Frame 200 (6.6s): Click "Queue" to enqueue Woodcutting
    if (i === 200) {
      await page.evaluate(() => {
        const queueBtn = document.getElementById('btn-job-enqueue');
        if (queueBtn) queueBtn.click();
      });
    }

    // Frame 250 (8.3s): Close skill popup and open right-hand Inventory drawer
    if (i === 250) {
      await page.evaluate(() => {
        const closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.click();
        const invTool = document.querySelector('.tool-btn[data-panel="inventory"]');
        if (invTool) invTool.click();
      });
    }

    // Frame 330 (11s): Open the Marketplace/Storage Vault
    if (i === 330) {
      await page.evaluate(() => {
        const vaultBtn = document.getElementById('btn-drawer-open-hearth');
        if (vaultBtn) vaultBtn.click();
      });
    }

    // Frame 390 (13s): Switch to Marketplace tab inside Vault
    if (i === 390) {
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

  console.log(`[Recorder] Raw gameplay captured to ${RAW_OUTPUT_FILE}`);
}

function applyStylizedTextOverlays() {
  console.log('[Recorder] Step 2: Adding stylized TikTok / Shorts descriptive text badges...');

  // Timed banner overlay filters
  // 0s - 4.5s: "⛏️ Train your skills • Mining & Gathering"
  // 4.5s - 9.0s: "⚡ Queue up tasks • Automated grinding"
  // 9.0s - 13.0s: "🎒 Satchel inventory • Manage your loot"
  // 13.0s - 18.0s: "🪙 Live Player Market • Trade with anyone"
  const fontFile = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

  const filterString = [
    // 1. Hook Banner Header (always present at top)
    `drawtext=fontfile='${fontFile}':text='ELDORIA IDLE':fontcolor=#ffd700:fontsize=52:box=1:boxcolor=black@0.75:boxborderw=24:x=(w-text_w)/2:y=120`,
    `drawtext=fontfile='${fontFile}':text='Play Free in Browser':fontcolor=#cbd5e0:fontsize=32:box=1:boxcolor=black@0.65:boxborderw=14:x=(w-text_w)/2:y=200`,

    // 2. Scene 1 (0s - 4.5s): Train your skills
    `drawtext=fontfile='${fontFile}':text='1. Train Your Skills (Mining)':fontcolor=#ffffff:fontsize=46:box=1:boxcolor=black@0.85:boxborderw=20:x=(w-text_w)/2:y=300:enable='between(t,0,4.5)'`,
    `drawtext=fontfile='${fontFile}':text='Pick an ore node & batch your craft':fontcolor=#38bdf8:fontsize=32:box=1:boxcolor=black@0.75:boxborderw=12:x=(w-text_w)/2:y=375:enable='between(t,0,4.5)'`,

    // 3. Scene 2 (4.5s - 9.0s): Queue your tasks
    `drawtext=fontfile='${fontFile}':text='2. Queue Multiple Tasks':fontcolor=#ffffff:fontsize=46:box=1:boxcolor=black@0.85:boxborderw=20:x=(w-text_w)/2:y=300:enable='between(t,4.5,9.0)'`,
    `drawtext=fontfile='${fontFile}':text='Woodcutting auto-starts when Mining finishes!':fontcolor=#4ade80:fontsize=32:box=1:boxcolor=black@0.75:boxborderw=12:x=(w-text_w)/2:y=375:enable='between(t,4.5,9.0)'`,

    // 4. Scene 3 (9.0s - 13.0s): Inventory Satchel
    `drawtext=fontfile='${fontFile}':text='3. Collect & Store Your Spoils':fontcolor=#ffffff:fontsize=46:box=1:boxcolor=black@0.85:boxborderw=20:x=(w-text_w)/2:y=300:enable='between(t,9.0,13.0)'`,
    `drawtext=fontfile='${fontFile}':text='28-slot satchel with unlimited bank storage':fontcolor=#facc15:fontsize=32:box=1:boxcolor=black@0.75:boxborderw=12:x=(w-text_w)/2:y=375:enable='between(t,9.0,13.0)'`,

    // 5. Scene 4 (13.0s - 18.0s): Player Economy
    `drawtext=fontfile='${fontFile}':text='4. Live Player Marketplace':fontcolor=#ffffff:fontsize=46:box=1:boxcolor=black@0.85:boxborderw=20:x=(w-text_w)/2:y=300:enable='between(t,13.0,18.0)'`,
    `drawtext=fontfile='${fontFile}':text='Buy & sell ores, gear, and supplies with players':fontcolor=#fb923c:fontsize=32:box=1:boxcolor=black@0.75:boxborderw=12:x=(w-text_w)/2:y=375:enable='between(t,13.0,18.0)'`,

    // 6. Bottom Call to Action Footer
    `drawtext=fontfile='${fontFile}':text='eldoriaidle.site':fontcolor=#facc15:fontsize=42:box=1:boxcolor=black@0.85:boxborderw=22:x=(w-text_w)/2:y=h-160`
  ].join(',');

  const cmd = [
    FFMPEG_PATH,
    '-y',
    '-i', RAW_OUTPUT_FILE,
    '-vf', `"${filterString}"`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '19',
    '-preset', 'fast',
    FINAL_OUTPUT_FILE
  ].join(' ');

  console.log('[Recorder] Running FFmpeg filter pipeline...');
  execSync(cmd, { stdio: 'inherit' });
  console.log(`[Recorder] Success! Polished promotional video created at: ${FINAL_OUTPUT_FILE}`);
}

async function run() {
  await record();
  applyStylizedTextOverlays();
}

run().catch(err => {
  console.error('[Recorder Error]', err);
  process.exit(1);
});
