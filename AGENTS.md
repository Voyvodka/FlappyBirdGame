# AGENTS.md

## Purpose
- This file is for autonomous coding agents working in this repository.
- Follow existing project patterns over generic framework defaults.
- Keep gameplay behavior stable unless a task explicitly targets balancing.

## Project Snapshot
- Stack: TypeScript + Vite + Phaser 3 + Vercel serverless API routes.
- Package manager: Yarn (lockfile is `yarn.lock`).
- Frontend entry: `src/main.ts`.
- Phaser scenes: `src/game/scenes`.
- Serverless API: `api/score/*.ts`.
- Shared score/security logic: `api/_lib/scoreSecurity.ts`.

## Repository Layout
- `src/game/constants.ts`: global gameplay constants and unlock definitions.
- `src/game/types.ts`: shared game domain types and unions.
- `src/game/GameConfig.ts`: Phaser runtime configuration.
- `src/game/scenes/BootScene.ts`: asset boot and scene transition.
- `src/game/scenes/MenuScene.ts`: menu UI, skin select, leaderboard display.
- `src/game/scenes/PlayScene.ts`: runtime loop, spawn logic, scoring, results.
- `src/game/entities/Bird.ts`: player entity behavior and hitbox logic.
- `src/game/systems/*`: focused systems (audio, difficulty, procedural art).
- `src/game/data/SaveManager.ts`: localStorage persistence and progression.
- `src/game/network/ScoreService.ts`: browser-side API client.
- `api/score/session.ts`: score session creation endpoint.
- `api/score/submit.ts`: telemetry verification and score submission endpoint.
- `api/score/top.ts`: global top leaderboard endpoint.

## Setup Commands
- Install deps: `yarn install`
- Create local env: `cp .env.example .env`
- Required env for score signing: `SCORE_SIGNING_SECRET=...`

## Build / Lint / Test Commands
- Start dev server: `yarn dev`
- Production build: `yarn build`
- Preview production build: `yarn preview`
- Type-check (recommended lint substitute): `yarn tsc --noEmit`

## Test Status In This Repo
- There is currently no test framework configured in `package.json` scripts.
- There is no `yarn test` command at this time.
- There is no single-test command currently available.
- If tests are added later, document commands here immediately.

## Single-Test Guidance (When Test Runner Gets Added)
- Preferred future convention (Vitest example):
- Run all tests: `yarn vitest run`
- Run one file: `yarn vitest run src/game/data/SaveManager.test.ts`
- Run one test name: `yarn vitest run -t "registerRun updates best score"`
- Watch one file: `yarn vitest src/game/data/SaveManager.test.ts`

## Agent Execution Checklist
- Before edits, read nearby files to match style and architecture.
- Make minimal, targeted changes.
- Preserve public API shapes unless task requires change.
- Do not introduce new dependencies without clear need.
- Prefer extending existing systems over creating parallel abstractions.

## TypeScript Rules
- TS strict mode is enabled; keep all new code type-safe.
- Prefer explicit domain interfaces/types in `src/game/types.ts`.
- Use `unknown` for untrusted input, then validate and narrow.
- Avoid `any`; existing API handlers use `any` only at framework boundary.
- Keep function return types explicit for public methods and complex helpers.
- Use union types for finite states (`GamePhase`, `PipeVariant` pattern).

## Import Conventions
- Use ESM imports only.
- Order imports in this sequence:
- 1) third-party modules,
- 2) local value imports,
- 3) `import type` lines.
- Prefer explicit named imports over namespace imports (except Phaser default).
- Keep relative imports short and local (`../...`), no path alias currently.

## Formatting Conventions
- Use 2-space indentation.
- Use semicolons.
- Use double quotes for strings.
- Keep trailing commas off unless already present in edited block.
- Prefer multi-line object/array literals when readability improves.
- Keep line length practical; wrap long chained calls similarly to existing code.

## Naming Conventions
- Classes: `PascalCase` (`PlayScene`, `SaveManager`).
- Interfaces/types: `PascalCase` (`RunTelemetry`, `DifficultyState`).
- Variables/functions/methods: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for global values.
- Scene keys and storage keys are string constants, not magic literals.

## Phaser/Game Code Patterns
- Keep scene responsibilities separated (boot/menu/play).
- Use early returns for phase guards and invalid states.
- Keep frame-update logic split into focused private methods.
- Favor deterministic clamps and bounded random values.
- Reuse constants from `constants.ts` instead of inline numbers when shared.
- For async calls from scene actions, use `void` for fire-and-forget semantics.

## State and Persistence Patterns
- Route local save mutations through `SaveManager`.
- Preserve merge/sanitize behavior when changing save schema.
- Maintain backward-compatible defaults for stored data.
- Keep leaderboard arrays filtered, sorted, and size-limited.

## API Handler Conventions
- First check HTTP method and return 405 on mismatch.
- Parse body defensively (`unknown` -> validated object).
- Validate and sanitize all external input.
- Rate-limit before expensive operations.
- Return structured JSON errors with stable machine-readable reason strings.
- Use 400 for validation/session errors, 429 for throttling, 500 for unexpected failures.

## Error Handling Guidelines
- Prefer fail-closed behavior for score/session verification.
- Use `try/catch` around network/storage boundaries.
- In UI-facing client services, return safe fallback values on failure.
- Avoid leaking internal details in API error messages.
- Throw explicit errors only when callers are expected to handle them.

## Security and Integrity
- Keep session signatures tied to username and issued payload fields.
- Do not weaken telemetry verification constraints without explicit request.
- Keep anti-replay checks (`used` keys) intact.
- Keep scoreboard inputs sanitized and range-checked.
- Never log secrets (`SCORE_SIGNING_SECRET`, Redis tokens, KV tokens).

## Performance Guidance
- Avoid per-frame allocations in hot loops when practical.
- Keep update loops branch-light and bounded.
- Maintain conservative list caps (`MAX_ENTRIES`) for memory safety.
- Prefer incremental updates over recomputing global state each frame.

## UI / UX Consistency
- Preserve the current art direction: warm palette, layered parallax, high contrast HUD.
- Match existing font choices (`Changa`, `Outfit`) and depth layering patterns.
- Keep mobile behavior intact (`styles.css` and canvas sizing rules).

## Dependencies and Tooling
- Use Yarn for all dependency and script commands.
- Do not switch package managers.
- Keep Vite config minimal unless feature requires change.

## Cursor/Copilot Rules Check
- Checked `.cursor/rules/`: not present.
- Checked `.cursorrules`: not present.
- Checked `.github/copilot-instructions.md`: not present.
- If any of these files are added later, treat them as higher-priority instructions and merge their guidance into this file.

## When Editing This AGENTS.md
- Update command examples when scripts change.
- Keep guidance concrete and repository-specific.
- Prefer documenting observed conventions over personal preferences.
- Keep this file concise, actionable, and current.
