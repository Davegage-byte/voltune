(() => {
  const button =
    document.getElementById("background");

  if (!button) {
    return;
  }

  let enabled = false;
  let keepaliveAudio = null;
  let keepaliveUrl = null;
  let lastHeartbeatAt = performance.now();
  let maxHeartbeatGap = 0;
  let lastLifecycleState = "bereit";

  let backgroundGpsUpdates = 0;
  let lastBackgroundGpsAt = 0;
  let backgroundGpsRateHz = 0;
  let lastBackgroundGear = 1;

  const diagnostics = {
    state: null,
    media: null,
    visibility: null,
    heartbeat: null,
    gps: null
  };

  function createDiagnosticRow(
    panel,
    label
  ) {
    const row =
      document.createElement("div");

    row.className = "gpsItem";

    const labelElement =
      document.createElement("span");

    labelElement.className = "label";
    labelElement.textContent = label;

    const valueElement =
      document.createElement("b");

    valueElement.textContent = "–";

    row.append(
      labelElement,
      valueElement
    );

    panel.appendChild(row);

    return valueElement;
  }

  function installDiagnostics() {
    const details =
      Array.from(
        document.querySelectorAll(
          "details.debugFold"
        )
      ).find(element =>
        element
          .querySelector("summary span")
          ?.textContent
          ?.trim() ===
        "Browser / Viewport"
      );

    const panel =
      details?.querySelector(
        ".gpsPanel"
      );

    if (!panel) {
      return;
    }

    diagnostics.state =
      createDiagnosticRow(
        panel,
        "Background"
      );

    diagnostics.media =
      createDiagnosticRow(
        panel,
        "Tesla Audio Test"
      );

    diagnostics.visibility =
      createDiagnosticRow(
        panel,
        "Page State"
      );

    diagnostics.heartbeat =
      createDiagnosticRow(
        panel,
        "JS Max Gap"
      );

    diagnostics.gps =
      createDiagnosticRow(
        panel,
        "Background GPS"
      );
  }

  function updateDiagnostics() {
    const mediaRunning =
      Boolean(
        keepaliveAudio &&
        !keepaliveAudio.paused &&
        !keepaliveAudio.ended
      );

    if (diagnostics.state) {
      diagnostics.state.textContent =
        enabled
          ? "AKTIV"
          : "aus";

      diagnostics.state.className =
        enabled
          ? "okText"
          : "";
    }

    if (diagnostics.media) {
      diagnostics.media.textContent =
        mediaRunning
          ? "läuft"
          : enabled
            ? "pausiert"
            : "aus";

      diagnostics.media.className =
        mediaRunning
          ? "okText"
          : enabled
            ? "warnText"
            : "";
    }

    if (diagnostics.visibility) {
      diagnostics.visibility.textContent =
        `${
          document.visibilityState ||
          "unbekannt"
        } · ${lastLifecycleState}`;
    }

    if (diagnostics.heartbeat) {
      diagnostics.heartbeat.textContent =
        maxHeartbeatGap > 0
          ? `${(
              maxHeartbeatGap /
              1000
            ).toFixed(1)} s`
          : "0.0 s";

      diagnostics.heartbeat.className =
        maxHeartbeatGap > 3_000
          ? "warnText"
          : enabled
            ? "okText"
            : "";
    }

    if (diagnostics.gps) {
      diagnostics.gps.textContent =
        backgroundGpsUpdates > 0
          ? `${backgroundGpsRateHz.toFixed(1)} Hz · ${backgroundGpsUpdates} Updates`
          : enabled
            ? "warte auf Background"
            : "aus";

      diagnostics.gps.className =
        backgroundGpsUpdates > 0
          ? "okText"
          : enabled
            ? "warnText"
            : "";
    }

    button.classList.toggle(
      "active",
      enabled
    );

    button.setAttribute(
      "aria-pressed",
      enabled
        ? "true"
        : "false"
    );

    button.textContent =
      enabled
        ? "Background ✓"
        : "Background";

    button.title =
      enabled
        ? `Background aktiv · Media ${
            mediaRunning
              ? "läuft"
              : "pausiert"
          } · JS Max Gap ${(
            maxHeartbeatGap /
            1000
          ).toFixed(1)} s`
        : "Tesla-Background mit normalem Browser-Audio testen";
  }

  function numberValue(
    id,
    fallback
  ) {
    const value =
      Number(
        document.getElementById(id)?.value
      );

    return Number.isFinite(value)
      ? value
      : fallback;
  }

  function isFeatureActive(id) {
    return Boolean(
      document
        .getElementById(id)
        ?.classList
        .contains("active")
    );
  }

  function getDriveMode() {
    return (
      document.querySelector(
        ".driveModeBtn.active"
      )?.dataset?.driveMode ||
      "normal"
    );
  }

  function syncBackgroundGearFromUi() {
    const displayedGear =
      Number.parseInt(
        document
          .getElementById("gearDisplay")
          ?.textContent ||
        "1",
        10
      );

    lastBackgroundGear =
      Number.isFinite(displayedGear)
        ? displayedGear
        : 1;
  }

  function getBackgroundAudioSettings() {
    return {
      masterVolume:
        numberValue("volume", 32),
      baseFrequency:
        numberValue("base", 35),
      maxBaseFrequency:
        numberValue("maxBase", 70),
      pitch:
        numberValue("pitch", 21),
      cruiseDamping:
        numberValue("cruiseDamping", 70),
      baseVolume:
        numberValue("baseVol", 65),
      inverterVolume:
        numberValue("inverter", 42),
      driveVolume:
        numberValue("drive", 55),
      regenVolume:
        numberValue("regen", 48),
      airVolume:
        numberValue("air", 30),
      bovVolume:
        numberValue("bov", 60),
      flutterVolume:
        numberValue("turboFlutter", 40),
      overrunVolume:
        numberValue("overrun", 50),
      easyBovEnabled:
        isFeatureActive("easyBov")
    };
  }

  function updateBackgroundGpsSound(data) {
    if (
      !enabled ||
      !document.hidden ||
      !window.VoltuneAudio ||
      !VoltuneAudio.isStarted() ||
      !window.VoltuneDrivetrain
    ) {
      return;
    }

    const speedKmh =
      Number(data?.speedKmh) || 0;

    const acceleration =
      Number(data?.acceleration) || 0;

    const gearsEnabled =
      isFeatureActive("gears");

    const dynamicShiftEnabled =
      isFeatureActive("dynamicShift");

    const maxRpm =
      numberValue("maxRpm", 6500);

    const shiftRpm =
      numberValue("shiftRpm", 6000);

    const transmission =
      VoltuneDrivetrain.update(
        speedKmh,
        acceleration,
        {
          maxRpm,
          gearRange:
            numberValue("gearRange", 270),
          shiftRpm,
          gearsEnabled,
          dynamicShiftEnabled,
          driveMode: getDriveMode()
        }
      );

    if (
      gearsEnabled &&
      !transmission.direct &&
      transmission.gear > lastBackgroundGear
    ) {
      const relaxedShift =
        Math.max(
          1500,
          Math.min(
            2800,
            maxRpm * 0.34
          )
        );

      const sportShift =
        Math.min(
          shiftRpm,
          maxRpm
        );

      const shiftIntensity =
        Math.max(
          0,
          Math.min(
            1,
            (
              transmission.shiftTarget -
              relaxedShift
            ) /
            Math.max(
              1,
              sportShift - relaxedShift
            )
          )
        );

      VoltuneAudio.triggerShiftBurble(
        shiftIntensity,
        numberValue("shiftBurble", 60)
      );
    }

    if (
      gearsEnabled &&
      !transmission.direct &&
      transmission.gear < lastBackgroundGear
    ) {
      const gearDrop =
        lastBackgroundGear -
        transmission.gear;

      const drivingStyle =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              transmission.drivingStyle ?? 0
            )
          )
        );

      const quietFirstGear =
        transmission.gear === 1 &&
        speedKmh < 25;

      if (!quietFirstGear) {
        const kickdownLoad =
          Math.max(
            0,
            Math.min(
              1,
              acceleration / 3.5
            )
          );

        const brakingLoad =
          Math.max(
            0,
            Math.min(
              1,
              (-acceleration - 0.8) / 2.4
            )
          );

        const kickdownDownshift =
          acceleration > 0.8;

        const blipIntensity =
          kickdownDownshift
            ? Math.max(
                0.25,
                Math.min(
                  1,
                  0.35 +
                    kickdownLoad * 0.42 +
                    drivingStyle * 0.18 +
                    Math.max(
                      0,
                      gearDrop - 1
                    ) * 0.15
                )
              )
            : Math.max(
                0.05,
                Math.min(
                  0.22,
                  0.08 +
                    brakingLoad * 0.12 +
                    drivingStyle * 0.04
                )
              );

        const baseBlipVolume =
          numberValue(
            "downshiftBlip",
            55
          );

        const blipVolume =
          kickdownDownshift
            ? baseBlipVolume
            : baseBlipVolume *
              (
                0.05 +
                brakingLoad * 0.10
              );

        VoltuneAudio.triggerDownshiftBlip(
          blipIntensity,
          blipVolume
        );
      }
    }

    lastBackgroundGear =
      transmission.direct
        ? 1
        : transmission.gear;

    VoltuneAudio.update(
      {
        speedKmh,
        acceleration,
        rpm: transmission.rpm,
        maxRpm: transmission.maxRpm,
        drivingStyle:
          transmission.drivingStyle ?? 0
      },
      getBackgroundAudioSettings()
    );

    const now =
      performance.now();

    if (lastBackgroundGpsAt > 0) {
      const delta =
        now -
        lastBackgroundGpsAt;

      if (delta > 0) {
        backgroundGpsRateHz =
          1000 / delta;
      }
    }

    lastBackgroundGpsAt = now;
    backgroundGpsUpdates++;

    updateDiagnostics();
  }

  function installGpsHook() {
    if (
      !window.VoltuneGps ||
      typeof VoltuneGps.start !== "function" ||
      VoltuneGps.start.__voltuneBackgroundWrapped
    ) {
      return;
    }

    const originalStart =
      VoltuneGps.start.bind(
        VoltuneGps
      );

    const wrappedStart =
      options => {
        const originalOnUpdate =
          options?.onUpdate;

        const wrappedOptions = {
          ...(options || {}),
          onUpdate: data => {
            if (
              typeof originalOnUpdate ===
              "function"
            ) {
              originalOnUpdate(data);
            }

            updateBackgroundGpsSound(
              data
            );
          }
        };

        return originalStart(
          wrappedOptions
        );
      };

    wrappedStart.__voltuneBackgroundWrapped =
      true;

    VoltuneGps.start =
      wrappedStart;
  }

  const TESLA_AUDIO_TEST_URL =
    "sounds/overrun/Firecracker%201.mp3";

  function ensureKeepaliveAudio() {
    if (keepaliveAudio) {
      return keepaliveAudio;
    }

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.id =
      "teslaAudioTestPanel";

    Object.assign(
      wrapper.style,
      {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(82vw, 720px)",
        padding: "20px",
        background: "rgba(10,10,14,.96)",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: "16px",
        boxShadow: "0 18px 70px rgba(0,0,0,.65)",
        zIndex: "2147483647",
        color: "#fff",
        textAlign: "center"
      }
    );

    const title =
      document.createElement(
        "div"
      );

    title.textContent =
      "Tesla Browser Audio Test";

    Object.assign(
      title.style,
      {
        fontSize: "20px",
        fontWeight: "700",
        marginBottom: "14px"
      }
    );

    keepaliveAudio =
      document.createElement(
        "audio"
      );

    keepaliveAudio.src =
      TESLA_AUDIO_TEST_URL;

    keepaliveAudio.loop = true;
    keepaliveAudio.preload = "auto";
    keepaliveAudio.controls = true;
    keepaliveAudio.autoplay = false;
    keepaliveAudio.muted = false;
    keepaliveAudio.volume = 0.25;

    keepaliveAudio.setAttribute(
      "playsinline",
      ""
    );

    Object.assign(
      keepaliveAudio.style,
      {
        display: "block",
        width: "100%",
        minHeight: "54px"
      }
    );

    const hint =
      document.createElement(
        "div"
      );

    hint.textContent =
      "Normaler HTML5-Audioplayer · echte MP3-Datei · keine Tricks";

    Object.assign(
      hint.style,
      {
        marginTop: "12px",
        fontSize: "13px",
        opacity: "0.68"
      }
    );

    wrapper.append(
      title,
      keepaliveAudio,
      hint
    );

    document.body.appendChild(
      wrapper
    );

    keepaliveAudio.addEventListener(
      "playing",
      () => {
        lastLifecycleState =
          "Audio läuft";

        updateDiagnostics();
      }
    );

    keepaliveAudio.addEventListener(
      "pause",
      updateDiagnostics
    );

    keepaliveAudio.addEventListener(
      "ended",
      updateDiagnostics
    );

    keepaliveAudio.addEventListener(
      "error",
      () => {
        lastLifecycleState =
          "Audio-Fehler";

        updateDiagnostics();
      }
    );

    return keepaliveAudio;
  }

  async function resumeVoltuneAudio() {
    if (
      !window.VoltuneAudio ||
      !VoltuneAudio.isStarted()
    ) {
      return;
    }

    try {
      await VoltuneAudio.resume();
    } catch (error) {
      console.warn(
        "Voltune Background: AudioContext konnte nicht fortgesetzt werden:",
        error
      );
    }
  }

  async function refreshBackgroundMedia(
    reason
  ) {
    if (!enabled) {
      return;
    }

    lastLifecycleState = reason;

    const video =
      ensureKeepaliveVideo();

    if (video.paused) {
      try {
        await video.play();
      } catch (error) {
        console.warn(
          "Voltune Background: Video-Test konnte nicht fortgesetzt werden:",
          error
        );
      }
    }

    await resumeVoltuneAudio();

    updateDiagnostics();
  }

  function setMediaSessionState(
    active
  ) {
    if (!("mediaSession" in navigator)) {
      return;
    }

    try {
      if (
        active &&
        "MediaMetadata" in window
      ) {
        navigator.mediaSession.metadata =
          new MediaMetadata({
            title: "Voltune Audio Test",
            artist: "Voltune",
            album: "Tesla Browser Test"
          });
      } else if (!active) {
        navigator.mediaSession.metadata =
          null;
      }

      if (
        "playbackState" in
        navigator.mediaSession
      ) {
        navigator.mediaSession.playbackState =
          active
            ? "playing"
            : "none";
      }
    } catch (error) {
      console.warn(
        "Voltune Background: MediaSession konnte nicht aktualisiert werden:",
        error
      );
    }
  }

  async function enableBackgroundMode() {
    const video =
      ensureKeepaliveVideo();

    // Direkt aus dem Button-Klick starten:
    // ein ganz normales sichtbares Video mit
    // Ton und nativen Controls.
    await video.play();

    enabled = true;
    lastHeartbeatAt =
      performance.now();
    maxHeartbeatGap = 0;
    lastLifecycleState =
      "aktiviert";

    backgroundGpsUpdates = 0;
    backgroundGpsRateHz = 0;
    lastBackgroundGpsAt = 0;
    syncBackgroundGearFromUi();

    setMediaSessionState(true);
    await resumeVoltuneAudio();
    updateDiagnostics();
  }

  function disableBackgroundMode() {
    enabled = false;
    lastLifecycleState =
      "deaktiviert";

    if (keepaliveAudio) {
      keepaliveAudio.pause();

      try {
        keepaliveAudio.currentTime = 0;
      } catch (error) {
        // Manche Browser erlauben currentTime
        // unmittelbar nach pause() noch nicht.
      }

      document
        .getElementById(
          "teslaAudioTestPanel"
        )
        ?.remove();

      keepaliveAudio = null;
    }

    setMediaSessionState(false);
    updateDiagnostics();
  }

  button.addEventListener(
    "click",
    async () => {
      if (enabled) {
        disableBackgroundMode();
        return;
      }

      button.textContent =
        "Background …";

      try {
        await enableBackgroundMode();
      } catch (error) {
        console.error(
          "Voltune Background konnte nicht gestartet werden:",
          error
        );

        enabled = false;
        lastLifecycleState =
          "Start fehlgeschlagen";

        updateDiagnostics();

        alert(
          "Background-Modus konnte nicht gestartet werden. Bitte erneut direkt auf Background tippen."
        );
      }
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      lastLifecycleState =
        document.hidden
          ? "hidden"
          : "visible";

      if (
        enabled &&
        document.hidden
      ) {
        syncBackgroundGearFromUi();
      }

      updateDiagnostics();

      if (
        enabled &&
        !document.hidden
      ) {
        refreshBackgroundMedia(
          "sichtbar"
        );
      }
    }
  );

  window.addEventListener(
    "pageshow",
    () => {
      if (enabled) {
        refreshBackgroundMedia(
          "pageshow"
        );
      }
    }
  );

  document.addEventListener(
    "freeze",
    () => {
      lastLifecycleState =
        "freeze";

      updateDiagnostics();
    }
  );

  document.addEventListener(
    "resume",
    () => {
      if (enabled) {
        refreshBackgroundMedia(
          "resume"
        );
      }
    }
  );

  window.setInterval(
    () => {
      const now =
        performance.now();

      if (enabled) {
        const gap =
          now -
          lastHeartbeatAt;

        // Erwartet sind ungefähr 1 s.
        // Die Differenz selbst ist für den
        // Tesla-Test interessant: Ein großer
        // Wert bedeutet, dass JS im Hintergrund
        // zeitweise eingefroren/gedrosselt wurde.
        maxHeartbeatGap =
          Math.max(
            maxHeartbeatGap,
            gap
          );
      }

      lastHeartbeatAt = now;
      updateDiagnostics();
    },
    1000
  );

  installGpsHook();
  installDiagnostics();
  updateDiagnostics();
})();
