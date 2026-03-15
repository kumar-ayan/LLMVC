import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getLatestVersion, createVersion } from '../db/queries.js';
import { fixPrompt } from '../ai/fixer.js';
import { printWordDiff, printFixComparison } from '../ui/diffView.js';

export async function fixCommand(id: string) {
  const db = require('../db/schema.js').getDb();
  const row = db.prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const version = getLatestVersion(promptId);

  if (!version) {
    console.log(chalk.red('⚠ Error loading prompt details.'));
    return;
  }

  console.log(`Fixing: ${chalk.bold(row.title)} (v${version.version_num})`);

  const spinner = ora('AI is rewriting and improving your prompt...').start();
  let fixResult;
  try {
    fixResult = await fixPrompt(version.text);
    spinner.succeed('Rewrite complete');
  } catch (err: any) {
    spinner.fail('Fixation failed');
    console.log(chalk.red(`⚠ ${err.message}`));
    return;
  }

  printWordDiff(version.text, fixResult.improvedPrompt);
  printFixComparison(fixResult.changes);

  const res = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'accept',
      message: 'Accept fix? (saves as new version)',
      default: true
    }
  ]);

  if (res.accept) {
    createVersion(promptId, fixResult.improvedPrompt);
    console.log(`\n${chalk.green('✓')} Improvement saved as a new version.`);
  } else {
    console.log(chalk.dim('\nFix discarded.'));
  }
}
