/**
 * Best-effort filter for text that appears to contain secrets. This is not a guarantee:
 * it reduces the risk of writing obvious credentials to Markdown history/clipboard.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/,
  /(?<![A-Za-z0-9])(?:password|passwd|pwd|passphrase|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)["']?\s*[:=]\s*\S/i,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i,
  /\bsshpass\b/,
  /\bsudo\b(?:\s+-\S+)*\s+-[A-Za-z]*S[A-Za-z]*\b/,
  /\bcurl\b[^\n]*\s(?:-u\s*\S|--user\b)/,
  /--(?:password|passwd|passphrase)\b/i,
  /\bssh-keygen\b[^\n]*\s-N\b/,
  /\bopenssl\b[^\n]*\s-pass(?:in|out)?\b/,
];

export function isSensitiveText(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}
