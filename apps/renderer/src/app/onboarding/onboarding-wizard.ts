import { ChangeDetectionStrategy, Component, type ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
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
  type SttDiagnostics,
  type SttModelInfo,
} from '@smart-terminal/contracts';
import { SttStore, normalizeAudioMime, sttNotice } from '../stt/stt-store';
import { SettingsStore } from '../settings/settings-store';
import { AppearanceStore } from '../appearance/appearance-store';
import { MessageStore } from '../messages/message-store';

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
        <section class="dialog" [class.settings-dialog]="editMode()" role="dialog" aria-modal="true" [attr.aria-label]="editMode() ? 'Settings' : 'Initial setup'">
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
                <button type="button" data-testid="onboarding-close" (click)="dismiss()">Later</button>
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
            <div class="dialog-body">
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
                </div>
              }
              @case (3) {
                <div data-testid="onboarding-step-3">
                  <label>STT provider
                    <select data-testid="onboarding-stt-provider" [value]="'shared'" (change)="enableSharedStt()">
                      <option value="shared">Use the same AI provider (OpenAI-compatible)</option>
                    </select>
                  </label>
                  @if (!canUseAiProvider()) {
                    <p class="warning" data-testid="onboarding-stt-ai-unavailable">Configure OpenAI or OpenAI-compatible in the AI tab first.</p>
                  }
                  <div class="model-row">
                    <label>Model
                      <select data-testid="onboarding-stt-model" [value]="sttModelValue()" (change)="patch({ sttModel: value($event) })">
                        @for (model of sttModelOptions(); track model.value) { <option [value]="model.value">{{ model.label }}</option> }
                      </select>
                    </label>
                    <button type="button" class="refresh-models" data-testid="onboarding-stt-refresh-models" [attr.aria-label]="sttModelsLoading() ? 'Loading models' : 'Refresh models'" [attr.title]="sttModelsLoading() ? 'Loading models…' : 'Refresh models'" [disabled]="sttModelsLoading() || busy()" (click)="loadSttModels()">
                      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                  @if (sttModelWarning(); as modelWarning) {
                    <p class="warning" data-testid="onboarding-stt-model-warning">{{ modelWarning }}</p>
                  }
                  @if (sttModelsError(); as modelsError) { <p class="hint" data-testid="onboarding-stt-models-error">{{ modelsError }}</p> }
                  <label>Language
                    <select data-testid="onboarding-stt-language" [value]="sttLanguageValue()" (change)="patch({ sttLanguage: sttLanguage($event) })">
                      <option value="en">EN (English)</option>
                      <option value="it">IT (Italiano)</option>
                    </select>
                  </label>
                  <h4>Test mic & trascription</h4>
                  <div class="stt-test-controls">
                    <button type="button" data-testid="onboarding-stt-rec" [disabled]="testRecording() || testTranscribing() || busy()" (click)="startSttRecording()"><span class="rec-dot" aria-hidden="true"></span> REC</button>
                    <button type="button" data-testid="onboarding-stt-stop" [disabled]="!testRecording()" (click)="stopSttRecording()"><span class="stop-square" aria-hidden="true"></span> STOP</button>
                    <button type="button" data-testid="onboarding-stt-play" [disabled]="testAudioUrl() === null || testPlayback()" (click)="playSttAudio()"><span class="play-triangle" aria-hidden="true"></span> PLAY</button>
                    <button type="button" data-testid="onboarding-stt-transcribe" [disabled]="testAudioUrl() === null || testTranscribing() || busy()" (click)="transcribeSttAudio()"><span class="transcribe-icon" aria-hidden="true"></span> {{ testTranscribing() ? 'Transcribing…' : 'TRANSCRIBE' }}</button>
                  </div>
                  @if (testAudioUrl() !== null) {
                    <audio #audioPlayer controls preload="metadata" data-testid="onboarding-stt-player" (ended)="onPlaybackEnded()" (error)="onPlaybackError()"></audio>
                  }
                  <table class="stt-details" data-testid="onboarding-stt-details">
                    <tbody>
                      <tr><th>file</th><td data-testid="onboarding-stt-file">{{ testAudioPath() ?? '—' }}</td></tr>
                      <tr><th>size</th><td>{{ testAudioBytes() }} bytes</td></tr>
                      <tr><th>duration</th><td>{{ testDurationSeconds() }} seconds</td></tr>
                      <tr><th>transcription</th><td data-testid="onboarding-stt-transcription">{{ sttTranscription() ?? '—' }}</td></tr>
                      <tr><th>elapsed</th><td>{{ sttDebug()?.elapsedMs ?? 0 }} ms</td></tr>
                    </tbody>
                  </table>
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
            </div>
            <footer>
              @if (editMode()) {
                <button type="button" class="footer-help" data-testid="settings-github-help" (click)="openHelp(helpTopic())">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .8a7.2 7.2 0 0 0-2.3 14c.36.07.5-.16.5-.35v-1.25c-2 .43-2.43-.85-2.43-.85-.33-.84-.81-1.06-.81-1.06-.66-.45.05-.44.05-.44.73.05 1.12.75 1.12.75.65 1.11 1.7.79 2.12.6.07-.47.25-.79.46-.97-1.6-.18-3.28-.8-3.28-3.56 0-.79.28-1.43.74-1.93-.07-.18-.32-.91.07-1.9 0 0 .6-.19 1.97.73a6.8 6.8 0 0 1 3.58 0c1.37-.92 1.97-.73 1.97-.73.39.99.14 1.72.07 1.9.46.5.74 1.14.74 1.93 0 2.77-1.69 3.38-3.3 3.56.26.22.49.66.49 1.33v1.97c0 .19.13.42.5.35A7.2 7.2 0 0 0 8 .8Z" fill="currentColor"/></svg>
                  <span>{{ helpLabel() }}</span>
                </button>
              }
              @if (!editMode() && step() === 1) {
                <button type="button" data-testid="onboarding-defaults" [disabled]="busy()" (click)="useDefaults()">Use defaults</button>
              }
              @if (editMode()) {
                <button type="button" data-testid="onboarding-cancel" [disabled]="busy()" (click)="requestCancel()">Cancel</button>
                <button type="button" data-testid="onboarding-save" [disabled]="busy()" (click)="save()">Save</button>
              }
              @if (!editMode()) { <button type="button" data-testid="onboarding-back" [disabled]="busy()" (click)="back()">Back</button> }
              @if (!editMode() && step() > 1) {
                <button type="button" data-testid="onboarding-skip-step" [disabled]="busy()" (click)="skipStep()">Skip</button>
              }
              @if (!editMode() && step() < 3) {
                <button type="button" data-testid="onboarding-next" [disabled]="busy()" (click)="next()">Next</button>
              } @else if (!editMode()) {
                <button type="button" data-testid="onboarding-save" [disabled]="busy()" (click)="save()">Save</button>
                <button type="button" data-testid="onboarding-cancel" [disabled]="busy()" (click)="requestCancel()">Cancel</button>
              }
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
    .settings-dialog { display: flex; flex-direction: column; height: min(620px, 90vh); overflow: hidden; }
    .settings-dialog .dialog-body { flex: 1; min-height: 0; overflow: auto; }
    .settings-dialog footer { margin-top: auto; }
    header { display: flex; justify-content: space-between; align-items: baseline; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .steps, .hint { color: var(--text-muted); font-size: 12px; }
    .settings-tabs { display: flex; gap: 6px; margin: 8px 0 12px; }
    [role='tab'][aria-selected='true'] { border-color: var(--accent); color: var(--accent); }
    label { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 2px; font-size: 13px; }
    input, select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); }
    .error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
    .warning { margin: 8px 0 0; color: #e0b050; font-size: 12px; }
    footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .footer-help { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; padding: 6px 8px; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; }
    .footer-help svg { width: 16px; height: 16px; }
    .footer-help:hover { color: var(--text); }
    button { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    [data-testid='onboarding-mic-check'] { margin-top: 12px; }
    .model-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 10px; }
    .model-row label { flex: 1; margin: 0; }
    .refresh-models { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex: none; padding: 0; }
    .refresh-models svg { width: 16px; height: 16px; }
    .refresh-models:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
    .test-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    .test-row .hint { flex: 1; min-width: 180px; }
    .remote-result { margin: 8px 0 0; font-size: 12px; line-height: 1.45; }
    .remote-result.ok { color: var(--accent); }
    .remote-result.error { color: var(--danger); }
    .confirm { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text); }
    .confirm span { flex: 1; }
  `,
})
export class OnboardingWizard {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly stt = inject(SttStore);
  private readonly audioPlayer = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  private readonly settings = inject(SettingsStore);
  private readonly appearance = inject(AppearanceStore);
  private readonly messages = inject(MessageStore);
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
  protected readonly testRecording = signal(false);
  protected readonly testTranscribing = signal(false);
  protected readonly testDurationMs = signal(0);
  protected readonly testAudioUrl = signal<string | null>(null);
  protected readonly testAudioBytes = signal(0);
  protected readonly testPlayback = signal(false);
  protected readonly testRecState = signal<'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'playing' | 'error'>('idle');
  protected readonly sttDebug = signal<SttDiagnostics | null>(null);
  protected readonly sttTranscription = signal<string | null>(null);
  protected readonly testAudioPath = signal<string | null>(null);
  private testRecorder: MediaRecorder | null = null;
  private testStream: MediaStream | null = null;
  private testChunks: Blob[] = [];
  private testBlob: Blob | null = null;
  private testTimer: ReturnType<typeof setInterval> | undefined;
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
    this.restartNotice.set(false);
    this.errors.set({});
    this.warnings.set([]);
    this.confirmDiscard.set(false);
    this.editMode.set(true);
    this.visible.set(true);
    const requestedTab = this.settings.takeInitialTab();
    this.step.set(1);
    this.confirmDiscard.set(false);
    try {
      const state = await this.api.onboardingState();
      this.state.set(state);
      this.config.set({ ...state.config, terminalFont: state.config.terminalFont ?? 'jetbrains' });
      this.appearance.set(state.config.terminalFont ?? 'jetbrains');
      this.errors.set({});
      this.warnings.set([]);
      this.aiToken.set('');
      this.sttToken.set('');
      this.step.set(({ repository: 1, ai: 2, stt: 3, appearance: 4 } as const)[requestedTab]);
      this.editMode.set(true);
      this.visible.set(true);
      this.restartNotice.set(false);
      this.confirmDiscard.set(false);
      if (this.step() === 3) { this.enableSharedStt(); void this.loadSttModels(); }
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

  private dismiss(): void {
    this.clearSttAudio();
    this.visible.set(false);
    this.editMode.set(false);
    this.settings.close();
  }

  private close(): void {
    this.appearance.set(this.state()?.config.terminalFont ?? 'jetbrains');
    this.dismiss();
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
    if (step === 3) { this.enableSharedStt(); void this.loadSttModels(); }
  }

  protected checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }

  protected readonly discoveredSttModels = signal<SttModelInfo[]>([]);
  protected readonly sttModelsLoading = signal(false);
  protected readonly sttModelsError = signal<string | null>(null);
  protected readonly sttModelOptions = computed(() => this.discoveredSttModels().map((model) => ({ value: model.id, label: `${model.label ?? model.id}${model.loaded ? ' (loaded)' : ' (not loaded)'}` })));
  protected readonly sttModelWarning = computed(() => {
    const model = this.discoveredSttModels().find((entry) => entry.id === this.config().sttModel);
    return model !== undefined && model.loaded !== true ? 'This model is not declared loaded. The provider may need to load it before transcription.' : null;
  });

  protected canUseAiProvider(): boolean { return this.config().aiProvider === 'openai' || this.config().aiProvider === 'openai-compatible'; }

  protected enableSharedStt(): void {
    this.patch({
      sttProvider: 'cloud',
      sttUseAiProvider: true,
      sttModel: this.config().sttModel,
      sttLanguage: this.config().sttLanguage ?? this.autoSttLanguage(),
    });
  }

  private autoSttLanguage(): 'en' | 'it' {
    return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
  }

  protected sttModelValue(): string {
    return this.config().sttModel ?? '';
  }

  protected sttLanguageValue(): string {
    return this.config().sttLanguage === 'it' ? 'it' : this.config().sttLanguage === 'en' ? 'en' : this.autoSttLanguage();
  }

  protected sttLanguage(event: Event): 'en' | 'it' {
    return this.value(event) === 'it' ? 'it' : 'en';
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
    if ('sttProvider' in change || 'sttModel' in change || 'sttCommand' in change || 'sttBaseUrl' in change || 'sttUseAiProvider' in change || 'sttResponseFormat' in change || 'sttLanguage' in change) {
      this.sttTestResult.set(null);
    }
  }

  protected openHelp(topic: HelpTopic): void {
    void this.api.helpOpen(topic).catch(() => this.messages.show('critical', 'Could not open the GitHub guide. Check your default browser and try again.'));
  }

  protected helpTopic(): HelpTopic {
    return this.step() === 2 ? 'ai' : this.step() === 3 ? 'stt' : this.step() === 4 ? 'troubleshooting' : 'repository';
  }

  protected helpLabel(): string {
    return this.step() === 2 ? 'AI guide' : this.step() === 3 ? 'STT guide' : this.step() === 4 ? 'User manual' : 'Repository guide';
  }

  protected testDurationSeconds(): number {
    return Math.floor(this.testDurationMs() / 1000);
  }

  protected async loadSttModels(): Promise<void> {
    if (!this.canUseAiProvider()) {
      this.discoveredSttModels.set([]);
      this.sttModelsError.set('Configure OpenAI or OpenAI-compatible in the AI tab first.');
      return;
    }
    this.sttModelsLoading.set(true);
    this.sttModelsError.set(null);
    try {
      const models = await this.api.sttModels();
      this.discoveredSttModels.set(models);
      if (models.length === 0) {
        this.sttModelsError.set('No audio transcription models were returned by the provider.');
      } else {
        this.sttModelsError.set(null);
        if (!models.some((model) => model.id === this.config().sttModel)) {
          const preferred = models.find((model) => model.loaded === true) ?? models[0];
          if (preferred !== undefined) this.patch({ sttModel: preferred.id });
        }
      }
    } catch {
      this.discoveredSttModels.set([]);
      this.sttModelsError.set('Could not load models. Check the AI base URL/token and retry.');
    } finally {
      this.sttModelsLoading.set(false);
    }
  }

  protected debugSummary(): string {
    const debug = this.sttDebug();
    if (debug === null) return 'Debug details';
    return `${debug.serviceReached ? 'Service responded' : 'Service not reached'}${debug.httpStatus !== undefined ? ' · HTTP ' + debug.httpStatus : ''} · ${debug.error ?? debug.stage}`;
  }

  protected async startSttRecording(): Promise<void> {
    this.clearSttAudio();
    this.sttTestResult.set(null);
    this.sttDebug.set(null);
    this.testRecState.set('requesting');
    try {
      const devices = navigator.mediaDevices;
      if (devices === undefined) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
      const stream = await devices.getUserMedia({ audio: true });
      const Recorder = globalThis.MediaRecorder;
      if (typeof Recorder === 'undefined') {
        for (const track of stream.getTracks()) track.stop();
        this.testRecState.set('error');
        this.sttTestResult.set('MediaRecorder is not available on this system.');
        return;
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((type) => Recorder.isTypeSupported(type));
      if (mimeType === undefined) {
        for (const track of stream.getTracks()) track.stop();
        this.testRecState.set('error');
        this.sttTestResult.set('No supported audio recording format was found.');
        return;
      }
      this.testStream = stream;
      this.testChunks = [];
      const recorder = new Recorder(stream, { mimeType });
      this.testRecorder = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) this.testChunks.push(event.data); };
      recorder.onerror = () => { this.testRecState.set('error'); this.testRecording.set(false); this.stopSttTimer(); this.sttTestResult.set('Audio recorder failed while recording.'); };
      recorder.onstop = () => { void (async () => {
        for (const track of stream.getTracks()) track.stop();
        this.testStream = null;
        this.testRecorder = null;
        this.testRecording.set(false);
        this.stopSttTimer();
        const blob = new Blob(this.testChunks, { type: normalizeAudioMime(mimeType) });
        this.testBlob = blob.size > 0 && blob.size <= 10 * 1024 * 1024 ? blob : null;
        this.testAudioBytes.set(blob.size);
        this.testAudioUrl.set(this.testBlob !== null ? URL.createObjectURL(blob) : null);
        this.testRecState.set(this.testBlob !== null ? 'ready' : 'error');
        if (this.testBlob !== null) {
          try {
            const saved = await this.api.sttSaveDebugAudio({
              audio: new Uint8Array(await this.testBlob.arrayBuffer()),
              mimeType: normalizeAudioMime(mimeType),
              durationMs: this.testDurationMs(),
            });
            this.testAudioPath.set(saved.path);
          } catch {
            this.testAudioPath.set(null);
          }
        }
        if (this.testBlob === null) this.sttTestResult.set(blob.size === 0 ? 'No audio data was recorded.' : 'Recording exceeds the 10 MB limit.');
      })(); };
      recorder.start(250);
      this.testRecording.set(true);
      this.testRecState.set('recording');
      this.testDurationMs.set(0);
      this.testTimer = setInterval(() => {
        this.testDurationMs.update((value) => value + 250);
        if (this.testDurationMs() >= 60_000) this.stopSttRecording();
      }, 250);
    } catch (error) {
      this.testRecState.set('error');
      const name = (error as { name?: unknown }).name;
      const message = name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone permission denied. Grant it in the OS settings and retry.'
        : name === 'NotFoundError' || name === 'DevicesNotFoundError'
          ? 'No microphone was found. Connect an input device and retry.'
          : name === 'NotReadableError' || name === 'TrackStartError'
            ? 'The microphone is busy or unreadable. Close other applications and retry.'
            : name === 'OverconstrainedError'
              ? 'The microphone does not support the requested audio constraints.'
              : 'Microphone capture is unavailable on this system.';
      this.sttTestResult.set(message);
    }
  }

  protected stopSttRecording(): void {
    if (this.testRecorder === null) return;
    this.testRecState.set('stopping');
    try { this.testRecorder.stop(); } catch { this.testRecording.set(false); this.testRecState.set('error'); this.stopSttTimer(); this.sttTestResult.set('Could not stop the audio recorder.'); }
  }

  protected playSttAudio(): void {
    const url = this.testAudioUrl();
    const player = this.audioPlayer()?.nativeElement;
    if (url === null) return;
    if (player === undefined) { this.sttTestResult.set('Audio player is not ready yet. Try PLAY again.'); return; }
    player.src = url;
    player.load();
    this.testPlayback.set(true);
    this.testRecState.set('playing');
    void player.play().catch((error: unknown) => {
      this.testPlayback.set(false);
      this.testRecState.set('error');
      const name = (error as { name?: unknown }).name;
      this.sttTestResult.set(name === 'NotAllowedError' ? 'Playback was blocked by the browser. Use the audio controls or click PLAY again.' : 'Audio playback is unavailable: ' + (typeof name === 'string' ? name : 'unknown error') + '.');
    });
  }

  protected onPlaybackEnded(): void { this.testPlayback.set(false); this.testRecState.set('ready'); }

  protected onPlaybackError(): void {
    this.testPlayback.set(false);
    this.testRecState.set('error');
    const code = this.audioPlayer()?.nativeElement.error?.code;
    this.sttTestResult.set('Audio playback failed' + (code !== undefined ? ' (media error ' + code + ')' : '') + '. Check the system audio output.');
  }

  protected async transcribeSttAudio(): Promise<void> {
    const blob = this.testBlob;
    if (blob === null) {
      this.sttTestResult.set('Record audio before transcribing.');
      return;
    }
    this.testTranscribing.set(true);
    this.sttTestResult.set(null);
    try {
      const config = this.payload();
      const saved = await this.api.onboardingSave({
        config,
        ...(this.aiToken() !== '' && config.aiProvider !== 'none' ? { aiToken: this.aiToken() } : {}),
      });
      if (!saved.ok) {
        this.errors.set(saved.errors);
        this.sttTestResult.set('Save the STT settings before transcribing.');
        return;
      }
      await this.stt.load();
      if (!this.stt.status().configured) {
        this.sttTestResult.set('STT is not configured. Configure the AI provider first.');
        return;
      }
      const result = await this.api.sttTranscribe({
        audio: new Uint8Array(await blob.arrayBuffer()),
        mimeType: normalizeAudioMime(blob.type),
        durationMs: this.testDurationMs(),
      });
      this.sttDebug.set(result.diagnostics ?? null);
      this.sttTranscription.set(result.skipped ? null : result.text.trim());
      const debug = result.diagnostics;
      const service = debug === undefined ? '' : debug.serviceReached ? ` Service responded${debug.httpStatus !== undefined ? ' (HTTP ' + debug.httpStatus + ')' : ''}.` : ' Service was not reached.';
      this.sttTestResult.set(result.skipped ? `${sttNotice(result.reason)}${service}${debug?.error ? ' ' + debug.error : ''}` : `Transcription: “${result.text.trim()}”${service}`);
    } catch {
      this.sttTestResult.set('Could not transcribe the recorded audio.');
    } finally {
      this.testTranscribing.set(false);
    }
  }

  private stopSttTimer(): void {
    if (this.testTimer !== undefined) { clearInterval(this.testTimer); this.testTimer = undefined; }
  }

  private clearSttAudio(): void {
    this.stopSttTimer();
    this.testRecorder?.stop();
    this.testRecorder = null;
    this.testStream?.getTracks().forEach((track) => track.stop());
    this.testStream = null;
    this.testChunks = [];
    this.testBlob = null;
    const player = this.audioPlayer()?.nativeElement;
    if (player !== undefined) { player.pause(); player.removeAttribute('src'); player.load(); }
    const url = this.testAudioUrl();
    if (url !== null) URL.revokeObjectURL(url);
    this.testAudioUrl.set(null);
    this.testAudioPath.set(null);
    this.testAudioBytes.set(0);
    this.testBlob = null;
    this.testPlayback.set(false);
    this.testRecState.set('idle');
    this.sttDebug.set(null);
    this.testRecording.set(false);
    this.testDurationMs.set(0);
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
    const { dataRepoRemote, aiBaseUrl, aiModel, sttModel, sttCommand, sttBaseUrl, sttUseAiProvider, sttResponseFormat, sttLanguage, terminalFont, ...required } = this.config();
    const optional = {
      dataRepoRemote,
      aiBaseUrl,
      aiModel,
      sttBaseUrl,
      sttUseAiProvider,
      sttResponseFormat,
      sttLanguage: this.config().sttProvider === 'cloud' ? (sttLanguage ?? this.autoSttLanguage()) : sttLanguage,
      sttModel,
      terminalFont,
      // The local command is meaningful only with the `local` provider.
      ...(required.sttProvider === 'local' ? { sttCommand } : {}),
    };
    const kept = Object.fromEntries(Object.entries(optional).filter(([, value]) => typeof value === 'boolean' || (value !== undefined && value.trim() !== '')));
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
        if (current === 2) { this.enableSharedStt(); void this.loadSttModels(); }
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
        ...(this.sttToken() !== '' && config.sttProvider === 'cloud' && config.sttUseAiProvider !== true ? { sttToken: this.sttToken() } : {}),
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
      this.settings.close();
    } else if (result.warnings.length === 0) {
      this.dismiss();
    } else {
      // Show the keychain warning before closing.
      this.restartNotice.set(false);
      setTimeout(() => this.dismiss(), 2500);
    }
  }

  protected relaunch(): void {
    void this.api.appRelaunch();
  }
}
