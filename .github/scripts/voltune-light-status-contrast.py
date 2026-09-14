from pathlib import Path

path = Path("voltune-dev/css/voltune.css")
css = path.read_text(encoding="utf-8")
marker = "/* UI-FIX · Light Theme Status-Kontrast */"

if marker in css:
    raise SystemExit("Patch bereits vorhanden")

css += r'''

/* UI-FIX · Light Theme Status-Kontrast */
html[data-theme="light"] #debug{
  background:#dbe9f7;
  color:#17324a;
  border-color:#8fb5da;
}

html[data-theme="light"] body.debugActive #debug{
  background:#2f7fca;
  color:#ffffff;
  border-color:#2569aa;
  box-shadow:
    0 0 0 1px rgba(37,105,170,.10),
    0 0 8px rgba(47,127,202,.18);
}

html[data-theme="light"] .runStatus{
  background:#f2f4f7;
  color:#556272;
  border-color:#c8d2dc;
}

html[data-theme="light"] .runStatusDot{
  background:#7a8796;
  box-shadow:0 0 6px rgba(122,135,150,.22);
}

html[data-theme="light"] .runStatus[data-state="active"]{
  color:#184f35;
  border-color:#82bd99;
  background:#dff2e5;
}

html[data-theme="light"] .runStatus[data-state="active"] .runStatusDot{
  background:#299d66;
  box-shadow:0 0 8px rgba(41,157,102,.30);
}

html[data-theme="light"] .runStatus[data-state="waiting"],
html[data-theme="light"] .runStatus[data-state="starting"]{
  color:#7a4d0f;
  border-color:#d9b06b;
  background:#fff0d8;
}

html[data-theme="light"] .runStatus[data-state="waiting"] .runStatusDot,
html[data-theme="light"] .runStatus[data-state="starting"] .runStatusDot{
  background:#cf7d2e;
  box-shadow:0 0 8px rgba(207,125,46,.28);
}

html[data-theme="light"] .runStatus[data-state="error"],
html[data-theme="light"] .runStatus[data-state="stopped"]{
  color:#8d2222;
  border-color:#d79a9a;
  background:#f8dede;
}

html[data-theme="light"] .runStatus[data-state="error"] .runStatusDot,
html[data-theme="light"] .runStatus[data-state="stopped"] .runStatusDot{
  background:#cf4f4f;
  box-shadow:0 0 8px rgba(207,79,79,.26);
}
'''

path.write_text(css, encoding="utf-8")
