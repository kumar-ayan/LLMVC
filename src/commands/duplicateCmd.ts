import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import { duplicatePrompt } from '../db/queries.js';

export async function duplicateCommand(idPrefix: string) {
  const row = getDb().prepare('SELECT id FROM prompts WHERE id LIKE ?').get(`${idPrefix}%`) as { id: string } | undefined;

  if (!row) {
    console.log(chalk.red(`\u26A0 Prompt with ID starting with "${idPrefix}" not found.`));
    return;
  }

  try {
    const newId = duplicatePrompt(row.id);
    console.log(`\n${chalk.green('\u2713')} Prompt duplicated successfully!`);
    console.log(`New ID: ${chalk.cyan(newId.split('-')[0])}`);
  } catch (err: any) {
    console.log(chalk.red(`\u26A0 Failed to duplicate prompt: ${err.message}`));
  }
}
