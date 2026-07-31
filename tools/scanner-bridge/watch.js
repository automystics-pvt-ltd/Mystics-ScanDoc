#!/usr/bin/env node
/**
 * DocScan Scanner Bridge
 * ──────────────────────
 * Watches a local folder for new scanned files and forwards them to
 * the DocScan API so they appear on the user's screen instantly.
 *
 * Usage:
 *   node watch.js
 *
 * Configuration (edit the SETTINGS block below, or use environment variables):
 *   DOCSCAN_URL       Base URL of your DocScan server
 *   DOCSCAN_KEY       Scanner API key (from Admin → Settings → Scanner)
 *   WATCH_FOLDER      Folder to watch (your HP scanner output folder)
 *   POLL_INTERVAL_MS  How often to check for new files (default 2000 ms)
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// ── SETTINGS ──────────────────────────────────────────────────────────────────
const DOCSCAN_URL      = process.env.DOCSCAN_URL      || "https://docscan.automystics.tech";
const DOCSCAN_KEY      = process.env.DOCSCAN_KEY      || "PASTE_YOUR_SCANNER_API_KEY_HERE";
const WATCH_FOLDER     = process.env.WATCH_FOLDER     || path.join(require("os").homedir(), "Documents", "HP Scans");
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;
const SENT_LOG         = path.join(__dirname, ".sent-files.json");
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]);

// Persist the set of already-sent files across restarts
function loadSent() {
  try { return new Set(JSON.parse(fs.readFileSync(SENT_LOG, "utf8"))); }
  catch { return new Set(); }
}
function saveSent(set) {
  fs.writeFileSync(SENT_LOG, JSON.stringify([...set]), "utf8");
}

// ── Multipart POST helper (no external dependencies) ─────────────────────────
function postFile(filePath) {
  return new Promise((resolve, reject) => {
    const fileData   = fs.readFileSync(filePath);
    const fileName   = path.basename(filePath);
    const boundary   = `----DocScanBridge${Date.now()}`;
    const ext        = path.extname(fileName).toLowerCase();
    const mimeMap    = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".tif": "image/tiff", ".tiff": "image/tiff",
    };
    const mime = mimeMap[ext] || "application/octet-stream";

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body   = Buffer.concat([header, fileData, footer]);

    const url    = new URL("/api/scanner/receive", DOCSCAN_URL);
    const lib    = url.protocol === "https:" ? https : http;

    const req = lib.request(url, {
      method: "POST",
      headers: {
        "Content-Type":  `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
        "X-Scanner-Key":  DOCSCAN_KEY,
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main polling loop ─────────────────────────────────────────────────────────
async function poll(sent) {
  if (!fs.existsSync(WATCH_FOLDER)) {
    console.warn(`⚠  Watch folder not found: ${WATCH_FOLDER}`);
    return;
  }

  let files;
  try { files = fs.readdirSync(WATCH_FOLDER); }
  catch (e) { console.error("Cannot read watch folder:", e.message); return; }

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;

    const full = path.join(WATCH_FOLDER, name);
    if (sent.has(full)) continue;

    // Wait briefly — scanner may still be writing the file
    await new Promise(r => setTimeout(r, 1000));

    try {
      const stat = fs.statSync(full);
      if (stat.size === 0) continue; // not ready yet

      console.log(`📄  New scan detected: ${name}`);
      const result = await postFile(full);
      console.log(`✅  Sent to DocScan → Doc #${result.docId} (${name})`);
      sent.add(full);
      saveSent(sent);
    } catch (err) {
      console.error(`❌  Failed to send ${name}:`, err.message);
    }
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════╗");
console.log("║      DocScan Scanner Bridge              ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`  Server  : ${DOCSCAN_URL}`);
console.log(`  Watching: ${WATCH_FOLDER}`);
console.log(`  Interval: ${POLL_INTERVAL_MS} ms`);
console.log("");

if (DOCSCAN_KEY === "PASTE_YOUR_SCANNER_API_KEY_HERE") {
  console.error("⛔  Set your scanner API key first!");
  console.error("    Edit DOCSCAN_KEY in watch.js, or run:");
  console.error("    set DOCSCAN_KEY=dsk_xxxx && node watch.js");
  process.exit(1);
}

if (!fs.existsSync(WATCH_FOLDER)) {
  console.warn(`⚠  Folder does not exist yet, it will be created: ${WATCH_FOLDER}`);
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });
}

console.log("🟢  Watching for new scans… (Ctrl+C to stop)\n");
const sent = loadSent();
setInterval(() => poll(sent), POLL_INTERVAL_MS);
poll(sent); // run immediately on start
