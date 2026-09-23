# Contributing to StatRace

Thanks for helping. Small, focused pull requests are the easiest to review.

## Setup

```bash
npm install
npm run dev          # API on :8790 + Vite on :5190
npm run typecheck    # must pass
npm run build        # must pass
```

Node 24 or newer is required: the server runs TypeScript directly via Node's type stripping.

## Ground rules

- **Frames are pure functions of time.** `Renderer.draw(ctx, t)` keeps no state between frames. Anything
  that depends on history (smoothed ranks, overtakes, leader changes, card timing) is precomputed in
  `buildModel`. Randomness only through the seeded `mulberry32`. This keeps preview and export identical.
- **Server code uses erasable TypeScript only.** No enums or parameter properties, and imports carry the
  `.ts` extension. `tsconfig.json` enforces this.
- **Keys never touch a server we run.** BYOK calls go from the browser straight to the provider.
- **All UI text goes through `useT()`** in `src/lib/i18n.ts`, with an English and a German entry.
- **The dataset schema is a contract.** `shared/dataset.ts` is both Claude's structured-output schema and
  the validation for imported JSON. Change it deliberately, and keep `normalizeDataset` forgiving.
- **Synth performance:** no per-note filter automation (Chrome then computes filter coefficients per
  sample), and schedule notes window by window (see `renderComposition`).

## Testing a change

Run the app, open an example, scrub through the video and export an MP4. For visual changes, attach a
screenshot to the pull request.
