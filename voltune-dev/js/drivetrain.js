window.VoltuneDrivetrain = (() => {
  const gearRatios = [2.66, 1.78, 1.30, 1.00, 0.80, 0.63, 0.50];
  
  // Der bisherige 6. Gang bleibt die RPM-Referenz.
  // Dadurch ändern sich die Gänge 1–6 durch den
  // neuen 7. Gang überhaupt nicht.
  const rpmReferenceRatio = 0.63;

  let drivingStyle = 0;
  let lastStyleUpdate = performance.now();
  let currentGear = 1;
  let virtualRpm = 0;
  let currentShiftTarget = 0;
  let lastShiftAt = -9999;
  let lastKickdownAt = -9999;
  
  const SHIFT_COOLDOWN_MS = 350;
  const KICKDOWN_HOLD_MS = 1200;

  let shiftDemand = 0;
  let lastDemandUpdate = performance.now();
  

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function reset() {
    currentGear = 1;
    virtualRpm = 0;
    currentShiftTarget = 0;
    lastShiftAt = -9999;
    lastKickdownAt = -9999;
  
    shiftDemand = 0;
    lastDemandUpdate = performance.now();
    drivingStyle = 0;
    lastStyleUpdate = performance.now();
  }

  function rpmForGear(speedKmh, gear, config) {
    const maxRpm = Number(config.maxRpm);
    const rangeKmh = Math.max(1, Number(config.gearRange));
    const ratio = gearRatios[gear - 1];
  
    return Math.max(
      0,
      (speedKmh / rangeKmh) *
      maxRpm *
      (ratio / rpmReferenceRatio)
    );
  }

  function calculateShiftTarget(
    accel,
    config,
    effectiveDrivingStyle
  ) {
  const maxRpm = Number(config.maxRpm);

  const sportShift = Math.min(
    Number(config.shiftRpm),
    maxRpm
  );

  if (!config.dynamicShiftEnabled) {
    shiftDemand = 0;
    lastDemandUpdate = performance.now();

    return sportShift;
  }

  const gentleShift = clamp(
    maxRpm * 0.34,
    1500,
    Math.min(2800, sportShift)
  );

  // -------------------------
  // Fahrerlast aus Beschleunigung
  // -------------------------
  //
  // ca. 2,5 m/s² = volle Last.
  // Dadurch reagiert das Getriebe auch
  // auf die eher trägen GPS-Werte deutlich.

  const rawDemand =
    Math.pow(
      clamp(
        Math.max(0, accel) / 3.5,
        0,
        1
      ),
      0.8
    );

  const nowMs =
    performance.now();

  const dt = clamp(
    (nowMs - lastDemandUpdate) / 1000,
    0,
    0.2
  );

  lastDemandUpdate = nowMs;

  // Last soll schnell ansteigen,
  // aber deutlich langsamer wieder abfallen.
  const timeConstant =
    rawDemand > shiftDemand
      ? 0.18
      : 0.85;

  const response =
    1 - Math.exp(
      -dt / timeConstant
    );

  shiftDemand +=
    (rawDemand - shiftDemand) *
    response;

  shiftDemand =
    clamp(shiftDemand, 0, 1);

const effectiveDemand =
  Math.max(
    shiftDemand,
    effectiveDrivingStyle * 0.60
  );

return (
  gentleShift +
  (sportShift - gentleShift) *
    effectiveDemand
);
}

function updateDrivingStyle(accel) {
  const nowMs =
    performance.now();

  const dt =
    clamp(
      (nowMs - lastStyleUpdate) / 1000,
      0,
      0.25
    );

  lastStyleUpdate = nowMs;

  // Kräftige Beschleunigung macht den
  // Fahrstil sportlicher.
  const accelStyle =
    clamp(
      (Math.max(0, accel) - 0.35) / 2.4,
      0,
      1
    );

  // Auch starkes Verzögern ist ein Hinweis
  // auf sportliche Fahrweise.
  const brakeStyle =
    clamp(
      (Math.max(0, -accel) - 0.9) / 2.8,
      0,
      1
    ) * 0.75;

  const target =
    Math.max(
      accelStyle,
      brakeStyle
    );

  // Sportmodus schnell merken,
  // entspannten Fahrstil langsam wieder lernen.
  const timeConstant =
    target > drivingStyle
      ? 0.9
      : 18.0;

  const response =
    1 -
    Math.exp(
      -dt / timeConstant
    );

  drivingStyle +=
    (target - drivingStyle) *
    response;

  drivingStyle =
    clamp(
      drivingStyle,
      0,
      1
    );

  return drivingStyle;
}

  function getEffectiveDrivingStyle(mode) {
  if (mode === "madness") {
    return 1;
  }

  if (mode === "sport") {
    return Math.max(
      0.5,
      drivingStyle
    );
  }

  return drivingStyle;
}
  
  function update(speedKmh, accel, config) {
    const maxRpm = Number(config.maxRpm);
    const rangeKmh = Math.max(1, Number(config.gearRange));

    updateDrivingStyle(accel);
    
    const effectiveDrivingStyle =
      getEffectiveDrivingStyle(
        config.driveMode
      );
    
    currentShiftTarget =
      calculateShiftTarget(
        accel,
        config,
        effectiveDrivingStyle
      );

    if (!config.gearsEnabled) {
      currentGear = 1;

      virtualRpm = clamp(
        (speedKmh / rangeKmh) * maxRpm,
        0,
        maxRpm * 1.08
      );

      return {
        gear: 1,
        ratio: null,
        rpm: virtualRpm,
        maxRpm,
        shiftTarget: null,
        downshiftTarget: null,
        drivingStyle: effectiveDrivingStyle,
        rawDrivingStyle: drivingStyle,
        direct: true
      };
    }

    let rpm = rpmForGear(
      speedKmh,
      currentGear,
      config
    );

    const nowMs = performance.now();

    const firstGearCruiseShift =
    currentGear === 1 &&
    speedKmh >= 18 &&
    Math.abs(accel) <= 0.20;

    if (
      currentGear < gearRatios.length &&
      accel > -0.08 &&
    (
      rpm >= currentShiftTarget ||
      firstGearCruiseShift
    ) &&
      nowMs - lastShiftAt >= SHIFT_COOLDOWN_MS &&
      nowMs - lastKickdownAt >= KICKDOWN_HOLD_MS
    ) {
    currentGear++;
  
    rpm = rpmForGear(
      speedKmh,
      currentGear,
      config
    );
  
    lastShiftAt = nowMs;
  }

  // Beim normalen Rollen nicht zu früh zurückschalten.
  // Bei stärkerer Verzögerung steigt die Rückschalt-Drehzahl,
  // damit das Getriebe früher in einen niedrigeren Gang geht.
// =========================
// Rückschalten
// =========================

const canShift =
  nowMs - lastShiftAt >= SHIFT_COOLDOWN_MS;

// =========================
// Kickdown
// =========================

let didKickdown = false;

// Ab etwa 1,2 m/s² beginnt die Kickdown-Anforderung.
// Ab ungefähr 3,0 m/s² gilt sie als volle Last.
const kickdownDemand = clamp(
  (accel - 1.20) / 1.80,
  0,
  1
);

if (
  canShift &&
  currentGear > 1 &&
  kickdownDemand > 0
) {
  // Leichte Last -> ungefähr 2800 RPM
  // Vollgas      -> ungefähr 4800 RPM
  let kickdownTargetRpm =
    2800 +
    kickdownDemand * 2000;

  // Nicht so weit zurückschalten,
  // dass der Gang direkt wieder hochgeschaltet wird.
  const sportShift =
    Math.min(
      Number(config.shiftRpm),
      maxRpm
    );

  kickdownTargetRpm =
    Math.min(
      kickdownTargetRpm,
      sportShift * 0.88,
      maxRpm * 0.88
    );

  let kickdownGear =
    currentGear;

  // Niedrigsten sinnvollen Gang suchen.
  for (
    let gear = currentGear - 1;
    gear >= 2;
    gear--
  ) {
    const candidateRpm =
      rpmForGear(
        speedKmh,
        gear,
        config
      );

    if (
      candidateRpm <=
      kickdownTargetRpm
    ) {
      kickdownGear =
        gear;
    } else {
      break;
    }
  }

  if (kickdownGear < currentGear) {
    currentGear =
      kickdownGear;

    rpm =
      rpmForGear(
        speedKmh,
        currentGear,
        config
      );

    lastShiftAt = nowMs;
    lastKickdownAt = nowMs;
    
    didKickdown = true;
  }
}

// Gewünschte Drehzahl NACH dem Zurückschalten.
//
// Index entspricht dem aktuellen Gang:
// 2 -> 1
// 3 -> 2
// 4 -> 3
// 5 -> 4
// 6 -> 5
// 7 -> 6

// Entspannte Ziel-RPM nach dem Zurückschalten.
const relaxedDownshiftRpm = {
  2: 2200,
  3: 1950,
  4: 1750,
  5: 1600,
  6: 1450,
  7: 1325
};

// Sportliche Ziel-RPM.
// Dadurch wird deutlich früher zurückgeschaltet.
const sportDownshiftRpm = {
  2: 3400,
  3: 3150,
  4: 2900,
  5: 2650,
  6: 2400,
  7: 2150
};

// Stärkeres Bremsen darf die Rückschaltung
// zusätzlich etwas aggressiver machen.
const brakingDemand =
  clamp(
    (-accel - 0.30) / 2.5,
    0,
    1
  );

const downshiftAggression =
  clamp(
    effectiveDrivingStyle * 0.80 +
      brakingDemand * 0.18,
    0,
    1
  );

  // Aktuelles Rückschaltziel im derzeitigen Gang.
  // Dieser Wert wird zusätzlich an app.js ausgegeben,
  // damit er im RPM-Balken angezeigt werden kann.
  let downshiftTarget = null;
  
  if (currentGear > 1) {
  // Der 1. Gang soll wie bei einem echten
  // Automatik-/DSG-Getriebe erst unmittelbar
  // vor dem Stillstand eingelegt werden.
  //
  // Deshalb wird 2 -> 1 nicht über die normale
  // Fahrstil-/Bremslogik gesteuert, sondern
  // erst bei ungefähr 15 km/h freigegeben.
  if (currentGear === 2) {
    downshiftTarget =
      rpmForGear(
        15,
        2,
        config
      );
  } else {
    const currentRatio =
      gearRatios[currentGear - 1];

    const lowerRatio =
      gearRatios[currentGear - 2];

    const relaxedRpm =
      relaxedDownshiftRpm[currentGear];

    const sportRpm =
      sportDownshiftRpm[currentGear];

    const targetLandingRpm =
      relaxedRpm +
      (sportRpm - relaxedRpm) *
        downshiftAggression;

    downshiftTarget =
      targetLandingRpm *
      (currentRatio / lowerRatio);
  }
}

if (
  canShift &&
  !didKickdown &&
  currentGear > 1 &&
  downshiftTarget !== null
) {
  if (rpm <= downshiftTarget) {
    const nextGear =
      currentGear - 1;

    const nextRpm =
      rpmForGear(
        speedKmh,
        nextGear,
        config
      );

    // Nicht zurückschalten, wenn der niedrigere
    // Gang dadurch praktisch sofort wieder
    // hochgeschaltet werden müsste.
    if (
      nextRpm <
      currentShiftTarget * 0.98
    ) {
      currentGear =
        nextGear;

      rpm =
        nextRpm;

      lastShiftAt =
        nowMs;
    }
  }
}

// =========================
// Dynamische Idle-RPM
// =========================

// Nur die ausgegebene virtuelle Drehzahl.
// Die interne Getriebe-RPM bleibt unverändert.
const idleRpm = 800;

// Die kleine Leerlaufbewegung verschwindet
// zwischen 0 und 5 km/h weich.
const idleWobbleMix =
  1 -
  clamp(
    speedKmh / 5,
    0,
    1
  );

const idleTime =
  nowMs / 1000;

// Zwei langsame Bewegungen übereinander.
// Dadurch wirkt die Drehzahl lebendig,
// ohne hektisch oder zufällig zu springen.
const idleWobble =
  (
    Math.sin(
      idleTime *
      Math.PI *
      2 *
      1.35
    ) * 10 +

    Math.sin(
      idleTime *
      Math.PI *
      2 *
      0.17
    ) * 6
  ) *
  idleWobbleMix;

const displayedIdleRpm =
  idleRpm +
  idleWobble;
    
    virtualRpm = clamp(
      Math.max(
        rpm,
        displayedIdleRpm
      ),
      0,
      maxRpm * 1.08
    );

      return {
        gear: currentGear,
        ratio: gearRatios[currentGear - 1],
        rpm: virtualRpm,
        maxRpm,
        shiftTarget: currentShiftTarget,
        downshiftTarget,
        drivingStyle: effectiveDrivingStyle,
        direct: false
      };
  }

  return {
    update,
    reset,
    gearRatios
  };
})();
