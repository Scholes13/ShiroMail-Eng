const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mailboxLocalPartPattern = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function isBlank(value: string | null | undefined) {
  return normalizeText(value).length === 0;
}

export function validateRequiredText(
  label: string,
  value: string | null | undefined,
  options?: {
    minLength?: number;
    maxLength?: number;
  },
) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} is required。`;
  }
  if (options?.minLength && normalized.length < options.minLength) {
    return `${label} must be at least ${options.minLength}  characters。`;
  }
  if (options?.maxLength && normalized.length > options.maxLength) {
    return `${label} must be at most ${options.maxLength}  characters。`;
  }
  return null;
}

export function validateEmailAddress(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "Text is required。";
  }
  if (!emailPattern.test(normalized)) {
    return "Invalid email address.";
  }
  return null;
}

export function validateHTTPUrl(value: string | null | undefined, label = "Callback URL") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} is required。`;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${label} must use http:// or https://.`;
    }
    return null;
  } catch {
    return `${label} has an invalid format.`;
  }
}

export function validateHTTPOrRootUrl(value: string | null | undefined, label = "Link URL") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} is required。`;
  }
  if (normalized.startsWith("/")) {
    return null;
  }
  return validateHTTPUrl(normalized, label);
}

export function validateImageSourceUrl(value: string | null | undefined, label = "Image URL") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} is required。`;
  }
  if (normalized.startsWith("/")) {
    return null;
  }
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(normalized)) {
    return null;
  }
  return validateHTTPUrl(normalized, label);
}

export function normalizeCommaSeparatedList(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function validateSelection(label: string, value: string | null | undefined, allowedValues?: string[]) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `Please select ${label}。`;
  }
  if (allowedValues && !allowedValues.includes(normalized)) {
    return `${label} is invalid. Please select again.`;
  }
  return null;
}

export function validateMailboxLocalPart(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (!mailboxLocalPartPattern.test(normalized)) {
    return "Mailbox prefix must be 2-64 lowercase letters, numbers, dots, underscores, or hyphens, and start with a letter or number.";
  }
  return null;
}

export function validateOneTimeCode(value: string | null | undefined, label = "verification code") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} is required。`;
  }
  if (!/^\d{6}$/.test(normalized)) {
    return `${label} must be a 6-digit number.`;
  }
  return null;
}

export function validateIntegerRange(
  label: string,
  value: number,
  options: {
    min: number;
    max: number;
  },
) {
  if (!Number.isInteger(value)) {
    return `${label} must be an integer.`;
  }
  if (value < options.min || value > options.max) {
    return `${label} must be between ${options.min}  and  ${options.max} 。`;
  }
  return null;
}
