(() => {
  const button =
    document.getElementById("background");

  if (!button) {
    return;
  }

  let enabled = false;
  let keepaliveVideo = null;
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
        "Video Keepalive"
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
        keepaliveVideo &&
        !keepaliveVideo.paused &&
        !keepaliveVideo.ended
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
        ? `Background aktiv · Video ${
            mediaRunning
              ? "läuft"
              : "pausiert"
          } · JS Max Gap ${(
            maxHeartbeatGap /
            1000
          ).toFixed(1)} s`
        : "Experimentellen Tesla-Background-Modus aktivieren";
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

  const KEEPALIVE_VIDEO_BASE64 =
    "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";

  function createKeepaliveBlob() {
    const binary =
      atob(
        KEEPALIVE_VIDEO_BASE64
      );

    const bytes =
      new Uint8Array(
        binary.length
      );

    for (
      let index = 0;
      index < binary.length;
      index++
    ) {
      bytes[index] =
        binary.charCodeAt(index);
    }

    return new Blob(
      [bytes],
      {
        type: "video/mp4"
      }
    );
  }

  function ensureKeepaliveVideo() {
    if (keepaliveVideo) {
      return keepaliveVideo;
    }

    keepaliveUrl =
      URL.createObjectURL(
        createKeepaliveBlob()
      );

    keepaliveVideo =
      document.createElement(
        "video"
      );

    keepaliveVideo.src =
      keepaliveUrl;

    keepaliveVideo.loop = true;
    keepaliveVideo.preload = "auto";
    keepaliveVideo.controls = false;
    keepaliveVideo.autoplay = false;
    keepaliveVideo.playsInline = true;

    // Echte Audiospur, bewusst nicht gemutet.
    // Das MP4 enthält einen sehr leisen Ton.
    // Die zusätzliche Element-Lautstärke hält
    // ihn praktisch unhörbar, ohne die Session
    // als stummes Medium zu markieren.
    keepaliveVideo.muted = false;
    keepaliveVideo.volume = 0.005;

    keepaliveVideo.setAttribute(
      "playsinline",
      ""
    );

    keepaliveVideo.setAttribute(
      "webkit-playsinline",
      ""
    );

    keepaliveVideo.setAttribute(
      "aria-hidden",
      "true"
    );

    // Nicht display:none und nicht opacity:0:
    // Tesla/Chromium soll einen echten, aktiven
    // Video-Renderer sehen. 2x2 Pixel bei 1 %
    // Deckkraft sind optisch praktisch unsichtbar.
    Object.assign(
      keepaliveVideo.style,
      {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "2px",
        height: "2px",
        opacity: "0.01",
        pointerEvents: "none",
        zIndex: "2147483647"
      }
    );

    document.body.appendChild(
      keepaliveVideo
    );

    keepaliveVideo.addEventListener(
      "playing",
      updateDiagnostics
    );

    keepaliveVideo.addEventListener(
      "pause",
      updateDiagnostics
    );

    keepaliveVideo.addEventListener(
      "ended",
      updateDiagnostics
    );

    keepaliveVideo.addEventListener(
      "error",
      () => {
        lastLifecycleState =
          "Video-Fehler";

        updateDiagnostics();
      }
    );

    return keepaliveVideo;
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
          "Voltune Background: Video-Keepalive konnte nicht fortgesetzt werden:",
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
            title: "Voltune Background",
            artist: "Voltune",
            album: "Drive Sound"
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

    // Muss direkt aus dem Button-Klick kommen,
    // damit auch Browser mit striktem Autoplay-
    // Schutz die Media-Session freigeben.
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

    if (keepaliveVideo) {
      keepaliveVideo.pause();

      try {
        keepaliveVideo.currentTime = 0;
      } catch (error) {
        // Manche Browser erlauben currentTime
        // unmittelbar nach pause() noch nicht.
      }
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
