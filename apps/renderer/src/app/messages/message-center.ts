import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageStore, type MessageKind } from './message-store';

const ICONS: Record<MessageKind, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '⛔',
};

@Component({
  selector: 'app-message-center',
  host: { class: 'block min-w-0 grow' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages.message(); as message) {
      <div class="message status-message group" [attr.data-kind]="message.kind" data-testid="message-center" role="status" aria-live="polite">
        <span class="status-message-icon" aria-hidden="true">{{ icon(message.kind) }}</span>
        <span class="status-message-text group-data-[kind=warning]:text-warning group-data-[kind=critical]:text-danger">{{ message.text }}</span>
        <button type="button" class="status-message-dismiss" aria-label="Dismiss message" (click)="messages.clear()">×</button>
      </div>
    }
  `,

})
export class MessageCenter {
  protected readonly messages = inject(MessageStore);

  protected icon(kind: MessageKind): string {
    return ICONS[kind];
  }
}
