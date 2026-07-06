# AGENTS.md

## Fast path
- Package manager: npm (`package-lock.json` is present). Install with `npm ci`.
- Local dev: `npm run dev`.
- Full validation order: `npm run lint` then `npm run build`.
- Preview production build: `npm run preview`.
- No `test` or `typecheck` scripts are defined in `package.json`.

## Repo shape
- Single-package Vite app (not a monorepo).
- Entrypoint is `src/main.jsx`, which renders `src/App.jsx`.
- Core product behavior is concentrated in `src/App.jsx` (FAQ CRUD tree + "Enviar informacoes" flow submission modal).
- Chat integration is split across `src/components/FloatingChat.tsx`, `src/components/ChatWidget.tsx`, and `src/lib/chatApi.ts`.
- Seed FAQ source is `src/data/faq.json`; it is normalized to `{ categories, tags, questions, responses }` on initial load.

## Easy-to-miss behavior
- FAQ data persists in browser `localStorage` key `faq_db`; once saved, it overrides `src/data/faq.json` until storage is cleared.
- If FAQ seed edits appear ignored, clear `localStorage.faq_db` and reload.
- Data links are relational: `categories -> tags -> questions -> responses` via `category_id`, `tag_id`, and `question_id`; delete logic depends on these links for cascade cleanup.
- New IDs for user-created records come from `makeId()` in `src/App.jsx` (`Date.now() + random`); changing ID semantics can break edit/delete targeting.

## Env and integration
- `VITE_FLOW_URL` is required for the "Enviar informacoes" action (`sendJsonToFlowPowerAutomateFlow` throws if unset).
- Chat API uses `VITE_API_BASE_URL` and defaults to `https://hml-gsa.pe.gov.br/api/v1/telegram/webhook` when unset.
- `.env.example` only documents `VITE_FLOW_URL`; add `VITE_API_BASE_URL` manually for non-local chat backends.

## Tooling quirks
- Tailwind is wired in two places: `@tailwindcss/vite` in `vite.config.js` and `@import "tailwindcss"` + `@config "../tailwind.config.js"` in `src/index.css`.
- `vite.config.js` uses `base: './'`; relative asset paths are intentional.
- ESLint targets only `**/*.{js,jsx}`; `npm run lint` does not check `*.ts`/`*.tsx`.
- If you need a manual type check, run `npx tsc --noEmit` (TypeScript config exists, just no npm script).
