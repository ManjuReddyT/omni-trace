# Local Setup Guide

This project is built with React, TypeScript, and Tailwind CSS. While it runs in browser-based environments, here is how to set it up locally on your machine.

## Prerequisites

- [Node.js](https://nodejs.org/) (Version 16 or higher)
- npm or yarn

## Step-by-Step Installation

### 1. Initialize the Project

We recommend using [Vite](https://vitejs.dev/) for a fast development experience.

```bash
# Create a new project using the React TypeScript template
npm create vite@latest logpulse -- --template react-ts

# Navigate into the directory
cd logpulse

# Install dependencies
npm install
```

### 2. Install Required Libraries

Install the specific libraries used in LogPulse:

```bash
npm install lucide-react recharts
```

### 3. Configure Tailwind CSS

Install Tailwind and its peer dependencies:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Update your `tailwind.config.js` to look like this:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add the Tailwind directives to `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f172a; /* Slate 900 */
  color: #e2e8f0; /* Slate 200 */
}
```

### 4. Organize Source Files

1.  **Delete** the default files in `src/` (`App.css`, `App.tsx`, `index.css`, `main.tsx`).
2.  **Copy** the files from this repository into `src/` keeping the folder structure:
    *   `src/App.tsx`
    *   `src/index.tsx` (Rename this to `main.tsx` for standard Vite setup)
    *   `src/types.ts`
    *   `src/utils.ts`
    *   `src/components/Dashboard.tsx`
    *   `src/components/FileUpload.tsx`
    *   `src/components/StatsCard.tsx`
    *   `src/components/Charts.tsx`

### 5. Run the Application

Start the development server:

```bash
npm run dev
```

Open your browser to `http://localhost:5173` (or the port shown in your terminal).

## Troubleshooting

- **Index Import Error**: If you see an error about `index.html`, ensure `src/main.tsx` is correctly referenced in the `<script type="module" src="/src/main.tsx"></script>` tag inside `index.html`.
- **Type Errors**: Ensure `tsconfig.json` is set up (Vite handles this by default).
