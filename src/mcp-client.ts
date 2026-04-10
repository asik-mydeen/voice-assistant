const MEMORY_MCP_URL = process.env.MEMORY_MCP_URL || 'https://memory.asikmydeen.com'
const LIFE_MCP_URL = process.env.LIFE_MCP_URL || 'https://life.asikmydeen.com'
const SHIP_MCP_URL = process.env.SHIP_MCP_URL || 'https://mcp.asikmydeen.com'
const MEMORY_MCP_TOKEN = process.env.MEMORY_MCP_TOKEN || process.env.MCP_AUTH_TOKEN || ''
const LIFE_MCP_TOKEN = process.env.LIFE_MCP_TOKEN || process.env.MCP_AUTH_TOKEN || ''
const SHIP_MCP_TOKEN = process.env.SHIP_MCP_TOKEN || ''

const LIFE_TOOLS = new Set([
  'context_now', 'context_member',
  'digest_daily', 'digest_weekly',
  'shortcut_morning', 'shortcut_goodnight', 'shortcut_restart_app',
  'shortcut_ha_scene', 'shortcut_notify_family',
  'voice_transcribe', 'voice_quick',
  'family_my_chores', 'family_done', 'family_my_points',
  'family_mood', 'family_whats_for_dinner', 'family_scoreboard',
  'sync_status', 'sync_export_memories', 'sync_import_memory', 'sync_export_events',
])

const SHIP_TOOLS = new Set([
  'ship_list_projects', 'ship_status', 'ship_deploy', 'ship_destroy',
  'ship_env_set', 'ship_logs', 'ship_deploy_existing', 'ship_add_domain',
  'ship_deploy_watch', 'ship_app_health', 'ship_deploy_compose',
  'ship_compose_update', 'ship_compose_status', 'ship_tunnel_set',
  'ship_create_project', 'ship_push_files', 'ship_supabase_query', 'ship_supabase_health',
  'ship_task_submit', 'ship_task_status', 'ship_task_followup', 'ship_task_cancel',
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

  private async post(body: any): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json, text/event-stream',
    }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId
    return fetch(`${this.baseUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) })
  }

  private async parseResponse(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.result !== undefined || data.error !== undefined) return data
          } catch {}
        }
      }
      throw new Error('No valid JSON-RPC response in SSE stream')
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
      if (!res.ok) throw new Error(`MCP error: ${res.status}`)
      return this.parseResponse(res)
    } catch (e) {
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

const memorySession = new McpSession(MEMORY_MCP_URL, MEMORY_MCP_TOKEN)
const lifeSession = new McpSession(LIFE_MCP_URL, LIFE_MCP_TOKEN)
const shipSession = new McpSession(SHIP_MCP_URL, SHIP_MCP_TOKEN)

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const session = SHIP_TOOLS.has(name) ? shipSession : LIFE_TOOLS.has(name) ? lifeSession : memorySession
  try {
    const response = await session.callTool(name, args)
    if (response.error) return { error: response.error.message || 'MCP tool error' }
    const result = response.result
    if (result?.content) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
    }
    return result
  } catch (e: any) {
    return { error: e.message }
  }
}
