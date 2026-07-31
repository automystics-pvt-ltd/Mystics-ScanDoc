# DocScan Scanner Bridge

Connects your **HP LaserJet Pro MFP M128fn** (or any scanner that saves to a folder) to DocScan. When you press **Scan** on the printer, the document appears on the DocScan user screen within seconds — ready to dispatch to recipients.

## How it works

```
HP M128fn → saves PDF to folder → watch.js detects it → POSTs to DocScan API → appears on user screen
```

## Setup (one time)

### Step 1 — Get your Scanner API Key
1. Log in to DocScan as admin
2. Go to **Settings → Scanner** section
3. Copy the **Scanner API Key** (starts with `dsk_`)

### Step 2 — Configure HP M128fn to scan to a folder
1. On the printer touchscreen: **Scan → Scan to Network Folder** (or **Scan to Computer**)
2. Point it to a folder on your PC, e.g.:
   - `C:\Users\YourName\Documents\HP Scans`
3. Set output format to **PDF** or **JPEG**

   > **If using USB connection**: Install HP Scan software → in HP Scan, set "Save location" to `C:\Users\YourName\Documents\HP Scans` and enable "Save automatically".

### Step 3 — Install Node.js
Download from https://nodejs.org (LTS version). No other packages needed.

### Step 4 — Configure the bridge
Open `watch.js` and edit the SETTINGS block at the top:
```js
const DOCSCAN_URL  = "https://docscan.automystics.tech";
const DOCSCAN_KEY  = "dsk_your_key_here";   // ← paste your key
const WATCH_FOLDER = "C:\\Users\\YourName\\Documents\\HP Scans"; // ← your scan folder
```

### Step 5 — Run the bridge
Open **Command Prompt** in this folder and run:
```cmd
node watch.js
```

You'll see:
```
╔══════════════════════════════════════════╗
║      DocScan Scanner Bridge              ║
╚══════════════════════════════════════════╝
  Server  : https://docscan.automystics.tech
  Watching: C:\Users\YourName\Documents\HP Scans
  Interval: 2000 ms

🟢  Watching for new scans… (Ctrl+C to stop)
```

## Daily workflow

1. Keep the **Command Prompt window open** (or run as a startup task — see below)
2. Place document in the printer and press **Scan**
3. Open DocScan → **Scan & Dispatch** → **Physical Scanner** tab
4. The scanned document appears automatically
5. Click **Dispatch Document** → sent to all recipients ✅

## Run automatically on Windows startup (optional)

1. Press `Win + R` → type `shell:startup` → press Enter
2. Create a shortcut to `run-bridge.bat` in that folder

Create `run-bridge.bat` in this folder:
```bat
@echo off
cd /d %~dp0
node watch.js
pause
```

## Supported formats
PDF, JPG, PNG, TIFF

## Troubleshooting

| Problem | Fix |
|---|---|
| `Set your scanner API key first!` | Paste your `dsk_` key into `watch.js` |
| `Watch folder not found` | Check the folder path in `watch.js` matches where HP saves scans |
| Document sent but doesn't appear on screen | Make sure you're on the **Physical Scanner** tab in DocScan |
| `HTTP 401` error | API key is wrong — regenerate in Admin → Settings → Scanner |
