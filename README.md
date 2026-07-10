# Trading Journal

A beginner-friendly trading log for Indian markets. Log trades on the go,
separate demo vs live activity, get exact brokerage + slippage math, and
review structured findings to build emotional control. Syncs to Firestore
when you're signed in; runs fully offline in guest mode via `localStorage`.

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS 4
- Firebase (Auth + Firestore)
- Recharts, Framer Motion, lucide-react
- `@google/genai` for the optional AI Coach

## Run locally

**Prerequisites:** Node.js 20+ and npm.

1. Install dependencies:
   ```sh
   npm install
   ```
2. Create your local env file:
   ```sh
   cp .env.example .env.local
   ```
   Then fill in the `VITE_FIREBASE_*` values from your Firebase project
   (Console -> Project settings -> Your apps -> Web app).
3. Start the dev server:
   ```sh
   npm run dev
   ```
   The app runs on http://localhost:3000.

## Type-check

```sh
npm run lint    # runs tsc --noEmit
```

## AI Coach (optional)

The AI Coach uses **bring-your-own-key**: open Settings inside the app and
paste your Gemini API key. It's stored in your browser's `localStorage`
and used client-side only.

Get a key at https://aistudio.google.com/apikey.

## Firebase project note

This repo is wired to the Firebase project `trading-book-36d99` (see
[`firebase-applet-config.json`](firebase-applet-config.json) and `.env.local`).
It was migrated on 2026-07-10 from the original AI Studio auto-provisioned
project (`zinc-ego-977bw`), which was shared across AI Studio template users.

To point the app at a different Firebase project, update the `VITE_FIREBASE_*`
values in `.env.local`, mirror them in `firebase-applet-config.json`, and
deploy [`firestore.rules`](firestore.rules) to that project.
