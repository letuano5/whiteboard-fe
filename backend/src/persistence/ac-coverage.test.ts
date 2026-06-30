/**
 * Meta-test: verifies that the AC coverage guard script passes for this feature.
 * Running this test ensures every AC-n in the acceptance registry has at least
 * one corresponding `@covers AC-n` tag in the backend source tree.
 *
 * @covers AC-11 Every AC-1 through AC-10 has a @covers tag in the test suite.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// __dirname equivalent in ESM
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Traverse: persistence/ -> src/ -> backend/ -> repo root (3 levels up)
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SCRIPT = resolve(REPO_ROOT, '.agents/skills/implement-feature/scripts/check-ac-coverage.sh');
const ACCEPTANCE_MD = resolve(REPO_ROOT, 'specs/021-postgresql-prisma-autosave/acceptance.md');
const TEST_DIR = resolve(REPO_ROOT, 'backend/src');

describe('AC-11: AC coverage guard', () => {
  it('check-ac-coverage.sh passes — every AC-n has a @covers tag', () => {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`bash "${SCRIPT}" "${ACCEPTANCE_MD}" "${TEST_DIR}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === 'object' &&
        'stdout' in err &&
        'status' in err
      ) {
        const e = err as { stdout: string; status: number };
        output = e.stdout;
        exitCode = e.status ?? 1;
      } else {
        throw err;
      }
    }

    if (exitCode !== 0) {
      // Print output to help debugging
      console.error('check-ac-coverage.sh output:\n', output);
    }

    expect(exitCode).toBe(0);
  });
});
