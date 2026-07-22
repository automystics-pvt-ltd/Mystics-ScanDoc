---
name: DocScan Design System
description: Color palette, fonts, and visual language established in the ERP-style redesign
---

# DocScan Design System

## Palette
- Sidebar: very dark navy `hsl(215 50% 10%)`
- Primary / orange accent: `hsl(25 95% 53%)` — warm orange (NOT indigo, NOT purple)
- Content bg: `hsl(216 20% 97%)` (very light gray)
- Cards: pure white with 1px border

## Typography
- UI font: Inter (Google Fonts CDN)
- Data strings (IDs, IPs, message IDs, timestamps): JetBrains Mono

## Layout
- Left sidebar: dark navy, section labels (CORE / WORKSPACE / ADMINISTRATION), orange active strip
- Top bar: breadcrumb left, global search center, role badge + bell + avatar right
- Auth: split 50/50 — dark brand panel left, white form right

**Why:** User requested Mystics ERP reference design (dark navy + orange ERP-style). All future feature work should match this palette.

**How to apply:** All CSS variables are in `artifacts/docscan/src/index.css`. Do not reintroduce indigo/purple. Orange = `hsl(25 95% 53%)`.
