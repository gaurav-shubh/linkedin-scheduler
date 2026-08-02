export async function initializeDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS goals (
      level TEXT PRIMARY KEY NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS periods (
      level TEXT NOT NULL,
      period_key TEXT NOT NULL,
      one_thing TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (level, period_key)
    );

    CREATE TABLE IF NOT EXISTS daily_entries (
      date TEXT PRIMARY KEY NOT NULL,
      one_thing TEXT NOT NULL DEFAULT '',
      time_block TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);
}
