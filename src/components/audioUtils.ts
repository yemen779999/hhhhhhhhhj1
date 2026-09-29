export const pcmToBase64 = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

export const createAudioChunkPlayer = () => {
    let nextStartTime = 0;
    return (audioCtx: AudioContext, base64: string) => {
      const binaryStr = window.atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        float32Array[i] = buffer[i] / 32768.0;
      }
      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      if (nextStartTime < audioCtx.currentTime) {
        nextStartTime = audioCtx.currentTime;
      }
      source.start(nextStartTime);
      nextStartTime += audioBuffer.duration;
      return nextStartTime;
    };
};
