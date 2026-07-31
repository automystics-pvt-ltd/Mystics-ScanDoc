#!/usr/bin/env node
/**
 * DocScan Windows Bridge  v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Watches a local folder on this Windows PC and automatically uploads every
 * new scan to your DocScan server. Requires Node.js 18 or later.
 *
 * SETUP
 *   1. Edit the CONFIG section below.
 *   2. Run once to test:   node scanner-bridge.mjs
 *   3. To auto-start on login, create a shortcut to this script and place it in:
 *      C:\Users\<you>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
 *
 * The script keeps a local file (.sent-files.json) so it never uploads the
 * same file twice, even after a restart.
 */

import fs   from "fs";
import path from "path";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_URL   = "https://docscan.automystics.tech"; // no trailing slash
const USERNAME  = "admin";                             // DocScan login email
const PASSWORD  = "";                                  // DocScan password
const WATCH_DIR = "C:\\Users\\dsiva\\Downloads\\Step 2";
const POLL_MS   = 3_000;                               // check every 3 seconds
// ─────────────────────────────────────────────────────────────────────────────

const SCAN_EXTS  = new Set([".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]);
const SENT_STORE = path.join(import.meta.dirname, ".sent-files.json");

// ── persistent sent-file tracking ────────────────────────────────────────────
function loadSent() {
  try { return new Set(JSON.parse(fs.readFileSync(SENT_STORE, "utf8"))); }
  catch { return new Set(); }
}
function saveSent(s) {
  fs.writeFileSync(SENT_STORE, JSON.stringify([...s].slice(-2000)));
}

// ── auth token (auto-refreshed) ───────────────────────────────────────────────
let token       = null;
let tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  const r = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: USERNAME, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`Login failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  token       = data.token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // re-login after 23 h
  return token;
}

// ── upload one file ───────────────────────────────────────────────────────────
async function uploadFile(filePath) {
  const tok  = await getToken();
  const name = path.basename(filePath);
  const blob = new Blob([fs.readFileSync(filePath)]);

  const form = new FormData();
  form.append("file", blob, name);

  const r = await fetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    headers: {
      Authorization:   `Bearer ${tok}`,
      "x-source":      "scanner",
      "x-source-path": filePath,
    },
    body: form,
  });
  if (!r.ok) throw new Error(`Upload failed: ${r.status} ${await r.text()}`);
  const doc = await r.json();
  console.log(`[${now()}] ✅ Uploaded: ${name} → doc #${doc.id}`);
}

// ── poll loop ─────────────────────────────────────────────────────────────────
const sentFiles = loadSent();

async function poll() {
  if (!fs.existsSync(WATCH_DIR)) {
    console.warn(`[${now()}] ⚠  Watch folder not found: ${WATCH_DIR}`);
    return;
  }

  let entries;
  try { entries = fs.readdirSync(WATCH_DIR); }
  catch (e) { console.error(`[${now()}] ❌ Cannot read folder:`, e.message); return; }

  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!SCAN_EXTS.has(ext)) continue;

    const key      = `${name}::${WATCH_DIR}`;
    const filePath = path.join(WATCH_DIR, name);
    if (sentFiles.has(key)) continue;

    // Wait for file to finish writing
    let size1, size2;
    try {
      size1 = fs.statSync(filePath).size;
      await sleep(1500);
      size2 = fs.statSync(filePath).size;
    } catch { continue; }

    if (size1 !== size2 || size1 === 0) continue; // still writing

    console.log(`[${now()}] 📄 New scan detected: ${name}`);
    try {
      await uploadFile(filePath);
      sentFiles.add(key);
      saveSent(sentFiles);
    } catch (e) {
      console.error(`[${now()}] ❌ Upload error:`, e.message);
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function now()     { return new Date().toLocaleTimeString(); }

// ── startup ───────────────────────────────────────────────────────────────────
console.log("DocScan Windows Bridge started");
console.log(`  Server   : ${API_URL}`);
console.log(`  Folder   : ${WATCH_DIR}`);
console.log(`  Interval : ${POLL_MS / 1000}s`);
console.log("─────────────────────────────────────────");

// Verify config before first poll
if (!PASSWORD) {
  console.error("❌ Set PASSWORD in the CONFIG section at the top of this file.");
  process.exit(1);
}

poll().catch(console.error); // immediate first poll
setInterval(() => poll().catch(console.error), POLL_MS);
