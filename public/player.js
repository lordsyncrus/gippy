class MIDIPlayer {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.synth = new SpessaSynth(this.context);
    this.tracks = [];
    this.division = 480; // default ticks per beat
    this.tempo = 1; // multiplier
    this.keyShift = 0;
    this.muteLead = false;
    this.isPlaying = false;
    this.startTime = 0;
    this.scheduled = [];
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const midi = this.parseMidi(arrayBuffer);
      this.tracks = midi.tracks;
      this.division = midi.division;
      console.log('Loaded MIDI with', this.tracks.length, 'tracks');
    };
    reader.readAsArrayBuffer(file);
  }

  play() {
    if (this.isPlaying || !this.tracks.length) return;
    this.isPlaying = true;
    this.startTime = this.context.currentTime;
    const tempo = 120; // default BPM
    const usPerBeat = 60000000 / tempo;
    const tickDuration = (usPerBeat / 1000000) / this.division;

    this.tracks.forEach((track, idx) => {
      if (idx === 0 && this.muteLead) return;
      track.events.forEach(ev => {
        const time = this.startTime + ev.time * tickDuration / this.tempo;
        if (ev.type === 0x90 && ev.velocity > 0) {
          const osc = this.synth.trigger(ev.note + this.keyShift, ev.velocity, time);
          this.scheduled.push(osc);
        }
      });
    });
  }

  stop() {
    this.scheduled.forEach(node => node.stop());
    this.scheduled = [];
    this.isPlaying = false;
  }

  setTempo(mult) {
    this.tempo = mult;
  }

  setKeyShift(semi) {
    this.keyShift = semi;
  }

  setMuteLead(mute) {
    this.muteLead = mute;
  }

  // Minimal MIDI parser for simple files
  parseMidi(buffer) {
    const data = new DataView(buffer);
    let offset = 0;
    const readStr = (len) => {
      let s = '';
      for (let i = 0; i < len; i++) s += String.fromCharCode(data.getUint8(offset++));
      return s;
    };
    const read32 = () => { const v = data.getUint32(offset); offset += 4; return v; };
    const read16 = () => { const v = data.getUint16(offset); offset += 2; return v; };
    const readVar = () => {
      let val = 0, b;
      do { b = data.getUint8(offset++); val = (val << 7) | (b & 0x7f); } while (b & 0x80);
      return val;
    };

    if (readStr(4) !== 'MThd') throw new Error('Invalid MIDI');
    const hdSize = read32();
    const format = read16();
    const ntrks = read16();
    const division = read16();
    offset += hdSize - 6;
    const tracks = [];

    for (let t = 0; t < ntrks; t++) {
      if (readStr(4) !== 'MTrk') throw new Error('Invalid Track');
      const size = read32();
      const end = offset + size;
      let time = 0;
      const events = [];
      let status = 0;
      while (offset < end) {
        time += readVar();
        let b = data.getUint8(offset++);
        if (b & 0x80) {
          status = b;
        } else {
          offset--; // running status
          b = status;
        }
        const type = b & 0xF0;
        switch (type) {
          case 0x80:
          case 0x90:
            const note = data.getUint8(offset++);
            const vel = data.getUint8(offset++);
            events.push({time, type, note, velocity: vel});
            break;
          case 0xC0:
          case 0xD0:
            offset++;
            break;
          case 0xA0:
          case 0xB0:
          case 0xE0:
            offset += 2;
            break;
          case 0xF0:
            if (b === 0xFF) {
              const meta = data.getUint8(offset++);
              const len = readVar();
              offset += len;
            } else {
              const len = readVar();
              offset += len;
            }
            break;
        }
      }
      tracks.push({events});
      offset = end;
    }
    return {format, tracks, division};
  }
}

const player = new MIDIPlayer();

document.getElementById('midi-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) player.loadFile(file);
});

document.getElementById('play').addEventListener('click', () => player.play());
document.getElementById('stop').addEventListener('click', () => player.stop());
document.getElementById('tempo').addEventListener('input', (e) => player.setTempo(parseFloat(e.target.value)));
document.getElementById('key').addEventListener('input', (e) => player.setKeyShift(parseInt(e.target.value)));
document.getElementById('mute-lead').addEventListener('change', (e) => player.setMuteLead(e.target.checked));
