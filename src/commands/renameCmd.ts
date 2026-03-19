import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { updatePromptTitle } from '../db/queries.js';

export async function renameCommand(id: string, newTitle: string) {
  const row = getDb().prepare('SELECT id, title, tags FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string, tags: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const res = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Rename to '${chalk.bold(newTitle)}'?`,
      default: false
    }
  ]);

  if (!res.confirm) {
    console.log(chalk.dim('\nCancelled.'));
    return;
  }

  const success = updatePromptTitle(row.id, newTitle);
  
  if (success) {
    const shortId = row.id.split('-')[0];
    const tagDisplay = row.tags ? `[${row.tags.split(',')[0].trim()}] ` : '';
    console.log(`\n${chalk.green('✓')} Prompt ${tagDisplay}${newTitle} #${shortId} renamed successfully`);
  } else {
    console.log(`\n${chalk.red('⚠')} Failed to rename prompt.`);
  }
}
