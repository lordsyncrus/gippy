class SpessaSynth {
  constructor(context) {
    this.context = context || new (window.AudioContext || window.webkitAudioContext)();
    this.output = this.context.destination;
  }

  trigger(note, velocity, time, duration = 1) {
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.frequency.value = freq;
    gain.gain.value = velocity / 127;
    osc.connect(gain).connect(this.output);
    osc.start(time);
    osc.stop(time + duration);
    return osc;
  }
}

if (typeof module !== 'undefined') {
  module.exports = SpessaSynth;
} else {
  window.SpessaSynth = SpessaSynth;
}
