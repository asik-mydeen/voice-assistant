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
var voiceId = null
var textInputResolve = null
var enrollAborted = false
var initDone = false
var FAMILY = ['Asik', 'Nikkath', 'Aarish', 'Aaraa']

try { voiceId = new VoiceID() } catch(e) { console.warn('VoiceID not available:', e) }

function $(s) { return document.querySelector(s) }

async function init() {
  if (initDone) return
  try {
    var config = await fetch('/api/config').then(function(r) { return r.json() })
    if (!config.supabaseUrl || !config.supabaseAnonKey) { showLoginScreen(); return }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    initDone = true
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
  if (!supabaseClient) { alert('Unable to connect. Please refresh and try again.'); return }
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

function openSettings() {
  renderFamilyList()
  $('#settings-panel').classList.remove('hidden')
}
function closeSettings() { $('#settings-panel').classList.add('hidden') }

function renderFamilyList() {
  var list = $('#family-list')
  list.innerHTML = ''
  FAMILY.forEach(function(name) {
    var enrolled = voiceId && voiceId.hasProfile(name)
    var card = document.createElement('div')
    card.className = 'family-card'
    card.innerHTML = '<div class="fc-info"><span class="fc-name">' + name + '</span>' +
      '<span class="fc-status ' + (enrolled ? 'enrolled' : '') + '">' + (enrolled ? '\u2713 Voice enrolled' : 'No voice profile') + '</span></div>' +
      '<div class="fc-actions">' +
      '<button class="btn-sm btn-enroll" data-name="' + name + '">' + (enrolled ? 'Re-enroll' : 'Enroll Voice') + '</button>' +
      (enrolled ? '<button class="btn-sm btn-delete" data-name="' + name + '">\u2715</button>' : '') + '</div>'
    list.appendChild(card)
  })
  list.querySelectorAll('.btn-enroll').forEach(function(btn) {
    btn.addEventListener('click', function() { closeSettings(); startGuidedEnrollment(btn.dataset.name) })
  })
  list.querySelectorAll('.btn-delete').forEach(function(btn) {
    btn.addEventListener('click', function() { voiceId.deleteProfile(btn.dataset.name); renderFamilyList() })
  })
}

async function startGuidedEnrollment(name) {
  enrollAborted = false
  var overlay = $('#enroll-overlay')
  overlay.classList.remove('hidden')
  var phrases = voiceId.getPhrases()
  var html = '<div class="enroll-header"><h2>Voice Enrollment</h2><p class="enroll-name">' + name + '</p></div>' +
    '<div class="enroll-progress"><div id="enroll-progress-bar"></div></div><div id="enroll-phrases">'
  phrases.forEach(function(phrase, i) {
    html += '<div class="enroll-phrase" id="phrase-' + i + '"><div class="ep-num">' + (i+1) + '</div><div class="ep-text">' + phrase + '</div><div class="ep-status">\u23F3</div></div>'
  })
  html += '</div><div id="enroll-level-container"><div id="enroll-level-bar"></div></div>' +
    '<div id="enroll-instruction">Get ready...</div>' +
    '<button class="btn-secondary" onclick="abortEnrollment()">Cancel</button>'
  overlay.querySelector('.panel').innerHTML = html

  try {
    await voiceId.enrollGuided(name,
      function(stepIdx, phrase, status) {
        if (enrollAborted) return
        var pct = status === 'done' ? ((stepIdx+1)/phrases.length*100) : (stepIdx/phrases.length*100)
        var bar = document.getElementById('enroll-progress-bar')
        if (bar) bar.style.width = pct + '%'
        phrases.forEach(function(_, j) {
          var el = document.getElementById('phrase-' + j)
          if (!el) return
          var st = el.querySelector('.ep-status')
          if (j < stepIdx) { el.className = 'enroll-phrase done'; st.textContent = '\u2713' }
          else if (j === stepIdx) {
            if (status === 'ready') { el.className = 'enroll-phrase active'; st.textContent = '\uD83C\uDFA4' }
            else if (status === 'recording') { el.className = 'enroll-phrase recording'; st.textContent = '\uD83D\uDD34' }
            else if (status === 'done') { el.className = 'enroll-phrase done'; st.textContent = '\u2713' }
          } else { el.className = 'enroll-phrase'; st.textContent = '\u23F3' }
        })
        var ins = document.getElementById('enroll-instruction')
        if (ins) {
          if (status === 'ready') ins.textContent = 'Get ready to read phrase ' + (stepIdx+1) + '...'
          else if (status === 'recording') ins.textContent = '\uD83D\uDD34 Read the highlighted phrase aloud'
          else if (status === 'done') ins.textContent = '\u2713 Great!'
        }
      },
      function(level) {
        var bar = document.getElementById('enroll-level-bar')
        if (bar) bar.style.width = Math.max(3, level * 100) + '%'
      }
    )
    if (!enrollAborted) {
      var ins = document.getElementById('enroll-instruction')
      if (ins) ins.innerHTML = '\u2705 <strong>Voice profile saved for ' + name + '!</strong>'
      var bar = document.getElementById('enroll-progress-bar')
      if (bar) bar.style.width = '100%'
      setTimeout(function() { overlay.classList.add('hidden') }, 2000)
    }
  } catch(e) {
    if (!enrollAborted) {
      var ins = document.getElementById('enroll-instruction')
      if (ins) ins.textContent = '\u274C ' + e.message
    }
  }
}
function abortEnrollment() { enrollAborted = true; $('#enroll-overlay').classList.add('hidden') }

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

function toggleConnection() { if (isConnected) disconnect(); else connect() }

async function connect() {
  try {
    var hasProfiles = voiceId && voiceId.getEnrolledNames().length > 0
    if (hasProfiles) {
      setStatus('Identifying...', 'connecting')
      var match = await voiceId.identify(2500)
      if (match) { currentSpeaker = match.name; updateSpeakerBadge(); setStatus('Hi ' + match.name + '!', 'connecting') }
      else { currentSpeaker = null; updateSpeakerBadge(); setStatus('Connecting...', 'connecting') }
    } else { setStatus('Connecting...', 'connecting') }

    var tokenRes = await fetch('/api/session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + session.access_token } })
    if (!tokenRes.ok) { var err = await tokenRes.json(); throw new Error(err.error || 'Session failed') }
    var sd = await tokenRes.json()

    pc = new RTCPeerConnection()
    audioEl = document.createElement('audio'); audioEl.autoplay = true
    pc.ontrack = function(e) { audioEl.srcObject = e.streams[0] }
    dc = pc.createDataChannel('oai-events')
    dc.onopen = function() {
      isConnected = true; setStatus('Listening...', 'listening')
      if (currentSpeaker) dc.send(JSON.stringify({ type: 'session.update', session: { instructions: 'The current speaker is ' + currentSpeaker + '. Address them by name and personalize responses.' } }))
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
