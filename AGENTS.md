# AGENTS.md

## Fast path
- Use npm (repo has `package-lock.json`). Install with `npm ci`.
- Start dev server with `npm run dev`.
- Validate changes with `npm run lint` and `npm run build` (no test/typecheck scripts are configured).
- Preview production build with `npm run preview`.

## Repo shape
- Single-package Vite app (not a monorepo).
- Runtime entrypoint: `src/main.jsx` -> renders `App` from `src/App.jsx`.
- Most product logic/UI is centralized in `src/App.jsx` (large single-file feature).
- Active global styling is in `src/index.css` (Tailwind + custom classes).
- `src/App.css` is template leftover and currently not imported.

## Behavior and data model you can break easily
- App state is persisted to browser `localStorage` under key `faq_db` in `src/App.jsx`; UI changes survive reload.
- If you need a clean slate while testing, clear `faq_db` in browser storage.
- Core hierarchy is `categories -> tags -> questions -> responses`; selection/navigation logic depends on these foreign-key fields (`category_id`, `tag_id`, `question_id`).
- IDs are generated with `Date.now()` in CRUD helpers; changing ID strategy affects add/update/delete behavior.

## Tooling quirks
- Tailwind is wired through both `@tailwindcss/vite` in `vite.config.js` and CSS directives in `src/index.css` (`@import "tailwindcss"` + `@config "../tailwind.config.js"`); keep this wiring intact when refactoring styles.
