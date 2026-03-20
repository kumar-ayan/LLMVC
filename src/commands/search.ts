import chalk from 'chalk';
import { searchPrompts } from '../db/queries.js';
import { printPromptsTable } from '../ui/table.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

export async function searchCommand(query: string) {
  if (!query || query.trim().length === 0) {
    console.log(chalk.red('⚠ Please provide a search keyword.'));
    return;
  }

  const results = searchPrompts(query);

  console.log(chalk.dim(`\nSearching for "${chalk.white(sanitizeForTerminal(query))}"...`));

  if (results.length === 0) {
    console.log(`\n${chalk.yellow('⚠ No matches found.')}\n`);
    return;
  }

  printPromptsTable(results);
}
