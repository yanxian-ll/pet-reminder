let audioContext: AudioContext | null = null;

export async function playBreakChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextClass) return;

    audioContext ??= new AudioContextClass();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
    master.connect(audioContext.destination);

    [660, 880, 1175].forEach((frequency, index) => {
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * 0.16;
      const stop = start + 0.18;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(stop + 0.02);
    });
  } catch (error) {
    console.warn('Break chime failed:', error);
  }
}
