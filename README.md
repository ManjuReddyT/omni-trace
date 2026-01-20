# LogPulse Analytics

LogPulse Analytics is a modern, high-performance dashboard designed to visualize web server access logs directly in the browser. It specializes in parsing Nginx, GCP, AWS ALB, and Kubernetes logs, normalizing URLs, and visualizing latency distribution.

## 🚀 Features

- **Privacy-First**: All log processing happens 100% locally in your browser. No data is uploaded to any server.
- **Universal Parsing**: Supports JSON Lines (GCP/Zap), TSV/CSV (Nginx/CloudFront), Kubernetes (CRI), PostgreSQL, Redis, MongoDB, and more.
- **AI Integration**:
  - **Google Gemini**: Cloud-based analysis.
  - **Ollama**: **NEW!** Local LLM support for privacy-conscious users.
- **Theming**: **NEW!** Dark and Light mode support.
- **Visualizations**: Traffic Volume, Latency Heatmaps, Status Code Distribution, Pattern Clustering.

## 📋 Usage

1. **Upload Logs**: Drag and drop your `.log`, `.txt`, `.csv`, `.zip`, or `.gz` files onto the drop zone.
2. **Settings**: Click the gear icon to toggle Dark/Light mode or configure your AI provider (Gemini or Ollama).
3. **Analyze**: Use the filter bar to drill down into specific error events or high-latency requests.

## 🐳 Docker Deployment

You can run LogPulse locally using Docker:

```bash
docker build -t logpulse .
docker run -p 8080:80 logpulse
```

Open `http://localhost:8080` in your browser.

## 🤖 Ollama Setup

To use the local AI features:

1. [Install Ollama](https://ollama.com/).
2. Run a model: `ollama run llama3`.
3. Ensure Ollama allows CORS. Run:
   ```bash
   OLLAMA_ORIGINS="*" ollama serve
   ```
4. In LogPulse Settings, select **Ollama** and enter your model name (e.g., `llama3`).

## 🛠️ Local Development

```bash
npm install
npm run dev
```
