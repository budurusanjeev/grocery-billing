# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A grocery shopkeeper billing tool for a Telangana kirana shop. Customers hand over grocery lists handwritten on paper (English/Telugu/Urdu), or the shopkeeper speaks items aloud — either way the app builds a bill with a live total. One Expo (React Native + TypeScript, SDK 57, expo-router) codebase targets both Android and web via react-native-web.

## Commands

```
npm install               # after fresh clone
npx expo start            # dev server; scan QR with Expo Go on Android, press w for web
npx expo start --web      # web only
npx expo export -p web    # static web build into dist/
npx expo run:android      # local Android dev build (needed for voice — see below)
npx tsc --noEmit          # typecheck
npm test                  # Jest — pure-logic unit tests only (billMath, bill numbering, voice parser)

cd server && npm install  # once, for the scan backend
node server/index.js      # run the scan backend locally (port 5050; reads server/.env)
```

**Expo Go vs dev build:** everything EXCEPT voice runs in Expo Go and on web. `expo-speech-recognition` is a native module, so voice on Android requires a one-time dev build via `npx expo run:android` (full Android toolchain is installed on this machine). Voice on **web** works immediately in Chrome (Web Speech API). The voice screen catches the missing-native-module case and shows instructions instead of crashing.

**Sandboxed-shell gotcha (same as the sibling bus-app projects):** gradle-based commands (`expo run:android`) fail in Claude's sandboxed shell with `Unable to establish loopback connection` — the user runs those from their own terminal. `tsc` and `expo export -p web` work fine in the sandbox and are the verification tools of choice.

## Architecture

Routes live in `src/app/` (expo-router): `index` (billing), `catalog`, `scan`, `voice`. Everything else is in `src/lib`, `src/state`, `src/catalog`.

- **Bill state** (`src/state/bill.tsx`): React context; the in-progress bill only. Adding an item that's already on the bill increments its qty rather than duplicating the line. The actual subtotal/discount/total math lives in `src/lib/billMath.ts` as a plain function (`computeBillTotals`), pulled out specifically so it's unit-testable without rendering the provider — see `src/lib/__tests__/`.
- **Tests** (`src/lib/__tests__/`): Jest (`jest-expo` preset) covers pure logic only — bill math, bill-number formatting, the voice parser. No component/integration tests yet. `jest.setup.js` mocks AsyncStorage (via the library's own official mock) since `db.ts` touches it at import time and plain Jest has no native module to back it.
- **Storage** (`src/lib/db.ts`): AsyncStorage (not sqlite) — deliberate, so identical code runs on Android and web with zero config; the catalog is ~100 rows. On first run the catalog seeds from `src/catalog/seed.json`. All persistence goes through this file, so a future move to sqlite/Supabase touches only `db.ts`.
- **Seed catalog** (`src/catalog/seed.json`): ~100 Telangana groceries. Every item carries `name_te` (Telugu script) and `aliases` (Roman transliterations like "kandi pappu", "biyyam") — **these aliases are what make voice and scan matching work**; when adding items, always include the transliterations people actually say.
- **Matching** (`src/lib/matcher.ts`): fuse.js fuzzy search over name_en/name_te/aliases/brand. Used by the search box, the scan flow, and the voice flow — one matcher for all three.
- **Voice** (`src/app/voice.tsx` + `src/lib/voiceParser.ts`): platform speech recognizer (te-IN/en-IN/hi-IN). The parser splits transcripts on "and/mariyu/aur" + commas, extracts quantity words (Telugu/Hindi/English, script and transliteration — okati/rendu…, ek/do…, half/ara) and units (kg/packet/litre/dozen; grams auto-convert to kg), and the remainder becomes the fuzzy-match query. Unmatched phrases are surfaced in the UI, never silently dropped.
- **Scan** (`src/app/scan.tsx` + `src/lib/gemini.ts` + `server/index.js`): photo → **this repo's own tiny backend** (`server/` folder, plain-JS Express, one route `POST /api/v1/scan`) → Gemini `gemini-2.5-flash` server-side → JSON items → fuzzy-matched against catalog → **confirmation screen with checkboxes** (never auto-add; handwriting parsing WILL make mistakes). The Gemini key lives ONLY on the server (`GEMINI_API_KEY` env var — `server/.env` locally, Render env var in production) — never in this client. This proxy design exists because Google's newer service-account-bound Gemini keys cannot be website-restricted, so a key bundled into the public site would be stealable; do not move the key back into the client. Deliberately a separate service from the school-bus backend — the user wants the two products kept apart. The client finds the server via `EXPO_PUBLIC_SCAN_URL` (set on the Render static site; defaults to `http://localhost:5050/api/v1/scan` for local dev). On Render's free tier the server sleeps when idle — the first scan of the day can take ~1 minute (the loading text warns about this). Deployment: one repo, two Render services — the static site (root) and a Web Service with Root Directory `server`, build `npm install`, start `npm start`.
- **Web/native UI differences** (`src/lib/ui.ts`): react-native-web does not implement `Alert.alert` — all confirms/alerts must go through `confirmDialog`/`showMessage` here, which branch to `window.confirm`/`window.alert` on web. A raw `Alert.alert` silently no-ops on web.

## Product rules worth keeping

- Money is displayed via `formatMoney` (₹, drop trailing .00).
- Fractional quantities are real (half kg = 0.5) — qty math rounds to 3 decimals, totals to 2.
- Bill history keeps the most recent 200 bills on-device.
- WhatsApp sharing uses a plain `https://wa.me/?text=` URL — works on both platforms, no SDK.
