window.VoltuneAudio = (() => {
  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  let ctx = null;
  let master = null;
  let compressor = null;
  let started = false;
  let muted = false;

  let base1, base2, sub;
  let baseGain1, baseGain2, subGain, baseFilter;

  let inv1, inv2, inv3;
  let invGain1, invGain2, invGain3, invFilter;

  let driveOsc, driveGain, driveFilter;
  let regenOsc1, regenOsc2, regenGain, regenFilter;

  let airSource, airGain, airFilter;
  let sharedNoiseBuffer = null;

  let lastAccel = 0;
  let lastBovAt = -9999;

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

  function createOsc(type) {
    const osc =
      ctx.createOscillator();

    osc.type = type;

    return osc;
  }

  async function start() {
    if (started && ctx) {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    
      return true;
    }

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioCtx) {
      throw new Error(
        "Dieser Browser unterstützt die Web Audio API nicht."
      );
    }

    ctx = new AudioCtx();

    sharedNoiseBuffer =
      createNoiseBuffer(2);

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

    master
      .connect(compressor)
      .connect(ctx.destination);


    // =========================
    // Grundsound
    // =========================

    base1 = createOsc("triangle");
    base2 = createOsc("sawtooth");
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
    baseFilter.Q.value = 0.8;

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
    // Inverter
    // =========================

    inv1 = createOsc("sine");
    inv2 = createOsc("sine");
    inv3 = createOsc("triangle");

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
    invFilter.Q.value = 0.7;

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
      createOsc("sawtooth");

    driveGain =
      ctx.createGain();

    driveGain.gain.value = 0.0001;

    driveFilter =
      ctx.createBiquadFilter();

    driveFilter.type = "bandpass";
    driveFilter.frequency.value = 900;
    driveFilter.Q.value = 1.8;

    driveOsc
      .connect(driveGain)
      .connect(driveFilter)
      .connect(master);


    // =========================
    // Reku
    // =========================

    regenOsc1 =
      createOsc("triangle");

    regenOsc2 =
      createOsc("sine");

    regenGain =
      ctx.createGain();

    regenGain.gain.value = 0.0001;

    regenFilter =
      ctx.createBiquadFilter();

    regenFilter.type = "bandpass";
    regenFilter.frequency.value = 1050;
    regenFilter.Q.value = 1.25;

    const rg2 =
      ctx.createGain();

    rg2.gain.value = 0.36;

    regenOsc1.connect(regenGain);

    regenOsc2
      .connect(rg2)
      .connect(regenGain);

    regenGain
      .connect(regenFilter)
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
      inv1,
      inv2,
      inv3,
      driveOsc,
      regenOsc1,
      regenOsc2
    ].forEach(osc => osc.start());

    airSource.start();

    started = true;
    lastAccel = 0;
    lastBovAt = -9999;

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
    if (master) {
      master.gain.cancelScheduledValues(
        ctx.currentTime
      );

      master.gain.setValueAtTime(
        0.0001,
        ctx.currentTime
      );
    }
  } catch (error) {
    console.warn(
      "Voltune Audio konnte nicht gestoppt werden:",
      error
    );
  }

  // AudioContext absichtlich weiterlaufen lassen.
  // Nur der Master wird stumm geschaltet.
  muted = false;
  lastAccel = 0;
  lastBovAt = -9999;
}

  function setMasterVolume(percent) {
    if (!started || !master || !ctx) return;
  
      const target =
        muted
          ? 0.0001
          : clamp(
              (Number(percent) / 100) * 7.0,
              0.0001,
              7.0
            );
  
    const now = ctx.currentTime;
  
    const current =
      Math.max(
        0.0001,
        Number(master.gain.value) || 0.0001
      );
  
    master.gain.cancelScheduledValues(now);
  
    master.gain.setValueAtTime(
      current,
      now
    );
  
    master.gain.linearRampToValueAtTime(
      target,
      now + 0.12
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

    const bovAmount =
      Number(bovPercent) / 100;

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
      (0.10 + intensity * 0.08) *
        bovAmount,
      now + 0.018
    );

    hissGain.gain.exponentialRampToValueAtTime(
      (0.075 + intensity * 0.055) *
        bovAmount,
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
      (0.045 + intensity * 0.035) *
        bovAmount,
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

    const baseStart =
      Number(settings.baseFrequency);

    const pitch =
      Number(settings.pitch) / 10;

    const baseAmount =
      Number(settings.baseVolume) / 100;

    const inverterAmount =
      Number(settings.inverterVolume) / 100;

    const driveAmount =
      Number(settings.driveVolume) / 100;

    const regenAmount =
      Number(settings.regenVolume) / 100;

    const airAmount =
      Number(settings.airVolume) / 100;

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
// Konstantfahrt beruhigen
// =========================

const nowMs = performance.now();

const dt = clamp(
  (nowMs - lastSoundUpdate) / 1000,
  0,
  0.12
);

lastSoundUpdate = nowMs;

// Erst ab etwas Geschwindigkeit.
// An der Ampel soll das Brummen bestehen bleiben.
const steadyDriving =
  speedKmh > 10 &&
  Math.abs(accel) < 0.18;

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

// Bei voller Beruhigung:
// Base noch ca. 32 %
// Inverter noch ca. 22 %
const baseCruiseScale =
  1 - cruiseQuiet * 0.68;

const inverterCruiseScale =
  1 - cruiseQuiet * 0.78;


    // =========================
    // Grundsound
    // =========================

    const fundamental =
      clamp(
        baseStart +
          rpmN * (pitch * 120) +
          Math.pow(rpmN, 2) * 38 +
          pos * 16,
        10,
        620
      );

    setTarget(
      base1.frequency,
      fundamental,
      0.04
    );

    setTarget(
      base2.frequency,
      fundamental * 1.006,
      0.04
    );

    setTarget(
      sub.frequency,
      fundamental * 0.5,
      0.05
    );

    setTarget(
      baseFilter.frequency,
      760 +
        rpmN * 1250 +
        speedN * 350 +
        pos * 500,
      0.08
    );

    setTarget(
      baseGain1.gain,
      baseAmount *
        baseCruiseScale *
        (
          0.09 +
          speedN * 0.07 +
          pos * 0.018
        ),
      0.08
    );

    setTarget(
      baseGain2.gain,
      baseAmount *
        baseCruiseScale *
        (
          0.012 +
          speedN * 0.018
        ),
      0.08
    );

    setTarget(
      subGain.gain,
      baseAmount *
        baseCruiseScale *
        (
          0.055 -
          speedN * 0.024
        ),
      0.08
    );


    // =========================
    // Inverter
    // =========================

    const inverterHz =
      235 +
      rpmN * 1600 +
      Math.pow(rpmN, 2) * 410;

    setTarget(
      inv1.frequency,
      inverterHz,
      0.035
    );

    setTarget(
      inv2.frequency,
      inverterHz * 1.502,
      0.035
    );

    setTarget(
      inv3.frequency,
      inverterHz * 2.017,
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

    const invLevel =
      inverterAmount *
      inverterCruiseScale *
      (
        0.006 +
        speedN * 0.027 +
        pos * 0.010
      );

    setTarget(
      invGain1.gain,
      invLevel,
      0.06
    );

    setTarget(
      invGain2.gain,
      invLevel * 0.44,
      0.06
    );

    setTarget(
      invGain3.gain,
      invLevel * 0.20,
      0.06
    );


    // =========================
    // Beschleunigung
    // =========================

    const driveFreq =
      290 +
      fundamental * 2.25 +
      pos * 160;

    setTarget(
      driveOsc.frequency,
      driveFreq,
      0.035
    );

    setTarget(
      driveFilter.frequency,
      clamp(
        620 +
          rpmN * 1450 +
          pos * 850,
        500,
        3500
      ),
      0.055
    );

    setTarget(
      driveGain.gain,
      driveAmount *
        pos *
        (
          0.018 +
          speedN * 0.035
        ),
      0.045
    );


    // =========================
    // Reku
    // =========================

    const regenFreq =
      520 +
      rpmN * 1250;

    setTarget(
      regenOsc1.frequency,
      regenFreq,
      0.045
    );

    setTarget(
      regenOsc2.frequency,
      regenFreq * 1.49,
      0.045
    );

    setTarget(
      regenFilter.frequency,
      clamp(
        800 +
          rpmN * 1450,
        700,
        2600
      ),
      0.06
    );

    setTarget(
      regenGain.gain,
      regenAmount *
        neg *
        (
          0.016 +
          speedN * 0.035
        ),
      0.055
    );


    // =========================
    // Luft / Textur
    // =========================

    const airLevel =
      airAmount *
      (
        speedN * 0.005 +
        pos * 0.011 +
        neg * 0.007
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
    // BOV-Automatik
    // =========================

    if (
      lastAccel > 0.8 &&
      accel < -0.35
    ) {
      triggerBov(
        clamp(
          lastAccel / 5.7,
          0.35,
          1
        ),
        settings.bovVolume,
        650
      );
    }

    else if (
      settings.easyBovEnabled &&
      speedKmh > 7 &&
      accel < -0.06
    ) {
      triggerBov(
        clamp(
          0.42 +
            Math.abs(accel) / 4,
          0.42,
          0.85
        ),
        settings.bovVolume,
        900
      );
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
        Math.round(neg * 100)
    };
  }

  function resetDrivingState() {
    lastAccel = 0;
  
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

    setMasterVolume,
    setMuted,

    isMuted,
    isStarted,

    resetDrivingState
  };
})();
