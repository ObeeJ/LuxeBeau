/**
 * Input sanitization helpers for authentication and forms.
 * Defends against XSS, control characters, leading/trailing whitespace, and case mismatch.
 */

export function sanitizeEmail(email: string): string {
  if (!email) return "";
  return email
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Strip control characters
}

export function sanitizeName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\s+/g, " "); // Collapse multiple spaces
}

export function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

export function sanitizePhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.trim().replace(/[^\d+]/g, "");
  return cleaned;
}

export interface PasswordScore {
  score: number; // 0 to 4
  label: "Weak" | "Fair" | "Good" | "Strong";
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumberOrSymbol: boolean;
}

export function evaluatePassword(password: string): PasswordScore {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  let rawScore = 0;
  if (hasMinLength) rawScore++;
  if (hasUppercase) rawScore++;
  if (hasLowercase) rawScore++;
  if (hasNumberOrSymbol) rawScore++;

  let label: PasswordScore["label"] = "Weak";
  let color = "bg-rose-500";

  if (rawScore === 2) {
    label = "Fair";
    color = "bg-amber-500";
  } else if (rawScore === 3) {
    label = "Good";
    color = "bg-emerald-500";
  } else if (rawScore === 4) {
    label = "Strong";
    color = "bg-brand";
  }

  return {
    score: rawScore,
    label,
    color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumberOrSymbol,
  };
}
