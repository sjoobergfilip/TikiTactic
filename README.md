# TikiTactic

A football tactics workspace built with Svelte 5, TypeScript, and Vite. It supports draggable players and ball movement, custom player names and colours, a five-corridor overlay, tactical annotations, phase-based slide decks, smooth deck transitions and autoplay, a collapsible inspector, undo/redo, PNG/JSON export, and installable PWA behavior.

## Run

```sh
npm install
npm run dev
```

## Verify and build

```sh
npm run check
npm run build
npm run preview
```

## Structure

- `src/components/` — pitch, slide rail, toolbar, inspector, and header components
- `src/lib/stores/tactics.ts` — immutable session updates, history, selection, and local persistence
- `src/lib/types.ts` — shared domain model
- `src/lib/data.ts` — example training plan and phase factory
- `src/lib/utils/board.ts` — pitch geometry and export helpers

Session data autosaves to this browser's `localStorage`. It does not sync between devices; use JSON export for a portable backup.

## Desktop migration

See `TAURI_BUILD_PLAN.md` for the agent-ready Tauri 2 desktop architecture, state boundaries, repository adapters, local persistence, caching strategy, implementation phases, and acceptance checks.

## Assets and licenses

The pitch, thumbnails, and app icons are generated specifically for this project. Interface icons use Lucide (ISC). Inter and Fira Code are bundled through Fontsource (SIL Open Font License).
