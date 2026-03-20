import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { getAllPrompts, searchPrompts, getLatestVersion } from '../dist/db/queries.js';
import { normalizeOllamaUrl } from '../dist/utils/config.js';
import { fetchAndCleanWebpage } from '../dist/utils/fetch.js';
import { sanitizeForTerminal } from '../dist/utils/terminal.js';

const cwd = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message) {
  process.stdout.write(`\n> ${message}\n`);
}

function runTypeScriptBuild() {
  logStep('internal TypeScript build check');

  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    throw new Error('Unable to find tsconfig.json');
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: fileName => fileName,
      getCurrentDirectory: () => cwd,
      getNewLine: () => '\n'
    });
    process.stderr.write(formatted);
    throw new Error('TypeScript build failed');
  }

  process.stdout.write('TypeScript build passed.\n');
}

async function main() {
  runTypeScriptBuild();

  logStep('dist output exists');
  assert(fs.existsSync(path.join(cwd, 'dist', 'index.js')), 'dist/index.js was not generated');
  process.stdout.write('dist/index.js found.\n');

  logStep('prompt listing works');
  const prompts = getAllPrompts();
  assert(Array.isArray(prompts), 'getAllPrompts did not return an array');
  assert(prompts.length > 0, 'Expected at least one prompt in the local vault for smoke testing');
  process.stdout.write(`Loaded ${prompts.length} prompt(s).\n`);

  logStep('prompt search works');
  const searchResults = searchPrompts('prompt');
  assert(Array.isArray(searchResults), 'searchPrompts did not return an array');
  process.stdout.write(`Search returned ${searchResults.length} prompt(s).\n`);

  logStep('latest version lookup works');
  const latest = getLatestVersion(prompts[0].id);
  assert(latest && typeof latest.text === 'string', 'Failed to load latest prompt version');
  process.stdout.write(`Loaded latest version for ${prompts[0].id.slice(0, 8)}.\n`);

  logStep('localhost Ollama URL is allowed');
  assert(normalizeOllamaUrl('http://localhost:11434') === 'http://localhost:11434', 'localhost Ollama URL was not normalized correctly');
  process.stdout.write('localhost accepted.\n');

  logStep('remote Ollama URL is blocked by default');
  let remoteBlocked = false;
  try {
    normalizeOllamaUrl('http://example.com:11434');
  } catch (err) {
    remoteBlocked = String(err.message).includes('Remote Ollama hosts are blocked by default.');
  }
  assert(remoteBlocked, 'Remote Ollama URL was not blocked by default');
  process.stdout.write('remote host blocked.\n');

  logStep('remote Ollama URL override works');
  process.env.PROMPTVAULT_ALLOW_REMOTE_OLLAMA = '1';
  assert(normalizeOllamaUrl('http://example.com:11434') === 'http://example.com:11434', 'Remote Ollama URL override did not work');
  delete process.env.PROMPTVAULT_ALLOW_REMOTE_OLLAMA;
  process.stdout.write('remote override accepted.\n');

  logStep('SSRF localhost blocking works');
  let ssrfBlocked = false;
  try {
    await fetchAndCleanWebpage('http://127.0.0.1');
  } catch (err) {
    ssrfBlocked = String(err.message).includes('SSRF Block:');
  }
  assert(ssrfBlocked, 'Localhost fetch was not blocked');
  process.stdout.write('localhost fetch blocked.\n');

  logStep('non-http URL schemes are blocked');
  let fileSchemeBlocked = false;
  try {
    await fetchAndCleanWebpage('file:///etc/passwd');
  } catch (err) {
    fileSchemeBlocked = String(err.message).includes('Only http:// and https:// URLs are allowed.');
  }
  assert(fileSchemeBlocked, 'file:// URL was not blocked');
  process.stdout.write('file:// blocked.\n');

  logStep('terminal sanitization works');
  assert(sanitizeForTerminal('safe\u001b[2Jtitle') === 'safetitle', 'ANSI sanitization failed');
  process.stdout.write('terminal sanitization passed.\n');

  console.log('\nSmoke tests passed.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
