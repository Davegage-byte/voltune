/* Voltune Drive 2.0: presentation-only adapter for the EXISTING Voltune engine.
 * No new GPS watches, no new AudioContext, no drivetrain or FX overrides.
 */
(()=>{
"use strict";
const $=id=>document.getElementById(id),cockpit=$("v2Cockpit");
if(!cockpit)return;
const old={speed:$("speed"),gear:$("gearDisplay"),rpm:$("rpmDisplay"),accel:$("accel"),
 status:$("runStatus"),statusText:$("runStatusText"),
 gps:$("gps"),stop:$("stop"),mute:$("mute"),launch:$("launch"),demo:$("quickDemoStart"),
 modeNormal:$("driveModeNormal"),modeSport:$("driveModeSport"),modeMadness:$("driveModeMadness"),
 theme:$("theme"),volume:$("volume"),maxRpm:$("maxRpm")};
const output={speed:$("v2Speed"),gear:$("v2Gear"),rpm:$("v2Rpm"),mode:$("v2ModeText"),
 rpmArc:$("v2RpmArc"),accelArc:$("v2AccelArc"),regenArc:$("v2RegenArc"),
 gDot:$("v2GDot"),longG:$("v2LongG"),powerKw:$("v2PowerKw"),powerPs:$("v2PowerPs"),
 accelPct:$("v2AccelPct"),regenPct:$("v2RegenPct"),accelRaw:$("v2AccelRaw"),regenRaw:$("v2RegenRaw")};
const car={body:$("v2CarBody"),front:$("v2CarFrontGlow"),rear:$("v2CarRearGlow")};
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const getNum=el=>{const x=String(el?.textContent||"").replace(",",".").match(/[-+]?\d+(?:\.\d+)?/);return x?Number(x[0])||0:0};
const getRpm=()=>Number(String(old.rpm?.textContent||"0").match(/\d[\d.,]*/)?.[0].replace(/[.,]/g,""))||0;
const ready=()=>!!(window.VoltuneAudio&&window.VoltuneAudio.isStarted());
const getMode=()=>old.modeMadness.classList.contains("active")?"WAHNSINN":
 old.modeSport.classList.contains("active")?"SPORT":"NORMAL";
// Independent visual calibration: does NOT alter engine or audio.
const factorInput=$("v2PowerFactor"),factorLabel=$("v2PowerFactorLabel");
const FACTOR_KEY="voltune.drive.powerFactor.v1";
try{
 const saved=Number(localStorage.getItem(FACTOR_KEY));
 if(Number.isFinite(saved)&&saved>=.5&&saved<=1.5)factorInput.value=saved.toFixed(2);
}catch(_){}
const powerFactor=()=>clamp(Number(factorInput.value)||1,.5,1.5);
const updateFactor=()=>{
 factorLabel.textContent=powerFactor().toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" ×";
 lastVisual="";schedulePaint();
 try{localStorage.setItem(FACTOR_KEY,powerFactor().toFixed(2));}catch(_){}
};
factorInput.addEventListener("input",updateFactor);
factorLabel.textContent=powerFactor().toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" ×";
const changeMode=(mode)=>{
 ({normal:old.modeNormal,sport:old.modeSport,madness:old.modeMadness})[mode].click();
};
const setPhase=phase=>{cockpit.dataset.phase=phase};
let phase="idle",lastGear="",lastVisual="",testTimer=0,paintRequested=false,booting=false,lastVU=0;
// Nur visuelle Darstellung aus den bestehenden Längsbeschleunigungswerten.
const reduceCarMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
let carAccel=0,carY=0,carFront=0,carRear=0,lastCarFrame=0;
function animateCar(timestamp){
 const dt=lastCarFrame?clamp((timestamp-lastCarFrame)/1000,.001,.12):.045;
 lastCarFrame=timestamp;
 const a=clamp(carAccel,-8,8);
 const strength=clamp((Math.abs(a)-.18)/3.5,0,1);
 // Plus: etwas nach unten, Heck in Cyan. Minus: nach oben, Front in Amber.
 const targetY=reduceCarMotion?0:Math.sign(a)*7*strength;
 const targetFront=a<-.18?strength*.85:0;
 const targetRear=a>.18?strength*.85:0;
 const response=1-Math.exp(-dt/(Math.abs(targetY)<Math.abs(carY)?.37:.21));
 const glowResponse=1-Math.exp(-dt/.19);
 carY+=(targetY-carY)*response;
 carFront+=(targetFront-carFront)*glowResponse;
 carRear+=(targetRear-carRear)*glowResponse;
 if(targetY===0&&Math.abs(carY)<.02)carY=0;
 car.body.style.transform="translate3d(0,"+carY.toFixed(2)+"px,0)";
 car.front.style.opacity=carFront.toFixed(3);
 car.rear.style.opacity=carRear.toFixed(3);
}
function phaseTo(value){phase=value;setPhase(value);}
const arcs=[output.rpmArc,output.accelArc,output.regenArc].map(el=>{
 const length=el.getTotalLength();el.style.strokeDasharray="0 "+length;return {el,length};
});
function arc(index,portion){
 const a=arcs[index],length=a.length;
 a.el.style.strokeDasharray=(length*clamp(portion,0,1)).toFixed(2)+" "+length.toFixed(2);
}
const ticks=$("v2GeneratedTicks");
for(let i=0;i<=62;i++){
 // 295-degree sweep with a deliberate opening at the bottom.
 const angle=(122+296*i/62)*Math.PI/180;
 const outer=328,inner=i%5===0?310:319;
 const x1=400+inner*Math.cos(angle),y1=400+inner*Math.sin(angle);
 const x2=400+outer*Math.cos(angle),y2=400+outer*Math.sin(angle);
 const line=document.createElementNS("http://www.w3.org/2000/svg","line");
 for(const [k,v] of Object.entries({x1,y1,x2,y2}))line.setAttribute(k,String(v));
 line.setAttribute("class","v2FineTick");
 ticks.appendChild(line);
}
const current=()=>{
 const speed=clamp(Math.round(getNum(old.speed)),0,400),a=clamp(getNum(old.accel),-12,12);
 const rpm=clamp(getRpm(),0,16000),maxRpm=clamp(Number(old.maxRpm?.value)||7000,1000,16000);
 const gear=String(old.gear?.textContent||"1").trim()||"1";
 const status=old.status?.dataset.state||"ready";
 return {speed,a,rpm,maxRpm,gear,status,mode:getMode()};
};
// Approximation, not Tesla-measured power. Mass includes driver.
// P_wheel=(m*a + rolling_resistance + aero_drag)*v; electric drive eta≈.91.
// This is WHEEL/traction-path demand, not axle-resolved Tesla battery power.
// A negative result is a braking POWER ESTIMATE, NOT guaranteed battery recuperation.
function estimatedPower(speedKmh,accel) {
 const v=speedKmh/3.6;
 const mass=1950,rolling=mass*9.81*.011,aero=.5*1.225*.23*2.22*v*v;
 const wheelKw=((mass*accel)+rolling+aero)*v/1000;
 return clamp(wheelKw>=0?wheelKw/.91:wheelKw*.72,-350,450);
}
function paint(){
 paintRequested=false;
 if(document.hidden)return;
 const s=current(),active=ready(),monitor=active&&(phase==="running"||phase==="selftest");
 carAccel=active&&phase==="running"?s.a:0;
 const snap=[s.speed,s.a,s.rpm,s.gear,s.mode,s.status,active,phase,s.maxRpm,powerFactor()].join("|");
 if(snap===lastVisual)return;
 lastVisual=snap;
 output.speed.textContent=String(s.speed);
 output.gear.textContent=s.gear;
 output.rpm.textContent=s.rpm.toLocaleString("de-DE");
 output.mode.textContent=s.mode;
 for(const [id,mode] of [["v2Normal","NORMAL"],["v2Sport","SPORT"],["v2Madness","WAHNSINN"]]){
  $(id).classList.toggle("active",s.mode===mode);
  $(id).setAttribute("aria-pressed",String(s.mode===mode));
 }
 if(s.gear!==lastGear){
  if(lastGear&&active&&phase==="running"){
   output.gear.classList.remove("v2GearFlash");void output.gear.offsetWidth;output.gear.classList.add("v2GearFlash");
  }
  lastGear=s.gear;
 }
 const fAccel=Math.max(0,s.a),fBrake=Math.max(0,-s.a);
 const accPct=clamp(100*fAccel/4.8,0,100),brakePct=clamp(100*fBrake/4,0,100);
 // During selftest the sweep is driven by its own animation; do not overwrite.
 if(phase!=="selftest"){
  arc(0,monitor?s.rpm/s.maxRpm:0);
  arc(1,monitor?fAccel/4.8:0);
  arc(2,monitor?fBrake/4:0);
 }
 output.accelPct.textContent=Math.round(accPct)+"%";
 output.regenPct.textContent=Math.round(brakePct)+"%";
 output.accelRaw.textContent=fAccel.toFixed(2)+" m/s²";
 output.regenRaw.textContent=fBrake.toFixed(2)+" m/s²";
 const longitudinal=s.a/9.80665;
 output.longG.textContent=(longitudinal>0?"+":"")+longitudinal.toFixed(2);
 // Motorsport-G-Meter: Beschleunigen = unten, Bremsen = oben.
  output.gDot.setAttribute("cy",String(110+84*clamp(longitudinal,-1,1)));
 // Lateral acceleration is NOT derivable from GPS speed/longitudinal alone.
 // Do not fabricate a lateral-G dot or data until a validated heading/gyro is available.
 output.gDot.setAttribute("cx","110");
 const kw=monitor?estimatedPower(s.speed,s.a)*powerFactor():0;
 output.powerKw.textContent=String(Math.round(kw));
 output.powerPs.textContent=String(Math.round(kw*1.35962));
 const hasGps=String($("gpsStatus")?.textContent||"").toLowerCase().includes("aktiv") ||
  s.status==="active"&&String(old.statusText?.textContent||"").includes("GPS");
 $("v2GpsStatus").classList.toggle("ok",hasGps);
 $("v2GpsStatus").classList.toggle("err",s.status==="error");
 $("v2GpsLabel").textContent=hasGps?"GPS AKTIV":s.status==="waiting"?"GPS WARTET":"GPS BEREIT";
 $("v2AudioStatus").classList.toggle("ok",active);
 $("v2AudioLabel").textContent=active?"AUDIO AKTIV":"AUDIO AUS";
 $("v2Restart").classList.toggle("active",active||phase==="idle");
 $("v2Mute").classList.toggle("active",old.mute.textContent==="Ton an");
}
function schedulePaint(){
 if(paintRequested)return;
 paintRequested=true;requestAnimationFrame(paint);
}
function runSelftest(){
 clearTimeout(testTimer);
 phaseTo("selftest");lastVisual="";
 const prefersReduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 const dur=prefersReduced?50:1380;
 arc(0,.96);arc(1,1);arc(2,1);
 output.speed.textContent="188";output.gear.textContent="8";output.rpm.textContent="8.888";
 testTimer=setTimeout(()=>{if(!ready()){phaseTo("idle");schedulePaint();return}phaseTo("running");lastVisual="";schedulePaint();},dur);
}
function detectState(){
 const active=ready(),status=old.status?.dataset.state||"ready";
 if(active&&!booting&&(phase==="idle"||phase==="stopped")){
  runSelftest();
 }else if(!active&&!booting&&(phase==="running"||phase==="selftest")){
  clearTimeout(testTimer);phaseTo(status==="error"?"error":"idle");lastVisual="";
 }
 if(status==="error"&&!active&&!booting)phaseTo("error");
 schedulePaint();
}
function launchGpsFromButton(){
 if(booting||ready())return;
 booting=true;phaseTo("starting");
 $("v2StartLabel").textContent="STARTET …";
 // Call the ORIGINAL GPS button synchronously inside the user gesture.
 // This preserves Tesla's audio user activation and all existing listeners.
 old.gps.click();
 const begin=performance.now();
 const check=()=>{
  if(ready()){
   booting=false;$("v2StartLabel").textContent="START";runSelftest();return;
  }
  if(performance.now()-begin<11000&&old.status?.dataset.state!=="error"){
   testTimer=setTimeout(check,95);return;
  }
  booting=false;
  phaseTo("error");$("v2StartLabel").textContent="ERNEUT STARTEN";
  schedulePaint();
 };
 testTimer=setTimeout(check,120);
}
$("v2Start").addEventListener("click",launchGpsFromButton);
$("v2Restart").addEventListener("click",()=>{
 if(ready()){ // User may restart GPS via original control without starting duplicate audio.
  old.gps.click();return;
 }
 launchGpsFromButton();
});
$("v2Stop").addEventListener("click",()=>{
 clearTimeout(testTimer);booting=false;old.stop.click();phaseTo("idle");
 $("v2StartLabel").textContent="START";lastVisual="";schedulePaint();
});
$("v2Mute").addEventListener("click",()=>{old.mute.click();schedulePaint()});
$("v2Launch").addEventListener("click",()=>old.launch.click());
$("v2Demo").addEventListener("click",()=>{
 if(booting)return;
 // Existing demo listener will start AudioContext under user activation.
 old.demo.click();
 const begin=performance.now();
 const check=()=>{
  if(ready()){runSelftest();return}
  if(performance.now()-begin<9500)testTimer=setTimeout(check,130);
 };
 check();
});
$("v2Normal").addEventListener("click",()=>changeMode("normal"));
$("v2Sport").addEventListener("click",()=>changeMode("sport"));
$("v2Madness").addEventListener("click",()=>changeMode("madness"));
$("v2Theme").addEventListener("click",()=>old.theme.click());
const shade=$("v2Shade"),settings=$("v2Settings");
function showSettings(visible){
 document.body.classList.toggle("v2-settings-open",visible);
 shade.hidden=!visible;settings.setAttribute("aria-expanded",String(visible));
 if(visible)$("v2SettingsClose").focus();else settings.focus();
}
settings.addEventListener("click",()=>showSettings(true));
$("v2SettingsClose").addEventListener("click",()=>showSettings(false));
shade.addEventListener("click",()=>showSettings(false));
// Direct navigation to the existing Physical Engine controls, without changing
// the user's selected sound engine or any stored sound parameters.
$("v2JumpPhysical").addEventListener("click",()=>{
 const engineSelect=$("soundEngineSelect");
 const physical=$("physicalEnginePanel");
 const destination=physical&&!physical.hidden?physical:$("soundEngineControl");
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 destination?.scrollIntoView?.({behavior:reduced?"instant":"smooth",block:"start"});
 if(physical?.hidden){
  engineSelect?.focus?.({preventScroll:true});
  $("v2JumpPhysical").textContent="Soundengine oben auf Physical Engine umstellen ↑";
 }else{
  $("v2JumpPhysical").textContent="Zum V8 / Physical Engine ↓";
 }
});
$("soundEngineSelect").addEventListener("change",()=>{
 $("v2JumpPhysical").textContent="Zum V8 / Physical Engine ↓";
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&document.body.classList.contains("v2-settings-open"))showSettings(false);
});
// Direct-touch master volume bar. The ORIGINAL range stays in the hidden
// settings DOM: update it with native input so app.js handles save and audio.
const bar=$("v2VolumeTrack"),bars=$("v2VolumeBars"),marker=$("v2VolumeMarker");
const segments=[];
for(let i=0;i<54;i++){
 const segment=document.createElement("span");segment.className="v2VolumeBar";
 bars.appendChild(segment);segments.push(segment);
}
let vuLevel=0,pointerActive=false;
function setVolume(value){
 old.volume.value=String(clamp(Math.round(value),0,100));
 old.volume.dispatchEvent(new Event("input",{bubbles:true}));
 drawVolume();
}
function drawVolume(){
 const vol=Number(old.volume.value)||0,portion=vol/100;
 marker.style.left=portion*100+"%";
 $("v2VolumeValue").textContent=vol+"%";
 bar.setAttribute("aria-valuenow",String(vol));
 bar.setAttribute("aria-valuetext",vol+" Prozent");
 segments.forEach((el,i)=>{
  const normal=(i+.5)/segments.length<=portion;
  const live=(i+.5)/segments.length<=vuLevel;
  el.classList.toggle("filled",normal);el.classList.toggle("vu",live&&normal);
  el.style.height=(live?(18+67*Math.pow(Math.sin((i+4)*.31)*.32+.7,1)):(normal?56:27))+"%";
 });
}
function volumeAtEvent(event){
 const rect=bar.getBoundingClientRect();
 if(!rect.width)return;
 const v=100*(event.clientX-rect.left)/rect.width;
 setVolume(v);
}
bar.addEventListener("pointerdown",event=>{
 pointerActive=true;bar.setPointerCapture?.(event.pointerId);
 volumeAtEvent(event);event.preventDefault();
});
bar.addEventListener("pointermove",event=>{if(pointerActive)volumeAtEvent(event)});
const release=()=>{pointerActive=false};
bar.addEventListener("pointerup",release);bar.addEventListener("pointercancel",release);
bar.addEventListener("keydown",event=>{
 let v=Number(old.volume.value),used=true;
 switch(event.key){
 case "ArrowRight":case "ArrowUp":v++;break;
 case "ArrowLeft":case "ArrowDown":v--;break;
 case "PageUp":v+=5;break;case "PageDown":v-=5;break;
 case "Home":v=0;break;case "End":v=100;break;
 default:used=false;
 }
 if(used){event.preventDefault();setVolume(v)}
});
old.volume.addEventListener("input",drawVolume);
// Unobtrusive VU: the physical engine exposes a read-only RMS tap.
// Legacy engine has no analyser and is labeled as such rather than faking an RMS.
let lastFrame=0;
function tick(timestamp){
 if(!document.hidden&&timestamp-lastFrame>42){
  lastFrame=timestamp;
  const physical=ready()&&window.VoltuneAudio?.getEngine?.()==="physical";
  const target=physical?clamp(Number(window.VoltunePhysicalAudio?.getOutputMeter?.()||0),0,1):0;
  vuLevel+=(target-vuLevel)*(target>vuLevel?.52:.14);
  $("v2VuStatus").textContent=physical?"LIVE-PEGEL":"";
  drawVolume();
  animateCar(timestamp);
  // Keep the clock correct without creating another interval.
  if(timestamp%1000<60){
   $("v2Clock").textContent=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  }
 }
 requestAnimationFrame(tick);
}
const watch=new MutationObserver(()=>{detectState()});
for(const el of [old.speed,old.rpm,old.gear,old.accel,old.status,old.statusText,
 old.modeNormal,old.modeSport,old.modeMadness,$("gpsStatus"),old.mute]){
 if(el)watch.observe(el,{subtree:true,characterData:true,childList:true,attributes:true,attributeFilter:["data-state","class"]});
}
document.addEventListener("visibilitychange",schedulePaint);
window.addEventListener("pagehide",()=>{clearTimeout(testTimer);watch.disconnect()});
$("v2Clock").textContent=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
drawVolume();detectState();requestAnimationFrame(tick);
})();