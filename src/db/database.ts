import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  database = await SQLite.openDatabaseAsync('conta-lanche.db');
  await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await migrate(database);
  return database;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.withTransactionAsync(async () => {
      // Migration 001: core domain tables and indexes.
      await db.execAsync(`
        CREATE TABLE vendors (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, contact TEXT, observation TEXT,
          active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE purchases (
          id TEXT PRIMARY KEY NOT NULL, vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
          description TEXT, observation TEXT, purchase_date TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
          photo_path TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')),
          payment_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY NOT NULL, vendor_id TEXT NOT NULL REFERENCES vendors(id), reference_period TEXT NOT NULL,
          payment_date TEXT NOT NULL, total_cents INTEGER NOT NULL, observation TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE payment_purchases (
          payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
          purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
          PRIMARY KEY(payment_id, purchase_id), UNIQUE(purchase_id)
        );
        CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE non_working_days (
          id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('holiday','non_working'))
        );
        CREATE INDEX idx_purchases_date ON purchases(purchase_date);
        CREATE INDEX idx_purchases_vendor ON purchases(vendor_id);
        CREATE INDEX idx_purchases_status ON purchases(payment_status);
        PRAGMA user_version = 1;
      `);
    });
  }
  if (version < 2) {
    // Migration 002: payment period lookup.
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(reference_period); PRAGMA user_version = 2;');
  }
  if (version < 3) {
    // Migration 003: optional Pix key per seller.
    await db.execAsync('ALTER TABLE vendors ADD COLUMN pix_key TEXT; PRAGMA user_version = 3;');
  }
}

export async function resetDatabaseForTests() {
  database = null;
}
