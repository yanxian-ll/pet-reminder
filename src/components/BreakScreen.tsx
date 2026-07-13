import { formatDuration } from '../time';
import type { FloatingPetSeed } from '../types';
import { PetCloud } from './PetCloud';

export function BreakScreen(props: {
  pets: FloatingPetSeed[];
  remainingSeconds: number;
  exitDigit: string;
  allowShortcutExit: boolean;
  onExtendOne: () => void;
  onExtendFive: () => void;
  onEndBreak: () => void;
}) {
  return (
    <section className="break-screen">
      <div className="break-message" role="dialog" aria-label="休息提醒">
        <div className="message-pet">🐱</div>
        <h1>休息时间到！</h1>
        <p>站起来走一走，看看远处，喝口水。桌宠们会陪你休息。</p>
        <strong className="countdown">{formatDuration(props.remainingSeconds)}</strong>
        {props.allowShortcutExit && (
          <p className="shortcut-note">按数字键 <kbd>{props.exitDigit}</kbd> 提前结束休息</p>
        )}
        <div className="break-actions">
          <button onClick={props.onExtendOne}>再休息 1 分钟</button>
          <button onClick={props.onExtendFive}>再休息 5 分钟</button>
          <button className="secondary-action" onClick={props.onEndBreak}>结束休息</button>
        </div>
      </div>
      <PetCloud pets={props.pets} />
    </section>
  );
}
