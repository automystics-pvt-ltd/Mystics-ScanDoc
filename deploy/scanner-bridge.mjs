#!/usr/bin/env node
/**
 * DocScan Windows Bridge v1.0
 *
 * Runs on the Windows PC where the HP scanner saves files.
 * Every new file that appears in WATCH_FOLDER is automatically POSTed
 * to the DocScan server — no browser, no manual upload needed.
 *
 * Requirements : Node.js 18 or newer (https://nodejs.org)
 * Usage        : node scanner-bridge.mjs
 * Run on boot  : Add to Task Scheduler or run as a Windows Service via NSSM
 */

// ── CONFIGURATION — filled in automatically when downloaded from Settings ─────
const WATCH_FOLDER = "C:\\Users\\dsiva\\Downloads\\Step 2";
const SERVER_URL   = "https://docscan.automystics.tech";
const SCANNER_KEY  = "YOUR_SCANNER_API_KEY";
// ─────────────────────────────────────────────────────────────────────────────

import fs   from "fs";
import path from "path";

const ENDPOINT  = `${SERVER_URL}/api/scanner/receive`;
const SCAN_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]);
const POLL_MS   = 5_000;   // poll every 5 seconds
const SETTLE_MS = 2_500;   // wait for file to finish writing before sending

const seen = new Set();
let sendQueue = Promise.resolve();

// ── helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── send one file ─────────────────────────────────────────────────────────────

async function sendFile(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!SCAN_EXTS.has(ext)) return; // ignore .tmp, .db, etc.

  log(`New file detected: ${fileName} — waiting for write to complete…`);
  await sleep(SETTLE_MS);

  // Check file is still there and non-empty
  let stat;
  try { stat = fs.statSync(filePath); } catch { log(`  Skipped (file gone): ${fileName}`); return; }
  if (stat.size === 0)                 { log(`  Skipped (empty): ${fileName}`); return; }

  log(`Sending ${fileName} (${(stat.size / 1024).toFixed(1)} KB) → ${SERVER_URL} …`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob       = new Blob([fileBuffer]);
    const form       = new FormData();
    form.append("file", blob, fileName);

    const res = await fetch(ENDPOINT, {
      method:  "POST",
      headers: { "x-scanner-key": SCANNER_KEY },
      body:    form,
    });

    const body = await res.text();
    if (res.ok) {
      let docId = "?";
      try { docId = JSON.parse(body).docId; } catch {}
      log(`✓ Sent: ${fileName} → Doc #${docId}`);
    } else if (res.status === 401) {
      log(`✗ Auth failed — check SCANNER_KEY in this script matches Admin → Settings → Scanner`);
    } else {
      log(`✗ Server error ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    log(`✗ Network error sending ${fileName}: ${err.message}`);
    log(`  Is the server reachable? URL: ${ENDPOINT}`);
  }
}

// ── polling loop ──────────────────────────────────────────────────────────────

function poll() {
  let entries;
  try {
    entries = fs.readdirSync(WATCH_FOLDER);
  } catch (err) {
    log(`Cannot read watch folder: ${err.message}`);
    return;
  }

  for (const fileName of entries) {
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const filePath = path.join(WATCH_FOLDER, fileName);
    // Chain sends so multiple files don't race each other
    sendQueue = sendQueue.then(() => sendFile(filePath, fileName)).catch(console.error);
  }
}

// ── startup ───────────────────────────────────────────────────────────────────

function start() {
  // Verify folder exists
  if (!fs.existsSync(WATCH_FOLDER)) {
    console.error(`\nERROR: Watch folder not found:\n  ${WATCH_FOLDER}\n`);
    console.error(`Create the folder or update WATCH_FOLDER in this script, then restart.\n`);
    process.exit(1);
  }

  // Pre-seed "seen" with files already in the folder so we don't re-send old scans
  try {
    for (const f of fs.readdirSync(WATCH_FOLDER)) seen.add(f);
  } catch {}

  console.log(`\n┌─────────────────────────────────────────┐`);
  console.log(`│        DocScan Windows Bridge v1.0      │`);
  console.log(`└─────────────────────────────────────────┘`);
  console.log(`  Watch folder : ${WATCH_FOLDER}`);
  console.log(`  Server       : ${SERVER_URL}`);
  console.log(`  Poll interval: ${POLL_MS / 1000}s`);
  console.log(`  Pre-loaded   : ${seen.size} existing file(s) (will not be re-sent)`);
  console.log(`  Waiting for new scans…\n`);

  setInterval(poll, POLL_MS);
}

start();
