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

  const diagnostics = {
    state: null,
    media: null,
    visibility: null,
    heartbeat: null
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
        "Media Keepalive"
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
        : "Experimentellen Tesla-Background-Modus aktivieren";
  }

  function writeAscii(
    view,
    offset,
    text
  ) {
    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      view.setUint8(
        offset + index,
        text.charCodeAt(index)
      );
    }
  }

  function createKeepaliveBlob() {
    const sampleRate = 8000;
    const durationSeconds = 1;
    const sampleCount =
      sampleRate *
      durationSeconds;

    const bytesPerSample = 2;
    const dataSize =
      sampleCount *
      bytesPerSample;

    const buffer =
      new ArrayBuffer(
        44 + dataSize
      );

    const view =
      new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(
      4,
      36 + dataSize,
      true
    );

    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");

    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(
      28,
      sampleRate * bytesPerSample,
      true
    );
    view.setUint16(
      32,
      bytesPerSample,
      true
    );
    view.setUint16(34, 16, true);

    writeAscii(view, 36, "data");
    view.setUint32(
      40,
      dataSize,
      true
    );

    // Bewusst kein digitales Nullsignal.
    // Ein normaler Sinuston wird mit extrem
    // niedriger HTMLAudio-Lautstärke abgespielt.
    // Dadurch bleibt es eine echte Media-Session,
    // ist aber praktisch unhörbar.
    const frequency = 220;
    const amplitude = 0.08;

    for (
      let sample = 0;
      sample < sampleCount;
      sample++
    ) {
      const value =
        Math.sin(
          sample /
          sampleRate *
          Math.PI *
          2 *
          frequency
        ) *
        amplitude;

      view.setInt16(
        44 +
          sample *
          bytesPerSample,
        Math.round(
          value * 32767
        ),
        true
      );
    }

    return new Blob(
      [buffer],
      {
        type: "audio/wav"
      }
    );
  }

  function ensureKeepaliveAudio() {
    if (keepaliveAudio) {
      return keepaliveAudio;
    }

    keepaliveUrl =
      URL.createObjectURL(
        createKeepaliveBlob()
      );

    keepaliveAudio =
      new Audio();

    keepaliveAudio.src =
      keepaliveUrl;

    keepaliveAudio.loop = true;
    keepaliveAudio.preload = "auto";

    // Nicht muten: Einige Browser behandeln
    // vollständig stumme Medien nicht als aktive
    // Background-Media-Session. Der Quellton wird
    // deshalb stattdessen praktisch unhörbar leise.
    keepaliveAudio.muted = false;
    keepaliveAudio.volume = 0.0001;

    keepaliveAudio.setAttribute(
      "playsinline",
      ""
    );

    keepaliveAudio.addEventListener(
      "playing",
      updateDiagnostics
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
          "Media-Fehler";

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

    const audio =
      ensureKeepaliveAudio();

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.warn(
          "Voltune Background: Media-Keepalive konnte nicht fortgesetzt werden:",
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
    const audio =
      ensureKeepaliveAudio();

    // Muss direkt aus dem Button-Klick kommen,
    // damit auch Browser mit striktem Autoplay-
    // Schutz die Media-Session freigeben.
    await audio.play();

    enabled = true;
    lastHeartbeatAt =
      performance.now();
    maxHeartbeatGap = 0;
    lastLifecycleState =
      "aktiviert";

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

  installDiagnostics();
  updateDiagnostics();
})();
