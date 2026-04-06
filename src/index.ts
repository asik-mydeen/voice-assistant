import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => c.json({ status: 'ok', name: 'voice-assistant' }))
app.get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }))

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 voice-assistant on ${port}`)
serve({ fetch: app.fetch, port })
