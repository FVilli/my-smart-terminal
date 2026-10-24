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
      <div class="message group flex min-h-footer items-center gap-[7px] bg-transparent px-2 text-xs leading-[1.2] text-muted" [attr.data-kind]="message.kind" data-testid="message-center" role="status" aria-live="polite">
        <span class="emoji flex-none" aria-hidden="true">{{ icon(message.kind) }}</span>
        <span class="text min-w-0 flex-1 truncate group-data-[kind=warning]:text-warning group-data-[kind=critical]:text-danger">{{ message.text }}</span>
        <button type="button" class="dismiss flex-none cursor-pointer border-0 bg-transparent px-0.5 text-sm leading-none text-muted hover:text-fg" aria-label="Dismiss message" (click)="messages.clear()">×</button>
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
