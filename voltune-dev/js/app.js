(() => {
  const $ = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  const ui = {
    speed:$("speed"), accel:$("accel"), state:$("state"), speedBar:$("speedBar"),
    baseHz:$("baseHz"), invHz:$("invHz"), drivePct:$("drivePct"), regenPct:$("regenPct"),
    gearDisplay:$("gearDisplay"), rpmDisplay:$("rpmDisplay"), shiftTargetDisplay:$("shiftTargetDisplay"),

    start:$("start"), gps:$("gps"), restart:$("restart"), stop:$("stop"), mute:$("mute"),
    easyBov:$("easyBov"), gears:$("gears"), dynamicShift:$("dynamicShift"),
    gpsStatus:$("gpsStatus"), gpsAccuracy:$("gpsAccuracy"), gpsHz:$("gpsHz"), secureContext:$("secureContext"),

    speedTest:$("speedTest"), speedTestLabel:$("speedTestLabel"),
    volume:$("volume"), base:$("base"), pitch:$("pitch"),
    gearRange:$("gearRange"), maxRpm:$("maxRpm"), shiftRpm:$("shiftRpm"),
    baseVol:$("baseVol"), inverter:$("inverter"), drive:$("drive"),
    regen:$("regen"), air:$("air"), bov:$("bov"),

    volumeLabel:$("volumeLabel"), baseLabel:$("baseLabel"), pitchLabel:$("pitchLabel"),
    gearRangeLabel:$("gearRangeLabel"), maxRpmLabel:$("maxRpmLabel"), shiftRpmLabel:$("shiftRpmLabel"),
    baseVolLabel:$("baseVolLabel"), inverterLabel:$("inverterLabel"),
    driveLabel:$("driveLabel"), regenLabel:$("regenLabel"),
    airLabel:$("airLabel"), bovLabel:$("bovLabel")
  };

  let ctx = null;
  let master = null;
  let compressor = null;
  let audioStarted = false;
  let muted = false;

  let base1, base2, sub;
  let baseGain1, baseGain2, subGain, baseFilter;

  let inv1, inv2, inv3;
  let invGain1, invGain2, invGain3, invFilter;

  let driveOsc, driveGain, driveFilter;
  let regenOsc1, regenOsc2, regenGain, regenFilter;

  let airSource, airGain, airFilter;
  let sharedNoiseBuffer = null;

  let demoActive = false;
  let demoStart = 0;

  // ----- GPS aus Voltune v3.2 -----
  let gpsActive = false;
  let watchId = null;
  let lastPos = null;
  let lastGpsTs = null;
  let lastGpsSpeed = 0;
  let smoothGpsSpeed = 0;
  let gpsAccel = 0;
  let gpsRate = 0;
  const finite = v => Number.isFinite(v);

  let manualSpeed = 0;
  let lastManualSpeed = 0;
  let lastManualTime = performance.now();
  let manualAccel = 0;

  let lastAccel = 0;
  let lastState = "idle";
  let lastBovAt = -9999;

  // ----- Experimentelle Komfortfunktionen -----
  let easyBovEnabled = false;
  let gearsEnabled = true;
  let dynamicShiftEnabled = true;

  // TREMEC 6-Gang-Verhältnisfolge als virtuelles Sound-Getriebe.
  const gearRatios = [2.66, 1.78, 1.30, 1.00, 0.80, 0.63];
  const topGearRatio = gearRatios[gearRatios.length-1];
  let currentGear = 1;
  let virtualRpm = 0;
  let currentShiftTarget = 0;

  let previousGpsKmhForEasyBov = null;

  function setTarget(param, value, time=0.05) {
    if (!ctx) return;
    param.setTargetAtTime(value, ctx.currentTime, time);
  }

  function createNoiseBuffer(seconds=2) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i=0;i<length;i++) {
      const white = Math.random()*2-1;
      last = last*0.82 + white*0.18;
      data[i] = white*0.68 + last*0.32;
    }
    return buffer;
  }

  function createOsc(type) {
    const o = ctx.createOscillator();
    o.type = type;
    return o;
  }

  function startAudio() {
    if (audioStarted && ctx) {
      ctx.resume();
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      alert("Dieser Browser unterstützt die Web Audio API nicht.");
      return;
    }

    ctx = new AudioCtx();
    sharedNoiseBuffer = createNoiseBuffer(2);

    master = ctx.createGain();
    master.gain.value = 0.0001;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -13;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.15;

    master.connect(compressor).connect(ctx.destination);

    // ----- Grundsound -----
    base1 = createOsc("triangle");
    base2 = createOsc("sawtooth");
    sub = createOsc("sine");

    baseGain1 = ctx.createGain();
    baseGain2 = ctx.createGain();
    subGain = ctx.createGain();
    baseGain1.gain.value = 0.0001;
    baseGain2.gain.value = 0.0001;
    subGain.gain.value = 0.0001;

    baseFilter = ctx.createBiquadFilter();
    baseFilter.type = "lowpass";
    baseFilter.frequency.value = 1050;
    baseFilter.Q.value = 0.8;

    base1.connect(baseGain1).connect(baseFilter);
    base2.connect(baseGain2).connect(baseFilter);
    sub.connect(subGain).connect(baseFilter);
    baseFilter.connect(master);

    // ----- Inverter -----
    inv1 = createOsc("sine");
    inv2 = createOsc("sine");
    inv3 = createOsc("triangle");

    invGain1 = ctx.createGain();
    invGain2 = ctx.createGain();
    invGain3 = ctx.createGain();
    invGain1.gain.value = 0.0001;
    invGain2.gain.value = 0.0001;
    invGain3.gain.value = 0.0001;

    invFilter = ctx.createBiquadFilter();
    invFilter.type = "bandpass";
    invFilter.frequency.value = 1500;
    invFilter.Q.value = 0.7;

    inv1.connect(invGain1).connect(invFilter);
    inv2.connect(invGain2).connect(invFilter);
    inv3.connect(invGain3).connect(invFilter);
    invFilter.connect(master);

    // ----- Beschleunigung -----
    driveOsc = createOsc("sawtooth");
    driveGain = ctx.createGain();
    driveGain.gain.value = 0.0001;

    driveFilter = ctx.createBiquadFilter();
    driveFilter.type = "bandpass";
    driveFilter.frequency.value = 900;
    driveFilter.Q.value = 1.8;

    driveOsc.connect(driveGain).connect(driveFilter).connect(master);

    // ----- Reku -----
    regenOsc1 = createOsc("triangle");
    regenOsc2 = createOsc("sine");
    regenGain = ctx.createGain();
    regenGain.gain.value = 0.0001;

    regenFilter = ctx.createBiquadFilter();
    regenFilter.type = "bandpass";
    regenFilter.frequency.value = 1050;
    regenFilter.Q.value = 1.25;

    const rg2 = ctx.createGain();
    rg2.gain.value = 0.36;

    regenOsc1.connect(regenGain);
    regenOsc2.connect(rg2).connect(regenGain);
    regenGain.connect(regenFilter).connect(master);

    // ----- Luft / Textur -----
    airSource = ctx.createBufferSource();
    airSource.buffer = sharedNoiseBuffer;
    airSource.loop = true;

    airGain = ctx.createGain();
    airGain.gain.value = 0.0001;

    airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = 1700;
    airFilter.Q.value = 0.8;

    airSource.connect(airFilter).connect(airGain).connect(master);

    [base1,base2,sub,inv1,inv2,inv3,driveOsc,regenOsc1,regenOsc2].forEach(o => o.start());
    airSource.start();

    audioStarted = true;
    updateAudio(manualSpeed,0);
    setMasterVolume();
  }

  function haversine(a,b) {
    const R=6371000;
    const p1=a.lat*Math.PI/180, p2=b.lat*Math.PI/180;
    const dp=(b.lat-a.lat)*Math.PI/180;
    const dl=(b.lon-a.lon)*Math.PI/180;
    const h=Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function stopGps(resetText=false) {
    gpsActive=false;
    if (watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId=null;
    if (resetText) {
      ui.gpsStatus.textContent='gestoppt';
      ui.gpsStatus.className='';
      ui.gpsHz.textContent='0.0 Hz';
    }
  }

  function onPosition(pos) {
    if (!gpsActive) return;

    const ts=pos.timestamp || Date.now();
    const c=pos.coords;
    let speed=finite(c.speed) && c.speed>=0 ? c.speed : null;

    if (speed==null && lastPos && lastGpsTs) {
      const dt=(ts-lastGpsTs)/1000;
      if (dt>.15 && dt<10) {
        speed=haversine(lastPos,{lat:c.latitude,lon:c.longitude})/dt;
      }
    }

    if (speed==null) speed=0;
    if (speed<.45) speed=0;

    const firstGpsValue = lastGpsTs == null;
    
    if (firstGpsValue) {
      // Ersten Messwert nur als Ausgangszustand übernehmen.
      // Keine künstliche Beschleunigung von 0 auf aktuelle Geschwindigkeit erzeugen.
      smoothGpsSpeed = speed;
      lastGpsSpeed = speed;
      gpsAccel = 0;
      gpsRate = 0;
    } else {
      const dt = clamp((ts-lastGpsTs)/1000,.15,8);
      gpsRate = 1/dt;
    
      smoothGpsSpeed = smoothGpsSpeed*.58 + speed*.42;
    
      const rawGpsAccel = (smoothGpsSpeed-lastGpsSpeed)/dt;
      gpsAccel = gpsAccel*.68 + clamp(rawGpsAccel,-5,5)*.32;
    
      lastGpsSpeed = smoothGpsSpeed;
    }
    
    lastGpsTs=ts;
    lastPos={lat:c.latitude,lon:c.longitude};

    const kmh=smoothGpsSpeed*3.6;

    // EasyBOV-Fallback speziell für träges GPS:
    // Schon ein kleiner echter Geschwindigkeitsabfall kann die Entladung auslösen.
    if (
      easyBovEnabled &&
      previousGpsKmhForEasyBov != null &&
      kmh > 7 &&
      previousGpsKmhForEasyBov - kmh > 0.25
    ) {
      const drop = previousGpsKmhForEasyBov - kmh;
      triggerDigitalDischarge(clamp(0.42 + drop/5, 0.42, 0.85), 850);
    }
    previousGpsKmhForEasyBov=kmh;

    manualSpeed=kmh;
    lastManualSpeed=kmh;
    ui.speedTest.value=Math.round(clamp(kmh,0,270));
    ui.speedTestLabel.textContent=`${Math.round(kmh)} km/h`;

    if (finite(c.accuracy)) ui.gpsAccuracy.textContent=`${Math.round(c.accuracy)} m`;
    ui.gpsHz.textContent=`${gpsRate.toFixed(1)} Hz`;
    ui.gpsStatus.textContent='aktiv';
    ui.gpsStatus.className='okText';

    const state = gpsAccel > .22 ? 'GPS · Beschleunigen' :
                  gpsAccel < -.22 ? 'GPS · Reku' :
                  'GPS · Fahrt';
    render(kmh,gpsAccel,state);
  }

  function onGeoError(err) {
    const msg={
      1:'Berechtigung verweigert',
      2:'Position nicht verfügbar',
      3:'GPS-Timeout'
    }[err.code] || err.message || 'GPS-Fehler';
    ui.gpsStatus.textContent=msg;
    ui.gpsStatus.className='errText';
  }

  function startGps() {
    if (!("geolocation" in navigator)) {
      ui.gpsStatus.textContent='Geolocation nicht verfügbar';
      ui.gpsStatus.className='errText';
      return false;
    }

    stopGps(false);
    demoActive=false;
    gpsActive=true;
    lastPos=null;
    lastGpsTs=null;
    lastGpsSpeed=0;
    smoothGpsSpeed=0;
    gpsAccel=0;
    gpsRate=0;
    previousGpsKmhForEasyBov=null;

    ui.gpsStatus.textContent='warte auf Position …';
    ui.gpsStatus.className='warnText';
    ui.gpsAccuracy.textContent='–';
    ui.gpsHz.textContent='0.0 Hz';

    watchId=navigator.geolocation.watchPosition(
      onPosition,
      onGeoError,
      {enableHighAccuracy:true, maximumAge:0, timeout:10000}
    );
    return true;
  }

  function stopAudio() {
    stopGps(true);
    demoActive = false;
    lastAccel = 0;
    lastState = "idle";
    currentGear = 1;
    previousGpsKmhForEasyBov = null;

    if (ctx) {
      try { ctx.close(); } catch(e) {}
    }

    ctx = null;
    master = null;
    compressor = null;
    audioStarted = false;

    ui.start.textContent = "Sound + Demo starten";
    ui.gps.textContent = "GPS fahren";
    ui.mute.textContent = "Stumm";
    muted = false;

    manualSpeed = 0;
    lastManualSpeed = 0;
    manualAccel = 0;
    ui.speedTest.value = 0;
    ui.speedTestLabel.textContent = "0 km/h";

    ui.gearDisplay.textContent = gearsEnabled ? "1. · 2.66:1" : "Direkt";
    ui.rpmDisplay.textContent = "0 RPM";
    ui.shiftTargetDisplay.textContent = "–";
    renderVisual(0,0,"Gestoppt");
  }

  function setMasterVolume() {
    if (!audioStarted || !master) return;
    const v = muted ? 0.0001 : Number(ui.volume.value)/100;
    setTarget(master.gain, v, 0.15);
  }

  function triggerDigitalDischarge(intensity=1, minCooldown=650) {
  if (!audioStarted || !ctx || !sharedNoiseBuffer) return;

  const bovAmount = Number(ui.bov.value) / 100;
  if (bovAmount <= 0.001) return;

  const nowMs = performance.now();
  if (nowMs - lastBovAt < minCooldown) return;
  lastBovAt = nowMs;

  const now = ctx.currentTime;

  // Länger als vorher
  const duration = 0.65 + intensity * 0.55;

  // =========================================
  // 1. Haupt-Zischen
  // =========================================
  const hiss = ctx.createBufferSource();
  hiss.buffer = sharedNoiseBuffer;

  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = "bandpass";

  // Startet scharf/hoch und fällt langsam ab
  hissFilter.frequency.setValueAtTime(
    4200 + intensity * 1800,
    now
  );

  hissFilter.frequency.exponentialRampToValueAtTime(
    1100,
    now + duration
  );

  hissFilter.Q.value = 0.8;

  const hissGain = ctx.createGain();

  hissGain.gain.setValueAtTime(0.0001, now);

  // schneller Druckaufbau
  hissGain.gain.exponentialRampToValueAtTime(
    (0.10 + intensity * 0.08) * bovAmount,
    now + 0.018
  );

  // kurze kräftige Spitze
  hissGain.gain.exponentialRampToValueAtTime(
    (0.075 + intensity * 0.055) * bovAmount,
    now + 0.16
  );

  // langes Auszischen
  hissGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  hiss.connect(hissFilter)
      .connect(hissGain)
      .connect(master);


  // =========================================
  // 2. Tieferer Luft-/Druckanteil
  // =========================================
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = sharedNoiseBuffer;

  const whooshFilter = ctx.createBiquadFilter();
  whooshFilter.type = "lowpass";

  whooshFilter.frequency.setValueAtTime(
    1800 + intensity * 600,
    now
  );

  whooshFilter.frequency.exponentialRampToValueAtTime(
    500,
    now + duration * 0.85
  );

  const whooshGain = ctx.createGain();

  whooshGain.gain.setValueAtTime(0.0001, now);

  whooshGain.gain.exponentialRampToValueAtTime(
    (0.045 + intensity * 0.035) * bovAmount,
    now + 0.025
  );

  whooshGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration * 0.9
  );

  whoosh.connect(whooshFilter)
        .connect(whooshGain)
        .connect(master);


  // =========================================
  // 3. Ganz kleiner elektronischer Akzent
  // =========================================
  const zap = ctx.createOscillator();
  zap.type = "sine";

  zap.frequency.setValueAtTime(
    1000 + intensity * 350,
    now
  );

  zap.frequency.exponentialRampToValueAtTime(
    350,
    now + 0.22
  );

  const zapGain = ctx.createGain();

  zapGain.gain.setValueAtTime(0.0001, now);

  zapGain.gain.exponentialRampToValueAtTime(
    0.006 * bovAmount,
    now + 0.008
  );

  zapGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.25
  );

  zap.connect(zapGain)
     .connect(master);


  // Start / Stop
  hiss.start(now);
  whoosh.start(now);
  zap.start(now);

  hiss.stop(now + duration + 0.05);
  whoosh.stop(now + duration + 0.05);
  zap.stop(now + 0.3);
}

  function rpmForGear(speedKmh, gear) {
    const maxRpm = Number(ui.maxRpm.value);
    const rangeKmh = Math.max(1, Number(ui.gearRange.value));
    const ratio = gearRatios[gear-1];

    // Definition der Getriebe-Reichweite:
    // Im 6. Gang gilt bei rangeKmh ungefähr maxRpm.
    return Math.max(0,
      (speedKmh / rangeKmh) *
      maxRpm *
      (ratio / topGearRatio)
    );
  }

  function calculateShiftTarget(accel) {
    const maxRpm = Number(ui.maxRpm.value);
    const sportShift = Math.min(Number(ui.shiftRpm.value), maxRpm);

    if (!dynamicShiftEnabled) return sportShift;

    // Sanftes Fahren -> frühes Schalten.
    // Starke Beschleunigung -> nähert sich dem eingestellten Sport-Schaltpunkt.
    const gentleShift = clamp(maxRpm * 0.34, 1500, Math.min(2800, sportShift));
    const accelN = clamp(Math.max(0, accel) / 5.0, 0, 1);
    const demand = Math.pow(accelN, 0.55);

    return gentleShift + (sportShift - gentleShift) * demand;
  }

  function updateVirtualTransmission(speedKmh, accel) {
    const maxRpm = Number(ui.maxRpm.value);
    const rangeKmh = Math.max(1, Number(ui.gearRange.value));
    currentShiftTarget = calculateShiftTarget(accel);

    if (!gearsEnabled) {
      currentGear = 1;
      virtualRpm = clamp((speedKmh / rangeKmh) * maxRpm, 0, maxRpm * 1.08);
      ui.gearDisplay.textContent = "Direkt";
      ui.rpmDisplay.textContent = `${Math.round(virtualRpm)} RPM`;
      ui.shiftTargetDisplay.textContent = "–";
      return {gear:1, rpm:virtualRpm, maxRpm, shiftTarget:maxRpm};
    }

    // Hochschalten nur bei nicht-negativer Last.
    // Bei großen Sprüngen des Testsliders dürfen mehrere Gänge in einem Update folgen.
    let rpm = rpmForGear(speedKmh, currentGear);
    while (
      currentGear < gearRatios.length &&
      accel > -0.08 &&
      rpm >= currentShiftTarget
    ) {
      currentGear++;
      rpm = rpmForGear(speedKmh, currentGear);
    }

    // Zurückschalten mit deutlicher Hysterese.
    // Der neue Gang soll nicht sofort wieder hochschalten.
    const downshiftRpm = Math.max(950, currentShiftTarget * 0.46);
    while (
      currentGear > 1 &&
      rpm < downshiftRpm
    ) {
      currentGear--;
      rpm = rpmForGear(speedKmh, currentGear);

      // Falls der niedrigere Gang bereits fast am Schaltpunkt liegt,
      // bleibt der höhere Gang drin – verhindert hektisches Pendeln.
      if (rpm > currentShiftTarget * 0.94) {
        currentGear++;
        rpm = rpmForGear(speedKmh, currentGear);
        break;
      }
    }

    virtualRpm = clamp(rpm, 0, maxRpm * 1.08);

    ui.gearDisplay.textContent =
      `${currentGear}. · ${gearRatios[currentGear-1].toFixed(2)}:1`;
    ui.rpmDisplay.textContent = `${Math.round(virtualRpm)} RPM`;
    ui.shiftTargetDisplay.textContent = `${Math.round(currentShiftTarget)} RPM`;

    return {
      gear:currentGear,
      rpm:virtualRpm,
      maxRpm,
      shiftTarget:currentShiftTarget
    };
  }

  function updateAudio(speedKmh, accel) {
    if (!audioStarted || !ctx) return;

    const baseStart = Number(ui.base.value);
    const pitch = Number(ui.pitch.value)/10;

    const baseAmount = Number(ui.baseVol.value)/100;
    const inverterAmount = Number(ui.inverter.value)/100;
    const driveAmount = Number(ui.drive.value)/100;
    const regenAmount = Number(ui.regen.value)/100;
    const airAmount = Number(ui.air.value)/100;

    const speedN = clamp(speedKmh/270,0,1);
    const pos = clamp(accel/5.7,0,1);
    const neg = clamp(-accel/3.2,0,1);

    const transmission = updateVirtualTransmission(speedKmh, accel);
    const rpmN = clamp(transmission.rpm / Math.max(1, transmission.maxRpm), 0, 1.08);

    // Der eigentliche Fahrsound folgt jetzt der virtuellen Drehzahl.
    // pitch=2.1 ergibt bei Redline grob denselben Tonumfang wie die frühere 120-km/h-Abstimmung.
    const fundamental = clamp(
      baseStart + rpmN*(pitch*120) + Math.pow(rpmN,2)*38 + pos*16,
      10,620
    );

    // Grundsound
    setTarget(base1.frequency, fundamental, 0.04);
    setTarget(base2.frequency, fundamental*1.006, 0.04);
    setTarget(sub.frequency, fundamental*0.5, 0.05);

    setTarget(baseFilter.frequency, 760 + rpmN*1250 + speedN*350 + pos*500, 0.08);

    setTarget(baseGain1.gain,
      baseAmount * (0.09 + speedN*0.07 + pos*0.018), 0.08
    );
    setTarget(baseGain2.gain,
      baseAmount * (0.012 + speedN*0.018), 0.08
    );
    setTarget(subGain.gain,
      baseAmount * (0.055 - speedN*0.024), 0.08
    );

    // Inverter
    const invFund = 235 + rpmN*1600 + Math.pow(rpmN,2)*410;

    setTarget(inv1.frequency, invFund, 0.035);
    setTarget(inv2.frequency, invFund*1.502, 0.035);
    setTarget(inv3.frequency, invFund*2.017, 0.035);
    setTarget(invFilter.frequency, clamp(invFund*1.32,650,4200), 0.06);

    const invLevel = inverterAmount * (0.006 + speedN*0.027 + pos*0.010);
    setTarget(invGain1.gain, invLevel, 0.06);
    setTarget(invGain2.gain, invLevel*0.44, 0.06);
    setTarget(invGain3.gain, invLevel*0.20, 0.06);

    // Beschleunigung
    const driveFreq = 290 + fundamental*2.25 + pos*160;
    setTarget(driveOsc.frequency, driveFreq, 0.035);
    setTarget(driveFilter.frequency,
      clamp(620 + rpmN*1450 + pos*850,500,3500), 0.055
    );
    setTarget(driveGain.gain,
      driveAmount * pos * (0.018 + speedN*0.035), 0.045
    );

    // Reku
    const regenF = 520 + rpmN*1250;
    setTarget(regenOsc1.frequency, regenF, 0.045);
    setTarget(regenOsc2.frequency, regenF*1.49, 0.045);
    setTarget(regenFilter.frequency,
      clamp(800 + rpmN*1450,700,2600), 0.06
    );
    setTarget(regenGain.gain,
      regenAmount * neg * (0.016 + speedN*0.035), 0.055
    );

    // Luft/Textur
    const airLevel = airAmount * (speedN*0.005 + pos*0.011 + neg*0.007);
    setTarget(airGain.gain, airLevel, 0.09);
    setTarget(airFilter.frequency, 1250 + speedN*1800, 0.1);

    ui.baseHz.textContent = `${Math.round(fundamental)} Hz`;
    ui.invHz.textContent = `${Math.round(invFund)} Hz`;
    ui.drivePct.textContent = `${Math.round(pos*100)} %`;
    ui.regenPct.textContent = `${Math.round(neg*100)} %`;

    // Normalmodus: deutlicher Lastwechsel.
    if (lastAccel > 0.8 && accel < -0.35) {
      triggerDigitalDischarge(clamp(lastAccel/5.7,0.35,1), 650);
    }
    // EasyBOV: absichtlich extrem weich. Normale Reku reicht.
    // Während anhaltender Verzögerung darf etwa einmal pro Sekunde erneut getriggert werden.
    else if (easyBovEnabled && speedKmh > 7 && accel < -0.06) {
      triggerDigitalDischarge(clamp(0.42 + Math.abs(accel)/4,0.42,0.85), 900);
    }
    lastAccel = accel;
  }

  function renderVisual(speedKmh, accel, state) {
    ui.speed.textContent = Math.round(speedKmh);
    ui.accel.textContent = accel.toFixed(2);
    ui.state.textContent = state;
    ui.speedBar.style.width = `${clamp(speedKmh/270*100,0,100)}%`;
  }

  function render(speedKmh, accel, state) {
    renderVisual(speedKmh,accel,state);
    updateAudio(speedKmh,accel);
  }

  // 0-6 s: 0 -> 120
  // 6-9 s: 120 halten
  // 9-14 s: 120 -> 65
  // 14-20 s: 65 -> 0
  function demoValues(t) {
    const phase = (t/1000) % 20;
    let kmh, a, state;

    if (phase < 6) {
      kmh = phase/6*200;
      a = (200/3.6)/6;
      state = "Beschleunigen";
    } else if (phase < 9) {
      kmh = 200;
      a = 0;
      state = "Halten";
    } else if (phase < 14) {
      kmh = 200-(phase-9)/5*55;
      a = -(55/3.6)/5;
      state = "Reku";
    } else {
      kmh = Math.max(0,65-(phase-14)/6*65);
      a = -(65/3.6)/6;
      state = "Ausrollen / Reku";
    }

    return {kmh,a,state};
  }

  function loop(now) {
    if (demoActive) {
      const v = demoValues(now-demoStart);

      manualSpeed = v.kmh;
      ui.speedTest.value = Math.round(v.kmh);
      ui.speedTestLabel.textContent = `${Math.round(v.kmh)} km/h`;

      render(v.kmh,v.a,v.state);

      if (lastState === "Beschleunigen" && v.state === "Halten") {
        triggerDigitalDischarge(0.38);
      }
      lastState = v.state;
    } else if (audioStarted && !gpsActive) {
      // manuelle Beschleunigung weich gegen 0 auslaufen lassen
      manualAccel *= 0.86;
      if (Math.abs(manualAccel) < 0.03) manualAccel = 0;

      const state =
        manualAccel > 0.25 ? "Manuell · Beschleunigen" :
        manualAccel < -0.25 ? "Manuell · Reku" :
        "Manuell · Konstant";

      render(manualSpeed,manualAccel,state);
    }

    requestAnimationFrame(loop);
  }

  ui.start.addEventListener("click", async () => {
    startAudio();
    if (!ctx) return;

    await ctx.resume();

    muted = false;
    setMasterVolume();

    stopGps(false);
    demoActive = true;
    demoStart = performance.now();
    lastAccel = 0;
    lastState = "idle";

    ui.start.textContent = "Läuft ✓";
    ui.gps.textContent = "GPS fahren";
    ui.mute.textContent = "Stumm";
  });

  ui.gps.addEventListener("click", async () => {
    startAudio();
    if (!ctx) return;
    await ctx.resume();

    muted=false;
    setMasterVolume();
    demoActive=false;
    lastAccel=0;
    lastState='idle';

    if (startGps()) {
      ui.start.textContent='Sound läuft · GPS';
      ui.gps.textContent='GPS aktiv ✓';
      ui.mute.textContent='Stumm';
      renderVisual(0,0,'GPS · warte …');
    }
  });

  ui.restart.addEventListener("click", async () => {
    startAudio();
    if (!ctx) return;

    await ctx.resume();

    stopGps(false);
    demoActive = true;
    demoStart = performance.now();
    lastAccel = 0;
    lastState = "idle";
    ui.gps.textContent = "GPS fahren";
  });

  ui.stop.addEventListener("click", () => {
    stopAudio();
  });

  ui.easyBov.addEventListener("click", () => {
    easyBovEnabled = !easyBovEnabled;
    ui.easyBov.classList.toggle("active", easyBovEnabled);
    ui.easyBov.childNodes[0].nodeValue = easyBovEnabled ? "EasyBOV: AN\n      " : "EasyBOV: AUS\n      ";
    lastBovAt = -9999;
  });

  ui.gears.addEventListener("click", () => {
    gearsEnabled = !gearsEnabled;
    ui.gears.classList.toggle("active", gearsEnabled);
    ui.gears.childNodes[0].nodeValue = gearsEnabled ? "Virtuelle Gänge: AN\n      " : "Virtuelle Gänge: AUS\n      ";
    currentGear = 1;

    if (audioStarted) {
      if (gpsActive) updateAudio(smoothGpsSpeed*3.6, gpsAccel);
      else updateAudio(manualSpeed, manualAccel);
    } else {
      ui.gearDisplay.textContent = gearsEnabled ? "1. · 2.66:1" : "Direkt";
      ui.rpmDisplay.textContent = "0 RPM";
      ui.shiftTargetDisplay.textContent = "–";
    }
  });

  ui.dynamicShift.addEventListener("click", () => {
    dynamicShiftEnabled = !dynamicShiftEnabled;
    ui.dynamicShift.classList.toggle("active", dynamicShiftEnabled);
    ui.dynamicShift.childNodes[0].nodeValue =
      dynamicShiftEnabled ? "Dynamische Schalt-RPM: AN\n      " : "Dynamische Schalt-RPM: AUS\n      ";

    if (audioStarted) {
      if (gpsActive) updateAudio(smoothGpsSpeed*3.6, gpsAccel);
      else updateAudio(manualSpeed, manualAccel);
    }
  });

  ui.mute.addEventListener("click", () => {
    if (!audioStarted) return;

    muted = !muted;
    setMasterVolume();
    ui.mute.textContent = muted ? "Ton an" : "Stumm";
  });

  // Manuelle Geschwindigkeit:
  // Die Änderungsrate des Sliders wird als Beschleunigung interpretiert.
  ui.speedTest.addEventListener("input", async () => {
    startAudio();
    if (!ctx) return;
    await ctx.resume();

    demoActive = false;
    stopGps(false);
    ui.gps.textContent = "GPS fahren";

    const now = performance.now();
    const nextSpeed = Number(ui.speedTest.value);
    const dt = clamp((now-lastManualTime)/1000,0.035,0.35);

    const dvMs = (nextSpeed-lastManualSpeed)/3.6;
    const rawAccel = dvMs/dt;

    manualAccel = clamp(rawAccel,-5.7,5.7);
    manualSpeed = nextSpeed;

    lastManualSpeed = nextSpeed;
    lastManualTime = now;

    ui.speedTestLabel.textContent = `${Math.round(nextSpeed)} km/h`;
    ui.start.textContent = "Sound läuft · Manuell";

    render(
      manualSpeed,
      manualAccel,
      manualAccel > 0.25 ? "Manuell · Beschleunigen" :
      manualAccel < -0.25 ? "Manuell · Reku" :
      "Manuell · Konstant"
    );
  });

  ui.secureContext.textContent = window.isSecureContext ? 'HTTPS / sicher' : `${location.protocol} unsicher`;
  ui.secureContext.className = window.isSecureContext ? 'okText' : 'warnText';

  setInterval(() => {
    if (!gpsActive) return;
    if (lastGpsTs && Date.now()-lastGpsTs > 5000) {
      ui.gpsStatus.textContent='keine neuen Daten > 5 s';
      ui.gpsStatus.className='warnText';
    }
  },1000);

  const updateLabels = () => {
    ui.volumeLabel.textContent = `${ui.volume.value} %`;
    ui.baseLabel.textContent = `${ui.base.value} Hz`;
    ui.pitchLabel.textContent = `${(Number(ui.pitch.value)/10).toFixed(1)}×`;
    ui.gearRangeLabel.textContent = `${ui.gearRange.value} km/h`;
    ui.maxRpmLabel.textContent = `${ui.maxRpm.value} RPM`;

    // Schalt-RPM darf Max-RPM nie überschreiten.
    ui.shiftRpm.max = ui.maxRpm.value;
    if (Number(ui.shiftRpm.value) > Number(ui.maxRpm.value)) {
      ui.shiftRpm.value = ui.maxRpm.value;
    }
    ui.shiftRpmLabel.textContent = `${ui.shiftRpm.value} RPM`;

    ui.baseVolLabel.textContent = `${ui.baseVol.value} %`;
    ui.inverterLabel.textContent = `${ui.inverter.value} %`;
    ui.driveLabel.textContent = `${ui.drive.value} %`;
    ui.regenLabel.textContent = `${ui.regen.value} %`;
    ui.airLabel.textContent = `${ui.air.value} %`;
    ui.bovLabel.textContent = `${ui.bov.value} %`;
  };

  [
    ui.volume,ui.base,ui.pitch,ui.gearRange,ui.maxRpm,ui.shiftRpm,
    ui.baseVol,ui.inverter,ui.drive,ui.regen,ui.air,ui.bov
  ].forEach(el => {
    el.addEventListener("input", () => {
      updateLabels();
      if (el === ui.volume) setMasterVolume();

      if (el === ui.gearRange || el === ui.maxRpm || el === ui.shiftRpm) {
        currentGear = 1;
      }

      if (audioStarted && !demoActive) {
        if (gpsActive) updateAudio(smoothGpsSpeed*3.6,gpsAccel);
        else updateAudio(manualSpeed,manualAccel);
      }
    });
  });

  updateLabels();
  ui.gearDisplay.textContent = "1. · 2.66:1";
  ui.rpmDisplay.textContent = "0 RPM";
  ui.shiftTargetDisplay.textContent = `${ui.shiftRpm.value} RPM`;
  renderVisual(0,0,"Bereit");
  requestAnimationFrame(loop);
})();
