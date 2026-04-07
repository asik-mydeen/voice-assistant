import { FUNCTIONS } from './functions.js'
import { SYSTEM_PROMPT } from './prompt.js'

export async function createSession() {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini-realtime-preview'
  const voice = process.env.OPENAI_VOICE || 'ash'

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      instructions: SYSTEM_PROMPT,
      tools: FUNCTIONS,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.7,
        prefix_padding_ms: 300,
        silence_duration_ms: 1000,
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
  }
}
