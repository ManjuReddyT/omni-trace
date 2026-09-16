# OmniTrace

**Live:** [https://trace.sreroot.com](https://trace.sreroot.com)

Client-side log analytics. Parse Nginx, GCP, AWS ALB, Envoy, CloudFront, Kubernetes, PostgreSQL, MongoDB, Redis, and Spring Boot in the browser. Raw logs never leave the device.

## Features

- **Privacy-first** — parsing, clustering, and stats run locally (Web Worker). IndexedDB restores the last session in this browser only.
- **Formats** — JSON/GCP, Nginx/Apache CLF, AWS ALB, Envoy, CloudFront TSV, Kubernetes CRI, PostgreSQL, MongoDB, Redis, Spring Boot.
- **SRE views** — golden signals, Drain pattern clustering, per-endpoint anomaly baselines, virtualized log explorer.
- **AI** — Ollama by default (nothing leaves the machine). Gemini is opt-in; aggregated stats leave the browser; the API key is session-only and never written to `localStorage`.

## Usage

1. Open [trace.sreroot.com](https://trace.sreroot.com) (or run locally).
2. Drop `.log`, `.txt`, `.csv`, `.zip`, or `.gz` files, paste, stream, or load a sample.
3. Filter, then use Overview / Logs / Patterns / Anomalies / AI.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # parser + engine fixtures
npm run test:e2e # Playwright smoke (sample → dashboard)
```

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for Docker and Ollama.

## Deploy

Production is [trace.sreroot.com](https://trace.sreroot.com), a custom domain on Vercel. Pushes to `main` deploy automatically (`vercel.json`).

```bash
docker build -t omnitrace .
docker run -d -p 8080:80 --name omnitrace omnitrace
```

## Ollama

1. [Install Ollama](https://ollama.com/).
2. `ollama run llama3`
3. Allow CORS: `OLLAMA_ORIGINS="*" ollama serve`
4. In Settings, select **Ollama** and the model name.
