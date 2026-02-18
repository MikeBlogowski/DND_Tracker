# ⚔ D&D 5e Combat Tracker

A mobile-friendly D&D 5e combat and initiative tracker. Built with React + Vite.

---

## Features

- **Persistent storage** — NPC library and custom conditions auto-save to the device (localStorage), surviving page refreshes and app restarts
- **Import NPCs** from `.json` or `.monster` files — supports multiple stat block formats including `hp.average`, `hp.value`, flat numbers, and the app's own export format
- **Export / Import** your full NPC library and conditions list as `.json` files — back them up or move them between devices
- Initiative tracker — auto-sorts by roll, highest first
- HP tracking with visual HP bars
- Conditions tracker per combatant (staged, applied on turn confirm)
- Targeted damage/heal panel — deal damage to multiple targets at once
- Environment / Lair Action turns at custom initiative
- Pre-built NPC library (20 monsters included, fully customisable)
- Auto-numbering for duplicate NPCs (Goblin 1, Goblin 2…)
- Add combatants mid-combat with correct turn-order handling
- Round counter, Prev/Next navigation (Prev never undoes HP changes)
- Player (PC) vs NPC/DM character tagging
- Fully mobile-optimised — large tap targets, number pad inputs, installable as a home screen app

---

## Deploying (no coding experience needed)

### Step 1 — Put the code on GitHub

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click the **+** button (top right) → **New repository**
3. Name it `dnd-combat-tracker`, leave everything else as default, click **Create repository**
4. On the next page, click **uploading an existing file**
5. Drag and drop **all the files and folders** from this zip into the upload area
   - Make sure the folder structure is preserved: `src/`, `public/`, and the root files
6. Click **Commit changes**

### Step 2 — Deploy to Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **Add New → Project**
3. Find your `dnd-combat-tracker` repository and click **Import**
4. Leave all settings as default — Vercel auto-detects Vite
5. Click **Deploy**
6. After ~1 minute you'll get a live URL like `dnd-combat-tracker.vercel.app`

### Step 3 — Install on your iPhone (optional)

1. Open your Vercel URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow pointing up)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app will appear on your home screen with a sword icon and launch full-screen, like a native app.

