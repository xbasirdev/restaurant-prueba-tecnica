const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /token/i,
  /password/i,
  /secret/i,
  /cookie/i,
  /email/i,
  /phone/i,
  /address/i,
  /card/i,
  /cvv/i,
  /requesthash/i,
  /idempotency[-_]?key/i,
  /correlation[-_]?id/i,
  /user[-_]?id/i,
];

function shouldMaskKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function maskString(value: string): string {
  if (value.length <= 4) {
    return '***';
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return maskString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return '***';
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item));
  }

  if (value && typeof value === 'object') {
    return '[masked]';
  }

  return value;
}

export function sanitizeForLogs(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (shouldMaskKey(key)) {
        return [key, maskValue(entryValue)];
      }

      return [key, sanitizeForLogs(entryValue)];
    }),
  );
}
