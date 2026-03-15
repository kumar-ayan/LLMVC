import chalk from 'chalk';
import { getAllPrompts } from '../db/queries.js';
import { printPromptsTable } from '../ui/table.js';

export async function listCommand(options: { tag?: string }) {
  let prompts = getAllPrompts();

  if (options.tag) {
    const searchTag = options.tag.toLowerCase();
    prompts = prompts.filter(p => p.tags.split(',').map(t => t.trim()).includes(searchTag));
    console.log(chalk.dim(`\nFiltering by tag: ${chalk.blue(searchTag)}`));
  }

  if (prompts.length === 0) {
    console.log(`\n${chalk.yellow('⚠ No prompts found.')} Use "pv add" or "pv import" to get started.\n`);
    return;
  }

  printPromptsTable(prompts);
}
