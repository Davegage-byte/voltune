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

  // ----- GPS-Zustand aus dem VoltuneGps-Modul -----
  let gpsActive = false;
  let gpsSpeedKmh = 0;
  let gpsAccel = 0;
  let lastGpsTs = null;

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

  let previousGpsKmhForEasyBov = null;

  function getAudioSettings() {
  return {
    masterVolume: Number(ui.volume.value),

    baseFrequency: Number(ui.base.value),
    pitch: Number(ui.pitch.value),

    baseVolume: Number(ui.baseVol.value),
    inverterVolume: Number(ui.inverter.value),
    driveVolume: Number(ui.drive.value),
    regenVolume: Number(ui.regen.value),
    airVolume: Number(ui.air.value),
    bovVolume: Number(ui.bov.value),

    easyBovEnabled
  };
}

async function ensureVoltuneAudio() {
  try {
    await VoltuneAudio.start();

    VoltuneAudio.setMuted(
      false,
      Number(ui.volume.value)
    );
    audioStarted = true;
    muted = false;
    return true;

  } catch (error) {
    console.error(
      "Voltune Audio konnte nicht gestartet werden:",
      error
    );

    alert(
      error.message ||
      "Voltune Audio konnte nicht gestartet werden."
    );

    return false;
  }
}


function updateVoltuneSound(speedKmh, accel) {
  if (!VoltuneAudio.isStarted()) {
    return;
  }

  // Erst Getriebe / RPM berechnen
  const transmission = VoltuneDrivetrain.update(
    speedKmh,
    accel,
    {
      maxRpm: Number(ui.maxRpm.value),
      gearRange: Number(ui.gearRange.value),
      shiftRpm: Number(ui.shiftRpm.value),
      gearsEnabled,
      dynamicShiftEnabled
    }
  );


  // Getriebeanzeige aktualisieren
  if (transmission.direct) {
    ui.gearDisplay.textContent = "Direkt";
    ui.shiftTargetDisplay.textContent = "–";

  } else {
    ui.gearDisplay.textContent =
      `${transmission.gear}. · ${transmission.ratio.toFixed(2)}:1`;

    ui.shiftTargetDisplay.textContent =
      `${Math.round(transmission.shiftTarget)} RPM`;
  }

  ui.rpmDisplay.textContent =
    `${Math.round(transmission.rpm)} RPM`;


  // Fertige Fahrwerte an die Soundengine übergeben
  const soundState = VoltuneAudio.update(
    {
      speedKmh,
      acceleration: accel,
      rpm: transmission.rpm,
      maxRpm: transmission.maxRpm
    },
    getAudioSettings()
  );


  // Anzeigen der einzelnen Sound-Layer
  if (soundState) {
    ui.baseHz.textContent =
      `${Math.round(soundState.fundamentalHz)} Hz`;

    ui.invHz.textContent =
      `${Math.round(soundState.inverterHz)} Hz`;

    ui.drivePct.textContent =
      `${soundState.drivePercent} %`;

    ui.regenPct.textContent =
      `${soundState.regenPercent} %`;
  }
}

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

    function stopGps(resetText=false) {
      gpsActive = false;
      VoltuneGps.stop();
    
      if (resetText) {
        ui.gpsStatus.textContent = "gestoppt";
        ui.gpsStatus.className = "";
        ui.gpsHz.textContent = "0.0 Hz";
      }
    }
    
    function handleGpsUpdate(data) {
      if (!gpsActive) return;
    
      gpsSpeedKmh = data.speedKmh;
      gpsAccel = data.acceleration;
      lastGpsTs = data.timestamp;
    
      // EasyBOV-Fallback:
      // Kleine reale Geschwindigkeitsabfälle dürfen bereits triggern.
      if (
        easyBovEnabled &&
        previousGpsKmhForEasyBov != null &&
        gpsSpeedKmh > 7 &&
        previousGpsKmhForEasyBov - gpsSpeedKmh > 0.25
      ) {
        const drop =
          previousGpsKmhForEasyBov - gpsSpeedKmh;
    
        VoltuneAudio.triggerBov(
          clamp(0.42 + drop / 5, 0.42, 0.85),
          Number(ui.bov.value),
          850
        );
      }
    
      previousGpsKmhForEasyBov = gpsSpeedKmh;
    
      manualSpeed = gpsSpeedKmh;
      lastManualSpeed = gpsSpeedKmh;
    
      ui.speedTest.value =
        Math.round(clamp(gpsSpeedKmh, 0, 270));
    
      ui.speedTestLabel.textContent =
        `${Math.round(gpsSpeedKmh)} km/h`;
    
      if (data.accuracy != null) {
        ui.gpsAccuracy.textContent =
          `${Math.round(data.accuracy)} m`;
      }
    
      ui.gpsHz.textContent =
        `${data.rateHz.toFixed(1)} Hz`;
    
      ui.gpsStatus.textContent = "aktiv";
      ui.gpsStatus.className = "okText";
    
      const state =
        gpsAccel > 0.22
          ? "GPS · Beschleunigen"
          : gpsAccel < -0.22
            ? "GPS · Reku"
            : "GPS · Fahrt";
    
      render(
        gpsSpeedKmh,
        gpsAccel,
        state
      );
    }
    function handleGpsError(error) {
      ui.gpsStatus.textContent =
        error.message || "GPS-Fehler";
    
      ui.gpsStatus.className = "errText";
    }
    
    function startGps() {
      stopGps(false);
    
      demoActive = false;
      gpsSpeedKmh = 0;
      gpsAccel = 0;
      lastGpsTs = null;
      previousGpsKmhForEasyBov = null;
    
      ui.gpsStatus.textContent =
        "warte auf Position …";
    
      ui.gpsStatus.className =
        "warnText";
    
      ui.gpsAccuracy.textContent = "–";
      ui.gpsHz.textContent = "0.0 Hz";
    
      const started = VoltuneGps.start({
        onUpdate: handleGpsUpdate,
        onError: handleGpsError
      });
    
      gpsActive = started;
    
      return started;
    }
  function stopAudio() {
    VoltuneAudio.stop();
    stopGps(true);
    demoActive = false;
    lastAccel = 0;
    lastState = "idle";
    VoltuneDrivetrain.reset();
    previousGpsKmhForEasyBov = null;

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
    if (!VoltuneAudio.isStarted()) return;
  
    VoltuneAudio.setMuted(
      muted,
      Number(ui.volume.value)
    );
  }

  function renderVisual(speedKmh, accel, state) {
    ui.speed.textContent = Math.round(speedKmh);
    ui.accel.textContent = accel.toFixed(2);
    ui.state.textContent = state;
    ui.speedBar.style.width = `${clamp(speedKmh/270*100,0,100)}%`;
  }

  function render(speedKmh, accel, state) {
    renderVisual(speedKmh, accel, state);
    updateVoltuneSound(speedKmh, accel);
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
        VoltuneAudio.triggerBov(
          0.38,
          Number(ui.bov.value),
          650
        );
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
    if (!await ensureVoltuneAudio()) return;
    
    VoltuneAudio.resetDrivingState();

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
    if (!await ensureVoltuneAudio()) return;
    
    VoltuneAudio.resetDrivingState();
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
    if (!await ensureVoltuneAudio()) return;
    
    VoltuneAudio.resetDrivingState();

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
    VoltuneDrivetrain.reset();

    if (audioStarted) {
      if (gpsActive) updateVoltuneSound(gpsSpeedKmh, gpsAccel);
      else updateVoltuneSound(manualSpeed, manualAccel);
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
      if (gpsActive) updateVoltuneSound(gpsSpeedKmh, gpsAccel);
      else updateVoltuneSound(manualSpeed, manualAccel);
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
    if (!await ensureVoltuneAudio()) return;

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
        VoltuneDrivetrain.reset();
      }

      if (audioStarted && !demoActive) {
        if (gpsActive) {
          updateVoltuneSound(gpsSpeedKmh, gpsAccel);
        } else {
          updateVoltuneSound(manualSpeed, manualAccel);
        }
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
