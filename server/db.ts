/**
 * SQLite database: one file, WAL mode, foreign keys on, versioned migrations via PRAGMA user_version.
 * Add a migration by appending to MIGRATIONS; never edit one that has shipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const STATUS_CHECK = `CHECK (status IN ('new','contacted','visit','quoted','booked','declined','archived'))`;
const SPACE_CHECK = `CHECK (space IN ('indoor','outdoor','both'))`;

export const MIGRATIONS: string[] = [
  // 1: initial schema
  `
  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX sessions_admin ON sessions(admin_id);
  CREATE INDEX sessions_expires ON sessions(expires_at);

  CREATE TABLE inquiries (
    id INTEGER PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'new' ${STATUS_CHECK},
    event_type TEXT NOT NULL,
    event_type_other TEXT,
    date TEXT NOT NULL,
    alt_date TEXT,
    start_time TEXT NOT NULL,
    hours INTEGER NOT NULL,
    space TEXT NOT NULL ${SPACE_CHECK},
    guests INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    contact_preference TEXT NOT NULL CHECK (contact_preference IN ('email','phone','text')),
    message TEXT,
    wants_visit INTEGER NOT NULL DEFAULT 0,
    visit_notes TEXT,
    estimate_json TEXT NOT NULL,
    estimate_total INTEGER NOT NULL,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX inquiries_status ON inquiries(status);
  CREATE INDEX inquiries_date ON inquiries(date);
  CREATE INDEX inquiries_created ON inquiries(created_at);
  CREATE INDEX inquiries_ip ON inquiries(ip_hash, created_at);

  CREATE TABLE inquiry_notes (
    id INTEGER PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX inquiry_notes_inquiry ON inquiry_notes(inquiry_id);

  CREATE TABLE inquiry_events (
    id INTEGER PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('created','status','note','email','block')),
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX inquiry_events_inquiry ON inquiry_events(inquiry_id);

  CREATE TABLE blocks (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    space TEXT NOT NULL ${SPACE_CHECK},
    kind TEXT NOT NULL CHECK (kind IN ('booked','held','closed')),
    label TEXT NOT NULL DEFAULT '',
    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
  );
  CREATE INDEX blocks_date ON blocks(date);
  CREATE INDEX blocks_inquiry ON blocks(inquiry_id);

  CREATE TABLE email_log (
    id INTEGER PRIMARY KEY,
    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    to_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent','outbox','failed')),
    transport TEXT NOT NULL,
    message_id TEXT,
    location TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX email_log_inquiry ON email_log(inquiry_id);
  `,
  // 2: form token nonces already used, so a retried request returns the inquiry it created
  // instead of creating a duplicate; and a faster count of recent emails by kind
  `
  CREATE TABLE form_token_uses (
    nonce TEXT PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    body_hash TEXT NOT NULL,
    used_at TEXT NOT NULL
  );
  CREATE INDEX form_token_uses_used ON form_token_uses(used_at);
  CREATE INDEX email_log_kind_created ON email_log(kind, created_at);
  `,
];

export function migrate(db: Db): number {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > MIGRATIONS.length) {
    throw new Error(`Database schema version ${current} is newer than this server (${MIGRATIONS.length}). Upgrade the server.`);
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return MIGRATIONS.length;
}

export function openDatabase(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}
