import Table from 'cli-table3';
import chalk from 'chalk';
import { PromptWithMeta } from '../db/queries.js';
import { formatTimeAgo } from '../utils/time.js';
import { getScoreColor } from './scoreCard.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

export function printPromptsTable(prompts: PromptWithMeta[]): void {
  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Title'),
      chalk.cyan('Ver'),
      chalk.cyan('Score'),
      chalk.cyan('Tags'),
      chalk.cyan('Updated')
    ],
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': '  '
    },
    style: { 'padding-left': 0, 'padding-right': 0 }
  });

  for (const p of prompts) {
    const id = chalk.dim(p.id.split('-')[0]); // short id
    const safeTitle = sanitizeForTerminal(p.title);
    const safeTags = sanitizeForTerminal(p.tags);
    const title = safeTitle.length > 25 ? safeTitle.substring(0, 22) + '...' : safeTitle;
    const ver = `v${p.latest_version}`;
    
    let scoreStr = chalk.dim('-');
    if (p.latest_score !== null) {
      scoreStr = getScoreColor(p.latest_score)(p.latest_score.toString());
    }

    const tags = safeTags ? chalk.blue(safeTags.substring(0, 25)) : chalk.dim('none');
    const updated = chalk.dim(formatTimeAgo(p.created_at));

    table.push([id, title, ver, scoreStr, tags, updated]);
  }

  console.log('\n' + table.toString() + '\n');
  console.log(chalk.dim(`Total prompts: ${prompts.length}\n`));
}
