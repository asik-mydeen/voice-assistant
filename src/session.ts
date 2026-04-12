import { FUNCTIONS } from './functions.js'
import { SYSTEM_PROMPT } from './prompt.js'

export async function createSession() {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-realtime-preview'
  const voice = process.env.OPENAI_VOICE || 'ash'

  // Fetch live context to inject into session
  let contextNote = ""
  try {
    const ctxRes = await fetch(`${process.env.LIFE_MCP_URL || "https://life.asikmydeen.com"}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LIFE_MCP_TOKEN || process.env.MCP_AUTH_TOKEN || ""}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "context_now", arguments: {} } }),
      signal: AbortSignal.timeout(4000),
    })
    if (ctxRes.ok) {
      const ctxData = await ctxRes.json()
      const text = ctxData?.result?.content?.[0]?.text
      if (text) contextNote = `\n\n## Live Context (as of session start)\n${text.slice(0, 800)}`
    }
  } catch { /* context fetch failed silently */ }

  const instructions = SYSTEM_PROMPT + contextNote

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      instructions,
      tools: FUNCTIONS,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.7,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI session error: ${err}`)
  }

  const data = await response.json()
  return {
    client_secret: data.client_secret.value,
    model,
    voice,
    expires_at: data.client_secret.expires_at,
    systemPrompt: instructions,
    tools: FUNCTIONS,
  }
}
