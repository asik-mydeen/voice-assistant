// === STATE ===
var supabaseClient = null
var session = null
var pc = null
var dc = null
var audioEl = null
var isConnected = false
var pendingFunctionCalls = []
var aiTranscriptBuffer = ''
var currentSpeaker = null
var textInputResolve = null
var FAMILY = ['Asik', 'Nikkath', 'Aarish', 'Aaraa']

function $(s) { return document.querySelector(s) }

async function init() {
  try {
    var config = await fetch('/api/config').then(function(r) { return r.json() })
    if (!config.supabaseUrl || !config.supabaseAnonKey) return showLoginScreen()
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    var result = await supabaseClient.auth.getSession()
    if (result.data.session) { session = result.data.session; showVoiceScreen() } else { showLoginScreen() }
    supabaseClient.auth.onAuthStateChange(function(ev, s) {
      session = s
      if (ev === 'SIGNED_IN') showVoiceScreen()
      if (ev === 'SIGNED_OUT') showLoginScreen()
    })
  } catch (e) { console.error('Init error:', e); showLoginScreen() }
}

async function signIn() {
  if (!supabaseClient) await init()
  if (!supabaseClient) { alert('Unable to connect. Please refresh.'); return }
  supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}
function signOut() {
  disconnect()
  if (supabaseClient) supabaseClient.auth.signOut()
  session = null; currentSpeaker = null
  showLoginScreen()
}

function showLoginScreen() {
  $('#login-screen').classList.remove('hidden')
  $('#voice-screen').classList.add('hidden')
}
function showVoiceScreen() {
  $('#login-screen').classList.add('hidden')
  $('#voice-screen').classList.remove('hidden')
  setStatus('Tap the orb to start', 'idle')
  updateSpeakerBadge()
}
function setStatus(text, state) {
  $('#status-text').textContent = text
  document.body.dataset.state = state || 'idle'
}
function updateSpeakerBadge() {
  var badge = $('#speaker-badge')
  if (currentSpeaker) { badge.textContent = currentSpeaker; badge.classList.remove('hidden') }
  else { badge.classList.add('hidden') }
}
function addTranscript(role, text) {
  var el = document.createElement('div')
  el.className = 'msg ' + role
  var icon = role === 'user' ? '\uD83C\uDFA4' : '\uD83E\uDD16'
  el.innerHTML = '<span class="msg-role">' + icon + '</span><span class="msg-text">' + text + '</span>'
  $('#transcript').appendChild(el)
  $('#transcript-area').scrollTop = $('#transcript-area').scrollHeight
}

// === SPEAKER SELECT ===
function showSpeakerSelect() {
  $('#speaker-select').classList.remove('hidden')
}
function selectSpeaker(name) {
  currentSpeaker = name
  updateSpeakerBadge()
  $('#speaker-select').classList.add('hidden')
  connect()
}
function skipSpeaker() {
  currentSpeaker = null
  updateSpeakerBadge()
  $('#speaker-select').classList.add('hidden')
  connect()
}

// === TEXT INPUT ===
function showTextInput(prompt, type) {
  $('#text-input-prompt').textContent = prompt || 'Enter value:'
  var field = $('#text-input-field'); field.type = type || 'text'; field.value = ''
  $('#text-input-overlay').classList.remove('hidden'); field.focus()
  return new Promise(function(resolve) { textInputResolve = resolve })
}
function submitTextInput() {
  var val = $('#text-input-field').value
  $('#text-input-overlay').classList.add('hidden')
  if (textInputResolve) { textInputResolve(val); textInputResolve = null }
}

// === WEBRTC ===
function toggleConnection() {
  if (isConnected) { disconnect() } else { showSpeakerSelect() }
}

async function connect() {
  try {
    setStatus(currentSpeaker ? 'Hi ' + currentSpeaker + '! Connecting...' : 'Connecting...', 'connecting')

    var tokenRes = await fetch('/api/session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + session.access_token } })
    if (!tokenRes.ok) { var err = await tokenRes.json(); throw new Error(err.error || 'Session failed') }
    var sd = await tokenRes.json()

    pc = new RTCPeerConnection()
    audioEl = document.createElement('audio'); audioEl.autoplay = true
    pc.ontrack = function(e) { audioEl.srcObject = e.streams[0] }
    dc = pc.createDataChannel('oai-events')
    dc.onopen = function() {
      isConnected = true; setStatus('Listening...', 'listening')
      if (currentSpeaker) {
        dc.send(JSON.stringify({ type: 'session.update', session: { instructions: 'The current speaker is ' + currentSpeaker + '. Address them by name and personalize responses for this family member.' } }))
      }
    }
    dc.onclose = function() { disconnect() }
    dc.onmessage = handleRealtimeEvent
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    pc.addTrack(stream.getTracks()[0])
    var offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    var sdpRes = await fetch('https://api.openai.com/v1/realtime?model=' + sd.model, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + sd.client_secret, 'Content-Type': 'application/sdp' }, body: offer.sdp
    })
    if (!sdpRes.ok) throw new Error('Failed to connect to OpenAI')
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() })
  } catch (err) { console.error('Connection error:', err); setStatus('Error: ' + err.message, 'error'); disconnect() }
}

function disconnect() {
  if (pc) { pc.getSenders().forEach(function(s) { if (s.track) s.track.stop() }); pc.close(); pc = null }
  if (dc) { dc.close(); dc = null }
  if (audioEl) { audioEl.srcObject = null; audioEl = null }
  isConnected = false; pendingFunctionCalls = []; aiTranscriptBuffer = ''
  setStatus('Tap the orb to start', 'idle')
}

function handleRealtimeEvent(event) {
  var data = JSON.parse(event.data)
  switch (data.type) {
    case 'input_audio_buffer.speech_started': setStatus('Listening...', 'listening'); break
    case 'input_audio_buffer.speech_stopped': setStatus('Processing...', 'thinking'); break
    case 'conversation.item.input_audio_transcription.completed': if (data.transcript) addTranscript('user', data.transcript.trim()); break
    case 'response.audio_transcript.delta': aiTranscriptBuffer += (data.delta || ''); break
    case 'response.audio_transcript.done': if (aiTranscriptBuffer.trim()) addTranscript('ai', aiTranscriptBuffer.trim()); aiTranscriptBuffer = ''; break
    case 'response.function_call_arguments.done': if (data.name === 'request_text_input') handleTextInputCall(data); else pendingFunctionCalls.push(data); break
    case 'response.created': setStatus('Speaking...', 'speaking'); break
    case 'response.done': if (pendingFunctionCalls.length > 0) executePendingFunctions(); else if (isConnected) setStatus('Listening...', 'listening'); break
    case 'error': console.error('Realtime error:', data.error); setStatus('Error', 'error'); break
  }
}

async function handleTextInputCall(data) {
  var args = {}; try { args = JSON.parse(data.arguments || '{}') } catch(e) {}
  var value = await showTextInput(args.prompt, args.type)
  dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: data.call_id, output: value || '' } }))
  dc.send(JSON.stringify({ type: 'response.create' }))
}

async function executePendingFunctions() {
  var calls = pendingFunctionCalls.slice(); pendingFunctionCalls = []
  setStatus('Running tools...', 'thinking')
  var results = await Promise.all(calls.map(async function(data) {
    try {
      var args = JSON.parse(data.arguments || '{}')
      var res = await fetch('/api/tools/execute', { method: 'POST', headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.name, arguments: args }) })
      var json = await res.json()
      return { call_id: data.call_id, output: typeof json.result === 'string' ? json.result : JSON.stringify(json.result || json.error || 'No result') }
    } catch (err) { return { call_id: data.call_id, output: JSON.stringify({ error: err.message }) } }
  }))
  results.forEach(function(r) { dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: r.call_id, output: r.output } })) })
  dc.send(JSON.stringify({ type: 'response.create' }))
}

init()
