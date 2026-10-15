/*
 * Voltune Physical Engine v0.2 · unabhängiger Forschungsprototyp.
 * Kein Import/Override von VoltuneAudio. Legacy und v0.1 bleiben unangetastet.
 *
 * Hörfeedback 15.10.2026:
 * - Gute Tieftonbasis erhalten; V8 und R5 weniger synthetisch machen.
 * - EV hochfrequentes Synth-Pfeifen reduzieren.
 * - Hybrid als Referenz: EV zurückhaltend in den Motorraum integrieren.
 *
 * Vier-Takt-Zündfolge als diskrete Ereignisse; kurze Druckimpulse mit
 * Zweipol-Hüllkurve, gedämpfte Auspufflaufzeit, tonale Rohrresonanzen,
 * mechanische Körnung aus Impulsen statt unabhängigem Sägezahn/LFO.
 * Eigenständiger Soundentwurf, keine exakte Fahrzeugreproduktion.
 */
class VoltunePhysicalEngineV2 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 850, minValue: 500, maxValue: 9000, automationRate: "k-rate" },
      { name: "load", defaultValue: 0.20, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "exhaust", defaultValue: 0.55, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "evBlend", defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: "k-rate" }
    ];
  }

  constructor() {
    super();
    this.sr = sampleRate;
    this.mode = "hybrid";
    this.rpm = 850;
    this.load = 0.2;
    this.exhaust = 0.55;
    this.evBlend = 0.25;
    this.engineMix = 1;
    this.evMix = 0.17;
    this.firePhase = 0;
    this.event = 0;
    this.seed = 0x51ac7e91;

    const sr = this.sr;
    this.fastDecay = Math.exp(-1 / (sr * 0.00050));
    this.slowDecay = Math.exp(-1 / (sr * 0.0051));
    this.lowCoef = 1 - Math.exp(-2 * Math.PI * 95 / sr);
    this.midCoef = 1 - Math.exp(-2 * Math.PI * 255 / sr);
    this.airCoef = 1 - Math.exp(-2 * Math.PI * 1300 / sr);
    this.hpCoef = Math.exp(-2 * Math.PI * 22 / sr);
    this.reflectionCoef = 1 - Math.exp(-2 * Math.PI * 430 / sr);
    this.paramCoef = 1 - Math.exp(-1 / (sr * 0.05));
    this.evParamCoef = 1 - Math.exp(-1 / (sr * 0.045));

    this.banks = [
      this.makeBank(0.0082, 100, 155),
      this.makeBank(0.0069, 109, 182)
    ];

    // Rotor-Grundton, Unterordnung und leicht verschobene Obertöne.
    this.evPhases = new Float64Array([0.1, 1.4, 2.5, 0.6]);
    this.evLP = 0;
    this.evGrainLP = 0;
    this.evAirLP = 0;
    this.evBreathPhase = 0;
    this.evColor = 0;
    // DC-Sperre NACH der nichtlinearen Sättigung:
    // Unsymmetrische Zündimpulse können sonst Gleichanteile erzeugen.
    this.outPrevL = 0;
    this.outPrevR = 0;
    this.outHpL = 0;
    this.outHpR = 0;
    this.outHpCoef = Math.exp(-2 * Math.PI * 16 / sr);

    this.port.onmessage = (event) => {
      if (!event.data || event.data.type !== "preset") return;
      const mode = event.data.value;
      if (!["v8", "i5", "ev", "hybrid"].includes(mode)) return;
      if (this.mode !== mode) {
        this.mode = mode;
        this.firePhase = 0;
        this.event = 0;
        // Hall und Resonanzen dürfen langsam ausklingen; kein Hard Reset.
      }
    };
  }

  makeBank(pipeSeconds, resonanceHz, airResonanceHz) {
    const sr = this.sr;
    const r = Math.exp(-2 * Math.PI * 31 / sr);
    const theta = 2 * Math.PI * resonanceHz / sr;
    const r2 = Math.exp(-2 * Math.PI * 76 / sr);
    const theta2 = 2 * Math.PI * airResonanceHz / sr;
    return {
      fast: 0, slow: 0, low: 0, mid: 0, air: 0,
      reflect: 0, hpX: 0, hpY: 0,
      pipe: new Float32Array(Math.max(12, Math.round(sr * pipeSeconds))),
      pipePos: 0,
      r1: 0, r2: 0, q1: 0, q2: 0,
      a: 2 * r * Math.cos(theta), b: r * r,
      c: 2 * r2 * Math.cos(theta2), d: r2 * r2,
      drive1: 0.11 * (1 - r), drive2: 0.035 * (1 - r2)
    };
  }

  random() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 2147483648) - 1;
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const left = out[0];
    const right = out[1] || left;
    const targetRpm = Math.max(500, Math.min(9000, parameters.rpm[0]));
    const targetLoad = Math.max(0, Math.min(1, parameters.load[0]));
    const targetExhaust = Math.max(0, Math.min(1, parameters.exhaust[0]));
    const targetBlend = Math.max(0, Math.min(1, parameters.evBlend[0]));
    const useEV = this.mode === "ev";
    const useI5 = this.mode === "i5";
    const hybrid = this.mode === "hybrid";
    const targetEngineMix = useEV ? 0 : 1;
    // EV im Hybrid bleibt gezielt weiter im Hintergrund als bei v0.1.
    const targetEvMix = useEV ? 1.0 : (hybrid ? targetBlend * 0.58 : 0);
    const cylinders = useI5 ? 5 : 8;
    // Einfache plausible Crossplane-Bankfolge mit unregelmäßigen
    // Abständen pro Bank – keine spezifische OEM-Zündfolge.
    const v8Banks = [0, 1, 0, 0, 1, 0, 1, 1];
    const b0 = this.banks[0], b1 = this.banks[1];
    const gainSmoothing = this.paramCoef;

    for (let i = 0; i < left.length; i++) {
      this.rpm += gainSmoothing * (targetRpm - this.rpm);
      this.load += gainSmoothing * (targetLoad - this.load);
      this.exhaust += gainSmoothing * (targetExhaust - this.exhaust);
      this.evBlend += gainSmoothing * (targetBlend - this.evBlend);
      this.engineMix += gainSmoothing * (targetEngineMix - this.engineMix);
      this.evMix += gainSmoothing * (targetEvMix - this.evMix);
      const load = this.load;
      const rpm = this.rpm;

      const firingsPerSecond = rpm * cylinders / 120;
      this.firePhase += firingsPerSecond / this.sr;
      if (this.firePhase >= 1) {
        this.firePhase -= 1;
        const cyl = this.event % cylinders;
        // Kleine Ereignisvariation – nicht das harsche Sample-Rauschen aus v0.1.
        const variability = 1 + 0.045 * this.random();
        const cylinderGain = useI5
          ? [1.025, 0.97, 1.012, 0.96, 1.03][cyl]
          : [1.0, 0.976, 1.02, 0.995, 0.965, 1.025, 0.988, 1.015][cyl];
        const hit = (0.31 + 0.83 * Math.pow(load, 0.65)) * variability * cylinderGain;
        if (useI5) {
          // R5: gemeinsamer Abgaskanal, kein künstliches L/R-Bank-Stottern.
          b0.fast += hit;
          b0.slow += hit;
          b1.fast += hit * 0.72;
          b1.slow += hit * 0.72;
        } else {
          const b = v8Banks[cyl] ? b1 : b0;
          b.fast += hit;
          b.slow += hit;
        }
        this.event++;
      }

      const warm = 1.0 + load * 0.6;
      const brightness = Math.pow(this.exhaust, 1.8);
      const acoustic = [0, 0];
      for (let k = 0; k < 2; k++) {
        const b = k === 0 ? b0 : b1;
        b.fast *= this.fastDecay;
        b.slow *= this.slowDecay;
        // Druckpulse werden innerhalb weniger ms rund statt sägezahnförmig.
        const p = Math.max(0, b.slow - b.fast);

        b.low += this.lowCoef * (p - b.low);
        b.mid += this.midCoef * (p - b.mid);
        b.air += this.airCoef * (p - b.air);

        const delayed = b.pipe[b.pipePos];
        b.reflect += this.reflectionCoef * (delayed - b.reflect);
        b.pipe[b.pipePos] = Math.tanh(p * (0.80 + load * 0.12) + b.reflect * 0.51);
        b.pipePos++;
        if (b.pipePos === b.pipe.length) b.pipePos = 0;

        // Rohrresonanzen geben dem Impuls eine zweite, körperhafte Ebene.
        const r = b.a * b.r1 - b.b * b.r2 + b.drive1 * p;
        b.r2 = b.r1; b.r1 = r;
        const q = b.c * b.q1 - b.d * b.q2 + b.drive2 * (b.air - b.mid);
        b.q2 = b.q1; b.q1 = q;

        const body = 1.22 * b.low
          + 0.76 * (b.mid - b.low)
          + (0.12 + brightness * 0.26) * (b.air - b.mid)
          + (0.13 + 0.12 * brightness) * b.reflect
          + 0.65 * r + 0.35 * q;
        const hp = body - b.hpX + this.hpCoef * b.hpY;
        b.hpX = body; b.hpY = hp;
        acoustic[k] = Math.tanh(hp * warm * 2.25) * 0.50;
      }

      // Tiefes, texturiertes elektrisches Antriebsbett.
      // Reduzierte Obertöne; kein lauter Synth-Sweep im Hochtonbereich.
      let ev = 0;
      if (this.evMix > 0.00001 || useEV || hybrid) {
        const f = 28 + rpm * 0.020;
        const tau = Math.PI * 2 / this.sr;
        const partials = [0.52, 1.0, 1.975, 3.03];
        const levels = [0.18, 0.26, 0.085, 0.018];
        let tonal = 0;
        for (let h = 0; h < 4; h++) {
          this.evPhases[h] += tau * f * partials[h];
          if (this.evPhases[h] >= Math.PI * 2) this.evPhases[h] -= Math.PI * 2;
          tonal += Math.sin(this.evPhases[h]) * levels[h];
        }
        const noise = this.random();
        this.evGrainLP += 0.063 * (noise - this.evGrainLP);
        this.evAirLP += 0.008 * (noise - this.evAirLP);
        const airflow = this.evGrainLP - this.evAirLP;
        const strained = tonal * (0.29 + load * 0.68)
          + airflow * (0.08 + load * 0.23);
        // Frequenzgang wird mit steigender Last geöffnet, nicht mit RPM
        // unkontrolliert in den Hochton gezogen.
        const color = 1 - Math.exp(-2 * Math.PI * (390 + load * 300) / this.sr);
        this.evLP += color * (strained - this.evLP);
        this.evColor += 0.024 * (this.evLP - this.evColor);
        // Körnung und breiter Grundton statt einer einzelnen reinen Stimme.
        ev = this.evColor * 1.62 + (this.evLP - this.evColor) * 0.46;
      }

      const engineL = (acoustic[0] * 0.78 + acoustic[1] * 0.22) * this.engineMix;
      const engineR = (acoustic[1] * 0.78 + acoustic[0] * 0.22) * this.engineMix;
      const rawL = Math.tanh((engineL + this.evMix * ev * 0.74) * 1.2) * 0.70;
      const rawR = Math.tanh((engineR + this.evMix * ev * 0.74) * 1.2) * 0.70;
      const highL = rawL - this.outPrevL + this.outHpCoef * this.outHpL;
      const highR = rawR - this.outPrevR + this.outHpCoef * this.outHpR;
      this.outPrevL = rawL; this.outPrevR = rawR;
      this.outHpL = highL; this.outHpR = highR;
      left[i] = highL;
      if (right !== left) right[i] = highR;
    }
    return true;
  }
}

registerProcessor("voltune-physical-engine-v2", VoltunePhysicalEngineV2);
