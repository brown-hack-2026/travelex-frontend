# Repository Guidelines

## Project Structure & Module Organization
Next.js App Router keeps routed pages, layouts, and server actions inside `src/app`; colocate feature-specific components there when they are not reused elsewhere. Shared UI lives in `src/components`, service wrappers in `src/lib`, and lightweight utilities in `src/utils`. Static assets live in `public`, and root-level configs (`next.config.ts`, `postcss.config.mjs`, `tsconfig.json`) govern the build.

## Build, Test, and Development Commands
`npm run dev` starts the local server on `http://localhost:3000` with hot reload for day-to-day work. `npm run build` invokes `next build`, compiling TypeScript and verifying route metadata; run it before merging to catch type, env, or dynamic import issues. `npm run start` serves the compiled `.next` output and should back any release rehearsal or bug reproduction.

## Coding Style & Naming Conventions
Write TypeScript-first React function components, type every prop, and keep server action signatures explicit. Use PascalCase for component files (`FlightCard.tsx`), camelCase for helpers, and kebab-case folders under `src/app/trips/`. Tailwind CSS 4 powers styling—compose utility classes inline, extract helper components when class lists grow, and avoid legacy CSS files. Prefer absolute imports from `src/`, keep two-space indentation, and rely on your editor’s TS formatter.

## Testing Guidelines
Automated testing is not yet configured, so perform disciplined manual QA: after `npm run dev`, exercise booking flows, monitor the browser console, and check the terminal for Next.js warnings. When you add tests, keep them next to the source as `component.test.tsx`, structure suites with `describe/it`, and focus on observable behavior such as form validation or guarded navigation. Document any future `npm run test` scripts here so expectations stay centralized.

## Commit & Pull Request Guidelines
History shows short, imperative subjects (`feat: add booking facade`), so follow that pattern, stay under ~60 characters, and expand with context in the body when needed. Pull requests should link issues, summarize changes, list manual verification steps (`✓ npm run build`, `✓ mobile viewport check`), and include screenshots or recordings for UI updates. Flag environment-variable or data contract changes so reviewers can recreate them quickly.

## Security & Configuration Tips
Secrets live in `.env.local`; never commit them or expose them client-side unless the key begins with `NEXT_PUBLIC_`. Document new variables in `README.md`, guard server-only usages with optional chaining, and provide fallbacks to avoid build failures. Run `npm run build` before pushing so Next.js surfaces missing env keys or server/client boundary violations early.
