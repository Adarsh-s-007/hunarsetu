import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Serves the HunarSetu API (server/app.js) from the dev server at /api, so `npm run dev`
// runs the site, the outcome database and the Claude counsellor together.
function hunarsetuApi() {
  return {
    name: 'hunarsetu-api',
    async configureServer(server) {
      const { createApp } = await import(pathToFileURL(path.resolve('server/app.js')).href)
      server.middlewares.use('/api', createApp())
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make .env values (AI keys, storage, ...) visible to the API code.
  // They are never exposed to the browser bundle: only VITE_* variables are.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'HUNARSETU_MODEL', 'HUNARSETU_LLM',
    'GROQ_API_KEY', 'GROQ_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'POLLINATIONS_MODEL',
    'LLM_PROVIDER', 'HUNARSETU_FREE_AI', 'HUNARSETU_DATA_DIR',
    'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  return {
    plugins: [react(), hunarsetuApi()],
    server: { port: 5173 },
  }
})
