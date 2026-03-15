import { getDb } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface Version {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string;
  message: string;
  created_at: string;
}

export function createVersion(promptId: string, content: string, message: string): Version {
  const db = getDb();
  const id = uuidv4();

  const maxVersion = db
    .prepare("SELECT COALESCE(MAX(version_number), 0) as max_v FROM versions WHERE prompt_id = ?")
    .get(promptId) as { max_v: number };

  const newVersionNumber = maxVersion.max_v + 1;

  db.prepare(
    "INSERT INTO versions (id, prompt_id, version_number, content, message) VALUES (?, ?, ?, ?, ?)"
  ).run(id, promptId, newVersionNumber, content, message);

  db.prepare("UPDATE prompts SET updated_at = datetime('now') WHERE id = ?").run(promptId);

  return getVersionById(id)!;
}

export function getVersions(promptId: string): Version[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM versions WHERE prompt_id = ? ORDER BY version_number DESC")
    .all(promptId) as Version[];
}

export function getVersionById(id: string): Version | null {
  const db = getDb();
  const version = db.prepare("SELECT * FROM versions WHERE id = ?").get(id) as Version | undefined;
  return version ?? null;
}

export function getVersionByNumber(promptId: string, versionNumber: number): Version | null {
  const db = getDb();
  const version = db
    .prepare("SELECT * FROM versions WHERE prompt_id = ? AND version_number = ?")
    .get(promptId, versionNumber) as Version | undefined;
  return version ?? null;
}

export function rollbackToVersion(promptId: string, targetVersionNumber: number): Version | null {
  const db = getDb();
  const targetVersion = getVersionByNumber(promptId, targetVersionNumber);
  if (!targetVersion) return null;

  // Create a new version with the content from the target version
  return createVersion(
    promptId,
    targetVersion.content,
    `Rollback to v${targetVersionNumber}`
  );
}
