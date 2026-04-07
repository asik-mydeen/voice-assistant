var VoiceID = (function() {

  var NUM_BANDS = 24;
  var THRESHOLD = 0.78;
  var SILENCE_THRESHOLD = -100;
  var PHRASES = [
    'Hey Akisa, what\'s happening today?',
    'Remind me to pick up groceries at five pm',
    'Turn off the lights in the living room please',
    'What\'s the weather going to be like tomorrow?',
  ];

  function VoiceID() {
    this.profiles = JSON.parse(localStorage.getItem('voice_profiles') || '{}')
  }

  VoiceID.prototype.getPhrases = function() { return PHRASES.slice() }
  VoiceID.prototype.getProfiles = function() { return JSON.parse(JSON.stringify(this.profiles)) }
  VoiceID.prototype.hasProfile = function(name) { return !!this.profiles[name] }
  VoiceID.prototype.getEnrolledNames = function() { return Object.keys(this.profiles) }
  VoiceID.prototype.deleteProfile = function(name) { delete this.profiles[name]; this._save() }
  VoiceID.prototype._save = function() { localStorage.setItem('voice_profiles', JSON.stringify(this.profiles)) }

  // Start mic and return { analyser, stream, ctx }
  VoiceID.prototype._startMic = async function() {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    var ctx = new AudioContext()
    var source = ctx.createMediaStreamSource(stream)
    var analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.3
    source.connect(analyser)
    return { analyser: analyser, stream: stream, ctx: ctx }
  }

  VoiceID.prototype._stopMic = function(mic) {
    if (mic.stream) mic.stream.getTracks().forEach(function(t) { t.stop() })
    if (mic.ctx) mic.ctx.close()
  }

  // Capture features for durationMs, calls onLevel(0-1) for visual feedback
  VoiceID.prototype._capture = function(mic, durationMs, onLevel) {
    var self = this
    var analyser = mic.analyser
    var bufLen = analyser.frequencyBinCount
    var freqData = new Float32Array(bufLen)
    var frames = []

    return new Promise(function(resolve) {
      var iv = setInterval(function() {
        analyser.getFloatFrequencyData(freqData)
        var avg = 0
        for (var i = 0; i < bufLen; i++) avg += freqData[i]
        avg /= bufLen

        // Audio level for UI (normalize -100..-20 to 0..1)
        var level = Math.max(0, Math.min(1, (avg + 100) / 80))
        if (onLevel) onLevel(level)

        if (avg > SILENCE_THRESHOLD) {
          frames.push(self._bands(freqData, bufLen, mic.ctx.sampleRate))
        }
      }, 40) // 25 fps

      setTimeout(function() {
        clearInterval(iv)
        resolve(frames.length > 3 ? self._avg(frames) : null)
      }, durationMs)
    })
  }

  // Guided enrollment: records 4 phrases, returns combined profile
  // onStep(stepIndex, phrase, status) for UI updates
  // onLevel(0-1) for audio level viz
  VoiceID.prototype.enrollGuided = async function(name, onStep, onLevel) {
    var mic = await this._startMic()
    var allFrames = []
    var self = this

    try {
      for (var i = 0; i < PHRASES.length; i++) {
        if (onStep) onStep(i, PHRASES[i], 'ready')
        // Small pause before recording
        await self._delay(800)
        if (onStep) onStep(i, PHRASES[i], 'recording')

        // Capture 4.5 seconds per phrase
        var analyser = mic.analyser
        var bufLen = analyser.frequencyBinCount
        var freqData = new Float32Array(bufLen)
        var phraseFrames = []

        await new Promise(function(resolve) {
          var iv = setInterval(function() {
            analyser.getFloatFrequencyData(freqData)
            var avg = 0
            for (var j = 0; j < bufLen; j++) avg += freqData[j]
            avg /= bufLen
            var level = Math.max(0, Math.min(1, (avg + 100) / 80))
            if (onLevel) onLevel(level)
            if (avg > SILENCE_THRESHOLD) {
              phraseFrames.push(self._bands(freqData, bufLen, mic.ctx.sampleRate))
            }
          }, 40)
          setTimeout(function() { clearInterval(iv); resolve() }, 4500)
        })

        allFrames = allFrames.concat(phraseFrames)
        if (onStep) onStep(i, PHRASES[i], 'done')
      }

      self._stopMic(mic)

      if (allFrames.length < 10) throw new Error('Not enough voice data captured. Please try again in a quieter environment.')

      var profile = self._avg(allFrames)
      self.profiles[name] = profile
      self._save()
      return true
    } catch(e) {
      self._stopMic(mic)
      throw e
    }
  }

  // Quick identify (2.5s)
  VoiceID.prototype.identify = async function(durationMs) {
    var mic = await this._startMic()
    var feat = await this._capture(mic, durationMs || 2500)
    this._stopMic(mic)
    if (!feat) return null

    var best = null, bestScore = -1
    var profiles = this.profiles
    Object.keys(profiles).forEach(function(name) {
      var s = cosine(feat, profiles[name])
      if (s > bestScore) { bestScore = s; best = name }
    })
    return bestScore >= THRESHOLD ? { name: best, score: bestScore } : null
  }

  VoiceID.prototype._delay = function(ms) {
    return new Promise(function(r) { setTimeout(r, ms) })
  }

  VoiceID.prototype._bands = function(freqData, bufLen, sr) {
    var bands = new Array(NUM_BANDS).fill(0)
    var counts = new Array(NUM_BANDS).fill(0)
    var ny = sr / 2
    var maxMel = 2595 * Math.log10(1 + ny / 700)
    for (var i = 0; i < bufLen; i++) {
      var freq = (i / bufLen) * ny
      var mel = 2595 * Math.log10(1 + freq / 700)
      var b = Math.min(NUM_BANDS - 1, Math.floor((mel / maxMel) * NUM_BANDS))
      bands[b] += freqData[i] + 100
      counts[b]++
    }
    for (var i = 0; i < NUM_BANDS; i++) bands[i] = counts[i] ? bands[i] / counts[i] : 0
    // Spectral centroid
    var ws = 0, te = 0
    for (var i = 0; i < bufLen; i++) { var e = Math.pow(10, freqData[i] / 10); ws += i * e; te += e }
    bands.push(te > 0 ? ws / te / bufLen : 0)
    // Spectral spread
    var centroid = te > 0 ? ws / te : 0
    var spread = 0
    for (var i = 0; i < bufLen; i++) { var e = Math.pow(10, freqData[i] / 10); spread += e * Math.pow(i - centroid, 2) }
    bands.push(te > 0 ? Math.sqrt(spread / te) / bufLen : 0)
    return bands
  }

  VoiceID.prototype._avg = function(frames) {
    var len = frames[0].length
    var avg = new Array(len).fill(0)
    for (var f = 0; f < frames.length; f++) for (var i = 0; i < len; i++) avg[i] += frames[f][i]
    for (var i = 0; i < len; i++) avg[i] /= frames.length
    return avg
  }

  function cosine(a, b) {
    var dot = 0, nA = 0, nB = 0
    for (var i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i] }
    return nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0
  }

  return VoiceID
})()
