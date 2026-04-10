import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFile } from 'node:fs/promises'
import { createSession } from './session.js'
import { executeTool } from './mcp-client.js'
import { handleWebSocket } from './ws-relay.js'
import { WebSocketServer } from 'ws'

const app = new Hono()

app.use('/api/*', cors())

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/config') return next()
  // Allow /api/chat with DEVICE_TOKEN (for iOS Shortcuts / Siri)
  if (c.req.path === '/api/chat') {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    const deviceToken = process.env.DEVICE_TOKEN || process.env.MCP_AUTH_TOKEN || ''
    if (token && deviceToken && token === deviceToken) return next()
  }
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY! },
    })
    if (!res.ok) return c.json({ error: 'Invalid token' }, 401)
    const user = await res.json()
    const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(user.email)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  } catch { return c.json({ error: 'Auth error' }, 500) }
})

app.get('/api/config', (c) => c.json({ supabaseUrl: process.env.SUPABASE_URL, supabaseAnonKey: process.env.SUPABASE_ANON_KEY }))

app.post('/api/session', async (c) => {
  try { return c.json(await createSession()) }
  catch (e: any) { console.error('Session error:', e); return c.json({ error: e.message }, 500) }
})

app.post('/api/tools/execute', async (c) => {
  try {
    const { name, arguments: args } = await c.req.json()
    console.log(`Tool call: ${name}`, JSON.stringify(args))
    return c.json({ result: await executeTool(name, args || {}) })
  } catch (e: any) { console.error('Tool error:', e); return c.json({ error: e.message }, 500) }
})

app.get('/health', (c) => c.json({ status: 'ok', service: 'zara-voice' }))

app.use('/*', async (c, next) => {
  await next()
  if (c.req.path.match(/\.(js|css|html)$/)) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Pragma', 'no-cache')
  }
})

app.use('/*', serveStatic({ root: './public' }))

app.get('*', async (c) => {
  try { return c.html(await readFile('./public/index.html', 'utf-8')) }
  catch { return c.text('Not found', 404) }
})

const port = parseInt(process.env.PORT || '3000')
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Zara running on port ${port}`)
})

// Attach WebSocket server for ESP32 on the same HTTP server
const wss = new WebSocketServer({ server: server as any, path: '/api/ws' })
wss.on('connection', (ws, req) => {
  console.log('ESP32 WebSocket connected from', req.socket.remoteAddress)
  handleWebSocket(ws)
})

// ── Text Chat API (for iOS Shortcuts / Siri) ──
app.post('/api/chat', async (c) => {
  try {
    const { message, speaker } = await c.req.json()
    if (!message) return c.json({ error: 'message required' }, 400)

    const { SYSTEM_PROMPT } = await import('./prompt.js')
    const { executeTool } = await import('./mcp-client.js')
    const { FUNCTIONS } = await import('./functions.js')

    const tools = FUNCTIONS.map((f: any) => ({
      type: 'function' as const,
      function: { name: f.name, description: f.description, parameters: f.parameters },
    }))

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT + (speaker ? `\n\nThe current speaker is ${speaker}.` : '') },
      { role: 'user', content: message },
    ]

    // Chat loop: call OpenAI → execute tools → feed results back → repeat
    for (let i = 0; i < 5; i++) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: 'auto',
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return c.json({ error: `OpenAI error: ${err}` }, 500)
      }

      const data = await res.json()
      const choice = data.choices[0]
      messages.push(choice.message)

      // If no tool calls, return the final response
      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
        return c.json({
          response: choice.message.content || '',
          model: data.model,
          usage: data.usage,
        })
      }

      // Execute tool calls
      for (const tc of choice.message.tool_calls) {
        console.log(`Shortcut tool: ${tc.function.name}`)
        const args = JSON.parse(tc.function.arguments || '{}')
        const result = await executeTool(tc.function.name, args)
        const output = typeof result === 'string' ? result : JSON.stringify(result)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: output,
        })
      }
    }

    return c.json({ response: 'Too many tool calls', error: 'loop limit' }, 500)
  } catch (e: any) {
    console.error('Chat error:', e)
    return c.json({ error: e.message }, 500)
  }
})
