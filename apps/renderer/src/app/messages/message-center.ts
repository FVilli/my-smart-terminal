import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageStore, type MessageKind } from './message-store';

const ICONS: Record<MessageKind, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '⛔',
};

@Component({
  selector: 'app-message-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages.message(); as message) {
      <div class="message" [attr.data-kind]="message.kind" data-testid="message-center" role="status" aria-live="polite">
        <span class="emoji" aria-hidden="true">{{ icon(message.kind) }}</span>
        <span class="text">{{ message.text }}</span>
        <button type="button" class="dismiss" aria-label="Dismiss message" (click)="messages.clear()">×</button>
      </div>
    }
  `,
  styles: `
    :host { display: block; flex: none; }
    .message { display: flex; align-items: baseline; gap: 7px; padding: 3px 16px 5px; background: transparent; color: var(--text-muted); font-size: 12px; line-height: 1.45; }
    .message[data-kind='warning'] .text { color: #e0b050; }
    .message[data-kind='critical'] .text { color: var(--danger); }
    .emoji { flex: none; }
    .text { flex: 1; min-width: 0; }
    .dismiss { flex: none; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
    .dismiss:hover { color: var(--text); }
  `,
})
export class MessageCenter {
  protected readonly messages = inject(MessageStore);

  protected icon(kind: MessageKind): string {
    return ICONS[kind];
  }
}
