const MAX_VALUE_LENGTH = 500;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "clientsecret"
];

function isSensitiveKey(key: string) {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowered.includes(sensitive));
}

export function maskEmail(value: string) {
  if (!EMAIL_REGEX.test(value)) return value;
  const [user, domain] = value.split("@");
  const safeUser = user.length > 1 ? `${user[0]}***` : "***";
  return `${safeUser}@${domain}`;
}

function truncate(value: string) {
  if (value.length <= MAX_VALUE_LENGTH) {
    return { value, truncated: false };
  }
  return { value: `${value.slice(0, MAX_VALUE_LENGTH)}...`, truncated: true };
}

export function redactValue(value: unknown, fieldName?: string | null) {
  if (fieldName && isSensitiveKey(fieldName)) {
    return { value: "[REDACTED]", truncated: false };
  }

  if (value === null || value === undefined) {
    return { value: null as string | null, truncated: false };
  }

  if (typeof value === "string") {
    const masked = EMAIL_REGEX.test(value) ? maskEmail(value) : value;
    return truncate(masked);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { value: String(value), truncated: false };
  }

  if (value instanceof Date) {
    return { value: value.toISOString(), truncated: false };
  }

  try {
    const json = JSON.stringify(value);
    return truncate(json);
  } catch (error) {
    return { value: "[UNSERIALIZABLE]", truncated: false };
  }
}

export function redactMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  let truncated = false;

  Object.entries(metadata).forEach(([key, value]) => {
    if (isSensitiveKey(key)) {
      return;
    }

    if (value === undefined) {
      return;
    }

    if (typeof value === "string") {
      const masked = EMAIL_REGEX.test(value) ? maskEmail(value) : value;
      const result = truncate(masked);
      if (result.truncated) {
        truncated = true;
      }
      sanitized[key] = result.value;
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      return;
    }

    if (value instanceof Date) {
      sanitized[key] = value.toISOString();
      return;
    }

    try {
      const json = JSON.stringify(value);
      const result = truncate(json);
      if (result.truncated) {
        truncated = true;
      }
      sanitized[key] = result.value;
    } catch (error) {
      sanitized[key] = "[UNSERIALIZABLE]";
    }
  });

  return { metadata: sanitized, truncated };
}
