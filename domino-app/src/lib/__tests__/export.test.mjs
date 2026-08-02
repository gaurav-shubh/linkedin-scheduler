/**
 * Serialisation checks for the export payload:
 *   node src/lib/__tests__/export.test.mjs
 */
import assert from 'node:assert/strict';
import {
  ENTRY_COLUMNS,
  buildExport,
  csvCell,
  entriesToCsv,
  exportFilenames,
} from '../export.js';

let passed = 0;
function it(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

/** Minimal RFC 4180 reader, so the round-trip is checked rather than assumed. */
function parseCsvRow(row) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const c = row[i];
    if (inQuotes) {
      if (c === '"' && row[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

it('csv cells pass plain values through untouched', () => {
  assert.equal(csvCell('ship the beta'), 'ship the beta');
  assert.equal(csvCell(1), '1');
});

it('csv cells quote separators, quotes and newlines', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
});

it('csv cells render null and undefined as empty', () => {
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

it('a ONE Thing containing a comma cannot corrupt the CSV row', () => {
  // The realistic failure: free text with commas silently shifting every column.
  const csv = entriesToCsv([
    { date: '2026-08-02', one_thing: 'Call Ana, then draft the spec', completed: 1 },
  ]);
  const [header, row] = csv.split('\n');
  assert.equal(header, ENTRY_COLUMNS.join(','));

  const cells = parseCsvRow(row);
  assert.equal(cells.length, ENTRY_COLUMNS.length, `row parsed to ${cells.length} cells`);
  // The comma stays inside the field instead of shifting every later column.
  assert.equal(cells[ENTRY_COLUMNS.indexOf('one_thing')], 'Call Ana, then draft the spec');
  assert.equal(cells[ENTRY_COLUMNS.indexOf('date')], '2026-08-02');
  assert.equal(cells[ENTRY_COLUMNS.indexOf('completed')], '1');
});

it('export payload records counts that match its contents', () => {
  const payload = buildExport({
    goals: [{ level: 'why', text: 'x' }],
    periods: [{ level: 'week', period_key: '2026-W31' }],
    entries: [{ date: '2026-08-01' }, { date: '2026-08-02' }],
    settings: { notify_enabled: 'true' },
    generatedAt: '2026-08-02T05:00:00.000Z',
  });
  assert.equal(payload.counts.goals, 1);
  assert.equal(payload.counts.periods, 1);
  assert.equal(payload.counts.dailyEntries, 2);
  assert.equal(payload.dailyEntries.length, 2);
  assert.equal(payload.settings.notify_enabled, 'true');
  assert.equal(payload.exportVersion, 1);
});

it('export is deterministic for a fixed timestamp', () => {
  const args = { goals: [], periods: [], entries: [], settings: {}, generatedAt: '2026-08-02T05:00:00.000Z' };
  assert.equal(JSON.stringify(buildExport(args)), JSON.stringify(buildExport(args)));
});

it('filenames contain no characters illegal on common filesystems', () => {
  const { json, csv } = exportFilenames('2026-08-02T05:06:07.891Z');
  for (const name of [json, csv]) {
    assert.ok(!/[:*?"<>|]/.test(name), `illegal character in ${name}`);
  }
  assert.ok(json.endsWith('.json'));
  assert.ok(csv.endsWith('.csv'));
});

console.log(`\n${passed} export checks passed`);
