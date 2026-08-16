window.VoltuneGps = (() => {
  let watchId = null;
  let active = false;

  let lastPos = null;
  let lastGpsTs = null;
  let lastGpsSpeed = 0;
  let smoothGpsSpeed = 0;
  let gpsAccel = 0;
  let gpsRate = 0;
  let rawGpsSpeed = 0;
  let rawGpsAccel = 0;
  let onUpdate = null;
  let onError = null;

  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  const finite = v =>
    Number.isFinite(v);

  function haversine(a, b) {
    const R = 6371000;

    const p1 = a.lat * Math.PI / 180;
    const p2 = b.lat * Math.PI / 180;

    const dp = (b.lat - a.lat) * Math.PI / 180;
    const dl = (b.lon - a.lon) * Math.PI / 180;

    const h =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function handlePosition(pos) {
    if (!active) return;

    const ts = pos.timestamp || Date.now();
    const c = pos.coords;

    let speed =
      finite(c.speed) && c.speed >= 0
        ? c.speed
        : null;

    // Falls der Browser keine direkte Geschwindigkeit liefert:
    // aus zwei GPS-Positionen berechnen.
    if (
      speed == null &&
      lastPos &&
      lastGpsTs
    ) {
      const dt =
        (ts - lastGpsTs) / 1000;

      if (dt > 0.15 && dt < 10) {
        speed =
          haversine(
            lastPos,
            {
              lat: c.latitude,
              lon: c.longitude
            }
          ) / dt;
      }
    }

    if (speed == null) {
      speed = 0;
    }

    // Sehr kleine GPS-Bewegungen als Stillstand behandeln.
    if (speed < 0.45) {
      speed = 0;
    }

    rawGpsSpeed = speed;

    const firstGpsValue =
      lastGpsTs == null;

const firstGpsValue =
  lastGpsTs == null;

// Rohgeschwindigkeit immer direkt merken.
rawGpsSpeed = speed;

if (firstGpsValue) {
  // Erster GPS-Wert ist nur der Ausgangspunkt.
  // Keine künstliche Beschleunigung erzeugen.

  smoothGpsSpeed = speed;
  lastGpsSpeed = speed;

  rawGpsAccel = 0;
  gpsAccel = 0;
  gpsRate = 0;

} else {
  const dt =
    clamp(
      (ts - lastGpsTs) / 1000,
      0.15,
      8
    );

  gpsRate =
    1 / dt;

  // Geschwindigkeit nicht zusätzlich glätten.
  smoothGpsSpeed = speed;

  // Beschleunigung direkt aus der
  // Geschwindigkeitsänderung berechnen.
  rawGpsAccel =
    (speed - lastGpsSpeed) / dt;

  // Nur die Beschleunigung leicht glätten.
  const accelResponse =
    1 - Math.exp(-dt / 0.25);

  gpsAccel +=
    (
      clamp(
        rawGpsAccel,
        -6,
        6
      ) -
      gpsAccel
    ) *
    accelResponse;

  // Kleines GPS-Rauschen um 0 entfernen.
  if (
    Math.abs(gpsAccel) < 0.03
  ) {
    gpsAccel = 0;
  }

  lastGpsSpeed = speed;
}

// Erst NACH der Berechnung
// den aktuellen Messpunkt speichern.
lastGpsTs = ts;

lastPos = {
  lat: c.latitude,
  lon: c.longitude
};

    const kmh =
      smoothGpsSpeed * 3.6;

    if (onUpdate) {
      onUpdate({
        speedKmh: kmh,
        rawSpeedKmh: rawGpsSpeed * 3.6,
        smoothSpeedKmh: smoothGpsSpeed * 3.6,
        rawAcceleration: rawGpsAccel,
        acceleration: gpsAccel,
        rateHz: gpsRate,
        accuracy:
          finite(c.accuracy)
            ? c.accuracy
            : null,
        timestamp: ts
      });
    }
  }

  function handleError(err) {
    const message = {
      1: "Berechtigung verweigert",
      2: "Position nicht verfügbar",
      3: "GPS-Timeout"
    }[err.code]
      || err.message
      || "GPS-Fehler";

    if (onError) {
      onError({
        code: err.code,
        message
      });
    }
  }

  function start(options = {}) {
    if (
      !("geolocation" in navigator)
    ) {
      if (options.onError) {
        options.onError({
          code: 0,
          message:
            "Geolocation nicht verfügbar"
        });
      }

      return false;
    }

    stop();

    onUpdate =
      options.onUpdate || null;

    onError =
      options.onError || null;

    active = true;

    lastPos = null;
    lastGpsTs = null;
    lastGpsSpeed = 0;
    smoothGpsSpeed = 0;

    gpsAccel = 0;
    gpsRate = 0;

    watchId =
      navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );

    return true;
  }

  function stop() {
    active = false;

    if (
      watchId != null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchId
      );
    }

    watchId = null;
  }

  function isActive() {
    return active;
  }

  function getState() {
    return {
      active,
      speedKmh:
        smoothGpsSpeed * 3.6,
      acceleration: gpsAccel,
      rateHz: gpsRate,
      lastTimestamp: lastGpsTs
    };
  }

  return {
    start,
    stop,
    isActive,
    getState
  };
})();
