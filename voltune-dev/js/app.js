(() => {
  const $ = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  const ui = {
    accelerationFx:$("accelerationFx"),
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

    start:$("start"), gps:$("gps"), controller:$("controller"), stop:$("stop"), mute:$("mute"), debug:$("debug"),
    easyBov:$("easyBov"),
    gears:$("gears"),
    dynamicShift:$("dynamicShift"),
    animations:$("animations"),
    theme:$("theme"),
    easyBov:$("easyBov"),
    gears:$("gears"),
    dynamicShift:$("dynamicShift"),
    animations:$("animations"),
    
    driveModeNormal:$("driveModeNormal"),
    driveModeSport:$("driveModeSport"),
    driveModeMadness:$("driveModeMadness"),
    testShiftBurble:$("testShiftBurble"),
    testDownshiftBlip:$("testDownshiftBlip"),
    testBov:$("testBov"),
    testOverrun:$("testOverrun"),
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
    gearRange:$("gearRange"),
    maxRpm:$("maxRpm"),
    shiftRpm:$("shiftRpm"),
    shiftBurble:$("shiftBurble"),
    downshiftBlip:$("downshiftBlip"),
    baseVol:$("baseVol"), inverter:$("inverter"), drive:$("drive"),
    regen:$("regen"), air:$("air"), bov:$("bov"), overrun:$("overrun"),

    volumeLabel:$("volumeLabel"), baseLabel:$("baseLabel"), maxBaseLabel:$("maxBaseLabel"), pitchLabel:$("pitchLabel"),
    cruiseDampingLabel:$("cruiseDampingLabel"),
    gearRangeLabel:$("gearRangeLabel"),
    maxRpmLabel:$("maxRpmLabel"),
    shiftRpmLabel:$("shiftRpmLabel"),
    shiftBurbleLabel:$("shiftBurbleLabel"),
    downshiftBlipLabel:$("downshiftBlipLabel"),
    baseVolLabel:$("baseVolLabel"), inverterLabel:$("inverterLabel"),
    driveLabel:$("driveLabel"), regenLabel:$("regenLabel"),
    airLabel:$("airLabel"), bovLabel:$("bovLabel"), overrunLabel:$("overrunLabel")
  };

  let soundActive = false;

// =========================
// Theme
// =========================

const THEME_MODE_KEY =
  "voltune.themeMode";

const VALID_THEME_MODES = [
  "auto",
  "dark",
  "light"
];

const browserThemeMedia =
  window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

let themeMode =
  document.documentElement.dataset.themeMode;

if (
  !VALID_THEME_MODES.includes(
    themeMode
  )
) {
  themeMode = "auto";
}


// =========================
// Theme-Übergang
// =========================

let themeSwitchTimer = null;
let themeTransitionEndTimer = null;


// =========================
// Browser-Theme Debug
// =========================

const browserThemeDebug =
  document.createElement("div");

browserThemeDebug.style.display =
  "none";

browserThemeDebug.style.marginTop =
  "12px";

browserThemeDebug.style.fontSize =
  "12px";

browserThemeDebug.style.opacity =
  "0.65";

browserThemeDebug.style.textAlign =
  "center";

document.body.appendChild(
  browserThemeDebug
);


// =========================
// Theme auflösen
// =========================

function resolveTheme() {
  if (themeMode === "dark") {
    return "dark";
  }

  if (themeMode === "light") {
    return "light";
  }

  return browserThemeMedia.matches
    ? "dark"
    : "light";
}


// =========================
// Theme speichern
// =========================

function saveThemeMode() {
  try {
    localStorage.setItem(
      THEME_MODE_KEY,
      themeMode
    );
  } catch (error) {
    console.warn(
      "Theme-Modus konnte nicht gespeichert werden:",
      error
    );
  }
}


// =========================
// Theme-Button
// =========================

function updateThemeButton() {
  const labels = {
    auto: "Auto",
    dark: "Dark",
    light: "Light"
  };

  if (ui.theme) {
    ui.theme.textContent =
      `Theme: ${labels[themeMode]}`;

    ui.theme.dataset.themeMode =
      themeMode;
  }

  document.documentElement.dataset.themeMode =
    themeMode;
}


// =========================
// Theme-Debug
// =========================

function updateBrowserThemeDebug() {
  const browserTheme =
    browserThemeMedia.matches
      ? "DARK"
      : "LIGHT";

  const resolvedTheme =
    resolveTheme().toUpperCase();

  browserThemeDebug.textContent =
    `Browser: ${browserTheme} · Voltune: ${resolvedTheme} · Modus: ${themeMode.toUpperCase()}`;
}


// =========================
// Theme anwenden
// =========================

function applyTheme(
  animate = true
) {
  const root =
    document.documentElement;

  const resolvedTheme =
    resolveTheme();

  const currentTheme =
    root.dataset.theme;

  root.dataset.themeMode =
    themeMode;

  updateThemeButton();

  clearTimeout(
    themeSwitchTimer
  );

  clearTimeout(
    themeTransitionEndTimer
  );

  root.classList.remove(
    "themeChanging"
  );


  // Beim ersten Laden oder wenn sich
  // das sichtbare Theme gar nicht ändert,
  // ist keine Übergangsanimation nötig.
  if (
    !animate ||
    !currentTheme ||
    currentTheme === resolvedTheme
  ) {
    root.dataset.theme =
      resolvedTheme;

    updateBrowserThemeDebug();

    return;
  }


  // Erst leicht ausblenden / unscharf werden.
  // Das eigentliche Theme wird erst im
  // unscharfen Moment gewechselt.
  requestAnimationFrame(() => {
    root.classList.add(
      "themeChanging"
    );

    themeSwitchTimer =
      setTimeout(() => {
        root.dataset.theme =
          resolvedTheme;

        updateBrowserThemeDebug();

        // Danach wieder scharf einblenden.
        themeTransitionEndTimer =
          setTimeout(() => {
            root.classList.remove(
              "themeChanging"
            );
          }, 430);

      }, 240);
  });
}


// =========================
// Theme-Modus setzen
// =========================

function setThemeMode(
  nextMode,
  animate = true
) {
  if (
    !VALID_THEME_MODES.includes(
      nextMode
    )
  ) {
    return;
  }

  themeMode =
    nextMode;

  saveThemeMode();

  applyTheme(
    animate
  );
}


// =========================
// Theme durchschalten
// =========================

function cycleThemeMode() {
  const currentIndex =
    VALID_THEME_MODES.indexOf(
      themeMode
    );

  const nextIndex =
    (
      currentIndex + 1
    ) %
    VALID_THEME_MODES.length;

  setThemeMode(
    VALID_THEME_MODES[nextIndex],
    true
  );
}


// =========================
// Tesla / Browser Theme live
// =========================

function handleBrowserThemeChange() {
  updateBrowserThemeDebug();

  // Nur Auto folgt dem Tesla.
  if (themeMode === "auto") {
    applyTheme(
      true
    );
  }
}

if (
  browserThemeMedia.addEventListener
) {
  browserThemeMedia.addEventListener(
    "change",
    handleBrowserThemeChange
  );

} else if (
  browserThemeMedia.addListener
) {
  browserThemeMedia.addListener(
    handleBrowserThemeChange
  );
}


// Das eigentliche Theme wurde bereits
// ganz früh in index.html bestimmt.
// Hier synchronisieren wir nur Zustand
// und Button ohne sichtbaren Übergang.

applyTheme(
  false
);

  // =========================
  // Beschleunigungsanimation
  // =========================
  
  const accelerationFxCanvas =
    ui.accelerationFx;
  
  const accelerationFxCtx =
    accelerationFxCanvas
      ? accelerationFxCanvas.getContext("2d")
      : null;
  
  let accelerationFxWidth = 0;
  let accelerationFxHeight = 0;
  
  function resizeAccelerationFx() {
    if (
      !accelerationFxCanvas ||
      !accelerationFxCtx
    ) {
      return;
    }
  
    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );
  
    accelerationFxWidth =
      window.innerWidth;
  
    accelerationFxHeight =
      window.innerHeight;
  
    accelerationFxCanvas.width =
      Math.round(
        accelerationFxWidth * dpr
      );
  
    accelerationFxCanvas.height =
      Math.round(
        accelerationFxHeight * dpr
      );
  
    accelerationFxCanvas.style.width =
      `${accelerationFxWidth}px`;
  
    accelerationFxCanvas.style.height =
      `${accelerationFxHeight}px`;
  
    accelerationFxCtx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }
  
  window.addEventListener(
    "resize",
    resizeAccelerationFx
  );
  
  resizeAccelerationFx();

// =========================
// Beschleunigungs-Partikel
// =========================

// Fester Partikel-Pool.
// Je nach Beschleunigung wird später nur
// ein Teil davon tatsächlich gezeichnet.
const ACCELERATION_FX_PARTICLE_COUNT = 90;

const accelerationFxParticles = [];

let accelerationFxIntensity = 0;
let accelerationFxTargetIntensity = 0;
let accelerationFxLastTime =
  performance.now();

function resetAccelerationFxParticle(
  particle,
  randomDepth = true
) {
  // Zufällige Richtung vom Fluchtpunkt weg.
  const angle =
    Math.random() *
    Math.PI *
    2;

  // Nicht alle Partikel exakt gleich weit
  // vom Mittelpunkt starten lassen.
  const radius =
    10 +
    Math.random() * 80;

  particle.dirX =
    Math.cos(angle);

  particle.dirY =
    Math.sin(angle);

  particle.distance =
    radius;

  // Virtuelle Tiefe.
  // Kleine Werte = weit hinten,
  // größere Werte = näher am Fahrer.
  particle.depth =
    randomDepth
      ? Math.random()
      : 0;

  // Kleine individuelle Unterschiede,
  // damit der Effekt nicht künstlich wirkt.
  particle.speed =
    0.75 +
    Math.random() * 0.55;

  particle.size =
    0.6 +
    Math.random() * 1.4;

  particle.brightness =
    0.35 +
    Math.random() * 0.65;
}

for (
  let i = 0;
  i < ACCELERATION_FX_PARTICLE_COUNT;
  i++
) {
  const particle = {};

  resetAccelerationFxParticle(
    particle,
    true
  );

  accelerationFxParticles.push(
    particle
  );
}

// =========================
// Rekuperations-Partikel
// =========================
//
// Transparente grüne Leuchtringe,
// die bei Rekuperation von außen
// Richtung Fluchtpunkt wandern.

const REGEN_FX_PARTICLE_COUNT = 48;

const regenFxParticles = [];

let regenFxIntensity = 0;
let regenFxTargetIntensity = 0;

function resetRegenFxParticle(
  particle,
  randomProgress = true
) {
  particle.angle =
    Math.random() *
    Math.PI *
    2;

  // 0 = außen
  // 1 = Fluchtpunkt / Mitte
  particle.progress =
    randomProgress
      ? Math.random()
      : 0;

  particle.speed =
    0.65 +
    Math.random() * 0.70;

  particle.size =
    4 +
    Math.random() * 8;

  particle.brightness =
    0.40 +
    Math.random() * 0.60;

  // Kleine Abweichung von einer perfekt
  // geraden Flugbahn, damit die Bewegung
  // etwas organischer wirkt.
  particle.drift =
    (
      Math.random() -
      0.5
    ) * 0.18;
}

for (
  let i = 0;
  i < REGEN_FX_PARTICLE_COUNT;
  i++
) {
  const particle = {};

  resetRegenFxParticle(
    particle,
    true
  );

  regenFxParticles.push(
    particle
  );
}

function updateAccelerationFx(
  accel,
  now
) {
  if (
    !accelerationFxCanvas ||
    !accelerationFxCtx
  ) {
    return;
  }

  // Globaler Schalter für visuelle Effekte.
  // Dieser soll später auch für weitere
  // Voltune-Animationen verwendet werden.
  if (!animationsEnabled) {
    accelerationFxIntensity = 0;
    accelerationFxTargetIntensity = 0;
  
    regenFxIntensity = 0;
    regenFxTargetIntensity = 0;
  
    accelerationFxLastTime = now;
  
    accelerationFxCtx.clearRect(
      0,
      0,
      accelerationFxWidth,
      accelerationFxHeight
    );
  
    return;
  }

  const dt =
    clamp(
      (now - accelerationFxLastTime) / 1000,
      0,
      0.05
    );

  accelerationFxLastTime =
    now;


  // =========================
  // Beschleunigung -> Intensität
  // =========================
  //
  // Unter ca. 0,7 m/s² bleibt der
  // Effekt komplett unsichtbar.
  //
  // Ab ca. 3,5 m/s² ist die maximale
  // visuelle Intensität erreicht.

  const rawIntensity =
    clamp(
      (accel - 0.7) /
      (3.5 - 0.7),
      0,
      1
    );

  accelerationFxTargetIntensity =
    Math.pow(
      rawIntensity,
      0.85
    );

// =========================
// Rekuperation -> Intensität
// =========================
//
// Unter etwa -0,6 m/s² bleibt
// die Reku-Animation unsichtbar.
//
// Ab etwa -4,5 m/s² erreicht
// sie ihre maximale Intensität.

const rawRegenIntensity =
  clamp(
    (-accel - 0.6) /
    (4.5 - 0.6),
    0,
    1
  );

regenFxTargetIntensity =
  Math.pow(
    rawRegenIntensity,
    0.85
  );

  
  // =========================
  // Weiches Ein-/Ausblenden
  // =========================

  const responseTime =
    accelerationFxTargetIntensity >
    accelerationFxIntensity
      ? 0.10
      : 0.28;

  const response =
    1 -
    Math.exp(
      -dt / responseTime
    );

  accelerationFxIntensity +=
    (
      accelerationFxTargetIntensity -
      accelerationFxIntensity
    ) *
    response;

  accelerationFxIntensity =
    clamp(
      accelerationFxIntensity,
      0,
      1
    );


// Reku soll ebenfalls direkt reagieren,
// beim Nachlassen aber weich verschwinden.

const regenResponseTime =
  regenFxTargetIntensity >
  regenFxIntensity
    ? 0.12
    : 0.32;

const regenResponse =
  1 -
  Math.exp(
    -dt / regenResponseTime
  );

regenFxIntensity +=
  (
    regenFxTargetIntensity -
    regenFxIntensity
  ) *
  regenResponse;

regenFxIntensity =
  clamp(
    regenFxIntensity,
    0,
    1
  );
  
  // Alte Zeichenfläche löschen.
  accelerationFxCtx.clearRect(
    0,
    0,
    accelerationFxWidth,
    accelerationFxHeight
  );


  // Bei praktisch unsichtbarer Intensität
  // gar nichts mehr berechnen.
  if (
    accelerationFxIntensity < 0.005 &&
    regenFxIntensity < 0.005
  ) {
    return;
  }


  // =========================
  // Fluchtpunkt
  // =========================

  const centerX =
    accelerationFxWidth * 0.5;

  const centerY =
    accelerationFxHeight * 0.5;

  const maxDistance =
    Math.hypot(
      accelerationFxWidth,
      accelerationFxHeight
    ) * 0.62;


  // =========================
  // Anzahl sichtbarer Partikel
  // =========================

  const activeParticles =
    accelerationFxIntensity < 0.005
      ? 0
      : Math.round(
          14 +
          accelerationFxIntensity *
          (
            ACCELERATION_FX_PARTICLE_COUNT -
            14
          )
        );


  // =========================
  // Bewegung
  // =========================

  const travelSpeed =
    90 +
    accelerationFxIntensity *
    850;


  accelerationFxCtx.lineCap =
    "round";


  for (
    let i = 0;
    i < activeParticles;
    i++
  ) {
    const particle =
      accelerationFxParticles[i];


    // Partikel bewegen sich radial
    // vom Fluchtpunkt nach außen.

    particle.distance +=
      travelSpeed *
      particle.speed *
      dt;


    // Hat ein Partikel den Bildschirm
    // verlassen, beginnt es wieder hinten.

    if (
      particle.distance >
      maxDistance
    ) {
      resetAccelerationFxParticle(
        particle,
        false
      );
    }


    const distanceN =
      clamp(
        particle.distance /
        maxDistance,
        0,
        1
      );


    // Je weiter ein Partikel nach außen kommt,
    // desto stärker wirkt die Bewegung.

    const perspective =
      0.35 +
      distanceN * 0.65;


    const x =
      centerX +
      particle.dirX *
      particle.distance;

    const y =
      centerY +
      particle.dirY *
      particle.distance;


    // =========================
    // Streifenlänge
    // =========================
    //
    // Leichte Beschleunigung:
    // fast nur Lichtpunkte.
    //
    // Starke Beschleunigung:
    // deutlich längere Bewegungsstreifen.

    const streakLength =
      (
        2 +
        accelerationFxIntensity *
        52
      ) *
      perspective *
      particle.speed;


    const previousDistance =
      Math.max(
        0,
        particle.distance -
        streakLength
      );

    const startX =
      centerX +
      particle.dirX *
      previousDistance;

    const startY =
      centerY +
      particle.dirY *
      previousDistance;


    // =========================
    // Helligkeit
    // =========================

    const alpha =
      clamp(
        (
          0.08 +
          accelerationFxIntensity *
          0.48
        ) *
        particle.brightness *
        perspective,
        0,
        0.58
      );


    // =========================
    // Punkt oder Streifen
    // =========================

    accelerationFxCtx.beginPath();

    accelerationFxCtx.moveTo(
      startX,
      startY
    );

    accelerationFxCtx.lineTo(
      x,
      y
    );

    accelerationFxCtx.lineWidth =
      particle.size *
      (
        0.65 +
        accelerationFxIntensity *
        0.75
      );

    accelerationFxCtx.strokeStyle =
      `rgba(255, 255, 255, ${alpha})`;

    accelerationFxCtx.stroke();
  }
// =========================
// Rekuperations-Ringe
// =========================

if (regenFxIntensity >= 0.005) {

  const activeRegenParticles =
    Math.round(
      5 +
      regenFxIntensity *
      (
        REGEN_FX_PARTICLE_COUNT -
        5
      )
    );

  // Je stärker die Rekuperation,
  // desto schneller werden die Ringe
  // zur Mitte gezogen.
  const regenTravelSpeed =
    0.28 +
    regenFxIntensity *
    0.95;

  accelerationFxCtx.save();

  accelerationFxCtx.lineCap =
    "round";


  for (
    let i = 0;
    i < activeRegenParticles;
    i++
  ) {
    const particle =
      regenFxParticles[i];


    particle.progress +=
      regenTravelSpeed *
      particle.speed *
      dt;


    // Mitte erreicht:
    // neuen Ring wieder außen starten.
    if (particle.progress >= 1) {
      resetRegenFxParticle(
        particle,
        false
      );
    }


    const progress =
      clamp(
        particle.progress,
        0,
        1
      );


    // Leicht geschwungene Flugbahn.
    const angle =
      particle.angle +
      particle.drift *
      Math.sin(
        progress *
        Math.PI
      );


    // Von außen nach innen.
    const distance =
      maxDistance *
      (1 - progress);


    const x =
      centerX +
      Math.cos(angle) *
      distance;

    const y =
      centerY +
      Math.sin(angle) *
      distance;


    // =========================
    // Ringgröße
    // =========================
    //
    // Richtung Mitte werden die Ringe
    // etwas kleiner – wie Energie,
    // die eingesammelt wird.

    const ringRadius =
      particle.size *
      (
        1.15 -
        progress * 0.60
      );


    // =========================
    // Weiches Erscheinen /
    // Verschwinden
    // =========================

    const fadeIn =
      clamp(
        progress / 0.10,
        0,
        1
      );

    const fadeOut =
      clamp(
        (1 - progress) / 0.18,
        0,
        1
      );


    const alpha =
      clamp(
        (
          0.10 +
          regenFxIntensity *
          0.48
        ) *
        particle.brightness *
        fadeIn *
        fadeOut,
        0,
        0.62
      );


    // =========================
    // Grüner Glow
    // =========================

    accelerationFxCtx.shadowColor =
      `rgba(70, 255, 140, ${
        alpha * 0.85
      })`;

    accelerationFxCtx.shadowBlur =
      4 +
      regenFxIntensity *
      10;


    // =========================
    // Ring zeichnen
    // =========================

    accelerationFxCtx.beginPath();

    accelerationFxCtx.arc(
      x,
      y,
      ringRadius,
      0,
      Math.PI * 2
    );

    accelerationFxCtx.lineWidth =
      0.8 +
      regenFxIntensity *
      1.2;

    accelerationFxCtx.strokeStyle =
      `rgba(70, 255, 140, ${alpha})`;

    accelerationFxCtx.stroke();
  }


  accelerationFxCtx.restore();
}
  
}
  
  function setGpsButtonActive(active) {
    ui.gps.textContent =
      active
        ? "Aktiv ✓"
        : "Start";
  
    ui.gps.classList.toggle(
      "active",
      active
    );
  }

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
  let manualTargetSpeed = 0;
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
  let animationsEnabled = true;
  
// ----- Fahrmodus -----
let driveMode = "normal";

const VALID_DRIVE_MODES = [
  "normal",
  "sport",
  "madness"
];

const DRIVING_STYLE_MODE_KEY =
  "voltune.drivingStyleMode";

function updateDriveModeButtons() {
  ui.driveModeNormal.classList.toggle(
    "active",
    driveMode === "normal"
  );

  ui.driveModeSport.classList.toggle(
    "active",
    driveMode === "sport"
  );

  ui.driveModeMadness.classList.toggle(
    "active",
    driveMode === "madness"
  );
}

function setDriveMode(mode) {
  if (!VALID_DRIVE_MODES.includes(mode)) {
    return;
  }

  driveMode = mode;

  updateDriveModeButtons();

  try {
    localStorage.setItem(
      DRIVING_STYLE_MODE_KEY,
      driveMode
    );
  } catch (error) {
    console.warn(
      "Fahrmodus konnte nicht gespeichert werden:",
      error
    );
  }
}

function restoreDriveMode() {
  let savedMode = null;

  try {
    savedMode =
      localStorage.getItem(
        DRIVING_STYLE_MODE_KEY
      );
  } catch (error) {
    console.warn(
      "Fahrmodus konnte nicht geladen werden:",
      error
    );
  }

  driveMode =
    VALID_DRIVE_MODES.includes(savedMode)
      ? savedMode
      : "normal";

  updateDriveModeButtons();
}
  
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
    downshiftBlipVolume: Number(ui.downshiftBlip.value),
    
    baseVolume: Number(ui.baseVol.value),
    inverterVolume: Number(ui.inverter.value),
    driveVolume: Number(ui.drive.value),
    regenVolume: Number(ui.regen.value),
    airVolume: Number(ui.air.value),
    bovVolume: Number(ui.bov.value),
    overrunVolume: Number(ui.overrun.value),

    easyBovEnabled,
    gearsEnabled,
    dynamicShiftEnabled,
    animationsEnabled
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
  setNumber(
    ui.downshiftBlip,
    settings.downshiftBlipVolume
  );

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

  if (typeof settings.animationsEnabled === "boolean") {
    animationsEnabled =
      settings.animationsEnabled;
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

  ui.animations.classList.toggle(
    "active",
    animationsEnabled
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
      dynamicShiftEnabled,
      driveMode
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

  // =========================
// Rückschalt-Blip
// =========================

if (
  !transmission.direct &&
  transmission.gear < lastTransmissionGear
) {
  const gearDrop =
    lastTransmissionGear -
    transmission.gear;

  const drivingStyle =
    clamp(
      Number(
        transmission.drivingStyle ?? 0
      ),
      0,
      1
    );

// =========================
// Art der Rückschaltung
// =========================

// Positive Beschleunigung:
// Rückschaltung wegen Leistungsanforderung / Kickdown.
const kickdownLoad =
  clamp(
    accel / 3.5,
    0,
    1
  );

// Negative Beschleunigung:
// normales Zurückschalten beim Verzögern.
const brakingLoad =
  clamp(
    (-accel - 0.8) / 2.4,
    0,
    1
  );

const kickdownDownshift =
  accel > 0.8;


// 2 -> 1 bei niedriger Geschwindigkeit
// soll komplett unauffällig bleiben.
const quietFirstGear =
  transmission.gear === 1 &&
  speedKmh < 25;

if (!quietFirstGear) {

  let blipIntensity;
  let blipVolume;


  if (kickdownDownshift) {

    // =========================
    // Kickdown / Beschleunigung
    // =========================
    //
    // Hier soll der Zwischengasstoß
    // deutlich hörbar sein.

    blipIntensity =
      clamp(
        0.35 +
        kickdownLoad * 0.42 +
        drivingStyle * 0.18 +
        Math.max(
          0,
          gearDrop - 1
        ) * 0.15,
        0.25,
        1
      );

    blipVolume =
      Number(
        ui.downshiftBlip.value
      );

  } else {

    // =========================
    // Reku / Bremsen
    // =========================
    //
    // Beim normalen Verzögern soll der
    // Blip fast verschwinden.
    //
    // Erst bei kräftiger Verzögerung
    // darf ein sehr kleiner Hinweis
    // hörbar werden.

    blipIntensity =
      clamp(
        0.08 +
        brakingLoad * 0.12 +
        drivingStyle * 0.04,
        0.05,
        0.22
      );

    // Nur ein kleiner Bruchteil der
    // eingestellten Blip-Lautstärke.
    blipVolume =
      Number(
        ui.downshiftBlip.value
      ) *
      (
        0.05 +
        brakingLoad * 0.10
      );
  }


  VoltuneAudio.triggerDownshiftBlip(
    blipIntensity,
    blipVolume
  );
}
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
      maxRpm: transmission.maxRpm,
      drivingStyle: transmission.drivingStyle ?? 0
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

    ui.start.textContent = "Demo Start";
    setGpsButtonActive(false);
    ui.mute.textContent = "Stumm";

    manualSpeed = 0;
    manualTargetSpeed = 0;
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
  renderVisual(
    speedKmh,
    accel,
    state
  );

  updateAccelerationFx(
    accel,
    performance.now()
  );

  updateVoltuneSound(
    speedKmh,
    accel
  );
}

// =========================
// Voltune Testfahrt
// =========================
//
// Kompletter Fahrzyklus für möglichst viele
// relevante Sound- und Getriebesituationen.
//
// 0–2,5 s:
// Stillstand / Idle
//
// 2,5–6,5 s:
// 0 → 8 km/h
// langsames Anrollen / Idle-Crossfade
//
// 6,5–12,5 s:
// 8 → 40 km/h
// sanfte Beschleunigung
//
// 12,5–16,5 s:
// 40 km/h konstant
// Konstantfahrt-Dämpfung
//
// 16,5–21,5 s:
// 40 → 80 km/h
// mittlere Beschleunigung
//
// 21,5–25,5 s:
// 80 km/h konstant
// erneute Konstantfahrt
//
// 25,5–29,5 s:
// 80 → 130 km/h
// starke Beschleunigung / Kickdown
//
// 29,5–32 s:
// Gas weg bei 130 km/h
// BOV + Schubknallen
//
// 32–36,5 s:
// 130 km/h konstant
// Hochgeschwindigkeits-Konstantfahrt
//
// 36,5–42,5 s:
// 130 → 170 km/h
// Beschleunigung bei höherem Tempo
//
// 42,5–45 s:
// Gas weg bei 170 km/h
//
// 45–50 s:
// 170 → 140 km/h
// leichte Reku
//
// 50–55 s:
// 140 → 70 km/h
// starke Reku / Rückschaltungen
//
// 55–62 s:
// 70 → 10 km/h
// normale Reku
//
// 62–66 s:
// 10 → 0 km/h
// sanftes Ausrollen / Idle-Übergang
//
// 66–69 s:
// Stillstand
//
// 69–75 s:
// 0 → 60 km/h
// erneute kräftige Beschleunigung
// mit aufgebautem Fahrstil
//
// 75–77,5 s:
// Gas weg bei 60 km/h
//
// 77,5–84 s:
// 60 → 0 km/h
// abschließende Reku
//
// 84–87 s:
// Stillstand / sauberer Übergang
// zum nächsten Demo-Durchlauf

function demoValues(t) {
  const phase =
    (t / 1000) % 87;

  let kmh;
  let a;
  let state;


  // =========================
  // 0–2,5 s
  // Stillstand / Idle
  // =========================

  if (phase < 2.5) {
    kmh = 0;
    a = 0;

    state =
      "Demo · Idle";
  }


  // =========================
  // 2,5–6,5 s
  // 0 → 8 km/h
  // =========================

  else if (phase < 6.5) {
    const p =
      (phase - 2.5) / 4;

    kmh =
      p * 8;

    a =
      (8 / 3.6) / 4;

    state =
      "Demo · Anrollen";
  }


  // =========================
  // 6,5–12,5 s
  // 8 → 40 km/h
  // =========================

  else if (phase < 12.5) {
    const p =
      (phase - 6.5) / 6;

    kmh =
      8 +
      p * 32;

    a =
      (32 / 3.6) / 6;

    state =
      "Demo · Sanft beschleunigen";
  }


  // =========================
  // 12,5–16,5 s
  // 40 km/h konstant
  // =========================

  else if (phase < 16.5) {
    kmh = 40;
    a = 0;

    state =
      "Demo · Konstant 40";
  }


  // =========================
  // 16,5–21,5 s
  // 40 → 80 km/h
  // =========================

  else if (phase < 21.5) {
    const p =
      (phase - 16.5) / 5;

    kmh =
      40 +
      p * 40;

    a =
      (40 / 3.6) / 5;

    state =
      "Demo · Mittel beschleunigen";
  }


  // =========================
  // 21,5–25,5 s
  // 80 km/h konstant
  // =========================

  else if (phase < 25.5) {
    kmh = 80;
    a = 0;

    state =
      "Demo · Konstant 80";
  }


  // =========================
  // 25,5–29,5 s
  // 80 → 130 km/h
  // =========================

  else if (phase < 29.5) {
    const p =
      (phase - 25.5) / 4;

    kmh =
      80 +
      p * 50;

    a =
      (50 / 3.6) / 4;

    state =
      "Demo · Voll beschleunigen";
  }


  // =========================
  // 29,5–32 s
  // Last weg
  // =========================

  else if (phase < 32) {
    kmh = 130;
    a = 0;

    state =
      "Demo · Lupfen 130";
  }


  // =========================
  // 32–36,5 s
  // Konstantfahrt 130
  // =========================

  else if (phase < 36.5) {
    kmh = 130;
    a = 0;

    state =
      "Demo · Konstant 130";
  }


  // =========================
  // 36,5–42,5 s
  // 130 → 170 km/h
  // =========================

  else if (phase < 42.5) {
    const p =
      (phase - 36.5) / 6;

    kmh =
      130 +
      p * 40;

    a =
      (40 / 3.6) / 6;

    state =
      "Demo · Beschleunigen Highspeed";
  }


  // =========================
  // 42,5–45 s
  // Last weg
  // =========================

  else if (phase < 45) {
    kmh = 170;
    a = 0;

    state =
      "Demo · Lupfen 170";
  }


  // =========================
  // 45–50 s
  // leichte Reku
  // 170 → 140 km/h
  // =========================

  else if (phase < 50) {
    const p =
      (phase - 45) / 5;

    kmh =
      170 -
      p * 30;

    a =
      -(30 / 3.6) / 5;

    state =
      "Demo · Leichte Reku";
  }


  // =========================
  // 50–55 s
  // starke Reku
  // 140 → 70 km/h
  // =========================

  else if (phase < 55) {
    const p =
      (phase - 50) / 5;

    kmh =
      140 -
      p * 70;

    a =
      -(70 / 3.6) / 5;

    state =
      "Demo · Starke Reku";
  }


  // =========================
  // 55–62 s
  // normale Reku
  // 70 → 10 km/h
  // =========================

  else if (phase < 62) {
    const p =
      (phase - 55) / 7;

    kmh =
      70 -
      p * 60;

    a =
      -(60 / 3.6) / 7;

    state =
      "Demo · Reku";
  }


  // =========================
  // 62–66 s
  // langsames Ausrollen
  // 10 → 0 km/h
  // =========================

  else if (phase < 66) {
    const p =
      (phase - 62) / 4;

    kmh =
      Math.max(
        0,
        10 -
          p * 10
      );

    a =
      -(10 / 3.6) / 4;

    state =
      "Demo · Ausrollen";
  }


  // =========================
  // 66–69 s
  // Stillstand
  // =========================

  else if (phase < 69) {
    kmh = 0;
    a = 0;

    state =
      "Demo · Idle";
  }


  // =========================
  // 69–75 s
  // erneute kräftige Beschleunigung
  // 0 → 60 km/h
  // =========================

  else if (phase < 75) {
    const p =
      (phase - 69) / 6;

    kmh =
      p * 60;

    a =
      (60 / 3.6) / 6;

    state =
      "Demo · Erneut beschleunigen";
  }


  // =========================
  // 75–77,5 s
  // Last weg
  // =========================

  else if (phase < 77.5) {
    kmh = 60;
    a = 0;

    state =
      "Demo · Lupfen 60";
  }


  // =========================
  // 77,5–84 s
  // 60 → 0 km/h
  // =========================

  else if (phase < 84) {
    const p =
      (phase - 77.5) / 6.5;

    kmh =
      Math.max(
        0,
        60 -
          p * 60
      );

    a =
      -(60 / 3.6) / 6.5;

    state =
      "Demo · Reku bis Stillstand";
  }


  // =========================
  // 84–87 s
  // Stillstand
  // =========================

  else {
    kmh = 0;
    a = 0;

    state =
      "Demo · Idle";
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
      "Controller";

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

  const dt =
    clamp(
      (now - lastManualTime) / 1000,
      0,
      0.05
    );

  lastManualTime = now;

  const speedError =
    manualTargetSpeed -
    manualSpeed;

  const speedN =
    clamp(
      manualSpeed / 270,
      0,
      1
    );

  let targetAccel = 0;


  // =========================
  // Beschleunigen
  // =========================

  if (speedError > 0.15) {

    // Bei niedrigem Tempo kräftiger,
    // bei höherem Tempo zunehmend weniger Schub.
    const maxAccel =
      6.0 -
      speedN * 4.0;

    // Kurz vor dem Ziel automatisch
    // sanfter werden.
    const approach =
      clamp(
        speedError / 30,
        0.12,
        1
      );

    targetAccel =
      maxAccel *
      approach;
  }


  // =========================
  // Verzögern / Reku
  // =========================

  else if (speedError < -0.15) {

    const approach =
      clamp(
        -speedError / 25,
        0.15,
        1
      );

    targetAccel =
      -3.0 *
      approach;
  }


  // =========================
  // Beschleunigung glätten
  // =========================

  const accelResponse =
    1 -
    Math.exp(
      -dt / 0.18
    );

  manualAccel +=
    (
      targetAccel -
      manualAccel
    ) *
    accelResponse;


  // =========================
  // Geschwindigkeit bewegen
  // =========================

  const previousSpeed =
    manualSpeed;

  manualSpeed +=
    manualAccel *
    dt *
    3.6;

  manualSpeed =
    clamp(
      manualSpeed,
      0,
      270
    );


  // Ziel erreicht bzw. überschritten:
  // exakt auf die gewünschte Geschwindigkeit setzen.
  if (
    (
      previousSpeed <
        manualTargetSpeed &&
      manualSpeed >=
        manualTargetSpeed
    ) ||
    (
      previousSpeed >
        manualTargetSpeed &&
      manualSpeed <=
        manualTargetSpeed
    ) ||
    Math.abs(speedError) <= 0.15
  ) {
    manualSpeed =
      manualTargetSpeed;

    manualAccel = 0;
  }


  const state =
    manualAccel > 0.25
      ? "Manuell · Beschleunigen"
      : manualAccel < -0.25
        ? "Manuell · Reku"
        : "Manuell · Konstant";

  render(
    manualSpeed,
    manualAccel,
    state
  );
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
    setGpsButtonActive(false);
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

    setGpsButtonActive(true);

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

    setGpsButtonActive(true);

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

    setGpsButtonActive(false);

    ui.mute.textContent =
      "Stumm";

    render(
      0,
      0,
      "Controller · bereit"
    );
  }
);
  
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
  
ui.animations.addEventListener(
  "click",
  () => {
    animationsEnabled =
      !animationsEnabled;

    ui.animations.classList.toggle(
      "active",
      animationsEnabled
    );

    if (!animationsEnabled) {
      accelerationFxIntensity = 0;
      accelerationFxTargetIntensity = 0;

      regenFxIntensity = 0;
      regenFxTargetIntensity = 0;

      if (
        accelerationFxCtx &&
        accelerationFxCanvas
      ) {
        accelerationFxCtx.clearRect(
          0,
          0,
          accelerationFxWidth,
          accelerationFxHeight
        );
      }
    }

    scheduleSettingsSave();
  }
);

// =========================
// Theme
// =========================

if (ui.theme) {
  ui.theme.addEventListener(
    "click",
    cycleThemeMode
  );
}
  
  ui.driveModeNormal.addEventListener(
  "click",
  () => setDriveMode("normal")
);

ui.driveModeSport.addEventListener(
  "click",
  () => setDriveMode("sport")
);

ui.driveModeMadness.addEventListener(
  "click",
  () => setDriveMode("madness")
);

ui.debug.addEventListener("click", () => {
  const active =
    document.body.classList.toggle(
      "debugActive"
    );

  ui.debug.classList.toggle(
    "active",
    active
  );

  browserThemeDebug.style.display =
  active
    ? "block"
    : "none";

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

  ui.testDownshiftBlip.addEventListener(
  "click",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    VoltuneAudio.triggerDownshiftBlip(
      1.0,
      Number(ui.downshiftBlip.value)
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

// =========================
// Manuelle Zielgeschwindigkeit
// =========================
//
// Der Slider setzt nur noch das gewünschte Tempo.
// Die tatsächliche Geschwindigkeit wird im
// Animations-Loop realistisch dorthin bewegt.

ui.speedTest.addEventListener(
  "input",
  async () => {
    if (!await ensureVoltuneAudio()) {
      return;
    }

    saveLastDriveMode("manual");

    demoActive = false;
    controllerActive = false;

    stopGps(false);

    setGpsButtonActive(false);

    ui.controller.textContent =
      "Controller";

    manualTargetSpeed =
      Number(ui.speedTest.value);

    lastManualTime =
      performance.now();

    ui.speedTestLabel.textContent =
      `Ziel: ${Math.round(manualTargetSpeed)} km/h`;

    ui.start.textContent =
      "Sound läuft · Manuell";
  }
);

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
    ui.downshiftBlipLabel.textContent =
    `${ui.downshiftBlip.value} %`;
    
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
    ui.downshiftBlip,
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
    // GPS darf bereits im Hintergrund
    // wieder anlaufen.
    //
    // Der Sound benötigt im Tesla-Browser
    // aber weiterhin einen echten Benutzerklick.
    // Deshalb erst nach diesem Klick
    // "Aktiv ✓" anzeigen.
    setGpsButtonActive(false);

    renderVisual(
      0,
      0,
      "GPS · bereit"
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

// Gespeicherten Fahrmodus laden.
// Falls nichts oder ein ungültiger Wert
// vorhanden ist, wird Normal verwendet.
restoreDriveMode();

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
  
  VoltuneStartup.finish(
    animationsEnabled
);

  setTimeout(
  restoreLastDriveMode,
  300
);

requestAnimationFrame(loop);
})();
