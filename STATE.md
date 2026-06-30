## 2026-06-30 - P3B-00 spec slicing

Status: shipped
Decision: Split Supabase auth foundation into P3B-00a/00b/00c before implementation.
Changed: docs/SPECS.md roadmap ground truth only.
Verified: Spec block reread; format check attempted but local Prettier dependency is missing.

## 2026-06-30 - P3B-00a Supabase local compose foundation

Status: shipped
Decision: Use one root Supabase compose based on the official Docker compose, with support files vendored under infra/supabase/docker.
Changed: docker-compose.yml, env samples, Supabase support files, AC docs.
Verified: AC-1..AC-6 via docker compose config, rg checks for services/images/routes/env, and no generated data dir.

## 2026-06-30 - P3B-00b Backend auth abstraction skeleton

Status: shipped
Decision: Keep backend auth provider-agnostic with an identity-only AuthVerifier contract and static stub adapter.
Changed: backend auth module, focused auth verifier tests, AC docs.
Verified: AC-1..AC-5 via auth unit tests, backend typecheck, and rg checks for no Supabase SDK/request wiring.

## 2026-06-30 - P3B-00c Local DB reset and app-user boundary docs

Status: shipped
Decision: Keep existing PGDATA, expose Postgres directly for host Prisma, and gate Supavisor/unused services behind a full-stack profile.
Changed: Supabase README, env sample, compose profiles/ports, and AC docs.
Verified: AC-1..AC-6 via focused rg checks, docker compose config --services, git check-ignore, and git diff --check.
Notes: Prettier check could not run because local `prettier` command is missing.

## 2026-06-30 - P3B-01a Backend HTTP auth middleware

Status: shipped
Decision: Add provider-agnostic Express middleware over AuthVerifier without app-user upsert yet.
Changed: backend auth middleware, auth exports, focused middleware tests, AC docs.
Verified: AC-1..AC-4 via auth unit tests, backend typecheck, and rg scope check.

## 2026-06-30 - P3B-01b Backend socket auth middleware

Status: shipped
Decision: Install provider-agnostic Socket.IO auth only when an AuthVerifier is injected.
Changed: backend socket auth middleware, realtime auth wiring, fake IO helper, focused tests, AC docs.
Verified: AC-1..AC-5 via auth unit tests and backend typecheck.

## 2026-06-30 - P3B-01c Frontend Supabase session foundation

Status: shipped
Decision: Keep Supabase SDK behind a frontend auth adapter and store access tokens in auth state for later transport attachment.
Changed: frontend auth adapter/store/UI, HomePage auth panel, Vite env typing/sample, tests, package dependency.
Verified: AC-1..AC-5 via auth/HomePage tests, frontend typecheck, frontend lint, and scope rg check.

## 2026-06-30 - P3B-01d Token attachment

Status: shipped
Decision: Attach the current auth access token at transport edges without enabling role enforcement or backend socket auth by default.
Changed: socket client auth option, authenticated fetch helper, app bootstrap ordering, focused tests, AC docs.
Verified: AC-1..AC-5 via socket/fetch/bootstrap tests, frontend typecheck, frontend lint, and scope rg check.

## 2026-06-30 - P3B-01e App user upsert

Status: shipped
Decision: Store verified identities in an app-owned AppUser table and attach app users only through injected auth middleware repositories.
Changed: Prisma AppUser schema/migration, app-user repository, HTTP/socket auth middleware, focused tests, AC docs.
Verified: AC-1..AC-5 via auth repository/middleware tests, Prisma generate/validate, full workspace typecheck/test, and scope rg check.

## 2026-06-30 - P3B-02 Role owner / editor / viewer
Status: shipped
Decision: Resolve room roles from app DB membership and keep anonymous dev sessions editable.
Changed: shared role contracts, backend room-role enforcement/update handlers, frontend room-access UI/state, focused tests.
Verified: AC-1..AC-5 via focused role tests, full workspace test, typecheck, and lint.
