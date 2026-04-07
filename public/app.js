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
var FAMILY = ['Asik', 'Nikkath', 'Aarish', 'Aaraa']

var ENROLL_PHRASES = [
  'The quick brown fox jumps over the lazy dog near the river bank',
  'Hey Akisa, please set a reminder to buy groceries from the store tomorrow',
  'I enjoy cooking dinner for my family every evening after a long day at work',
  'The weather today looks perfect for a nice walk in the park with friends',
]

try { voiceId = new VoiceID() } catch(e) { console.warn('VoiceID unavailable:', e) }

function $(s) { return document.querySelector(s) }
function $$(s) { return document.querySelectorAll(s) }

// === INIT ===
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

// === AUTH ===
function signIn() { if (supabaseClient) supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }) }
function signOut() { disconnect(); if (supabaseClient) supabaseClient.auth.signOut(); session = null; currentSpeaker = null; showLoginScreen() }

// === UI ===
function showLoginScreen() { $('#login-screen').classList.remove('hidden'); $('#voice-screen').classList.add('hidden') }
function showVoiceScreen() { $('#login-screen').classList.add('hidden'); $('#voice-screen').classList.remove('hidden'); setStatus('Tap the orb to start', 'idle'); updateSpeakerBadge() }
function setStatus(text, state) { $('#status-text').textContent = text; document.body.dataset.state = state || 'idle' }
function updateSpeakerBadge() {
  var badge = $('#speaker-badge')
  if (currentSpeaker) { badge.textContent = currentSpeaker; badge.classList.remove('hidden') }
  else { badge.classList.add('hidden') }
}
function addTranscript(role, text) {
  var el = document.createElement('div'); el.className = 'msg ' + role
  el.innerHTML = '<span class="msg-role">' + (role === 'user' ? '\u{1F3A4}' : '\u{1F916}') + '</span><span class="msg-text">' + text + '</span>'
  $('#transcript').appendChild(el); $('#transcript-area').scrollTop = $('#transcript-area').scrollHeight
}

// === SETTINGS ===
function openSettings() { renderFamilyList(); $('#settings-panel').classList.remove('hidden') }
function closeSettings() { $('#settings-panel').classList.add('hidden') }
function renderFamilyList() {
  var list = $('#family-list'); list.innerHTML = ''
  FAMILY.forEach(function(name) {
    var enrolled = voiceId && voiceId.hasProfile(name)
    var card = document.createElement('div'); card.className = 'family-card'
    card.innerHTML = '<div class="fc-info"><span class="fc-name">' + name + '</span>' +
      '<span class="fc-status ' + (enrolled ? 'enrolled' : '') + '">' + (enrolled ? '\u2713 Voice enrolled' : 'Not enrolled') + '</span></div>' +
      '<div class="fc-actions">' +
      '<button class="btn-sm btn-enroll" data-name="' + name + '">' + (enrolled ? 'Re-enroll' : 'Enroll Voice') + '</button>' +
      (enrolled ? '<button class="btn-sm btn-delete" data-name="' + name + '">\u2715</button>' : '') + '</div>'
    list.appendChild(card)
  })
  list.querySelectorAll('.btn-enroll').forEach(function(btn) { btn.addEventListener('click', function() { closeSettings(); startGuidedEnrollment(btn.dataset.name) }) })
  list.querySelectorAll('.btn-delete').forEach(function(btn) { btn.addEventListener('click', function() { voiceId.deleteProfile(btn.dataset.name); renderFamilyList() }) })
}

// === GUIDED ENROLLMENT ===
async function startGuidedEnrollment(name) {
  // Disconnect voice agent if connected
  if (isConnected) disconnect()

  var overlay = $('#enroll-overlay')
  overlay.classList.remove('hidden')
  $('#enroll-member-name').textContent = name

  // Build phrase cards
  var container = $('#enroll-phrases')
  container.innerHTML = ''
  ENROLL_PHRASES.forEach(function(phrase, i) {
    var div = document.createElement('div')
    div.className = 'enroll-phrase' + (i === 0 ? ' active' : '')
    div.id = 'phrase-' + i
    div.innerHTML = '<div class="phrase-header"><span class="phrase-num">' + (i + 1) + '/' + ENROLL_PHRASES.length + '</span>' +
      '<span class="phrase-status" id="phrase-status-' + i + '">\u23F3 Waiting</span></div>' +
      '<p class="phrase-text" id="phrase-text-' + i + '">' + buildWordSpans(phrase) + '</p>' +
      '<div class="phrase-progress"><div class="phrase-bar" id="phrase-bar-' + i + '"></div></div>'
    container.appendChild(div)
  })

  // Reset UI
  $('#enroll-done').classList.add('hidden')
  $('#enroll-recording').classList.remove('hidden')
  $('#enroll-step').textContent = 'Step 1 of ' + ENROLL_PHRASES.length
  $('#enroll-instruction').textContent = 'Read the highlighted phrase aloud'

  // Record each phrase
  var allFrames = []
  for (var i = 0; i < ENROLL_PHRASES.length; i++) {
    // Activate current phrase
    $$('.enroll-phrase').forEach(function(el) { el.classList.remove('active') })
    var phraseEl = $('#phrase-' + i)
    phraseEl.classList.add('active')
    phraseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    $('#enroll-step').textContent = 'Step ' + (i + 1) + ' of ' + ENROLL_PHRASES.length
    $('#phrase-status-' + i).textContent = '\u{1F534} Recording...'
    $('#phrase-status-' + i).className = 'phrase-status recording'

    // Animate word highlighting
    var words = phraseEl.querySelectorAll('.word')
    var totalWords = words.length
    var duration = 5000
    var wordInterval = duration / totalWords
    var wordTimer = setInterval(function() {
      var elapsed = performance.now() - startTime
      var wordIndex = Math.min(Math.floor(elapsed / wordInterval), totalWords - 1)
      words.forEach(function(w, wi) {
        w.classList.toggle('highlighted', wi <= wordIndex)
      })
    }, 50)
    var startTime = performance.now()

    // Record
    try {
      var frames = await voiceId.recordPhrase(duration, function(progress) {
        $('#phrase-bar-' + i).style.width = Math.min(100, progress * 100) + '%'
      })
      allFrames.push(frames)
    } catch(e) {
      console.error('Recording error:', e)
      allFrames.push([])
    }

    clearInterval(wordTimer)
    words.forEach(function(w) { w.classList.add('highlighted') })
    $('#phrase-bar-' + i).style.width = '100%'
    $('#phrase-status-' + i).textContent = '\u2713 Done'
    $('#phrase-status-' + i).className = 'phrase-status done'
    phraseEl.classList.add('completed')

    // Brief pause between phrases
    if (i < ENROLL_PHRASES.length - 1) {
      await new Promise(function(r) { setTimeout(r, 800) })
    }
  }

  // Save profile
  $('#enroll-recording').classList.add('hidden')
  try {
    var combined = []
    for (var j = 0; j < allFrames.length; j++) combined = combined.concat(allFrames[j])
    if (combined.length < 10) throw new Error('Not enough voice data')
    voiceId.enrollWithPhrases(name, allFrames)
    $('#enroll-done').classList.remove('hidden')
    $('#enroll-result').textContent = '\u2713 Voice profile saved for ' + name + '!'
    $('#enroll-result').className = 'enroll-result success'
  } catch(e) {
    $('#enroll-done').classList.remove('hidden')
    $('#enroll-result').textContent = '\u2717 ' + e.message + '. Please try again.'
    $('#enroll-result').className = 'enroll-result error'
  }
}

function buildWordSpans(text) {
  return text.split(' ').map(function(word) {
    return '<span class="word">' + word + '</span>'
  }).join(' ')
}

function closeEnrollment() { $('#enroll-overlay').classList.add('hidden') }

// === TEXT INPUT ===
function showTextInput(prompt, type) {
  $('#text-input-prompt').textContent = prompt || 'Enter value:'
  var field = $('#text-input-field'); field.type = type || 'text'; field.value = ''
  $('#text-input-overlay').classList.remove('hidden'); field.focus()
  return new Promise(function(resolve) { textInputResolve = resolve })
}
function submitTextInput() {
  var val = $('#text-input-field').value; $('#text-input-overlay').classList.add('hidden')
  if (textInputResolve) { textInputResolve(val); textInputResolve = null }
}

// === WEBRTC ===
function toggleConnection() { if (isConnected) { disconnect() } else { connect() } }

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
    var sessionData = await tokenRes.json()

    pc = new RTCPeerConnection()
    audioEl = document.createElement('audio'); audioEl.autoplay = true
    pc.ontrack = function(e) { audioEl.srcObject = e.streams[0] }

    dc = pc.createDataChannel('oai-events')
    dc.onopen = function() {
      isConnected = true; setStatus('Listening...', 'listening')
      if (currentSpeaker) {
        dc.send(JSON.stringify({ type: 'session.update', session: { instructions: 'The current speaker is ' + currentSpeaker + '. Address them by name and personalize responses.' } }))
      }
    }
    dc.onclose = function() { disconnect() }
    dc.onmessage = handleRealtimeEvent

    var stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    pc.addTrack(stream.getTracks()[0])

    var offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    var sdpRes = await fetch('https://api.openai.com/v1/realtime?model=' + sessionData.model, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + sessionData.client_secret, 'Content-Type': 'application/sdp' }, body: offer.sdp
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

// === REALTIME EVENTS ===
function handleRealtimeEvent(event) {
  var data = JSON.parse(event.data)
  switch (data.type) {
    case 'input_audio_buffer.speech_started': setStatus('Listening...', 'listening'); break
    case 'input_audio_buffer.speech_stopped': setStatus('Processing...', 'thinking'); break
    case 'conversation.item.input_audio_transcription.completed': if (data.transcript) addTranscript('user', data.transcript.trim()); break
    case 'response.audio_transcript.delta': aiTranscriptBuffer += (data.delta || ''); break
    case 'response.audio_transcript.done': if (aiTranscriptBuffer.trim()) addTranscript('ai', aiTranscriptBuffer.trim()); aiTranscriptBuffer = ''; break
    case 'response.function_call_arguments.done': if (data.name === 'request_text_input') { handleTextInputCall(data) } else { pendingFunctionCalls.push(data) }; break
    case 'response.created': setStatus('Speaking...', 'speaking'); break
    case 'response.done': if (pendingFunctionCalls.length > 0) { executePendingFunctions() } else { if (isConnected) setStatus('Listening...', 'listening') }; break
    case 'error': console.error('Realtime error:', data.error); setStatus('Error: ' + (data.error?.message || 'Unknown'), 'error'); break
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
