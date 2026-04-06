import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFileSync } from 'node:fs'
import { createSession } from './session.js'
import { executeTool } from './mcp-client.js'

const app = new Hono()

app.use('/api/*', cors())

// Auth middleware — skips /api/config
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/config') return next()

  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_ANON_KEY!,
      },
    })
    if (!res.ok) return c.json({ error: 'Invalid token' }, 401)

    const user = await res.json()
    const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(user.email)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  } catch {
    return c.json({ error: 'Auth error' }, 500)
  }
})

// Public config
app.get('/api/config', (c) => {
  return c.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  })
})

// Create ephemeral session
app.post('/api/session', async (c) => {
  try {
    const session = await createSession()
    return c.json(session)
  } catch (e: any) {
    console.error('Session error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// Execute MCP tool
app.post('/api/tools/execute', async (c) => {
  try {
    const { name, arguments: args } = await c.req.json()
    console.log(`Tool call: ${name}`, JSON.stringify(args))
    const result = await executeTool(name, args || {})
    return c.json({ result })
  } catch (e: any) {
    console.error('Tool error:', e)
    return c.json({ error: e.message }, 500)
  }
})

app.get('/health', (c) => c.json({ status: 'ok', service: 'voice-assistant' }))

// Static files
app.use('/*', serveStatic({ root: './public' }))

// SPA fallback
app.get('*', (c) => {
  try {
    const html = readFileSync('./public/index.html', 'utf-8')
    return c.html(html)
  } catch {
    return c.text('Not found', 404)
  }
})

const port = parseInt(process.env.PORT || '3000')
serve({ fetch: app.fetch, port }, () => {
  console.log(`Voice Assistant running on port ${port}`)
})
