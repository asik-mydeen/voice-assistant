const MEMORY_URL = process.env.MEMORY_MCP_URL || 'https://memory.asikmydeen.com'
const LIFE_URL = process.env.LIFE_MCP_URL || 'https://life.asikmydeen.com'
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN || ''

const LIFE_TOOLS = new Set([
  'context_now', 'context_member',
  'digest_daily', 'digest_weekly',
  'shortcut_morning', 'shortcut_goodnight', 'shortcut_restart_app',
  'shortcut_ha_scene', 'shortcut_notify_family',
  'voice_transcribe', 'voice_quick',
  'family_my_chores', 'family_done', 'family_my_points',
  'family_mood', 'family_whats_for_dinner', 'family_scoreboard',
  'sync_status', 'sync_export_memories',
])

class McpSession {
  private baseUrl: string
  private token: string
  private sessionId: string | null = null
  private initialized = false

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  private async post(body: any, headers?: Record<string, string>): Promise<Response> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json, text/event-stream',
      ...headers,
    }
    if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId
    return fetch(`${this.baseUrl}/mcp`, { method: 'POST', headers: h, body: JSON.stringify(body) })
  }

  private async parseResponse(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6))
            if (d.result !== undefined || d.error !== undefined) return d
          } catch {}
        }
      }
      return { error: { message: 'No JSON-RPC response in SSE' } }
    }
    return res.json()
  }

  async init(): Promise<void> {
    if (this.initialized) return
    const res = await this.post({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'voice-assistant', version: '1.0.0' },
      },
      id: 'init-' + Date.now(),
    })
    const sid = res.headers.get('mcp-session-id')
    if (sid) this.sessionId = sid
    await this.parseResponse(res)
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    this.initialized = true
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    try {
      await this.init()
      const res = await this.post({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name, arguments: args },
        id: 'call-' + Date.now(),
      })
      if (!res.ok) throw new Error(`MCP HTTP ${res.status}`)
      return this.parseResponse(res)
    } catch (e) {
      // Retry with fresh session
      this.initialized = false
      this.sessionId = null
      await this.init()
      const res = await this.post({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name, arguments: args },
        id: 'retry-' + Date.now(),
      })
      return this.parseResponse(res)
    }
  }
}

const memorySess = new McpSession(MEMORY_URL, MCP_TOKEN)
const lifeSess = new McpSession(LIFE_URL, MCP_TOKEN)

export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const session = LIFE_TOOLS.has(name) ? lifeSess : memorySess
  const response = await session.callTool(name, args)

  if (response.error) {
    return JSON.stringify({ error: response.error.message || 'MCP error' })
  }

  const result = response.result
  if (result?.content) {
    return result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
  }
  return JSON.stringify(result)
}
