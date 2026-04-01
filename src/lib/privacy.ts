/**
 * Privacy utilities — strip sensitive data before storage or export.
 * Voyager should NEVER capture passwords, tokens, API keys, or PII.
 */

/** Query param keys that commonly contain secrets */
const SENSITIVE_PARAMS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "key",
  "api_key",
  "apikey",
  "api-key",
  "secret",
  "password",
  "passwd",
  "session_id",
  "sessionid",
  "auth",
  "authorization",
  "credential",
  "nonce",
  "otp",
  "verification",
  "reset",
  "invite",
  "magic",
  "sig",
  "signature",
  "hmac",
  "jwt",
  "bearer",
  "client_secret",
  "private_key",
]);

/**
 * Sanitize a URL by removing sensitive query parameters.
 * Replaces their values with [REDACTED] so the param name is still visible
 * for understanding the flow, but the value is not leaked.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Redact sensitive query params
    let redacted = false;
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveParam(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
        redacted = true;
      }
    }

    // Also redact fragments that look like tokens (common in OAuth implicit flow)
    if (parsed.hash && /[=&]/.test(parsed.hash)) {
      const hashParams = new URLSearchParams(parsed.hash.slice(1));
      let hashRedacted = false;
      for (const key of Array.from(hashParams.keys())) {
        if (isSensitiveParam(key)) {
          hashParams.set(key, "[REDACTED]");
          hashRedacted = true;
        }
      }
      if (hashRedacted) {
        parsed.hash = "#" + hashParams.toString();
        redacted = true;
      }
    }

    return redacted ? parsed.toString() : url;
  } catch {
    return url;
  }
}

function isSensitiveParam(key: string): boolean {
  const lower = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_PARAMS.has(key.toLowerCase()) ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("apikey") ||
    lower.includes("password") ||
    lower.includes("credential");
}

/** Selectors for elements that should never have their content captured */
export const SENSITIVE_INPUT_TYPES = new Set([
  "password",
  "credit-card",
  "cc-number",
  "cc-exp",
  "cc-csc",
]);

/** Check if an element is a sensitive input (password, credit card, etc.) */
export function isSensitiveElement(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;

  // Direct type check
  if (SENSITIVE_INPUT_TYPES.has(el.type)) return true;

  // Autocomplete attribute hints
  const autocomplete = el.getAttribute("autocomplete") ?? "";
  if (
    /password|cc-|credit|secret|token|api.?key/i.test(autocomplete)
  ) {
    return true;
  }

  // Name/id heuristics
  const identifier = `${el.name} ${el.id}`.toLowerCase();
  if (
    /password|passwd|secret|token|api.?key|credit.?card|cvv|cvc|ssn/i.test(
      identifier,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Check if an element is a container that likely holds sensitive displayed content
 * (e.g., "Your API key: sk-abc123" modals).
 */
export function mayContainSensitiveContent(el: Element): boolean {
  const text = el.textContent ?? "";
  // Only check if the container has a meaningful amount of text
  if (text.length < 10 || text.length > 5000) return false;

  return /api.?key|secret.?key|private.?key|access.?token|recovery.?code|one.?time.?password|client.?secret/i.test(
    text,
  );
}
