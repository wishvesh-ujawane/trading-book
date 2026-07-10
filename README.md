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

This repo currently ships with a Firebase project (`zinc-ego-977bw`) that was
auto-provisioned by Google AI Studio when the app was scaffolded. That project
may be shared with other AI Studio users of the same template. For a real
deployment with real users' data, create your own Firebase project, update
`.env.local`, and redeploy [`firestore.rules`](firestore.rules).
