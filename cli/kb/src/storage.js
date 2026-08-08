import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ARCHIVE_ROOT = join(here, '..', 'archive');

export function rawDir(date) {
  return join(ARCHIVE_ROOT, 'raw', date);
}

export function dailyDir() {
  return join(ARCHIVE_ROOT, 'daily');
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

export function safeName(name) {
  return (name || 'unnamed').replace(/[^\w.\-]/g, '_').slice(0, 80);
}
