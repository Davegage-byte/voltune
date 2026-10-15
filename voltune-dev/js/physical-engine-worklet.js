/*
 * Voltune Physical Engine · eigenständiger Sound-Forschungsprototyp v0.1
 *
 * ABSICHTLICH NICHT mit VoltuneAudio verknüpft:
 * Alle bisherigen Soundprofile, Wankel-Loops, BOVs und Schubknaller
 * bleiben technisch und klanglich unverändert.
 *
 * Dieses Worklet rendert Zündereignisse auf Sample-Ebene und filtert
 * sie durch einfache virtuelle Ansaug-/Abgasresonatoren. Die Modelle
 * sind klangliche Experimente, keine Behauptung einer exakten
 * Simulation einer bestimmten Motorbaureihe.
 *
 * Die EV-Stimmen verwenden einen separaten Signalweg und können
 * später unabhängig verbessert oder mit dem Verbrenner kombiniert werden.
 */
class VoltunePhysicalEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 850, minValue: 500, maxValue: 9000, automationRate: "k-rate" },
      { name: "load", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "exhaust", defaultValue: 0.55, minValue: 0, maxValue: 1, automationRate: "k-rate" }
    ];
  }

  constructor() {
    super();
    this.sr = sampleRate;
    this.mode = "v8";
    this.firePhase = 0;
    this.eventIndex = 0;
    this.randomSeed = 0x51ac7e91;

    this.rpm = 850;
    this.load = 0.2;
    this.exhaust = 0.55;
    this.engineMix = 1;
    this.evMix = 0;

    this.energy = [0, 0];
    this.bass = [0, 0];
    this.body = [0, 0];
    this.edge = [0, 0];

    // Unterschiedliche Laufzeiten geben den virtuellen Abgaswegen
    // getrennte Resonanzen. Alle Buffer werden nur einmal angelegt.
    this.pipes = [
      new Float32Array(Math.round(this.sr * 0.0086)),
      new Float32Array(Math.round(this.sr * 0.0073))
    ];
    this.pipeIndex = [0, 0];
    this.hpPrevious = [0, 0];
    this.hpOutput = [0, 0];

    this.evPhase = [0, 1.3, 2.1, 0.4];
    this.evLfoPhase = 0;

    this.port.onmessage = (event) => {
      if (!event.data || event.data.type !== "preset") return;
      const next = event.data.value;
      if (["v8", "i5", "ev", "hybrid"].includes(next)) {
        this.mode = next;
        this.firePhase = 0;
        this.eventIndex = 0;
      }
    };
  }

  noise() {
    // Deterministischer Generator: keine zeitabhängigen
    // Random- oder DOM-Aufrufe im Audio-Rendering-Thread.
    let x = this.randomSeed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.randomSeed = x >>> 0;
    return (this.randomSeed / 2147483648) - 1;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const left = output[0];
    const right = output[1] || left;
    const length = left.length;

    const rpmTarget = Math.min(9000, Math.max(500, parameters.rpm[0]));
    const loadTarget = Math.min(1, Math.max(0, parameters.load[0]));
    const exhaustTarget = Math.min(1, Math.max(0, parameters.exhaust[0]));
    const targetEngine = this.mode === "ev" ? 0 : 1;
    const targetEV = this.mode === "ev" ? 1 : (this.mode === "hybrid" ? 0.55 : 0);

    const cylinders = this.mode === "i5" ? 5 : 8;
    // Die Bankfolge erzeugt beim Crossplane-V8 absichtlich
    // unregelmäßige Abstände innerhalb jedes Abgasstrangs.
    const banks = cylinders === 5
      ? [0, 1, 0, 0, 1]
      : [0, 1, 1, 0, 1, 0, 0, 1];

    for (let i = 0; i < length; i++) {
      this.rpm += (rpmTarget - this.rpm) * 0.00065;
      this.load += (loadTarget - this.load) * 0.0009;
      this.exhaust += (exhaustTarget - this.exhaust) * 0.0009;
      this.engineMix += (targetEngine - this.engineMix) * 0.0008;
      this.evMix += (targetEV - this.evMix) * 0.0008;

      const rpm = this.rpm;
      const load = this.load;
      // Viertaktmotor: Zündungen/s = RPM * Zylinderzahl / 120.
      this.firePhase += (rpm * cylinders / 120) / this.sr;

      if (this.firePhase >= 1) {
        this.firePhase -= 1;
        const bank = banks[this.eventIndex % cylinders];
        const perCylinder = 0.92 + 0.16 * this.noise();
        const fuel = (0.38 + load * 1.15) * perCylinder;
        this.energy[bank] += fuel;
        this.eventIndex++;
      }

      const decay = Math.exp(-1 / (this.sr * (0.0029 + load * 0.0018)));
      const bodyCutoff = 0.065 + this.exhaust * 0.095;
      const edgeCutoff = 0.22 + this.exhaust * 0.20;
      const feedback = 0.47 + this.exhaust * 0.17;
      const channels = [0, 0];

      for (let b = 0; b < 2; b++) {
        this.energy[b] *= decay;
        // Sehr kurze, leicht unterschiedliche Verbrennungsimpulse.
        // Anschließend entstehen tiefe und hohe Resonanzanteile.
        const excitation = this.energy[b] * (0.83 + this.noise() * 0.17);
        this.bass[b] += 0.020 * (excitation - this.bass[b]);
        this.body[b] += bodyCutoff * (excitation - this.body[b]);
        this.edge[b] += edgeCutoff * (excitation - this.edge[b]);

        const pipe = this.pipes[b];
        const p = this.pipeIndex[b];
        const echo = pipe[p];
        pipe[p] = Math.tanh(excitation * 0.8 + echo * feedback);
        this.pipeIndex[b] = p + 1 === pipe.length ? 0 : p + 1;

        const dry = 0.9 * this.bass[b]
          + (0.35 + this.exhaust * 0.3) * (this.body[b] - this.bass[b])
          + this.exhaust * 0.28 * (this.edge[b] - this.body[b]);
        const raw = dry + echo * (0.26 + 0.28 * this.exhaust);
        // DC entfernen, bevor der Ausgang begrenzt wird.
        const hp = raw - this.hpPrevious[b] + 0.997 * this.hpOutput[b];
        this.hpPrevious[b] = raw;
        this.hpOutput[b] = hp;
        channels[b] = Math.tanh(hp * (1.1 + load * 0.7)) * 0.48;
      }

      // Separate und jederzeit austauschbare EV-Synthese.
      // Diese frühen Stimmen sind NICHT als fertiger Voltune-EV-Sound gedacht.
      const f = 35 + rpm * 0.045;
      const ratios = [1, 1.99, 3.02, 4.97];
      const levels = [0.20, 0.105, 0.052, 0.026];
      let ev = 0;
      for (let h = 0; h < 4; h++) {
        this.evPhase[h] += (Math.PI * 2 * f * ratios[h]) / this.sr;
        if (this.evPhase[h] > Math.PI * 2) this.evPhase[h] -= Math.PI * 2;
        ev += Math.sin(this.evPhase[h]) * levels[h];
      }
      this.evLfoPhase += (Math.PI * 2 * 3.1) / this.sr;
      if (this.evLfoPhase > Math.PI * 2) this.evLfoPhase -= Math.PI * 2;
      ev *= (0.24 + load * 0.86)
        * (0.96 + 0.04 * Math.sin(this.evLfoPhase));

      // Leicht getrennte Abgasstränge, Elektroanteil mittig.
      const l = (channels[0] * 0.84 + channels[1] * 0.16) * this.engineMix + ev * this.evMix;
      const r = (channels[1] * 0.84 + channels[0] * 0.16) * this.engineMix + ev * this.evMix;
      left[i] = Math.tanh(l * 1.7) * 0.7;
      if (right !== left) right[i] = Math.tanh(r * 1.7) * 0.7;
    }
    return true;
  }
}

registerProcessor("voltune-physical-engine", VoltunePhysicalEngine);
