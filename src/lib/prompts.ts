import { getDb } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface Prompt {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  latest_version?: number;
  version_count?: number;
}

export function createPrompt(name: string, description: string, initialContent: string): Prompt {
  const db = getDb();
  const id = uuidv4();
  const versionId = uuidv4();

  const insertPrompt = db.prepare(
    "INSERT INTO prompts (id, name, description) VALUES (?, ?, ?)"
  );
  const insertVersion = db.prepare(
    "INSERT INTO versions (id, prompt_id, version_number, content, message) VALUES (?, ?, 1, ?, 'Initial version')"
  );

  const txn = db.transaction(() => {
    insertPrompt.run(id, name, description);
    insertVersion.run(versionId, id, initialContent);
  });
  txn();

  return getPromptById(id)!;
}

export function getPrompts(): Prompt[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, 
        COALESCE(MAX(v.version_number), 0) as latest_version,
        COUNT(v.id) as version_count
       FROM prompts p 
       LEFT JOIN versions v ON v.prompt_id = p.id 
       GROUP BY p.id 
       ORDER BY p.updated_at DESC`
    )
    .all() as Prompt[];
}

export function getPromptById(id: string): Prompt | null {
  const db = getDb();
  const prompt = db
    .prepare(
      `SELECT p.*, 
        COALESCE(MAX(v.version_number), 0) as latest_version,
        COUNT(v.id) as version_count
       FROM prompts p 
       LEFT JOIN versions v ON v.prompt_id = p.id 
       WHERE p.id = ?
       GROUP BY p.id`
    )
    .get(id) as Prompt | undefined;
  return prompt ?? null;
}

export function deletePrompt(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM prompts WHERE id = ?").run(id);
  return result.changes > 0;
}
