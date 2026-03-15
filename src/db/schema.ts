// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { getVaultDir, ensureVaultExists } from '../utils/config.js';

let db: any = null;

export function getDb(): any {
  if (db) return db;

  ensureVaultExists();
  const vaultDir = getVaultDir();
  const dbPath = path.join(vaultDir, 'vault.db');
  
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      version_num INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      clarity REAL,
      specificity REAL,
      context_score REAL,
      instruction_quality REAL,
      overall REAL,
      issues_json TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (version_id) REFERENCES prompt_versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      input TEXT NOT NULL,
      expected_output TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eval_runs (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      ran_at TEXT NOT NULL DEFAULT (datetime('now')),
      overall_score REAL DEFAULT NULL,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES prompt_versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eval_results (
      id TEXT PRIMARY KEY,
      eval_run_id TEXT NOT NULL,
      test_case_id TEXT NOT NULL,
      output TEXT DEFAULT '',
      score REAL DEFAULT NULL,
      reasoning TEXT DEFAULT '',
      FOREIGN KEY (eval_run_id) REFERENCES eval_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_versions_prompt ON prompt_versions(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_version ON analyses(version_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_prompt ON test_cases(prompt_id);
  `);

  return db;
}
