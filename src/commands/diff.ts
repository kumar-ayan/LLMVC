import chalk from 'chalk';
import { getVersionByNumber } from '../db/queries.js';
import { printWordDiff } from '../ui/diffView.js';

export async function diffCommand(id: string, options: { v1: string, v2: string }) {
  const db = require('../db/schema.js').getDb();
  const row = db.prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const version1Num = parseInt(options.v1, 10);
  const version2Num = parseInt(options.v2, 10);

  if (isNaN(version1Num) || isNaN(version2Num)) {
    console.log(chalk.red('⚠ v1 and v2 must be valid numbers.'));
    return;
  }

  const v1 = getVersionByNumber(promptId, version1Num);
  const v2 = getVersionByNumber(promptId, version2Num);

  if (!v1) {
    console.log(chalk.red(`⚠ Version ${version1Num} not found for this prompt.`));
    return;
  }
  if (!v2) {
    console.log(chalk.red(`⚠ Version ${version2Num} not found for this prompt.`));
    return;
  }

  console.log(`\nDiffing ${chalk.bold(row.title)}`);
  console.log(`${chalk.red.strikethrough(`v${v1.version_num}`)} -> ${chalk.green(`v${v2.version_num}`)}`);
  
  printWordDiff(v1.text, v2.text);
}
