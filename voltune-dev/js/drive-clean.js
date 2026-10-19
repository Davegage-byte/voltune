/* Voltune Drive v0.1 · read-only cockpit presentation.
 * Uses the real voltune-dev app engine, GPS, drivetrain and sidebar.
 * Does not create a second GPS tracker or AudioContext.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const shell=$("cleanCockpit");
 if(!shell)return;
 const source={speed:$("speed"),gear:$("gearDisplay"),rpm:$("rpmDisplay"),
  accel:$("accel"),runStatus:$("runStatus"),runStatusText:$("runStatusText")};
 const display={speed:$("cleanSpeed"),gear:$("cleanGear"),rpm:$("cleanRpm"),
  rpmFill:$("cleanRpmFill"),accelFill:$("cleanAccelFill"),
  brakeFill:$("cleanBrakeFill"),accelValue:$("cleanAccelValue"),
  brakeValue:$("cleanBrakeValue"),state:$("cleanState"),
  runStatus:$("cleanRunStatus"),mode:$("cleanMode")};
 const toggle=$("cleanSettingsToggle"),close=$("cleanSettingsClose"),shade=$("cleanBackdrop");
 const masterSlot=$("cleanMasterSlot"),demoSlot=$("cleanDemoSlot");
 const master=document.querySelector(".controls > .control-master");
 const demo=$("quickDemoStart");
 // Actual control nodes are MOVED. Existing app.js listeners and storage
 // stay attached, rather than creating duplicate sliders or demo buttons.
 if(master&&masterSlot)masterSlot.appendChild(master);
 if(demo&&demoSlot){
  demoSlot.appendChild(demo);
  demo.title="Originale Voltune-Testfahrt ohne GPS starten";
 }
 function showSettings(open){
  const visible=!!open;
  document.body.classList.toggle("clean-settings-open",visible);
  shade.hidden=!visible;
  toggle.setAttribute("aria-expanded",String(visible));
  if(visible)$("cleanSettingsClose").focus();
  else toggle.focus();
 }
 toggle.addEventListener("click",()=>showSettings(!document.body.classList.contains("clean-settings-open")));
 close.addEventListener("click",()=>showSettings(false));
 shade.addEventListener("click",()=>showSettings(false));
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&document.body.classList.contains("clean-settings-open"))showSettings(false);
 });
 const number=(el)=>{
  if(!el)return 0;
  const match=String(el.textContent||"").replace(",",".").match(/[-+]?\d+(?:\.\d+)?/);
  const value=match?Number(match[0]):0;
  return Number.isFinite(value)?value:0;
 };
 const text=(el)=>String(el?.textContent||"").trim();
 const bound=(x,a,b)=>Math.min(b,Math.max(a,x));
 const selectMode=()=>{
  if($("driveModeMadness")?.classList.contains("active"))return "WAHNSINN";
  if($("driveModeSport")?.classList.contains("active"))return "SPORT";
  return "NORMAL";
 };
 let pending=false,lastGear="",shiftTimer=0,lastSnapshot="";
 function paint(){
  pending=false;
  const speed=bound(Math.round(number(source.speed)),0,500);
  const rpm=bound(Math.round(number(source.rpm)),0,16000);
  const maxRpm=bound(Number($("maxRpm")?.value)||6500,1000,16000);
  const gear=text(source.gear)||"1";
  const a=bound(number(source.accel),-20,20);
  const accel=Math.max(0,a),brake=Math.max(0,-a);
  const state=String(source.runStatus?.dataset.state||"ready");
  const snap=[speed,rpm,gear,a.toFixed(2),state,text(source.runStatusText),selectMode(),maxRpm].join("|");
  if(snap===lastSnapshot)return;
  lastSnapshot=snap;
  display.speed.textContent=String(speed);
  display.rpm.textContent=new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(rpm);
  display.rpmFill.style.width=(100*bound(rpm/maxRpm,0,1)).toFixed(2)+"%";
  display.gear.textContent=gear;
  // 4 m/s² = fully lit bar. Numeric value continues above that ceiling.
  display.accelFill.style.width=(100*bound(accel/4,0,1)).toFixed(1)+"%";
  display.brakeFill.style.width=(100*bound(brake/4,0,1)).toFixed(1)+"%";
  display.accelValue.textContent=accel.toFixed(2);
  display.brakeValue.textContent=brake.toFixed(2);
  $("cleanAccelCard").classList.toggle("active",accel>.2);
  $("cleanBrakeCard").classList.toggle("active",brake>.2);
  display.mode.textContent=selectMode();
  shell.dataset.status=state==="active"?"active":state==="error"?"error":state==="waiting"?"waiting":"ready";
  display.runStatus.textContent=text(source.runStatusText)||"BEREIT";
  const stateText=state==="active"?
   (a>.22?"BESCHLEUNIGEN":a<-.22?"REKUPERIEREN":"GLEICHMÄSSIGE FAHRT"):
   state==="waiting"?"GPS BEREIT · SOUND WARTET":
   state==="error"?"VERBINDUNG PRÜFEN":"BEREIT ZUM START";
  display.state.textContent=stateText;
  if(gear!==lastGear){
   if(lastGear&&lastGear!=="–"&&gear!=="–"&&state==="active"){
    shell.classList.remove("cleanShifting");
    void shell.offsetWidth;
    shell.classList.add("cleanShifting");
    clearTimeout(shiftTimer);
    shiftTimer=setTimeout(()=>shell.classList.remove("cleanShifting"),230);
   }
   lastGear=gear;
  }
 }
 function schedule(){
  if(pending)return;
  pending=true;
  requestAnimationFrame(paint);
 }
 const observer=new MutationObserver(schedule);
 for(const el of [...Object.values(source),$("driveModeNormal"),$("driveModeSport"),
  $("driveModeMadness")]){
  if(el)observer.observe(el,{childList:true,characterData:true,subtree:true,
   attributes:true,attributeFilter:["class","data-state"]});
 }
 $("maxRpm")?.addEventListener("input",schedule);
 window.addEventListener("pagehide",()=>{
  observer.disconnect();
  clearTimeout(shiftTimer);
 });
 paint();
})();