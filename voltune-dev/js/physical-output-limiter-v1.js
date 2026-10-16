/* Voltune Physical Events Output Limiter v1.
 * Safety stage for isolated sound laboratories (not original Voltune).
 * Stereo-linked peak containment with 75ms release.
 * Input may exceed 0 dBFS inside WebAudio; output limited to +/-0.965.
 */
class VoltunePhysicalOutputLimiterV1 extends AudioWorkletProcessor {
 constructor(){
  super();
  this.ceiling=0.965;
  this.linkedGain=1;
  this.release=1-Math.exp(-1/(sampleRate*.075));
 }
 process(inputs,outputs){
  const input=inputs[0],out=outputs[0];
  if(!out||!out[0])return true;
  const l=out[0],r=out[1]||l;
  const srcL=input&&input[0],srcR=input&&(input[1]||input[0]);
  for(let i=0;i<l.length;i++){
   const a=srcL?srcL[i]:0,b=srcR?srcR[i]:a;
   const peak=Math.max(Math.abs(a),Math.abs(b));
   if(!Number.isFinite(peak)){
    l[i]=0;if(r!==l)r[i]=0;this.linkedGain=1;continue;
   }
   const needed=peak>this.ceiling?this.ceiling/peak:1;
   // Immediate peak protection; release gradually for fewer level jumps.
   this.linkedGain=needed<this.linkedGain?
     needed:this.linkedGain+(needed-this.linkedGain)*this.release;
   l[i]=Math.max(-this.ceiling,Math.min(this.ceiling,a*this.linkedGain));
   if(r!==l)r[i]=Math.max(-this.ceiling,Math.min(this.ceiling,b*this.linkedGain));
  }
  return true;
 }
}
registerProcessor("voltune-physical-output-limiter-v1",VoltunePhysicalOutputLimiterV1);
