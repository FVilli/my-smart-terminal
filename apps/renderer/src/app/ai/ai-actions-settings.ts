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
        <div class="sticky bottom-0 flex items-center gap-2 border-t border-line pt-2"><button type="button" class="btn" (click)="adding.update(value => !value)" data-testid="ai-settings-add" aria-label="Add action">+</button><span class="ml-auto text-right text-[10px] uppercase tracking-wide text-muted" data-testid="ai-settings-counts">BUILT-IN:{{ builtInCount() }} CUSTOM:{{ customCount() }}</span></div>
        @if (adding()) { <div class="my-2"><label>Name <input class="field-sm w-full" aria-label="New action name" data-testid="ai-settings-new-name" [value]="newName()" (input)="newName.set(value($event))"></label><label>Description <input class="field-sm w-full" aria-label="New action description" data-testid="ai-settings-new-description" [value]="newDescription()" (input)="newDescription.set(value($event))"></label><button type="button" class="btn" data-testid="ai-settings-create" (click)="addDraft()">Create draft</button><button type="button" class="btn" data-testid="ai-settings-cancel-add" (click)="adding.set(false)">Cancel</button></div> }
      </section>
      @if (selected(); as action) { <section aria-label="Edit AI action">
        <label class="block">Title <input class="field w-full" data-testid="ai-settings-title" [disabled]="action.builtIn" [value]="action.title" (input)="patch('title', value($event))"></label>
        <label class="block">Description <input class="field w-full" data-testid="ai-settings-description" [disabled]="action.builtIn" [value]="action.description" (input)="patch('description', value($event))"></label>
        <label class="block">System template <textarea class="field w-full border font-mono" rows="6" data-testid="ai-settings-system" [value]="action.systemTemplate" (input)="patch('systemTemplate', value($event))"></textarea><small class="mt-1 block text-right text-[10px] font-normal leading-[normal] text-muted">{{ bytes(action.systemTemplate) }} / 8192 bytes</small></label>
        <label class="block">User template <textarea class="field w-full border font-mono" rows="6" data-testid="ai-settings-user" [value]="action.userTemplate" (input)="patch('userTemplate', value($event))"></textarea><small class="mt-1 block text-right text-[10px] font-normal leading-[normal] text-muted">{{ bytes(action.userTemplate) }} / 8192 bytes</small></label>
        <p class="text-muted">Placeholders: {{ placeholders }}</p>
        @if (validation().warnings.length) { <p class="text-warning">Unknown placeholders: {{ validation().warnings.join(', ') }}</p> }
        @if (validation().error) { <p class="text-danger" data-testid="ai-settings-error">{{ validation().error }}</p> }
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" class="btn inline-flex items-center gap-1.5" data-testid="ai-settings-save" [disabled]="!!validation().error || saving()" (click)="save()"><svg class="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h9l3 3v11H4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 3v5h6V3M7 13h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Save</button>
          @if (action.builtIn) { <button type="button" class="btn inline-flex items-center gap-1.5" data-testid="ai-settings-reset-one" (click)="reset()"><svg class="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Reset this action</button> }
          @if (!action.builtIn) { <button type="button" class="btn inline-flex items-center gap-1.5" data-testid="ai-settings-delete" (click)="confirmingDeleteId.set(action.id)"><svg class="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Delete</button> }
        </div>
        @if (confirmingDeleteId() === action.id) { <div class="card mt-2" role="alertdialog" aria-label="Confirm delete"><p>Delete “{{ action.title }}”?</p><button type="button" class="btn" data-testid="ai-settings-delete-confirm" (click)="remove()">Confirm</button><button type="button" class="btn" data-testid="ai-settings-delete-cancel" (click)="confirmingDeleteId.set(null)">Cancel</button></div> }
      </section> }
    </div> }
  `,
})
export class AiActionsSettings {
  private readonly api = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  readonly actions = signal<AiActionDefinition[]>([]); readonly selectedId = signal<string | null>(null);
  readonly loading = signal(true); readonly error = signal(''); readonly saving = signal(false);
  readonly adding = signal(false); readonly confirmingDeleteId = signal<string | null>(null); readonly newName = signal(''); readonly newDescription = signal('');
  readonly builtInCount = computed(() => this.actions().filter(action => action.builtIn).length);
  readonly customCount = computed(() => this.actions().filter(action => !action.builtIn).length);
  readonly selected = computed(() => this.actions().find(a => a.id === this.selectedId()) ?? null);
  readonly validation = computed(() => { const a = this.selected(); return a ? validateActionDraft(a, this.actions(), a.id) : { error: 'Select an action.', warnings: [] }; });
  readonly placeholders = '{{os}}, {{shell}}, {{envSource}}, {{terminalInfo}}, {{console}}, {{composer}}, {{action}}, {{intent}}, {{description}}, {{clipboard}}';
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
  async remove(): Promise<void> { const id = this.confirmingDeleteId(); if (!id) return; try { const result = await this.api.aiActionsDelete({ id }); this.actions.set(result.actions); this.selectedId.set(result.actions[0]?.id ?? null); this.confirmingDeleteId.set(null); this.error.set(''); } catch { this.error.set('Could not delete the action.'); } }
}
