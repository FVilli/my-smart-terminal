import { Injectable, signal } from '@angular/core';

export type MessageKind = 'info' | 'warning' | 'critical';

export interface AppMessage {
  kind: MessageKind;
  text: string;
}

/** The single operational message area shown by the app shell. */
@Injectable({ providedIn: 'root' })
export class MessageStore {
  private readonly messageState = signal<AppMessage | null>(null);
  readonly message = this.messageState.asReadonly();

  show(kind: MessageKind, text: string): void {
    this.messageState.set({ kind, text });
  }

  clear(): void {
    this.messageState.set(null);
  }
}
