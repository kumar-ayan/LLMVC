# PromptVC — Version Control for LLM Prompts

A full-stack application for managing, versioning, diffing, evaluating, and rolling back LLM prompts. Includes LLM-as-judge scoring for automated prompt quality assessment.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)

## Features

- **Version Control** — Save prompt versions with commit messages, browse history
- **Diff Viewer** — Color-coded line-by-line diff between any two versions
- **Rollback** — Revert to any previous version (creates new version preserving history)
- **Test Cases** — Define input/expected-output pairs for systematic testing
- **Eval Runner** — Execute prompts against test cases using any OpenAI-compatible API
- **LLM-as-Judge** — Automated scoring (0–10) with reasoning using a second LLM call
- **Dark Mode UI** — Glassmorphism design with smooth animations

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## LLM Configuration

To use evals and LLM-as-judge scoring, configure an API key:

1. Navigate to **Settings** in the app
2. Enter your OpenAI (or compatible) API key
3. Optionally customize Base URL and Model

Or create a `.env.local` file:

```env
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript (App Router) |
| Backend | Next.js API Routes |
| Database | SQLite via better-sqlite3 |
| Styling | Vanilla CSS (dark mode, glassmorphism) |
| Diffing | `diff` npm package |
| LLM API | OpenAI-compatible REST API |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompts` | GET, POST | List / create prompts |
| `/api/prompts/:id` | GET, DELETE | Get / delete prompt |
| `/api/prompts/:id/versions` | GET, POST | List / create versions |
| `/api/prompts/:id/diff?v1=X&v2=Y` | GET | Diff two versions |
| `/api/prompts/:id/rollback` | POST | Rollback to version |
| `/api/prompts/:id/test-cases` | GET, POST | Manage test cases |
| `/api/prompts/:id/evals` | GET, POST | Run / list evals |
| `/api/prompts/:id/evals/:runId` | GET | Get eval results |
| `/api/settings` | GET, PUT | LLM configuration |

## License

MIT
