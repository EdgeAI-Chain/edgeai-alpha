# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Rust blockchain node (Actix Web). Core logic lives in `backend/src/`; integration tests are in `backend/tests/`; `backend/static/` hosts the built-in explorer HTML.
- `frontend/`: React + TypeScript explorer. App code is under `frontend/client/src/` with `components/`, `pages/`, `lib/`, `hooks/`, and `assets/`. `frontend/server/` is used for the production server bundle.
- `sdk/typescript/`: TypeScript SDK published as `@edgeai/sdk`.
- `docs/`: Docusaurus documentation site.

## Build, Test, and Development Commands
- Backend (Rust):
  - `cargo build --release` (builds the node binary)
  - `./target/release/edgeai-node` (runs the node)
  - `cargo test` (runs Rust tests)
- Frontend (Vite):
  - `pnpm install` (install deps)
  - `pnpm dev` (local dev server)
  - `pnpm build` (client + server bundle)
  - `pnpm start` (serve production build)
  - `pnpm check` (TypeScript typecheck)
  - `pnpm format` (Prettier formatting)
- SDK (`sdk/typescript/`):
  - `npm run build` (tsup build)
  - `npm run test` (Vitest)
  - `npm run lint` (ESLint)
- Docs (`docs/`):
  - `yarn` (install deps)
  - `yarn start` (local docs)
  - `yarn build` (static build)
  - `yarn typecheck` (TS typecheck)

## Coding Style & Naming Conventions
- Rust follows standard rustfmt style; keep modules grouped by domain (e.g., `blockchain/`, `consensus/`, `network/`).
- Frontend uses Prettier (`pnpm format`) and TypeScript; follow existing component/file naming within `frontend/client/src/`.
- SDK uses ESLint (`npm run lint`) and TypeScript; prefer explicit exports from `sdk/typescript/src/index.ts`.

## Testing Guidelines
- Rust tests live in `backend/tests/` and run with `cargo test`.
- SDK tests use Vitest via `npm run test`.
- Frontend and docs currently rely on typechecking (`pnpm check`, `yarn typecheck`) rather than dedicated test suites.
- No explicit coverage thresholds are defined.

## Commit & Pull Request Guidelines
- Commit history follows a Conventional Commits-style pattern: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, optionally scoped (e.g., `feat(sdk): add client helpers`).
- PRs should include a short summary, the commands run (if any), and link relevant issues.
- Include screenshots or screen recordings for UI changes in `frontend/`.
- Call out API or contract changes that impact `sdk/` or `docs/`.
