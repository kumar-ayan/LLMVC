import { getDb } from './schema.js';
import crypto from 'crypto';

export function uuid(): string {
  return crypto.randomUUID();
}

// ------ PROMPTS ------

export interface PromptRow {
  id: string;
  title: string;
  description: string;
  tags: string;
  created_at: string;
}

export interface PromptWithMeta extends PromptRow {
  latest_version: number;
  latest_score: number | null;
}

export interface VaultCounts {
  prompt_count: number;
  version_count: number;
  eval_run_count: number;
}

export interface PromptScoreSummary {
  id: string;
  title: string;
  latest_version: number;
  latest_score: number | null;
}

export interface ImprovedPromptSummary {
  id: string;
  title: string;
  first_score: number;
  latest_score: number;
}

export function createPrompt(title: string, description: string, tags: string, initialText: string): string {
  const db = getDb();
  const promptId = uuid();
  const versionId = uuid();

  const insertPrompt = db.prepare('INSERT INTO prompts (id, title, description, tags) VALUES (?, ?, ?, ?)');
  const insertVersion = db.prepare('INSERT INTO prompt_versions (id, prompt_id, version_num, text) VALUES (?, ?, 1, ?)');

  // node:sqlite currently doesn't have a `.transaction()` wrapper built-in, so do it manually:
  db.exec('BEGIN EXCLUSIVE TRANSACTION');
  try {
    insertPrompt.run(promptId, title, description, tags);
    insertVersion.run(versionId, promptId, initialText);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return promptId;
}

export function getAllPrompts(): PromptWithMeta[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.*,
           COALESCE(MAX(v.version_num), 0) as latest_version,
           (SELECT overall FROM analyses a WHERE a.version_id = (
              SELECT id FROM prompt_versions WHERE prompt_id = p.id ORDER BY version_num DESC LIMIT 1
           ) ORDER BY created_at DESC LIMIT 1) as latest_score
    FROM prompts p
    LEFT JOIN prompt_versions v ON p.id = v.prompt_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all() as PromptWithMeta[];
}

export function getVaultCounts(): VaultCounts {
  const db = getDb();
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM prompts) AS prompt_count,
      (SELECT COUNT(*) FROM prompt_versions) AS version_count,
      (SELECT COUNT(*) FROM eval_runs) AS eval_run_count
  `).get() as VaultCounts;
}

export function getLatestPromptScores(): PromptScoreSummary[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM (
      SELECT
        p.id,
        p.title,
        COALESCE((SELECT MAX(version_num) FROM prompt_versions WHERE prompt_id = p.id), 0) AS latest_version,
        (
          SELECT a.overall
          FROM analyses a
          JOIN prompt_versions v ON v.id = a.version_id
          WHERE v.prompt_id = p.id
          ORDER BY v.version_num DESC, a.created_at DESC
          LIMIT 1
        ) AS latest_score
      FROM prompts p
    )
    ORDER BY latest_score DESC, title ASC
  `).all() as PromptScoreSummary[];
}

export function getMostImprovedPrompt(): ImprovedPromptSummary | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM (
      SELECT
        p.id,
        p.title,
        (
          SELECT a.overall
          FROM analyses a
          JOIN prompt_versions v ON v.id = a.version_id
          WHERE v.prompt_id = p.id AND v.version_num = 1
          ORDER BY a.created_at DESC
          LIMIT 1
        ) AS first_score,
        (
          SELECT a.overall
          FROM analyses a
          JOIN prompt_versions v ON v.id = a.version_id
          WHERE v.prompt_id = p.id
          ORDER BY v.version_num DESC, a.created_at DESC
          LIMIT 1
        ) AS latest_score
      FROM prompts p
    )
    WHERE first_score IS NOT NULL AND latest_score IS NOT NULL
    ORDER BY (latest_score - first_score) DESC, latest_score DESC, title ASC
    LIMIT 1
  `).get() as ImprovedPromptSummary | undefined;

  return row || null;
}

export function getPrompt(id: string): PromptRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as PromptRow | undefined;
  return row || null;
}

export function searchPrompts(query: string): PromptWithMeta[] {
  const db = getDb();
  const lowerQuery = `%${query.toLowerCase()}%`;
  return db.prepare(`
    SELECT p.*,
           COALESCE(MAX(v.version_num), 0) as latest_version,
           (SELECT overall FROM analyses a WHERE a.version_id = (
              SELECT id FROM prompt_versions WHERE prompt_id = p.id ORDER BY version_num DESC LIMIT 1
           ) ORDER BY created_at DESC LIMIT 1) as latest_score
    FROM prompts p
    LEFT JOIN prompt_versions v ON p.id = v.prompt_id
    WHERE LOWER(p.title) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.tags) LIKE ? OR LOWER(v.text) LIKE ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(lowerQuery, lowerQuery, lowerQuery, lowerQuery) as PromptWithMeta[];
}

export function deletePrompt(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
  // @ts-ignore
  return (res.changes || 0) > 0;
}

export function updatePromptTitle(id: string, newTitle: string): boolean {
  const db = getDb();
  const res = db.prepare('UPDATE prompts SET title = ? WHERE id = ?').run(newTitle, id);
  // @ts-ignore
  return (res.changes || 0) > 0;
}

// ------ VERSIONS ------

export interface VersionRow {
  id: string;
  prompt_id: string;
  version_num: number;
  text: string;
  created_at: string;
}

export function createVersion(promptId: string, text: string): string {
  const db = getDb();
  const versionId = uuid();
  
  const maxQuery = db.prepare('SELECT COALESCE(MAX(version_num), 0) as max_v FROM prompt_versions WHERE prompt_id = ?').get(promptId) as { max_v: number };
  const newVersion = maxQuery.max_v + 1;

  db.prepare('INSERT INTO prompt_versions (id, prompt_id, version_num, text) VALUES (?, ?, ?, ?)')
    .run(versionId, promptId, newVersion, text);
    
  return versionId;
}

export function getVersions(promptId: string): VersionRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_num DESC').all(promptId) as VersionRow[];
}

export function getVersionByNumber(promptId: string, versionNum: number): VersionRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? AND version_num = ?').get(promptId, versionNum) as VersionRow | undefined;
  return row || null;
}

export function getLatestVersion(promptId: string): VersionRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_num DESC LIMIT 1').get(promptId) as VersionRow | undefined;
  return row || null;
}

// ------ ANALYSES ------

export interface AnalysisRow {
  id: string;
  version_id: string;
  clarity: number;
  specificity: number;
  context_score: number;
  instruction_quality: number;
  overall: number;
  issues_json: string;
  summary: string;
  created_at: string;
}

export function saveAnalysis(versionId: string, data: Omit<AnalysisRow, 'id' | 'version_id' | 'created_at'>): void {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO analyses (id, version_id, clarity, specificity, context_score, instruction_quality, overall, issues_json, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, versionId, data.clarity, data.specificity, data.context_score, data.instruction_quality, data.overall, data.issues_json, data.summary);
}

export function getLatestAnalysis(versionId: string): AnalysisRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM analyses WHERE version_id = ? ORDER BY created_at DESC LIMIT 1').get(versionId) as AnalysisRow | undefined;
  return row || null;
}

// ------ TEST CASES & EVALS ------

export interface TestCaseRow {
  id: string;
  prompt_id: string;
  input: string;
  expected_output: string;
}

export function addTestCase(promptId: string, input: string, expectedOutput: string): void {
  const db = getDb();
  db.prepare('INSERT INTO test_cases (id, prompt_id, input, expected_output) VALUES (?, ?, ?, ?)').run(uuid(), promptId, input, expectedOutput);
}

export function getTestCases(promptId: string): TestCaseRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM test_cases WHERE prompt_id = ? ORDER BY created_at ASC').all(promptId) as TestCaseRow[];
}

export function createEvalRun(promptId: string, versionId: string): string {
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO eval_runs (id, prompt_id, version_id) VALUES (?, ?, ?)').run(id, promptId, versionId);
  return id;
}

export function saveEvalResult(evalRunId: string, testCaseId: string, output: string, score: number, reasoning: string): void {
  const db = getDb();
  db.prepare('INSERT INTO eval_results (id, eval_run_id, test_case_id, output, score, reasoning) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), evalRunId, testCaseId, output, score, reasoning);
}

export function updateEvalRunScore(evalRunId: string, avgScore: number): void {
  const db = getDb();
  db.prepare('UPDATE eval_runs SET overall_score = ? WHERE id = ?').run(avgScore, evalRunId);
}

export function getEvalResults(evalRunId: string): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, t.input, t.expected_output
    FROM eval_results r
    JOIN test_cases t ON r.test_case_id = t.id
    WHERE r.eval_run_id = ?
  `).all(evalRunId) as any[];
}

export function getEvalRuns(promptId: string): any[] {
  const db = getDb();
  return db.prepare('SELECT * FROM eval_runs WHERE prompt_id = ? ORDER BY ran_at DESC').all(promptId) as any[];
}
