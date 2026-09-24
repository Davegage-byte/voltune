window.VoltuneAudio = (() => {
  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

    const volumeCurve = (percent) => {
      const normalized =
        clamp(
          Number(percent) / 100,
          0,
          1
        );
  
      return normalized * normalized;
    };

  // =========================
  // Sound-Profile
  // =========================
  //
  // Jede Klanggruppe hat eine eigene Auswahl.
  // Neue Varianten werden zentral hier ergänzt.
  // Die Oberfläche liest diese Liste automatisch
  // aus, sodass für neue Profile kein weiteres
  // Dropdown-Markup nötig ist.
  const SOUND_PROFILES = Object.freeze({
    idle: Object.freeze({
      voltune1: Object.freeze({
        label: "Voltune 1",
        frequencies: [61, 146, 289],
        highpass: 48,
        lowpass: 480,
        pulseHz: 0.86,
        pulseDepth: 0.055,
        textureGain: 0.14,
        presenceGain: 0.035,
        toneDepth: 55,
        gainScale: 1
      }),

      voltune2: Object.freeze({
        label: "Voltune 2",
        frequencies: [55, 131, 247],
        highpass: 43,
        lowpass: 405,
        pulseHz: 0.66,
        pulseDepth: 0.037,
        textureGain: 0.10,
        presenceGain: 0.020,
        toneDepth: 42,
        gainScale: 0.98
      }),

      voltune3: Object.freeze({
        label: "Voltune 3",
        frequencies: [47, 127, 311],
        highpass: 38,
        lowpass: 620,
        pulseHz: 0.47,
        pulseDepth: 0.074,
        textureGain: 0.19,
        presenceGain: 0.055,
        toneDepth: 105,
        gainScale: 1.04
      }),

      voltune4: Object.freeze({
        label: "Voltune 4 · Sentinel",
        frequencies: [43, 97, 233],
        highpass: 34,
        lowpass: 520,
        pulseHz: 0.39,
        pulseDepth: 0.032,
        textureGain: 0.045,
        presenceGain: 0.012,
        toneDepth: 28,
        gainScale: 0.38,
        sentinel: true
      }),

      voltune5: Object.freeze({
        label: "Voltune 5 · Muscle",
        frequencies: [48, 103, 211],
        highpass: 32,
        lowpass: 430,
        pulseHz: 0.72,
        pulseDepth: 0.028,
        textureGain: 0.025,
        presenceGain: 0.008,
        toneDepth: 18,
        gainScale: 0.18,
        muscle: true
      }),

      voltune6: Object.freeze({
        label: "Voltune 6 · Wankel JDM",
        frequencies: [54, 108, 162],
        highpass: 28,
        lowpass: 520,
        pulseHz: 0.72,
        pulseDepth: 0.010,
        textureGain: 0.006,
        presenceGain: 0.003,
        toneDepth: 8,
        gainScale: 0.025,
        wankel: true
      })
    }),

    drive: Object.freeze({
      voltune1: Object.freeze({
        label: "Voltune 1",
        frequencyScale: 1,
        harmonicRatio: 1.495,
        filterScale: 1,
        subScale: 1,
        gainScale: 1,
        inverterScale: 1,
        inverterPitchScale: 1,
        airScale: 1
      }),

      voltune2: Object.freeze({
        label: "Voltune 2",
        frequencyScale: 0.93,
        harmonicRatio: 1.38,
        filterScale: 0.86,
        subScale: 1.18,
        gainScale: 1.06,
        inverterScale: 0.72,
        inverterPitchScale: 0.88,
        airScale: 1.15
      }),

      voltune3: Object.freeze({
        label: "Voltune 3",
        frequencyScale: 0.98,
        harmonicRatio: 1.414,
        filterScale: 1.14,
        subScale: 0.92,
        gainScale: 0.98,
        inverterScale: 1.18,
        inverterPitchScale: 1.08,
        airScale: 1.38
      }),

      voltune4: Object.freeze({
        label: "Voltune 4 · Sentinel",
        frequencyScale: 0.86,
        harmonicRatio: 1.27,
        filterScale: 0.66,
        subScale: 1.26,
        gainScale: 0.48,
        inverterScale: 0.24,
        inverterPitchScale: 0.74,
        airScale: 0.10,
        sentinel: true
      }),

      voltune5: Object.freeze({
        label: "Voltune 5 · Muscle",
        frequencyScale: 0.74,
        harmonicRatio: 1.30,
        filterScale: 0.58,
        subScale: 1.35,
        gainScale: 0.24,
        inverterScale: 0.05,
        inverterPitchScale: 0.70,
        airScale: 0.05,
        muscle: true
      }),

      voltune6: Object.freeze({
        label: "Voltune 6 · Wankel JDM",
        frequencyScale: 0.70,
        harmonicRatio: 1.18,
        filterScale: 0.44,
        subScale: 1.00,
        gainScale: 0.018,
        inverterScale: 0.015,
        inverterPitchScale: 0.70,
        airScale: 0.03,
        wankelDrive: true
      })
    }),

    accel: Object.freeze({
      voltune1: Object.freeze({
        label: "Voltune 1",
        frequencyScale: 1,
        filterScale: 1,
        speedRiseScale: 1,
        gainScale: 1,
        pulseRateScale: 1,
        pulseDepthScale: 1
      }),

      voltune2: Object.freeze({
        label: "Voltune 2",
        frequencyScale: 0.88,
        filterScale: 0.80,
        speedRiseScale: 1.30,
        gainScale: 1.12,
        pulseRateScale: 0.78,
        pulseDepthScale: 1.28
      }),

      voltune3: Object.freeze({
        label: "Voltune 3",
        frequencyScale: 0.84,
        filterScale: 0.74,
        speedRiseScale: 0.62,
        gainScale: 0.88,
        pulseRateScale: 0.58,
        pulseDepthScale: 0.82,
        infiniteRise: true
      }),

      voltune4: Object.freeze({
        label: "Voltune 4 · Sentinel",
        frequencyScale: 0.72,
        filterScale: 0.52,
        speedRiseScale: 0.24,
        gainScale: 0.32,
        pulseRateScale: 0.42,
        pulseDepthScale: 0.38,
        sentinel: true
      }),

      voltune5: Object.freeze({
        label: "Voltune 5 · Muscle",
        frequencyScale: 0.66,
        filterScale: 0.48,
        speedRiseScale: 0.20,
        gainScale: 0.18,
        pulseRateScale: 0.32,
        pulseDepthScale: 0.25,
        muscle: true
      })
    }),

    regen: Object.freeze({
      voltune1: Object.freeze({
        label: "Voltune 1",
        frequencyScale: 1,
        harmonicRatio: 1.62,
        filterScale: 1,
        gainScale: 1,
        pulseRateScale: 1,
        pulseDepthScale: 1
      }),

      voltune2: Object.freeze({
        label: "Voltune 2",
        frequencyScale: 0.80,
        harmonicRatio: 1.38,
        filterScale: 0.78,
        gainScale: 1.10,
        pulseRateScale: 0.82,
        pulseDepthScale: 1.22
      }),

      voltune3: Object.freeze({
        label: "Voltune 3",
        frequencyScale: 0.78,
        harmonicRatio: 1.31,
        filterScale: 0.72,
        gainScale: 0.92,
        pulseRateScale: 0.66,
        pulseDepthScale: 0.88,
        infiniteFall: true
      }),

      voltune4: Object.freeze({
        label: "Voltune 4 · Sentinel",
        frequencyScale: 0.68,
        harmonicRatio: 1.22,
        filterScale: 0.55,
        gainScale: 0.34,
        pulseRateScale: 0.44,
        pulseDepthScale: 0.42,
        sentinel: true
      }),

      voltune5: Object.freeze({
        label: "Voltune 5 · Muscle",
        frequencyScale: 0.62,
        harmonicRatio: 1.24,
        filterScale: 0.50,
        gainScale: 0.16,
        pulseRateScale: 0.34,
        pulseDepthScale: 0.26,
        muscle: true
      })
    })
  });

  function getSoundProfile(
    category,
    key
  ) {
    const profiles =
      SOUND_PROFILES[category];

    if (!profiles) {
      return null;
    }

    return (
      profiles[key] ||
      profiles.voltune1 ||
      Object.values(profiles)[0]
    );
  }

  function getSoundProfiles() {
    const result = {};

    Object.entries(
      SOUND_PROFILES
    ).forEach(
      ([category, profiles]) => {
        result[category] =
          Object.entries(profiles).map(
            ([key, profile]) => ({
              key,
              label:
                profile.label ||
                key
            })
          );
      }
    );

    return result;
  }

  let ctx = null;
  let master = null;
  let compressor = null;
  let loudnessGain = null;
  let overrunBus = null;
  let limiter = null;
  let started = false;
  
  let muted = false;

  let base1, base2, sub;
  let baseGain1, baseGain2, subGain, baseFilter;

  let idle1, idle2, idle3;
  let idleGain, idle2Gain, idle3Gain;
  let idleHighpass, idleFilter;
  
  let idlePulseOsc, idlePulseDepth, idlePulseGain;
  let idleDriftOsc, idleDriftDepth;
  let idleToneOsc, idleToneDepth;
  let idlePitchDepth1, idlePitchDepth2, idlePitchDepth3;

  let inv1, inv2, inv3;
  let invGain1, invGain2, invGain3, invFilter;

  let driveOsc, driveGain, driveFilter;
  let drivePulseOsc, drivePulseDepth, drivePulseGain;
  
  let regenOsc1, regenOsc2, regenGain, regenFilter;
  let regenPulseOsc, regenPulseDepth, regenPulseGain;

  // Psychoakustische Shepard/Risset-Layer.
  // Die Stimmen laufen dauerhaft, sind aber nur
  // bei Voltune 3 hörbar.
  let accelRissetOsc = [];
  let accelRissetGain = [];
  let accelRissetBus = null;
  let accelRissetFilter = null;
  let accelRissetPhase = 0.18;

  let regenRissetOsc = [];
  let regenRissetGain = [];
  let regenRissetBus = null;
  let regenRissetFilter = null;
  let regenRissetPhase = 0.72;

  // Eigenständiger Voltune-4-Maschinenklang:
  // tiefer Körper + ungerade Resonanzen + FM/Puls.
  let sentinel1, sentinel2, sentinel3;
  let sentinelGain1, sentinelGain2, sentinelGain3;
  let sentinelFilter, sentinelBus;
  let sentinelFmOsc, sentinelFmDepth;
  let sentinelPulseOsc, sentinelPulseDepth, sentinelPulseGain;

  // Beschleunigung: nur die schnelle FM-Bewegung
  // wird zur Aufwärtsrampe. Der eigentliche
  // Fahr-/Lastton bleibt stabil.
  let sentinelRampPhase = 0;
  let sentinelRampActive = false;

  let lastSentinelImpulseAt = -9999;

  // Voltune 5 · Muscle
  // Eigenständiger synthetischer V8-artiger Kern.
  let muscle1, muscle2, muscle3;
  let muscleGain1, muscleGain2, muscleGain3;
  let muscleFilter, muscleBus, muscleDrive;
  let musclePulseOsc, musclePulseDepth, musclePulseGain;
  let muscleRumbleOsc, muscleRumbleDepth;
  let muscleIrregularOsc, muscleIrregularDepth;
  let muscleLastMode = "off";

  // Voltune 6 · Wankel JDM
  // Intern erzeugter Loop aus dem Sound-Generator-Ansatz.
  let wankelSource = null;
  let wankelGain = null;
  let wankelFilter = null;
  let wankelBuffer = null;
  const wankelReferenceRpm = 1600;

  let wankelDriveSource = null;
  let wankelDriveGain = null;
  let wankelDriveFilter = null;
  let wankelDriveBuffer = null;
  const wankelDriveReferenceRpm = 3000;

  let airSource, airGain, airFilter;
  let sharedNoiseBuffer = null;
  
  let overrunSoundMode =
    "synthetic";

  let overrunSampleBuffer =
    null;

  let overrunSampleUrl =
    null;

  const overrunSampleDefaultSettings = {
    frequency: 3.75,
    irregularity: 100,
    slowdown: 80,
    hitVolumeRandom: 30,
    rateRandom: 15,
    count: 0,
    triggerLoad: 0.95,
    triggerDrop: 0.65,
    cooldown: 700,
  
    volume: 100,
    rate: 100,
  
    startTrim: 300,
    endTrim: 0,
    attack: 0,
    fadeOut: 20,
  
    highpass: 30,
    lowpass: 18000,
    resonance: 7,
  
    bass: 3,
    mid: 0,
    treble: 0,
  
    drive: 10,
    echo: 8,
    echoDelay: 35,
    compress: 25
  };

    let overrunSampleSettings = {
    ...overrunSampleDefaultSettings
  };

  let lastAccel = 0;
  let lastBovAt = -9999;
  let bovPressure = 0;
  let bovArmed = false;
  let bovPeakAccel = 0;
  let lastOverrunAt = -9999;
  let overrunPeakAccel = 0;
  let overrunArmed = false;

  // Koordination DSG-Furzen ↔ Schubknallen
  let shiftBurbleUntil = 0;
  let pendingOverrun = null;

    // Konstantfahrt-Erkennung
  let steadySince = null;
  let cruiseQuiet = 0;
  let lastSoundUpdate = performance.now();

  function setTarget(param, value, time = 0.05) {
    if (!ctx) return;

    param.setTargetAtTime(
      value,
      ctx.currentTime,
      time
    );
  }

  function updateRissetLayer(
    oscillators,
    gains,
    bus,
    filter,
    phase,
    {
      minHz,
      octaves,
      level,
      filterHz
    }
  ) {
    if (
      !oscillators.length ||
      !gains.length ||
      !bus ||
      !filter
    ) {
      return;
    }

    const count =
      oscillators.length;

    for (
      let index = 0;
      index < count;
      index++
    ) {
      const position =
        (
          phase +
          index / count
        ) % 1;

      const frequency =
        minHz *
        Math.pow(
          2,
          position * octaves
        );

      // An beiden Enden des Frequenzfensters
      // verschwindet die Stimme vollständig.
      // Dadurch ist ihr Sprung von oben nach unten
      // beziehungsweise umgekehrt nicht hörbar.
      const window =
        Math.pow(
          Math.sin(
            Math.PI * position
          ),
          1.65
        );

      setTarget(
        oscillators[index].frequency,
        frequency,
        0.025
      );

      setTarget(
        gains[index].gain,
        Math.max(
          0.0001,
          window * 0.19
        ),
        0.035
      );
    }

    setTarget(
      filter.frequency,
      filterHz,
      0.08
    );

    setTarget(
      bus.gain,
      Math.max(
        0.0001,
        level
      ),
      0.055
    );
  }

  function updateSentinelMachine({
    active,
    baseHz,
    level,
    filterHz,
    pulseHz,
    pulseDepth,
    fmHz,
    fmDepth,
    rampOffset = 0,
    metal = 1
  }) {
    if (
      !sentinel1 ||
      !sentinelBus
    ) {
      return;
    }

    const safeBase =
      Math.max(
        28,
        Number(baseHz) || 42
      );

    setTarget(
      sentinel1.frequency,
      safeBase,
      0.045
    );

    // Bewusst keine saubere Oktave/Quinte:
    // die leicht "falschen" Verhältnisse geben
    // dem Klang seine maschinenartige Identität.
    setTarget(
      sentinel2.frequency,
      safeBase *
        (
          1.71 +
          metal * 0.04
        ) +
        5 +
        rampOffset,
      // Die Modulationsrampe soll klar hörbar sein
      // und nicht wieder weich nach unten "eiern".
      rampOffset !== 0
        ? 0.008
        : 0.045
    );

    setTarget(
      sentinel3.frequency,
      safeBase *
        (
          2.63 +
          metal * 0.10
        ) +
        11,
      0.045
    );

    setTarget(
      sentinelGain1.gain,
      active
        ? 0.72
        : 0.0001,
      0.055
    );

    setTarget(
      sentinelGain2.gain,
      active
        ? 0.34 +
          metal * 0.10
        : 0.0001,
      0.055
    );

    setTarget(
      sentinelGain3.gain,
      active
        ? 0.12 +
          metal * 0.08
        : 0.0001,
      0.055
    );

    setTarget(
      sentinelFilter.frequency,
      Math.max(
        180,
        filterHz
      ),
      0.06
    );

    setTarget(
      sentinelFmOsc.frequency,
      Math.max(
        0.05,
        fmHz
      ),
      0.06
    );

    // Reku darf weiter sinusförmig "eiern".
    // Bei Beschleunigung wird fmDepth = 0 gesetzt
    // und stattdessen rampOffset verwendet.
    setTarget(
      sentinelFmDepth.gain,
      active
        ? fmDepth
        : 0,
      0.04
    );

    setTarget(
      sentinelPulseOsc.frequency,
      Math.max(
        0.05,
        pulseHz
      ),
      0.05
    );

    const depth =
      clamp(
        pulseDepth,
        0,
        0.42
      );

    setTarget(
      sentinelPulseGain.gain,
      active
        ? 1 - depth
        : 1,
      0.05
    );

    setTarget(
      sentinelPulseDepth.gain,
      active
        ? depth
        : 0,
      0.05
    );

    setTarget(
      sentinelBus.gain,
      active
        ? Math.max(
            0.0001,
            level
          )
        : 0.0001,
      0.05
    );
  }

  function getSentinelRampOffset(
    active,
    dt,
    rateHz,
    depthHz
  ) {
    if (!active) {
      sentinelRampActive = false;
      sentinelRampPhase = 0;
      return 0;
    }

    if (!sentinelRampActive) {
      sentinelRampActive = true;
      sentinelRampPhase = 0;
    }

    // Nur aufwärts:
    // 0 -> Maximalwert, dann ohne Rückweg
    // direkt wieder bei 0 beginnen.
    sentinelRampPhase =
      (
        sentinelRampPhase +
        dt * rateHz
      ) % 1;

    return (
      sentinelRampPhase *
      depthHz
    );
  }

  function updateMuscleMachine({
    active,
    mode,
    rpmN,
    speedN,
    load,
    level,
    braking = 0
  }) {
    if (
      !muscle1 ||
      !muscleBus
    ) {
      return;
    }

    if (!active) {
      muscleLastMode = "off";

      setTarget(
        muscleBus.gain,
        0.0001,
        0.08
      );

      return;
    }

    const safeRpmN =
      clamp(
        rpmN,
        0,
        1.08
      );

    const safeLoad =
      clamp(
        load,
        0,
        1
      );

    const safeBrake =
      clamp(
        braking,
        0,
        1
      );

    // Die starke Leerlauf-Unruhe nur noch im
    // echten Stand-/Schrittgeschwindigkeitsbereich.
    // 0.037 entspricht ungefähr 10 km/h.
    const idleAmount =
      1 -
      clamp(
        speedN / 0.037,
        0,
        1
      );

    // Kein klassischer sauberer Synth-Grundton:
    // wir simulieren eine niedrige Verbrennungs-/Abgasfrequenz,
    // die mit virtueller Drehzahl dichter wird.
    const firingHz =
      46 +
      safeRpmN * 245 +
      safeLoad * 24;

    // Sehr kleine Verstimmungen sorgen für das
    // "unsaubere" Zusammenlaufen der Zylindergruppen.
    const irregularity =
      1 +
      idleAmount * 0.010 +
      safeLoad * 0.004;

    setTarget(
      muscle1.frequency,
      firingHz,
      0.035
    );

    setTarget(
      muscle2.frequency,
      firingHz *
        (
          0.502 *
          irregularity
        ),
      0.045
    );

    setTarget(
      muscle3.frequency,
      firingHz *
        (
          1.49 -
          idleAmount * 0.018
        ),
      0.045
    );

    // Im Leerlauf viel Körper und deutliches Blubbern.
    // Unter Last wird der Klang härter und obertonreicher.
    setTarget(
      muscleGain1.gain,
      0.46 +
        idleAmount * 0.20 +
        safeLoad * 0.10,
      0.06
    );

    setTarget(
      muscleGain2.gain,
      0.38 +
        idleAmount * 0.22 -
        safeLoad * 0.08,
      0.06
    );

    setTarget(
      muscleGain3.gain,
      0.10 +
        safeLoad * 0.24 +
        safeRpmN * 0.10,
      0.06
    );

    // Dumpf im Stand, unter Last öffnet sich der Auspuffcharakter.
    setTarget(
      muscleFilter.frequency,
      330 +
        safeRpmN * 980 +
        safeLoad * 620 -
        safeBrake * 180,
      0.065
    );

    // Sättigung: mehr Gas = rauer.
    setTarget(
      muscleDrive.gain,
      0.82 +
        safeLoad * 0.48 +
        safeRpmN * 0.12,
      0.05
    );

    // Der eigentliche "Blubber"-Puls.
    // Leerlauf bewusst langsam und stark,
    // mit steigender Drehzahl dichter und etwas flacher.
    const pulseHz =
      7.2 +
      safeRpmN * 24 +
      safeLoad * 6.5;

    setTarget(
      musclePulseOsc.frequency,
      pulseHz,
      0.08
    );

    const pulseDepth =
      clamp(
        0.20 -
          safeRpmN * 0.08 +
          idleAmount * 0.07 +
          safeBrake * 0.05,
        0.08,
        0.29
      );

    setTarget(
      musclePulseGain.gain,
      1 - pulseDepth,
      0.08
    );

    setTarget(
      musclePulseDepth.gain,
      pulseDepth,
      0.08
    );

    // Langsame "Nockenwellen"-Unruhe.
    // Zwei nicht zueinander passende Modulatoren,
    // damit der Idle nicht periodisch sauber klingt.
    setTarget(
      muscleRumbleOsc.frequency,
      1.55 +
        safeRpmN * 1.10,
      0.10
    );

    setTarget(
      muscleRumbleDepth.gain,
      idleAmount *
        3.2 +
        safeBrake * 1.6,
      0.10
    );

    setTarget(
      muscleIrregularOsc.frequency,
      2.35 +
        safeRpmN * 1.60,
      0.10
    );

    setTarget(
      muscleIrregularDepth.gain,
      idleAmount *
        2.1 +
        safeLoad * 1.2,
      0.10
    );

    // Reku/Schubbetrieb: etwas dumpferes Brabbeln,
    // nicht wie ein elektrischer Generator.
    const modeScale =
      mode === "regen"
        ? 0.82
        : mode === "idle"
          ? 0.94
          : 1;

    muscleLastMode =
      mode;

    setTarget(
      muscleBus.gain,
      Math.max(
        0.0001,
        level * modeScale
      ),
      0.065
    );
  }

  function triggerSentinelImpulse(
    direction,
    intensity
  ) {
    if (
      !ctx ||
      !master
    ) {
      return;
    }

    const nowMs =
      performance.now();

    if (
      nowMs -
        lastSentinelImpulseAt <
      650
    ) {
      return;
    }

    lastSentinelImpulseAt =
      nowMs;

    const amount =
      clamp(
        intensity,
        0,
        1
      );

    const now =
      ctx.currentTime;

    const carrier =
      ctx.createOscillator();

    carrier.type =
      "triangle";

    const subCarrier =
      ctx.createOscillator();

    subCarrier.type =
      "sine";

    if (direction > 0) {
      carrier.frequency.setValueAtTime(
        520 +
          amount * 170,
        now
      );

      carrier.frequency.exponentialRampToValueAtTime(
        118 +
          amount * 34,
        now + 0.22
      );

      subCarrier.frequency.setValueAtTime(
        96 +
          amount * 18,
        now
      );

      subCarrier.frequency.exponentialRampToValueAtTime(
        48,
        now + 0.24
      );
    } else {
      carrier.frequency.setValueAtTime(
        150 +
          amount * 30,
        now
      );

      carrier.frequency.exponentialRampToValueAtTime(
        410 +
          amount * 110,
        now + 0.18
      );

      subCarrier.frequency.setValueAtTime(
        62,
        now
      );

      subCarrier.frequency.exponentialRampToValueAtTime(
        92 +
          amount * 16,
        now + 0.20
      );
    }

    const filter =
      ctx.createBiquadFilter();

    filter.type =
      "bandpass";

    filter.frequency.value =
      direction > 0
        ? 310
        : 260;

    filter.Q.value =
      1.5;

    const gain =
      ctx.createGain();

    const peak =
      0.030 +
      amount * 0.095;

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      peak,
      now + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
      peak * 0.58,
      now + 0.075
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.27
    );

    const subGainLocal =
      ctx.createGain();

    subGainLocal.gain.value =
      0.48;

    carrier
      .connect(filter);

    subCarrier
      .connect(subGainLocal)
      .connect(filter);

    filter
      .connect(gain)
      .connect(master);

    carrier.start(now);
    subCarrier.start(now);

    carrier.stop(
      now + 0.30
    );

    subCarrier.stop(
      now + 0.30
    );
  }

  function createNoiseBuffer(seconds = 2) {
    const length =
      Math.floor(ctx.sampleRate * seconds);

    const buffer =
      ctx.createBuffer(1, length, ctx.sampleRate);

    const data =
      buffer.getChannelData(0);

    let last = 0;

    for (let i = 0; i < length; i++) {
      const white =
        Math.random() * 2 - 1;

      last =
        last * 0.82 +
        white * 0.18;

      data[i] =
        white * 0.68 +
        last * 0.32;
    }

    return buffer;
  }

  async function loadAudioBuffer(
    url
  ) {
    try {
      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      return await ctx.decodeAudioData(
        arrayBuffer
      );
    } catch (error) {
      console.warn(
        "Voltune Sample konnte nicht geladen werden:",
        url,
        error
      );

      return null;
    }
  }

function getSettingsUrlForAudio(
  audioUrl
) {
  return audioUrl.replace(
    /\.[^/.]+$/,
    ".txt"
  );
}


  async function loadSampleSettings(
  audioUrl,
  defaults
) {
  const settingsUrl =
    getSettingsUrlForAudio(
      audioUrl
    );

  try {
    const response =
      await fetch(
        settingsUrl
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    const settings = {
      ...defaults
    };

    text
      .split(/\r?\n/)
      .forEach(line => {
        const trimmed =
          line.trim();

        if (
          !trimmed ||
          !trimmed.includes("=")
        ) {
          return;
        }

        const separator =
          trimmed.indexOf("=");

        const key =
          trimmed
            .slice(
              0,
              separator
            )
            .trim();

        const rawValue =
          trimmed
            .slice(
              separator + 1
            )
            .trim();

        // Diese Angaben aus dem Testlabor
        // brauchen wir in Voltune nicht.
        if (
          key === "file"
        ) {
          return;
        }

        if (
          !Object.prototype
            .hasOwnProperty
            .call(
              settings,
              key
            )
        ) {
          return;
        }

        const value =
          Number(
            rawValue
          );

        if (
          Number.isFinite(
            value
          )
        ) {
          settings[key] =
            value;
        }
      });

    return settings;

  } catch (error) {
    console.warn(
      "Voltune Sample-Einstellungen konnten nicht geladen werden:",
      settingsUrl,
      error
    );

    // Keine TXT vorhanden:
    // einfach mit den Standardwerten weiter.
    return {
      ...defaults
    };
  }
}


async function setOverrunSound(
  value
) {
  const selected =
    typeof value === "string"
      ? value
      : "synthetic";

  if (
    !selected ||
    selected === "synthetic"
  ) {
    overrunSoundMode =
      "synthetic";

    overrunSampleUrl =
      null;

    overrunSampleBuffer =
      null;

    overrunSampleSettings = {
      ...overrunSampleDefaultSettings
    };

    return true;
  }


  overrunSoundMode =
    "sample";

  overrunSampleUrl =
    selected;

  overrunSampleBuffer =
    null;

  overrunSampleSettings = {
    ...overrunSampleDefaultSettings
  };


  // Wurde Voltune noch nicht gestartet,
  // merken wir zunächst nur die Auswahl.
  // Beim Audio-Start wird sie dann geladen.
  if (!ctx) {
    return true;
  }


  const buffer =
    await loadAudioBuffer(
      overrunSampleUrl
    );

  if (!buffer) {
    return false;
  }


  const settings =
    await loadSampleSettings(
      overrunSampleUrl,
      overrunSampleDefaultSettings
    );


  overrunSampleBuffer =
    buffer;

  overrunSampleSettings =
    settings;

  return true;
}
  
  async function resumeContextWithTimeout(
    audioContext,
    timeoutMs = 1400
  ) {
    if (!audioContext) {
      return false;
    }

    if (audioContext.state === "running") {
      return true;
    }

    let timeoutId = null;

    const timeoutPromise =
      new Promise(resolve => {
        timeoutId =
          window.setTimeout(
            () => resolve(false),
            timeoutMs
          );
      });

    try {
      const resumePromise =
        Promise.resolve(
          audioContext.resume()
        ).then(
          () =>
            audioContext.state ===
            "running"
        );

      const result =
        await Promise.race([
          resumePromise,
          timeoutPromise
        ]);

      window.clearTimeout(
        timeoutId
      );

      return Boolean(result);

    } catch (error) {
      window.clearTimeout(
        timeoutId
      );

      console.warn(
        "AudioContext resume fehlgeschlagen:",
        error
      );

      return false;
    }
  }

  function createWankelTestBuffer() {
    const sampleRate =
      ctx.sampleRate;

    const rpm =
      wankelReferenceRpm;

    const shaftHz =
      rpm / 60;

    const rotorFireHz =
      shaftHz * 2;

    const brapHz =
      4.42;

    // Ganze Anzahl BRAP-Zyklen für sauberen Loop.
    const cycles =
      18;

    const duration =
      cycles / brapHz;

    const length =
      Math.round(
        duration * sampleRate
      );

    const buffer =
      ctx.createBuffer(
        2,
        length,
        sampleRate
      );

    const left =
      buffer.getChannelData(0);

    const right =
      buffer.getChannelData(1);

    let seed =
      787;

    const random = () => {
      seed |= 0;
      seed =
        seed + 0x6D2B79F5 | 0;

      let value =
        Math.imul(
          seed ^ seed >>> 15,
          1 | seed
        );

      value =
        value +
        Math.imul(
          value ^ value >>> 7,
          61 | value
        ) ^
        value;

      return (
        (
          value ^
          value >>> 14
        ) >>> 0
      ) / 4294967296;
    };

    const addTone = (
      channel,
      start,
      frequency,
      amplitude,
      decay,
      phase = 0
    ) => {
      const count =
        Math.min(
          channel.length - start,
          Math.ceil(
            decay *
            sampleRate *
            6
          )
        );

      const step =
        Math.PI *
        2 *
        frequency /
        sampleRate;

      for (
        let n = 0;
        n < count;
        n++
      ) {
        const time =
          n /
          sampleRate;

        channel[start + n] +=
          Math.sin(
            step * n +
            phase
          ) *
          Math.exp(
            -time / decay
          ) *
          amplitude;
      }
    };

    const addDarkBurst = (
      channel,
      start,
      amplitude,
      seconds,
      decay
    ) => {
      const count =
        Math.min(
          channel.length - start,
          Math.round(
            sampleRate *
            seconds
          )
        );

      let smooth =
        0;

      for (
        let n = 0;
        n < count;
        n++
      ) {
        const white =
          random() * 2 - 1;

        smooth +=
          (
            white -
            smooth
          ) *
          0.035;

        channel[start + n] +=
          smooth *
          Math.exp(
            -(
              n /
              sampleRate
            ) /
            decay
          ) *
          amplitude;
      }
    };

    // Tiefer Rotor-Motorkern.
    const rotorInterval =
      1 /
      rotorFireHz;

    const rotorEvents =
      Math.ceil(
        duration /
        rotorInterval
      ) +
      16;

    for (
      let event = -8;
      event < rotorEvents;
      event++
    ) {
      const rotor =
        (
          (
            event % 2
          ) +
          2
        ) %
        2;

      const start =
        Math.round(
          (
            event *
            rotorInterval +
            (
              random() *
              2 -
              1
            ) *
            rotorInterval *
            0.020
          ) *
          sampleRate
        );

      if (
        start < 0 ||
        start >= length
      ) {
        continue;
      }

      const side =
        rotor
          ? right
          : left;

      const other =
        rotor
          ? left
          : right;

      const amp =
        0.39 *
        (
          0.90 +
          random() *
          0.20
        );

      addTone(
        side,
        start,
        56 +
          random() * 5,
        amp * 0.52,
        0.105,
        random() * 0.6
      );

      addTone(
        side,
        start,
        72 +
          random() * 8,
        amp * 0.43,
        0.078,
        random() * 0.9
      );

      addTone(
        other,
        start,
        92 +
          random() * 7,
        amp * 0.18,
        0.052,
        random() * 1.1
      );
    }

    // Separater BRAP-Bus direkt in die Loopdaten.
    const brapPeriod =
      1 /
      brapHz;

    const stumble = [
       0.00,
       0.08,
      -0.03,
       0.03,
       0.13,
      -0.06,
       0.02,
      -0.02
    ];

    const strength = [
      1.00,
      0.90,
      1.08,
      0.94,
      0.80,
      1.10,
      0.91,
      1.03
    ];

    let brapTime =
      -2 *
      brapPeriod;

    let brapIndex =
      0;

    while (
      brapTime <
      duration +
      brapPeriod
    ) {
      const phase =
        (
          (
            brapIndex %
            stumble.length
          ) +
          stumble.length
        ) %
        stumble.length;

      brapTime +=
        brapPeriod *
        Math.max(
          0.82,
          1 +
          stumble[phase] *
          0.46 +
          (
            random() *
            2 -
            1
          ) *
          0.0046
        );

      const start =
        Math.round(
          brapTime *
          sampleRate
        );

      if (
        start >= 0 &&
        start < length
      ) {
        const edgeAmp =
          0.47 *
          strength[phase];

        const tones = [
          [112, 0.68, 0.045],
          [170, 0.42, 0.027],
          [255, 0.26, 0.013],
          [470, 0.16, 0.007],
          [740, 0.075, 0.004]
        ];

        tones.forEach(
          (
            [
              frequency,
              amount,
              decay
            ]
          ) => {
            addTone(
              left,
              start,
              frequency +
                random() *
                frequency *
                0.06,
              edgeAmp *
                amount,
              decay,
              random() *
                1.4
            );

            addTone(
              right,
              start,
              frequency *
                1.018 +
                random() *
                frequency *
                0.06,
              edgeAmp *
                amount *
                0.97,
              decay,
              random() *
                1.4
            );
          }
        );

        addDarkBurst(
          left,
          start,
          edgeAmp * 0.115,
          0.014,
          0.0036
        );

        addDarkBurst(
          right,
          start,
          edgeAmp * 0.110,
          0.014,
          0.0036
        );
      }

      brapIndex++;
    }

    // Sanft normalisieren.
    let peak =
      0;

    for (
      let i = 0;
      i < length;
      i++
    ) {
      peak =
        Math.max(
          peak,
          Math.abs(left[i]),
          Math.abs(right[i])
        );
    }

    const gain =
      peak > 0
        ? 0.88 / peak
        : 1;

    for (
      let i = 0;
      i < length;
      i++
    ) {
      left[i] *= gain;
      right[i] *= gain;
    }

    return buffer;
  }

  function createWankelDriveBuffer() {
    const sampleRate =
      ctx.sampleRate;

    const rpm =
      wankelDriveReferenceRpm;

    const shaftHz =
      rpm / 60;

    const rotorFireHz =
      shaftHz * 2;

    const duration =
      2.4;

    const length =
      Math.round(
        duration * sampleRate
      );

    const buffer =
      ctx.createBuffer(
        2,
        length,
        sampleRate
      );

    const left =
      buffer.getChannelData(0);

    const right =
      buffer.getChannelData(1);

    let seed =
      1787;

    const random = () => {
      seed |= 0;
      seed =
        seed + 0x6D2B79F5 | 0;

      let value =
        Math.imul(
          seed ^ seed >>> 15,
          1 | seed
        );

      value =
        value +
        Math.imul(
          value ^ value >>> 7,
          61 | value
        ) ^
        value;

      return (
        (
          value ^
          value >>> 14
        ) >>> 0
      ) / 4294967296;
    };

    const addTone = (
      channel,
      start,
      frequency,
      amplitude,
      decay,
      phase = 0
    ) => {
      const count =
        Math.min(
          channel.length - start,
          Math.ceil(
            decay *
            sampleRate *
            6
          )
        );

      const step =
        Math.PI *
        2 *
        frequency /
        sampleRate;

      for (
        let n = 0;
        n < count;
        n++
      ) {
        const time =
          n /
          sampleRate;

        channel[start + n] +=
          Math.sin(
            step * n +
            phase
          ) *
          Math.exp(
            -time / decay
          ) *
          amplitude;
      }
    };

    const interval =
      1 / rotorFireHz;

    const events =
      Math.ceil(
        duration / interval
      ) + 12;

    for (
      let event = -6;
      event < events;
      event++
    ) {
      const rotor =
        (
          (
            event % 2
          ) +
          2
        ) % 2;

      const start =
        Math.round(
          (
            event *
            interval +
            (
              random() * 2 - 1
            ) *
            interval *
            0.012
          ) *
          sampleRate
        );

      if (
        start < 0 ||
        start >= length
      ) {
        continue;
      }

      const side =
        rotor
          ? right
          : left;

      const other =
        rotor
          ? left
          : right;

      const amp =
        0.42 *
        (
          0.92 +
          random() * 0.16
        );

      // Fahrgrundsound: dichter Rotary-Körper,
      // aber kein ausgeprägtes Stand-BRAP.
      addTone(
        side,
        start,
        72 + random() * 8,
        amp * 0.42,
        0.060,
        random() * 0.6
      );

      addTone(
        side,
        start,
        112 + random() * 12,
        amp * 0.55,
        0.045,
        random() * 0.9
      );

      addTone(
        other,
        start,
        168 + random() * 18,
        amp * 0.25,
        0.026,
        random() * 1.2
      );

      addTone(
        other,
        start,
        250 + random() * 35,
        amp * 0.075,
        0.010,
        random() * 1.5
      );
    }

    let peak =
      0;

    for (
      let i = 0;
      i < length;
      i++
    ) {
      peak =
        Math.max(
          peak,
          Math.abs(left[i]),
          Math.abs(right[i])
        );
    }

    const gain =
      peak > 0
        ? 0.86 / peak
        : 1;

    for (
      let i = 0;
      i < length;
      i++
    ) {
      left[i] *= gain;
      right[i] *= gain;
    }

    return buffer;
  }

  function createOsc(type) {
    const osc =
      ctx.createOscillator();

    osc.type = type;

    return osc;
  }

  async function start() {
    if (started && ctx) {
      if (
        ctx.state !== "running" &&
        ctx.state !== "closed"
      ) {
        await resumeContextWithTimeout(
          ctx
        );
      }

      if (ctx.state === "running") {
        return true;
      }

      // Ein bereits gestarteter Context kann vom
      // Browser nach einem fehlerhaften Startversuch
      // geschlossen/interrupted zurückbleiben.
      // Nicht auf einen Seiten-Reload warten:
      // unten sauber neu aufbauen.
      started = false;
    }

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioCtx) {
      throw new Error(
        "Dieser Browser unterstützt die Web Audio API nicht."
      );
    }

    // Falls ein vorheriger Startversuch einen halbfertigen
    // Context hinterlassen hat, diesen zuerst entsorgen.
    if (ctx && !started) {
      try {
        if (ctx.state !== "closed") {
          await ctx.close();
        }
      } catch (error) {
        console.warn(
          "Alter AudioContext konnte nicht sauber geschlossen werden:",
          error
        );
      }

      ctx = null;

      // Diese Arrays werden beim Graph-Aufbau befüllt
      // und dürfen keine Nodes des alten Contexts behalten.
      accelRissetOsc = [];
      accelRissetGain = [];
      regenRissetOsc = [];
      regenRissetGain = [];
    }

    ctx = new AudioCtx();

    if (ctx.state === "closed") {
      throw new Error(
        "AudioContext wurde vom Browser geschlossen."
      );
    }

    // Sofort im echten Benutzerklick eine praktisch
    // unhörbare Quelle starten. Das ist robuster als
    // ausschließlich auf resume() zu vertrauen.
    const unlockSource =
      ctx.createBufferSource();

    const unlockBuffer =
      ctx.createBuffer(
        1,
        1,
        ctx.sampleRate
      );

    const unlockGain =
      ctx.createGain();

    unlockGain.gain.value =
      0.0001;

    unlockSource.buffer =
      unlockBuffer;

    unlockSource
      .connect(unlockGain)
      .connect(ctx.destination);

    unlockSource.start();

    if (
      ctx.state !== "running" &&
      ctx.state !== "closed"
    ) {
      const resumed =
        await resumeContextWithTimeout(
          ctx
        );

      if (!resumed) {
        throw new Error(
          `AudioContext Start-Timeout (Status: ${ctx.state})`
        );
      }
    }

    sharedNoiseBuffer =
      createNoiseBuffer(2);

    // Externe Schubknall-Samples gehören NICHT
    // in den kritischen Audio-Startpfad.
    // Sie werden nach dem Start separat geladen.

    master =
      ctx.createGain();

    master.gain.value = 0.0001;

    compressor =
      ctx.createDynamicsCompressor();
    
    compressor.threshold.value = -13;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.15;
    
    // Zusätzliche Ausgangsverstärkung.
    // Damit können wir nach dem normalen Compressor
    // den gesamten Mix gezielt lauter machen.
    loudnessGain = ctx.createGain();
    loudnessGain.gain.value = 0.0001;
    
    // Eigener Ausgang für das Schubknallen.
    // Umgeht den normalen Master-Compressor,
    // läuft aber weiterhin durch Lautstärkeregler
    // und Limiter.
    overrunBus = ctx.createGain();
    overrunBus.gain.value = 3.0;
    
    // Letzte Schutzstufe direkt vor dem Ausgang.
    // Sie fängt nur sehr hohe Spitzen ab.
    limiter = ctx.createDynamicsCompressor();
    
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    
    master
      .connect(compressor)
      .connect(loudnessGain)
      .connect(limiter)
      .connect(ctx.destination);
    overrunBus.connect(loudnessGain);


    // =========================
    // Voltune 6 · Wankel JDM
    // =========================

    wankelBuffer =
      createWankelTestBuffer();

    wankelSource =
      ctx.createBufferSource();

    wankelSource.buffer =
      wankelBuffer;

    wankelSource.loop =
      true;

    wankelGain =
      ctx.createGain();

    wankelGain.gain.value =
      0.0001;

    wankelFilter =
      ctx.createBiquadFilter();

    wankelFilter.type =
      "lowpass";

    wankelFilter.frequency.value =
      780;

    wankelFilter.Q.value =
      0.65;

    wankelSource
      .connect(wankelFilter)
      .connect(wankelGain)
      .connect(master);

    // Fahrgrundsound separat vom Idle-BRAP.
    wankelDriveBuffer =
      createWankelDriveBuffer();

    wankelDriveSource =
      ctx.createBufferSource();

    wankelDriveSource.buffer =
      wankelDriveBuffer;

    wankelDriveSource.loop =
      true;

    wankelDriveGain =
      ctx.createGain();

    wankelDriveGain.gain.value =
      0.0001;

    wankelDriveFilter =
      ctx.createBiquadFilter();

    wankelDriveFilter.type =
      "lowpass";

    wankelDriveFilter.frequency.value =
      1200;

    wankelDriveFilter.Q.value =
      0.55;

    wankelDriveSource
      .connect(wankelDriveFilter)
      .connect(wankelDriveGain)
      .connect(master);

    // =========================
    // Grundsound
    // =========================

    base1 = createOsc("triangle");
    base2 = createOsc("triangle");
    sub = createOsc("sine");

    baseGain1 = ctx.createGain();
    baseGain2 = ctx.createGain();
    subGain = ctx.createGain();

    // Wichtig:
    // verhindert lauten Peak direkt beim Start.
    baseGain1.gain.value = 0.0001;
    baseGain2.gain.value = 0.0001;
    subGain.gain.value = 0.0001;

    baseFilter =
      ctx.createBiquadFilter();

    baseFilter.type = "lowpass";
    baseFilter.frequency.value = 1050;
    baseFilter.Q.value = 0.55;

    base1
      .connect(baseGain1)
      .connect(baseFilter);

    base2
      .connect(baseGain2)
      .connect(baseFilter);

    sub
      .connect(subGain)
      .connect(baseFilter);

    baseFilter.connect(master);

    // =========================
    // Stillstand / Idle
    // =========================
    
    // Drei bewusst nicht oktavierte Ebenen:
    // ein ruhiger Körper, elektrische Textur
    // und ein leiser Präsenzton.
    idle1 = createOsc("sine");
    idle2 = createOsc("triangle");
    idle3 = createOsc("sine");
    
    idle1.frequency.value = 61;
    idle2.frequency.value = 146;
    idle3.frequency.value = 289;
    
    idleGain =
      ctx.createGain();
    
    idleGain.gain.value =
      0.0001;

    idle2Gain = ctx.createGain();
    idle2Gain.gain.value = 0.14;

    idle3Gain = ctx.createGain();
    idle3Gain.gain.value = 0.035;

    // Nur eine ruhige Atembewegung statt
    // des bisherigen deutlichen Wummerns.
    idlePulseGain = ctx.createGain();
    idlePulseGain.gain.value = 0.94;
    
    idlePulseOsc = createOsc("sine");
    idlePulseOsc.frequency.value = 0.86;
    
    idlePulseDepth = ctx.createGain();
    idlePulseDepth.gain.value = 0.055;
    
    idlePulseOsc
      .connect(idlePulseDepth)
      .connect(idlePulseGain.gain);

    // Die Pulsrate wandert langsam, damit kein
    // kurzer, ständig wiederholter Zyklus auffällt.
    idleDriftOsc = createOsc("sine");
    idleDriftOsc.frequency.value = 0.11;
    
    idleDriftDepth = ctx.createGain();
    idleDriftDepth.gain.value = 0.22;
    
    idleDriftOsc
      .connect(idleDriftDepth)
      .connect(idlePulseOsc.frequency);

    // Tiefbass und Resonanzen unterhalb des
    // eigentlichen Klangkörpers abschwächen.
    idleHighpass =
      ctx.createBiquadFilter();

    idleHighpass.type =
      "highpass";

    idleHighpass.frequency.value =
      48;

    idleHighpass.Q.value =
      0.55;

    // Genug Bandbreite für die elektrische Ebene,
    // ohne den Idle scharf oder zischelig zu machen.
    idleFilter =
      ctx.createBiquadFilter();
    
    idleFilter.type =
      "lowpass";
    
    idleFilter.frequency.value =
      480;
    
    idleFilter.Q.value =
      0.55;

    // Sehr langsame Bewegung der Klangfarbe und
    // wenige Cent gegenläufige Tonhöhendrift.
    // Die Ebenen bleiben stabil, wirken aber
    // nicht wie starre Testoszillatoren.
    idleToneOsc = createOsc("sine");
    idleToneOsc.frequency.value = 0.073;
    
    idleToneDepth = ctx.createGain();
    idleToneDepth.gain.value = 55;

    idlePitchDepth1 = ctx.createGain();
    idlePitchDepth1.gain.value = 3;

    idlePitchDepth2 = ctx.createGain();
    idlePitchDepth2.gain.value = -5;

    idlePitchDepth3 = ctx.createGain();
    idlePitchDepth3.gain.value = 7;
    
    idleToneOsc
      .connect(idleToneDepth)
      .connect(idleFilter.frequency);

    idleToneOsc
      .connect(idlePitchDepth1)
      .connect(idle1.detune);

    idleToneOsc
      .connect(idlePitchDepth2)
      .connect(idle2.detune);

    idleToneOsc
      .connect(idlePitchDepth3)
      .connect(idle3.detune);
    
    idle1
      .connect(idleGain);
    
    idle2
      .connect(idle2Gain)
      .connect(idleGain);

    idle3
      .connect(idle3Gain)
      .connect(idleGain);

    idleGain
      .connect(idleHighpass)
      .connect(idleFilter);
    
    idleFilter
      .connect(idlePulseGain)
      .connect(master);


    // =========================
    // Inverter
    // =========================

    inv1 = createOsc("sine");
    inv2 = createOsc("sine");
    inv3 = createOsc("sine");

    invGain1 = ctx.createGain();
    invGain2 = ctx.createGain();
    invGain3 = ctx.createGain();

    invGain1.gain.value = 0.0001;
    invGain2.gain.value = 0.0001;
    invGain3.gain.value = 0.0001;

    invFilter =
      ctx.createBiquadFilter();

    invFilter.type = "bandpass";
    invFilter.frequency.value = 1500;
    invFilter.Q.value = 0.45;

    inv1
      .connect(invGain1)
      .connect(invFilter);

    inv2
      .connect(invGain2)
      .connect(invFilter);

    inv3
      .connect(invGain3)
      .connect(invFilter);

    invFilter.connect(master);


    // =========================
    // Beschleunigung
    // =========================

    driveOsc =
      createOsc("triangle");

    driveGain =
      ctx.createGain();

    driveGain.gain.value = 0.0001;

    driveFilter =
      ctx.createBiquadFilter();

    driveFilter.type = "bandpass";
    driveFilter.frequency.value = 900;
    driveFilter.Q.value = 0.72;
    
    
    // =========================
    // Beschleunigungs-Puls
    // =========================
    
    // Langsamer Modulator, der den bestehenden
    // Beschleunigungssound rhythmisch atmen lässt.
    drivePulseOsc =
      createOsc("sine");
    
    drivePulseOsc.frequency.value =
      0.70;
    
    drivePulseDepth =
      ctx.createGain();
    
    drivePulseDepth.gain.value =
      0.02;
    
    drivePulseGain =
      ctx.createGain();
    
    drivePulseGain.gain.value =
      0.98;
    
    drivePulseOsc
      .connect(drivePulseDepth)
      .connect(drivePulseGain.gain);
    
    driveOsc
      .connect(driveGain)
      .connect(driveFilter)
      .connect(drivePulseGain)
      .connect(master);


    // =========================
    // Reku
    // =========================

    regenOsc1 =
      createOsc("sine");
    
    regenOsc2 =
      createOsc("triangle");

    regenGain =
      ctx.createGain();

    regenGain.gain.value = 0.0001;

    regenFilter =
      ctx.createBiquadFilter();

    regenFilter.type = "bandpass";
    regenFilter.frequency.value = 1050;
    regenFilter.Q.value = 0.58;

    const rg2 =
      ctx.createGain();

    rg2.gain.value = 0.20;

    regenOsc1.connect(regenGain);

    regenOsc2
      .connect(rg2)
      .connect(regenGain);

    // =========================
    // Reku-Puls
    // =========================
    
    // Etwas ruhiger als der Beschleunigungs-Puls.
    // Soll eher wie ein arbeitender Generator
    // beziehungsweise ein ziehender Reku-Antrieb wirken.
    regenPulseOsc =
      createOsc("sine");
    
    regenPulseOsc.frequency.value =
      0.55;
    
    regenPulseDepth =
      ctx.createGain();
    
    regenPulseDepth.gain.value =
      0.015;
    
    regenPulseGain =
      ctx.createGain();
    
    regenPulseGain.gain.value =
      0.985;
    
    regenPulseOsc
      .connect(regenPulseDepth)
      .connect(regenPulseGain.gain);
    
    regenGain
      .connect(regenFilter)
      .connect(regenPulseGain)
      .connect(master);


    // =========================
    // Voltune 5 · Muscle Core
    // =========================

    muscle1 =
      createOsc("sawtooth");

    muscle2 =
      createOsc("triangle");

    muscle3 =
      createOsc("square");

    muscleGain1 =
      ctx.createGain();

    muscleGain2 =
      ctx.createGain();

    muscleGain3 =
      ctx.createGain();

    muscleGain1.gain.value =
      0.0001;

    muscleGain2.gain.value =
      0.0001;

    muscleGain3.gain.value =
      0.0001;

    muscleFilter =
      ctx.createBiquadFilter();

    muscleFilter.type =
      "lowpass";

    muscleFilter.frequency.value =
      520;

    muscleFilter.Q.value =
      0.72;

    muscleDrive =
      ctx.createGain();

    muscleDrive.gain.value =
      0.9;

    musclePulseGain =
      ctx.createGain();

    musclePulseGain.gain.value =
      0.72;

    muscleBus =
      ctx.createGain();

    muscleBus.gain.value =
      0.0001;

    muscle1
      .connect(muscleGain1)
      .connect(muscleFilter);

    muscle2
      .connect(muscleGain2)
      .connect(muscleFilter);

    muscle3
      .connect(muscleGain3)
      .connect(muscleFilter);

    muscleFilter
      .connect(muscleDrive)
      .connect(musclePulseGain)
      .connect(muscleBus)
      .connect(master);

    musclePulseOsc =
      createOsc("triangle");

    musclePulseOsc.frequency.value =
      4.5;

    musclePulseDepth =
      ctx.createGain();

    musclePulseDepth.gain.value =
      0.28;

    musclePulseOsc
      .connect(musclePulseDepth)
      .connect(musclePulseGain.gain);

    // Beide LFOs modulieren leicht unterschiedliche
    // Stellen. Das erzeugt das "unsaubere" Blubbern,
    // ohne Zufallsklicks oder Rauschen.
    muscleRumbleOsc =
      createOsc("sine");

    muscleRumbleOsc.frequency.value =
      0.83;

    muscleRumbleDepth =
      ctx.createGain();

    muscleRumbleDepth.gain.value =
      6;

    muscleRumbleOsc
      .connect(muscleRumbleDepth)
      .connect(muscle1.frequency);

    muscleIrregularOsc =
      createOsc("sine");

    muscleIrregularOsc.frequency.value =
      1.37;

    muscleIrregularDepth =
      ctx.createGain();

    muscleIrregularDepth.gain.value =
      4;

    muscleIrregularOsc
      .connect(muscleIrregularDepth)
      .connect(muscle2.frequency);


    // =========================
    // Voltune 4 · Sentinel Core
    // =========================

    sentinel1 =
      createOsc("triangle");

    sentinel2 =
      createOsc("triangle");

    sentinel3 =
      createOsc("sine");

    sentinelGain1 =
      ctx.createGain();

    sentinelGain2 =
      ctx.createGain();

    sentinelGain3 =
      ctx.createGain();

    sentinelGain1.gain.value =
      0.0001;

    sentinelGain2.gain.value =
      0.0001;

    sentinelGain3.gain.value =
      0.0001;

    sentinelFilter =
      ctx.createBiquadFilter();

    sentinelFilter.type =
      "lowpass";

    sentinelFilter.frequency.value =
      720;

    sentinelFilter.Q.value =
      0.9;

    sentinelPulseGain =
      ctx.createGain();

    sentinelPulseGain.gain.value =
      1;

    sentinelBus =
      ctx.createGain();

    sentinelBus.gain.value =
      0.0001;

    sentinel1
      .connect(sentinelGain1)
      .connect(sentinelFilter);

    sentinel2
      .connect(sentinelGain2)
      .connect(sentinelFilter);

    sentinel3
      .connect(sentinelGain3)
      .connect(sentinelFilter);

    sentinelFilter
      .connect(sentinelPulseGain)
      .connect(sentinelBus)
      .connect(master);

    // Frequenzmodulation nur auf die mittlere
    // Resonanz. Dadurch entsteht eher ein
    // roboterartiges Knurren als ein Sirenen-Jaulen.
    sentinelFmOsc =
      createOsc("sine");

    sentinelFmOsc.frequency.value =
      1.4;

    sentinelFmDepth =
      ctx.createGain();

    sentinelFmDepth.gain.value =
      0;

    sentinelFmOsc
      .connect(sentinelFmDepth)
      .connect(sentinel2.frequency);

    // Amplitudenpuls als wiedererkennbarer
    // "Energie"-Rhythmus.
    sentinelPulseOsc =
      createOsc("sine");

    sentinelPulseOsc.frequency.value =
      1.0;

    sentinelPulseDepth =
      ctx.createGain();

    sentinelPulseDepth.gain.value =
      0;

    sentinelPulseOsc
      .connect(sentinelPulseDepth)
      .connect(sentinelPulseGain.gain);


    // =========================
    // Infinite Rise / Fall
    // =========================
    //
    // Je sieben logarithmisch versetzte Stimmen.
    // Jede Stimme wandert durch mehrere Oktaven,
    // wird an den Rändern ausgeblendet und springt
    // dort unhörbar an das andere Ende zurück.
    // So entsteht die Shepard/Risset-Illusion.

    accelRissetBus =
      ctx.createGain();

    accelRissetBus.gain.value =
      0.0001;

    accelRissetFilter =
      ctx.createBiquadFilter();

    accelRissetFilter.type =
      "lowpass";

    accelRissetFilter.frequency.value =
      2800;

    accelRissetFilter.Q.value =
      0.35;

    regenRissetBus =
      ctx.createGain();

    regenRissetBus.gain.value =
      0.0001;

    regenRissetFilter =
      ctx.createBiquadFilter();

    regenRissetFilter.type =
      "lowpass";

    regenRissetFilter.frequency.value =
      2200;

    regenRissetFilter.Q.value =
      0.42;

    for (
      let index = 0;
      index < 7;
      index++
    ) {
      const accelOsc =
        createOsc(
          index % 3 === 0
            ? "triangle"
            : "sine"
        );

      const accelGain =
        ctx.createGain();

      accelGain.gain.value =
        0.0001;

      accelOsc
        .connect(accelGain)
        .connect(accelRissetFilter);

      accelRissetOsc.push(
        accelOsc
      );

      accelRissetGain.push(
        accelGain
      );

      const regenOsc =
        createOsc(
          index % 4 === 0
            ? "triangle"
            : "sine"
        );

      const regenVoiceGain =
        ctx.createGain();

      regenVoiceGain.gain.value =
        0.0001;

      regenOsc
        .connect(regenVoiceGain)
        .connect(regenRissetFilter);

      regenRissetOsc.push(
        regenOsc
      );

      regenRissetGain.push(
        regenVoiceGain
      );
    }

    accelRissetFilter
      .connect(accelRissetBus)
      .connect(master);

    regenRissetFilter
      .connect(regenRissetBus)
      .connect(master);


    // =========================
    // Luft / Textur
    // =========================

    airSource =
      ctx.createBufferSource();

    airSource.buffer =
      sharedNoiseBuffer;

    airSource.loop = true;

    airGain =
      ctx.createGain();

    airGain.gain.value = 0.0001;

    airFilter =
      ctx.createBiquadFilter();

    airFilter.type = "bandpass";
    airFilter.frequency.value = 1700;
    airFilter.Q.value = 0.8;

    airSource
      .connect(airFilter)
      .connect(airGain)
      .connect(master);


    [
      base1,
      base2,
      sub,
      idle1,
      idle2,
      idle3,
      idlePulseOsc,
      idleDriftOsc,
      idleToneOsc,
      inv1,
      inv2,
      inv3,
      driveOsc,
      drivePulseOsc,
      regenOsc1,
      regenOsc2,
      regenPulseOsc,
      sentinel1,
      sentinel2,
      sentinel3,
      sentinelFmOsc,
      sentinelPulseOsc,
      muscle1,
      muscle2,
      muscle3,
      musclePulseOsc,
      muscleRumbleOsc,
      muscleIrregularOsc
    ].forEach(osc => osc.start());

    [
      ...accelRissetOsc,
      ...regenRissetOsc
    ].forEach(
      osc => osc.start()
    );

    airSource.start();

    if (wankelSource) {
      wankelSource.start();
    }

    if (wankelDriveSource) {
      wankelDriveSource.start();
    }

    // Nach dem Aufbau noch einmal sicherstellen,
    // dass der Context wirklich läuft.
    if (
      ctx.state !== "running" &&
      ctx.state !== "closed"
    ) {
      await resumeContextWithTimeout(
        ctx
      );
    }

    if (ctx.state !== "running") {
      throw new Error(
        `AudioContext nicht aktiv (Status: ${ctx.state}). Bitte Demo erneut antippen.`
      );
    }

    started = true;
    lastAccel = 0;
    lastBovAt = -9999;

    // Erst jetzt externe Samples nachladen.
    // Ein langsames oder kurz nicht erreichbares Netz
    // kann die Demo dadurch nicht mehr blockieren.
    if (
      overrunSoundMode === "sample" &&
      overrunSampleUrl &&
      !overrunSampleBuffer
    ) {
      void setOverrunSound(
        overrunSampleUrl
      );
    }

    return true;
  }

  async function resume() {
    if (!ctx) return false;

    await ctx.resume();

    return true;
  }

function stop() {
  if (!ctx) return;

  try {
    if (loudnessGain) {
      const now = ctx.currentTime;

      loudnessGain.gain.cancelScheduledValues(now);

      loudnessGain.gain.setTargetAtTime(
        0.0001,
        now,
        0.03
      );
    }
  } catch (error) {
    console.warn(
      "Voltune Audio konnte nicht gestoppt werden:",
      error
    );
  }

  // AudioContext absichtlich weiterlaufen lassen.
  // Nur die Ausgangsstufe wird stumm geschaltet.
  muted = false;
  lastAccel = 0;
  lastBovAt = -9999;
  bovPressure = 0;
  bovArmed = false;
  bovPeakAccel = 0;
  
  lastOverrunAt = -9999;
  overrunPeakAccel = 0;
  overrunArmed = false;
  shiftBurbleUntil = 0;
  pendingOverrun = null;
}

  function setMasterVolume(percent) {
    if (
      !started ||
      !master ||
      !loudnessGain ||
      !ctx
    ) {
      return;
    }
  
    const volume =
      clamp(
        Number(percent) / 100,
        0,
        1
      );
  
    const now = ctx.currentTime;
  
    // Fester interner Pegel vor dem Compressor.
    // Dadurch arbeitet die Dynamik unabhängig
    // von der eingestellten Benutzer-Lautstärke.
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(
      15.0,
      now,
      0.04
    );
  
    // Eigentliche Benutzer-Lautstärke
    // NACH dem Compressor.
    //
    // 50 % = Gain 1.0
    // 100 % = Gain 2.0
    //
    // Der nachfolgende Limiter fängt Spitzen ab.
    const target =
      muted
        ? 0.0001
        : Math.max(
            0.0001,
            volume * 2.0
          );
  
    loudnessGain.gain.cancelScheduledValues(now);
    loudnessGain.gain.setTargetAtTime(
      target,
      now,
      0.06
    );
  }

  function setMuted(value, volumePercent) {
    muted = Boolean(value);

    setMasterVolume(volumePercent);
  }

  function isMuted() {
    return muted;
  }

  function isStarted() {
    return started;
  }


  // =========================
  // BOV / Entladung
  // =========================

  function triggerBov(
    intensity = 1,
    bovPercent = 60,
    minCooldown = 650
  ) {
    if (
      !started ||
      !ctx ||
      !sharedNoiseBuffer
    ) {
      return;
    }

    const bovVolume =
      volumeCurve(bovPercent);
    
    const pressureVolume =
      0.06 +
      Math.pow(
        clamp(intensity, 0, 1),
        1.25
      ) * 0.94;
    
    const bovAmount =
      bovVolume * pressureVolume;

    if (bovAmount <= 0.001) return;

    const nowMs =
      performance.now();

    if (
      nowMs - lastBovAt <
      minCooldown
    ) {
      return;
    }

    lastBovAt = nowMs;

    const now =
      ctx.currentTime;

    // Deine längere Zisch-Version
    const duration =
      0.65 +
      intensity * 0.55;


    // -------------------------
    // 1. Haupt-Zischen
    // -------------------------

    const hiss =
      ctx.createBufferSource();

    hiss.buffer =
      sharedNoiseBuffer;

    const hissFilter =
      ctx.createBiquadFilter();

    hissFilter.type =
      "bandpass";

    hissFilter.frequency.setValueAtTime(
      4200 + intensity * 1800,
      now
    );

    hissFilter.frequency.exponentialRampToValueAtTime(
      1100,
      now + duration
    );

    hissFilter.Q.value = 0.8;

    const hissGain =
      ctx.createGain();

    hissGain.gain.setValueAtTime(
      0.0001,
      now
    );

    hissGain.gain.exponentialRampToValueAtTime(
      (
        0.025 +
        Math.pow(intensity, 1.35) * 0.155
      ) * bovAmount,
      now + 0.018
    );

    hissGain.gain.exponentialRampToValueAtTime(
      (
        0.018 +
        Math.pow(intensity, 1.35) * 0.112
      ) * bovAmount,
      now + 0.16
    );

    hissGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    hiss
      .connect(hissFilter)
      .connect(hissGain)
      .connect(master);


    // -------------------------
    // 2. Tiefer Whoosh
    // -------------------------

    const whoosh =
      ctx.createBufferSource();

    whoosh.buffer =
      sharedNoiseBuffer;

    const whooshFilter =
      ctx.createBiquadFilter();

    whooshFilter.type =
      "lowpass";

    whooshFilter.frequency.setValueAtTime(
      1800 + intensity * 600,
      now
    );

    whooshFilter.frequency.exponentialRampToValueAtTime(
      500,
      now + duration * 0.85
    );

    const whooshGain =
      ctx.createGain();

    whooshGain.gain.setValueAtTime(
      0.0001,
      now
    );

    whooshGain.gain.exponentialRampToValueAtTime(
      (
        0.012 +
        Math.pow(intensity, 1.25) * 0.068
      ) * bovAmount,
      now + 0.025
    );

    whooshGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration * 0.9
    );

    whoosh
      .connect(whooshFilter)
      .connect(whooshGain)
      .connect(master);


    // -------------------------
    // 3. Kleiner elektronischer Akzent
    // -------------------------

    const zap =
      ctx.createOscillator();

    zap.type = "sine";

    zap.frequency.setValueAtTime(
      1000 + intensity * 350,
      now
    );

    zap.frequency.exponentialRampToValueAtTime(
      350,
      now + 0.22
    );

    const zapGain =
      ctx.createGain();

    zapGain.gain.setValueAtTime(
      0.0001,
      now
    );

    zapGain.gain.exponentialRampToValueAtTime(
      0.006 * bovAmount,
      now + 0.008
    );

    zapGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.25
    );

    zap
      .connect(zapGain)
      .connect(master);


    hiss.start(now);
    whoosh.start(now);
    zap.start(now);

    hiss.stop(
      now + duration + 0.05
    );

    whoosh.stop(
      now + duration + 0.05
    );

    zap.stop(
      now + 0.3
    ); 
  }


// =========================
// Turbo Flutter
// =========================
//
// Basis:
// Pipe Whistle Flutter Lab · Variante 10
//
// Breites Sog-/Rohrpfeifen +
// großes, langsames Ventil-Flutter.
//
// Der Effekt läuft direkt über loudnessGain.
// Dadurch wird der luftige Charakter nicht
// vom normalen Master-Kompressor zerdrückt.

function triggerTurboFlutter(
  intensity = 1,
  flutterPercent = 0
) {
  if (
    !started ||
    !ctx ||
    !sharedNoiseBuffer ||
    !loudnessGain
  ) {
    return;
  }

  const amount =
    clamp(
      Number(intensity) || 0,
      0,
      1
    );

  const volume =
    volumeCurve(
      flutterPercent
    );

  if (
    amount <= 0.01 ||
    volume <= 0.001
  ) {
    return;
  }


  // Ladedruck beeinflusst nur die Stärke.
  //
  // Bei voller Intensität entspricht
  // der Klang exakt der Testvariante.
  const pressureVolume =
    0.15 +
    Math.pow(
      amount,
      1.10
    ) * 0.85;

  const flutterBoost =
    1.5;
  
  const flutterAmount =
    volume *
    pressureVolume *
    flutterBoost;

  const now =
    ctx.currentTime;


  // =========================
  // Luft-/Zisch-Layer
  // =========================

  const playNoiseLayer = ({
    time,
    duration,
    gain,
    hp = 350,
    bp = 2400,
    q = 0.6,
    sweepTo = null,
    attack = 0.004,
    sustain = 0.45
  }) => {
    const source =
      ctx.createBufferSource();

    source.buffer =
      sharedNoiseBuffer;


    const highpass =
      ctx.createBiquadFilter();

    highpass.type =
      "highpass";

    highpass.frequency.value =
      hp;


    const bandpass =
      ctx.createBiquadFilter();

    bandpass.type =
      "bandpass";

    bandpass.Q.value =
      q;

    bandpass.frequency.setValueAtTime(
      bp,
      time
    );

    if (sweepTo) {
      bandpass.frequency.exponentialRampToValueAtTime(
        sweepTo,
        time + duration
      );
    }


    const gainNode =
      ctx.createGain();

    const peak =
      Math.max(
        0.0002,
        gain * flutterAmount
      );

    gainNode.gain.setValueAtTime(
      0.0001,
      time
    );

    gainNode.gain.exponentialRampToValueAtTime(
      peak,
      time + attack
    );

    gainNode.gain.exponentialRampToValueAtTime(
      peak * 0.68,
      time + duration * sustain
    );

    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration
    );


    source
      .connect(highpass)
      .connect(bandpass)
      .connect(gainNode)
      .connect(master);

    source.start(
      time
    );

    source.stop(
      time +
      duration +
      0.03
    );
  };


  // =========================
  // Sog-/Rohrpfeifen
  // =========================

  const playPipeResonance = ({
    time,
    duration,
    startHz,
    endHz,
    gain,
    q,
    airGain,
    secondRatio,
    secondGain
  }) => {
    const source =
      ctx.createBufferSource();

    source.buffer =
      sharedNoiseBuffer;


    const highpass =
      ctx.createBiquadFilter();

    highpass.type =
      "highpass";

    highpass.frequency.value =
      500;


    const resonance =
      ctx.createBiquadFilter();

    resonance.type =
      "bandpass";

    resonance.Q.value =
      q;

    resonance.frequency.setValueAtTime(
      startHz,
      time
    );

    resonance.frequency.exponentialRampToValueAtTime(
      endHz,
      time + duration
    );


    const resonanceGain =
      ctx.createGain();

    const resonancePeak =
      Math.max(
        0.0002,
        gain * flutterAmount
      );

    resonanceGain.gain.setValueAtTime(
      0.0001,
      time
    );

    resonanceGain.gain.exponentialRampToValueAtTime(
      resonancePeak,
      time + 0.012
    );

    resonanceGain.gain.exponentialRampToValueAtTime(
      resonancePeak * 0.78,
      time + duration * 0.45
    );

    resonanceGain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration
    );


    source
      .connect(highpass)
      .connect(resonance)
      .connect(resonanceGain)
      .connect(master);


    // Zweite tiefere Rohrresonanz.
    const resonance2 =
      ctx.createBiquadFilter();

    resonance2.type =
      "bandpass";

    resonance2.Q.value =
      q * 0.75;

    resonance2.frequency.setValueAtTime(
      startHz * secondRatio,
      time
    );

    resonance2.frequency.exponentialRampToValueAtTime(
      endHz * secondRatio,
      time + duration
    );


    const resonanceGain2 =
      ctx.createGain();

    const resonancePeak2 =
      Math.max(
        0.0002,
        secondGain *
          flutterAmount
      );

    resonanceGain2.gain.setValueAtTime(
      0.0001,
      time
    );

    resonanceGain2.gain.exponentialRampToValueAtTime(
      resonancePeak2,
      time + 0.015
    );

    resonanceGain2.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration
    );


    source
      .connect(resonance2)
      .connect(resonanceGain2)
      .connect(master);


    // Breiter Luftstrom unter dem Pfeifen.
    playNoiseLayer({
      time,
      duration,
      gain: airGain,
      hp: 650,
      bp: startHz * 0.90,
      q: 0.45,
      sweepTo:
        endHz * 0.75,
      sustain: 0.58
    });


    source.start(
      time
    );

    source.stop(
      time +
      duration +
      0.03
    );
  };


  // =========================
  // 1. Big Turbo Suction
  // =========================

  playPipeResonance({
    time: now,
    duration: 0.30,
    startHz: 4100,
    endHz: 2100,
    gain: 0.085,
    q: 5.3,
    airGain: 0.165,
    secondRatio: 0.58,
    secondGain: 0.030
  });


  // Zusätzlicher breiter Sog.
  playNoiseLayer({
    time: now + 0.06,
    duration: 0.25,
    gain: 0.095,
    hp: 450,
    bp: 2500,
    q: 0.40,
    sweepTo: 1100
  });


  // =========================
  // 2. Big Valve Flutter
  // =========================

  const flutterStart =
    now + 0.14;


  // Erster großer Luftstoß.
  playNoiseLayer({
    time: flutterStart,
    duration: 0.16,
    gain: 0.15,
    hp: 380,
    bp: 2900,
    q: 0.50,
    sweepTo: 1700
  });


  const offsets = [
    0,
    0.16,
    0.34,
    0.55
  ];

  const durations = [
    0.13,
    0.14,
    0.16,
    0.24
  ];

  const frequencies = [
    1900,
    1650,
    1400,
    1180
  ];

  const endFrequencies = [
    1200,
    1000,
    800,
    580
  ];

  const airGains = [
    0.22,
    0.20,
    0.18,
    0.16
  ];

  const filterQ = [
    0.60,
    0.60,
    0.55,
    0.50
  ];


  offsets.forEach(
    (offset, index) => {
      playNoiseLayer({
        time:
          flutterStart +
          0.085 +
          offset,

        duration:
          durations[index],

        gain:
          airGains[index],

        hp: 420,

        bp:
          frequencies[index],

        q:
          filterQ[index],

        sweepTo:
          endFrequencies[index],

        sustain: 0.38
      });
    }
  );
}


// =========================
// Schubknallen Sample
// =========================
//
// Zusätzliches echtes Knall-Sample.
//
// Grundlage:
// freesound_community-bang-100662.mp3
//
// Rhythmus und Klangparameter stammen
// aus dem WAV/MP3-Testlabor.

function createOverrunSampleDriveCurve(
  amount
) {
  const samples =
    2048;

  const curve =
    new Float32Array(
      samples
    );

  const k =
    1 +
    amount * 30;

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const x =
      i * 2 /
        (samples - 1) -
      1;

    curve[i] =
      Math.tanh(
        x * k
      ) /
      Math.tanh(k);
  }

  return curve;
}


function playOverrunSampleHit(
  time,
  baseVolume
) {
  if (
    !ctx ||
    !overrunSampleBuffer ||
    !loudnessGain
  ) {
    return;
  }


  // =========================
  // Zufällige Variation
  // =========================

  // Testwert:
  // Lautstärke ±30 %
  const volumeRandom =
    1 +
    (
      Math.random() * 2 -
      1
    ) *
    (
      overrunSampleSettings
        .hitVolumeRandom /
      100
    );


  const baseRate =
    overrunSampleSettings.rate /
    100;

  const rateRandom =
    overrunSampleSettings
      .rateRandom /
    100;

  const rate =
    baseRate *
    (
      1 +
      (
        Math.random() * 2 -
        1
      ) *
      rateRandom
    );


  const source =
    ctx.createBufferSource();

  source.buffer =
    overrunSampleBuffer;

  source.playbackRate.value =
    rate;


  // =========================
  // Filter
  // =========================

  const highpass =
    ctx.createBiquadFilter();

  highpass.type =
    "highpass";

  highpass.frequency.value =
    overrunSampleSettings.highpass;

  highpass.Q.value =
    overrunSampleSettings.resonance /
    10;


  const lowpass =
    ctx.createBiquadFilter();

  lowpass.type =
    "lowpass";

  lowpass.frequency.value =
    overrunSampleSettings.lowpass;

  lowpass.Q.value =
    overrunSampleSettings.resonance /
    10;


  // +3 dB Bass aus dem Testlabor.
  const bass =
    ctx.createBiquadFilter();

  bass.type =
    "lowshelf";

  bass.frequency.value =
    180;

  bass.gain.value =
    overrunSampleSettings.bass;

  const mid =
    ctx.createBiquadFilter();

  mid.type =
    "peaking";

  mid.frequency.value =
    900;

  mid.Q.value =
    0.85;

  mid.gain.value =
    overrunSampleSettings.mid;


  const treble =
    ctx.createBiquadFilter();

  treble.type =
    "highshelf";

  treble.frequency.value =
    3200;

  treble.gain.value =
    overrunSampleSettings.treble;
  
  // =========================
  // Sättigung
  // =========================

  const distortion =
    ctx.createWaveShaper();

  distortion.curve =
    createOverrunSampleDriveCurve(
      overrunSampleSettings.drive /
      100
    );

  distortion.oversample =
    "2x";


  // =========================
  // Kompression
  // =========================

  // Testwert:
  // 25 %
  const compressor =
    ctx.createDynamicsCompressor();

  const compressionAmount =
    overrunSampleSettings.compress /
    100;

  compressor.threshold.value =
    -4 -
    compressionAmount * 24;

  compressor.knee.value =
    8;

  compressor.ratio.value =
    1 +
    compressionAmount * 9;

  compressor.attack.value =
    0.002;

  compressor.release.value =
    0.10;


  // =========================
  // Lautstärke
  // =========================

  const gain =
    ctx.createGain();

  const sampleVolume =
    overrunSampleSettings.volume /
    100;

  const peak =
    Math.max(
      0.0001,
      baseVolume *
        sampleVolume *
        volumeRandom
    );


  // Die ersten 300 ms des Samples
  // werden abgeschnitten.
  const startTrim =
    Math.min(
      overrunSampleSettings.startTrim /
        1000,

      Math.max(
        0,
        overrunSampleBuffer.duration -
          0.01
      )
    );

  const endTrim =
    Math.max(
      0,
      overrunSampleSettings.endTrim /
        1000
    );

  const playableDuration =
    Math.max(
      0.01,

      overrunSampleBuffer.duration -
        startTrim -
        endTrim
    );

  // Wegen playbackRate verändert sich
  // auch die reale Abspieldauer.
  const audibleDuration =
    playableDuration /
    rate;


  const attackDuration =
    Math.min(
      overrunSampleSettings.attack /
        1000,

      audibleDuration * 0.45
    );

  if (attackDuration > 0) {
    gain.gain.setValueAtTime(
      0.0001,
      time
    );

    gain.gain.exponentialRampToValueAtTime(
      peak,
      time + attackDuration
    );
  } else {
    gain.gain.setValueAtTime(
      peak,
      time
    );
  }


  const fadeDuration =
    Math.min(
      overrunSampleSettings.fadeOut /
        1000,

      audibleDuration * 0.75
    );

  if (fadeDuration > 0) {
    const fadeStart =
      Math.max(
        time + attackDuration,
        time +
          audibleDuration -
          fadeDuration
      );

    gain.gain.setValueAtTime(
      peak,
      fadeStart
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + audibleDuration
    );
  }


  // =========================
  // Hauptsignal
  // =========================

  source
    .connect(highpass)
    .connect(lowpass)
    .connect(bass)
    .connect(mid)
    .connect(treble)
    .connect(distortion)
    .connect(compressor)
    .connect(gain)
    .connect(loudnessGain);


  // =========================
  // Kurze Reflexion
  // =========================

  // Testwerte:
  // 8 % Effekt
  // 35 ms Abstand
  const delay =
    ctx.createDelay(0.5);

  delay.delayTime.value =
    overrunSampleSettings.echoDelay /
    1000;


  const echoFilter =
    ctx.createBiquadFilter();

  echoFilter.type =
    "lowpass";

  echoFilter.frequency.value =
    4500;


  const echoGain =
    ctx.createGain();

  echoGain.gain.value =
    (
      overrunSampleSettings.echo /
      100
    ) *
    0.45;


  gain
    .connect(delay)
    .connect(echoFilter)
    .connect(echoGain)
    .connect(loudnessGain);


  source.start(
    time,
    startTrim,
    playableDuration
  );
}


function triggerOverrunSample(
  startTime,
  drivingStyle = 0,
  intensity = 1,
  volumePercent = 50
) {
  if (
    !started ||
    !ctx ||
    !overrunSampleBuffer
  ) {
    return;
  }


  const style =
    clamp(
      Number(drivingStyle) || 0,
      0,
      1
    );

  const amount =
    clamp(
      Number(intensity) || 0,
      0,
      1
    );

  const volume =
    volumeCurve(
      volumePercent
    );

  if (
    volume <= 0.001
  ) {
    return;
  }


  // count aus der TXT:
  //
  // 0 = automatisch nach Fahrstil
  // 1 = immer genau 1 Knall
  // 2 = immer genau 2 Knaller
  // usw.
  const configuredCount =
    Math.round(
      Number(
        overrunSampleSettings.count
      ) || 0
    );
  
  const popCount =
    configuredCount > 0
      ? clamp(
          configuredCount,
          1,
          20
        )
      : 1 +
        Math.round(
          style * 5
        );


  // =========================
  // Wucht nach Fahrstil
  // =========================

  // Normal:
  // deutlich zurückhaltender.
  //
  // Wahnsinn:
  // voller Sample-Pegel.
  const styleVolume =
    0.42 +
    style * 0.58;


  // Auch die vorherige Last darf
  // die Wucht leicht beeinflussen.
  const intensityVolume =
    0.70 +
    amount * 0.30;


  const baseVolume =
    volume *
    styleVolume *
    intensityVolume;


  // =========================
  // Rhythmus
  // =========================

  // Testwert:
  // 3,75 Knaller pro Sekunde.
  const frequency =
    Math.max(
      0.25,
      overrunSampleSettings.frequency
    );

  const baseInterval =
    1 / frequency;


  const irregularity =
    clamp(
      overrunSampleSettings.irregularity /
        100,
      0,
      1
    );


  const slowdown =
    clamp(
      overrunSampleSettings.slowdown /
        100,
      0,
      1
    );


  let offset =
    0;


  for (
    let i = 0;
    i < popCount;
    i++
  ) {
    const progress =
      popCount > 1
        ? i /
          (popCount - 1)
        : 0;


    const intervalGrowth =
      1 +
      slowdown *
        progress;


    const jitter =
      1 +
      (
        Math.random() * 2 -
        1
      ) *
      irregularity *
      0.62;


    playOverrunSampleHit(
      startTime + offset,
      baseVolume
    );


    offset +=
      Math.max(
        0.035,

        baseInterval *
          intervalGrowth *
          jitter
      );
  }
}
  
  
// =========================
// Schubknallen / Nachblubbern
// =========================

function triggerOverrun(
  intensity = 1,
  volumePercent = 50,
  fromQueue = false,
  drivingStyle = 0
) {
  if (
    !started ||
    !ctx ||
    !master
  ) {
    return;
  }

  const amount =
    clamp(
      Number(intensity) || 0,
      0,
      1
    );
  
  const volume =
    volumeCurve(volumePercent);

  if (
    amount <= 0.01 ||
    volume <= 0.001
  ) {
    return;
  }

  // Schubknallen ganz kurz zurückhalten.
  // Dadurch bekommt ein unmittelbar danach
  // erkannter DSG-Gangwechsel noch Vorrang.
  if (!fromQueue) {
    pendingOverrun = {
      intensity: amount,
      volumePercent,
      drivingStyle
    };

  setTimeout(() => {
    const queued =
      pendingOverrun;

    pendingOverrun = null;

    if (!queued) {
      return;
    }

    triggerOverrun(
      queued.intensity,
      queued.volumePercent,
      true,
      queued.drivingStyle
    );
  }, 25);

  return;
}

  const requestedNow =
    ctx.currentTime;
  
  // Läuft gerade ein DSG-Furzen,
  // beginnt die komplette Schubknall-Sequenz
  // erst direkt danach.
  const now =
    Math.max(
      requestedNow,
      shiftBurbleUntil
    );


  // Sample ausgewählt UND bereits geladen:
  // dann nur den Sample-Charakter abspielen.
  if (
    overrunSoundMode === "sample" &&
    overrunSampleBuffer
  ) {
    triggerOverrunSample(
      now,
      drivingStyle,
      amount,
      volumePercent
    );

    return;
  }

  // Falls ein gewähltes Sample noch lädt oder
  // kurz nicht erreichbar ist, fällt Voltune
  // automatisch auf das synthetische Schubknallen
  // zurück. Die Demo bleibt dadurch vollständig
  // funktionsfähig.
  // Ab hier: Voltune Standard.


  
  // Stärkere vorherige Last erzeugt
  // einen längeren Nachlauf mit mehr Impulsen.
  const duration =
    0.45 +
    amount * 0.45;

  const popCount =
    2 +
    Math.round(
      amount * 4
    );

  for (
    let i = 0;
    i < popCount;
    i++
  ) {
    // Der erste Impuls kommt praktisch sofort.
    // Die restlichen verteilen sich weiterhin
    // natürlich über die gesamte Sequenz.
    const progress =
      popCount > 1
        ? i / (popCount - 1)
        : 0;
    
    const randomOffset =
      i === 0
        ? 0
        : (Math.random() - 0.5) * 0.08;
    
    const popTime =
      now +
      0.015 +
      progress * duration +
      randomOffset;

    const popDuration =
      0.10 +
      Math.random() * 0.07;

    const pop =
      ctx.createOscillator();

    pop.type =
      "sawtooth";

    pop.frequency.setValueAtTime(
      62 +
        Math.random() * 24 +
        amount * 12,
      popTime
    );

    pop.frequency.exponentialRampToValueAtTime(
      38 +
        Math.random() * 10,
      popTime + popDuration
    );

    const filter =
      ctx.createBiquadFilter();

    filter.type =
      "lowpass";

    filter.frequency.value =
      420 +
      amount * 480;

    filter.Q.value =
      0.8;

    const gain =
      ctx.createGain();

    const randomStrength =
      0.70 +
      Math.random() * 0.30;

    const peak =
      (
        0.07 +
        amount * 0.24
      ) *
      volume *
      randomStrength *
      2.5;

    gain.gain.setValueAtTime(
      0.0001,
      popTime
    );

    gain.gain.exponentialRampToValueAtTime(
      peak,
      popTime + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      peak * 0.55,
      popTime + 0.055
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      popTime + popDuration
    );

      pop
        .connect(filter)
        .connect(gain)
        .connect(overrunBus);
      // Kurzer Crackle-Anteil.
      // Gibt jedem tiefen Impuls etwas Kontur,
      // ohne daraus ein hartes PENG zu machen.
      const crackle =
        ctx.createBufferSource();
      
      crackle.buffer =
        sharedNoiseBuffer;
      
      const crackleFilter =
        ctx.createBiquadFilter();
      
      crackleFilter.type =
        "bandpass";
      
      crackleFilter.frequency.value =
        1300 +
        Math.random() * 1000;
      
      crackleFilter.Q.value =
        1.2;
      
      const crackleGain =
        ctx.createGain();
      
      const cracklePeak =
        (
          0.012 +
          amount * 0.045
        ) *
        volume *
        randomStrength *
        2.5;
      
      crackleGain.gain.setValueAtTime(
        0.0001,
        popTime
      );
      
      crackleGain.gain.exponentialRampToValueAtTime(
        cracklePeak,
        popTime + 0.004
      );
      
      crackleGain.gain.exponentialRampToValueAtTime(
        0.0001,
        popTime + 0.045
      );

      // Kurzer elektronischer Unterton.
      // Gibt jedem Knall einen synthetischen,
      // leicht aggressiven Impuls, ohne den
      // eigentlichen Auspuff-Pop zu ersetzen.
      const electric =
        ctx.createOscillator();

      electric.type =
        "triangle";

      electric.frequency.setValueAtTime(
        620 +
          amount * 180 +
          Math.random() * 120,
        popTime
      );

      electric.frequency.exponentialRampToValueAtTime(
        260 +
          Math.random() * 80,
        popTime + 0.075
      );

      const electricGain =
        ctx.createGain();

      const electricPeak =
        (
          0.010 +
          amount * 0.028
        ) *
        volume *
        randomStrength *
        2.0;

      electricGain.gain.setValueAtTime(
        0.0001,
        popTime
      );

      electricGain.gain.exponentialRampToValueAtTime(
        electricPeak,
        popTime + 0.004
      );

      electricGain.gain.exponentialRampToValueAtTime(
        0.0001,
        popTime + 0.085
      );

      electric
        .connect(electricGain)
        .connect(overrunBus);
      
      crackle
        .connect(crackleFilter)
        .connect(crackleGain)
        .connect(overrunBus);
    
      pop.start(popTime);
      crackle.start(popTime);
      electric.start(popTime);
      
      pop.stop(
        popTime +
        popDuration +
        0.02
      );
      
      crackle.stop(
        popTime + 0.06
      );
      electric.stop(
        popTime + 0.10
      );
  }
}
  
// =========================
// DSG-Schaltblubbern
// =========================

function triggerShiftBurble(
  intensity = 0.7,
  volumePercent = 60
) {
  if (
    !started ||
    !ctx ||
    !master
  ) {
    return;
  }

  const amount =
    clamp(
      Number(intensity) || 0,
      0,
      1
    );

  const volumeAmount =
    Math.pow(
      volumeCurve(volumePercent),
      2
    );

  if (volumeAmount <= 0.001) {
    return;
  }

  // JEDES echte Hochschalten soll hörbar sein.
  // Der Fahrstil bestimmt nur noch,
  // wie brutal der Effekt wird.
  const effectAmount =
    clamp(
      0.40 +
      amount * 0.60,
      0.40,
      1
    );

  const now =
    ctx.currentTime;

  // Deutlich länger als vorher:
  // ungefähr 0,44 - 0,60 Sekunden.
  const duration =
    0.34 +
    effectAmount * 0.26;

  // Merken, bis wann das DSG-Furzen läuft.
  // 10 ms Reserve sorgen für einen sauberen,
  // praktisch nahtlosen Übergang.
  shiftBurbleUntil =
    now + duration + 0.01;


  // =========================
  // Haupt-Furz
  // =========================

  const burble =
    ctx.createOscillator();

  burble.type =
    "sawtooth";

  burble.frequency.setValueAtTime(
    58 +
      effectAmount * 8,
    now
  );

  burble.frequency.exponentialRampToValueAtTime(
    46 +
      effectAmount * 3,
    now + duration
  );


  // =========================
  // Tiefer Unterton
  // =========================

  const subBurble =
    ctx.createOscillator();

  subBurble.type =
    "triangle";

  subBurble.frequency.setValueAtTime(
    58 +
      effectAmount * 7,
    now
  );

  subBurble.frequency.exponentialRampToValueAtTime(
    43,
    now + duration
  );


  // =========================
  // Filter
  // =========================

  const filter =
    ctx.createBiquadFilter();

  filter.type =
    "lowpass";

  filter.frequency.setValueAtTime(
    260 +
      effectAmount * 110,
    now
  );

  filter.frequency.exponentialRampToValueAtTime(
    140,
    now + duration
  );

  filter.Q.value =
    0.85;


  // =========================
  // BRR - BRR - BRR
  // =========================

  const gain =
    ctx.createGain();

  // Absichtlich sehr kräftig.
  // Der Master-Kompressor fängt
  // extreme Spitzen anschließend ab.
  const peak =
    (
      0.09 +
      effectAmount * 0.30
    ) *
    volumeAmount;

  const dip =
    (
      0.008 +
      effectAmount * 0.025
    ) *
    volumeAmount;

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  // Erster kräftiger Schlag
  gain.gain.exponentialRampToValueAtTime(
    peak,
    now + 0.012
  );

  // erster Aussetzer
  gain.gain.exponentialRampToValueAtTime(
    dip,
    now + duration * 0.20
  );

  // zweiter Schlag
  gain.gain.exponentialRampToValueAtTime(
    peak * 0.95,
    now + duration * 0.34
  );

  // zweiter Aussetzer
  gain.gain.exponentialRampToValueAtTime(
    dip,
    now + duration * 0.49
  );

  // dritter Schlag
  gain.gain.exponentialRampToValueAtTime(
    peak * 0.80,
    now + duration * 0.64
  );

  // kurzer Aussetzer
  gain.gain.exponentialRampToValueAtTime(
    dip * 0.80,
    now + duration * 0.78
  );

  // letztes Nachblubbern
  gain.gain.exponentialRampToValueAtTime(
    peak * 0.45,
    now + duration * 0.87
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );


  const subGain =
    ctx.createGain();

  subGain.gain.value =
    0.85;


  burble
    .connect(filter);

  subBurble
    .connect(subGain)
    .connect(filter);

  filter
    .connect(gain)
    .connect(master);


  // =========================
  // Tiefbass-Impuls
  // =========================

  const bassKick =
    ctx.createOscillator();

  bassKick.type =
    "sine";

  // Beginnt ungefähr bei 60 Hz
  // und fällt sehr schnell nach unten.
  bassKick.frequency.setValueAtTime(
    58 +
      effectAmount * 8,
    now
  );

  bassKick.frequency.exponentialRampToValueAtTime(
    44,
    now + 0.22
  );

  const bassKickGain =
    ctx.createGain();

  const bassPeak =
    (
      0.16 +
      effectAmount * 0.48
    ) *
    volumeAmount;

  bassKickGain.gain.setValueAtTime(
    0.0001,
    now
  );

  // Sehr schneller Bass-Schlag
  bassKickGain.gain.exponentialRampToValueAtTime(
    bassPeak,
    now + 0.008
  );

  bassKickGain.gain.exponentialRampToValueAtTime(
    bassPeak * 0.58,
    now + 0.055
  );

  bassKickGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.24
  );

  bassKick
    .connect(bassKickGain)
    .connect(master);


  // =========================
  // Start / Stop
  // =========================

  burble.start(now);
  subBurble.start(now);
  bassKick.start(now);

  burble.stop(
    now + duration + 0.03
  );

  subBurble.stop(
    now + duration + 0.03
  );

  bassKick.stop(
    now + 0.27
  );
}

// =========================
// Rückschalt-Blip / Zwischengas
// =========================

function triggerDownshiftBlip(
  intensity = 0.7,
  volumePercent = 55
) {
  if (
    !started ||
    !ctx ||
    !master
  ) {
    return;
  }

  const amount =
    clamp(
      Number(intensity) || 0,
      0,
      1
    );

  const volume =
    volumeCurve(volumePercent);

  if (
    amount <= 0.01 ||
    volume <= 0.001
  ) {
    return;
  }

  const now =
    ctx.currentTime;

  // Sportliche Rückschaltungen werden
  // etwas länger und kräftiger.
  const duration =
    0.18 +
    amount * 0.16;


  // =========================
  // Haupt-Blip
  // =========================

  const blip =
    ctx.createOscillator();

  blip.type =
    "sawtooth";

  const startFreq =
    95 +
    amount * 25;

  const peakFreq =
    175 +
    amount * 105;

  blip.frequency.setValueAtTime(
    startFreq,
    now
  );

  // Rückschalten = Drehzahl wird angehoben.
  // Der Blip zieht deshalb ausschließlich
  // von einer niedrigen zu einer höheren Frequenz.
  blip.frequency.exponentialRampToValueAtTime(
    peakFreq,
    now + 0.095
  );


  // =========================
  // Tiefer Körper
  // =========================

  const body =
    ctx.createOscillator();

  body.type =
    "triangle";

  body.frequency.setValueAtTime(
    62 + amount * 12,
    now
  );

  // Auch der tiefe Körper zieht nach oben
  // und fällt innerhalb des Blips nicht
  // wieder zurück.
  body.frequency.exponentialRampToValueAtTime(
    92 + amount * 28,
    now + 0.10
  );


  // =========================
  // Filter
  // =========================

  const filter =
    ctx.createBiquadFilter();

  filter.type =
    "lowpass";

  filter.frequency.setValueAtTime(
    650 +
      amount * 650,
    now
  );

  filter.frequency.exponentialRampToValueAtTime(
    420 +
      amount * 180,
    now + duration
  );

  filter.Q.value =
    0.8;


  // =========================
  // Lautstärke-Hüllkurve
  // =========================

  const gain =
    ctx.createGain();

  const peak =
    (
      0.045 +
      amount * 0.145
    ) *
    volume;

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  // Sehr schneller Zwischengasstoß.
  gain.gain.exponentialRampToValueAtTime(
    peak,
    now + 0.018
  );

  gain.gain.exponentialRampToValueAtTime(
    peak * 0.72,
    now + 0.075
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );


  const bodyGain =
    ctx.createGain();

  bodyGain.gain.value =
    0.55;


  blip
    .connect(filter);

  body
    .connect(bodyGain)
    .connect(filter);

  filter
    .connect(gain)
    .connect(master);


  // =========================
  // Start / Stop
  // =========================

  blip.start(now);
  body.start(now);

  blip.stop(
    now + duration + 0.03
  );

  body.stop(
    now + duration + 0.03
  );
}
  
  // =========================
  // Sound-Layer aktualisieren
  // =========================

  function update(data, settings) {
    if (!started || !ctx) return null;

    const speedKmh =
      Number(data.speedKmh) || 0;

    const accel =
      Number(data.acceleration) || 0;

    const rpm =
      Number(data.rpm) || 0;

    const maxRpm =
      Math.max(
        1,
        Number(data.maxRpm) || 1
      );

      const drivingStyle =
        clamp(
          Number(data.drivingStyle) || 0,
          0,
          1
        );

    const idleProfile =
      getSoundProfile(
        "idle",
        settings.idleSoundProfile
      );

    const driveProfile =
      getSoundProfile(
        "drive",
        settings.driveSoundProfile
      );

    const accelProfile =
      getSoundProfile(
        "accel",
        settings.accelSoundProfile
      );

    const regenProfile =
      getSoundProfile(
        "regen",
        settings.regenSoundProfile
      );

    const baseStart =
      Number(settings.baseFrequency);
    
    const baseMax =
      Math.max(
        baseStart + 1,
        Number(settings.maxBaseFrequency) || 70
      );
    
    const pitch =
      Number(settings.pitch) / 10;

    const baseAmount =
      volumeCurve(settings.baseVolume);

    const inverterAmount =
      volumeCurve(settings.inverterVolume);

    const driveAmount =
      volumeCurve(settings.driveVolume);

    const regenAmount =
      volumeCurve(settings.regenVolume);

    const airAmount =
      volumeCurve(settings.airVolume);

    const speedN =
      clamp(
        speedKmh / 270,
        0,
        1
      );

    const pos =
      clamp(
        accel / 5.7,
        0,
        1
      );

    const neg =
      clamp(
        -accel / 3.2,
        0,
        1
      );

    const rpmN =
      clamp(
        rpm / maxRpm,
        0,
        1.08
      );

// =========================
// Beschleunigungs-Frequenzanstieg
// =========================

// Solange noch mindestens ungefähr
// 1 m/s² Beschleunigung anliegt,
// wirkt der Geschwindigkeitseinfluss voll.
//
// Dadurch steigt die Klangfrequenz beim
// Durchbeschleunigen weiter an, auch wenn
// die reale Beschleunigung bei hohem Tempo
// langsam schwächer wird.
const accelPresence =
  clamp(
    accel / 1.0,
    0,
    1
  );

const accelSpeedRise =
  Math.pow(
    speedN,
    0.75
  ) *
  accelPresence;    
    
// =========================
// Konstantfahrt beruhigen
// =========================

const nowMs = performance.now();

let overrunTriggered = false;
let bovTriggered = false;

const dt = clamp(
  (nowMs - lastSoundUpdate) / 1000,
  0,
  0.12
);

lastSoundUpdate = nowMs;

// EasyBOV übernimmt das bisherige Normalprofil.
//
// Ohne EasyBOV braucht der virtuelle Ladedruck
// deutlich stärkere oder länger anhaltende
// Beschleunigung und baut sich langsamer auf.
const easyBov = settings.easyBovEnabled;

const pressureStart = easyBov ? 0.45 : 0.65;
const pressureOffset = easyBov ? 0.40 : 0.60;
const pressureRange = easyBov ? 3.8 : 4.2;
const chargeTime = easyBov ? 1.20 : 1.50;

  if (accel > pressureStart) {
    bovPeakAccel = Math.max(bovPeakAccel, accel);
  
    const pressureTarget = clamp(
    (accel - pressureOffset) / pressureRange,
    0,
    1
  );

  // Vorhandenen Druck während der
  // Beschleunigung nicht wieder abbauen.
  if (pressureTarget > bovPressure) {
    const chargeRate = 1 - Math.exp(-dt / chargeTime);
    bovPressure += (pressureTarget - bovPressure) * chargeRate;
  }

  // EasyBOV verwendet die bisherigen
  // Normal-Schwellen. Das neue Normalprofil
  // wird erst nach klar aufgebauter Last scharf.
  const armPressure = easyBov ? 0.22 : 0.18;
  const armAccel = easyBov ? 0.65 : 0.95;

  if (bovPressure > armPressure && accel > armAccel) {
    bovArmed = true;
  }

} else if (!bovArmed) {
  // Ungenutzten Restdruck langsam abbauen.
  bovPressure *= Math.exp(-dt / 3.5);

  // Wenn praktisch kein Druck mehr vorhanden ist,
  // auch die alte Beschleunigungsphase vergessen.
  if (bovPressure < 0.01) {
    bovPressure = 0;
    bovPeakAccel = 0;
  }
}

bovPressure =
  clamp(bovPressure, 0, 1);

// =========================
// Schubknallen vorbereiten
// =========================

// Kräftige Beschleunigung merken.
// Die TXT-Werte entsprechen dem EasyBOV-Profil.
// Ohne EasyBOV benötigt Schubknallen jeweils
// 35 % mehr aufgebaute Last und Lastabfall.
const overrunTriggerSettings =
  overrunSoundMode === "sample"
    ? overrunSampleSettings
    : overrunSampleDefaultSettings;

const overrunSensitivityScale =
  easyBov
    ? 1
    : 1.35;

const overrunTriggerLoad =
  Math.max(
    0.1,
    overrunTriggerSettings.triggerLoad *
      overrunSensitivityScale
  );

const overrunTriggerDrop =
  Math.max(
    0.1,
    overrunTriggerSettings.triggerDrop *
      overrunSensitivityScale
  );

const overrunCooldown =
  Math.max(
    0,
    overrunTriggerSettings.cooldown
  );
    const overrunAbruptLoad =
  0.75 *
  (
    overrunTriggerLoad /
    0.95
  );

const overrunAbruptDrop =
  0.40 *
  (
    overrunTriggerDrop /
    0.65
  );
if (accel > 0.65) {
  overrunPeakAccel =
    Math.max(
      overrunPeakAccel,
      accel
    );
}

// Erst nach deutlich spürbarer Last
// darf beim späteren Lupfen geknallt werden.
if (
  overrunPeakAccel >
    overrunTriggerLoad
) {
  overrunArmed = true;
}

// Wenn nie genug Last aufgebaut wurde,
// einen kleinen Restwert langsam vergessen.
if (
  !overrunArmed &&
  accel < 0.25
) {
  overrunPeakAccel *=
    Math.exp(-dt / 2.5);

  if (overrunPeakAccel < 0.05) {
    overrunPeakAccel = 0;
  }
}
// Erst ab etwas Geschwindigkeit.
// An der Ampel soll das Brummen bestehen bleiben.
// =========================
// Konstantfahrt mit Hysterese
// =========================

// Um in den ruhigen Fahrmodus zu kommen,
// muss die Fahrt zunächst wirklich stabil sein.
const steadyEnter =
  speedKmh > 10 &&
  Math.abs(accel) < 0.18;

// Sobald wir bereits als Konstantfahrt gelten,
// dürfen kleine GPS-/Tempo-Schwankungen auftreten,
// ohne den Sound sofort wieder aufzuwecken.
const steadyKeep =
  speedKmh > 10 &&
  Math.abs(accel) < 0.70;

const alreadySteady =
  steadySince !== null ||
  cruiseQuiet > 0.05;

const steadyDriving =
  alreadySteady
    ? steadyKeep
    : steadyEnter;

if (steadyDriving) {
  if (steadySince === null) {
    steadySince = nowMs;
  }
} else {
  steadySince = null;
}

const steadySeconds =
  steadySince === null
    ? 0
    : (nowMs - steadySince) / 1000;

// Erst nach 2 Sekunden Konstantfahrt leiser werden.
const quietTarget =
  steadySeconds >= 2.0;

// Langsam leiser,
// aber bei Beschleunigung/Reku schnell wieder präsent.
if (quietTarget) {
  cruiseQuiet += dt / 2.2;
} else {
  cruiseQuiet -= dt / 0.30;
}

cruiseQuiet =
  clamp(cruiseQuiet, 0, 1);

// 0 % = keine Dämpfung
// 100 % = bei voller Konstantfahrt stumm
const cruiseDamping = clamp(Number(settings.cruiseDamping ?? 70) / 100, 0, 1);
const cruiseScale = 1 - cruiseQuiet * cruiseDamping;

    // =========================
    // Idle ↔ Fahrsound Crossfade
    // =========================
    
    // 0 km/h:
    // Idle 100 % · Grundsound 0 %
    //
    // 5 km/h:
    // Idle 0 % · Grundsound 100 %
    const driveMix = clamp(speedKmh / 5, 0, 1);
    const idleMix = 1 - driveMix;

    setTarget(
      idle1.frequency,
      idleProfile.frequencies[0],
      0.18
    );

    setTarget(
      idle2.frequency,
      idleProfile.frequencies[1],
      0.18
    );

    setTarget(
      idle3.frequency,
      idleProfile.frequencies[2],
      0.18
    );

    setTarget(
      idleHighpass.frequency,
      idleProfile.highpass,
      0.18
    );

    setTarget(
      idleFilter.frequency,
      idleProfile.lowpass,
      0.18
    );

    setTarget(
      idlePulseOsc.frequency,
      idleProfile.pulseHz,
      0.18
    );

    setTarget(
      idlePulseDepth.gain,
      idleProfile.pulseDepth,
      0.18
    );

    setTarget(
      idle2Gain.gain,
      idleProfile.textureGain,
      0.18
    );

    setTarget(
      idle3Gain.gain,
      idleProfile.presenceGain,
      0.18
    );

    setTarget(
      idleToneDepth.gain,
      idleProfile.toneDepth,
      0.18
    );
    
    setTarget(
      idleGain.gain,
      baseAmount *
        idleMix *
        0.052 *
        idleProfile.gainScale,
      0.12
    );

    // =========================
    // Grundsound
    // =========================

    const rawFundamental =
      baseStart +
        rpmN * (pitch * 120) +
        Math.pow(rpmN, 2) * 38 +
        pos * 16 +
    
        // Beim Durchbeschleunigen steigt
        // die Grundfrequenz mit dem Tempo weiter.
        accelSpeedRise * 22;
    
    const baseRange =
      Math.max(
        1,
        baseMax - baseStart
      );
    
    const frequencyRise =
      Math.max(
        0,
        rawFundamental - baseStart
      );
    
    // Weicher Frequenzdeckel:
    // Die Frequenz nähert sich dem Maximalwert,
    // statt dort hart abgeschnitten zu werden.
    const fundamental =
      baseStart +
      baseRange *
        (
          1 -
          Math.exp(
            -frequencyRise /
            (baseRange * 2.5)
          )
        );

    const driveFundamental =
      baseStart +
      (
        fundamental -
        baseStart
      ) *
      driveProfile.frequencyScale;

    setTarget(
      base1.frequency,
      driveFundamental,
      0.04
    );

    setTarget(
      base2.frequency,
      driveFundamental *
        (
          driveProfile.harmonicRatio +
          pos * 0.015
        ),
      0.055
    );

    const subFrequency =
      clamp(
        30 +
          rpmN * 12 +
          pos * 6,
        30,
        48
      );
    
    setTarget(
      sub.frequency,
      subFrequency,
      0.07
    );

    setTarget(
      baseFilter.frequency,
      clamp(
        (
          620 +
          rpmN * 900 +
          Math.pow(speedN, 0.70) * 650 +
          pos * 320
        ) *
        driveProfile.filterScale,
        420,
        2600
      ),
      0.10
    );

    setTarget(
      baseGain1.gain,
      baseAmount *
        driveMix *
        cruiseScale *
        (
          0.095 +
          speedN * 0.055 +
          pos * 0.028
        ) *
        driveProfile.gainScale,
      0.08
    );
    
    setTarget(
      baseGain2.gain,
      baseAmount *
        driveMix *
        cruiseScale *
        (
          0.006 +
          speedN * 0.010 +
          pos * 0.008
        ) *
        driveProfile.gainScale,
      0.08
    );

    const subLevel =
      clamp(
        0.043 +
          rpmN * 0.015 +
          pos * 0.025 -
          speedN * 0.022,
        0.030,
        0.090
      );
    
    setTarget(
      subGain.gain,
      baseAmount *
        driveMix *
        cruiseScale *
        subLevel *
        driveProfile.subScale *
        driveProfile.gainScale,
      0.08
    );


    // =========================
    // Inverter
    // =========================

    const inverterHz =
      (
        235 +
        rpmN * 1600 +
        Math.pow(rpmN, 2) * 410
      ) *
      driveProfile.inverterPitchScale;

    setTarget(
      inv1.frequency,
      inverterHz,
      0.035
    );

    setTarget(
      inv2.frequency,
      inverterHz * 2.01,
      0.035
    );
    
    setTarget(
      inv3.frequency,
      inverterHz * 3.02,
      0.035
    );

    setTarget(
      invFilter.frequency,
      clamp(
        inverterHz * 1.32,
        650,
        4200
      ),
      0.06
    );

const inverterLoadPresence =
  clamp(
    pos / 0.55,
    0,
    1
  );

const invLevel =
  inverterAmount *
  0.78 *
  cruiseScale *
  driveProfile.inverterScale *
  (
    // Sehr leiser Grundanteil.
    0.002 +

    // Geschwindigkeit macht den Inverter
    // etwas präsenter, aber nicht mehr dominant.
    speedN * 0.010 +

    // Unter Last darf das elektrische
    // Surren deutlich stärker hervortreten.
    inverterLoadPresence * 0.022
  ) *

  // Bei Reku etwas zurücknehmen,
  // damit Inverter- und Reku-Layer
  // nicht gegeneinander arbeiten.
  (
    1 -
    neg * 0.45
  );

    setTarget(
      invGain1.gain,
      invLevel,
      0.06
    );

    setTarget(
      invGain2.gain,
      invLevel * 0.18,
      0.06
    );
    
    setTarget(
      invGain3.gain,
      invLevel * 0.07,
      0.06
    );


    // =========================
    // Beschleunigung
    // =========================

    const driveFreq =
      (
        220 +
        driveFundamental * 1.55 +
        Math.pow(speedN, 0.72) * 330 +
        pos * 110 +
        accelSpeedRise *
          210 *
          accelProfile.speedRiseScale
      ) *
      accelProfile.frequencyScale;

      // =========================
      // Beschleunigungs-Pulsierung
      // =========================
      
      // Schon mittlere Beschleunigung soll
      // deutlich auf den Puls reagieren.
      // Ab ca. 2,8 m/s² gilt die Last
      // für diesen Effekt praktisch als voll.
      const drivePulseLoad =
        clamp(
          accel / 2.8,
          0,
          1
        );

      // Fahrstil reagiert absichtlich nicht linear.
      //
      // Kleine Werte verändern den Sound nur wenig.
      // Erst bei sportlicher Fahrweise wird der
      // zusätzliche Pulscharakter deutlich.
      const drivePulseStyle =
        Math.pow(
          drivingStyle,
          0.80
        );
      
      // Puls wird mit dem Tempo schneller.
      //
      // Niedriges Tempo:
      // einzelne, fühlbare Schläge.
      //
      // Hohes Tempo:
      // zunehmend dichter und hektischer.
    const drivePulseHz =
      (
        0.48 +
        Math.pow(speedN, 0.65) * 0.55 +
        Math.pow(drivePulseLoad, 0.80) * 0.32 +
        drivePulseStyle *
          drivePulseLoad *
          0.18
      ) *
      accelProfile.pulseRateScale;
      
      setTarget(
        drivePulseOsc.frequency,
        drivePulseHz,
        0.10
      );
      
      // Wie tief der Sound zwischen zwei
      // Pulsen absinkt.
      //
      // Leichte Beschleunigung:
      // nur sanftes Atmen.
      //
      // Mittlere/starke Beschleunigung:
      // deutliches rhythmisches Pumpen.
      const drivePulseAmount =
        clamp(
          (
            0.008 +
            drivePulseLoad * 0.035 +
            speedN * 0.006 +
            drivePulseStyle *
              drivePulseLoad *
              0.012
          ) *
          accelProfile.pulseDepthScale,
          0.008,
          0.060
        );
      
      // Der LFO läuft bipolar.
      // Basis 1 - Tiefe sorgt dafür,
      // dass die Oberkante immer ungefähr
      // bei Gain 1 bleibt.
      setTarget(
        drivePulseGain.gain,
        1 - drivePulseAmount,
        0.10
      );
      
      setTarget(
        drivePulseDepth.gain,
        drivePulseAmount,
        0.10
      );
    
    setTarget(
      driveOsc.frequency,
      driveFreq,
      0.035
    );

    setTarget(
      driveFilter.frequency,
      clamp(
        (
          520 +
          Math.pow(speedN, 0.70) * 1250 +
          rpmN * 450 +
          pos * 420
        ) *
        accelProfile.filterScale,
        360,
        2600
      ),
      0.075
    );

    setTarget(
      driveGain.gain,
      driveAmount *
        pos *
        (
          0.024 +
          speedN * 0.044
        ) *
        accelProfile.gainScale,
      0.045
    );

    // =========================
    // Voltune 3 · Infinite Rise
    // =========================

    if (
      accelProfile.infiniteRise &&
      pos > 0.01
    ) {
      const riseRate =
        0.026 +
        Math.pow(
          pos,
          0.58
        ) * 0.115 +
        speedN * 0.028;

      accelRissetPhase =
        (
          accelRissetPhase +
          dt * riseRate
        ) % 1;
    }

    const accelRissetLevel =
      accelProfile.infiniteRise
        ? driveAmount *
          pos *
          (
            0.010 +
            Math.pow(pos, 0.72) *
              0.018 +
            speedN * 0.010
          )
        : 0;

    updateRissetLayer(
      accelRissetOsc,
      accelRissetGain,
      accelRissetBus,
      accelRissetFilter,
      accelRissetPhase,
      {
        minHz: 72,
        octaves: 5.05,
        level:
          accelRissetLevel,
        filterHz:
          1850 +
          speedN * 1450 +
          pos * 900
      }
    );


    // =========================
    // Reku
    // =========================

    const regenFreq =
      (
        260 +
        Math.pow(
          speedN,
          0.68
        ) * 760 +
        neg * 90
      ) *
      regenProfile.frequencyScale;

    setTarget(
      regenOsc1.frequency,
      regenFreq,
      0.045
    );

    setTarget(
      regenOsc2.frequency,
      regenFreq *
        regenProfile.harmonicRatio,
      0.045
    );

    setTarget(
      regenFilter.frequency,
      clamp(
        (
          520 +
          Math.pow(
            speedN,
            0.68
          ) * 1150 +
          neg * 240
        ) *
        regenProfile.filterScale,
        360,
        2100
      ),
      0.10
    );

    // =========================
    // Reku-Pulsierung
    // =========================
    
    // Schon normale Tesla-Reku soll hörbar
    // auf den Effekt wirken.
    // Bei ungefähr 2,6 m/s² Verzögerung ist
    // die Reku für die Pulsierung praktisch voll.
    const regenPulseLoad =
      clamp(
        -accel / 2.6,
        0,
        1
      );
    
    const regenPulseStyle =
      Math.pow(
        drivingStyle,
        0.85
      );
    
    // Bewusst etwas langsamer als die
    // Beschleunigungspulsierung.
    //
    // Geschwindigkeit sorgt für zunehmende Dichte,
    // starke Reku und sportlicher Fahrstil
    // verstärken sie zusätzlich.
    const regenPulseHz =
      (
        0.42 +
        Math.pow(speedN, 0.68) * 0.38 +
        Math.pow(regenPulseLoad, 0.82) * 0.25 +
        regenPulseStyle *
          regenPulseLoad *
          0.12
      ) *
      regenProfile.pulseRateScale;
    
    setTarget(
      regenPulseOsc.frequency,
      regenPulseHz,
      0.12
    );
    
    // Weniger tiefe Modulation als beim
    // Beschleunigen.
    //
    // Dadurch bleibt Reku eher ein gleichmäßiges
    // Ziehen mit hörbaren Pulsen statt eines
    // aggressiven Hämmerns.
    const regenPulseAmount =
      clamp(
        (
          0.006 +
          regenPulseLoad * 0.025 +
          speedN * 0.004 +
          regenPulseStyle *
            regenPulseLoad *
            0.008
        ) *
        regenProfile.pulseDepthScale,
        0.006,
        0.045
      );
    
    setTarget(
      regenPulseGain.gain,
      1 - regenPulseAmount,
      0.12
    );
    
    setTarget(
      regenPulseDepth.gain,
      regenPulseAmount,
      0.12
    );
    
    setTarget(
      regenGain.gain,
      regenAmount *
        neg *
        (
          0.022 +
          speedN * 0.040
        ) *
        regenProfile.gainScale,
      0.055
    );

    // =========================
    // Voltune 3 · Infinite Fall
    // =========================

    if (
      regenProfile.infiniteFall &&
      neg > 0.01
    ) {
      const fallRate =
        0.024 +
        Math.pow(
          neg,
          0.62
        ) * 0.098 +
        speedN * 0.022;

      regenRissetPhase =
        (
          regenRissetPhase -
          dt * fallRate +
          1
        ) % 1;
    }

    const regenRissetLevel =
      regenProfile.infiniteFall
        ? regenAmount *
          neg *
          (
            0.009 +
            Math.pow(neg, 0.74) *
              0.016 +
            speedN * 0.009
          )
        : 0;

    updateRissetLayer(
      regenRissetOsc,
      regenRissetGain,
      regenRissetBus,
      regenRissetFilter,
      regenRissetPhase,
      {
        minHz: 64,
        octaves: 4.85,
        level:
          regenRissetLevel,
        filterHz:
          1450 +
          speedN * 1050 +
          neg * 420
      }
    );


    // =========================
    // Luft / Textur
    // =========================

    const airLevel =
      airAmount *
      0.55 *
      cruiseScale *
      driveProfile.airScale *
      (
        driveProfile.muscle
          ? 0.25
          : 1
      ) *
      (
        speedN * 0.004 +
        pos * 0.016 +
        neg * 0.012
      );

    setTarget(
      airGain.gain,
      airLevel,
      0.09
    );

    setTarget(
      airFilter.frequency,
      1250 +
        speedN * 1800,
      0.1
    );


    // =========================
    // Voltune 6 · Wankel JDM Idle Runtime
    // =========================
    //
    // Der Sound Generator erzeugt ausschließlich
    // Stand-/Idle-Sounds. Deshalb wird der Wankel
    // hier NICHT mehr an virtuelle RPM, Last,
    // Beschleunigung oder Reku gekoppelt.
    //
    // Im Stand läuft der Loop exakt mit der
    // Generator-Geschwindigkeit (playbackRate 1.0).
    // Zwischen 0 und 5 km/h wird er über idleMix
    // sauber ausgeblendet.
    const wankelIdleActive =
      Boolean(
        idleProfile.wankel
      ) &&
      idleMix > 0.001;

    if (
      wankelSource &&
      wankelGain &&
      wankelFilter
    ) {
      setTarget(
        wankelSource.playbackRate,
        1.0,
        0.025
      );

      if (wankelIdleActive) {
        setTarget(
          wankelGain.gain,
          clamp(
            baseAmount *
              idleMix *
              0.155,
            0.0001,
            0.30
          ),
          0.060
        );

        setTarget(
          wankelFilter.frequency,
          1050,
          0.070
        );

      } else {
        setTarget(
          wankelGain.gain,
          0.0001,
          0.080
        );
      }
    }

    // =========================
    // Voltune 6 · Wankel JDM Fahrgrundsound
    // =========================

    const wankelDriveActive =
      Boolean(
        driveProfile.wankelDrive
      ) &&
      driveMix > 0.001;

    if (
      wankelDriveSource &&
      wankelDriveGain &&
      wankelDriveFilter
    ) {
      if (wankelDriveActive) {
        const effectiveRpm =
          Math.max(
            1600,
            rpm || 1600
          );

        const playbackRate =
          clamp(
            effectiveRpm /
            wankelDriveReferenceRpm,
            0.53,
            2.80
          );

        setTarget(
          wankelDriveSource.playbackRate,
          playbackRate,
          0.050
        );

        const load =
          clamp(
            pos +
              drivingStyle * 0.22,
            0,
            1
          );

        setTarget(
          wankelDriveGain.gain,
          clamp(
            baseAmount *
              driveMix *
              cruiseScale *
              (
                0.105 +
                load * 0.055
              ),
            0.0001,
            0.28
          ),
          0.060
        );

        setTarget(
          wankelDriveFilter.frequency,
          clamp(
            760 +
              playbackRate * 290 +
              load * 950,
            700,
            3000
          ),
          0.070
        );

      } else {
        setTarget(
          wankelDriveGain.gain,
          0.0001,
          0.080
        );
      }
    }

    // =========================
    // Voltune 5 · Muscle Runtime
    // =========================

    const muscleAccelActive =
      Boolean(
        accelProfile.muscle
      ) &&
      pos > 0.035;

    const muscleRegenActive =
      Boolean(
        regenProfile.muscle
      ) &&
      neg > 0.035;

    const muscleIdleActive =
      !muscleAccelActive &&
      !muscleRegenActive &&
      Boolean(
        idleProfile.muscle
      ) &&
      idleMix > 0.30;

    const muscleDriveActive =
      !muscleAccelActive &&
      !muscleRegenActive &&
      !muscleIdleActive &&
      Boolean(
        driveProfile.muscle
      ) &&
      driveMix > 0.12;

    if (muscleAccelActive) {
      updateMuscleMachine({
        active: true,
        mode: "accel",
        rpmN,
        speedN,
        load: pos,
        level:
          driveAmount *
          (
            0.050 +
            pos * 0.155
          ),
        braking: 0
      });

    } else if (muscleRegenActive) {
      updateMuscleMachine({
        active: true,
        mode: "regen",
        rpmN,
        speedN,
        load:
          Math.max(
            0.12,
            pos * 0.25
          ),
        level:
          regenAmount *
          (
            0.040 +
            neg * 0.090
          ),
        braking: neg
      });

    } else if (muscleIdleActive) {
      updateMuscleMachine({
        active: true,
        mode: "idle",
        rpmN:
          Math.max(
            0.06,
            rpmN
          ),
        speedN,
        load: 0.06,
        level:
          baseAmount *
          idleMix *
          0.072,
        braking: 0
      });

    } else if (muscleDriveActive) {
      updateMuscleMachine({
        active: true,
        mode: "drive",
        rpmN,
        speedN,
        load:
          Math.max(
            0.08,
            pos * 0.55
          ),
        level:
          baseAmount *
          driveMix *
          cruiseScale *
          (
            0.045 +
            speedN * 0.032
          ),
        braking: 0
      });

    } else {
      updateMuscleMachine({
        active: false,
        mode: "off",
        rpmN: 0,
        speedN: 0,
        load: 0,
        level: 0,
        braking: 0
      });
    }


    // =========================
    // Voltune 4 · Sentinel Runtime
    // =========================

    const sentinelAccelActive =
      Boolean(
        accelProfile.sentinel
      ) &&
      pos > 0.045;

    const sentinelRegenActive =
      Boolean(
        regenProfile.sentinel
      ) &&
      neg > 0.045;

    const sentinelIdleActive =
      !sentinelAccelActive &&
      !sentinelRegenActive &&
      Boolean(
        idleProfile.sentinel
      ) &&
      idleMix > 0.35;

    const sentinelDriveActive =
      !sentinelAccelActive &&
      !sentinelRegenActive &&
      !sentinelIdleActive &&
      Boolean(
        driveProfile.sentinel
      ) &&
      driveMix > 0.15;

    if (sentinelAccelActive) {
      const lowSpeedStability =
        1 -
        clamp(
          speedKmh / 45,
          0,
          1
        );

      const sentinelRampOffset =
        getSentinelRampOffset(
          true,
          dt,

          // Noch schneller, besonders bei Last.
          // Dadurch wird die Bewegung als technische
          // Modulation wahrgenommen und nicht als
          // langsames Frequenz-Eiern.
          6.5 +
            pos * 12.0 +
            speedN * 3.5,

          // Kleineres Band:
          // schneller, enger, aggressiver.
          6 +
            pos * 18
        );

      updateSentinelMachine({
        active: true,

        // Bei niedriger Geschwindigkeit den
        // Grundkörper stark stabilisieren.
        // Beschleunigung darf ihn dort kaum
        // langsam hoch- und runterziehen.
        baseHz:
          70 +
          speedN * 78 +
          pos *
            (
              28 -
              lowSpeedStability * 23
            ),

        level:
          driveAmount *
          (
            0.055 +
            pos * 0.14
          ),

        filterHz:
          520 +
          speedN * 520 +
          pos * 320,

        pulseHz:
          6.0 +
          speedN * 2.5 +
          pos * 5.5,

        // Nahezu keine langsame
        // Lautstärke-Welle mehr.
        pulseDepth:
          0.004 +
          pos * 0.008,

        fmHz: 0.2,
        fmDepth: 0,

        rampOffset:
          sentinelRampOffset,

        metal:
          1.0 +
          pos * 0.80
      });

      if (
        accel > 1.05 &&
        lastAccel <= 1.05
      ) {
        triggerSentinelImpulse(
          1,
          clamp(
            accel / 4.0,
            0,
            1
          )
        );
      }

    } else if (sentinelRegenActive) {
      getSentinelRampOffset(
        false,
        dt,
        0,
        0
      );

      updateSentinelMachine({
        active: true,
        baseHz:
          54 +
          speedN * 58 -
          neg * 12,
        level:
          regenAmount *
          (
            0.040 +
            neg * 0.095
          ),
        filterHz:
          360 +
          speedN * 280,
        pulseHz:
          2.4 +
          speedN * 2.0 +
          neg * 4.8,
        pulseDepth:
          0.08 +
          neg * 0.16,
        fmHz:
          1.1 +
          neg * 3.2,
        fmDepth:
          8 +
          neg * 46,
        rampOffset: 0,
        metal:
          0.62 +
          neg * 0.44
      });

      if (
        accel < -1.05 &&
        lastAccel >= -1.05
      ) {
        triggerSentinelImpulse(
          -1,
          clamp(
            -accel / 3.5,
            0,
            1
          )
        );
      }

    } else if (sentinelIdleActive) {
      getSentinelRampOffset(
        false,
        dt,
        0,
        0
      );

      updateSentinelMachine({
        active: true,
        baseHz: 41,
        level:
          baseAmount *
          idleMix *
          0.050,
        filterHz: 360,
        pulseHz: 0.44,
        pulseDepth: 0.018,
        fmHz: 0.2,
        fmDepth: 0,
        metal: 0.72
      });

    } else if (sentinelDriveActive) {
      getSentinelRampOffset(
        false,
        dt,
        0,
        0
      );

      updateSentinelMachine({
        active: true,
        baseHz:
          48 +
          speedN * 74,
        level:
          baseAmount *
          driveMix *
          cruiseScale *
          (
            0.038 +
            speedN * 0.028
          ),
        filterHz:
          390 +
          speedN * 340,
        pulseHz:
          1.0 +
          speedN * 1.4,
        pulseDepth:
          0.018 +
          speedN * 0.015,
        fmHz: 0.2,
        fmDepth: 0,
        metal:
          0.65 +
          speedN * 0.30
      });

    } else {
      getSentinelRampOffset(
        false,
        dt,
        0,
        0
      );

      updateSentinelMachine({
        active: false,
        baseHz: 42,
        level: 0,
        filterHz: 360,
        pulseHz: 0.5,
        pulseDepth: 0,
        fmHz: 0.5,
        fmDepth: 0,
        metal: 0
      });
    }


    // =========================
    // BOV-Automatik
    // =========================

const accelDrop = lastAccel - accel;
const peakAccelDrop = bovPeakAccel - accel;

// Sobald Druck aufgebaut wurde, darf das BOV
// auch bei noch positiver Beschleunigung auslösen.
// Entscheidend ist die deutliche Lastwegnahme.
const releasePressure = easyBov ? 0.14 : 0.18;
const releaseAccel = easyBov ? 0.45 : 0.30;
const peakDropNeeded = easyBov ? 0.45 : 0.70;

// Wie viel von der vorherigen Last noch übrig ist.
// Beispiel:
// Peak 3,0 m/s² -> aktuell 0,6 m/s² = 20 %
const remainingLoad = bovPeakAccel > 0
  ? accel / bovPeakAccel
  : 1;

const relativeLoadDrop = easyBov
  ? remainingLoad < 0.35
  : remainingLoad < 0.25;

// Sehr schnelle Lastwegnahme zusätzlich direkt erkennen.
const abruptLastAccel = easyBov ? 0.70 : 0.95;
const abruptAccelDrop = easyBov ? 0.35 : 0.55;

const bovRelease =
  bovArmed &&
  bovPressure > releasePressure &&
  (
    // Die starke Beschleunigungsphase ist vorbei.
    // Das Fahrzeug darf dabei noch leicht weiterbeschleunigen.
    (
      peakAccelDrop > peakDropNeeded &&
      (
        accel < releaseAccel ||
        relativeLoadDrop
      )
    ) ||

    // Schnelles Lupfen direkt erkennen.
    (
      lastAccel > abruptLastAccel &&
      accelDrop > abruptAccelDrop
    )
  );

if (bovRelease) {
  bovTriggered = true;

  const bovIntensity =
    clamp(
      Math.pow(
        bovPressure,
        1.7
      ),
      0.01,
      1
    );

  triggerBov(
    bovIntensity,
    settings.bovVolume,
    settings.easyBovEnabled
      ? 700
      : 900
  );

  triggerTurboFlutter(
    bovIntensity,
    settings.flutterVolume
  );

  // BOV und Schubknallen dürfen wieder gleichzeitig
  // aus derselben Lastphase starten. Sobald das BOV
  // entlädt und das Schubknallen bereits vorbereitet ist,
  // startet der Overrun ohne den sonstigen 25-ms-Puffer.
  // Eine bereits laufende DSG-Sequenz behält über
  // shiftBurbleUntil weiterhin ihre Priorität.
  if (
    overrunArmed &&
    Number(settings.overrunVolume) > 0 &&
    nowMs - lastOverrunAt > overrunCooldown
  ) {
    const simultaneousOverrunIntensity =
      clamp(
        (overrunPeakAccel - 0.8) / 1.7,
        0.15,
        1
      );

    triggerOverrun(
      simultaneousOverrunIntensity,
      settings.overrunVolume,
      true,
      drivingStyle
    );

    overrunTriggered = true;
    lastOverrunAt = nowMs;
    overrunPeakAccel = 0;
    overrunArmed = false;
  }
  
  // Ein BOV entleert den virtuellen Druck
  // vollständig.
  bovPressure = 0;
  bovArmed = false;
  bovPeakAccel = 0;
}

// =========================
// Schubknallen auslösen
// =========================

const overrunDrop =
  overrunPeakAccel - accel;

const overrunRelease =
  overrunArmed &&
  (
    // Deutliches Lupfen nach stärkerer Last.
    (
      overrunDrop >
        overrunTriggerDrop &&
      accel < 0.45
    ) ||

    // Sehr schnelle Lastwegnahme direkt erkennen.
    (
      lastAccel >
        overrunAbruptLoad &&
      accelDrop >
        overrunAbruptDrop
    )
  );

if (
  overrunRelease &&
  nowMs - lastOverrunAt >
    overrunCooldown
) {
  const overrunIntensity =
    clamp(
      (overrunPeakAccel - 0.8) / 1.7,
      0.15,
      1
    );

  triggerOverrun(
    overrunIntensity,
    settings.overrunVolume,
    false,
    drivingStyle
  );
  overrunTriggered = true;
  lastOverrunAt = nowMs;

  // Die gespeicherte Last ist nach einem
  // Schubknallen verbraucht.
  overrunPeakAccel = 0;
  overrunArmed = false;
}
    
lastAccel = accel;

    // Diese Werte braucht app.js
    // nur noch für die Anzeigen.
    return {
      fundamentalHz: fundamental,
      inverterHz,
    
      drivePercent:
        Math.round(pos * 100),
    
      regenPercent:
        Math.round(neg * 100),
    
      bovPressurePercent:
        Math.round(bovPressure * 100),

      bovTriggered,
      bovArmed,
      bovPeakAccel,

      overrunTriggered,
      overrunArmed,
      overrunPeakAccel,

      accelDrop,
      overrunTriggerLoad,
      overrunTriggerDrop,
      easyBovEnabled: easyBov,

      soundProfiles: {
        idle:
          settings.idleSoundProfile ||
          "voltune1",
        drive:
          settings.driveSoundProfile ||
          "voltune1",
        accel:
          settings.accelSoundProfile ||
          "voltune1",
        regen:
          settings.regenSoundProfile ||
          "voltune1"
      }
    };
  }

  function resetDrivingState() {
    lastAccel = 0;
  
    bovPressure = 0;
    bovArmed = false;
    bovPeakAccel = 0;

    lastOverrunAt = -9999;
    overrunPeakAccel = 0;
    overrunArmed = false;

    shiftBurbleUntil = 0;
    pendingOverrun = null;
  
    steadySince = null;
    cruiseQuiet = 0;
    lastSoundUpdate = performance.now();
  }

  return {
    start,
    resume,
    stop,

    update,

    triggerBov,
    triggerTurboFlutter,
    triggerOverrun,
    triggerShiftBurble,
    triggerDownshiftBlip,

    setOverrunSound,
    
    setMasterVolume,
    setMuted,

    getSoundProfiles,

    isMuted,
    isStarted,

    resetDrivingState
  };
})();
