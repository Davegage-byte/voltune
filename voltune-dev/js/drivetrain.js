window.VoltuneDrivetrain = (() => {
  const gearRatios = [2.66, 1.78, 1.30, 1.00, 0.80, 0.63];
  const topGearRatio = gearRatios[gearRatios.length - 1];

  let currentGear = 1;
  let virtualRpm = 0;
  let currentShiftTarget = 0;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function reset() {
    currentGear = 1;
    virtualRpm = 0;
    currentShiftTarget = 0;
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

    while (
      currentGear < gearRatios.length &&
      accel > -0.08 &&
      rpm >= currentShiftTarget
    ) {
      currentGear++;

      rpm = rpmForGear(
        speedKmh,
        currentGear,
        config
      );
    }

  // Beim normalen Rollen nicht zu früh zurückschalten.
  // Bei stärkerer Verzögerung steigt die Rückschalt-Drehzahl,
  // damit das Getriebe früher in einen niedrigeren Gang geht.
  const decelDemand = clamp(
    -accel / 2.0,
    0,
    1
  );

const downshiftRpm =
  1250 +
  decelDemand * 450;

    while (
      currentGear > 1 &&
      rpm < downshiftRpm
    ) {
      currentGear--;

      rpm = rpmForGear(
        speedKmh,
        currentGear,
        config
      );

      if (rpm > currentShiftTarget * 0.98) {
        currentGear++;

        rpm = rpmForGear(
          speedKmh,
          currentGear,
          config
        );

        break;
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
