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
