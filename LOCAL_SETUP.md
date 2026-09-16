# Local Setup Guide

OmniTrace is a Vite + React + TypeScript app. Processing happens entirely in the browser.

**Production:** [https://trace.sreroot.com](https://trace.sreroot.com)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22 recommended)
- npm

## Install and run

```bash
git clone https://github.com/ManjuReddyT/omni-trace.git
cd omni-trace
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:3000`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm test` | Parser and engine tests (Vitest) |
| `npm run test:e2e` | Playwright smoke: sample → dashboard |
| `npm run build` | Production bundle to `dist/` |
| `npm run preview` | Serve the production build |

## Optional: local AI (Ollama)

Ollama is the default AI provider. Keys are never written to `localStorage`.

1. Install [Ollama](https://ollama.com/) and run `ollama run llama3`.
2. Allow browser calls: `OLLAMA_ORIGINS="*" ollama serve`
3. In OmniTrace Settings, confirm provider **Ollama** and model name.

Gemini is opt-in. If you select it, aggregated stats leave the browser, and the API key stays in memory for the tab session only.

## Production (Vercel)

The app is live at [trace.sreroot.com](https://trace.sreroot.com). The GitHub `main` branch is linked; every push deploys. Config is in `vercel.json`.

## Docker

```bash
docker build -t omnitrace .
docker run -d -p 8080:80 --name omnitrace omnitrace
```
