(() => {
  const $ = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  const ui = {
    speed:$("speed"), accel:$("accel"), state:$("state"), speedBar:$("speedBar"), shiftMarker:$("shiftMarker"), downshiftMarker:$("downshiftMarker"),
    baseHz:$("baseHz"),
    invHz:$("invHz"),
    drivePct:$("drivePct"),
    regenPct:$("regenPct"),
    bovPressureDisplay:$("bovPressureDisplay"),
    gearDisplay:$("gearDisplay"),
    rpmDisplay:$("rpmDisplay"),
    shiftTargetDisplay:$("shiftTargetDisplay"),
    downshiftTargetDisplay:$("downshiftTargetDisplay"),
    drivingStyleDisplay:$("drivingStyleDisplay"),

    start:$("start"), gps:$("gps"), controller:$("controller"), restart:$("restart"), stop:$("stop"), mute:$("mute"), debug:$("debug"),
    easyBov:$("easyBov"), gears:$("gears"), dynamicShift:$("dynamicShift"),
    testShiftBurble:$("testShiftBurble"), testBov:$("testBov"), testOverrun:$("testOverrun"),
    gpsStatus:$("gpsStatus"), gpsAccuracy:$("gpsAccuracy"), gpsHz:$("gpsHz"), secureContext:$("secureContext"),

    gpsRawSpeed:$("gpsRawSpeed"),
    gpsSmoothSpeed:$("gpsSmoothSpeed"),
    gpsRawAccel:$("gpsRawAccel"),
    gpsSmoothAccel:$("gpsSmoothAccel"),
    
    gamepadStatus:$("gamepadStatus"),
    gamepadLT:$("gamepadLT"),
    gamepadRT:$("gamepadRT"),
    gamepadAxes:$("gamepadAxes"),
    
    speedTest:$("speedTest"), speedTestLabel:$("speedTestLabel"),
    volume:$("volume"), base:$("base"), maxBase:$("maxBase"), pitch:$("pitch"),
    cruiseDamping:$("cruiseDamping"),
    gearRange:$("gearRange"), maxRpm:$("maxRpm"), shiftRpm:$("shiftRpm"), shiftBurble:$("shiftBurble"),
    baseVol:$("baseVol"), inverter:$("inverter"), drive:$("drive"),
    regen:$("regen"), air:$("air"), bov:$("bov"), overrun:$("overrun"),

    volumeLabel:$("volumeLabel"), baseLabel:$("baseLabel"), maxBaseLabel:$("maxBaseLabel"), pitchLabel:$("pitchLabel"),
    cruiseDampingLabel:$("cruiseDampingLabel"),
    gearRangeLabel:$("gearRangeLabel"), maxRpmLabel:$("maxRpmLabel"), shiftRpmLabel:$("shiftRpmLabel"), shiftBurbleLabel:$("shiftBurbleLabel"),
    baseVolLabel:$("baseVolLabel"), inverterLabel:$("inverterLabel"),
    driveLabel:$("driveLabel"), regenLabel:$("regenLabel"),
    airLabel:$("airLabel"), bovLabel:$("bovLabel"), overrunLabel:$("overrunLabel")
  };

  let soundActive = false;

  let demoActive = false;
  let demoStart = 0;

  let controllerActive = false;
  let controllerSpeed = 0;
  let lastControllerTime = performance.now();

  const LAST_DRIVE_MODE_KEY =
    "voltune.lastDriveMode";
  
  function saveLastDriveMode(mode) {
    try {
      localStorage.setItem(
        LAST_DRIVE_MODE_KEY,
        mode
      );
    } catch (error) {
      console.warn(
        "Letzter Fahrmodus konnte nicht gespeichert werden:",
        error
      );
    }
  }
  
  function loadLastDriveMode() {
    try {
      return localStorage.getItem(
        LAST_DRIVE_MODE_KEY
      );
    } catch (error) {
      return null;
    }
  }
  
  // ----- GPS-Zustand aus dem VoltuneGps-Modul -----
  let gpsActive = false;
  let gpsSpeedKmh = 0;
  let gpsAccel = 0;
  let lastGpsTs = null;
  let gpsRenderSpeed = 0;
  let gpsRenderAccel = 0;
  let gpsHasRenderValue = false;
  let lastGpsRenderTime = performance.now();

  let manualSpeed = 0;
  let lastManualSpeed = 0;
  let lastManualTime = performance.now();
  let manualAccel = 0;
  let lastTransmissionGear = 1;

  let lastState = "idle";
  let overrunFlashUntil = 0;

  // ----- Experimentelle Komfortfunktionen -----
  let easyBovEnabled = false;
  let gearsEnabled = true;
  let dynamicShiftEnabled = true;

  let previousGpsKmhForEasyBov = null;

function setRpmMarker(
  element,
  rpmValue,
  maxRpm
) {
  if (!element) return;

  const rpm =
    Number(rpmValue);

  const maximum =
    Number(maxRpm);

  if (
    !gearsEnabled ||
    !Number.isFinite(rpm) ||
    rpm <= 0 ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    element.style.display =
      "none";

    return;
  }

  const percent =
    clamp(
      rpm / maximum * 100,
      0,
      100
    );

  element.style.left =
    `${percent}%`;

  element.style.display =
    "block";
}
  
  function getAudioSettings() {
  return {
    masterVolume: Number(ui.volume.value),

    baseFrequency: Number(ui.base.value),
    maxBaseFrequency: Number(ui.maxBase.value),
    pitch: Number(ui.pitch.value),
    cruiseDamping: Number(ui.cruiseDamping.value),

    baseVolume: Number(ui.baseVol.value),
    inverterVolume: Number(ui.inverter.value),
    driveVolume: Number(ui.drive.value),
    regenVolume: Number(ui.regen.value),
    airVolume: Number(ui.air.value),
    bovVolume: Number(ui.bov.value),
    overrunVolume: Number(ui.overrun.value),
    
    easyBovEnabled
  };
}

function getPersistentSettings() {
  return {
    volume: Number(ui.volume.value),
    baseFrequency: Number(ui.base.value),
    maxBaseFrequency: Number(ui.maxBase.value),
    pitch: Number(ui.pitch.value),
    cruiseDamping: Number(ui.cruiseDamping.value),

    gearRange: Number(ui.gearRange.value),
    maxRpm: Number(ui.maxRpm.value),
    shiftRpm: Number(ui.shiftRpm.value),
    shiftBurbleVolume: Number(ui.shiftBurble.value),

    baseVolume: Number(ui.baseVol.value),
    inverterVolume: Number(ui.inverter.value),
    driveVolume: Number(ui.drive.value),
    regenVolume: Number(ui.regen.value),
    airVolume: Number(ui.air.value),
    bovVolume: Number(ui.bov.value),
    overrunVolume: Number(ui.overrun.value),

    easyBovEnabled,
    gearsEnabled,
    dynamicShiftEnabled
  };
}

let saveSettingsTimer = null;

function scheduleSettingsSave() {
  clearTimeout(saveSettingsTimer);

  saveSettingsTimer = setTimeout(() => {
    VoltuneStorage.saveSettings(
      getPersistentSettings()
    );
  }, 200);
}

function applyPersistentSettings(settings) {
  if (!settings) return;

  const setNumber = (element, value) => {
    const number = Number(value);

    if (Number.isFinite(number)) {
      element.value = number;
    }
  };

  setNumber(ui.volume, settings.volume);
  setNumber(ui.base, settings.baseFrequency);
  setNumber(ui.maxBase, settings.maxBaseFrequency);
  setNumber(ui.pitch, settings.pitch);
  setNumber(ui.cruiseDamping, settings.cruiseDamping);

  setNumber(ui.gearRange, settings.gearRange);
  setNumber(ui.maxRpm, settings.maxRpm);
  setNumber(ui.shiftRpm, settings.shiftRpm);
  setNumber(ui.shiftBurble, settings.shiftBurbleVolume);

  setNumber(ui.baseVol, settings.baseVolume);
  setNumber(ui.inverter, settings.inverterVolume);
  setNumber(ui.drive, settings.driveVolume);
  setNumber(ui.regen, settings.regenVolume);
  setNumber(ui.air, settings.airVolume);
  setNumber(ui.bov, settings.bovVolume);
  setNumber(ui.overrun, settings.overrunVolume);

  if (typeof settings.easyBovEnabled === "boolean") {
    easyBovEnabled = settings.easyBovEnabled;
  }

  if (typeof settings.gearsEnabled === "boolean") {
    gearsEnabled = settings.gearsEnabled;
  }

  if (typeof settings.dynamicShiftEnabled === "boolean") {
    dynamicShiftEnabled =
      settings.dynamicShiftEnabled;
  }

  ui.easyBov.classList.toggle(
    "active",
    easyBovEnabled
  );

  ui.gears.classList.toggle(
    "active",
    gearsEnabled
  );

  ui.dynamicShift.classList.toggle(
    "active",
    dynamicShiftEnabled
  );
}
  
async function ensureVoltuneAudio() {
  try {
    await VoltuneAudio.start();

    VoltuneAudio.setMuted(
      false,
      Number(ui.volume.value)
    );
    
    soundActive = true;
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

// =========================
// DSG-Schaltblubbern
// =========================

if (
  !transmission.direct &&
  transmission.gear > lastTransmissionGear
) {
  const maxRpm =
    Number(ui.maxRpm.value);

  const sportShift =
    Math.min(
      Number(ui.shiftRpm.value),
      maxRpm
    );

  const relaxedShift =
    clamp(
      maxRpm * 0.34,
      1500,
      Math.min(
        2800,
        sportShift
      )
    );

  // Das aktuelle Schaltziel enthält bereits
  // Fahrerlast und Fahrstil-Gedächtnis.
  //
  // Frühes / gemütliches Schalten:
  // fast kein DSG-Blubbern.
  //
  // Hohes / sportliches Schaltziel:
  // kräftiges Blubbern.
  const shiftIntensity =
    clamp(
      (
        transmission.shiftTarget -
        relaxedShift
      ) /
      Math.max(
        1,
        sportShift - relaxedShift
      ),
      0,
      1
    );

  VoltuneAudio.triggerShiftBurble(
    shiftIntensity,
    Number(ui.shiftBurble.value)
  );
}

lastTransmissionGear =
  transmission.direct
    ? 1
    : transmission.gear;
  
  // Getriebeanzeige aktualisieren
  if (transmission.direct) {
    ui.gearDisplay.textContent =
      "Direkt";
  
    ui.shiftTargetDisplay.textContent =
      "–";
  
    ui.downshiftTargetDisplay.textContent =
      "–";
  
  } else {
    ui.gearDisplay.textContent =
      `${transmission.gear}`;
  
    ui.shiftTargetDisplay.textContent =
      `${Math.round(transmission.shiftTarget)} RPM`;
  
    ui.downshiftTargetDisplay.textContent =
      transmission.downshiftTarget == null
        ? "–"
        : `${Math.round(transmission.downshiftTarget)} RPM`;
  }

    ui.rpmDisplay.textContent =
      `${Math.round(transmission.rpm)} RPM`;

    const rpmBarPercent =
      clamp(
        transmission.rpm /
          transmission.maxRpm *
          100,
        0,
        100
      );
    
    ui.speedBar.style.width =
      `${rpmBarPercent}%`;
    setRpmMarker(
      ui.shiftMarker,
      transmission.direct
        ? null
        : transmission.shiftTarget,
      transmission.maxRpm
    );
    
    setRpmMarker(
      ui.downshiftMarker,
      transmission.direct
        ? null
        : transmission.downshiftTarget,
      transmission.maxRpm
    );
    ui.drivingStyleDisplay.textContent =
      Number(
        transmission.drivingStyle ?? 0
      ).toFixed(2);

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
    if (soundState.overrunTriggered) {
      overrunFlashUntil =
        performance.now() + 800;
    }
    ui.baseHz.textContent =
      `${Math.round(soundState.fundamentalHz)} Hz`;

    ui.invHz.textContent =
      `${Math.round(soundState.inverterHz)} Hz`;

    ui.drivePct.textContent =
      `${soundState.drivePercent} %`;

    ui.regenPct.textContent =
      `${soundState.regenPercent} %`;
    ui.bovPressureDisplay.textContent =
      `${soundState.bovPressurePercent} %`;
  }
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
      lastGpsTs = Date.now();
        // Beim allerersten GPS-Wert nicht erst
        // von 0 km/h hochglätten.
          if (!gpsHasRenderValue) {
            gpsRenderSpeed = gpsSpeedKmh;
            gpsRenderAccel = gpsAccel;
            gpsHasRenderValue = true;
          }
      ui.gpsRawSpeed.textContent =
  `${Number(data.rawSpeedKmh ?? 0).toFixed(1)} km/h`;

ui.gpsSmoothSpeed.textContent =
  `${Number(data.smoothSpeedKmh ?? 0).toFixed(1)} km/h`;

ui.gpsRawAccel.textContent =
  `${Number(data.rawAcceleration ?? 0).toFixed(2)} m/s²`;

ui.gpsSmoothAccel.textContent =
  `${Number(data.acceleration ?? 0).toFixed(2)} m/s²`;
    
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
    
      // Ohne laufenden Sound weiterhin
      // die GPS-Anzeige aktualisieren.
      // Mit Sound übernimmt der Animations-Loop
      // die geglättete Ausgabe.
        if (!soundActive) {
          renderVisual(
            gpsSpeedKmh,
            gpsAccel,
            state
          );
        }
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
      gpsRenderSpeed = 0;
      gpsRenderAccel = 0;
      gpsHasRenderValue = false;
      lastGpsRenderTime = performance.now();
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
    lastState = "idle";
    VoltuneDrivetrain.reset();
    previousGpsKmhForEasyBov = null;

    soundActive = false;

    ui.start.textContent = "Sound + Demo starten";
    ui.gps.textContent = "Start";
    ui.mute.textContent = "Stumm";

    manualSpeed = 0;
    lastManualSpeed = 0;
    manualAccel = 0;
    ui.speedTest.value = 0;
    ui.speedTestLabel.textContent = "0 km/h";

    ui.gearDisplay.textContent =
      gearsEnabled ? "1" : "Direkt";
    ui.rpmDisplay.textContent = "0 RPM";
    ui.shiftTargetDisplay.textContent = "–";
    ui.downshiftTargetDisplay.textContent = "–";
    ui.speedBar.style.width = "0%";

    setRpmMarker(
      ui.shiftMarker,
      gearsEnabled
        ? ui.shiftRpm.value
        : null,
      ui.maxRpm.value
    );
    
    setRpmMarker(
      ui.downshiftMarker,
      null,
      ui.maxRpm.value
    );
    
    renderVisual(0,0,"Gestoppt");
  }

  function setMasterVolume() {
    if (!VoltuneAudio.isStarted()) return;
  
    VoltuneAudio.setMasterVolume(
      Number(ui.volume.value)
    );
  }

  function renderVisual(speedKmh, accel, state) {
    ui.speed.textContent = Math.round(speedKmh);
    ui.accel.textContent = accel.toFixed(2);
    ui.state.textContent =
      performance.now() < overrunFlashUntil
        ? "SCHUBKNALLEN"
        : state;
  }

  function render(speedKmh, accel, state) {
    renderVisual(speedKmh, accel, state);
    updateVoltuneSound(speedKmh, accel);
  }

// BOV-Test-Demo
//
// 0-2 s: Stillstand
//
// 2-6.5 s:
// zügig von 0 auf 100 km/h
// -> hoher BOV-Ladedruck
//
// 6.5-9 s:
// 100 km/h halten
// -> großer BOV
//
// 9-23 s:
// moderat von 100 auf 150 km/h
// -> deutlich weniger BOV-Ladedruck
//
// 23-27 s:
// 150 km/h halten
// -> kleinerer BOV
//
// 27-39 s:
// gleichmäßig auf 0 verzögern
//
// 39-41 s:
// Stillstand

function demoValues(t) {
  const phase = (t / 1000) % 41;
  let kmh, a, state;

  // -------------------------
  // Stillstand
  // -------------------------

  if (phase < 2) {
    kmh = 0;
    a = 0;
    state = "Stillstand";
  }

  // -------------------------
  // Zügige Beschleunigung
  // 0 -> 100 km/h in 4,5 s
  // ca. 6,2 m/s²
  // -------------------------

  else if (phase < 6.5) {
    const p =
      (phase - 2) / 4.5;

    kmh =
      p * 100;

    a =
      (100 / 3.6) / 4.5;

    state =
      "Zügig beschleunigen";
  }

  // -------------------------
  // Gas weg
  // großer BOV
  // -------------------------

  else if (phase < 9) {
    kmh = 100;
    a = 0;
    state =
      "Halten · großer BOV";
  }

  // -------------------------
  // Moderate Beschleunigung
  // 100 -> 150 km/h in 14 s
  // ca. 1,0 m/s²
  // -------------------------

  else if (phase < 23) {
    const p =
      (phase - 9) / 14;

    kmh =
      100 +
      p * 50;

    a =
      (50 / 3.6) / 14;

    state =
      "Moderat beschleunigen";
  }

  // -------------------------
  // Gas weg
  // kleiner BOV
  // -------------------------

  else if (phase < 27) {
    kmh = 150;
    a = 0;
    state =
      "Halten · kleiner BOV";
  }

  // -------------------------
  // Verzögern
  // -------------------------

  else if (phase < 39) {
    const p =
      (phase - 27) / 12;

    kmh =
      Math.max(
        0,
        150 - p * 150
      );

    a =
      -(150 / 3.6) / 12;

    state =
      "Reku / Verzögern";
  }

  // -------------------------
  // Stillstand
  // -------------------------

  else {
    kmh = 0;
    a = 0;
    state = "Stillstand";
  }

  return {
    kmh,
    a,
    state
  };
}

  function updateGamepadDebug() {
  const gamepads =
    navigator.getGamepads
      ? navigator.getGamepads()
      : [];

  const gamepad =
    Array.from(gamepads).find(
      pad => pad !== null
    );

  if (!gamepad) {
    ui.gamepadStatus.textContent =
      "nicht verbunden";

    ui.gamepadLT.textContent =
      "0.00";

    ui.gamepadRT.textContent =
      "0.00";

    ui.gamepadAxes.textContent =
      "0.00 / 0.00";

    return;
  }

  ui.gamepadStatus.textContent =
    gamepad.id;

  const lt =
    gamepad.buttons[6]?.value ?? 0;

  const rt =
    gamepad.buttons[7]?.value ?? 0;

  const axis0 =
    gamepad.axes[0] ?? 0;

  const axis1 =
    gamepad.axes[1] ?? 0;

  ui.gamepadLT.textContent =
    lt.toFixed(2);

  ui.gamepadRT.textContent =
    rt.toFixed(2);

  ui.gamepadAxes.textContent =
    `${axis0.toFixed(2)} / ${axis1.toFixed(2)}`;
}

function updateControllerDrive(now) {
  const gamepads =
    navigator.getGamepads
      ? navigator.getGamepads()
      : [];

  const gamepad =
    Array.from(gamepads).find(
      pad => pad !== null
    );

  if (!gamepad) {
    controllerActive = false;

    ui.controller.textContent =
      "Controller fahren";

    renderVisual(
      controllerSpeed,
      0,
      "Controller getrennt"
    );

    return;
  }

  const throttle =
    clamp(
      gamepad.buttons[7]?.value ?? 0,
      0,
      1
    );

  const brake =
    clamp(
      gamepad.buttons[6]?.value ?? 0,
      0,
      1
    );

  const dt =
    clamp(
      (now - lastControllerTime) / 1000,
      0,
      0.05
    );

  lastControllerTime = now;

  const speedN =
    clamp(
      controllerSpeed / 270,
      0,
      1
    );

  let accel = 0;

  // -------------------------
  // Bremse / starke Reku
  // -------------------------

  if (brake > 0.02) {
    accel =
      -(
        1.8 +
        brake * 4.2
      );
  }

  // -------------------------
  // Gas
  // -------------------------

  else if (throttle > 0.02) {
    // Bei niedriger Geschwindigkeit kräftiger,
    // bei hoher Geschwindigkeit weniger Schub.
    const maxAccel =
      6.6 -
      speedN * 3.8;
  
    // Virtueller Roll- und Luftwiderstand.
    // Mit steigender Geschwindigkeit wird
    // mehr Gas zum Halten des Tempos benötigt.
    const roadLoad =
      0.08 +
      speedN * 0.12 +
      Math.pow(speedN, 2) * 0.35;
  
    // Im unteren Pedalbereich feinfühliger,
    // Vollgas bleibt weiterhin kräftig.
    const motorAccel =
      Math.pow(
        throttle,
        1.8
      ) *
      maxAccel;
  
    accel =
      motorAccel -
      roadLoad;
  
    // Kleine Haltezone:
    // erleichtert konstantes Fahren
    // mit dem Controller.
    if (Math.abs(accel) < 0.08) {
      accel = 0;
    }
  }

  // -------------------------
  // Gas losgelassen:
  // Tesla-artige Reku
  // -------------------------

  else if (controllerSpeed > 10) {
    accel = -1.8;

  } else if (controllerSpeed > 0.3) {
    accel = -0.8;

  } else {
    accel = 0;
  }

  controllerSpeed =
    clamp(
      controllerSpeed +
        accel * dt * 3.6,
      0,
      270
    );

  if (
    controllerSpeed <= 0 &&
    accel < 0
  ) {
    controllerSpeed = 0;
    accel = 0;
  }

  manualSpeed =
    controllerSpeed;

  manualAccel =
    accel;

  ui.speedTest.value =
    Math.round(controllerSpeed);

  ui.speedTestLabel.textContent =
    `${Math.round(controllerSpeed)} km/h`;

  const state =
    throttle > 0.02
      ? `Controller · Gas ${Math.round(throttle * 100)} %`
      : brake > 0.02
        ? `Controller · Bremse ${Math.round(brake * 100)} %`
        : controllerSpeed > 0
          ? "Controller · Reku"
          : "Controller · Stillstand";

  render(
    controllerSpeed,
    accel,
    state
  );
}
  
  function loop(now) {
    updateGamepadDebug();
  
    if (controllerActive) {
      updateControllerDrive(now);
  
    } else if (demoActive) {
      const v = demoValues(now-demoStart);

      manualSpeed = v.kmh;
      ui.speedTest.value = Math.round(v.kmh);
      ui.speedTestLabel.textContent = `${Math.round(v.kmh)} km/h`;

      render(v.kmh,v.a,v.state);

      lastState = v.state;
} else if (
  soundActive &&
  gpsActive &&
  gpsHasRenderValue
) {
  const dt =
    clamp(
      (now - lastGpsRenderTime) / 1000,
      0,
      0.05
    );

  lastGpsRenderTime = now;

  // Geschwindigkeit weich zwischen
  // den GPS-Messwerten bewegen.
  const speedResponse =
    1 - Math.exp(-dt / 0.28);

  gpsRenderSpeed +=
    (gpsSpeedKmh - gpsRenderSpeed) *
    speedResponse;

  // Smooth m/s² ist bereits gut.
  // Nur noch leicht für die Audioengine glätten.
  const accelResponse =
    1 - Math.exp(-dt / 0.12);

  gpsRenderAccel +=
    (gpsAccel - gpsRenderAccel) *
    accelResponse;

  const state =
    gpsRenderAccel > 0.22
      ? "GPS · Beschleunigen"
      : gpsRenderAccel < -0.22
        ? "GPS · Reku"
        : "GPS · Fahrt";

  render(
    gpsRenderSpeed,
    gpsRenderAccel,
    state
  );

} else if (soundActive && !gpsActive) {
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
    saveLastDriveMode("demo");
    demoStart = performance.now();
    lastState = "idle";

    ui.start.textContent = "Läuft ✓";
    ui.gps.textContent = "Start";
    ui.mute.textContent = "Stumm";
  });

ui.gps.addEventListener("click", async () => {
  if (!await ensureVoltuneAudio()) {
    return;
  }

  VoltuneAudio.resetDrivingState();

  demoActive = false;
  controllerActive = false;
  lastState = "idle";

  saveLastDriveMode("gps");

  // GPS läuft durch den automatischen
  // Wiederherstellungsmodus bereits.
  // Dann nicht noch einmal starten.
  if (gpsActive) {
    ui.start.textContent =
      "Sound läuft · GPS";

    ui.gps.textContent =
      "Aktiv ✓";

    ui.mute.textContent =
      "Stumm";

    renderVisual(
      gpsSpeedKmh,
      gpsAccel,
      "GPS · aktiv"
    );

    updateVoltuneSound(
      gpsSpeedKmh,
      gpsAccel
    );

    return;
  }

  // GPS war noch nicht aktiv.
  if (startGps()) {
    ui.start.textContent =
      "Sound läuft · GPS";

    ui.gps.textContent =
      "Aktiv ✓";

    ui.mute.textContent =
      "Stumm";

    renderVisual(
      0,
      0,
      "GPS · warte …"
    );
  }
});

ui.controller.addEventListener(
  "click",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    const gamepads =
      navigator.getGamepads
        ? navigator.getGamepads()
        : [];

    const gamepad =
      Array.from(gamepads).find(
        pad => pad !== null
      );

    if (!gamepad) {
      alert(
        "Kein Controller erkannt."
      );

      return;
    }

    VoltuneAudio.resetDrivingState();
    VoltuneDrivetrain.reset();

    stopGps(false);

    demoActive = false;
    controllerActive = true;
    saveLastDriveMode("controller");

    controllerSpeed = 0;
    manualSpeed = 0;
    manualAccel = 0;

    lastControllerTime =
      performance.now();

    ui.controller.textContent =
      "Controller aktiv ✓";

    ui.start.textContent =
      "Sound läuft · Controller";

    ui.gps.textContent =
      "Start";

    ui.mute.textContent =
      "Stumm";

    render(
      0,
      0,
      "Controller · bereit"
    );
  }
);
  
  ui.restart.addEventListener("click", async () => {
    if (!await ensureVoltuneAudio()) return;
    
    VoltuneAudio.resetDrivingState();

    stopGps(false);
    demoActive = true;
    saveLastDriveMode("demo");
    demoStart = performance.now();
    lastState = "idle";
    ui.gps.textContent = "Start";
  });

  ui.stop.addEventListener("click", () => {
    stopAudio();
  });

ui.gears.addEventListener("click", () => {
  gearsEnabled = !gearsEnabled;

  ui.gears.classList.toggle(
    "active",
    gearsEnabled
  );

  VoltuneDrivetrain.reset();

  setRpmMarker(
    ui.shiftMarker,
    gearsEnabled
      ? ui.shiftRpm.value
      : null,
    ui.maxRpm.value
  );

  setRpmMarker(
    ui.downshiftMarker,
    null,
    ui.maxRpm.value
  );

  if (soundActive) {
    if (gpsActive) {
      updateVoltuneSound(
        gpsSpeedKmh,
        gpsAccel
      );
    } else {
      updateVoltuneSound(
        manualSpeed,
        manualAccel
      );
    }
  } else {
    ui.gearDisplay.textContent =
      gearsEnabled
        ? "1"
        : "Direkt";

    ui.rpmDisplay.textContent =
      "0 RPM";

    ui.shiftTargetDisplay.textContent =
      "–";
    ui.downshiftTargetDisplay.textContent =
      "–";
  }

  scheduleSettingsSave();
});

  ui.dynamicShift.addEventListener("click", () => {
    dynamicShiftEnabled = !dynamicShiftEnabled;
    ui.dynamicShift.classList.toggle("active", dynamicShiftEnabled);

    if (soundActive) {
      if (gpsActive) updateVoltuneSound(gpsSpeedKmh, gpsAccel);
      else updateVoltuneSound(manualSpeed, manualAccel);
    }
    scheduleSettingsSave();
  });

ui.debug.addEventListener("click", () => {
  const active =
    document.body.classList.toggle(
      "debugActive"
    );

  ui.debug.classList.toggle(
    "active",
    active
  );

  ui.debug.setAttribute(
    "aria-pressed",
    active ? "true" : "false"
  );

  ui.debug.textContent =
    active
      ? "Debug aus"
      : "Debug";
});
  
  ui.mute.addEventListener("click", () => {
    if (!VoltuneAudio.isStarted()) return;
  
    const nextMuted =
      !VoltuneAudio.isMuted();
  
    VoltuneAudio.setMuted(
      nextMuted,
      Number(ui.volume.value)
    );
  
    ui.mute.textContent =
      nextMuted ? "Ton an" : "Stumm";
  });

  // =========================
// Effekt-Testbuttons
// =========================

ui.testShiftBurble.addEventListener(
  "click",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    VoltuneAudio.triggerShiftBurble(
      1.0,
      Number(ui.shiftBurble.value)
    );
  }
);

ui.testBov.addEventListener(
  "click",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    VoltuneAudio.triggerBov(
      1.0,
      Number(ui.bov.value),
      0
    );
  }
);

ui.testOverrun.addEventListener(
  "click",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    VoltuneAudio.triggerOverrun(
      1.0,
      Number(ui.overrun.value)
    );
  }
);

  // Manuelle Geschwindigkeit:
  // Die Änderungsrate des Sliders wird als Beschleunigung interpretiert.
  ui.speedTest.addEventListener("input", async () => {
    if (!await ensureVoltuneAudio()) return;
    saveLastDriveMode("manual");
    
    demoActive = false;
    stopGps(false);
    ui.gps.textContent = "Start";

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
    ui.maxBaseLabel.textContent = `${ui.maxBase.value} Hz`;
    ui.cruiseDampingLabel.textContent = `${ui.cruiseDamping.value} %`;
    ui.pitchLabel.textContent = `${(Number(ui.pitch.value)/10).toFixed(1)}×`;
    ui.gearRangeLabel.textContent = `${ui.gearRange.value} km/h`;
    ui.maxRpmLabel.textContent = `${ui.maxRpm.value} RPM`;
    ui.shiftBurbleLabel.textContent =
     `${ui.shiftBurble.value} %`;
    
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
    ui.overrunLabel.textContent = `${ui.overrun.value} %`;
  };

  [
    ui.volume,
    ui.base,
    ui.maxBase,
    ui.cruiseDamping,
    ui.pitch,
    ui.gearRange,
    ui.maxRpm,
    ui.shiftRpm,
    ui.shiftBurble,
    ui.baseVol,
    ui.inverter,
    ui.drive,
    ui.regen,
    ui.air,
    ui.bov,
    ui.overrun
  ].forEach(el => {
    el.addEventListener("input", () => {
  
      // Min. und Max. Grundfrequenz
      // dürfen sich nicht überschneiden.
      if (
        el === ui.base &&
        Number(ui.base.value) > Number(ui.maxBase.value)
      ) {
        ui.maxBase.value =
          ui.base.value;
      }
  
      if (
        el === ui.maxBase &&
        Number(ui.maxBase.value) < Number(ui.base.value)
      ) {
        ui.base.value =
          ui.maxBase.value;
      }
  
      updateLabels();

if (
  el === ui.maxRpm ||
  el === ui.shiftRpm
) {
  setRpmMarker(
    ui.shiftMarker,
    gearsEnabled
      ? ui.shiftRpm.value
      : null,
    ui.maxRpm.value
  );

  setRpmMarker(
    ui.downshiftMarker,
    null,
    ui.maxRpm.value
  );
}
        
      if (el === ui.volume) {
        setMasterVolume();
      }
  
      if (
        el === ui.gearRange ||
        el === ui.maxRpm ||
        el === ui.shiftRpm
      ) {
        VoltuneDrivetrain.reset();
      }
  
      if (
        soundActive &&
        !demoActive
      ) {
        if (gpsActive) {
          updateVoltuneSound(
            gpsSpeedKmh,
            gpsAccel
          );
        } else {
          updateVoltuneSound(
            manualSpeed,
            manualAccel
          );
        }
      }
  
      scheduleSettingsSave();
    });
  });

function restoreLastDriveMode() {
  const lastMode =
    loadLastDriveMode();

  // Nur GPS automatisch wiederherstellen.
  if (lastMode !== "gps") {
    return;
  }

  demoActive = false;
  controllerActive = false;
  lastState = "idle";

  if (startGps()) {
    ui.gps.textContent =
      "Aktiv ✓";

    renderVisual(
      0,
      0,
      "GPS · warte …"
    );
  }
}
  
const savedSettings =
  VoltuneStorage.loadSettings();

if (savedSettings) {
  applyPersistentSettings(
    savedSettings
  );
}

updateLabels();

ui.gearDisplay.textContent =
  gearsEnabled
    ? "1"
    : "Direkt";

ui.rpmDisplay.textContent =
  "0 RPM";

ui.shiftTargetDisplay.textContent =
  gearsEnabled
    ? `${ui.shiftRpm.value} RPM`
    : "–";
  ui.downshiftTargetDisplay.textContent =
  "–";

setRpmMarker(
  ui.shiftMarker,
  gearsEnabled
    ? ui.shiftRpm.value
    : null,
  ui.maxRpm.value
);

setRpmMarker(
  ui.downshiftMarker,
  null,
  ui.maxRpm.value
);
  
renderVisual(
  0,
  0,
  "Bereit"
);

  setTimeout(
  restoreLastDriveMode,
  300
);

requestAnimationFrame(loop);
})();
