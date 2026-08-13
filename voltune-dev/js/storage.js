window.VoltuneStorage = (() => {
  const SETTINGS_KEY =
    "voltune.settings.v1";

  function saveSettings(settings) {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );

      return true;

    } catch (error) {
      console.error(
        "Voltune Einstellungen konnten nicht gespeichert werden:",
        error
      );

      return false;
    }
  }

  function loadSettings() {
    try {
      const raw =
        localStorage.getItem(
          SETTINGS_KEY
        );

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);

    } catch (error) {
      console.error(
        "Voltune Einstellungen konnten nicht geladen werden:",
        error
      );

      return null;
    }
  }

  function clearSettings() {
    try {
      localStorage.removeItem(
        SETTINGS_KEY
      );

      return true;

    } catch (error) {
      console.error(
        "Voltune Einstellungen konnten nicht gelöscht werden:",
        error
      );

      return false;
    }
  }

  function hasSettings() {
    return (
      localStorage.getItem(
        SETTINGS_KEY
      ) !== null
    );
  }

  return {
    saveSettings,
    loadSettings,
    clearSettings,
    hasSettings
  };
})();
