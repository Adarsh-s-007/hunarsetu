// Production server: serves the built site (dist/) and the API from one process.
//   npm run build && npm start
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile() // reads ./.env (ANTHROPIC_API_KEY) when present
} catch {
  /* no .env file: the site runs with the offline engine */
}

const { createApp } = await import('./app.js')
const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
const port = Number(process.env.PORT) || 8080

const app = express()
app.use('/api', createApp())
app.use(express.static(dist))
app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')))
app.listen(port, () => console.log(`HunarSetu running at http://localhost:${port}`))
