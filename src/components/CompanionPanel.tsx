import { formatDuration } from '../time';
import type { EventReminder, PetMode } from '../types';

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CompanionPanel(props: {
  mode: PetMode;
  statusText: string;
  remainingSeconds: number;
  activeEventReminder: EventReminder | null;
  doNotDisturbUntil: number;
  onStartBreak: () => void;
  onPauseToggle: () => void;
  onDoNotDisturb: () => void;
  onOpenSettings: () => void;
  onHideCompanionPanel: () => void;
  onDismissEventReminder: () => void;
  onSnoozeEventReminder: () => void;
  onStartDrag: () => void;
}) {
  const dndActive = props.doNotDisturbUntil > Date.now();

  return (
    <section className="companion">
      <div className="pet-card">
        <div className="drag-handle" onMouseDown={props.onStartDrag} title="拖动桌宠" aria-label="拖动桌宠" />
        <button className="icon-button settings-button" onClick={props.onOpenSettings} title="设置" aria-label="设置">
          ⚙️
        </button>
        <button className="icon-button hide-button" onClick={props.onHideCompanionPanel} title="隐藏面板" aria-label="隐藏面板">
          🙈
        </button>
        <div className="single-pet" aria-label="桌宠" onMouseDown={props.onStartDrag}>🐱</div>
        <div className="speech" aria-live="polite">
          <strong>{props.activeEventReminder ? '事件提醒' : props.statusText}</strong>
          <span>
            {props.activeEventReminder
              ? props.activeEventReminder.title
              : dndActive
                ? `勿扰至 ${formatClock(props.doNotDisturbUntil)}`
                : props.mode === 'work'
                  ? `下次休息 ${formatDuration(props.remainingSeconds)}`
                  : props.mode === 'paused'
                    ? `剩余 ${formatDuration(props.remainingSeconds)}`
                    : '到工作时段我会提醒你'}
          </span>
        </div>
        {props.activeEventReminder ? (
          <div className="actions reminder-actions">
            <button onClick={props.onSnoozeEventReminder}>10 分钟后</button>
            <button className="secondary-action" onClick={props.onDismissEventReminder}>知道了</button>
          </div>
        ) : (
          <div className="actions quick-actions">
            <button onClick={props.onStartBreak}>立即休息</button>
            <button className="secondary-action" onClick={props.onPauseToggle}>
              {props.mode === 'paused' ? '继续' : '暂停'}
            </button>
            <button className="secondary-action" onClick={props.onDoNotDisturb}>勿扰 30 分钟</button>
          </div>
        )}
      </div>
    </section>
  );
}
