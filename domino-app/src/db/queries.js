function nowIso() {
  return new Date().toISOString();
}

// --- Goals (someday / five_year / one_year) ---

export async function getGoal(db, level) {
  return db.getFirstAsync('SELECT * FROM goals WHERE level = ?', level);
}

export async function getAllGoals(db) {
  const rows = await db.getAllAsync('SELECT * FROM goals');
  const map = {};
  for (const row of rows) map[row.level] = row.text;
  return map;
}

export async function upsertGoal(db, level, text) {
  await db.runAsync(
    `INSERT INTO goals (level, text, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(level) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    level,
    text,
    nowIso()
  );
}

// --- Periods (week / month) ---

export async function getPeriod(db, level, periodKey) {
  return db.getFirstAsync(
    'SELECT * FROM periods WHERE level = ? AND period_key = ?',
    level,
    periodKey
  );
}

export async function upsertPeriod(db, level, periodKey, oneThing) {
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO periods (level, period_key, one_thing, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(level, period_key) DO UPDATE SET one_thing = excluded.one_thing, updated_at = excluded.updated_at`,
    level,
    periodKey,
    oneThing,
    ts,
    ts
  );
}

export async function listPeriods(db, level, limit = 12) {
  return db.getAllAsync(
    'SELECT * FROM periods WHERE level = ? ORDER BY period_key DESC LIMIT ?',
    level,
    limit
  );
}

// --- Daily entries ---

export async function getDailyEntry(db, date) {
  return db.getFirstAsync('SELECT * FROM daily_entries WHERE date = ?', date);
}

export async function upsertDailyEntry(db, date, { oneThing, timeBlockHour, timeBlockMinute }) {
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO daily_entries (date, one_thing, time_block_hour, time_block_minute, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       one_thing = excluded.one_thing,
       time_block_hour = excluded.time_block_hour,
       time_block_minute = excluded.time_block_minute,
       updated_at = excluded.updated_at`,
    date,
    oneThing,
    timeBlockHour ?? null,
    timeBlockMinute ?? null,
    ts,
    ts
  );
}

export async function setDailyCompleted(db, date, completed) {
  await db.runAsync(
    'UPDATE daily_entries SET completed = ?, completed_at = ?, updated_at = ? WHERE date = ?',
    completed ? 1 : 0,
    completed ? nowIso() : null,
    nowIso(),
    date
  );
}

export async function listDailyEntries(db, { limit = 60 } = {}) {
  return db.getAllAsync('SELECT * FROM daily_entries ORDER BY date DESC LIMIT ?', limit);
}

export async function listDailyEntriesInRange(db, fromKey, toKey) {
  return db.getAllAsync(
    'SELECT * FROM daily_entries WHERE date >= ? AND date <= ? ORDER BY date ASC',
    fromKey,
    toKey
  );
}

export async function countCompletedEntries(db) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM daily_entries WHERE completed = 1'
  );
  return row?.count ?? 0;
}

export async function recentCompletionMap(db, days = 90) {
  const rows = await db.getAllAsync(
    'SELECT date, completed FROM daily_entries ORDER BY date DESC LIMIT ?',
    days
  );
  return rows;
}

// --- Settings ---

export async function getSetting(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    String(value)
  );
}

export async function getAllSettings(db) {
  const rows = await db.getAllAsync('SELECT * FROM settings');
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}
