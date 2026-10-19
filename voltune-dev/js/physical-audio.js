/* Voltune Physical Engine adapter v1.
 * Shares Voltune's GPS + virtual gearbox; original VoltuneAudio is preserved.
 * Sound graph based on independently tested Physical Events GPS Lab.
 * No GPS watches, no second drivetrain calculation and no legacy patches.
 */
window.VoltunePhysicalAudio = (() => {
 "use strict";
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
 // Temporärer Hörvergleich: reiner -3-dB-Pegeltrim zwischen
 // Kompressor und finalem Peak-Limiter. Kein EQ-/Engine-/Effekt-Eingriff.
 // Nicht als Nutzereinstellung speichern, damit ein Rollback leicht bleibt.
 const TEST_OUTPUT_TRIM_DB=-3;
 const defaults={
  preset:"hybrid",evBlend:25,amgHighs:55,presence:75,
  musicBoost:8,accelDynamics:6,shiftStrength:70,shiftCut:25,popStrength:75,
  effectFocus:70,muffling:35,sensitivity:"sport",teslaMedia:false
 };
 let config={...defaults},ctx=null,engine=null,presence=null,events=null,
  profileGain=null,eq=null,master=null,accelGain=null,output=null,carrier=null,carrierUrl=null,
  active=false,muted=false,generation=0,lastAccelTime=0,lastAccelLoad=.13,
  prevLoad=.13,lastPop=0,lastShift=0,lastSpeed=0,lastValidAt=0,lastEventTime=0,
  accelerationEnvelope=0,accelEnvelopeTime=0;
 const presetList=["hybrid","amg","gti","italia","v8","v4","v6","v12","i5","ev"];
 const names={hybrid:"Hybrid EV + V8",amg:"V8 AMG",gti:"Golf GTI",italia:"V12 Italia",
  v8:"V8 Crossplane",v4:"V4",v6:"V6",v12:"V12",i5:"Reihenfünfzylinder",ev:"EV"};
 const REF={rpm:850,load:.13};
 const pendingPlay={value:null};
 const mediaActions=["play","pause","nexttrack","previoustrack"];
 let lastWheelAt=0,gearCallback=null;
 const level=(percent,reference,maximum)=>{
  const p=clamp(percent,0,100);
  return p<=50?reference*p/50:reference+(maximum-reference)*(p-50)/50;
 };
 function makeCarrier(){
  const sampleRate=11025,length=sampleRate*60,buffer=new ArrayBuffer(44+length*2),
   view=new DataView(buffer);
  const ascii=(p,x)=>{for(let i=0;i<x.length;i++)view.setUint8(p+i,x.charCodeAt(i));};
  ascii(0,"RIFF");view.setUint32(4,36+length*2,true);ascii(8,"WAVE");
  ascii(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  ascii(36,"data");view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){
   const t=i/sampleRate,envelope=Math.min(1,i/500,(length-i)/500);
   const sound=(Math.sin(2*Math.PI*180*t)*.16+Math.sin(2*Math.PI*270*t)*.04)*envelope;
   view.setInt16(44+i*2,Math.round(clamp(sound,-1,1)*32767),true);
  }
  return new Blob([buffer],{type:"audio/wav"});
 }
 function metadata(){
  if(!config.teslaMedia||!navigator.mediaSession||!window.MediaMetadata)return;
  try{navigator.mediaSession.metadata=new window.MediaMetadata({
   title:names[config.preset],artist:"Voltune · Physical Engine",album:"Motorprofile"
  });}catch(_){}
 }
 function cleanupCarrier(){
  if(carrier){
   try{carrier.pause();carrier.removeAttribute("src");carrier.load();carrier.remove();}catch(_){}
   carrier=null;
  }
  if(carrierUrl){try{URL.revokeObjectURL(carrierUrl);}catch(_){ }carrierUrl=null;}
  if(navigator.mediaSession&&navigator.mediaSession.setActionHandler){
   for(const type of mediaActions){
    try{navigator.mediaSession.setActionHandler(type,null);}catch(_){}
   }
   try{navigator.mediaSession.playbackState="none";}catch(_){}
  }
 }
 function nextProfile(){
  const stamp=performance.now();
  if(stamp-lastWheelAt<260)return;
  lastWheelAt=stamp;
  const i=presetList.indexOf(config.preset);
  setProfile(presetList[(i+1)%presetList.length]);
  if(carrier&&carrier.paused){try{const p=carrier.play();p?.catch?.(()=>{});}catch(_){}}
  try{if(navigator.mediaSession)navigator.mediaSession.playbackState="playing";}catch(_){}
 }
 function beginCarrier(){
  if(!config.teslaMedia)return;
  carrierUrl=URL.createObjectURL(makeCarrier());
  carrier=document.createElement("audio");carrier.loop=true;carrier.playsInline=true;
  carrier.preload="auto";carrier.volume=.025;carrier.style.display="none";
  carrier.src=carrierUrl;
  document.body.appendChild(carrier);
  if(navigator.mediaSession&&navigator.mediaSession.setActionHandler){
   // Tesla confirmed only middle-wheel Play/Pause; side track events are ignored.
   for(const type of ["play","pause"]){
    try{navigator.mediaSession.setActionHandler(type,nextProfile);}catch(_){}
   }
   metadata();
   try{navigator.mediaSession.playbackState="playing";}catch(_){}
  }
  // Must happen synchronously in the initiating user gesture, prior to
  // any async audioWorklet.addModule await.
  const promise=carrier.play();
  if(promise&&typeof promise.catch==="function")
   promise.catch(error=>{console.warn("Physical Tesla media anchor:",error);cleanupCarrier();});
 }
 function setConfig(partial={}){
  const oldMedia=config.teslaMedia;
  const prior=config.preset;
  config={...config,...partial};
  if(!presetList.includes(config.preset))config.preset="hybrid";
  if(active&&prior!==config.preset)setProfile(config.preset);
  if(active){
   apply();
   // Don't start an HTML player from an asynchronous settings change.
   // A changed media option is applied on next engine start.
   if(oldMedia&&!config.teslaMedia)cleanupCarrier();
  }
 }
 function setProfile(value){
  if(!presetList.includes(value))return;
  config.preset=value;
  engine?.port.postMessage({type:"preset",value});
  presence?.port.postMessage({type:"preset",value});
  metadata();
  apply();
  try{gearCallback?.(value);}catch(_){}
 }
 function getConfig(){return {...config};}
 function onProfileChange(cb){gearCallback=cb;}
 // Regelbereich: 0–12 dB PegelUNTERSCHIED zwischen Konstantfahrt
 // und starker Beschleunigung. Symmetrische Absenkung/Anhebung
 // erhält mehr Headroom als reine 12-dB-Verstärkung.
 function applyAccelerationGain(){
  if(!ctx||!accelGain)return;
  const differenceDb=clamp(config.accelDynamics,0,12);
  const deltaDb=differenceDb*(accelerationEnvelope-.5);
  accelGain.gain.setTargetAtTime(Math.pow(10,deltaDb/20),ctx.currentTime,.065);
 }
 function updateAccelerationEnvelope(accel){
  const positive=clamp(accel,0,6);
  const normalized=clamp((positive-.3)/2.2,0,1);
  // Sanfter Übergang und Rauschfilter: kein Pumpen je GPS-Sample.
  const target=normalized*normalized*(3-2*normalized);
  const now=performance.now();
  const dt=accelEnvelopeTime>0?clamp((now-accelEnvelopeTime)/1000,0,.2):.016;
  accelEnvelopeTime=now;
  const tau=target>accelerationEnvelope?.16:.52;
  accelerationEnvelope+=(target-accelerationEnvelope)*(1-Math.exp(-dt/tau));
  applyAccelerationGain();
 }
 function apply(){
  if(!ctx||ctx.state!=="running"||!engine||!events)return;
  const at=ctx.currentTime;
  const rpm=engine.parameters.get("rpm"),load=engine.parameters.get("load");
  rpm.setTargetAtTime(REF.rpm,at,.115);
  load.setTargetAtTime(REF.load,at,.12);
  engine.parameters.get("evBlend").setTargetAtTime(clamp(config.evBlend,0,100)/100,at,.035);
  presence.parameters.get("presence").setTargetAtTime(clamp(config.presence,0,100)/100,at,.075);
  events.parameters.get("shiftLevel").setTargetAtTime(level(config.shiftStrength,.7,1.75),at,.03);
  events.parameters.get("shiftCut").setTargetAtTime(clamp(config.shiftCut,0,100)/100,at,.035);
  events.parameters.get("popLevel").setTargetAtTime(level(config.popStrength,.65,2),at,.03);
  events.parameters.get("effectBoost").setTargetAtTime(1+4*clamp(config.effectFocus,0,100)/100,at,.04);
  events.parameters.get("muffling").setTargetAtTime(clamp(config.muffling,0,100)/100,at,.03);
  eq.gain.setTargetAtTime(config.preset==="amg"?-11*clamp(config.amgHighs,0,100)/100:0,at,.055);
  profileGain.gain.setTargetAtTime(config.preset==="hybrid"?2:1,at,.08);
  setMasterVolume(config.volume??32);
  applyAccelerationGain();
 }
 function setMasterVolume(value){
  config.volume=clamp(value,0,100);
  if(!ctx||!master)return;
  const volume=config.volume/100,boost=clamp(config.musicBoost,0,12);
  const baseGain=Math.pow(volume,1.52)*4.2*Math.pow(10,(boost*(1-volume))/20);
  const g=baseGain*Math.pow(10,TEST_OUTPUT_TRIM_DB/20);
  master.gain.setTargetAtTime(muted?0:g,ctx.currentTime,.060);
 }
 function setMuted(value,volume){
  muted=!!value;
  if(Number.isFinite(Number(volume)))config.volume=clamp(volume,0,100);
  setMasterVolume(config.volume??32);
 }
 function isMuted(){return muted;}
 function isStarted(){return active&&ctx?.state==="running";}
 async function start(){
  if(isStarted())return;
  stop();
  const token=++generation;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context||!window.AudioWorkletNode)throw Error("Physical Engine benötigt AudioWorklet.");
  try{
   ctx=new Context({latencyHint:"interactive"});
   const audioContext=ctx;
   const ready=audioContext.resume();
   beginCarrier();
   const files=["physical-engine-worklet-v4.js?v=4","physical-presence-worklet-v1.js?v=1",
    "physical-events-worklet-v4.js?v=4","physical-output-limiter-v1.js?v=1"];
   for(const name of files){
    await audioContext.audioWorklet.addModule("./js/"+name);
    if(token!==generation)throw Error("Engine-Start abgebrochen");
   }
   await ready;
   if(token!==generation)throw Error("Engine-Start abgebrochen");
   engine=new AudioWorkletNode(audioContext,"voltune-physical-engine-v4",
    {numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
   presence=new AudioWorkletNode(audioContext,"voltune-physical-presence-v1",
    {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
   events=new AudioWorkletNode(audioContext,"voltune-events-v4",
    {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
   output=new AudioWorkletNode(audioContext,"voltune-physical-output-limiter-v1",
    {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
   engine.port.postMessage({type:"preset",value:config.preset});
   presence.port.postMessage({type:"preset",value:config.preset});
   eq=audioContext.createBiquadFilter();eq.type="highshelf";eq.frequency.value=1200;eq.gain.value=0;
   profileGain=audioContext.createGain();
   const compressor=audioContext.createDynamicsCompressor();
   compressor.threshold.value=-11;compressor.knee.value=4;compressor.ratio.value=7;
   compressor.attack.value=.003;compressor.release.value=.12;
   accelGain=audioContext.createGain();accelGain.gain.value=1;
   master=audioContext.createGain();master.gain.value=0;
   engine.connect(eq).connect(presence).connect(profileGain)
    .connect(events).connect(compressor).connect(accelGain)
    .connect(master).connect(output).connect(audioContext.destination);
   const error=()=>console.warn("Voltune Physical Engine Worklet processing failed");
   for(const node of [engine,presence,events,output])node.onprocessorerror=error;
   active=true;muted=false;resetDrivingState();apply();
  }catch(error){
   if(token===generation)stop();
   throw error;
  }
 }
 function stop(){
  ++generation;
  cleanupCarrier();
  const old=ctx;
  ctx=null;engine=null;presence=null;events=null;output=null;eq=null;
  master=null;accelGain=null;profileGain=null;active=false;
  if(old)try{old.close()?.catch?.(()=>{});}catch(_){}
 }
 function resetDrivingState(){
  prevLoad=.13;lastAccelTime=0;lastAccelLoad=.13;lastPop=performance.now();
  lastShift=performance.now();lastEventTime=0;lastValidAt=0;lastSpeed=0;REF.rpm=850;REF.load=.13;
  accelerationEnvelope=0;accelEnvelopeTime=0;
  applyAccelerationGain();
 }
 function sendEvent(type,intensity){
  if(!active||muted||!events)return;
  const slider=type==="overrun"?config.popStrength:config.shiftStrength;
  if(clamp(slider,0,100)===0)return;
  events.port.postMessage({type,intensity:clamp(intensity,.05,1)});
 }
 function triggerShiftBurble(intensity=1){
  const n=performance.now();if(n-lastShift<600)return;
  lastShift=n;sendEvent("upshift",Math.max(.65,intensity));
 }
 function triggerDownshiftBlip(intensity=1){
  const n=performance.now();if(n-lastShift<600)return;
  lastShift=n;sendEvent("downshift",Math.max(.55,intensity));
 }
 function triggerOverrun(intensity=1){sendEvent("overrun",intensity);}
 function update(data={},settings={}){
  if(!isStarted())return null;
  const rpm=clamp(data.rpm,700,8500),accel=clamp(data.acceleration,-6,6),
   speed=clamp(data.speedKmh,0,300),now=performance.now();
  const load=accel>=.2?clamp(.24+accel*.28,.24,.94):accel<=-.3?.055:speed<=2?.13:.24;
  REF.rpm=rpm;REF.load=load;
  updateAccelerationEnvelope(accel);
  // 1.6 s acceleration history: proven Sport mode from the isolated GPS lab.
  const sensitivity=config.sensitivity;
  if(accel>=.28&&speed>=12){
   lastAccelTime=now;lastAccelLoad=Math.max(lastAccelLoad*.92,load);
  }
  const standard=sensitivity==="standard",extreme=sensitivity==="extreme";
  const windowMs=extreme?2400:1600;
  const recent=lastAccelTime>0&&now-lastAccelTime<=windowMs;
  const remembered=standard?prevLoad:(recent?Math.max(prevLoad,lastAccelLoad):prevLoad);
  const decelThreshold=standard?-1:extreme?-.38:-.62;
  const minSpeed=standard?38:extreme?20:28;
  const minLoad=standard?.36:extreme?.27:.31;
  const cooldown=standard?3200:extreme?1400:1900;
  const afterShift=standard?700:extreme?250:400;
  if(speed>=minSpeed&&accel<=decelThreshold&&remembered>=minLoad&&load<=.1
   &&now-lastPop>cooldown&&now-lastShift>afterShift){
   const intensity=standard?clamp(.45+Math.abs(accel)*.11,.45,.85):
    clamp(.66+Math.abs(accel)*.15,.65,1);
   sendEvent("overrun",intensity);
   lastPop=now;lastAccelTime=0;lastAccelLoad=.13;
  }else if(!recent&&now-lastAccelTime>windowMs){lastAccelLoad=.13;}
  prevLoad=load;lastSpeed=speed;lastValidAt=now;
  apply();
  return null; // Legacy-only sound-layer debug should not be fabricated.
 }
 function testEvent(type){
  if(!["upshift","downshift","overrun"].includes(type))return;
  sendEvent(type,.95);
 }
 function triggerBov(){/* Legacy BOV does not belong to Physical Engine. */}
 function triggerTurboFlutter(){/* Legacy turbo flutter does not belong here. */}
 return {start,stop,isStarted,setMuted,isMuted,setMasterVolume,update,resetDrivingState,
  triggerShiftBurble,triggerDownshiftBlip,triggerOverrun,triggerBov,triggerTurboFlutter,testEvent,
  setProfile,setConfig,getConfig,onProfileChange,presetList,names};
})();
window.VoltuneAudioRouter = (() => {
 const original=window.VoltuneAudio,physical=window.VoltunePhysicalAudio;
 let kind="legacy";
 function selectEngine(engine){
  const next=engine==="physical"?"physical":"legacy";
  if(next===kind)return false;
  (kind==="legacy"?original:physical).stop();
  kind=next;
  return true;
 }
 function getEngine(){return kind;}
 const shared={selectEngine,getEngine};
 window.VoltuneOriginalAudio=original;
 window.VoltuneAudio=new Proxy(shared,{
  get(target,property){
   if(property in target)return target[property];
   if(property==="getSoundProfiles"||property==="setOverrunSound"){
    return original[property]?.bind(original);
   }
   const active=kind==="physical"?physical:original;
   const v=active[property];
   return typeof v==="function"?v.bind(active):v;
  }
 });
 return shared;
})();
