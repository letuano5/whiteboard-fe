#!/usr/bin/env bash
#
# Deterministic test-from-spec guard.
#
# Every acceptance criterion declared in acceptance.md as AC-<n>: must be covered by at
# least one test tagged "@covers AC-<n>". This proves every registered requirement has a
# test; it cannot prove the oracle was authored from the criterion rather than the code.

set -euo pipefail

err() { printf '%s\n' "$*" >&2; }

REGISTRY="${1:-}"

if [ -z "$REGISTRY" ] && [ -n "${SPECIFY_FEATURE:-}" ] && [ -f "specs/${SPECIFY_FEATURE}/acceptance.md" ]; then
  REGISTRY="specs/${SPECIFY_FEATURE}/acceptance.md"
fi

if [ -z "$REGISTRY" ]; then
  REGISTRY="$(ls -t specs/*/acceptance.md 2>/dev/null | head -n1 || true)"
fi

if [ -z "$REGISTRY" ] || [ ! -f "$REGISTRY" ]; then
  err "AC-coverage: no acceptance.md registry found. Skipping."
  exit 0
fi

TEST_PATH="${2:-}"

if [ -z "$TEST_PATH" ]; then
  if [ -d tests ]; then
    TEST_PATH="tests"
  elif [ -d test ]; then
    TEST_PATH="test"
  else
    TEST_PATH="."
  fi
fi

if [ ! -e "$TEST_PATH" ]; then
  err "AC-coverage: test path '$TEST_PATH' not found."
  exit 1
fi

declared="$(grep -oE 'AC-[0-9]+' "$REGISTRY" | sort -u || true)"

if [ -z "$declared" ]; then
  err "AC-coverage: no 'AC-<n>:' criteria found in $REGISTRY."
  err "Maintain the registry as AC-1:, AC-2:, ... append-only."
  exit 1
fi

covered="$(grep -rohE '@covers[[:space:]]+AC-[0-9]+([[:space:],]+AC-[0-9]+)*' "$TEST_PATH" 2>/dev/null \
  | grep -oE 'AC-[0-9]+' | sort -u || true)"

missing="$(comm -23 <(printf '%s\n' "$declared") <(printf '%s\n' "$covered"))"

if [ -n "$missing" ]; then
  err "AC-coverage FAIL - acceptance criteria with no '@covers' test:"
  printf '  - %s\n' $missing >&2
  err "Registry: $REGISTRY"
  err "Tests:    $TEST_PATH"
  err "Tag covering tests with: @covers AC-<n>"
  exit 1
fi

n="$(printf '%s\n' "$declared" | grep -c .)"
err "AC-coverage OK - all $n acceptance criteria covered."
exit 0
