// Vercel Function: the whole HunarSetu API (server/app.js), reached at /api/*.
// vercel.json sends every /api/... request here; the original path is kept, so the API
// is mounted at /api exactly as in server/index.js and the Vite dev server.
import express from 'express'
import { createApp } from '../server/app.js'

const app = express()
app.use('/api', createApp())

export default app
