# OmniTrace

OmniTrace is a modern, high-performance dashboard designed to visualize web server access logs directly in the browser. It specializes in parsing Nginx, GCP, AWS ALB, and Kubernetes logs, normalizing URLs, and visualizing latency distribution.

## 🚀 Features

- **Privacy-First**: All log processing happens 100% locally in your browser. Raw log files are never uploaded.
- **Universal Parsing**: Nginx, GCP, AWS ALB, Kubernetes, PostgreSQL, MongoDB, Redis, Spring Boot, Envoy, and CloudFront.
- **AI Integration**:
  - **Ollama** (default): local LLM, nothing leaves the machine.
  - **Google Gemini**: opt-in cloud analysis. Aggregated stats leave the browser; the API key is session-only and never written to `localStorage`.
- **Theming**: Dark and Light mode support.
- **Visualizations**: Traffic Volume, Latency Heatmaps, Status Code Distribution, Drain pattern clustering.
- **Session restore**: Last parsed logs stay in IndexedDB in this browser (never uploaded).

## 📋 Usage

1. **Upload Logs**: Drag and drop your `.log`, `.txt`, `.csv`, `.zip`, or `.gz` files onto the drop zone.
2. **Settings**: Click the gear icon to toggle Dark/Light mode or configure your AI provider (Ollama or Gemini).
3. **Analyze**: Use the filter bar to drill down into specific error events or high-latency requests.

## 🛠️ Local Development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine + parser fixtures
npm run test:e2e # Playwright smoke (sample → dashboard)
```

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for Docker and Ollama details.

## 🐳 Docker Deployment

```bash
docker build -t omnitrace .
docker run -d -p 8080:80 --name omnitrace omnitrace
```

Open `http://localhost:8080`.

## Vercel

Vite static app (`vercel.json`). Grant the [Vercel GitHub app](https://github.com/apps/vercel) access to `omni-trace`, or import the repo at [vercel.com/new](https://vercel.com/new/import?s=https://github.com/ManjuReddyT/omni-trace). Pushes to `main` then deploy automatically.

## 🤖 Ollama Setup

1. [Install Ollama](https://ollama.com/).
2. Run a model: `ollama run llama3`.
3. Allow CORS: `OLLAMA_ORIGINS="*" ollama serve`
4. In OmniTrace Settings, select **Ollama** and enter your model name (e.g. `llama3`).
