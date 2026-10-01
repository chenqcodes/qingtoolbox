/** Fetch only public ISS orbit data; no accounts, keys, coordinates, or runtime server needed. */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseTleText, tleFreshness, TLE_SOURCE, validateTle } from '../../src/scripts/sat-pass/tle';
const path = fileURLToPath(new URL('../../public/data/iss-tle.json', import.meta.url));
const previous = await readFile(path, 'utf8').then(JSON.parse).then(validateTle).catch(() => null);
try {
  const response = await fetch(TLE_SOURCE, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'qingtoolbox-iss-snapshot/1.0' } });
  if (!response.ok) throw new Error(`CelesTrak HTTP ${response.status}`);
  const data = parseTleText(await response.text());
  const fresh = tleFreshness(data);
  if (!fresh.usable || fresh.ageDays > 3) throw new Error('Upstream TLE is not fresh enough (maximum 3 days)');
  if (previous && tleFreshness(previous).epoch > fresh.epoch) throw new Error('Upstream epoch regressed');
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
  console.log(`ISS epoch ${fresh.epoch.toISOString()}, fetched ${data.fetchedAt}, age ${fresh.ageDays.toFixed(2)} days`);
} catch (error) {
  // A temporary upstream failure must not block unrelated site fixes while a verified snapshot is usable.
  if (!previous || !tleFreshness(previous).usable) throw error;
  console.warn(`::warning::ISS refresh failed (${error instanceof Error ? error.message : 'unknown error'}); retaining verified epoch ${tleFreshness(previous).epoch.toISOString()}. Fetch timestamp unchanged.`);
}
