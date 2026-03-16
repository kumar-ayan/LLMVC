import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getVersionByNumber, createVersion } from '../db/queries.js';

export async function rollbackCommand(id: string, options: { to: string }) {

  const row = getDb().prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const targetNum = parseInt(options.to, 10);

  if (isNaN(targetNum)) {
    console.log(chalk.red('⚠ Custom version number must be valid.'));
    return;
  }

  const targetVersion = getVersionByNumber(promptId, targetNum);

  if (!targetVersion) {
    console.log(chalk.red(`⚠ Version ${targetNum} not found for this prompt.`));
    return;
  }

  const res = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Roll back "${chalk.bold(row.title)}" to v${targetNum}? (This creates a new version preserving history)`,
      default: true
    }
  ]);

  if (!res.confirm) {
    console.log(chalk.dim('\nCancelled.'));
    return;
  }

  const newVersionId = createVersion(promptId, targetVersion.text);

  if (newVersionId) {
    console.log(`\n${chalk.green('✓')} Rolled back successfully (created new latest version).`);
  } else {
    console.log(`\n${chalk.red('⚠')} Failed to rollback.`);
  }
}
