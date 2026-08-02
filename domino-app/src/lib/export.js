export const EXPORT_VERSION = 1;

/** RFC 4180 escaping: wrap in quotes and double any embedded quote. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(','));
  }
  return lines.join('\n');
}

/**
 * Everything the app knows, in one object. `generatedAt` is passed in rather than
 * read from the clock so the serialisation stays deterministic and testable.
 */
export function buildExport({ goals, periods, entries, settings, generatedAt }) {
  return {
    app: 'Domino',
    exportVersion: EXPORT_VERSION,
    generatedAt,
    counts: {
      goals: goals.length,
      periods: periods.length,
      dailyEntries: entries.length,
    },
    goals,
    periods,
    dailyEntries: entries,
    settings,
  };
}

export const ENTRY_COLUMNS = [
  'date',
  'one_thing',
  'completed',
  'time_block_hour',
  'time_block_minute',
  'time_block',
  'completed_at',
];

export function entriesToCsv(entries) {
  return toCsv(entries, ENTRY_COLUMNS);
}

export function exportFilenames(generatedAt) {
  // Colons are illegal in filenames on several platforms; keep it to date + time.
  const stamp = generatedAt.replace(/[:.]/g, '-').replace(/Z$/, '');
  return {
    json: `domino-backup-${stamp}.json`,
    csv: `domino-entries-${stamp}.csv`,
  };
}

/** Read every table and assemble the export payload. */
export async function collectExport(db, generatedAt) {
  const [goals, periods, entries, settingsRows] = await Promise.all([
    db.getAllAsync('SELECT * FROM goals ORDER BY level'),
    db.getAllAsync('SELECT * FROM periods ORDER BY level, period_key'),
    db.getAllAsync('SELECT * FROM daily_entries ORDER BY date'),
    db.getAllAsync('SELECT * FROM settings ORDER BY key'),
  ]);
  const settings = {};
  for (const row of settingsRows) settings[row.key] = row.value;
  return buildExport({ goals, periods, entries, settings, generatedAt });
}
