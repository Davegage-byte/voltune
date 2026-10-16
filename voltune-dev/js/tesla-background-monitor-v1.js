/* Voltune Tesla background diagnostic. Transparent audio pass-through.
 * Counts actual WebAudio render frames; reports once every ~2 seconds.
 * No microphone, network, GPS position, or recording.
 */
class VoltuneBackgroundMonitorV1 extends AudioWorkletProcessor {
 constructor(){
  super();
  this.frames=0;
  this.lastSent=0;
  this.sr=sampleRate;
 }
 process(inputs,outputs){
  const input=inputs[0]||[],output=outputs[0]||[];
  for(let channel=0;channel<output.length;channel++){
   const src=input[channel]||input[0],dst=output[channel];
   if(src)dst.set(src);
   else dst.fill(0);
  }
  const n=output[0]?.length||128;
  this.frames+=n;
  if(this.frames-this.lastSent>=this.sr*2){
   this.lastSent=this.frames;
   this.port.postMessage({renderSeconds:this.frames/this.sr});
  }
  return true;
 }
}
registerProcessor("voltune-background-monitor-v1",VoltuneBackgroundMonitorV1);
