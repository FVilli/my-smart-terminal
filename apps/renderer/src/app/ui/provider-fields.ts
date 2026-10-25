import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ProviderOption { id: string; label: string; }

/**
 * Shared provider/base URL/token fields for an OpenAI-compatible endpoint.
 * Values stay in the parent component; this component only renders and emits changes.
 */
@Component({
  selector: 'app-provider-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="form-field mt-3"><span class="form-label">AI Provider</span>
      <select class="field-sm" [attr.data-testid]="providerTestId()" [value]="provider()" (change)="providerChange.emit(value($event))">
        @for (option of providers(); track option.id) { <option [value]="option.id" [selected]="option.id === provider()">{{ option.label }}</option> }
      </select>
    </label>
    <label class="form-field mt-3"><span class="form-label">Base URL</span>
      <span class="form-help">API prefix, e.g. https://your-server/v1</span>
      <input class="field-sm" [attr.data-testid]="urlTestId()" [value]="baseUrl()" (input)="baseUrlChange.emit(value($event))" />
    </label>
    <label class="form-field mt-3"><span class="form-label">Token (keychain only)</span>
      <span class="form-help">Stored in the system keychain only.</span>
      <input class="field-sm" type="password" autocomplete="off" [attr.data-testid]="tokenTestId()" [attr.placeholder]="storedToken() ? '••••••••••••' : 'Token'" [attr.aria-describedby]="storedToken() ? storedTestId() : null" [value]="token()" (input)="tokenChange.emit(value($event))" />
    </label>
    @if (storedToken()) { <p class="form-help" [attr.id]="storedTestId()" [attr.data-testid]="storedTestId()">Token stored in the keychain — type to replace.</p> }
  `,
})
export class ProviderFields {
  readonly provider = input('');
  readonly baseUrl = input('');
  readonly token = input('');
  readonly storedToken = input(false);
  readonly providers = input<readonly ProviderOption[]>([]);
  readonly providerTestId = input('provider-select');
  readonly urlTestId = input('provider-url');
  readonly tokenTestId = input('provider-token');
  readonly storedTestId = input('provider-token-stored');
  readonly providerChange = output<string>();
  readonly baseUrlChange = output<string>();
  readonly tokenChange = output<string>();

  value(event: Event): string { return (event.target as HTMLInputElement).value; }
}
