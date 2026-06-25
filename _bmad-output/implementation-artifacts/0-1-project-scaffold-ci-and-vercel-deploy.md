# Story 0.1: Project Scaffold, CI, and Vercel Deploy

Status: ready-for-dev

## Story

As a developer,
I want a Next.js 14 (App Router) monorepo scaffolded, connected to a Vercel project, and running a baseline CI pipeline,
so that all later stories have a stable, deployable home from the first commit.

## Acceptance Criteria

1. **Given** a fresh repository, **when** the scaffold is created, **then** the project uses Next.js 14 with the App Router, TypeScript strict mode, ESLint, and Prettier configured at root.

2. **Given** the repository is connected to Vercel, **when** a commit is pushed to `main`, **then** Vercel automatically builds and deploys the app to a preview/production URL with no manual step.

3. **Given** a CI workflow file is present (GitHub Actions or equivalent), **when** a pull request is opened, **then** CI runs `tsc --noEmit`, ESLint, and (once any test exists) the test suite; the pipeline fails visibly if any check fails.

4. **Given** the project structure, **then** the following top-level directories exist and are empty/stub-ready: `app/` (Next.js routes), `lib/` (shared utilities), `supabase/` (migrations + seed), `components/` (UI), `services/` (server-only service modules); no business logic lives in `app/` directly.

5. **Given** the deployment runs, **when** the root URL is visited, **then** a minimal placeholder page renders (e.g. "ARIA — coming soon") confirming a successful end-to-end deploy; no auth or data is required at this stage.

## Tasks / Subtasks

- [ ] **Task 1: Initialize Next.js 14 project** (AC: 1, 4)
  - [ ] Run `npx create-next-app@14 . --typescript --eslint --app --src-dir false --import-alias "@/*"` in the repo root
  - [ ] Verify `tsconfig.json` has `"strict": true` under `compilerOptions`
  - [ ] Add `"noUncheckedIndexedAccess": true` to `tsconfig.json` compilerOptions for additional strictness
  - [ ] Create empty stub directories: `lib/`, `supabase/migrations/`, `supabase/seed/`, `components/`, `services/`
  - [ ] Add `.gitkeep` files to empty dirs so they are committed
  - [ ] Verify `app/` uses App Router conventions (layout.tsx, page.tsx at root)

- [ ] **Task 2: Configure Prettier** (AC: 1)
  - [ ] Install: `npm install --save-dev prettier eslint-config-prettier`
  - [ ] Create `.prettierrc` at project root with settings: `{ "semi": false, "singleQuote": true, "trailingComma": "es5", "printWidth": 100, "tabWidth": 2 }`
  - [ ] Create `.prettierignore` excluding: `.next/`, `node_modules/`, `supabase/`
  - [ ] Update `.eslintrc.json` (or `eslint.config.mjs`) to extend `"prettier"` last in extends array (overrides ESLint formatting rules)
  - [ ] Add format scripts to `package.json`: `"format": "prettier --write ."` and `"format:check": "prettier --check ."`

- [ ] **Task 3: Placeholder home page** (AC: 5)
  - [ ] Replace generated `app/page.tsx` with a minimal page rendering "ARIA — coming soon" in plain text/HTML
  - [ ] Keep `app/layout.tsx` with minimal metadata (`title: "ARIA"`)
  - [ ] Delete the default Next.js demo CSS (`app/globals.css` can be kept minimal or cleared)
  - [ ] Verify `npm run dev` serves the placeholder at `localhost:3000`

- [ ] **Task 4: GitHub Actions CI pipeline** (AC: 3)
  - [ ] Create `.github/workflows/ci.yml` with:
    - Trigger: `push` to `main` + `pull_request` to `main`
    - Node.js 20.x setup with `actions/setup-node` and `cache: 'npm'`
    - `npm ci` for deterministic installs
    - `npm run lint` (ESLint)
    - `npx tsc --noEmit` (type-check without emitting files)
    - `npm run format:check` (Prettier)
    - `npm test -- --passWithNoTests` (Jest, tolerates no tests yet)
  - [ ] Verify workflow file is valid YAML

- [ ] **Task 5: Connect to Vercel** (AC: 2)
  - [ ] Create Vercel project linked to this repo (via Vercel dashboard or `vercel link`)
  - [ ] Set Framework Preset to "Next.js" in Vercel project settings
  - [ ] Confirm auto-deploy is enabled on `main` push
  - [ ] Commit and push; verify Vercel builds successfully and the placeholder renders at the deployment URL
  - [ ] Note the production/preview URL in a comment in `README.md` or a `DEPLOYMENT.md` stub

- [ ] **Task 6: Environment variable scaffold** (AC: 1, prerequisite for Story 0.5)
  - [ ] Create `.env.example` listing all future required server-side variables with placeholder values and comments:
    ```
    # Anthropic
    ANTHROPIC_API_KEY=sk-ant-...
    # Supabase
    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    # Zalo OA
    ZALO_OA_APP_ID=
    ZALO_OA_APP_SECRET=
    # SMTP
    SMTP_HOST=
    SMTP_PORT=587
    SMTP_USER=
    SMTP_PASS=
    ```
  - [ ] Add `.env.local` and `.env*.local` to `.gitignore` (should be there by default from create-next-app, verify)
  - [ ] **CRITICAL:** Ensure `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_OA_*`, and `SMTP_*` do NOT have the `NEXT_PUBLIC_` prefix — they are server-only

- [ ] **Task 7: Validate structure and commit** (AC: 4)
  - [ ] Run `npm run lint` — must pass with zero errors
  - [ ] Run `npx tsc --noEmit` — must pass with zero errors
  - [ ] Run `npm run format:check` — must pass
  - [ ] Confirm directory tree matches exactly: `app/`, `lib/`, `supabase/migrations/`, `supabase/seed/`, `components/`, `services/`
  - [ ] Commit with message: `feat: scaffold Next.js 14 App Router project with CI and Vercel deploy`

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **Next.js 14 + App Router is required** — do NOT use Pages Router. All routing in `app/` using `layout.tsx`, `page.tsx`, `loading.tsx` etc. Later epics assume App Router conventions (Server Components, Server Actions, Route Handlers).
- **TypeScript strict mode is required** from day one. Later stories' ACs assert specific TypeScript behaviors; strict mode prevents gradual type-safety erosion. Set `"strict": true` in `tsconfig.json`.
- **No business logic in `app/`** — `app/` is for routing shell only. Logic goes in `lib/` (shared utilities), `services/` (server-only service modules), or `components/` (UI). This is an architectural invariant (AD-1); violating it causes refactor debt in Epics 1–5.
- **Server-only variables must never be prefixed `NEXT_PUBLIC_`** — the `NEXT_PUBLIC_` prefix bundles a variable into the client JS bundle. `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and all third-party secrets are server-only (AD-11). The `.env.example` separates them clearly.

### Directory Structure to Create

```
c:/Nhan/ARIA/
├── app/
│   ├── layout.tsx          # Root layout (minimal: html, body, metadata)
│   └── page.tsx            # Placeholder: "ARIA — coming soon"
├── components/             # UI components (empty, .gitkeep)
├── lib/                    # Shared utilities (empty, .gitkeep)
│   └── (later: supabase/, ai/, utils/)
├── services/               # Server-only service modules (empty, .gitkeep)
├── supabase/
│   ├── migrations/         # Numbered SQL migration files (empty, .gitkeep)
│   └── seed/               # Seed data scripts (empty, .gitkeep)
├── .env.example            # All required env vars with placeholders
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore              # Must include .env.local, .env*.local
├── .prettierrc
├── .prettierignore
├── eslint.config.mjs       # (or .eslintrc.json depending on Next.js version)
├── next.config.ts          # (or next.config.mjs)
├── package.json
└── tsconfig.json           # strict: true required
```

### Model IDs — Pre-build Verification Required

The Architecture Spine lists `claude-haiku-4-5` and `claude-sonnet-4-6`. The readiness report flags `claude-haiku-4-5` as potentially incorrect.

**Verified IDs (confirm against Anthropic API at build time):**
- Haiku: `claude-haiku-4-5-20251001`
- Sonnet: `claude-sonnet-4-6`

Story 0.7 (AI-call wrapper) will use these; document the verified IDs in a `lib/ai/models.ts` constants file in that story. For this story, no AI code is needed — just flag the verification in a `TODO` comment in `.env.example` or a `NOTES.md` stub.

### CI Pipeline Structure

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run format:check
      - run: npm test -- --passWithNoTests
```

### Vercel Configuration

- Framework: Next.js (auto-detected)
- Build command: `npm run build` (default)
- Output directory: `.next` (default)
- Install command: `npm ci`
- Do NOT set `NEXT_PUBLIC_*` vars for secrets in Vercel environment settings — only public vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) go there; secrets go in server-only env vars.

### What Exists Today in the Repo

- `ARIA_PRD.md` at root (planning artifact — do NOT delete, leave in place)
- `docs/` directory (planning docs — do NOT modify)
- `_bmad-output/` directory (planning/implementation artifacts — do NOT modify)
- `.claude/` directory (tooling — do NOT modify)
- `_bmad/` directory (tooling — do NOT modify)

**The Next.js project should be initialized directly in `c:/Nhan/ARIA/` (the repo root).** create-next-app with `.` as the target will scaffold into the current directory.

### Testing Standards for This Story

No functional tests are required for Story 0.1 (it is pure scaffold). The CI step uses `--passWithNoTests` to tolerate an empty test suite. **Do NOT add Jest or a test runner unless create-next-app installs one by default** — test framework setup is implicit in later stories when first tests are written.

### Project Structure Notes

- Alignment: Everything follows the architecture spine seed (`addendum.md §A`, `ARCHITECTURE-SPINE.md §Seed`)
- No conflicts detected — this is a fresh scaffold
- The `supabase/` directory is created empty; Supabase CLI commands (`supabase init`, `supabase db reset`) run in Story 0.2

### References

- [Source: _bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md — Seed section]
- [Source: _bmad-output/planning-artifacts/addendum.md §A — Proposed Stack]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 0.1 ACs]
- [Source: _bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md — AD-11 Secret custody]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report.md — Pre-build condition: verify model IDs]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story)

### Debug Log References

### Completion Notes List

### File List
