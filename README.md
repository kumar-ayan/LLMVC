# PromptVault CLI (`pv`)

A fully local, terminal-first version control and AI-evaluation system for LLM prompts. 

![Node.js](https://img.shields.io/badge/Node.js-18+-black?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-Native-003B57?logo=sqlite)

## Demo

![PromptVault Demo](demo.gif)
*(Placeholder: Record a terminal session with Asciinema and convert to GIF here)*

## Architecture (Local-First Design)

PromptVault is designed for **100% privacy and local control**. There is no cloud backend, no account to create, and no telemetry.
- **Storage**: All prompts, versions, and configurations are stored as a local SQLite database at `~/.promptvault/vault.db` using Node's ultra-fast native `node:sqlite` module. 
- **Configuration**: API keys and preferences are kept locally in `~/.promptvault/config.json`.
- **SSRF Protection**: Importing prompts via URL prevents resolution to local or private IPs.
- **AI Processing**: LLM API calls are made directly from your machine to the provider.

## Installation

You can install PromptVault globally on your machine:

```bash
# Clone the repository
git clone https://github.com/your-repo/promptvault-cli.git
cd promptvault-cli

# Install dependencies and compile TypeScript
npm install
npm run build

# Install the CLI globally
npm install -g .
```

You can now use the `pv` command anywhere in your terminal!

## Configuration

Before using AI features (like `analyze`, `eval`, or `fix`), run:
```bash
pv config
```
This interactive prompt will ask for your OpenAI (or compatible) API Key and preferred model.

## Command Reference

| Command | Description |
|---------|-------------|
| `pv add` / `pv add "text"` | Save a new prompt (opens `$EDITOR` if no text) |
| `pv import --text` / `--url` | Import and auto-extract prompts from raw chat logs or webpages |
| `pv list [--tag string]` | List all tracked prompts in a table |
| `pv search "keyword"` | Full-text search across all prompts and tags |
| `pv view <id>` | View the latest prompt version and its AI analysis |
| `pv edit <id>` | Open the latest version in `$EDITOR` and save changes as a new version |
| `pv diff <id> --v1 X --v2 Y`| Show a word-level colorized diff between two versions |
| `pv rollback <id> --to X` | Roll back to a previous version (creates a new version) |
| `pv history <id>` | Show timeline of all versions and their scores |
| `pv delete <id>` | Delete a prompt and its history entirely |
| `pv export [--json/--md]` | Export the entire prompt vault for backups |
| `pv analyze <id>` | Run an AI analysis on the prompt and display a scorecard |
| `pv fix <id>` | Let AI suggest and optionally apply an improved version |
| `pv eval <id> [--add/--run]`| Add test cases or evaluate the prompt using an LLM-as-judge |

## Analysis Example

Running `pv analyze` produces a detailed grading scorecard:
```
┌─────────────────────────────────────────┐
│  PromptVault Analysis — v3              │
├─────────────────────────────────────────┤
│  Overall Score        82 / 100  ████████░░   
│                                         │
│  Clarity              90 / 100  █████████░   
│  Specificity          75 / 100  ███████░░░   
│  Context              80 / 100  ████████░░   
│  Instruction Quality  85 / 100  ████████░░   
├─────────────────────────────────────────┤
│  Issues found:                          │
│  ⚠ Missing output format instruction    │
│  ⚠ No example provided                  │
├─────────────────────────────────────────┤
│  Summary: Strong clarity but lacks      │
│  output constraints. Add a format       │
│  example to improve specificity.        │
└─────────────────────────────────────────┘
```

## License

MIT
