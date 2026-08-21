window.VoltuneStartup = (() => {
  const overlay =
    document.getElementById(
      "startupOverlay"
    );

  let finished = false;

  function removeOverlay() {
    if (!overlay) {
      return;
    }

    overlay.remove();
  }

  function finish(
    animationsEnabled = true
  ) {
    if (
      finished ||
      !overlay
    ) {
      return;
    }

    finished = true;


    // =========================
    // Animationen ausgeschaltet
    // =========================
    //
    // Kein Logo / Ring / Effekt.
    // Nur die dunkle, unscharfe
    // Startabdeckung weich lösen.

    if (!animationsEnabled) {
      overlay.classList.add(
        "startupSimpleExit"
      );

      setTimeout(
        removeOverlay,
        500
      );

      return;
    }


    // =========================
    // Vollständige Startanimation
    // =========================

    overlay.classList.add(
      "startupRunning"
    );


    // Nach dem eigentlichen Boot-Effekt
    // Dunkelheit und Unschärfe lösen.
    setTimeout(
      () => {
        overlay.classList.add(
          "startupExit"
        );
      },
      950
    );


    // Overlay danach komplett aus dem DOM
    // entfernen. So kostet es während der
    // Fahrt keinerlei Ressourcen mehr.
    setTimeout(
      removeOverlay,
      1600
    );
  }

  return {
    finish
  };
})();
