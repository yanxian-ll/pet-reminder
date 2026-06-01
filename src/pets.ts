import type { FloatingPetSeed } from './types';

const EMOJIS = [
  '🐱', '🐶', '🐰', '🐥', '🦊', '🐼', '🐸', '🐧',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐹', '🐭', '🐵',
  '🐻', '🐻‍❄️', '🐺', '🐑', '🐐', '🦙', '🦝', '🦄', '🐲'
];

const SPECIAL_PETS = [
  { emoji: '🐺', phrase: '黑大帅风格' },
  { emoji: '😎', phrase: '潇洒哥风格' },
  { emoji: '🐑', phrase: '羊羊集合' },
  { emoji: '🐏', phrase: '小羊来了' },
  { emoji: '🐐', phrase: '山羊巡逻' }
];

const PHRASES = [
  '休息！', '喝水', '站起来', '看远处', '伸展一下', '别久坐', '眨眨眼', '放松肩颈',
  '黑大帅来了', '潇洒哥登场', '羊羊催你休息', '不要偷懒', '马上离屏', '活动一下'
];

export function createPetSeeds(count: number, salt: number): FloatingPetSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(index * 173 + salt * 9973);
    const useSpecialPet = index % 9 === 0;
    const specialPet = SPECIAL_PETS[Math.floor(random() * SPECIAL_PETS.length)];

    return {
      id: index,
      emoji: useSpecialPet ? specialPet.emoji : EMOJIS[Math.floor(random() * EMOJIS.length)],
      left: Math.round(random() * 96),
      top: Math.round(random() * 92),
      // Break pets are intentionally larger so the break screen feels more unavoidable.
      size: Math.round(46 + random() * 50),
      delay: Number((random() * -3).toFixed(2)),
      duration: Number((2.4 + random() * 4.2).toFixed(2)),
      rotate: Math.round(random() * 44 - 22),
      phrase: useSpecialPet ? specialPet.phrase : PHRASES[Math.floor(random() * PHRASES.length)]
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
