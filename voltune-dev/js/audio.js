window.VoltuneAudio = (() => {
  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  let ctx = null;
  let master = null;
  let compressor = null;
  let loudnessGain = null;
  let limiter = null;
  let started = false;
  
  let muted = false;

  let base1, base2, sub;
  let baseGain1, baseGain2, subGain, baseFilter;

  let idle1, idle2;
  let idleGain, idle2Gain, idleFilter;
  
  let idlePulseOsc, idlePulseDepth, idlePulseGain;
  let idleDriftOsc, idleDriftDepth;
  let idleToneOsc, idleToneDepth;

  let inv1, inv2, inv3;
  let invGain1, invGain2, invGain3, invFilter;

  let driveOsc, driveGain, driveFilter;
  let regenOsc1, regenOsc2, regenGain, regenFilter;

  let airSource, airGain, airFilter;
  let sharedNoiseBuffer = null;

  let lastAccel = 0;
  let lastBovAt = -9999;
  let bovPressure = 0;
  let bovArmed = false;
  let bovPeakAccel = 0;
  let lastOverrunAt = -9999;
  let overrunPeakAccel = 0;
  let overrunArmed = false;

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
    
    // Zusätzliche Ausgangsverstärkung.
    // Damit können wir nach dem normalen Compressor
    // den gesamten Mix gezielt lauter machen.
    loudnessGain = ctx.createGain();
    loudnessGain.gain.value = 0.0001;
    
    // Letzte Schutzstufe direkt vor dem Ausgang.
    // Sie fängt nur sehr hohe Spitzen ab.
    limiter = ctx.createDynamicsCompressor();
    
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    
    master
      .connect(compressor)
      .connect(loudnessGain)
      .connect(limiter)
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
    // Stillstand / Idle
    // =========================
    
    // Zwei eng benachbarte Frequenzen.
    // Durch ihre Überlagerung entsteht
    // ein langsames rhythmisches Wummern.
    idle1 = createOsc("sine");
    idle2 = createOsc("triangle");
    
    idle1.frequency.value = 39;
    idle2.frequency.value = 78;
    
    idleGain =
      ctx.createGain();
    
    idleGain.gain.value =
      0.0001;

    idle2Gain = ctx.createGain();
    idle2Gain.gain.value = 0.22;

    idlePulseGain = ctx.createGain();
    idlePulseGain.gain.value = 0.82;
    
    idlePulseOsc = createOsc("sine");
    idlePulseOsc.frequency.value = 1.35;
    
    idlePulseDepth = ctx.createGain();
    idlePulseDepth.gain.value = 0.18;
    
    idlePulseOsc
      .connect(idlePulseDepth)
      .connect(idlePulseGain.gain);

    // Sehr langsames Wandern der Pulsrate.
    // Dadurch wirkt der Idle weniger synthetisch
    // und nicht wie ein perfektes Metronom.
    idleDriftOsc = createOsc("sine");
    idleDriftOsc.frequency.value = 0.17;
    
    idleDriftDepth = ctx.createGain();
    idleDriftDepth.gain.value = 0.18;
    
    idleDriftOsc
      .connect(idleDriftDepth)
      .connect(idlePulseOsc.frequency);

    idleFilter =
      ctx.createBiquadFilter();
    
    idleFilter.type =
      "lowpass";
    
    idleFilter.frequency.value =
      180;
    
    idleFilter.Q.value =
      0.7;

        // Sehr langsame Bewegung der Klangfarbe.
        // Der Idle wird dadurch etwas lebendiger,
        // ohne dass man einen eigenen Effekt heraushört.
        idleToneOsc = createOsc("sine");
        idleToneOsc.frequency.value = 0.09;
        
        idleToneDepth = ctx.createGain();
        idleToneDepth.gain.value = 18;
        
        idleToneOsc
          .connect(idleToneDepth)
          .connect(idleFilter.frequency);
    
    idle1
      .connect(idleGain)
      .connect(idleFilter);
    
    idle2
      .connect(idle2Gain)
      .connect(idleGain)
      .connect(idleFilter);
    
    idleFilter
      .connect(idlePulseGain)
      .connect(master);


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
      idle1,
      idle2,
      idlePulseOsc,
      idleDriftOsc,
      idleToneOsc,
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
      clamp(
        Number(bovPercent) / 100,
        0,
        1
      );
    
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
// Schubknallen / Nachblubbern
// =========================

function triggerOverrun(
  intensity = 1,
  volumePercent = 50
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
    clamp(
      Number(volumePercent) / 100,
      0,
      1
    );

  if (
    amount <= 0.01 ||
    volume <= 0.001
  ) {
    return;
  }

  const now =
    ctx.currentTime;

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
    // Nicht perfekt gleichmäßig verteilen.
    // Dadurch entsteht eher ein natürliches
    // Brabbeln als ein Metronom.
    const progress =
      (i + 1) /
      (popCount + 1);

    const randomOffset =
      (Math.random() - 0.5) *
      0.08;

    const popTime =
      now +
      0.04 +
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
      280 +
      amount * 260;

    filter.Q.value =
      0.8;

    const gain =
      ctx.createGain();

    const randomStrength =
      0.70 +
      Math.random() * 0.30;

    const peak =
      (
        0.018 +
        amount * 0.070
      ) *
      volume *
      randomStrength;

    gain.gain.setValueAtTime(
      0.0001,
      popTime
    );

    gain.gain.exponentialRampToValueAtTime(
      peak,
      popTime + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      popTime + popDuration
    );

    pop
      .connect(filter)
      .connect(gain)
      .connect(master);

    pop.start(popTime);

    pop.stop(
      popTime +
      popDuration +
      0.02
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
    clamp(
      Number(volumePercent) / 100,
      0,
      1
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


  // =========================
  // Haupt-Furz
  // =========================

  const burble =
    ctx.createOscillator();

  burble.type =
    "sawtooth";

  burble.frequency.setValueAtTime(
    68 +
      effectAmount * 10,
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
    320 +
      effectAmount * 160,
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
    
    const baseMax =
      Math.max(
        baseStart + 1,
        Number(settings.maxBaseFrequency) || 70
      );
    
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

const dt = clamp(
  (nowMs - lastSoundUpdate) / 1000,
  0,
  0.12
);

lastSoundUpdate = nowMs;

// EasyBOV nutzt ungefähr den bisherigen,
// leicht aufbaubaren Ladedruck.
//
// Normal-BOV braucht mehr Beschleunigung,
// baut weniger Druck auf und lädt langsamer.
const easyBov = settings.easyBovEnabled;

const pressureStart = easyBov ? 0.20 : 0.45;
const pressureOffset = easyBov ? 0.15 : 0.40;
const pressureRange = easyBov ? 2.8 : 3.8;
const chargeTime = easyBov ? 0.55 : 1.20;

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

  // EasyBOV wird weiterhin sehr früh scharf.
  // Normal-BOV benötigt deutlich mehr Druck
  // und eine stärkere Beschleunigung.
  const armPressure = easyBov ? 0.05 : 0.22;
  const armAccel = easyBov ? 0.25 : 0.65;

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
// Das Schubknallen arbeitet bewusst
// unabhängig von EasyBOV und BOV-Druck.
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
  overrunPeakAccel > 0.95
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
      idleGain.gain,
      baseAmount *
        idleMix *
        0.060,
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
        driveMix *
        cruiseScale *
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
        driveMix *
        cruiseScale *
        (
          0.012 +
          speedN * 0.018
        ),
      0.08
    );
    
    setTarget(
      subGain.gain,
      baseAmount *
        driveMix *
        cruiseScale *
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
        cruiseScale *
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
      pos * 160 +
    
      // Deutlich stärkerer Hochzieheffekt
      // speziell im Beschleunigungs-Layer.
      accelSpeedRise * 380;

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
      cruiseScale *
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

const accelDrop = lastAccel - accel;
const peakAccelDrop = bovPeakAccel - accel;

// Sobald Druck aufgebaut wurde, darf das BOV
// auch bei noch positiver Beschleunigung auslösen.
// Entscheidend ist die deutliche Lastwegnahme.
const releasePressure = easyBov ? 0.025 : 0.14;
const releaseAccel = easyBov ? 0.55 : 0.45;
const peakDropNeeded = easyBov ? 0.25 : 0.45;

// Wie viel von der vorherigen Last noch übrig ist.
// Beispiel:
// Peak 3,0 m/s² -> aktuell 0,6 m/s² = 20 %
const remainingLoad = bovPeakAccel > 0
  ? accel / bovPeakAccel
  : 1;

const relativeLoadDrop = easyBov
  ? remainingLoad < 0.45
  : remainingLoad < 0.35;

// Sehr schnelle Lastwegnahme zusätzlich direkt erkennen.
const abruptLastAccel = easyBov ? 0.35 : 0.70;
const abruptAccelDrop = easyBov ? 0.18 : 0.35;

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
      ? 500
      : 700
  );

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
      overrunDrop > 0.65 &&
      accel < 0.45
    ) ||

    // Sehr schnelle Lastwegnahme direkt erkennen.
    (
      lastAccel > 0.75 &&
      accelDrop > 0.40
    )
  );

if (
  overrunRelease &&
  nowMs - lastOverrunAt > 700
) {
  const overrunIntensity =
    clamp(
      (overrunPeakAccel - 0.8) / 2.5,
      0.15,
      1
    );

  triggerOverrun(
    overrunIntensity,
    settings.overrunVolume
  );

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
        Math.round(bovPressure * 100)
    };
  }

  function resetDrivingState() {
    lastAccel = 0;
  
    bovPressure = 0;
    bovArmed = false;
    bovPeakAccel = 0;
  
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
    triggerShiftBurble,

    setMasterVolume,
    setMuted,

    isMuted,
    isStarted,

    resetDrivingState
  };
})();
