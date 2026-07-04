import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDir, '../../../.env');

expand(config({ path: rootEnvPath }));
