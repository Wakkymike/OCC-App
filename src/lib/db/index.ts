import Database from 'better-sqlite3';
import path from 'path';
import { initSchema } from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'occ.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    _db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read performance
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Initialize schema
    initSchema(_db);
  }
  return _db;
}
