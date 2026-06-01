import type { FloatingPetSeed } from './types';

const EMOJIS = ['🐱', '🐶', '🐰', '🐥', '🦊', '🐼', '🐸', '🐧'];
const PHRASES = ['休息！', '喝水', '站起来', '看远处', '伸展一下', '别久坐', '眨眨眼', '放松肩颈'];

export function createPetSeeds(count: number, salt: number): FloatingPetSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(index * 173 + salt * 9973);
    return {
      id: index,
      emoji: EMOJIS[Math.floor(random() * EMOJIS.length)],
      left: Math.round(random() * 96),
      top: Math.round(random() * 92),
      size: Math.round(30 + random() * 34),
      delay: Number((random() * -3).toFixed(2)),
      duration: Number((2.8 + random() * 4.8).toFixed(2)),
      rotate: Math.round(random() * 36 - 18),
      phrase: PHRASES[Math.floor(random() * PHRASES.length)]
    };
  });
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
