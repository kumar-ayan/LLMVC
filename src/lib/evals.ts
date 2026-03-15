import { getDb } from "./db";
import { v4 as uuidv4 } from "uuid";
import { getTestCases } from "./test-cases";
import { getVersionById } from "./versions";
import { generateCompletion, judgeOutput, type LLMConfig } from "./llm";

export interface EvalRun {
  id: string;
  prompt_id: string;
  version_id: string;
  status: string;
  avg_score: number | null;
  created_at: string;
}

export interface EvalResult {
  id: string;
  eval_run_id: string;
  test_case_id: string;
  test_case_name?: string;
  test_case_input?: string;
  expected_output?: string;
  output: string;
  score: number | null;
  judge_reasoning: string;
}

export function getEvalRuns(promptId: string): EvalRun[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM eval_runs WHERE prompt_id = ? ORDER BY created_at DESC")
    .all(promptId) as EvalRun[];
}

export function getEvalRun(runId: string): EvalRun | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM eval_runs WHERE id = ?").get(runId) as EvalRun) ?? null;
}

export function getEvalResults(runId: string): EvalResult[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT er.*, tc.name as test_case_name, tc.input as test_case_input, tc.expected_output
       FROM eval_results er 
       LEFT JOIN test_cases tc ON tc.id = er.test_case_id
       WHERE er.eval_run_id = ? 
       ORDER BY tc.name ASC`
    )
    .all(runId) as EvalResult[];
}

export async function runEval(
  promptId: string,
  versionId: string,
  config: LLMConfig
): Promise<EvalRun> {
  const db = getDb();
  const runId = uuidv4();

  const version = getVersionById(versionId);
  if (!version) throw new Error("Version not found");

  const testCases = getTestCases(promptId);
  if (testCases.length === 0) throw new Error("No test cases found for this prompt");

  // Create eval run
  db.prepare(
    "INSERT INTO eval_runs (id, prompt_id, version_id, status) VALUES (?, ?, ?, 'running')"
  ).run(runId, promptId, versionId);

  try {
    const scores: number[] = [];

    for (const tc of testCases) {
      const resultId = uuidv4();
      let output = "";
      let score = 0;
      let reasoning = "";

      try {
        // Generate output using the prompt version
        output = await generateCompletion(version.content, tc.input, config);

        // Judge the output
        if (tc.expected_output) {
          const judgment = await judgeOutput(tc.input, tc.expected_output, output, config);
          score = judgment.score;
          reasoning = judgment.reasoning;
        } else {
          score = -1;
          reasoning = "No expected output provided — skipped judging";
        }
      } catch (err) {
        reasoning = `Error: ${err instanceof Error ? err.message : String(err)}`;
        score = 0;
      }

      if (score >= 0) scores.push(score);

      db.prepare(
        "INSERT INTO eval_results (id, eval_run_id, test_case_id, output, score, judge_reasoning) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(resultId, runId, tc.id, output, score >= 0 ? score : null, reasoning);
    }

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    db.prepare("UPDATE eval_runs SET status = 'completed', avg_score = ? WHERE id = ?").run(
      avgScore,
      runId
    );
  } catch (err) {
    db.prepare("UPDATE eval_runs SET status = 'failed' WHERE id = ?").run(runId);
    throw err;
  }

  return getEvalRun(runId)!;
}
