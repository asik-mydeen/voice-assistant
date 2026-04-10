const $ = (s) => document.querySelector(s)
let sbClient = null, session = null, pc = null, dc = null, audioEl = null
let isConnected = false, pendingCalls = [], aiTranscript = ''

async function init() {
  const config = await fetch('/api/config').then(r => r.json())
  sbClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
  const { data: { session: s } } = await sbClient.auth.getSession()
  if (s) { session = s; showVoice() } else { showLogin() }
  sbClient.auth.onAuthStateChange((ev, s) => {
    session = s
    if (ev === 'SIGNED_IN') showVoice()
    if (ev === 'SIGNED_OUT') showLogin()
  })
  $('#login-btn').onclick = () => sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })
  $('#logout-btn').onclick = async () => { await disconnect(); await sbClient.auth.signOut(); session = null; showLogin() }
  $('#mic-btn').onclick = () => isConnected ? disconnect() : connect()
}

function showLogin() { $('#login-screen').classList.remove('hidden'); $('#voice-screen').classList.add('hidden') }
function showVoice() { $('#login-screen').classList.add('hidden'); $('#voice-screen').classList.remove('hidden') }
function setStatus(t, s) { $('#status-text').textContent = t; document.body.dataset.state = s || 'idle' }

function addMsg(role, text) {
  const d = document.createElement('div')
  d.className = 'msg ' + role
  d.innerHTML = '<span class="msg-role">' + (role === 'user' ? '\uD83C\uDFA4' : '\uD83E\uDD16') + '</span><span class="msg-text">' + text + '</span>'
  $('#transcript').appendChild(d)
  $('#transcript-area').scrollTop = $('#transcript-area').scrollHeight
}

async function connect() {
  try {
    setStatus('Connecting...', 'connecting')
    const res = await fetch('/api/session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + session.access_token } })
    if (!res.ok) throw new Error((await res.json()).error || 'Session failed')
    const { client_secret, model } = await res.json()
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
    dc.onmessage = onEvent
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const sdp = await fetch('https://api.openai.com/v1/realtime?model=' + model, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + client_secret, 'Content-Type': 'application/sdp' },
      body: offer.sdp,
    })
    if (!sdp.ok) throw new Error('WebRTC handshake failed')
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() })
  } catch (e) {
    console.error(e)
    setStatus('Error: ' + e.message, 'error')
    disconnect()
  }
}

function disconnect() {
  if (pc) { pc.getSenders().forEach(s => { if (s.track) s.track.stop() }); pc.close(); pc = null }
  if (dc) { dc.close(); dc = null }
  if (audioEl) { audioEl.srcObject = null; audioEl = null }
  isConnected = false; pendingCalls = []; aiTranscript = ''
  setStatus('Ready', 'idle')
  $('#mic-icon').classList.remove('hidden')
  $('#stop-icon').classList.add('hidden')
  $('#mic-hint').textContent = 'Tap to start talking'
}

function onEvent(ev) {
  const d = JSON.parse(ev.data)
  switch (d.type) {
    case 'input_audio_buffer.speech_started': setStatus('Listening...', 'listening'); break
    case 'input_audio_buffer.speech_stopped': setStatus('Processing...', 'thinking'); break
    case 'conversation.item.input_audio_transcription.completed':
      if (d.transcript && d.transcript.trim()) addMsg('user', d.transcript.trim()); break
    case 'response.audio_transcript.delta': aiTranscript += d.delta || ''; break
    case 'response.audio_transcript.done':
      if (aiTranscript.trim()) addMsg('ai', aiTranscript.trim()); aiTranscript = ''; break
    case 'response.function_call_arguments.done': pendingCalls.push(d); break
    case 'response.created': setStatus('Speaking...', 'speaking'); break
    case 'response.done':
      if (pendingCalls.length > 0) runTools()
      else if (isConnected) setStatus('Listening...', 'listening')
      break
    case 'error': console.error('RT:', d.error); setStatus('Error: ' + (d.error && d.error.message || 'Unknown'), 'error'); break
  }
}

async function runTools() {
  const calls = pendingCalls.slice(); pendingCalls = []
  setStatus('Running ' + calls.length + ' tool(s)...', 'thinking')
  const results = await Promise.all(calls.map(async (c) => {
    try {
      const args = JSON.parse(c.arguments || '{}')
      const r = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, arguments: args }),
      })
      const j = await r.json()
      const out = j.result != null ? (typeof j.result === 'string' ? j.result : JSON.stringify(j.result)) : JSON.stringify(j.error || 'No result')
      return { call_id: c.call_id, output: out }
    } catch (e) { return { call_id: c.call_id, output: JSON.stringify({ error: e.message }) } }
  }))
  for (const r of results) {
    dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: r.call_id, output: r.output } }))
  }
  dc.send(JSON.stringify({ type: 'response.create' }))
}

init()
