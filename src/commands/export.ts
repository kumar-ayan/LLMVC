import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getAllPrompts, getLatestVersion } from '../db/queries.js';
import { getVaultDir } from '../utils/config.js';

export async function exportCommand(options: { json?: boolean, md?: boolean }) {
  const prompts = getAllPrompts();

  if (prompts.length === 0) {
    console.log(chalk.yellow('⚠ No prompts to export.'));
    return;
  }

  const exportDir = path.join(getVaultDir(), 'exports');
  
  if (options.json) {
    const backupData = prompts.map(p => {
      const v = getLatestVersion(p.id);
      return {
        ...p,
        latest_text: v ? v.text : ''
      };
    });

    const file = path.join(exportDir, `promptvault_export_${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`\n${chalk.green('✓')} Exported ${prompts.length} prompts to JSON:`);
    console.log(chalk.cyan(file));
    return;
  }

  if (options.md) {
    let mdOutput = '# PromptVault Export\n\n';
    
    for (const p of prompts) {
      const v = getLatestVersion(p.id);
      mdOutput += `## ${p.title} (v${p.latest_version})\n`;
      if (p.description) mdOutput += `*${p.description}*\n`;
      if (p.tags) mdOutput += `**Tags:** ${p.tags}\n`;
      mdOutput += `\n\`\`\`text\n${v ? v.text : ''}\n\`\`\`\n\n---\n\n`;
    }

    const file = path.join(exportDir, `promptvault_export_${Date.now()}.md`);
    fs.writeFileSync(file, mdOutput, 'utf-8');
    console.log(`\n${chalk.green('✓')} Exported ${prompts.length} prompts to Markdown:`);
    console.log(chalk.cyan(file));
    return;
  }

  console.log(chalk.red('⚠ Please specify either --json or --md'));
}
