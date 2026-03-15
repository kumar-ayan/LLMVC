import chalk from 'chalk';
import * as Diff from 'diff';

export function printWordDiff(oldText: string, newText: string): void {
  const diff = Diff.diffWords(oldText, newText);

  let output = '';
  for (const part of diff) {
    if (part.added) {
      output += chalk.green(part.value);
    } else if (part.removed) {
      output += chalk.red.strikethrough(part.value);
    } else {
      output += chalk.gray(part.value);
    }
  }

  console.log('\n' + output + '\n');
}

export function printFixComparison(changes: { description: string; reason: string }[]): void {
  console.log(chalk.bold('\nApplied Changes:'));
  for (const change of changes) {
    console.log(`  ${chalk.green('✓')} ${change.description}`);
    console.log(`    ${chalk.dim('↳ ' + change.reason)}`);
  }
  console.log('');
}
