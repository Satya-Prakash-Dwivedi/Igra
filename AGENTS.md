# Repository Guidelines

## Project Structure & Module Organization
Core code lives in `server/` with a service-oriented Express layout:
- `server/server.ts`: app bootstrap, middleware registration, route mounting.
- `server/config/`: environment and database setup (`db.ts`).
- `server/routes/`: route definitions (currently `authRoutes.ts`).
- `server/controllers/`: HTTP-layer handlers.
- `server/services/`: business logic used by controllers.
- `server/models/`: Mongoose models (`User`, `Order`, `Invoice`, etc.).
- `server/middleware/` and `server/utils/`: cross-cutting concerns (auth, errors, logging).

TypeScript compiles from `server/` to `dist/` (see `tsconfig.json`), though current config is `noEmit: true`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local server with `nodemon` on `server/server.ts`.
- `npm run build`: run TypeScript compiler checks.
- `npm start`: run built app from `dist/server.js` (requires emitted build output).
- `npm test`: placeholder script; currently exits with error.

Example workflow:
```bash
npm install
npm run dev
```

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`), ESM imports with `.ts` extensions.
- Use 2-4 space indentation consistently (match surrounding file; most files use 4).
- Use `camelCase` for variables/functions, `PascalCase` for models/classes, and descriptive filenames like `authService.ts`.
- Keep controllers thin; move business logic to `services/`.
- Prefer centralized logging via `server/utils/logger.ts` over `console.log`.

## Testing Guidelines
No framework is configured yet. When adding tests:
- Use `*.test.ts` naming.
- Place tests near modules or under `server/__tests__/`.
- Prioritize service and middleware behavior first.
- Replace the placeholder `npm test` script with a real runner before enforcing coverage targets.

## Commit & Pull Request Guidelines
History currently shows simple, descriptive messages (example: `Initial commit of Igra Backend`). Follow that pattern:
- Commit messages: imperative, specific, and scoped (e.g., `Add JWT refresh token validation`).
- Keep commits focused; avoid mixing refactors and features.
- PRs should include: purpose, key changes, local verification steps, env/config changes, and API examples for endpoint changes.

## Security & Configuration Tips
- Store secrets in `.env` (`MONGO_URI`, `PORT`, `CLIENT_URL`, JWT secrets).
- Do not commit credentials.
- Keep security middleware (`helmet`, `cors`, `rateLimit`) enabled for all API environments.
