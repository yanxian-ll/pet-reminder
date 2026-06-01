export type PetMode = 'idle' | 'work' | 'break';

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface DeskPetSettings {
  workDays: Weekday[];
  workStart: string;
  workEnd: string;
  focusMinutes: number;
  breakMinutes: number;
  breakPetCount: number;
  autoStart: boolean;
  strictBreakOverlay: boolean;
  allowEscExit: boolean;
}

export interface FloatingPetSeed {
  id: number;
  emoji: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  rotate: number;
  phrase: string;
}
