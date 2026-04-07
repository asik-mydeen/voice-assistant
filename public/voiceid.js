var VoiceID = (function() {
  var NUM_BANDS = 24
  var THRESHOLD = 0.78
  var SILENCE_THRESHOLD = -120

  function VoiceID() {
    this.profiles = JSON.parse(localStorage.getItem('voice_profiles') || '{}')
  }

  VoiceID.prototype.getProfiles = function() { return Object.assign({}, this.profiles) }
  VoiceID.prototype.hasProfile = function(name) { return !!this.profiles[name] }
  VoiceID.prototype.getEnrolledNames = function() { return Object.keys(this.profiles) }
  VoiceID.prototype.deleteProfile = function(name) { delete this.profiles[name]; this._save() }
  VoiceID.prototype._save = function() { localStorage.setItem('voice_profiles', JSON.stringify(this.profiles)) }

  VoiceID.prototype._bands = function(freqData, bufLen, sr) {
    var bands = new Array(NUM_BANDS).fill(0)
    var counts = new Array(NUM_BANDS).fill(0)
    var ny = sr / 2
    var maxMel = 2595 * Math.log10(1 + ny / 700)
    for (var i = 0; i < bufLen; i++) {
      var freq = (i / bufLen) * ny
      var mel = 2595 * Math.log10(1 + freq / 700)
      var b = Math.min(NUM_BANDS - 1, Math.floor((mel / maxMel) * NUM_BANDS))
      bands[b] += freqData[i] + 140
      counts[b]++
    }
    for (var i = 0; i < NUM_BANDS; i++) bands[i] = counts[i] ? bands[i] / counts[i] : 0
    // Spectral centroid + spread
    var ws = 0, te = 0, ws2 = 0
    for (var i = 0; i < bufLen; i++) {
      var e = Math.pow(10, freqData[i] / 20)
      ws += i * e; te += e; ws2 += i * i * e
    }
    var centroid = te > 0 ? ws / te / bufLen : 0
    var spread = te > 0 ? Math.sqrt(ws2 / te / (bufLen * bufLen) - centroid * centroid) : 0
    bands.push(centroid, spread)
    return bands
  }

  VoiceID.prototype._avg = function(frames) {
    if (!frames.length) return null
    var len = frames[0].length
    var avg = new Array(len).fill(0)
    for (var f = 0; f < frames.length; f++)
      for (var i = 0; i < len; i++) avg[i] += frames[f][i]
    for (var i = 0; i < len; i++) avg[i] /= frames.length
    return avg
  }

  VoiceID.prototype._cosine = function(a, b) {
    var dot = 0, nA = 0, nB = 0
    for (var i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i] }
    return nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0
  }

  // Record a single phrase and return frames
  VoiceID.prototype.recordPhrase = function(durationMs, onProgress) {
    return new Promise(function(resolve, reject) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        var ctx = new AudioContext()
        var source = ctx.createMediaStreamSource(stream)
        var analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.2
        source.connect(analyser)
        var bufLen = analyser.frequencyBinCount
        var freqData = new Float32Array(bufLen)
        var frames = []
        var elapsed = 0
        var self = this

        var iv = setInterval(function() {
          analyser.getFloatFrequencyData(freqData)
          var avg = 0
          for (var i = 0; i < bufLen; i++) avg += freqData[i]
          avg /= bufLen
          if (avg > SILENCE_THRESHOLD) {
            frames.push(self._bands(freqData, bufLen, ctx.sampleRate))
          }
          elapsed += 50
          if (onProgress) onProgress(elapsed / durationMs)
        }, 50)

        setTimeout(function() {
          clearInterval(iv)
          stream.getTracks().forEach(function(t) { t.stop() })
          ctx.close()
          resolve(frames)
        }, durationMs)
      }.bind(this)).catch(reject)
    }.bind(this))
  }

  // Guided enrollment with multiple phrases
  VoiceID.prototype.enrollWithPhrases = function(name, phraseFrames) {
    // Combine all frames from all phrases
    var allFrames = []
    for (var i = 0; i < phraseFrames.length; i++) {
      allFrames = allFrames.concat(phraseFrames[i])
    }
    if (allFrames.length < 10) throw new Error('Not enough voice data captured.')
    this.profiles[name] = this._avg(allFrames)
    this._save()
    return true
  }

  // Legacy single-shot enroll
  VoiceID.prototype.enroll = function(name, durationMs) {
    var self = this
    return this.recordPhrase(durationMs || 8000).then(function(frames) {
      if (frames.length < 10) throw new Error('Not enough voice data.')
      self.profiles[name] = self._avg(frames)
      self._save()
      return true
    })
  }

  VoiceID.prototype.identify = function(durationMs) {
    var self = this
    return this.recordPhrase(durationMs || 2500).then(function(frames) {
      if (frames.length < 3) return null
      var feat = self._avg(frames)
      var best = null, bestScore = -1
      var profiles = self.profiles
      for (var name in profiles) {
        if (!profiles.hasOwnProperty(name)) continue
        var s = self._cosine(feat, profiles[name])
        if (s > bestScore) { bestScore = s; best = name }
      }
      return bestScore >= THRESHOLD ? { name: best, score: bestScore } : null
    })
  }

  return VoiceID
})()
