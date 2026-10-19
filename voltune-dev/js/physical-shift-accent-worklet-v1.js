/* Voltune Shift Accent v1 (Physical Engine only)
 * Separate short, midrange shift attack AFTER the motor compressor.
 * No change to the motor generator, compressor, v4 events, or shift cut.
 * Still passes through acceleration/master gain and final stereo limiter.
 */
class VoltuneShiftAccentV1 extends AudioWorkletProcessor {
 static get parameterDescriptors() {
  return [{name:"strength",defaultValue:.7,minValue:0,maxValue:1,automationRate:"k-rate"}];
 }
 constructor(){
  super();
  const sr=sampleRate;
  this.sr=sr;this.seed=0xa6bd28c1;
  this.samplesLeft=0;this.elapsed=0;this.eventIntensity=0;this.up=true;
  this.low=[0,0];this.mid=[0,0];this.prev=[0,0];
  this.hpCoef=Math.exp(-2*Math.PI*360/sr);
  this.lpCoef=1-Math.exp(-2*Math.PI*2300/sr);
  this.resD=Math.exp(-2*Math.PI*680/sr);
  this.strength=.7;
  this.smooth=1-Math.exp(-1/(sr*.022));
  this.port.onmessage=e=>{
   const m=e.data||{};
   if((m.type!=="upshift"&&m.type!=="downshift")||!Number.isFinite(m.intensity))return;
   this.elapsed=0;
   this.samplesLeft=Math.round(sr*(m.type==="upshift"?.092:.075));
   this.eventIntensity=Math.min(1,Math.max(0,m.intensity));
   this.up=m.type==="upshift";
  };
 }
 random(){
  let s=this.seed;s^=s<<13;s^=s>>>17;s^=s<<5;
  this.seed=s>>>0;return (this.seed/2147483648)-1;
 }
 process(inputs,outputs,params){
  const out=outputs[0];if(!out||!out[0])return true;
  const l=out[0],r=out[1]||l;
  for(let i=0;i<l.length;i++){
   this.strength+=(params.strength[0]-this.strength)*this.smooth;
   if(this.samplesLeft<=0||this.strength<.0001){
    l[i]=0;if(r!==l)r[i]=0;
    if(this.samplesLeft>0){this.elapsed++;this.samplesLeft--;}
    continue;
   }
   const t=this.elapsed/this.sr;
   // Percussive exhaust snap, not a note or beep: band-limited noise
   // plus a short damped resonance, with a very subtle second crack.
   const attack=Math.min(1,t/.0018);
   const tail=Math.exp(-t/(this.up?.025:.020));
   const doublet=t>=.021? .36*Math.exp(-(t-.021)/.013):0;
   const envelope=attack*(tail+doublet);
   for(let ch=0;ch<2;ch++){
    const noise=this.random();
    const hi=this.hpCoef*(this.prev[ch]+noise-this.low[ch]);
    this.low[ch]=noise;this.prev[ch]=hi;
    this.mid[ch]+=this.lpCoef*(hi-this.mid[ch]);
    // Short, damped body around a percussive engine/exhaust transient.
    const ringPhase=2*Math.PI*(this.up?610:485)*t + (ch===1?.35:0);
    const body=Math.sin(ringPhase)*Math.exp(-t/(this.up?.021:.026));
    const sample=(.77*this.mid[ch]+.23*body)*envelope*
       this.eventIntensity*Math.pow(this.strength,1.10)*.56;
    // Main output is intentionally modest; audible midrange bite without
    // constantly feeding the final peak limiter.
    if(ch===0)l[i]=Math.max(-.25,Math.min(.25,sample));
    else if(r!==l)r[i]=Math.max(-.25,Math.min(.25,sample));
   }
   this.elapsed++;this.samplesLeft--;
  }
  return true;
 }
}
registerProcessor("voltune-shift-accent-v1",VoltuneShiftAccentV1);
