from pathlib import Path

path = Path("voltune-dev/css/voltune.css")
css = path.read_text(encoding="utf-8")
marker = "/* UI-FIX · Kompakte niedrige Seitenleiste */"

if marker in css:
    raise SystemExit("Patch bereits vorhanden")

css += r'''

/* UI-FIX · Kompakte niedrige Seitenleiste */
@media (min-width:761px) and (max-height:650px){
  .sideRail{
    gap:5px;
    overflow-x:hidden;
  }

  .driveHud{
    padding:6px;
  }

  .driveHudInfo{
    gap:3px;
  }

  .driveHudInfo > div{
    padding:4px 5px;
  }

  .driveHudGear.startButtonPending > .gpsStartSlot,
  .gpsStartSlot #gps.mainStartButton{
    min-height:72px;
  }

  .gpsStartSlot #gps.mainStartButton{
    font-size:22px;
  }

  .driveHudRpm{
    padding:5px !important;
  }

  #rpmDisplay{
    font-size:22px;
  }

  .bar{
    height:6px;
    margin-top:5px;
  }

  .runStatus{
    min-height:24px;
    margin-top:5px;
    padding:4px 7px;
    font-size:9px;
  }

  .runStatusDot{
    width:6px;
    height:6px;
    flex-basis:6px;
  }

  .driveModeGroup{
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:4px;
    padding:6px;
  }

  .driveModeTitle{
    grid-column:1 / -1;
    padding-bottom:0;
  }

  .sideRail .driveModeBtn{
    min-width:0;
    min-height:28px;
    padding:0 2px;
    font-size:10px;
    white-space:nowrap;
  }

  .controlGroup{
    gap:3px;
    padding:6px;
  }

  .controlGroupTitle{
    padding-bottom:0;
  }

  .sideButtons{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:4px;
  }

  .sideButtons > #gps.mainStartButton{
    grid-column:1 / -1;
  }

  .sideRail button{
    min-width:0;
    min-height:30px;
    border-radius:8px;
    font-size:11px;
  }

  .controlSubgroup{
    grid-column:1 / -1;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:4px;
    margin-top:2px;
    padding-top:5px;
    min-width:0;
  }

  .controlSubgroupTitle{
    grid-column:1 / -1;
    padding:0 2px;
    font-size:7px;
  }

  .controlSubgroup .featureBtn,
  .controlSubgroup #debug,
  .controlSubgroup #start,
  .controlSubgroup #controller{
    min-width:0;
    min-height:30px;
    padding:0 3px;
    font-size:10px;
  }

  .controlSubgroupSystem{
    margin-top:0;
  }

  #theme{
    white-space:nowrap;
  }
}
'''

path.write_text(css, encoding="utf-8")
