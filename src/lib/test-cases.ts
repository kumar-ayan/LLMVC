import { getDb } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface TestCase {
  id: string;
  prompt_id: string;
  name: string;
  input: string;
  expected_output: string;
  created_at: string;
}

export function createTestCase(
  promptId: string,
  name: string,
  input: string,
  expectedOutput: string
): TestCase {
  const db = getDb();
  const id = uuidv4();

  db.prepare(
    "INSERT INTO test_cases (id, prompt_id, name, input, expected_output) VALUES (?, ?, ?, ?, ?)"
  ).run(id, promptId, name, input, expectedOutput);

  return getTestCaseById(id)!;
}

export function getTestCases(promptId: string): TestCase[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM test_cases WHERE prompt_id = ? ORDER BY created_at ASC")
    .all(promptId) as TestCase[];
}

export function getTestCaseById(id: string): TestCase | null {
  const db = getDb();
  const tc = db.prepare("SELECT * FROM test_cases WHERE id = ?").get(id) as TestCase | undefined;
  return tc ?? null;
}

export function deleteTestCase(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM test_cases WHERE id = ?").run(id);
  return result.changes > 0;
}
