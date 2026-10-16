/* Voltune Physical Presence v1 · isoliertes Hörlabor
 * Hörbarkeitskorrektur bei laufender Musik:
 * - Kein Überschreiben der Physical Engine v0.4.
 * - Obertonanteile aus vorhandenem Motorsignal statt separater Pfeiftöne.
 * - Drei Hochpässe bei 365 Hz unterdrücken die vorhandene Tiefbassenergie;
 *   ein Tiefpass bei 2.4 kHz entfernt scharfe Artefakte.
 * - Modusabhängige Mischung: Hybrid/V8 benötigen deutlich mehr Präsenz
 *   als die bereits mittenstarken AMG/GTI/Italia-Profile.
 * - presence=0 liefert den unveränderten Eingangs-Sound.
 */
class VoltunePhysicalPresenceV1 extends AudioWorkletProcessor {
 static get parameterDescriptors(){
  return [{name:"presence",defaultValue:.75,minValue:0,maxValue:1,automationRate:"k-rate"}];
 }
 constructor(){
  super();
  this.preset="hybrid";
  this.weights=Object.freeze({
   hybrid:1.50,v8:1.20,v4:.83,v6:.80,v12:.76,
   i5:.77,ev:.95,amg:.27,gti:.23,italia:.28
  });
  this.hp=Math.exp(-2*Math.PI*365/sampleRate);
  this.lp=1-Math.exp(-2*Math.PI*2400/sampleRate);
  this.smooth=1-Math.exp(-128/(sampleRate*.055));
  this.amount=0;
  this.banks=Array.from({length:2},()=>({
   prev0:0,high0:0,prev1:0,high1:0,prev2:0,high2:0,low:0
  }));
  this.port.onmessage=event=>{
   if(!event.data||event.data.type!=="preset")return;
   const mode=event.data.value;
   if(Object.prototype.hasOwnProperty.call(this.weights,mode))this.preset=mode;
  };
 }
 process(inputs,outputs,params){
  const input=inputs[0],out=outputs[0];
  if(!out||!out[0])return true;
  const presence=Math.max(0,Math.min(1,Number(params.presence[0])||0));
  const target=presence*this.weights[this.preset];
  this.amount+=(target-this.amount)*this.smooth;
  const mix=this.amount;
  for(let channel=0;channel<out.length;channel++){
   const src=input&&(input[channel]||input[0]),dst=out[channel];
   if(!src){dst.fill(0);continue;}
   const b=this.banks[Math.min(channel,1)];
   for(let i=0;i<dst.length;i++){
    const x=Number.isFinite(src[i])?src[i]:0;
    // Weiche Sättigung erzeugt obere Motorharmonische aus der
    // vorhandenen V8-Wellenform, ohne sie durch einen Synthton zu ersetzen.
    const shaped=Math.tanh(x*9);
    const h0=this.hp*(b.high0+shaped-b.prev0);
    b.high0=h0;b.prev0=shaped;
    const h1=this.hp*(b.high1+h0-b.prev1);
    b.high1=h1;b.prev1=h0;
    const h2=this.hp*(b.high2+h1-b.prev2);
    b.high2=h2;b.prev2=h1;
    b.low+=this.lp*(h2-b.low);
    dst[i]=x+b.low*mix;
   }
  }
  return true;
 }
}
registerProcessor("voltune-physical-presence-v1",VoltunePhysicalPresenceV1);
