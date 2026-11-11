# TikiTactic: Tauri Desktop Architecture and Build Plan

## Purpose

This document is an implementation brief for the coding agent that will convert the existing Svelte tactics board into an offline-first desktop application.

The current application already provides the football board, draggable players and ball, tactical annotations, custom names and colours, five corridors, phase decks, smooth transitions, undo/redo, PNG/JSON export, and browser-local persistence. Preserve those features. The restored flat pitch is the canonical design; do not reintroduce the perspective-pitch experiment.

## Product constraints

- Use Tauri 2, Svelte 5, TypeScript, and Vite.
- Desktop-only product for now: Windows, macOS, and Linux.
- No accounts, login, cloud sync, subscription flow, or multi-user model.
- All project data stays on the local machine unless the user exports it.
- Keep the current Svelte components and domain model wherever practical.
- Use explicit application actions and immutable document updates.
- Cache read-heavy data, never stale writes.
- Browser development must remain available through a local repository adapter.

## Target architecture

```text
Svelte components
      |
      v
Application actions / controllers
      |
      +--> Session state + history + selection + UI state
      |
      v
SessionRepository interface
      |
      +--> TauriSessionRepository --invoke--> Rust commands
      |                                      |
      |                                      +--> Session service
      |                                      +--> Atomic JSON storage
      |                                      +--> Library and thumbnail caches
      |
      +--> BrowserSessionRepository (development fallback)
```

Important boundaries:

1. Components render state and call actions. They do not call `invoke` directly.
2. The repository interface hides Tauri and browser storage from the UI.
3. Rust owns filesystem access, path validation, atomic writes, backups, and persistent caches.
4. The session document remains a versioned serializable JSON object.
5. Svelte state updates are immutable so the board redraws reliably.

## Target project structure

```text
tikitactic/
├── src/
│   ├── components/
│   │   ├── TacticsBoard.svelte
│   │   ├── SlideRail.svelte
│   │   ├── MiniPitch.svelte
│   │   ├── Inspector.svelte
│   │   ├── Toolbar.svelte
│   │   ├── Header.svelte
│   │   └── ui/                         # shared primitives only when reused
│   ├── styles/
│   │   ├── tokens.css                  # colour, type, spacing, radius, motion
│   │   └── themes.css                  # theme values selected by data-theme
│   ├── lib/
│   │   ├── application/
│   │   │   ├── sessionActions.ts       # add/move/duplicate/delete/edit actions
│   │   │   ├── sessionController.ts    # coordinates state, persistence, history
│   │   │   └── exportActions.ts        # PNG and JSON export workflows
│   │   ├── domain/
│   │   │   ├── types.ts                # Session, Slide, Player, Annotation, Point
│   │   │   ├── factories.ts            # new sessions, slides, players
│   │   │   └── migrations.ts           # schema upgrades and validation
│   │   ├── persistence/
│   │   │   ├── sessionRepository.ts    # shared TypeScript interface and DTOs
│   │   │   ├── tauriRepository.ts      # invoke-only desktop adapter
│   │   │   └── browserRepository.ts    # localStorage development adapter
│   │   ├── stores/
│   │   │   ├── session.ts              # active document and revision
│   │   │   ├── selection.ts            # selected player/annotation/tool
│   │   │   ├── history.ts              # undo/redo snapshots
│   │   │   ├── library.ts              # session summaries and recent items
│   │   │   └── ui.ts                   # panels, zoom, presentation, save status
│   │   └── utils/
│   │       ├── board.ts                # flat pitch geometry and colour helpers
│   │       └── download.ts
│   ├── App.svelte
│   ├── main.ts
│   └── app.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                     # thin entry point
│   │   ├── lib.rs                      # plugin and command registration
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── sessions.rs             # list/load/save/delete/duplicate
│   │   │   ├── settings.rs
│   │   │   └── exports.rs
│   │   ├── models.rs                   # serde DTOs matching TypeScript types
│   │   ├── paths.rs                    # validated app-data/app-cache paths
│   │   ├── repository.rs               # JSON document I/O and atomic writes
│   │   ├── cache.rs                    # summary and thumbnail cache management
│   │   └── error.rs                    # serializable application errors
│   ├── capabilities/default.json
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/
│   ├── sessionActions.test.ts
│   ├── migrations.test.ts
│   └── repositoryContract.test.ts
├── .prettierrc.json
├── .prettierignore
├── eslint.config.js
├── package.json
├── vite.config.ts
└── TAURI_BUILD_PLAN.md
```

Do not create every file preemptively. Introduce these boundaries as each implementation phase requires them.

## State management design

Use the existing Svelte store approach initially; Svelte 5 components can consume stores with `$store` syntax. Use runes for local component state. Avoid a simultaneous rewrite to a second state framework.

### Active session state

```ts
interface SessionState {
  document: TacticsSession | null;
  currentSlideId: string | null;
  revision: number;
  dirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  error: string | null;
}
```

Rules:

- `revision` increments once for every committed document mutation.
- Pointer-move events update the active document without creating history snapshots.
- `checkpoint()` runs once at the beginning of a discrete gesture or action.
- Autosave is debounced for 350–500 ms and always writes the latest revision.
- If revision N finishes saving after revision N+1 has started, N must not overwrite newer state or set a misleading saved status.
- Keep undo/redo history capped at 40 snapshots.
- Derive the current slide from `document` plus `currentSlideId`; do not duplicate it in another store.

### Separate ephemeral state

Keep these out of the persisted football document:

- Active tool and current selection.
- Panel visibility, zoom, and presentation playback.
- Toast messages and transient errors.
- Animation overrides and pointer-capture state.

Persist harmless preferences such as zoom and panel visibility in settings, but never persist active animations or pointer state.

### Library state

```ts
interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  thumbnailPath: string | null;
  fileSize: number;
  modifiedMs: number;
}
```

The library stores summaries, not complete documents. Load the full session only when opened.

## Persistence and caching

### Local files

Use Tauri's path APIs to resolve these locations; never hard-code operating-system paths.

```text
app_data_dir/TikiTactic/
├── sessions/{session-id}.tikitactic.json
├── backups/{session-id}/{timestamp}.json
└── settings.json

app_cache_dir/TikiTactic/
├── library-cache.json
└── thumbnails/{session-id}-{revision}.webp
```

Session documents remain portable, human-readable JSON with a `version` field. Save atomically:

1. Serialize and validate the complete document.
2. Write to a temporary file in the same directory.
3. Flush and close it.
4. Rename it over the destination.
5. Keep one previous known-good backup.
6. Update library and thumbnail caches after the document save succeeds.

### Cache layers

1. **Active document memory:** the current document is already in Svelte state; never reread it after each edit.
2. **Recent document LRU:** retain at most eight recently opened documents in memory, keyed by session ID and revision.
3. **Library summary cache:** cache title, dates, counts, thumbnail path, file size, and modified time. Validate cached entries against file metadata before use.
4. **Thumbnail cache:** generate thumbnails after save during idle time. Key them by session ID and revision so an edit automatically invalidates the old thumbnail.
5. **Export cache, optional:** only add this if profiling shows repeated PNG exports are slow. Key by session ID, revision, pixel size, and export options.

Cache rules:

- A cache is disposable and must never be the only copy of user work.
- Every cached document or image needs a revision or file-metadata validator.
- Delete and duplicate operations update the library cache immediately after disk success.
- A corrupt cache is ignored and rebuilt, not treated as a fatal application error.
- Do not add SQLite until real measurements show that JSON summaries cannot meet the loading targets.

## Repository contract

```ts
interface SessionRepository {
  listSummaries(): Promise<SessionSummary[]>;
  load(id: string): Promise<TacticsSession>;
  save(document: TacticsSession): Promise<SessionSummary>;
  duplicate(id: string, title: string): Promise<SessionSummary>;
  remove(id: string): Promise<void>;
  exportJson(id: string, destination: string): Promise<void>;
  savePng(bytes: Uint8Array, suggestedName: string): Promise<string | null>;
}
```

Use one shared contract test suite against both the browser and Tauri adapters. Components and actions depend only on this interface.

### Tauri commands

Expose a small command surface:

- `list_sessions`
- `load_session(id)`
- `save_session(document)`
- `duplicate_session(id, title)`
- `delete_session(id)`
- `export_session(id, destination)`
- `save_png(bytes, suggested_name)`
- `get_settings`
- `update_settings(settings)`

Validate IDs and paths in Rust. Do not expose arbitrary filesystem read/write commands to the frontend. Return typed, serializable errors with safe user-facing messages.

## Schema and migration

The desktop document can retain the current browser schema as version 1. Add migrations for older documents rather than changing field meanings silently.

On the first desktop launch:

1. Look for the existing browser key `touchline-tactics-v1` only when running in a browser context.
2. Offer one explicit import if a browser document is available.
3. Save it through the repository as a normal desktop document.
4. Do not continuously mirror browser localStorage and desktop files; that would create conflicting sources of truth.

Future migrations must be pure functions, covered by tests, and must preserve unknown-but-valid player names, colours, notes, slides, and annotations.

## Performance plan

Measure before optimizing. Suggested development targets on a normal development machine:

- Cached library summaries visible within 150 ms after the backend responds.
- A cached session opens without waiting for thumbnail generation.
- Pointer movement does not invoke Rust or touch the filesystem.
- Autosave performs one disk write after a gesture or debounce window, not one per pointer event.
- A 100-session library uses summary metadata rather than parsing every full document on each launch.
- PNG export runs without blocking pointer input; generate it from the current SVG and transfer the result once.

Use the Performance API in development to measure startup, session load, save, and export. Remove verbose logging from release builds.

## Security and desktop behavior

- No remote content is required for normal operation.
- Bundle fonts and icons locally.
- Use a restrictive Tauri capability file and CSP.
- Do not enable shell access, arbitrary HTTP, or broad filesystem scopes.
- Use the native save/open dialog for exports and imports.
- Validate imported JSON and enforce sensible file-size limits.
- No telemetry unless separately requested.

## Mandatory code standards and UX rules

### Write the smallest maintainable implementation

- Do not write speculative code, unused abstractions, placeholder features, or compatibility layers that are not needed.
- Prefer existing Svelte, TypeScript, Rust, and Tauri capabilities before adding a package.
- Do not create a reusable component for a single use. Extract one only when at least two features share the behavior or when a boundary materially simplifies testing.
- Keep functions focused and files small enough to understand without navigation aids, but do not split code merely to satisfy an arbitrary line limit.
- Remove dead code, unused exports, unused dependencies, and temporary debugging code before completing a phase.
- Use strict TypeScript and typed repository/backend boundaries. Avoid `any`; model errors and empty states explicitly.

### Comments

- Do not add routine comments, commented-out code, section banners, or comments that restate what the code does.
- Code should explain itself through small functions and descriptive names.
- Comments are allowed for public API contracts, repository interfaces, Tauri commands, and non-obvious backend functions where they document behavior, errors, or safety constraints.
- Keep allowed comments current and short. Do not add tutorials or planning notes to source files.

### Dependencies

- Keep the dependency tree as small as practical.
- Before installing anything, state why the native platform or an existing dependency cannot do the job.
- Do not add a state-management library, CSS framework, component library, utility library, or caching library for this migration.
- Prettier and ESLint tooling is required, but install only the packages needed to format and lint Svelte and TypeScript.
- Audit production and development dependencies after each phase and remove anything unused.

### Formatting and linting

Use Prettier for formatting and ESLint for code-quality rules. Keep their responsibilities separate.

- Add `.prettierrc.json`, `.prettierignore`, and a flat `eslint.config.js`.
- Use Prettier with the Svelte plugin. Use ESLint with only the required Svelte and TypeScript support.
- Do not duplicate Prettier formatting rules in ESLint.
- Add `format`, `format:check`, `lint`, and `verify` scripts.
- `verify` must run formatting check, lint, Svelte/TypeScript checks, and the production build.
- Format and lint Rust with the built-in `cargo fmt` and `cargo clippy` tooling; do not add a third-party Rust linter.
- Never disable a lint rule broadly. A narrow exception needs a technical reason in the review report.

### Reusable UI and switchable theme

- Extract accessible primitives such as buttons, icon buttons, toggles, dialogs, form fields, spinners, and skeletons only when reused.
- Shared primitives own layout, accessibility, keyboard behavior, and visual states; feature components own football/session behavior.
- Use Svelte props, slots, and events for composition instead of inheritance or global component registries.
- Keep components independent from the active theme and from Tauri APIs.
- Define colours, typography, spacing, radii, shadows, and motion as CSS custom properties in theme tokens.
- Select themes with a root `data-theme` attribute. Switching a theme must not require component changes.
- Preserve the current theme as the default. Do not hard-code new UI colours outside tokens; pitch colours and team marker colours remain domain data.
- Respect keyboard navigation, visible focus states, reduced motion, and sufficient contrast.

### Loading, feedback, and UX

- Show a skeleton when loading a known layout such as the session library or slide list.
- Show a spinner for short indeterminate actions such as opening a session, importing, or exporting.
- Use the existing lightweight save-status indicator for autosave; do not cover the board with a spinner after every edit.
- Reserve layout space to prevent content shifts when loading indicators appear.
- Prevent duplicate actions while a command is pending, but never block board interaction for background cache work.
- Provide a clear empty state, an actionable error message, and retry where recovery is possible.
- Never replace an existing document with an empty loading state while a refresh is in progress.
- Keep animations short and functional, and respect `prefers-reduced-motion`.

## Implementation phases

### Phase 1: Add the Tauri shell

1. Create a branch and record the current working Svelte version.
2. Add the minimal Prettier and ESLint configuration and the formatting/linting scripts.
3. Install only the required Tauri 2 CLI and API packages.
4. Add `src-tauri` with the smallest working window configuration.
5. Add scripts such as `desktop:dev` and `desktop:build`.
6. Confirm the existing board runs unchanged inside the desktop window.

Verification:

```sh
npm run verify
npm run desktop:dev
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml
```

### Phase 2: Introduce repository adapters

1. Define `SessionRepository` and DTOs.
2. Move current localStorage logic into `BrowserSessionRepository` without changing component behavior.
3. Implement Rust session commands and `TauriSessionRepository`.
4. Select the adapter at application startup.
5. Add contract tests for list, load, save, duplicate, and delete.

Do not call Tauri APIs directly from Svelte components.

### Phase 3: Connect the state controller

1. Route session initialization and autosave through the controller and repository.
2. Add revision tracking and stale-save protection.
3. Preserve immutable updates, undo/redo, selection, and deck transitions.
4. Add atomic saves and one-backup recovery.
5. Confirm a restart restores the exact latest session.

### Phase 4: Add the desktop library and caches

1. Add a local library/open-session workflow; no login screen.
2. Implement summary caching and recent-document LRU.
3. Generate and cache thumbnails after saves.
4. Invalidate caches by revision and file metadata.
5. Profile cold start, warm start, and opening a large session.

### Phase 5: Desktop import and export

1. Keep SVG-to-PNG rendering in the frontend.
2. Use a native save dialog and a scoped Rust command to write the file.
3. Add validated JSON import and portable JSON export.
4. Test cancelled dialogs, invalid files, permission errors, and disk-full errors without losing the active session.

### Phase 6: Verification and packaging

1. Run `npm run verify`, Rust tests, `cargo fmt --check`, and `cargo clippy`.
2. Test loading skeletons, spinners, empty states, errors, keyboard use, and reduced motion.
3. Confirm the theme can be switched through tokens without editing components.
4. Test Windows, macOS, and Linux packaging where available.
5. Verify offline operation with the network disabled.
6. Verify there is no authentication or cloud dependency.
7. Produce signed/release installers only when signing credentials and release requirements are supplied.

## Required regression checks

- Dragging players and the ball updates the correct flat pitch coordinates.
- Runs, passes, lines, freehand drawing, zones, erasing, and selection still work.
- Custom names and colours survive save/restart.
- Five-corridor visibility survives restart.
- Slide add, duplicate, delete, reorder, and deck autoplay still work.
- Smooth transitions match players correctly between phases.
- Undo/redo never restores a stale document over a newer saved revision.
- Closing the inspector still expands the board.
- PNG export and JSON backup contain the current revision.
- Missing or corrupt cache files never delete or block access to session documents.

## Agent execution instructions

Implement the phases in order and keep each phase buildable. Treat the code standards, dependency limits, loading UX, reusable-component boundaries, and theme tokens as acceptance criteria. Do not redesign the interface or change the restored flat field. Prefer small migrations from the current code over a full rewrite. After each phase, report:

1. Files added or changed.
2. Commands and tests run, with their results.
3. Performance measurements if the phase affects loading or saving.
4. Any remaining platform-specific limitation.

Stop and request a decision only if a requirement would risk existing user documents or require accounts/cloud infrastructure, both of which are outside this plan.

## Definition of done

The migration is complete when the same Svelte tactics app launches as an offline Tauri desktop application, saves sessions atomically to local storage, reopens the latest work after restart, loads the library from validated caches, exports through native dialogs, passes the regression checks above, and contains no user/account workflow.
