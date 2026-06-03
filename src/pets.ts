import type { FloatingPetSeed } from './types';

const EMOJIS = [
  '🐱', '🐶', '🐶', '🐶', '🐰', '🐥', '🦊', '🐼', '🐸', '🐧',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐹', '🐭', '🐵',
  '🐻', '🐻‍❄️', '🐺', '🐑', '🐑', '🐑', '🐏', '🐏', '🐐', '🐐', '🦙', '🦝',
  '🦄', '🐲', '🐉', '🐴', '🦌', '🐿️', '🦔', '🦦',
  '🦥', '🦘', '🦡', '🦫', '🦜', '🦚', '🦩', '🦢',
  '🦆', '🐢', '🐙', '🦀', '🐳', '🐬', '🐟', '🦈',
  '🐌', '🦋', '🐝', '🐞', '🦖', '🦕', '😈', '😎',
  '🥚', '🥚', '🥚', '🐣', '🐣', '⭐', '🌙', '☁️', '🍀'
];

const SPECIAL_PETS = [
  { emoji: '😈', phrase: '坏蛋来了' },
  { emoji: '🥚', phrase: '聪明蛋来了' },
  { emoji: '🐑', phrase: '小羊来了' },
  { emoji: '🐏', phrase: '羊羊集合' },
  { emoji: '🐐', phrase: '山羊巡逻' },
  { emoji: '😎', phrase: '潇洒哥来了' },
  { emoji: '🐺', phrase: '黑大帅来了' },
  { emoji: '🐣', phrase: '蛋仔报道' },
  { emoji: '🐶', phrase: '小狗冲冲冲' },
  { emoji: '🥚', phrase: '蛋王登场' },
  { emoji: '🐑', phrase: '羊羊加油' }
];

const PHRASES = [
  '休息！', '喝水', '站起来', '看远处', '伸展一下', '别久坐', '眨眨眼', '放松肩颈',
  '坏蛋来了', '聪明蛋来了', '小羊来了', '羊羊催你休息', '羊羊集合', '山羊巡逻',
  '黑大帅来了', '潇洒哥来了', '蛋仔报道', '不要偷懒', '马上离屏', '活动一下',
  '去倒杯水', '转转脖子', '放松手腕', '深呼吸', '看看窗外', '起身走走',
  '护眼时间', '远离屏幕', '桌宠占领屏幕', '再忙也要休息', '今天也要健康',
  '不许硬撑', '休息小队集合', '眨眼三十次', '肩膀放下来', '腰背挺一挺',
  '喝水喝水', '摸鱼也要站起来', '坏蛋监督中', '聪明蛋盯着你', '小羊堵门中',
  '休息倒计时', '眼睛放假', '键盘暂停一下', '身体比工作重要', '站起来赢一局',
  '冲鸭！', '你超强的', '今天也很棒', '状态拉满', '回血时间到', '满血复活',
  '能量补给中', '休息后继续赢', '你是最棒的', '给自己充电', '小狗给你打气',
  '羊羊给你加油', '聪明蛋说你行', '休息一下更猛', '起来动一动', '护眼大作战',
  '休息完继续冲', '大脑正在升级', '今天也要闪闪发光'
];

export function createPetSeeds(count: number, salt: number): FloatingPetSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(index * 173 + salt * 9973);
    const useSpecialPet = index % 5 === 0;
    const specialPet = SPECIAL_PETS[Math.floor(random() * SPECIAL_PETS.length)];
    const emoji = useSpecialPet ? specialPet.emoji : EMOJIS[Math.floor(random() * EMOJIS.length)];
    const shouldShowPhrase = index % 3 === 0;

    return {
      id: shouldShowPhrase ? index * 7 : index * 7 + 1,
      emoji,
      left: Math.round(random() * 96),
      top: Math.round(random() * 92),
      size: getPetSize(emoji, random),
      delay: Number((random() * -3).toFixed(2)),
      duration: Number((2.4 + random() * 4.2).toFixed(2)),
      rotate: Math.round(random() * 42 - 21),
      phrase: useSpecialPet ? specialPet.phrase : PHRASES[Math.floor(random() * PHRASES.length)]
    };
  });
}

function getPetSize(emoji: string, random: () => number) {
  const baseSize = 44 + random() * 54;
  const isPriorityBigPet = ['🥚', '🐣', '🐶', '🐑', '🐏', '🐐'].includes(emoji);
  if (isPriorityBigPet && random() < 0.72) {
    return Math.round(76 + random() * 58);
  }
  return Math.round(baseSize);
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
