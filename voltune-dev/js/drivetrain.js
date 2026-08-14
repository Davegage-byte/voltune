window.VoltuneDrivetrain = (() => {
  const gearRatios = [2.66, 1.78, 1.30, 1.00, 0.80, 0.63];
  const topGearRatio = gearRatios[gearRatios.length - 1];

  let currentGear = 1;
  let virtualRpm = 0;
  let currentShiftTarget = 0;
  let lastShiftAt = -9999;

  const SHIFT_COOLDOWN_MS = 350;
  

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function reset() {
    currentGear = 1;
    virtualRpm = 0;
    currentShiftTarget = 0;
    lastShiftAt = -9999;
  }

  function rpmForGear(speedKmh, gear, config) {
    const maxRpm = Number(config.maxRpm);
    const rangeKmh = Math.max(1, Number(config.gearRange));
    const ratio = gearRatios[gear - 1];

    return Math.max(
      0,
      (speedKmh / rangeKmh) *
      maxRpm *
      (ratio / topGearRatio)
    );
  }

  function calculateShiftTarget(accel, config) {
    const maxRpm = Number(config.maxRpm);
    const sportShift = Math.min(
      Number(config.shiftRpm),
      maxRpm
    );

    if (!config.dynamicShiftEnabled) {
      return sportShift;
    }

    const gentleShift = clamp(
      maxRpm * 0.34,
      1500,
      Math.min(2800, sportShift)
    );

    const accelN = clamp(
      Math.max(0, accel) / 5.0,
      0,
      1
    );

    const demand = Math.pow(accelN, 0.55);

    return gentleShift +
      (sportShift - gentleShift) * demand;
  }

  function update(speedKmh, accel, config) {
    const maxRpm = Number(config.maxRpm);
    const rangeKmh = Math.max(1, Number(config.gearRange));

    currentShiftTarget =
      calculateShiftTarget(accel, config);

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
        direct: true
      };
    }

    let rpm = rpmForGear(
      speedKmh,
      currentGear,
      config
    );

    const nowMs = performance.now();

  if (
    currentGear < gearRatios.length &&
    accel > -0.08 &&
    rpm >= currentShiftTarget &&
    nowMs - lastShiftAt >= SHIFT_COOLDOWN_MS
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

// Gewünschte Drehzahl NACH dem Zurückschalten.
//
// Index entspricht dem aktuellen Gang:
// 2 -> 1 = 2350 RPM
// 3 -> 2 = 2100 RPM
// 4 -> 3 = 1900 RPM
// 5 -> 4 = 1750 RPM
// 6 -> 5 = 1600 RPM
const downshiftLandingRpm = {
  2: 2350,
  3: 2100,
  4: 1900,
  5: 1750,
  6: 1600
};

if (
  canShift &&
  currentGear > 1
) {
  const currentRatio =
    gearRatios[currentGear - 1];

  const lowerRatio =
    gearRatios[currentGear - 2];

  const targetLandingRpm =
    downshiftLandingRpm[currentGear];

  // Berechnet, bei welcher Drehzahl im aktuellen
  // Gang heruntergeschaltet werden muss, damit
  // der niedrigere Gang ungefähr bei seiner
  // gewünschten Ziel-RPM landet.
  const downshiftTriggerRpm =
    targetLandingRpm *
    (currentRatio / lowerRatio);

  if (rpm <= downshiftTriggerRpm) {
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

    virtualRpm = clamp(
      rpm,
      0,
      maxRpm * 1.08
    );

    return {
      gear: currentGear,
      ratio: gearRatios[currentGear - 1],
      rpm: virtualRpm,
      maxRpm,
      shiftTarget: currentShiftTarget,
      direct: false
    };
  }

  return {
    update,
    reset,
    gearRatios
  };
})();
