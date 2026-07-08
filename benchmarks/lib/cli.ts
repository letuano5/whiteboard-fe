export type CliArgs = Record<string, string | true>;

export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const withoutPrefix = raw.slice(2);
    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex >= 0) {
      args[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[withoutPrefix] = next;
      index += 1;
    } else {
      args[withoutPrefix] = true;
    }
  }
  return args;
}

export function getString(args: CliArgs, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function getOptionalString(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getNumber(args: CliArgs, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getList(args: CliArgs, key: string, fallback: string[]): string[] {
  const value = args[key];
  if (typeof value !== 'string') return fallback;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getNumberList(args: CliArgs, key: string, fallback: number[]): number[] {
  const parsed = getList(args, key, [])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  return parsed.length > 0 ? parsed : fallback;
}

export function getBoolean(args: CliArgs, key: string, fallback: boolean): boolean {
  const value = args[key];
  if (value === true) return true;
  if (typeof value !== 'string') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return fallback;
}
