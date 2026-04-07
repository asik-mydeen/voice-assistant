// === STATE ===
let supabaseClient = null
let session = null
let pc = null
let dc = null
let audioEl = null
let isConnected = false
let pendingFunctionCalls = []
let aiTranscriptBuffer = ''
let currentSpeaker = null
let voiceId = new VoiceID()
let textInputResolve = null
const FAMILY = ['Asik', 'Nikkath', 'Aarish', 'Aaraa']
const $ = (s) => document.querySelector(s)

// === INIT ===
async function init() {
  $('#login-btn').addEventListener('click', signIn)
  $('#logout-btn').addEventListener('click', signOut)
  $('#mic-btn').addEventListener('click', toggleConnection)
  $('#settings-btn').addEventListener('click', openSettings)
  $('#settings-close').addEventListener('click', closeSettings)
  $('#text-input-submit').addEventListener('click', submitTextInput)
  $('#text-input-field').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitTextInput() })
  $('#enroll-cancel').addEventListener('click', () => $('#enroll-overlay').classList.add('hidden'))

  try {
    const config = await fetch('/api/config').then(r => r.json())
    if (!config.supabaseUrl || !config.supabaseAnonKey) return showLoginScreen()
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    const { data: { session: existing } } = await supabaseClient.auth.getSession()
    if (existing) { session = existing; showVoiceScreen() } else { showLoginScreen() }
    supabaseClient.auth.onAuthStateChange((ev, s) => {
      session = s
      if (ev === 'SIGNED_IN') showVoiceScreen()
      if (ev === 'SIGNED_OUT') showLoginScreen()
    })
  } catch (e) { console.error('Init error:', e); showLoginScreen() }
}

// === AUTH ===
async function signIn() {
  if (!supabaseClient) return
  await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}
async function signOut() {
  disconnect()
  if (supabaseClient) await supabaseClient.auth.signOut()
  session = null; currentSpeaker = null
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
  updateSpeakerBadge()
}
function setStatus(text, state) {
  $('#status-text').textContent = text
  document.body.dataset.state = state || 'idle'
}
function updateSpeakerBadge() {
  const badge = $('#speaker-badge')
  if (currentSpeaker) {
    badge.textContent = currentSpeaker
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}
function addTranscript(role, text) {
  const el = document.createElement('div')
  el.className = 'msg ' + role
  el.innerHTML = '<span class="msg-role">' + (role === 'user' ? '🎤' : '🤖') + '</span><span class="msg-text">' + text + '</span>'
  $('#transcript').appendChild(el)
  $('#transcript-area').scrollTop = $('#transcript-area').scrollHeight
}

// === SETTINGS / VOICE PROFILES ===
function openSettings() {
  renderFamilyList()
  $('#settings-panel').classList.remove('hidden')
}
function closeSettings() { $('#settings-panel').classList.add('hidden') }

function renderFamilyList() {
  const list = $('#family-list')
  list.innerHTML = ''
  for (const name of FAMILY) {
    const enrolled = voiceId.hasProfile(name)
    const card = document.createElement('div')
    card.className = 'family-card'
    card.innerHTML = '<div class="fc-info"><span class="fc-name">' + name + '</span>' +
      '<span class="fc-status ' + (enrolled ? 'enrolled' : '') + '">' + (enrolled ? '✓ Enrolled' : 'Not enrolled') + '</span></div>' +
      '<div class="fc-actions">' +
      '<button class="btn-sm btn-enroll" data-name="' + name + '">' + (enrolled ? 'Re-enroll' : 'Enroll') + '</button>' +
      (enrolled ? '<button class="btn-sm btn-delete" data-name="' + name + '">✕</button>' : '') +
      '</div>'
    list.appendChild(card)
  }
  list.querySelectorAll('.btn-enroll').forEach(btn => btn.addEventListener('click', () => startEnrollment(btn.dataset.name)))
  list.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => { voiceId.deleteProfile(btn.dataset.name); renderFamilyList() }))
}

async function startEnrollment(name) {
  $('#enroll-overlay').classList.remove('hidden')
  $('#enroll-title').textContent = 'Enrolling ' + name
  $('#enroll-status').textContent = 'Speak naturally for 8 seconds...'
  $('#enroll-animation').classList.add('recording')
  try {
    await voiceId.enroll(name, 8000)
    $('#enroll-status').textContent = 'Done! Voice profile saved.'
    $('#enroll-animation').classList.remove('recording')
    setTimeout(() => { $('#enroll-overlay').classList.add('hidden'); renderFamilyList() }, 1500)
  } catch (e) {
    $('#enroll-status').textContent = 'Error: ' + e.message
    $('#enroll-animation').classList.remove('recording')
  }
}

// === TEXT INPUT ===
function showTextInput(prompt, type) {
  $('#text-input-prompt').textContent = prompt || 'Enter value:'
  const field = $('#text-input-field')
  field.type = type || 'text'
  field.value = ''
  $('#text-input-overlay').classList.remove('hidden')
  field.focus()
  return new Promise(resolve => { textInputResolve = resolve })
}
function submitTextInput() {
  const val = $('#text-input-field').value
  $('#text-input-overlay').classList.add('hidden')
  if (textInputResolve) { textInputResolve(val); textInputResolve = null }
}

// === WEBRTC ===
async function toggleConnection() {
  if (isConnected) { disconnect() } else { connect() }
}

async function connect() {
  try {
    // Voice ID check if profiles exist
    const hasProfiles = voiceId.getEnrolledNames().length > 0
    if (hasProfiles) {
      setStatus('Identifying voice...', 'connecting')
      const match = await voiceId.identify(2500)
      if (match) {
        currentSpeaker = match.name
        updateSpeakerBadge()
        setStatus('Hi ' + match.name + '! Connecting...', 'connecting')
      } else {
        currentSpeaker = null
        updateSpeakerBadge()
        setStatus('Voice not recognized. Connecting as guest...', 'connecting')
      }
    } else {
      setStatus('Connecting...', 'connecting')
    }

    const tokenRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + session.access_token },
    })
    if (!tokenRes.ok) { const err = await tokenRes.json(); throw new Error(err.error || 'Session failed') }
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
      // Inject speaker identity via session.update
      if (currentSpeaker) {
        dc.send(JSON.stringify({
          type: 'session.update',
          session: { instructions: 'The current speaker has been identified as ' + currentSpeaker + ' via voice recognition. Address them by name. Personalize responses for this family member.' }
        }))
      }
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
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() })
  } catch (err) {
    console.error('Connection error:', err)
    setStatus('Error: ' + err.message, 'error')
    disconnect()
  }
}

function disconnect() {
  if (pc) { pc.getSenders().forEach(s => { if (s.track) s.track.stop() }); pc.close(); pc = null }
  if (dc) { dc.close(); dc = null }
  if (audioEl) { audioEl.srcObject = null; audioEl = null }
  isConnected = false; pendingFunctionCalls = []; aiTranscriptBuffer = ''
  setStatus('Ready', 'idle')
  $('#mic-icon').classList.remove('hidden')
  $('#stop-icon').classList.add('hidden')
  $('#mic-hint').textContent = 'Tap to start talking'
}

// === REALTIME EVENTS ===
function handleRealtimeEvent(event) {
  const data = JSON.parse(event.data)
  switch (data.type) {
    case 'input_audio_buffer.speech_started': setStatus('Listening...', 'listening'); break
    case 'input_audio_buffer.speech_stopped': setStatus('Processing...', 'thinking'); break
    case 'conversation.item.input_audio_transcription.completed':
      if (data.transcript) addTranscript('user', data.transcript.trim()); break
    case 'response.audio_transcript.delta': aiTranscriptBuffer += (data.delta || ''); break
    case 'response.audio_transcript.done':
      if (aiTranscriptBuffer.trim()) addTranscript('ai', aiTranscriptBuffer.trim())
      aiTranscriptBuffer = ''; break
    case 'response.function_call_arguments.done':
      if (data.name === 'request_text_input') {
        handleTextInputCall(data)
      } else {
        pendingFunctionCalls.push(data)
      }
      break
    case 'response.created': setStatus('Speaking...', 'speaking'); break
    case 'response.done':
      if (pendingFunctionCalls.length > 0) { executePendingFunctions() }
      else { if (isConnected) setStatus('Listening...', 'listening') }
      break
    case 'error':
      console.error('Realtime error:', data.error)
      setStatus('Error: ' + (data.error?.message || 'Unknown'), 'error'); break
  }
}

async function handleTextInputCall(data) {
  const { call_id } = data
  let args = {}
  try { args = JSON.parse(data.arguments || '{}') } catch {}
  const value = await showTextInput(args.prompt, args.type)
  dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id, output: value || '' } }))
  dc.send(JSON.stringify({ type: 'response.create' }))
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
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, arguments: args }),
      })
      const { result, error } = await res.json()
      return { call_id, output: typeof result === 'string' ? result : JSON.stringify(result || error || 'No result') }
    } catch (err) { return { call_id, output: JSON.stringify({ error: err.message }) } }
  }))
  for (const { call_id, output } of results) {
    dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id, output } }))
  }
  dc.send(JSON.stringify({ type: 'response.create' }))
}

init()
