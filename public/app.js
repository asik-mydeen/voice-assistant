// === STATE ===
let supabaseClient = null
let session = null
let pc = null
let dc = null
let audioEl = null
let isConnected = false
let pendingFunctionCalls = []
let aiTranscriptBuffer = ''

const $ = (s) => document.querySelector(s)

// === INIT ===
async function init() {
  try {
    const config = await fetch('/api/config').then(r => r.json())
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)

    const { data: { session: existing } } = await supabaseClient.auth.getSession()
    if (existing) { session = existing; showVoiceScreen() }
    else { showLoginScreen() }

    supabaseClient.auth.onAuthStateChange((event, s) => {
      session = s
      if (event === 'SIGNED_IN') showVoiceScreen()
      if (event === 'SIGNED_OUT') showLoginScreen()
    })

    $('#login-btn').addEventListener('click', signIn)
    $('#logout-btn').addEventListener('click', signOut)
    $('#mic-btn').addEventListener('click', toggleConnection)
  } catch (e) {
    console.error('Init error:', e)
  }
}

// === AUTH ===
async function signIn() {
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

async function signOut() {
  disconnect()
  await supabaseClient.auth.signOut()
  session = null
  showLoginScreen()
}

// === UI ===
function showLoginScreen() {
  $('#login-screen').classList.remove('hidden')
  $('#voice-screen').classList.add('hidden')
}

function showVoiceScreen() {
  $('#login-screen').classList.add('hidden')
  $('#voice-screen').classList.remove('hidden')
}

function setStatus(text, state) {
  $('#status-text').textContent = text
  document.body.dataset.state = state || 'idle'
}

function addTranscript(role, text) {
  const el = document.createElement('div')
  el.className = 'msg ' + role
  el.innerHTML = `<span class="msg-role">${role === 'user' ? '🎤' : '🤖'}</span><span class="msg-text">${text}</span>`
  $('#transcript').appendChild(el)
  $('#transcript-area').scrollTop = $('#transcript-area').scrollHeight
}

// === WEBRTC ===
async function toggleConnection() {
  if (isConnected) { disconnect() } else { connect() }
}

async function connect() {
  try {
    setStatus('Connecting...', 'connecting')

    const tokenRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + session.access_token },
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      throw new Error(err.error || 'Failed to create session')
    }
    const { client_secret, model } = await tokenRes.json()

    pc = new RTCPeerConnection()

    audioEl = document.createElement('audio')
    audioEl.autoplay = true
    pc.ontrack = (e) => { audioEl.srcObject = e.streams[0] }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    pc.addTrack(stream.getTracks()[0])

    dc = pc.createDataChannel('oai-events')
    dc.onopen = () => {
      isConnected = true
      setStatus('Listening...', 'listening')
      $('#mic-icon').classList.add('hidden')
      $('#stop-icon').classList.remove('hidden')
      $('#mic-hint').textContent = 'Tap to stop'
    }
    dc.onclose = () => disconnect()
    dc.onmessage = handleRealtimeEvent

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const sdpRes = await fetch('https://api.openai.com/v1/realtime?model=' + model, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + client_secret, 'Content-Type': 'application/sdp' },
      body: offer.sdp,
    })
    if (!sdpRes.ok) throw new Error('Failed to connect to OpenAI Realtime')

    const answer = await sdpRes.text()
    await pc.setRemoteDescription({ type: 'answer', sdp: answer })
  } catch (err) {
    console.error('Connection error:', err)
    setStatus('Error: ' + err.message, 'error')
    disconnect()
  }
}

function disconnect() {
  if (pc) {
    pc.getSenders().forEach(s => { if (s.track) s.track.stop() })
    pc.close()
    pc = null
  }
  if (dc) { dc.close(); dc = null }
  if (audioEl) { audioEl.srcObject = null; audioEl = null }
  isConnected = false
  pendingFunctionCalls = []
  aiTranscriptBuffer = ''
  setStatus('Ready', 'idle')
  $('#mic-icon').classList.remove('hidden')
  $('#stop-icon').classList.add('hidden')
  $('#mic-hint').textContent = 'Tap to start talking'
}

// === REALTIME EVENTS ===
function handleRealtimeEvent(event) {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'input_audio_buffer.speech_started':
      setStatus('Listening...', 'listening')
      break
    case 'input_audio_buffer.speech_stopped':
      setStatus('Processing...', 'thinking')
      break
    case 'conversation.item.input_audio_transcription.completed':
      if (data.transcript) addTranscript('user', data.transcript.trim())
      break
    case 'response.audio_transcript.delta':
      aiTranscriptBuffer += (data.delta || '')
      break
    case 'response.audio_transcript.done':
      if (aiTranscriptBuffer.trim()) addTranscript('ai', aiTranscriptBuffer.trim())
      aiTranscriptBuffer = ''
      break
    case 'response.function_call_arguments.done':
      pendingFunctionCalls.push(data)
      break
    case 'response.created':
      setStatus('Speaking...', 'speaking')
      break
    case 'response.done':
      if (pendingFunctionCalls.length > 0) {
        executePendingFunctions()
      } else {
        if (isConnected) setStatus('Listening...', 'listening')
      }
      break
    case 'error':
      console.error('Realtime error:', data.error)
      setStatus('Error: ' + (data.error?.message || 'Unknown'), 'error')
      break
  }
}

async function executePendingFunctions() {
  const calls = [...pendingFunctionCalls]
  pendingFunctionCalls = []
  setStatus('Running ' + calls.length + ' tool(s)...', 'thinking')

  const results = await Promise.all(calls.map(async (data) => {
    const { call_id, name, arguments: argsStr } = data
    try {
      const args = JSON.parse(argsStr || '{}')
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, arguments: args }),
      })
      const { result, error } = await res.json()
      return { call_id, output: typeof result === 'string' ? result : JSON.stringify(result || error || 'No result') }
    } catch (err) {
      return { call_id, output: JSON.stringify({ error: err.message }) }
    }
  }))

  for (const { call_id, output } of results) {
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id, output },
    }))
  }
  dc.send(JSON.stringify({ type: 'response.create' }))
}

// === START ===
init()
