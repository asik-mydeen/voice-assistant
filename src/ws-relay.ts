import WebSocket from 'ws'
import { createSession } from './session.js'
import { executeTool } from './mcp-client.js'

const DEVICE_TOKEN = process.env.DEVICE_TOKEN || process.env.MCP_AUTH_TOKEN || ''

export async function handleWebSocket(clientWs: WebSocket) {
  let openaiWs: WebSocket | null = null
  let authenticated = false
  let speaker = 'Asik'

  clientWs.on('message', async (raw) => {
    try {
      // First message must be auth + config
      if (!authenticated) {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'auth') {
          if (msg.token !== DEVICE_TOKEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
            clientWs.close()
            return
          }
          authenticated = true
          speaker = msg.speaker || 'Asik'
          console.log(`ESP32 authenticated, speaker: ${speaker}`)

          // Create OpenAI session and connect
          try {
            const session = await createSession()
            clientWs.send(JSON.stringify({ type: 'session_ready' }))

            // Connect to OpenAI Realtime via WebSocket
            const model = process.env.OPENAI_MODEL || 'gpt-4o-mini-realtime-preview'
            const url = `wss://api.openai.com/v1/realtime?model=${model}`
            openaiWs = new WebSocket(url, {
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1',
              },
            })

            openaiWs.on('open', () => {
              console.log('OpenAI Realtime WebSocket connected')
              // Update session with speaker context
              openaiWs!.send(JSON.stringify({
                type: 'session.update',
                session: {
                  instructions: session.systemPrompt + '\n\nThe current speaker is ' + speaker + '. Address them by name.',
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: { model: 'whisper-1' },
                  turn_detection: { type: 'server_vad', threshold: 0.7, silence_duration_ms: 500 },
                  tools: session.tools,
                },
              }))
              clientWs.send(JSON.stringify({ type: 'connected' }))
            })

            openaiWs.on('message', async (data) => {
              const event = JSON.parse(data.toString())

              switch (event.type) {
                // Forward audio to ESP32
                case 'response.audio.delta':
                  clientWs.send(JSON.stringify({ type: 'audio', data: event.delta }))
                  break

                case 'response.audio.done':
                  clientWs.send(JSON.stringify({ type: 'audio_done' }))
                  break

                // Handle function calls server-side
                case 'response.function_call_arguments.done':
                  console.log(`ESP32 tool call: ${event.name}`)
                  try {
                    const args = JSON.parse(event.arguments || '{}')
                    const result = await executeTool(event.name, args)
                    const output = typeof result === 'string' ? result : JSON.stringify(result)
                    openaiWs!.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: { type: 'function_call_output', call_id: event.call_id, output },
                    }))
                    openaiWs!.send(JSON.stringify({ type: 'response.create' }))
                  } catch (e: any) {
                    openaiWs!.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: { type: 'function_call_output', call_id: event.call_id, output: JSON.stringify({ error: e.message }) },
                    }))
                    openaiWs!.send(JSON.stringify({ type: 'response.create' }))
                  }
                  break

                // Status events → forward to ESP32 for LED control
                case 'input_audio_buffer.speech_started':
                  clientWs.send(JSON.stringify({ type: 'status', state: 'listening' }))
                  break
                case 'input_audio_buffer.speech_stopped':
                  clientWs.send(JSON.stringify({ type: 'status', state: 'thinking' }))
                  break
                case 'response.created':
                  clientWs.send(JSON.stringify({ type: 'status', state: 'speaking' }))
                  break
                case 'response.done':
                  clientWs.send(JSON.stringify({ type: 'status', state: 'listening' }))
                  break
                case 'error':
                  console.error('OpenAI error:', event.error)
                  clientWs.send(JSON.stringify({ type: 'status', state: 'error' }))
                  break

                // Transcript for debugging
                case 'conversation.item.input_audio_transcription.completed':
                  if (event.transcript) clientWs.send(JSON.stringify({ type: 'transcript', role: 'user', text: event.transcript }))
                  break
                case 'response.audio_transcript.done':
                  if (event.transcript) clientWs.send(JSON.stringify({ type: 'transcript', role: 'ai', text: event.transcript }))
                  break
              }
            })

            openaiWs.on('close', () => {
              console.log('OpenAI WebSocket closed')
              clientWs.send(JSON.stringify({ type: 'disconnected' }))
              clientWs.close()
            })

            openaiWs.on('error', (err) => {
              console.error('OpenAI WebSocket error:', err)
              clientWs.send(JSON.stringify({ type: 'error', message: 'OpenAI connection failed' }))
            })

          } catch (e: any) {
            clientWs.send(JSON.stringify({ type: 'error', message: e.message }))
            clientWs.close()
          }
          return
        }
      }

      // After auth: handle audio and control messages
      if (!authenticated || !openaiWs) return

      // Binary data = raw PCM audio from ESP32
      if (Buffer.isBuffer(raw)) {
        // Forward as base64 audio to OpenAI
        const b64 = raw.toString('base64')
        openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: b64,
        }))
        return
      }

      // JSON control messages
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'audio') {
        // Base64 PCM audio from ESP32
        openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: msg.data,
        }))
      } else if (msg.type === 'commit') {
        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      } else if (msg.type === 'disconnect') {
        openaiWs.close()
      }

    } catch (e: any) {
      console.error('WS message error:', e)
    }
  })

  clientWs.on('close', () => {
    console.log('ESP32 disconnected')
    if (openaiWs) openaiWs.close()
  })
}
