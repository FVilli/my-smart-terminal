import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { AiActionDefinition, SmartTerminalApi } from '@smart-terminal/contracts';
import { defaultCustomTemplates, toCustomId, validateActionDraft } from './ai-actions-settings.logic';

@Component({
  selector: 'app-ai-actions-settings', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) { <p role="status">Loading AI actions…</p> }
    @if (error()) { <p class="text-danger" role="alert">{{ error() }}</p> }
    @if (!loading()) { <div class="grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
      <section aria-label="AI actions" class="flex min-h-0 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto space-y-2">
          @for (action of actions(); track action.id) { <button type="button" class="card block w-full text-left" [class.border-accent]="action.id === selectedId()" [attr.data-testid]="'ai-settings-action-' + action.id" [attr.aria-pressed]="action.id === selectedId()" (click)="select(action.id)"><span class="block font-semibold">{{ action.title }}</span><span class="block text-xs text-muted">{{ action.description }}</span><span class="text-[11px] uppercase tracking-wide text-muted">{{ action.builtIn ? 'Built-in' : 'Custom' }}</span></button> }
        </div>
        @if (confirmingReset()) { <div class="card mt-2" role="alertdialog" aria-label="Confirm reset"><p>Restore the five built-in templates to their defaults? Custom actions are kept.</p><button type="button" class="btn" data-testid="ai-settings-reset-confirm" (click)="resetBuiltIns()">Confirm</button><button type="button" class="btn" data-testid="ai-settings-reset-cancel" (click)="confirmingReset.set(false)">Cancel</button></div> }
        <div class="sticky bottom-0 flex justify-between gap-2 border-t border-line bg-card pt-2"><button type="button" class="btn" (click)="adding.update(value => !value)" data-testid="ai-settings-add" aria-label="Add action">+</button><button type="button" class="btn" (click)="confirmingReset.set(true)" data-testid="ai-settings-reset" aria-label="Reset built-in templates">Reset</button></div>
        @if (adding()) { <div class="my-2"><label>Name <input class="field-sm w-full" aria-label="New action name" data-testid="ai-settings-new-name" [value]="newName()" (input)="newName.set(value($event))"></label><label>Description <input class="field-sm w-full" aria-label="New action description" data-testid="ai-settings-new-description" [value]="newDescription()" (input)="newDescription.set(value($event))"></label><button type="button" class="btn" data-testid="ai-settings-create" (click)="addDraft()">Create draft</button><button type="button" class="btn" data-testid="ai-settings-cancel-add" (click)="adding.set(false)">Cancel</button></div> }
      </section>
      @if (selected(); as action) { <section aria-label="Edit AI action">
        <label class="block">Title <input class="field w-full" data-testid="ai-settings-title" [disabled]="action.builtIn" [value]="action.title" (input)="patch('title', value($event))"></label>
        <label class="block">Description <input class="field w-full" data-testid="ai-settings-description" [disabled]="action.builtIn" [value]="action.description" (input)="patch('description', value($event))"></label>
        <label class="block">System template <textarea class="field w-full border font-mono" rows="6" data-testid="ai-settings-system" [value]="action.systemTemplate" (input)="patch('systemTemplate', value($event))"></textarea><small>{{ bytes(action.systemTemplate) }} / 8192 bytes</small></label>
        <label class="block">User template <textarea class="field w-full border font-mono" rows="6" data-testid="ai-settings-user" [value]="action.userTemplate" (input)="patch('userTemplate', value($event))"></textarea><small>{{ bytes(action.userTemplate) }} / 8192 bytes</small></label>
        <p class="text-muted">Placeholders: {{ placeholders }}</p>
        @if (validation().warnings.length) { <p class="text-warning">Unknown placeholders: {{ validation().warnings.join(', ') }}</p> }
        @if (validation().error) { <p class="text-danger" data-testid="ai-settings-error">{{ validation().error }}</p> }
        <button type="button" class="btn" data-testid="ai-settings-save" [disabled]="!!validation().error || saving()" (click)="save()">Save</button>
        @if (action.builtIn) { <button type="button" class="btn" data-testid="ai-settings-reset-one" (click)="reset()">Reset this action</button> }
        @if (!action.builtIn) { <button type="button" class="btn" data-testid="ai-settings-delete" (click)="remove()">Delete</button> }
      </section> }
    </div> }
  `,
})
export class AiActionsSettings {
  private readonly api = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  readonly actions = signal<AiActionDefinition[]>([]); readonly selectedId = signal<string | null>(null);
  readonly loading = signal(true); readonly error = signal(''); readonly saving = signal(false);
  readonly adding = signal(false); readonly confirmingReset = signal(false); readonly newName = signal(''); readonly newDescription = signal('');
  readonly selected = computed(() => this.actions().find(a => a.id === this.selectedId()) ?? null);
  readonly validation = computed(() => { const a = this.selected(); return a ? validateActionDraft(a, this.actions(), a.id) : { error: 'Select an action.', warnings: [] }; });
  readonly placeholders = '{{os}}, {{shell}}, {{envSource}}, {{terminalInfo}}, {{console}}, {{composer}}, {{action}}, {{intent}}, {{description}}';
  constructor() { void this.refresh(); }
  value(event: Event): string { return (event.target as HTMLInputElement | HTMLTextAreaElement).value; }
  bytes(text: string): number { return new TextEncoder().encode(text).length; }
  select(id: string): void { this.selectedId.set(id); }
  patch(key: 'title'|'description'|'systemTemplate'|'userTemplate', value: string): void { this.actions.update(list => list.map(a => a.id === this.selectedId() ? { ...a, [key]: value } : a)); }
  addDraft(): void {
    const name = this.newName().trim(), description = this.newDescription().trim();
    if (!name || !description || this.actions().filter(a => !a.builtIn).length >= 20) return;
    const templates = defaultCustomTemplates(description), action: AiActionDefinition = { id: toCustomId(name, this.actions().map(a => a.id)), title: name, description, ...templates, builtIn: false };
    this.actions.update(list => [...list, action]); this.selectedId.set(action.id); this.adding.set(false); this.newName.set(''); this.newDescription.set('');
  }
  async refresh(): Promise<void> { this.loading.set(true); try { const result = await this.api.aiActionsList(); this.actions.set(result.actions); if (!this.selectedId() || !result.actions.some(a => a.id === this.selectedId())) this.selectedId.set(result.actions[0]?.id ?? null); this.error.set(''); } catch { this.error.set('Could not load AI actions.'); } finally { this.loading.set(false); } }
  async save(): Promise<void> { const action = this.selected(); if (!action || this.validation().error) return; this.saving.set(true); try { const result = await this.api.aiActionsSave({ action }); this.actions.set(result.actions); this.selectedId.set(action.id); this.error.set(''); } catch { this.error.set('Could not save the action.'); } finally { this.saving.set(false); } }
  async reset(): Promise<void> { const id = this.selectedId(); if (!id) return; try { const result = await this.api.aiActionsReset({ id }); this.actions.set(result.actions); this.error.set(''); } catch { this.error.set('Could not save the action.'); } }
  async resetBuiltIns(): Promise<void> {
    this.error.set('');
    try {
      for (const id of ['suggest-command', 'explain-command', 'assess-risk', 'fix-message', 'rewrite-dictated']) {
        const result = await this.api.aiActionsReset({ id }); this.actions.set(result.actions);
      }
      this.confirmingReset.set(false);
    } catch { this.error.set('Could not reset built-in actions.'); }
  }
  async remove(): Promise<void> { const id = this.selectedId(); if (!id) return; try { const result = await this.api.aiActionsDelete({ id }); this.actions.set(result.actions); this.selectedId.set(result.actions[0]?.id ?? null); this.error.set(''); } catch { this.error.set('Could not save the action.'); } }
}
