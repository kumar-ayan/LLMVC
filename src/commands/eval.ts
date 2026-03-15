import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { getLatestVersion, getTestCases, addTestCase, createEvalRun, saveEvalResult, updateEvalRunScore, getPrompt } from '../db/queries.js';
import { callLLM } from '../utils/llm.js';
import { judgeOutput } from '../ai/evaluator.js';

export async function evalCommand(id: string, options: { add?: boolean, run?: boolean }) {
  const db = require('../db/schema.js').getDb();
  const row = db.prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;

  if (options.add) {
    const res = await inquirer.prompt([
      {
        type: 'editor',
        name: 'input',
        message: 'Enter test case INPUT (user message / test variables)'
      },
      {
        type: 'editor',
        name: 'expectedOutput',
        message: 'Enter EXPECTED OUTPUT (optional guidance for the judge)'
      }
    ]);

    if (!res.input.trim()) {
      console.log(chalk.red('⚠ Test input cannot be empty.'));
      return;
    }

    addTestCase(promptId, res.input.trim(), res.expectedOutput.trim());
    console.log(`\n${chalk.green('✓')} Test case added.`);
    return;
  }

  if (options.run) {
    const version = getLatestVersion(promptId);
    if (!version) return;

    const testCases = getTestCases(promptId);
    if (testCases.length === 0) {
      console.log(chalk.yellow(`⚠ No test cases found on this prompt. Run "pv eval ${id.substring(0,6)} --add" first.`));
      return;
    }

    console.log(`Running ${testCases.length} test cases on ${chalk.bold(row.title)} v${version.version_num}...\n`);

    const evalRunId = createEvalRun(promptId, version.id);
    let totalScore = 0;
    let testsRan = 0;
    let testsPassed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const spinner = ora(`Test ${i + 1}`).start();

      let output = '';
      let score = 0;
      let reason = '';

      try {
        // Run test payload through current prompt string representing SYSTEM message
        output = await callLLM(version.text, tc.input);

        // Grade output 
        const evaluation = await judgeOutput(tc.input, tc.expected_output, output);
        score = evaluation.score;
        reason = evaluation.reasoning;

        saveEvalResult(evalRunId, tc.id, output, score, reason);
        totalScore += score;
        testsRan++;

        if (score >= 7) {
          testsPassed++;
          spinner.succeed(`Test ${i + 1}  Score: ${chalk.green(score)}/10  "${chalk.dim(reason)}"`);
        } else if (score >= 5) {
          spinner.warn(`Test ${i + 1}  Score: ${chalk.yellow(score)}/10  "${chalk.dim(reason)}"`);
        } else {
          spinner.fail(`Test ${i + 1}  Score: ${chalk.red(score)}/10  "${chalk.dim(reason)}"`);
        }

      } catch (err: any) {
        spinner.fail(`Test ${i + 1}  Error: ${err.message}`);
        saveEvalResult(evalRunId, tc.id, `Error: ${err.message}`, 0, '');
      }
    }

    if (testsRan > 0) {
      const avgScore = (totalScore / testsRan) * 10; // scale 1-10 string into a total /100 equivalent if needed, or stick to raw. Wait, CLI spec says /100
      updateEvalRunScore(evalRunId, avgScore);
      console.log(chalk.dim('\n─────────────────────────────────────────'));
      console.log(`  Overall: ${chalk.bold(Math.round(avgScore))}/100  (${testsPassed}/${testsRan} passed)\n`);
    }

    return;
  }

  // Interactive Menu if neither flag is passed
  console.log(chalk.bold(`\nEval Manager for: ${row.title}\n`));
  const testCases = getTestCases(promptId);
  console.log(`Current test cases: ${chalk.cyan(testCases.length)}`);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Run Evals against latest version', value: 'run' },
        { name: 'Add a new Test Case', value: 'add' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (answers.action === 'run') {
    await evalCommand(id, { run: true });
  } else if (answers.action === 'add') {
    await evalCommand(id, { add: true });
  }
}
