export const LATEST_VERSION = 2;

/**
 * Versioned migrations keyed on SQLite's own `user_version`. Each step runs exactly
 * once, in order, and only for databases below that version — so an existing install
 * upgrades without losing data and a fresh install lands on the latest schema.
 */
const MIGRATIONS = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
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
    },
  },
  {
    // Structured time block, so a reminder can actually be scheduled for it. The old
    // free-text `time_block` column is left in place; existing notes stay readable and
    // are carried into exports.
    version: 2,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE daily_entries ADD COLUMN time_block_hour INTEGER;
        ALTER TABLE daily_entries ADD COLUMN time_block_minute INTEGER;
      `);
    },
  },
];

export async function initializeDatabase(db) {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (version >= migration.version) continue;
    await migration.up(db);
    // PRAGMA doesn't accept bound parameters; the value is a trusted literal here.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    version = migration.version;
  }
}
