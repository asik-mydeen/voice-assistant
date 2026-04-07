class VoiceID {
  constructor() {
    this.profiles = JSON.parse(localStorage.getItem('voice_profiles') || '{}')
    this.NUM_BANDS = 20
    this.THRESHOLD = 0.80
  }

  getProfiles() { return { ...this.profiles } }
  hasProfile(name) { return !!this.profiles[name] }
  getEnrolledNames() { return Object.keys(this.profiles) }

  deleteProfile(name) {
    delete this.profiles[name]
    localStorage.setItem('voice_profiles', JSON.stringify(this.profiles))
  }

  async captureFeatures(durationMs) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.3
    source.connect(analyser)
    const bufLen = analyser.frequencyBinCount
    const freqData = new Float32Array(bufLen)
    const frames = []
    return new Promise(resolve => {
      const iv = setInterval(() => {
        analyser.getFloatFrequencyData(freqData)
        const avg = freqData.reduce((s, v) => s + v, 0) / bufLen
        if (avg > -80) frames.push(this._bands(freqData, bufLen, ctx.sampleRate))
      }, 50)
      setTimeout(() => {
        clearInterval(iv)
        stream.getTracks().forEach(t => t.stop())
        ctx.close()
        resolve(frames.length > 5 ? this._avg(frames) : null)
      }, durationMs)
    })
  }

  _bands(freqData, bufLen, sr) {
    const bands = new Array(this.NUM_BANDS).fill(0)
    const counts = new Array(this.NUM_BANDS).fill(0)
    const ny = sr / 2
    const maxMel = 2595 * Math.log10(1 + ny / 700)
    for (let i = 0; i < bufLen; i++) {
      const freq = (i / bufLen) * ny
      const mel = 2595 * Math.log10(1 + freq / 700)
      const b = Math.min(this.NUM_BANDS - 1, Math.floor((mel / maxMel) * this.NUM_BANDS))
      bands[b] += freqData[i] + 100
      counts[b]++
    }
    for (let i = 0; i < this.NUM_BANDS; i++) bands[i] = counts[i] ? bands[i] / counts[i] : 0
    let ws = 0, te = 0
    for (let i = 0; i < bufLen; i++) { const e = Math.pow(10, freqData[i] / 10); ws += i * e; te += e }
    bands.push(te > 0 ? ws / te / bufLen : 0)
    return bands
  }

  _avg(frames) {
    const len = frames[0].length
    const avg = new Array(len).fill(0)
    for (const f of frames) for (let i = 0; i < len; i++) avg[i] += f[i]
    for (let i = 0; i < len; i++) avg[i] /= frames.length
    return avg
  }

  _cosine(a, b) {
    let dot = 0, nA = 0, nB = 0
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i] }
    return nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0
  }

  async enroll(name, durationMs = 8000) {
    const profile = await this.captureFeatures(durationMs)
    if (!profile) throw new Error('Not enough voice data. Speak more and try again.')
    this.profiles[name] = profile
    localStorage.setItem('voice_profiles', JSON.stringify(this.profiles))
    return true
  }

  async identify(durationMs = 2500) {
    const feat = await this.captureFeatures(durationMs)
    if (!feat) return null
    let best = null, bestScore = -1
    for (const [name, prof] of Object.entries(this.profiles)) {
      const s = this._cosine(feat, prof)
      if (s > bestScore) { bestScore = s; best = name }
    }
    return bestScore >= this.THRESHOLD ? { name: best, score: bestScore } : null
  }
}
