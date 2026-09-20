/** Route Web Audio output through a silent master gain before it reaches speakers.
 * Installed only inside our isolated game iframe, before any engine script loads.
 * The audio clock keeps running, so muting does not pause game timing.
 */
export function installAudioGate(prototype: AudioNode) {
  const connect = prototype.connect;
  const disconnect = prototype.disconnect;
  const outputs = new Map<BaseAudioContext, GainNode>();
  let muted = true;
  prototype.connect = function(this: AudioNode, destination: AudioNode | AudioParam, ...ports: number[]) {
    let target = destination;
    if (destination === this.context.destination) {
      let gain = outputs.get(this.context);
      if (!gain) {
        gain = this.context.createGain();
        gain.gain.value = muted ? 0 : 1;
        Reflect.apply(connect, gain, [this.context.destination]);
        outputs.set(this.context, gain);
      }
      target = gain;
    }
    // Preserve both connect overloads and their original return values.
    const result = Reflect.apply(connect, this, [target, ...ports]);
    return result === target ? destination : result;
  } as AudioNode['connect'];
  prototype.disconnect = function(this: AudioNode, ...args: unknown[]) {
    if (args[0] === this.context.destination && outputs.has(this.context)) {
      args[0] = outputs.get(this.context);
    }
    return Reflect.apply(disconnect, this, args);
  } as AudioNode['disconnect'];
  return {
    setMuted(value: boolean) {
      muted = value;
      for (const gain of outputs.values()) gain.gain.value = muted ? 0 : 1;
    },
  };
}
