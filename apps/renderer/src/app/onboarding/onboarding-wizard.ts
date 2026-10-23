import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import {
  AI_PROVIDERS,
  STT_PROVIDERS,
  TERMINAL_FONTS,
  type TerminalFontId,
  type AiProvider,
  type OnboardingConfig,
  type OnboardingSaveResult,
  type HelpTopic,
  type RemoteSetupResult,
  type SetupTestAiResult,
  type OnboardingState,
  type SmartTerminalApi,
  type SttProvider,
  type SttResponseFormat,
} from '@smart-terminal/contracts';
import { SttStore } from '../stt/stt-store';
import { SettingsStore } from '../settings/settings-store';
import { AppearanceStore } from '../appearance/appearance-store';

type Step = 1 | 2 | 3 | 4;
type MicState = 'idle' | 'checking' | 'ok' | 'denied' | 'unavailable';

const MIC_MESSAGES: Record<MicState, string> = {
  idle: '',
  checking: 'Requesting microphone permission…',
  ok: 'Microphone available. No recording is saved.',
  denied: 'Microphone permission denied. You can continue without it.',
  unavailable: 'No microphone available. You can continue without it.',
};

/** Three-step first-run wizard (data repository, AI, STT): non-blocking overlay for the underlying terminal. */
@Component({
  selector: 'app-onboarding-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (visible()) {
      <div class="backdrop" data-testid="onboarding-overlay">
        <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="editMode() ? 'Settings' : 'Initial setup'">
          <header>
            <h2>{{ editMode() ? 'Settings' : 'Initial setup' }}</h2>
            @if (!editMode()) { <span class="steps" data-testid="onboarding-progress">Step {{ step() }} of 3</span> }
          </header>

          @if (restartNotice()) {
            <div class="done" data-testid="onboarding-restart-notice">
              <p>Configuration saved. Restart the app to apply the data repository, machine or remote changes.</p>
              @for (warning of warnings(); track warning) {
                <p class="warning" data-testid="onboarding-warning">{{ warning }}</p>
              }
              <footer>
                <button type="button" data-testid="onboarding-restart" (click)="relaunch()">Restart app</button>
                <button type="button" data-testid="onboarding-close" (click)="visible.set(false)">Later</button>
              </footer>
            </div>
          } @else {
            @if (editMode()) {
              <div role="tablist" aria-label="Settings sections" class="settings-tabs">
                <button type="button" role="tab" data-testid="settings-tab-repository" [attr.aria-selected]="step() === 1" (click)="selectTab(1)">Repository</button>
                <button type="button" role="tab" data-testid="settings-tab-ai" [attr.aria-selected]="step() === 2" (click)="selectTab(2)">AI</button>
                <button type="button" role="tab" data-testid="settings-tab-stt" [attr.aria-selected]="step() === 3" (click)="selectTab(3)">STT</button>
                <button type="button" role="tab" data-testid="settings-tab-appearance" [attr.aria-selected]="step() === 4" (click)="selectTab(4)">Appearance</button>
              </div>
            }
            @if (state()?.reason === 'corrupt') {
              <p class="warning" data-testid="onboarding-corrupt">The previous configuration was invalid and has been set aside.</p>
            }
            @switch (step()) {
              @case (1) {
                <div data-testid="onboarding-step-1">
                  <label>Machine name
                    <input data-testid="onboarding-machine" [value]="config().machineName" (input)="patch({ machineName: value($event) })" />
                  </label>
                  @if (errors()['machineName']; as message) { <p class="error" data-testid="onboarding-error-machine">{{ message }}</p> }
                  <label>Data repository (absolute path)
                    <input data-testid="onboarding-repo" [value]="config().dataRepoPath" (input)="patch({ dataRepoPath: value($event) })" />
                  </label>
                  @if (errors()['dataRepoPath']; as message) { <p class="error" data-testid="onboarding-error-repo">{{ message }}</p> }
                  <label>Git remote (optional)
                    <input data-testid="onboarding-remote" [value]="config().dataRepoRemote ?? ''" (input)="patch({ dataRepoRemote: value($event) })" />
                  </label>
                  @if (errors()['dataRepoRemote']; as message) { <p class="error" data-testid="onboarding-error-remote">{{ message }}</p> }
                  <div class="test-row">
                    <button type="button" data-testid="onboarding-test-remote" [disabled]="busy() || testingRemote()" (click)="testRemoteRepository()">
                      {{ testingRemote() ? 'Testing…' : 'Test repository' }}
                    </button>
                    <span class="hint">Verifies a real commit and push by registering this installation.</span>
                  </div>
                  @if (remoteResult(); as result) {
                    <p class="remote-result" [class.ok]="result.ok" [class.error]="!result.ok" data-testid="onboarding-remote-result" role="status">
                      @if (result.ok) {
                        @if (result.localOnly) {
                          Repository verified locally ({{ result.commit?.slice(0, 8) }}); no remote configured. This is a local-only commit.
                        } @else {
                          Repository verified: commit {{ result.commit?.slice(0, 8) }} pushed to the remote.
                        }
                      } @else {
                        Repository test failed: {{ result.error }}. {{ result.committed ? 'A local commit was kept; fix the remote and retry to push it.' : 'Nothing was committed.' }}
                      }
                    </p>
                  }
                  <button type="button" class="help-link" data-testid="onboarding-help-repository" (click)="openHelp('repository')">Repository setup guide</button>
                </div>
              }
              @case (2) {
                <div data-testid="onboarding-step-2">
                  <label>AI provider
                    <select data-testid="onboarding-ai-provider" [value]="config().aiProvider" (change)="patch({ aiProvider: aiProvider($event) })">
                      @for (provider of aiProviders; track provider) {
                        <option [value]="provider" [selected]="provider === config().aiProvider">{{ provider === 'openai-compatible' ? 'OpenAI-compatible (self-hosted)' : provider }}</option>
                      }
                    </select>
                  </label>
                  @if (config().aiProvider !== 'none') {
                    <label>Base URL (optional)
                      <span class="hint">For self-hosted servers use the API prefix, e.g. https://your-server/v1</span>
                      <input data-testid="onboarding-ai-url" [value]="config().aiBaseUrl ?? ''" (input)="patch({ aiBaseUrl: value($event) })" />
                    </label>
                    @if (errors()['aiBaseUrl']; as message) { <p class="error" data-testid="onboarding-error-ai-url">{{ message }}</p> }
                    <label>Model (optional)
                      <span class="hint">Custom model names may contain / and :.</span>
                      <input data-testid="onboarding-ai-model" [value]="config().aiModel ?? ''" (input)="patch({ aiModel: value($event) })" />
                    </label>
                    <label>Token (required for cloud/self-hosted; keychain only)
                      <span class="hint">Stored in the system keychain only.</span>
                      <input type="password" autocomplete="off" data-testid="onboarding-ai-token" [value]="aiToken()" (input)="aiToken.set(value($event))" />
                    </label>
                    @if (!state()?.secureStorage) {
                      <p class="warning" data-testid="onboarding-keychain-warning">Keychain unavailable: the token will only be kept in memory.</p>
                    }
                    <div class="test-row">
                      <button type="button" data-testid="onboarding-test-ai" [disabled]="busy() || testingAi()" (click)="testAiProvider()">
                        {{ testingAi() ? 'Testing…' : 'Test AI' }}
                      </button>
                      <span class="hint">Sends a minimal request to verify provider, model and token.</span>
                    </div>
                    @if (aiTestResult(); as result) {
                      <p class="remote-result" [class.ok]="result.ok" [class.error]="!result.ok" data-testid="onboarding-ai-result" role="status">
                        @if (result.ok) {
                          AI responded in {{ result.latencyMs }} ms{{ result.model ? ' (' + result.model + ')' : '' }}.
                        } @else {
                          AI test failed: {{ result.error }}
                        }
                      </p>
                    }
                  }
                  <button type="button" class="help-link" data-testid="onboarding-help-ai" (click)="openHelp('ai')">AI provider setup guide</button>
                </div>
              }
              @case (3) {
                <div data-testid="onboarding-step-3">
                  <label>STT provider
                    <select data-testid="onboarding-stt-provider" [value]="config().sttProvider" (change)="patch({ sttProvider: sttProvider($event) })">
                      @for (provider of sttProviders; track provider) {
                        <option [value]="provider" [selected]="provider === config().sttProvider">{{ provider }}</option>
                      }
                    </select>
                  </label>
                  @if (config().sttProvider !== 'none') {
                    <label>Model (optional)
                      <span class="hint">Cloud model; self-hosted Parakeet model IDs are also supported.</span>
                      <input data-testid="onboarding-stt-model" [value]="config().sttModel ?? ''" (input)="patch({ sttModel: value($event) })" />
                    </label>
                    @if (config().sttProvider === 'cloud') {
                      <label>Base URL (optional)
                        <span class="hint">For self-hosted servers use the API prefix, e.g. https://your-server/v1</span>
                        <input data-testid="onboarding-stt-url" [value]="config().sttBaseUrl ?? ''" (input)="patch({ sttBaseUrl: value($event) })" />
                      </label>
                      <label>Response format
                        <select data-testid="onboarding-stt-format" [value]="config().sttResponseFormat ?? 'json'" (change)="patch({ sttResponseFormat: sttResponseFormat($event) })">
                          <option value="json">json</option><option value="verbose_json">verbose_json</option>
                        </select>
                      </label>
                      <label>Language (optional)
                        <input data-testid="onboarding-stt-language" placeholder="e.g. en" [value]="config().sttLanguage ?? ''" (input)="patch({ sttLanguage: value($event) })" />
                      </label>
                      <label>Token (optional, keychain only)
                        <input type="password" autocomplete="off" data-testid="onboarding-stt-token" [value]="sttToken()" (input)="sttToken.set(value($event))" />
                      </label>
                    }
                    @if (config().sttProvider === 'local') {
                      <label>Local STT command (absolute path)
                        <input data-testid="onboarding-stt-command" [value]="config().sttCommand ?? ''" (input)="patch({ sttCommand: value($event) })" />
                      </label>
                      @if (errors()['sttCommand']; as message) { <p class="error" data-testid="onboarding-error-stt-command">{{ message }}</p> }
                    }
                  }
                  <button type="button" data-testid="onboarding-mic-check" (click)="checkMicrophone()">Check microphone</button>
                  <p class="hint" data-testid="onboarding-mic-status" role="status">{{ micMessage() }}</p>
                  @if (config().sttProvider !== 'none') {
                    <div class="test-row">
                      <button type="button" data-testid="onboarding-test-stt" [disabled]="busy() || testingStt()" (click)="testSttProvider()">
                        {{ testingStt() ? 'Recording…' : 'Test transcription' }}
                      </button>
                      <span class="hint">Records up to 3 seconds, transcribes, and discards the audio.</span>
                    </div>
                    @if (sttTestResult(); as result) {
                      <p class="remote-result" data-testid="onboarding-stt-result" role="status">{{ result }}</p>
                    }
                  }
                  <button type="button" class="help-link" data-testid="onboarding-help-stt" (click)="openHelp('stt')">STT setup guide</button>
                </div>
              }
              @case (4) {
                <div data-testid="settings-appearance">
                  <label>Terminal monospace font
                    <select data-testid="settings-terminal-font" [value]="config().terminalFont ?? 'jetbrains'" (change)="patch({ terminalFont: terminalFont($event) })">
                      @for (font of terminalFonts; track font.id) { <option [value]="font.id">{{ font.label }}</option> }
                    </select>
                  </label>
                  <p class="hint">Fonts must be installed on your system. If a font is missing, the next font in the stack is used.</p>
                </div>
              }
            }
            @if (errors()['config']; as message) { <p class="error" data-testid="onboarding-error-config">{{ message }}</p> }
            @for (warning of warnings(); track warning) {
              <p class="warning" data-testid="onboarding-warning">{{ warning }}</p>
            }
            <footer>
              @if (!editMode() && step() === 1) {
                <button type="button" data-testid="onboarding-defaults" [disabled]="busy()" (click)="useDefaults()">Use defaults</button>
              }
              @if (!editMode()) { <button type="button" data-testid="onboarding-back" [disabled]="busy()" (click)="back()">Back</button> }
              @if (!editMode() && step() > 1) {
                <button type="button" data-testid="onboarding-skip-step" [disabled]="busy()" (click)="skipStep()">Skip</button>
              }
              @if (!editMode() && step() < 3) {
                <button type="button" data-testid="onboarding-next" [disabled]="busy()" (click)="next()">Next</button>
              } @else {
                <button type="button" data-testid="onboarding-save" [disabled]="busy()" (click)="save()">Save</button>
              }
              <button type="button" data-testid="onboarding-cancel" [disabled]="busy()" (click)="requestCancel()">Cancel</button>
            </footer>
            @if (confirmDiscard()) {
              <div class="confirm" data-testid="onboarding-discard-confirm" role="alertdialog" aria-label="Discard changes">
                <span>Discard unsaved changes?</span>
                <button type="button" data-testid="onboarding-discard" (click)="discardChanges()">Discard</button>
                <button type="button" data-testid="onboarding-keep-editing" (click)="keepEditing()">Keep editing</button>
              </div>
            }
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
    .settings-tabs { display: flex; gap: 6px; margin: 8px 0 12px; }
    [role='tab'][aria-selected='true'] { border-color: var(--accent); color: var(--accent); }
    label { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 2px; font-size: 13px; }
    input, select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); }
    .error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
    .warning { margin: 8px 0 0; color: #e0b050; font-size: 12px; }
    footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    [data-testid='onboarding-mic-check'] { margin-top: 12px; }
    .test-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    .test-row .hint { flex: 1; min-width: 180px; }
    .remote-result { margin: 8px 0 0; font-size: 12px; line-height: 1.45; }
    .remote-result.ok { color: var(--accent); }
    .remote-result.error { color: var(--danger); }
    .help-link { margin-top: 8px; padding: 0; border: 0; background: none; color: var(--accent); cursor: pointer; font-size: 12px; text-decoration: underline; }
    .confirm { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text); }
    .confirm span { flex: 1; }
  `,
})
export class OnboardingWizard {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly stt = inject(SttStore);
  private readonly settings = inject(SettingsStore);
  private readonly appearance = inject(AppearanceStore);
  protected readonly terminalFonts = TERMINAL_FONTS;
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
  protected readonly editMode = signal(false);
  protected readonly confirmDiscard = signal(false);
  protected readonly testingRemote = signal(false);
  protected readonly remoteResult = signal<RemoteSetupResult | null>(null);
  protected readonly testingAi = signal(false);
  protected readonly aiTestResult = signal<SetupTestAiResult | null>(null);
  protected readonly testingStt = signal(false);
  protected readonly sttTestResult = signal<string | null>(null);
  private initialSnapshot = '';

  constructor() {
    void this.loadState();
    effect(() => {
      if (this.settings.open()) {
        this.openFromSettings();
      }
    });
  }

  private async loadState(): Promise<void> {
    try {
      const state = await this.api.onboardingState();
      this.state.set(state);
      this.config.set({ ...state.config, terminalFont: state.config.terminalFont ?? 'jetbrains' });
      this.appearance.set(state.config.terminalFont ?? 'jetbrains');
      this.visible.set(state.required);
      this.initialSnapshot = JSON.stringify(this.payload());
    } catch {
      // Keep the terminal usable if the main process is unavailable.
    }
  }

  private async openFromSettings(): Promise<void> {
    try {
      const state = await this.api.onboardingState();
      this.state.set(state);
      this.config.set({ ...state.config, terminalFont: state.config.terminalFont ?? 'jetbrains' });
      this.appearance.set(state.config.terminalFont ?? 'jetbrains');
      this.errors.set({});
      this.warnings.set([]);
      this.aiToken.set('');
      this.sttToken.set('');
      this.step.set(1);
      this.editMode.set(true);
      this.visible.set(true);
      this.restartNotice.set(false);
      this.confirmDiscard.set(false);
      this.initialSnapshot = JSON.stringify(this.payload());
    } catch {
      this.settings.close();
    }
  }

  protected onEscape(): void {
    if (this.visible() && !this.busy()) {
      this.requestCancel();
    }
  }

  protected requestCancel(): void {
    if (this.isDirty()) {
      this.confirmDiscard.set(true);
      return;
    }
    this.close();
  }

  protected discardChanges(): void {
    this.confirmDiscard.set(false);
    this.close();
  }

  protected keepEditing(): void {
    this.confirmDiscard.set(false);
  }

  private close(): void {
    this.appearance.set(this.state()?.config.terminalFont ?? 'jetbrains');
    this.visible.set(false);
    this.editMode.set(false);
    this.settings.close();
  }

  private isDirty(): boolean {
    return JSON.stringify(this.payload()) !== this.initialSnapshot || this.aiToken() !== '' || this.sttToken() !== '';
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

  protected terminalFont(event: Event): TerminalFontId {
    return TERMINAL_FONTS.find((font) => font.id === this.value(event))?.id ?? 'jetbrains';
  }

  protected selectTab(step: Step): void {
    this.errors.set({});
    this.step.set(step);
  }

  protected sttProvider(event: Event): SttProvider {
    return STT_PROVIDERS.find((provider) => provider === this.value(event)) ?? 'none';
  }

  protected sttResponseFormat(event: Event): SttResponseFormat {
    return this.value(event) === 'verbose_json' ? 'verbose_json' : 'json';
  }

  protected patch(change: Partial<OnboardingConfig>): void {
    this.config.update((current) => ({ ...current, ...change }));
    if ('dataRepoPath' in change || 'dataRepoRemote' in change || 'machineName' in change) {
      this.remoteResult.set(null);
    }
    if ('aiProvider' in change || 'aiBaseUrl' in change || 'aiModel' in change) {
      this.aiTestResult.set(null);
    }
    if ('sttProvider' in change || 'sttModel' in change || 'sttCommand' in change || 'sttBaseUrl' in change || 'sttResponseFormat' in change || 'sttLanguage' in change) {
      this.sttTestResult.set(null);
    }
  }

  protected openHelp(topic: HelpTopic): void {
    void this.api.helpOpen(topic).catch(() => undefined);
  }

  protected async testSttProvider(): Promise<void> {
    this.testingStt.set(true);
    this.sttTestResult.set(null);
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const text = await new Promise<string | null>((resolve) => {
        let settled = false;
        const off = this.stt.onTranscript((value) => {
          if (settled) return;
          settled = true;
          if (stopTimer !== undefined) clearTimeout(stopTimer);
          if (timeout !== undefined) clearTimeout(timeout);
          off();
          resolve(value);
        });
        timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          off();
          resolve(null);
        }, 12000);
        void this.stt.start().then(() => {
          if (this.stt.error() !== null) {
            if (settled) return;
            settled = true;
            if (timeout !== undefined) clearTimeout(timeout);
            off();
            resolve(null);
            return;
          }
          stopTimer = setTimeout(() => void this.stt.stop(), 2200);
        });
      });
      if (text !== null && text.trim().length > 0) {
        this.sttTestResult.set(`Recognized: “${text.trim()}”`);
      } else {
        this.sttTestResult.set(this.stt.notice() ?? 'No transcription result. Check the STT provider and microphone permission.');
      }
    } finally {
      if (stopTimer !== undefined) clearTimeout(stopTimer);
      if (timeout !== undefined) clearTimeout(timeout);
      void this.stt.load();
      this.testingStt.set(false);
    }
  }

  protected async testAiProvider(): Promise<void> {
    this.testingAi.set(true);
    this.aiTestResult.set(null);
    try {
      this.aiTestResult.set(await this.api.setupTestAi({ config: this.payload(), ...(this.aiToken() !== '' ? { aiToken: this.aiToken() } : {}) }));
    } catch {
      this.aiTestResult.set({ ok: false, provider: this.config().aiProvider, error: 'AI test could not run.' });
    } finally {
      this.testingAi.set(false);
    }
  }

  protected async testRemoteRepository(): Promise<void> {
    this.testingRemote.set(true);
    this.remoteResult.set(null);
    try {
      this.remoteResult.set(await this.api.setupTestRemote(this.payload()));
    } catch {
      this.remoteResult.set({ ok: false, committed: false, pushed: false, localOnly: false, state: 'error', error: 'Repository test could not run' });
    } finally {
      this.testingRemote.set(false);
    }
  }

  /** Removes empty optional fields before sending them to the main process. */
  private payload(): OnboardingConfig {
    const { dataRepoRemote, aiBaseUrl, aiModel, sttModel, sttCommand, sttBaseUrl, sttResponseFormat, sttLanguage, terminalFont, ...required } = this.config();
    const optional = {
      dataRepoRemote,
      aiBaseUrl,
      aiModel,
      sttModel,
      sttBaseUrl,
      sttResponseFormat,
      sttLanguage,
      terminalFont,
      // The local command is meaningful only with the `local` provider.
      ...(required.sttProvider === 'local' ? { sttCommand } : {}),
    };
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
      this.errors.set({ config: 'Validation failed.' });
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.errors.set({});
    if (this.step() === 1) {
      this.requestCancel();
      return;
    }
    this.step.update((current) => (current - 1) as Step);
  }

  /** Skips the current step: `none` provider and no token. */
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
      this.errors.set({ config: 'Could not save.' });
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
      this.errors.set({ config: 'Could not save.' });
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
    // STT state may change as soon as it is saved: the microphone resynchronizes without a restart.
    void this.stt.load();
    this.appearance.set(this.payload().terminalFont ?? 'jetbrains');
    if (result.restartRequired) {
      this.restartNotice.set(true);
    } else if (result.warnings.length === 0) {
      this.visible.set(false);
    } else {
      // Show the keychain warning before closing.
      this.restartNotice.set(false);
      setTimeout(() => this.visible.set(false), 2500);
    }
  }

  protected relaunch(): void {
    void this.api.appRelaunch();
  }
}
