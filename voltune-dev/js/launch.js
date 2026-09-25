window.VoltuneLaunch = (() => {
  "use strict";

  const GPS_START_CORRECTION_MS = 100;
  const GPS_READY_MAX_AGE_MS = 2000;
  const NO_START_TIMEOUT_MS = 15000;
  const START_SPEED_EPSILON_KMH = 0.1;

  // Bei jeder Launch-bezogenen Änderung hochzählen.
  // Die Nummer wird direkt auf dem Launch-Test-Button angezeigt.
  const LAUNCH_TEST_VERSION = 2;

  // Vorläufige Fahrzeugdaten für die Leistungsabschätzung.
  // Später können diese Werte als Fahrzeugprofil konfigurierbar werden.
  const VEHICLE_MASS_KG = 1920;
  const ROLLING_COEFFICIENT = 0.011;
  const CDA_M2 = 0.50;
  const AIR_DENSITY_KG_M3 = 1.225;
  const DRIVETRAIN_EFFICIENCY = 0.92;
  const GRAVITY = 9.80665;

  // Optional: Hier kann später ein echtes Countdown-MP3 hinterlegt werden.
  const COUNTDOWN_AUDIO_URL = "";

  let root = null;
  let armStage = null;
  let countdownStage = null;
  let runStage = null;
  let resultStage = null;
  let closeButton = null;
  let startButton = null;
  let testButton = null;
  let muteButton = null;
  let gpsState = null;
  let countNumber = null;
  let speedElement = null;
  let milestone = null;
  let milestoneText = null;
  let chartCanvas = null;

  let stage = "closed";
  let launchMuted = false;
  let externalSetMuted = null;
  let externalOnClose = null;

  let latestGps = null;
  let run = null;
  let countdownToken = 0;

  let simulationActive = false;
  let simulationTimer = null;

  let audioContext = null;
  let countdownBuffer = null;
  let countdownBufferAttempted = false;

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const finite = value =>
    Number.isFinite(Number(value));

  function ensureMarkup() {
    if (root) return;

    root = document.createElement("div");
    root.id = "voltuneLaunch";
    root.className = "voltuneLaunch";
    root.setAttribute("aria-hidden", "true");

    root.innerHTML = [
      '<div class="launchNoise" aria-hidden="true"></div>',
      '<button id="launchClose" class="launchClose" type="button" aria-label="Launch Mode schließen">×</button>',

      '<section id="launchArmStage" class="launchStage launchArmStage">',
        '<div class="launchArmContent">',
          '<div class="launchEyebrow">VOLTUNE PERFORMANCE</div>',
          '<h2 class="launchArmTitle">LAUNCH</h2>',
          '<p class="launchArmSub">Fünf Sekunden Countdown. Bei GO beginnt die GPS-Messung.</p>',
          '<div class="launchArmActions">',
            '<button id="launchStartRun" class="launchStartButton" type="button">Launch starten</button>',
            '<button id="launchTestRun" class="launchTestButton" type="button">Launch Test ' +
            String(LAUNCH_TEST_VERSION).padStart(3, "0") +
          '</button>',
          '</div>',
          '<div id="launchGpsState" class="launchGpsState">GPS wird geprüft …</div>',
        '</div>',
        '<button id="launchMute" class="launchMute" type="button" aria-label="Voltune Ton umschalten" title="Voltune Ton umschalten">🔊</button>',
      '</section>',

      '<section id="launchCountdownStage" class="launchStage launchCountdownStage" aria-live="polite">',
        '<div id="launchCountNumber" class="launchCount">5</div>',
      '</section>',

      '<section id="launchRunStage" class="launchStage launchRunStage">',
        '<div class="launchSpeedTunnel" aria-hidden="true"></div>',
        '<div class="launchRunPulse" aria-hidden="true"></div>',
        '<div id="launchSpeedLines" class="launchSpeedLines" aria-hidden="true"></div>',
        '<div class="launchRunTop">LAUNCH ACTIVE</div>',
        '<div class="launchSpeedWrap">',
          '<div class="launchSpeedLabel">Speed</div>',
          '<div id="launchSpeed" class="launchSpeed">0</div>',
          '<div class="launchSpeedUnit">km/h</div>',
        '</div>',
        '<div id="launchMilestone" class="launchMilestone" aria-hidden="true">',
          '<div id="launchMilestoneText" class="launchMilestoneText">100 KM/H</div>',
        '</div>',
      '</section>',

      '<section id="launchResultStage" class="launchStage launchResultStage">',
        '<div class="launchResultCard">',
          '<div class="launchEyebrow">VOLTUNE PERFORMANCE</div>',
          '<h2 class="launchResultTitle">LAUNCH RESULT</h2>',
          '<div id="launchResultSub" class="launchResultSub">Run abgeschlossen</div>',

          '<div class="launchHero">',
            '<div class="launchMetricLabel">0–100 km/h</div>',
            '<div id="launchResult0100" class="launchHeroValue">—<small>s</small></div>',
          '</div>',

          '<div class="launchMetrics">',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">Reaktionszeit</div>',
              '<div id="launchResultReaction" class="launchMetricValue">—<small>s</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">0–50 km/h</div>',
              '<div id="launchResult050" class="launchMetricValue">—<small>s</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">0–150 km/h</div>',
              '<div id="launchResult0150" class="launchMetricValue">—<small>s</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">0–200 km/h</div>',
              '<div id="launchResult0200" class="launchMetricValue">—<small>s</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">100–200 km/h</div>',
              '<div id="launchResult100200" class="launchMetricValue">—<small>s</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">Top Speed</div>',
              '<div id="launchResultTopSpeed" class="launchMetricValue">—<small>km/h</small></div>',
            '</div>',
            '<div class="launchMetric">',
              '<div class="launchMetricLabel">Max. Beschleunigung</div>',
              '<div id="launchResultMaxG" class="launchMetricValue">—<small>g</small></div>',
            '</div>',
            '<div class="launchMetric launchPowerMetric">',
              '<div class="launchMetricLabel">Geschätzte Max. Leistung</div>',
              '<div id="launchResultPower" class="launchMetricValue">—<small>kW</small></div>',
            '</div>',
            '<div class="launchMetric launchPowerMetric">',
              '<div class="launchMetricLabel">Geschätzte Max. Leistung</div>',
              '<div id="launchResultPs" class="launchMetricValue">—<small>PS</small></div>',
            '</div>',
          '</div>',

          '<div class="launchChartSection">',
            '<div class="launchChartHead">',
              '<div class="launchChartTitle">Performance über Zeit</div>',
              '<div class="launchChartLegend">',
                '<span class="launchLegendItem"><i class="launchLegendDot launchLegendPower"></i>Leistung kW</span>',
                '<span class="launchLegendItem"><i class="launchLegendDot launchLegendAccel"></i>Beschleunigung g</span>',
              '</div>',
            '</div>',
            '<div class="launchChartWrap">',
              '<canvas id="launchChart"></canvas>',
            '</div>',
          '</div>',

          '<div class="launchResultFoot">',
            'GPS-Rohgeschwindigkeit ohne Anzeige-Glättung · Reaktionszeit mit 0,10 s GPS-Startkorrektur · ',
            'Leistung geschätzt mit 1.920 kg, CdA 0,50 m², Crr 0,011 und 92 % Wirkungsgrad',
          '</div>',
        '</div>',
      '</section>'
    ].join("");

    document.body.appendChild(root);

    armStage = root.querySelector("#launchArmStage");
    countdownStage = root.querySelector("#launchCountdownStage");
    runStage = root.querySelector("#launchRunStage");
    resultStage = root.querySelector("#launchResultStage");
    closeButton = root.querySelector("#launchClose");
    startButton = root.querySelector("#launchStartRun");
    testButton = root.querySelector("#launchTestRun");
    muteButton = root.querySelector("#launchMute");
    gpsState = root.querySelector("#launchGpsState");
    countNumber = root.querySelector("#launchCountNumber");
    speedElement = root.querySelector("#launchSpeed");
    milestone = root.querySelector("#launchMilestone");
    milestoneText = root.querySelector("#launchMilestoneText");
    chartCanvas = root.querySelector("#launchChart");

    closeButton.addEventListener("click", close);

    startButton.addEventListener(
      "click",
      () => {
        stopSimulation();
        simulationActive = false;
        startCountdown();
      }
    );

    testButton.addEventListener(
      "click",
      () => {
        stopSimulation();
        simulationActive = true;
        startCountdown();
      }
    );

    muteButton.addEventListener("click", toggleMute);

    createSpeedLines();
  }

  function createSpeedLines() {
    const container = root.querySelector("#launchSpeedLines");
    container.innerHTML = "";

    for (let index = 0; index < 46; index += 1) {
      const line = document.createElement("i");
      line.className = "launchSpeedLine";

      const rotation =
        (360 / 46) * index +
        (Math.random() * 4 - 2);

      line.style.setProperty(
        "--launch-line-rotation",
        rotation.toFixed(2) + "deg"
      );

      line.style.setProperty(
        "--launch-line-length",
        Math.round(75 + Math.random() * 195) + "px"
      );

      line.style.setProperty(
        "--launch-line-duration",
        (0.30 + Math.random() * 0.40).toFixed(3) + "s"
      );

      line.style.setProperty(
        "--launch-line-delay",
        (-Math.random() * 0.8).toFixed(3) + "s"
      );

      line.style.setProperty(
        "--launch-line-opacity",
        (0.16 + Math.random() * 0.50).toFixed(2)
      );

      container.appendChild(line);
    }
  }

  function setStage(nextStage) {
    stage = nextStage;

    const mapping = [
      [armStage, "arm"],
      [countdownStage, "countdown"],
      [runStage, "run"],
      [resultStage, "result"]
    ];

    mapping.forEach(entry => {
      entry[0].classList.toggle(
        "isActive",
        entry[1] === nextStage
      );
    });

    closeButton.hidden =
      nextStage === "countdown" ||
      nextStage === "run";
  }

  function isGpsFresh() {
    return Boolean(
      latestGps &&
      finite(latestGps.timestamp) &&
      performance.now() - latestGps.timestamp <= GPS_READY_MAX_AGE_MS
    );
  }

  function updateArmState() {
    if (!root || stage !== "arm") return;

    const fresh = isGpsFresh();
    const speed =
      latestGps && finite(latestGps.speedKmh)
        ? Number(latestGps.speedKmh)
        : 0;

    const rate =
      latestGps && finite(latestGps.rateHz)
        ? Number(latestGps.rateHz)
        : 0;

    if (!fresh) {
      startButton.disabled = true;
      gpsState.className = "launchGpsState isWarn";
      gpsState.textContent = "Warte auf frische GPS-Daten · Launch Test jederzeit möglich";
      return;
    }

    if (speed >= 3) {
      startButton.disabled = true;
      gpsState.className = "launchGpsState isWarn";
      gpsState.textContent =
        "Für Launch zuerst anhalten · GPS " +
        rate.toFixed(1) +
        " Hz · Launch Test möglich";
      return;
    }

    startButton.disabled = false;
    gpsState.className = "launchGpsState isReady";
    gpsState.textContent =
      "GPS bereit · " +
      rate.toFixed(1) +
      " Hz · " +
      Math.round(speed) +
      " km/h";
  }

  function updateMuteButton() {
    if (!muteButton) return;

    muteButton.classList.toggle(
      "isMuted",
      launchMuted
    );

    muteButton.textContent =
      launchMuted
        ? "🔇"
        : "🔊";

    muteButton.setAttribute(
      "aria-label",
      launchMuted
        ? "Voltune Ton einschalten"
        : "Voltune stummschalten"
    );

    muteButton.title =
      launchMuted
        ? "Voltune Ton einschalten"
        : "Voltune stummschalten";
  }

  function toggleMute() {
    launchMuted = !launchMuted;
    updateMuteButton();

    if (typeof externalSetMuted === "function") {
      externalSetMuted(launchMuted);
    }
  }

  async function ensureAudioContext() {
    if (!audioContext || audioContext.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      audioContext =
        new AudioContextClass();
    }

    if (audioContext.state !== "running") {
      try {
        await audioContext.resume();
      } catch (error) {
        console.warn(
          "Launch Audio konnte nicht gestartet werden:",
          error
        );
      }
    }

    return audioContext;
  }

  async function loadCountdownBuffer() {
    if (
      !COUNTDOWN_AUDIO_URL ||
      countdownBuffer ||
      countdownBufferAttempted
    ) {
      return countdownBuffer;
    }

    countdownBufferAttempted = true;

    try {
      const context =
        await ensureAudioContext();

      if (!context) return null;

      const response =
        await fetch(
          COUNTDOWN_AUDIO_URL,
          { cache: "no-store" }
        );

      if (!response.ok) {
        throw new Error(
          "HTTP " + response.status
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      countdownBuffer =
        await context.decodeAudioData(
          arrayBuffer
        );
    } catch (error) {
      console.warn(
        "Launch Countdown-MP3 nicht verfügbar, synthetischer Countdown wird verwendet:",
        error
      );
    }

    return countdownBuffer;
  }

  async function playChargeSound() {
    const context =
      await ensureAudioContext();

    if (!context) return;

    const now = context.currentTime;
    const oscillator =
      context.createOscillator();
    const gain =
      context.createGain();
    const filter =
      context.createBiquadFilter();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(
      72,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      230,
      now + 0.78
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      420,
      now
    );

    filter.frequency.linearRampToValueAtTime(
      1200,
      now + 0.78
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      0.025,
      now + 0.12
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.82
    );

    oscillator
      .connect(filter)
      .connect(gain)
      .connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.84);
  }

  async function playSyntheticCount(isGo) {
    const context =
      await ensureAudioContext();

    if (!context) return;

    const now = context.currentTime;
    const oscillator =
      context.createOscillator();
    const gain =
      context.createGain();

    oscillator.type =
      isGo
        ? "square"
        : "sine";

    oscillator.frequency.setValueAtTime(
      isGo ? 920 : 440,
      now
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      isGo ? 0.12 : 0.075,
      now + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (isGo ? 0.34 : 0.15)
    );

    oscillator
      .connect(gain)
      .connect(context.destination);

    oscillator.start(now);
    oscillator.stop(
      now + (isGo ? 0.36 : 0.17)
    );
  }

  async function playCountdownAudio(isGo) {
    const buffer =
      await loadCountdownBuffer();

    // Ein später geliefertes Countdown-MP3 kann den
    // synthetischen Ton komplett ersetzen.
    if (buffer && isGo) {
      const context =
        await ensureAudioContext();

      if (context) {
        const source =
          context.createBufferSource();

        source.buffer = buffer;
        source.connect(
          context.destination
        );
        source.start();
        return;
      }
    }

    await playSyntheticCount(isGo);
  }

  function wait(ms) {
    return new Promise(resolve => {
      window.setTimeout(
        resolve,
        ms
      );
    });
  }

  async function showCount(value, isGo, token) {
    if (
      token !== countdownToken ||
      stage !== "countdown"
    ) {
      return false;
    }

    countNumber.textContent =
      String(value);

    countNumber.classList.remove(
      "isPop",
      "isGo"
    );

    void countNumber.offsetWidth;

    if (isGo) {
      countNumber.classList.add(
        "isGo"
      );
    }

    countNumber.classList.add(
      "isPop"
    );

    void playCountdownAudio(isGo);

    await wait(
      isGo ? 360 : 1000
    );

    return (
      token === countdownToken &&
      stage === "countdown"
    );
  }

  async function startCountdown() {
    if (
      stage !== "arm" ||
      (
        !simulationActive &&
        startButton.disabled
      )
    ) {
      return;
    }

    await ensureAudioContext();

    if (simulationActive) {
      latestGps = {
        speedKmh: 0,
        timestamp: performance.now(),
        rateHz: 10
      };
    }

    const token =
      ++countdownToken;

    setStage("countdown");
    void playChargeSound();

    await wait(460);

    for (
      let number = 5;
      number >= 1;
      number -= 1
    ) {
      const valid =
        await showCount(
          number,
          false,
          token
        );

      if (!valid) return;
    }

    if (
      token !== countdownToken ||
      stage !== "countdown"
    ) {
      return;
    }

    // GO ist der absolute Zeitnullpunkt der Messung.
    beginRun();

    if (simulationActive) {
      startSimulation();
    }

    const valid =
      await showCount(
        "GO",
        true,
        token
      );

    if (!valid) return;

    if (
      token === countdownToken &&
      stage === "countdown"
    ) {
      setStage("run");
    }
  }

  function createRunState() {
    return {
      goTime: performance.now(),
      simulated: simulationActive,
      samples: [],
      previousSample: null,
      lastStationarySample: null,
      movementStartTime: null,
      movementStartGpsTime: null,
      reactionSeconds: null,
      crossings: {
        50: null,
        100: null,
        150: null,
        200: null
      },
      topSpeedKmh: 0,
      reached100: false,
      reached200: false,
      belowEndCount: 0,
      incompleteStopCount: 0,
      finished: false
    };
  }

  function beginRun() {
    run =
      createRunState();

    const armedRun = run;

    // Sicherheitsnetz: Sollte GPS während des Runs komplett ausfallen,
    // bleibt der Vollbildmodus nicht dauerhaft hängen.
    window.setTimeout(
      () => {
        if (
          run === armedRun &&
          !run.finished &&
          (
            stage === "countdown" ||
            stage === "run"
          )
        ) {
          run = null;
          setStage("arm");
          gpsState.className = "launchGpsState isWarn";
          gpsState.textContent = "Run abgebrochen · GPS prüfen";
          updateArmState();
        }
      },
      60000
    );

    speedElement.textContent = "0";

    if (
      isGpsFresh() &&
      latestGps &&
      finite(latestGps.speedKmh)
    ) {
      const initial = {
        t: run.goTime,
        speedKmh: Number(
          latestGps.speedKmh
        )
      };

      run.previousSample =
        initial;

      if (
        initial.speedKmh <=
        START_SPEED_EPSILON_KMH
      ) {
        run.lastStationarySample =
          initial;
      }
    }
  }

  function interpolateCrossing(
    previous,
    current,
    threshold
  ) {
    if (
      !previous ||
      !current ||
      previous.speedKmh ===
        current.speedKmh
    ) {
      return current
        ? current.t
        : null;
    }

    const ratio =
      clamp(
        (
          threshold -
          previous.speedKmh
        ) /
        (
          current.speedKmh -
          previous.speedKmh
        ),
        0,
        1
      );

    return (
      previous.t +
      (
        current.t -
        previous.t
      ) *
      ratio
    );
  }

  function markMovementStart(
    previous,
    current
  ) {
    if (
      !run ||
      run.movementStartTime != null ||
      current.speedKmh <=
        START_SPEED_EPSILON_KMH
    ) {
      return;
    }

    let estimated =
      current.t;

    const stationary =
      run.lastStationarySample ||
      (
        previous &&
        previous.speedKmh <=
          START_SPEED_EPSILON_KMH
          ? previous
          : null
      );

    if (stationary) {
      estimated =
        stationary.t +
        (
          current.t -
          stationary.t
        ) *
        0.5;
    }

    // Für reine GPS-Zeitintervalle bleibt der unkorrigierte
    // GPS-Zeitpunkt erhalten. Dadurch kürzt sich eine konstante
    // GPS-Latenz bei 0–100, 0–200 usw. automatisch heraus.
    run.movementStartGpsTime =
      estimated;

    const correctedStart =
      clamp(
        estimated -
          GPS_START_CORRECTION_MS,
        run.goTime,
        current.t
      );

    // Nur die Reaktionszeit bezieht GPS auf den lokalen GO-Zeitpunkt
    // und erhält deshalb die angenommene Startlatenz-Korrektur.
    run.movementStartTime =
      correctedStart;

    run.reactionSeconds =
      Math.max(
        0,
        (
          correctedStart -
          run.goTime
        ) /
        1000
      );
  }

  function processCrossing(
    previous,
    current,
    threshold
  ) {
    if (
      !run ||
      run.crossings[threshold] != null ||
      !previous
    ) {
      return;
    }

    if (
      previous.speedKmh <
        threshold &&
      current.speedKmh >=
        threshold
    ) {
      run.crossings[threshold] =
        interpolateCrossing(
          previous,
          current,
          threshold
        );

      if (threshold === 100) {
        run.reached100 = true;
        flashMilestone(100);
      }

      if (threshold === 200) {
        run.reached200 = true;
        flashMilestone(200);
      }
    }
  }

  function flashMilestone(value) {
    if (!milestone) return;

    milestoneText.textContent =
      value + " KM/H";

    milestone.classList.remove(
      "isFlash"
    );

    void milestone.offsetWidth;

    milestone.classList.add(
      "isFlash"
    );
  }

  function processRunEnd(
    previous,
    current
  ) {
    if (!run || run.finished) return;

    const endThreshold =
      run.reached200
        ? 200
        : run.reached100
          ? 100
          : null;

    if (endThreshold != null) {
      const below =
        current.speedKmh <
        endThreshold;

      const falling =
        !previous ||
        current.speedKmh <=
          previous.speedKmh + 0.20;

      if (below && falling) {
        run.belowEndCount += 1;
      } else {
        run.belowEndCount = 0;
      }

      if (run.belowEndCount >= 2) {
        finishRun(false);
      }

      return;
    }

    // Abgebrochener Versuch vor 100 km/h:
    // sobald wirklich beschleunigt wurde und danach
    // wieder fast Stillstand herrscht, Ergebnis zeigen.
    if (
      run.movementStartTime != null &&
      run.topSpeedKmh >= 10 &&
      current.speedKmh < 3 &&
      (
        !previous ||
        current.speedKmh <=
          previous.speedKmh + 0.20
      )
    ) {
      run.incompleteStopCount += 1;
    } else {
      run.incompleteStopCount = 0;
    }

    if (
      run.incompleteStopCount >= 2
    ) {
      finishRun(true);
      return;
    }

    // Kein Start nach GO:
    // nach 15 Sekunden zurück zur Launch-Bereitschaft.
    if (
      run.movementStartTime == null &&
      current.t -
        run.goTime >=
        NO_START_TIMEOUT_MS
    ) {
      run = null;
      setStage("arm");

      gpsState.className =
        "launchGpsState isWarn";

      gpsState.textContent =
        "Kein Start erkannt · erneut bereit";

      updateArmState();
    }
  }

  function simulatedSpeedAt(seconds) {
    const keyframes = [
      [0.0, 0],
      [0.4, 0],
      [0.5, 3],
      [1.0, 15],
      [1.5, 29],
      [2.0, 45],
      [2.5, 59],
      [3.0, 72],
      [3.5, 84],
      [4.0, 96],
      [4.2, 101],
      [5.0, 121],
      [6.0, 142],
      [7.0, 159],
      [8.0, 175],
      [9.0, 188],
      [9.8, 198],
      [10.0, 201],
      [10.8, 210],
      [11.4, 216],
      [12.0, 216],
      [12.5, 210],
      [13.0, 203],
      [13.3, 199],
      [13.6, 195]
    ];

    for (
      let index = 0;
      index < keyframes.length - 1;
      index += 1
    ) {
      const current =
        keyframes[index];

      const next =
        keyframes[index + 1];

      if (seconds <= next[0]) {
        const duration =
          next[0] - current[0];

        const progress =
          duration > 0
            ? clamp(
                (
                  seconds -
                  current[0]
                ) /
                duration,
                0,
                1
              )
            : 1;

        return (
          current[1] +
          (
            next[1] -
            current[1]
          ) *
          progress
        );
      }
    }

    return keyframes[
      keyframes.length - 1
    ][1];
  }

  function stopSimulation() {
    if (simulationTimer != null) {
      window.clearInterval(
        simulationTimer
      );
    }

    simulationTimer = null;
  }

  function startSimulation() {
    stopSimulation();

    if (!run) return;

    const simulatedRun =
      run;

    const emit = () => {
      if (
        !simulationActive ||
        run !== simulatedRun ||
        run.finished ||
        (
          stage !== "countdown" &&
          stage !== "run"
        )
      ) {
        stopSimulation();
        return;
      }

      const now =
        performance.now();

      const elapsed =
        Math.max(
          0,
          (
            now -
            run.goTime
          ) /
          1000
        );

      feedGps({
        speedKmh:
          Math.round(
            simulatedSpeedAt(
              elapsed
            )
          ),
        timestamp: now,
        rateHz: 10,
        simulated: true
      });

      if (elapsed > 14.5) {
        stopSimulation();
      }
    };

    emit();

    simulationTimer =
      window.setInterval(
        emit,
        100
      );
  }

  function feedGps(data = {}) {
    if (
      simulationActive &&
      !data.simulated
    ) {
      return;
    }

    const speedKmh =
      finite(data.speedKmh)
        ? Math.max(
            0,
            Number(data.speedKmh)
          )
        : 0;

    const timestamp =
      finite(data.timestamp)
        ? Number(data.timestamp)
        : performance.now();

    const rateHz =
      finite(data.rateHz)
        ? Math.max(
            0,
            Number(data.rateHz)
          )
        : 0;

    latestGps = {
      speedKmh,
      timestamp,
      rateHz
    };

    if (stage === "arm") {
      updateArmState();
      return;
    }

    if (
      !run ||
      run.finished ||
      (
        stage !== "countdown" &&
        stage !== "run"
      )
    ) {
      return;
    }

    // Countdown vor GO wird nicht aufgezeichnet.
    if (timestamp < run.goTime) {
      return;
    }

    const current = {
      t: timestamp,
      speedKmh
    };

    if (
      run.previousSample &&
      current.t <=
        run.previousSample.t
    ) {
      return;
    }

    run.samples.push(current);
    run.topSpeedKmh =
      Math.max(
        run.topSpeedKmh,
        speedKmh
      );

    if (stage === "run") {
      speedElement.textContent =
        String(
          Math.round(
            speedKmh
          )
        );
    }

    const previous =
      run.previousSample;

    if (
      speedKmh <=
      START_SPEED_EPSILON_KMH
    ) {
      run.lastStationarySample =
        current;
    }

    markMovementStart(
      previous,
      current
    );

    [50, 100, 150, 200]
      .forEach(threshold => {
        processCrossing(
          previous,
          current,
          threshold
        );
      });

    processRunEnd(
      previous,
      current
    );

    if (run && !run.finished) {
      run.previousSample =
        current;
    }
  }

  function regressionAcceleration(
    samples,
    index
  ) {
    const center =
      samples[index].t;

    const windowMs = 280;
    const points = [];

    for (
      let pointIndex = 0;
      pointIndex < samples.length;
      pointIndex += 1
    ) {
      const point =
        samples[pointIndex];

      if (
        Math.abs(
          point.t -
          center
        ) <=
        windowMs
      ) {
        points.push(point);
      }
    }

    if (points.length < 2) {
      return 0;
    }

    let sumT = 0;
    let sumV = 0;

    points.forEach(point => {
      sumT +=
        (point.t - center) /
        1000;

      sumV +=
        point.speedKmh /
        3.6;
    });

    const meanT =
      sumT /
      points.length;

    const meanV =
      sumV /
      points.length;

    let numerator = 0;
    let denominator = 0;

    points.forEach(point => {
      const time =
        (point.t - center) /
        1000;

      const velocity =
        point.speedKmh /
        3.6;

      const timeDelta =
        time - meanT;

      numerator +=
        timeDelta *
        (
          velocity -
          meanV
        );

      denominator +=
        timeDelta *
        timeDelta;
    });

    if (denominator < 0.000001) {
      return 0;
    }

    return clamp(
      numerator /
      denominator,
      -12,
      15
    );
  }

  function buildPerformanceSeries() {
    if (
      !run ||
      run.samples.length < 2
    ) {
      return [];
    }

    return run.samples.map(
      (sample, index) => {
        const acceleration =
          regressionAcceleration(
            run.samples,
            index
          );

        const velocity =
          sample.speedKmh /
          3.6;

        const rollingForce =
          VEHICLE_MASS_KG *
          GRAVITY *
          ROLLING_COEFFICIENT;

        const aeroForce =
          0.5 *
          AIR_DENSITY_KG_M3 *
          CDA_M2 *
          velocity *
          velocity;

        const accelerationForce =
          VEHICLE_MASS_KG *
          acceleration;

        const tractiveForce =
          Math.max(
            0,
            accelerationForce +
            rollingForce +
            aeroForce
          );

        const powerKw =
          velocity > 0
            ? (
                tractiveForce *
                velocity
              ) /
              DRIVETRAIN_EFFICIENCY /
              1000
            : 0;

        return {
          timeSeconds:
            (
              sample.t -
              run.goTime
            ) /
            1000,
          speedKmh:
            sample.speedKmh,
          acceleration,
          accelerationG:
            acceleration /
            GRAVITY,
          powerKw:
            clamp(
              powerKw,
              0,
              1200
            )
        };
      }
    );
  }

  function runTimeTo(threshold) {
    if (
      !run ||
      run.movementStartGpsTime == null ||
      run.crossings[threshold] == null
    ) {
      return null;
    }

    return Math.max(
      0,
      (
        run.crossings[threshold] -
        run.movementStartGpsTime
      ) /
      1000
    );
  }

  function formatTime(
    value,
    decimals = 2
  ) {
    if (!finite(value)) {
      return "—";
    }

    return Number(value)
      .toFixed(decimals)
      .replace(".", ",");
  }

  function setResultMetric(
    id,
    value,
    unit,
    decimals = 2,
    prefix = ""
  ) {
    const element =
      root.querySelector(
        "#" + id
      );

    if (!element) return;

    const display =
      finite(value)
        ? prefix +
          formatTime(
            Number(value),
            decimals
          )
        : "—";

    element.innerHTML =
      display +
      "<small>" +
      unit +
      "</small>";
  }

  function populateResult(
    incomplete
  ) {
    const series =
      buildPerformanceSeries();

    const maxAcceleration =
      series.reduce(
        (max, point) =>
          Math.max(
            max,
            point.acceleration
          ),
        0
      );

    const maxPowerKw =
      series.reduce(
        (max, point) =>
          Math.max(
            max,
            point.powerKw
          ),
        0
      );

    const maxPowerPs =
      maxPowerKw *
      1.3596216173;

    const time0100 =
      runTimeTo(100);

    const time050 =
      runTimeTo(50);

    const time0150 =
      runTimeTo(150);

    const time0200 =
      runTimeTo(200);

    const time100200 =
      (
        run.crossings[100] != null &&
        run.crossings[200] != null
      )
        ? (
            run.crossings[200] -
            run.crossings[100]
          ) /
          1000
        : null;

    setResultMetric(
      "launchResult0100",
      time0100,
      "s",
      2
    );

    setResultMetric(
      "launchResultReaction",
      run.reactionSeconds,
      "s",
      1,
      run.reactionSeconds != null
        ? "≈ "
        : ""
    );

    setResultMetric(
      "launchResult050",
      time050,
      "s",
      2
    );

    setResultMetric(
      "launchResult0150",
      time0150,
      "s",
      2
    );

    setResultMetric(
      "launchResult0200",
      time0200,
      "s",
      2
    );

    setResultMetric(
      "launchResult100200",
      time100200,
      "s",
      2
    );

    setResultMetric(
      "launchResultTopSpeed",
      run.topSpeedKmh,
      "km/h",
      0
    );

    setResultMetric(
      "launchResultMaxG",
      maxAcceleration /
        GRAVITY,
      "g",
      2
    );

    setResultMetric(
      "launchResultPower",
      maxPowerKw,
      "kW",
      0
    );

    setResultMetric(
      "launchResultPs",
      maxPowerPs,
      "PS",
      0
    );

    const resultSub =
      root.querySelector(
        "#launchResultSub"
      );

    const resultPrefix =
      run.simulated
        ? "Testlauf · "
        : "";

    resultSub.textContent =
      resultPrefix +
      (
        incomplete
          ? "Run beendet · Zielgeschwindigkeit nicht erreicht"
          : run.reached200
            ? "200-km/h-Run abgeschlossen"
            : "100-km/h-Run abgeschlossen"
      );

    window.requestAnimationFrame(
      () => {
        drawResultChart(
          series
        );
      }
    );
  }

  function finishRun(incomplete) {
    if (
      !run ||
      run.finished
    ) {
      return;
    }

    run.finished = true;
    stopSimulation();
    setStage("result");
    populateResult(incomplete);
  }

  function resizeCanvasForDisplay(
    canvas
  ) {
    const rect =
      canvas.getBoundingClientRect();

    const ratio =
      clamp(
        window.devicePixelRatio || 1,
        1,
        2
      );

    const width =
      Math.max(
        1,
        Math.round(
          rect.width *
          ratio
        )
      );

    const height =
      Math.max(
        1,
        Math.round(
          rect.height *
          ratio
        )
      );

    if (
      canvas.width !== width ||
      canvas.height !== height
    ) {
      canvas.width = width;
      canvas.height = height;
    }

    return {
      width,
      height,
      ratio
    };
  }

  function drawResultChart(series) {
    if (
      !chartCanvas ||
      !series.length
    ) {
      return;
    }

    const context =
      chartCanvas.getContext("2d");

    if (!context) return;

    const size =
      resizeCanvasForDisplay(
        chartCanvas
      );

    const width =
      size.width;

    const height =
      size.height;

    const ratio =
      size.ratio;

    context.clearRect(
      0,
      0,
      width,
      height
    );

    const padLeft =
      48 * ratio;

    const padRight =
      44 * ratio;

    const padTop =
      22 * ratio;

    const padBottom =
      35 * ratio;

    const plotWidth =
      Math.max(
        1,
        width -
        padLeft -
        padRight
      );

    const plotHeight =
      Math.max(
        1,
        height -
        padTop -
        padBottom
      );

    const maxTime =
      Math.max(
        1,
        series[
          series.length - 1
        ].timeSeconds
      );

    const maxPower =
      Math.max(
        50,
        ...series.map(
          point =>
            point.powerKw
        )
      );

    const maxAbsG =
      Math.max(
        0.5,
        ...series.map(
          point =>
            Math.abs(
              point.accelerationG
            )
        )
      );

    const xForTime =
      time =>
        padLeft +
        clamp(
          time /
          maxTime,
          0,
          1
        ) *
        plotWidth;

    const yForPower =
      value =>
        padTop +
        (
          1 -
          clamp(
            value /
            maxPower,
            0,
            1
          )
        ) *
        plotHeight;

    const yForG =
      value => {
        const normalized =
          clamp(
            value /
            maxAbsG,
            -1,
            1
          );

        return (
          padTop +
          plotHeight *
          (
            0.5 -
            normalized *
            0.5
          )
        );
      };

    context.lineWidth =
      1 * ratio;

    context.strokeStyle =
      "rgba(255,255,255,.08)";

    context.fillStyle =
      "rgba(238,243,248,.48)";

    context.font =
      Math.round(
        10 * ratio
      ) +
      "px system-ui";

    context.textBaseline =
      "middle";

    for (
      let line = 0;
      line <= 4;
      line += 1
    ) {
      const y =
        padTop +
        plotHeight *
        line /
        4;

      context.beginPath();
      context.moveTo(
        padLeft,
        y
      );

      context.lineTo(
        padLeft +
        plotWidth,
        y
      );

      context.stroke();
    }

    const timeStep =
      maxTime <= 8
        ? 2
        : maxTime <= 16
          ? 4
          : 5;

    for (
      let time = 0;
      time <= maxTime + 0.001;
      time += timeStep
    ) {
      const x =
        xForTime(time);

      context.beginPath();
      context.moveTo(
        x,
        padTop
      );

      context.lineTo(
        x,
        padTop +
        plotHeight
      );

      context.stroke();

      context.textAlign =
        "center";

      context.fillText(
        time.toFixed(0) + " s",
        x,
        height -
        14 * ratio
      );
    }

    const markerDefinitions = [
      [100, run.crossings[100]],
      [200, run.crossings[200]]
    ];

    markerDefinitions.forEach(
      entry => {
        if (entry[1] == null) {
          return;
        }

        const time =
          (
            entry[1] -
            run.goTime
          ) /
          1000;

        const x =
          xForTime(time);

        context.save();

        context.setLineDash([
          4 * ratio,
          4 * ratio
        ]);

        context.strokeStyle =
          "rgba(255,153,99,.48)";

        context.beginPath();
        context.moveTo(
          x,
          padTop
        );

        context.lineTo(
          x,
          padTop +
          plotHeight
        );

        context.stroke();

        context.restore();

        context.fillStyle =
          "rgba(255,190,150,.82)";

        context.textAlign =
          "center";

        context.fillText(
          entry[0] + " km/h",
          x,
          padTop +
          10 * ratio
        );
      }
    );

    context.textAlign = "left";
    context.fillStyle =
      "rgba(255,118,82,.80)";

    context.fillText(
      Math.round(
        maxPower
      ) + " kW",
      5 * ratio,
      padTop +
      8 * ratio
    );

    context.textAlign = "right";
    context.fillStyle =
      "rgba(238,243,248,.72)";

    context.fillText(
      maxAbsG.toFixed(2) + " g",
      width -
      5 * ratio,
      padTop +
      8 * ratio
    );

    function drawSeries(
      getter,
      yMapper,
      strokeStyle,
      lineWidth
    ) {
      context.beginPath();

      series.forEach(
        (point, index) => {
          const x =
            xForTime(
              point.timeSeconds
            );

          const y =
            yMapper(
              getter(point)
            );

          if (index === 0) {
            context.moveTo(
              x,
              y
            );
          } else {
            context.lineTo(
              x,
              y
            );
          }
        }
      );

      context.strokeStyle =
        strokeStyle;

      context.lineWidth =
        lineWidth *
        ratio;

      context.lineJoin =
        "round";

      context.lineCap =
        "round";

      context.stroke();
    }

    drawSeries(
      point =>
        point.powerKw,
      yForPower,
      "rgba(255,105,79,.96)",
      2.2
    );

    drawSeries(
      point =>
        point.accelerationG,
      yForG,
      "rgba(238,243,248,.88)",
      1.7
    );
  }

  function open(options = {}) {
    ensureMarkup();

    countdownToken += 1;
    stopSimulation();
    simulationActive = false;
    run = null;

    launchMuted =
      Boolean(
        options.initialMuted
      );

    externalSetMuted =
      typeof options.setMuted ===
        "function"
        ? options.setMuted
        : null;

    externalOnClose =
      typeof options.onClose ===
        "function"
        ? options.onClose
        : null;

    latestGps = null;

    if (
      options.gpsReady &&
      finite(options.speedKmh)
    ) {
      latestGps = {
        speedKmh:
          Math.max(
            0,
            Number(
              options.speedKmh
            )
          ),
        timestamp:
          performance.now(),
        rateHz:
          finite(options.rateHz)
            ? Math.max(
                0,
                Number(
                  options.rateHz
                )
              )
            : 0
      };
    }

    updateMuteButton();

    root.classList.add(
      "isOpen"
    );

    root.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "launchModeActive"
    );

    setStage("arm");
    updateArmState();
  }

  function close() {
    if (!root) return;

    countdownToken += 1;
    stopSimulation();
    simulationActive = false;
    run = null;

    root.classList.remove(
      "isOpen"
    );

    root.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "launchModeActive"
    );

    stage = "closed";

    const onClose =
      externalOnClose;

    externalSetMuted = null;
    externalOnClose = null;

    if (
      typeof onClose ===
      "function"
    ) {
      onClose();
    }
  }

  function isActive() {
    return (
      stage !== "closed"
    );
  }

  function getState() {
    return {
      active:
        isActive(),
      stage,
      muted:
        launchMuted,
      simulated:
        simulationActive,
      gps:
        latestGps
          ? { ...latestGps }
          : null,
      run:
        run
          ? {
              goTime:
                run.goTime,
              reactionSeconds:
                run.reactionSeconds,
              topSpeedKmh:
                run.topSpeedKmh,
              crossings:
                { ...run.crossings },
              sampleCount:
                run.samples.length,
              reached100:
                run.reached100,
              reached200:
                run.reached200
            }
          : null
    };
  }

  window.setInterval(
    () => {
      if (stage === "arm") {
        updateArmState();
      }
    },
    350
  );

  window.addEventListener(
    "resize",
    () => {
      if (
        stage === "result" &&
        run &&
        run.finished
      ) {
        drawResultChart(
          buildPerformanceSeries()
        );
      }
    }
  );

  return {
    open,
    close,
    feedGps,
    isActive,
    getState
  };
})();
