/* Voltune Events Lab v0.1 — isoliertes Motor-Transient-Worklet.
 * Generator: aus Druckimpulsen angeregte Abgas-Resonatoren.
 * Keine WAV-Dateien, Sägezahngeneratoren oder Änderungen an Legacy-Engines.
 */
class VoltuneEventsV1 extends AudioWorkletProcessor{
 static get parameterDescriptors(){return [
  {name:"shiftLevel",defaultValue:.7,minValue:0,maxValue:1,automationRate:"k-rate"},
  {name:"popLevel",defaultValue:.6,minValue:0,maxValue:1,automationRate:"k-rate"},
  {name:"muffling",defaultValue:.55,minValue:0,maxValue:1,automationRate:"k-rate"}
 ];}
 constructor(){
  super();const sr=sampleRate;
  this.sr=sr;this.seed=0x6bdea23c;this.bypass=false;
  this.shiftType="";this.shiftPos=0;this.shiftEnd=0;this.shiftIntensity=0;this.shiftFired=false;
  this.popsLeft=0;this.nextPop=0;this.popIndex=0;this.popIntensity=0;
  this.shiftLevel=.7;this.popLevel=.6;this.muffling=.55;
  this.smooth=1-Math.exp(-1/(sr*.03));
  this.fastD=Math.exp(-1/(sr*.0017));this.slowD=Math.exp(-1/(sr*.018));
  this.lowC=1-Math.exp(-2*Math.PI*240/sr);
  this.midC=1-Math.exp(-2*Math.PI*580/sr);
  this.echoC=1-Math.exp(-2*Math.PI*650/sr);
  this.dcCoef=Math.exp(-2*Math.PI*17/sr);
  this.dcL=0;this.dcR=0;this.lastL=0;this.lastR=0;
  this.side=[this.makeSide(.014,95,220),this.makeSide(.017,109,265)];
  this.port.onmessage=e=>{
   const m=e.data||{};const amount=Number.isFinite(m.intensity)?Math.max(0,Math.min(1,m.intensity)):.8;
   if(m.type==="bypass"){this.bypass=!!m.value;}
   else if(m.type==="upshift"||m.type==="downshift"){
    this.shiftType=m.type;this.shiftPos=0;this.shiftEnd=Math.round(this.sr*(m.type==="upshift"?.18:.16));
    this.shiftIntensity=amount;this.shiftFired=false;
   }else if(m.type==="overrun"){
    this.popsLeft=2+Math.round(amount*4);this.nextPop=Math.round(this.sr*.02);
    this.popIndex=0;this.popIntensity=amount;
   }
  };
 }
 makeSide(seconds,hz1,hz2){
  const sr=this.sr;const res=(hz,bw)=>{const r=Math.exp(-Math.PI*bw/sr);return{
   a:2*r*Math.cos(2*Math.PI*hz/sr),b:r*r,d:1-r,x:0,y:0
  };};
  return{fast:0,slow:0,lo:0,mid:0,reflect:0,
   pipe:new Float32Array(Math.round(sr*seconds)),at:0,
   bass:res(hz1,72),body:res(hz2,140)};
 }
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/2147483648-1;}
 impulse(k,amp){this.side[k].fast+=amp;this.side[k].slow+=amp;}
 resonance(r,p){const y=r.a*r.x-r.b*r.y+r.d*p;r.y=r.x;r.x=y;return y;}
 process(inputs,outputs,params){
  const o=outputs[0];if(!o||!o[0])return true;
  const l=o[0],r=o[1]||l,ins=inputs[0],a=ins&&ins[0],b=ins&&(ins[1]||ins[0]);
  for(let i=0;i<l.length;i++){
   const il=a?a[i]:0,ir=b?b[i]:il;
   this.shiftLevel+=(params.shiftLevel[0]-this.shiftLevel)*this.smooth;
   this.popLevel+=(params.popLevel[0]-this.popLevel)*this.smooth;
   this.muffling+=(params.muffling[0]-this.muffling)*this.smooth;
   if(this.bypass){l[i]=il;if(r!==l)r[i]=ir;continue;}
   let gain=1;
   if(this.shiftPos<this.shiftEnd){
    const t=this.shiftPos/this.sr;
    if(this.shiftType==="upshift"){
     const gate=t<.012?t/.012:t<.058?1:t<.16?1-(t-.058)/.102:0;
     gain=1-.84*this.shiftIntensity*this.shiftLevel*Math.max(0,gate);
     if(t>.033&&!this.shiftFired){
      this.impulse(0,.50*this.shiftIntensity);this.impulse(1,.18*this.shiftIntensity);
      this.shiftFired=true;
     }
    }else{
     gain=1+.13*this.shiftIntensity*this.shiftLevel*Math.max(0,Math.sin(Math.PI*t/.16));
     if(t>.025&&!this.shiftFired){
      this.impulse(0,.16*this.shiftIntensity);this.impulse(1,.13*this.shiftIntensity);
      this.shiftFired=true;
     }
    }
    this.shiftPos++;
   }
   if(this.popsLeft&&--this.nextPop<=0){
    const amp=(.60+.95*this.popIntensity)*(.82+.18*(this.random()+1)/2)*Math.exp(-this.popIndex*.26);
    this.impulse(this.popIndex%2,amp);this.impulse((this.popIndex+1)%2,amp*.25);
    this.popsLeft--;this.popIndex++;
    this.nextPop=Math.round(this.sr*(.10+.08*(this.random()+1)/2+(this.popIndex-1)*.018));
   }
   let transL=0,transR=0;
   for(let k=0;k<2;k++){
    const s=this.side[k];
    s.fast*=this.fastD;s.slow*=this.slowD;
    const p=Math.max(0,s.slow-s.fast);
    s.lo+=this.lowC*(p-s.lo);s.mid+=this.midC*(p-s.mid);
    const echo=s.pipe[s.at];
    s.reflect+=this.echoC*(echo-s.reflect);
    s.pipe[s.at]=Math.tanh(p*.8+echo*.4);
    s.at=s.at+1===s.pipe.length?0:s.at+1;
    const lowRing=this.resonance(s.bass,p);
    const midRing=this.resonance(s.body,s.mid-s.lo);
    const open=1-this.muffling;
    const body=.92*s.lo+1.75*lowRing+(.23+open*.38)*(s.mid-s.lo)+(.35+open*.18)*midRing+(.25+open*.15)*s.reflect;
    const fx=Math.tanh(body*5.5)*.78;
    if(k===0)transL=fx;else transR=fx;
   }
   const mix=this.popLevel;
   const rawL=il*gain+(transL*.86+transR*.14)*mix;
   const rawR=ir*gain+(transR*.86+transL*.14)*mix;
   // Peak-Limiter mit sanfter Sättigung und DC-Entfernung.
   const sl=Math.tanh(rawL*1.04),sr=Math.tanh(rawR*1.04);
   const hl=sl-this.lastL+this.dcCoef*this.dcL;
   const hr=sr-this.lastR+this.dcCoef*this.dcR;
   this.lastL=sl;this.lastR=sr;this.dcL=hl;this.dcR=hr;
   l[i]=Math.max(-.96,Math.min(.96,hl));
   if(r!==l)r[i]=Math.max(-.96,Math.min(.96,hr));
  }
  return true;
 }
}
registerProcessor("voltune-events-v1",VoltuneEventsV1);
