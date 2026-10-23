import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  AI_PROVIDERS,
  STT_PROVIDERS,
  type AiProvider,
  type OnboardingConfig,
  type OnboardingSaveResult,
  type OnboardingState,
  type SmartTerminalApi,
  type SttProvider,
} from '@smart-terminal/contracts';

type Step = 1 | 2 | 3;
type MicState = 'idle' | 'checking' | 'ok' | 'denied' | 'unavailable';

const MIC_MESSAGES: Record<MicState, string> = {
  idle: '',
  checking: 'Richiesta permesso microfono…',
  ok: 'Microfono disponibile. Nessuna registrazione salvata.',
  denied: 'Permesso microfono negato. Puoi continuare senza.',
  unavailable: 'Nessun microfono disponibile. Puoi continuare senza.',
};

/** Wizard di primo avvio a tre step (repo dati, AI, STT): overlay non bloccante per il terminale sottostante. */
@Component({
  selector: 'app-onboarding-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="backdrop" data-testid="onboarding-overlay">
        <section class="dialog" role="dialog" aria-modal="true" aria-label="Configurazione iniziale">
          <header>
            <h2>Configurazione iniziale</h2>
            <span class="steps" data-testid="onboarding-progress">Passo {{ step() }} di 3</span>
          </header>

          @if (restartNotice()) {
            <div class="done" data-testid="onboarding-restart-notice">
              <p>Configurazione salvata. Per applicare repo dati, macchina o remote serve riavviare l'app.</p>
              @for (warning of warnings(); track warning) {
                <p class="warning" data-testid="onboarding-warning">{{ warning }}</p>
              }
              <footer>
                <button type="button" data-testid="onboarding-restart" (click)="relaunch()">Riavvia app</button>
                <button type="button" data-testid="onboarding-close" (click)="visible.set(false)">Più tardi</button>
              </footer>
            </div>
          } @else {
            @if (state()?.reason === 'corrupt') {
              <p class="warning" data-testid="onboarding-corrupt">La configurazione precedente non era valida ed è stata messa da parte.</p>
            }
            @switch (step()) {
              @case (1) {
                <div data-testid="onboarding-step-1">
                  <label>Nome macchina
                    <input data-testid="onboarding-machine" [value]="config().machineName" (input)="patch({ machineName: value($event) })" />
                  </label>
                  @if (errors()['machineName']; as message) { <p class="error" data-testid="onboarding-error-machine">{{ message }}</p> }
                  <label>Repo dati (percorso assoluto)
                    <input data-testid="onboarding-repo" [value]="config().dataRepoPath" (input)="patch({ dataRepoPath: value($event) })" />
                  </label>
                  @if (errors()['dataRepoPath']; as message) { <p class="error" data-testid="onboarding-error-repo">{{ message }}</p> }
                  <label>Remote Git (opzionale)
                    <input data-testid="onboarding-remote" [value]="config().dataRepoRemote ?? ''" (input)="patch({ dataRepoRemote: value($event) })" />
                  </label>
                  @if (errors()['dataRepoRemote']; as message) { <p class="error" data-testid="onboarding-error-remote">{{ message }}</p> }
                </div>
              }
              @case (2) {
                <div data-testid="onboarding-step-2">
                  <label>Provider AI
                    <select data-testid="onboarding-ai-provider" [value]="config().aiProvider" (change)="patch({ aiProvider: aiProvider($event) })">
                      @for (provider of aiProviders; track provider) {
                        <option [value]="provider" [selected]="provider === config().aiProvider">{{ provider }}</option>
                      }
                    </select>
                  </label>
                  @if (config().aiProvider !== 'none') {
                    <label>Base URL (opzionale)
                      <input data-testid="onboarding-ai-url" [value]="config().aiBaseUrl ?? ''" (input)="patch({ aiBaseUrl: value($event) })" />
                    </label>
                    @if (errors()['aiBaseUrl']; as message) { <p class="error" data-testid="onboarding-error-ai-url">{{ message }}</p> }
                    <label>Modello (opzionale)
                      <input data-testid="onboarding-ai-model" [value]="config().aiModel ?? ''" (input)="patch({ aiModel: value($event) })" />
                    </label>
                    <label>Token (opzionale, solo keychain)
                      <input type="password" autocomplete="off" data-testid="onboarding-ai-token" [value]="aiToken()" (input)="aiToken.set(value($event))" />
                    </label>
                    @if (!state()?.secureStorage) {
                      <p class="warning" data-testid="onboarding-keychain-warning">Keychain non disponibile: il token resterà solo in memoria.</p>
                    }
                  }
                </div>
              }
              @case (3) {
                <div data-testid="onboarding-step-3">
                  <label>Provider STT
                    <select data-testid="onboarding-stt-provider" [value]="config().sttProvider" (change)="patch({ sttProvider: sttProvider($event) })">
                      @for (provider of sttProviders; track provider) {
                        <option [value]="provider" [selected]="provider === config().sttProvider">{{ provider }}</option>
                      }
                    </select>
                  </label>
                  @if (config().sttProvider !== 'none') {
                    <label>Modello (opzionale)
                      <input data-testid="onboarding-stt-model" [value]="config().sttModel ?? ''" (input)="patch({ sttModel: value($event) })" />
                    </label>
                    @if (config().sttProvider === 'cloud') {
                      <label>Token (opzionale, solo keychain)
                        <input type="password" autocomplete="off" data-testid="onboarding-stt-token" [value]="sttToken()" (input)="sttToken.set(value($event))" />
                      </label>
                    }
                  }
                  <button type="button" data-testid="onboarding-mic-check" (click)="checkMicrophone()">Verifica microfono</button>
                  <p class="hint" data-testid="onboarding-mic-status" role="status">{{ micMessage() }}</p>
                </div>
              }
            }
            @if (errors()['config']; as message) { <p class="error" data-testid="onboarding-error-config">{{ message }}</p> }
            @for (warning of warnings(); track warning) {
              <p class="warning" data-testid="onboarding-warning">{{ warning }}</p>
            }
            <footer>
              @if (step() === 1) {
                <button type="button" data-testid="onboarding-defaults" [disabled]="busy()" (click)="useDefaults()">Usa valori predefiniti</button>
              } @else {
                <button type="button" data-testid="onboarding-back" [disabled]="busy()" (click)="back()">Indietro</button>
              }
              @if (step() > 1) {
                <button type="button" data-testid="onboarding-skip-step" [disabled]="busy()" (click)="skipStep()">Salta</button>
              }
              @if (step() < 3) {
                <button type="button" data-testid="onboarding-next" [disabled]="busy()" (click)="next()">Avanti</button>
              } @else {
                <button type="button" data-testid="onboarding-save" [disabled]="busy()" (click)="save()">Salva</button>
              }
            </footer>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(5, 8, 11, 0.7); }
    .dialog { width: min(520px, 92vw); max-height: 90vh; overflow: auto; padding: 20px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-family: var(--font-ui); }
    header { display: flex; justify-content: space-between; align-items: baseline; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .steps, .hint { color: var(--text-muted); font-size: 12px; }
    label { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 2px; font-size: 13px; }
    input, select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); }
    .error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
    .warning { margin: 8px 0 0; color: #e0b050; font-size: 12px; }
    footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    [data-testid='onboarding-mic-check'] { margin-top: 12px; }
  `,
})
export class OnboardingWizard {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  protected readonly aiProviders = AI_PROVIDERS;
  protected readonly sttProviders = STT_PROVIDERS;
  protected readonly visible = signal(false);
  protected readonly step = signal<Step>(1);
  protected readonly state = signal<OnboardingState | null>(null);
  protected readonly config = signal<OnboardingConfig>({ machineName: '', dataRepoPath: '', aiProvider: 'none', sttProvider: 'none' });
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly warnings = signal<readonly string[]>([]);
  protected readonly busy = signal(false);
  protected readonly restartNotice = signal(false);
  protected readonly aiToken = signal('');
  protected readonly sttToken = signal('');
  protected readonly micState = signal<MicState>('idle');

  constructor() {
    void this.api.onboardingState().then(
      (state) => {
        this.state.set(state);
        this.config.set(state.config);
        this.visible.set(state.required);
      },
      () => undefined,
    );
  }

  protected micMessage(): string {
    return MIC_MESSAGES[this.micState()];
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected aiProvider(event: Event): AiProvider {
    return AI_PROVIDERS.find((provider) => provider === this.value(event)) ?? 'none';
  }

  protected sttProvider(event: Event): SttProvider {
    return STT_PROVIDERS.find((provider) => provider === this.value(event)) ?? 'none';
  }

  protected patch(change: Partial<OnboardingConfig>): void {
    this.config.update((current) => ({ ...current, ...change }));
  }

  /** Rimuove i campi opzionali vuoti prima dell'invio al main. */
  private payload(): OnboardingConfig {
    const { dataRepoRemote, aiBaseUrl, aiModel, sttModel, ...required } = this.config();
    const optional = { dataRepoRemote, aiBaseUrl, aiModel, sttModel };
    const kept = Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined && value.trim() !== ''));
    return { ...required, ...kept };
  }

  protected async next(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.api.onboardingValidate({ config: this.payload() });
      const current = this.step();
      const relevant = current === 1 ? ['machineName', 'dataRepoPath', 'dataRepoRemote'] : ['aiProvider', 'aiBaseUrl', 'aiModel'];
      const errors = Object.fromEntries(Object.entries(result.errors).filter(([field]) => relevant.includes(field)));
      this.errors.set(errors);
      if (Object.keys(errors).length === 0 && current < 3) {
        this.step.set((current + 1) as Step);
      }
    } catch {
      this.errors.set({ config: 'Validazione non riuscita.' });
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.errors.set({});
    this.step.update((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  /** Salta lo step corrente: provider `none` e nessun token. */
  protected skipStep(): void {
    if (this.step() === 2) {
      this.patch({ aiProvider: 'none' });
      this.aiToken.set('');
      this.errors.set({});
      this.step.set(3);
    } else if (this.step() === 3) {
      this.patch({ sttProvider: 'none' });
      this.sttToken.set('');
      void this.save();
    }
  }

  protected async checkMicrophone(): Promise<void> {
    this.micState.set('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) {
        track.stop();
      }
      this.micState.set('ok');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this.micState.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    try {
      const config = this.payload();
      const result = await this.api.onboardingSave({
        config,
        ...(this.aiToken() !== '' && config.aiProvider !== 'none' ? { aiToken: this.aiToken() } : {}),
        ...(this.sttToken() !== '' && config.sttProvider === 'cloud' ? { sttToken: this.sttToken() } : {}),
      });
      this.handleResult(result);
    } catch {
      this.errors.set({ config: 'Salvataggio non riuscito.' });
    } finally {
      this.aiToken.set('');
      this.sttToken.set('');
      this.busy.set(false);
    }
  }

  protected async useDefaults(): Promise<void> {
    this.busy.set(true);
    try {
      this.handleResult(await this.api.onboardingSkip());
    } catch {
      this.errors.set({ config: 'Salvataggio non riuscito.' });
    } finally {
      this.busy.set(false);
    }
  }

  private handleResult(result: OnboardingSaveResult): void {
    this.errors.set(result.errors);
    this.warnings.set(result.warnings);
    if (!result.ok) {
      const fields = Object.keys(result.errors);
      if (fields.some((field) => ['machineName', 'dataRepoPath', 'dataRepoRemote'].includes(field))) {
        this.step.set(1);
      }
      return;
    }
    if (result.restartRequired) {
      this.restartNotice.set(true);
    } else if (result.warnings.length === 0) {
      this.visible.set(false);
    } else {
      // Mostra il warning keychain prima di chiudere.
      this.restartNotice.set(false);
      setTimeout(() => this.visible.set(false), 2500);
    }
  }

  protected relaunch(): void {
    void this.api.appRelaunch();
  }
}
