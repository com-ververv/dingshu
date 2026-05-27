import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.join('src', 'database', 'migrations');

type MigrationRow = {
  version: string;
};

function getMigrationsDirectory(): string {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, MIGRATIONS_DIR),
    path.join(path.dirname(appPath), MIGRATIONS_DIR),
    path.join(appPath, '..', MIGRATIONS_DIR),
  ];

  const migrationsDirectory = candidates.find((candidate) => fs.existsSync(candidate));
  if (!migrationsDirectory) {
    return candidates[0];
  }
  return migrationsDirectory;
}

function ensureSchemaMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
}

function listMigrationFiles(): string[] {
  const migrationsDirectory = getMigrationsDirectory();
  if (!fs.existsSync(migrationsDirectory)) {
    throw new Error(`Database migrations directory not found: ${migrationsDirectory}`);
  }

  return fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
    .sort();
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as MigrationRow[];
  return new Set(rows.map((row) => row.version));
}

export function runDatabaseMigrations(db: Database.Database): void {
  ensureSchemaMigrationsTable(db);

  const appliedMigrations = getAppliedMigrations(db);
  const migrationsDirectory = getMigrationsDirectory();
  const migrationFiles = listMigrationFiles();

  for (const fileName of migrationFiles) {
    const version = fileName.replace(/\.sql$/, '');
    if (appliedMigrations.has(version)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, fileName), 'utf-8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, Date.now());
    });

    console.log(`Applying database migration: ${version}`);
    applyMigration();
  }
}
