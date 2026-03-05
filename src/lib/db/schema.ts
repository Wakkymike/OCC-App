import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL DEFAULT '',
      passwordHash TEXT NOT NULL,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      isContentCreator INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 0,
      passwordChangeRequired INTEGER NOT NULL DEFAULT 0,
      forceSignOut INTEGER NOT NULL DEFAULT 0,
      icalUrl TEXT DEFAULT NULL,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      invitedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS monitored_hazards (
      id TEXT PRIMARY KEY,
      hazardId TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('height', 'width', 'both', 'manual')),
      value TEXT NOT NULL,
      locationLat REAL NOT NULL,
      locationLng REAL NOT NULL,
      geofenceCenterLat REAL,
      geofenceCenterLng REAL,
      description TEXT NOT NULL DEFAULT '',
      radius REAL NOT NULL DEFAULT 50,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS active_alerts (
      id TEXT PRIMARY KEY,
      busId TEXT NOT NULL,
      fleetNumber TEXT NOT NULL,
      service TEXT NOT NULL,
      hazardId TEXT NOT NULL,
      monitorId TEXT NOT NULL,
      hazardValue TEXT NOT NULL DEFAULT '',
      hazardDescription TEXT NOT NULL DEFAULT '',
      isAcknowledged INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      acknowledgedBy TEXT,
      acknowledgedAt TEXT,
      historyDocId TEXT
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id TEXT PRIMARY KEY,
      busId TEXT NOT NULL,
      fleetNumber TEXT NOT NULL,
      service TEXT NOT NULL,
      hazardId TEXT NOT NULL,
      monitorId TEXT NOT NULL,
      hazardValue TEXT NOT NULL DEFAULT '',
      hazardDescription TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      acknowledgedAt TEXT,
      acknowledgedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS network_updates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      isVisible INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      callTime TEXT NOT NULL DEFAULT '',
      employeeNumber TEXT NOT NULL DEFAULT '',
      fleetNumber TEXT NOT NULL DEFAULT '',
      runningBoard TEXT NOT NULL DEFAULT '',
      serviceNumber TEXT NOT NULL DEFAULT '',
      depot TEXT NOT NULL DEFAULT '',
      phoneNumber TEXT NOT NULL DEFAULT '',
      timeFrom TEXT NOT NULL DEFAULT '',
      timeTo TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      isTeamsRelated INTEGER NOT NULL DEFAULT 0,
      isTicketerRelated INTEGER NOT NULL DEFAULT 0,
      isEPMRelated INTEGER NOT NULL DEFAULT 0,
      isIRRelated INTEGER NOT NULL DEFAULT 0,
      isTSIRelated INTEGER NOT NULL DEFAULT 0,
      isDriverReportRelated INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS driver_hours (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_call_logs_userId ON call_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_call_logs_createdAt ON call_logs(createdAt);
    CREATE INDEX IF NOT EXISTS idx_active_alerts_isAcknowledged ON active_alerts(isAcknowledged);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
  `);
}
