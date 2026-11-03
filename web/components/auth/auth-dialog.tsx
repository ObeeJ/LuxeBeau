"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { ArrowRight, Check, Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LuxeBeauMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useForgotPassword,
  useGoogleSignIn,
  useLogin,
  useRegister,
  useResendCode,
  useResetPassword,
  useVerifyEmail,
  useVerifyLogin,
} from "@/lib/queries";
import { ApiError, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type User } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { FieldError } from "@/components/site/states";
import { evaluatePassword, sanitizeEmail, sanitizeName } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/* "verify" confirms a new email; "admin-code" is the admin sign-in step;
   "forgot" requests a reset OTP; "reset" submits code + new password. */
export type Mode = "signin" | "register" | "verify" | "admin-code" | "forgot" | "reset";

interface AuthModalState {
  open: boolean;
  mode: Mode;
  reason?: string;
  onDone?: () => void;
  show: (mode?: Mode, onDone?: () => void, reason?: string) => void;
  close: () => void;
}

/* Global trigger: any component can call useAuthModal().show("signin", cb). */
export const useAuthModal = create<AuthModalState>(set => ({
  open: false,
  mode: "signin",
  show: (mode = "signin", onDone, reason) => set({ open: true, mode, onDone, reason }),
  close: () => set({ open: false, onDone: undefined, reason: undefined }),
}));

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const RESEND_SECONDS = 60;

/* ── Google Identity Services button ── */

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisLoading: Promise<void> | null = null;
function loadGoogle(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("google script failed"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

function GoogleButton({ onCredential, label }: { onCredential: (credential: string) => void; label: "signin_with" | "signup_with" }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: r => cb.current(r.credential),
          ux_mode: "popup",
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: label,
          width: Math.min(ref.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [label]);

  if (failed) return <p className="t-meta text-center font-normal text-muted">Google sign-in couldn&apos;t load. Use your email instead.</p>;
  return <div ref={ref} className="flex h-11 w-full justify-center" />;
}

/* ── Dialog ── */

export function AuthDialog() {
  const { open, mode: initialMode, reason, onDone, close } = useAuthModal();
  const signIn = useAuth(s => s.signIn);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const login = useLogin();
  const register = useRegister();
  const verify = useVerifyEmail();
  const resend = useResendCode();
  const google = useGoogleSignIn();
  const verifyLogin = useVerifyLogin();
  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();

  const busy =
    login.isPending ||
    register.isPending ||
    verify.isPending ||
    google.isPending ||
    verifyLogin.isPending ||
    forgotPassword.isPending ||
    resetPassword.isPending;

  const codeStep = mode === "verify" || mode === "admin-code" || mode === "reset";

  // Password strength score
  const passwordScore = evaluatePassword(password);

  // Each open starts at the requested step with a clean form.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const openKey = open ? initialMode : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (open) {
      setMode(initialMode);
      setErrors({});
      setFormError("");
      setPassword("");
      setCode("");
      setShowPassword(false);
      setConflictEmail(null);
    }
  }

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finish = (user: User) => {
    signIn(user);
    close();
    onDone?.();
  };

  const toVerify = () => {
    setMode("verify");
    setCode("");
    setFormError("");
    setConflictEmail(null);
    setResendIn(RESEND_SECONDS);
  };

  const fail = (err: unknown) => {
    if (err instanceof ApiError && (err.status === 409 || err.code === "CONFLICT")) {
      setConflictEmail(sanitizeEmail(email));
      setFormError("");
      return;
    }
    setFormError(getFriendlyErrorMessage(err));
  };

  /* Admins confirm every sign-in with an emailed code. The API returns the
     account email so the Google path knows which account to confirm. */
  const toAdminCode = (err: ApiError) => {
    const details = err.details as { email?: unknown } | undefined;
    if (typeof details?.email === "string") setEmail(details.email);
    setMode("admin-code");
    setCode("");
    setFormError("");
    setConflictEmail(null);
  };

  const onAuthError = (err: unknown) => {
    if (err instanceof ApiError && err.code === "SECOND_FACTOR_REQUIRED") return toAdminCode(err);
    if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") return toVerify();
    fail(err);
  };

  const fieldErrors = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) => {
    const out: Record<string, string> = {};
    for (const i of issues) out[String(i.path[0])] ??= i.message;
    setErrors(out);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setConflictEmail(null);

    const cleanEmail = sanitizeEmail(email);
    const cleanName = sanitizeName(name);

    if (mode === "signin") {
      const parsed = loginSchema.safeParse({ email: cleanEmail, password });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      login.mutate(parsed.data, {
        onSuccess: ({ user }) => finish(user),
        onError: onAuthError,
      });
    } else if (mode === "register") {
      const parsed = registerSchema.safeParse({ name: cleanName, email: cleanEmail, password });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      register.mutate(parsed.data, {
        onSuccess: ({ email: confirmed }) => {
          setEmail(confirmed);
          toVerify();
        },
        onError: err => {
          if (
            (err instanceof ApiError && (err.status === 409 || err.code === "CONFLICT")) ||
            (err instanceof Error && err.message?.toLowerCase().includes("already exists"))
          ) {
            setConflictEmail(cleanEmail);
          } else {
            fail(err);
          }
        },
      });
    } else if (mode === "admin-code") {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verifyLogin.mutate(
        { email: cleanEmail, code },
        {
          onSuccess: ({ user }) => finish(user),
          onError: () => setErrors({ code: "That code is incorrect or has expired. Sign in again for a new one." }),
        },
      );
    } else if (mode === "forgot") {
      const parsed = forgotPasswordSchema.safeParse({ email: cleanEmail });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      forgotPassword.mutate(parsed.data, {
        onSuccess: () => {
          setMode("reset");
          setCode("");
          setPassword("");
          setResendIn(RESEND_SECONDS);
        },
        onError: fail,
      });
    } else if (mode === "reset") {
      const parsed = resetPasswordSchema.safeParse({ email: cleanEmail, code, password });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      resetPassword.mutate(parsed.data, {
        onSuccess: ({ user }) => finish(user),
        onError: fail,
      });
    } else {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verify.mutate(
        { email: cleanEmail, code },
        {
          onSuccess: ({ user }) => finish(user),
          onError: () => setErrors({ code: "That code is incorrect or has expired." }),
        },
      );
    }
  };

  const onGoogle = (credential: string) =>
    google.mutate(credential, { onSuccess: ({ user }) => finish(user), onError: onAuthError });

  const title =
    mode === "verify"
      ? "Check your email"
      : mode === "admin-code"
        ? "Confirm it's you"
        : mode === "register"
          ? "Create your account"
          : mode === "forgot"
            ? "Reset your password"
            : mode === "reset"
              ? "Set a new password"
              : "Sign in";

  const description =
    mode === "verify"
      ? `Enter the 6-digit code we sent to ${email}.`
      : mode === "admin-code"
        ? `Admin accounts confirm every sign-in. Enter the code we sent to ${email}.`
        : mode === "forgot"
          ? "Enter your email address and we will send you a 6-digit verification code."
          : mode === "reset"
            ? `Enter the code sent to ${email} and choose a strong password.`
            : reason ?? (mode === "register" ? "Shop, book artisans and track your orders." : "Welcome back to LuxeBeau.");

  return (
    <Dialog open={open} onOpenChange={o => (o ? null : close())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader className="text-left">
          <span className="group mb-1 inline-flex w-fit">
            <LuxeBeauMark tile size={48} />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Friendly CONFLICT alert when email is already registered */}
        {conflictEmail && (
          <div className="rounded-[20px] bg-brand-wash p-4 ring-1 ring-brand/30">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-surface">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-brand-deep">
                  Account already exists
                </p>
                <p className="mt-0.5 text-[13px] text-muted leading-relaxed">
                  An account with <strong className="text-ink">{conflictEmail}</strong> is already registered on LuxeBeau.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(conflictEmail);
                    setMode("signin");
                    setConflictEmail(null);
                    setFormError("");
                    setErrors({});
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-surface transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Sign in with this email <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Google sign-in for signin and register */}
        {!codeStep && mode !== "forgot" && GOOGLE_CLIENT_ID && (
          <>
            <GoogleButton onCredential={onGoogle} label={mode === "register" ? "signup_with" : "signin_with"} />
            <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
              <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
            </div>
          </>
        )}

        <form onSubmit={submit} noValidate className="space-y-3.5">
          {mode === "register" && (
            <div>
              <Label htmlFor="auth-name">Full name</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                className="mt-1.5"
                placeholder="Adaeze Adeleke"
                aria-invalid={Boolean(errors.name)}
              />
              <FieldError>{errors.name}</FieldError>
            </div>
          )}

          {/* Email input for signin, register, forgot, and reset */}
          {mode !== "verify" && mode !== "admin-code" && (
            <div>
              <Label htmlFor="auth-email">Email address</Label>
              <Input
                id="auth-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (conflictEmail) setConflictEmail(null);
                }}
                autoComplete="email"
                placeholder="ada@example.com"
                className="mt-1.5"
                aria-invalid={Boolean(errors.email)}
              />
              <FieldError>{errors.email}</FieldError>
            </div>
          )}

          {/* Password input for signin, register, and reset */}
          {(mode === "signin" || mode === "register" || mode === "reset") && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password">
                  {mode === "reset" ? "New password" : "Password"}
                </Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setFormError("");
                      setErrors({});
                      setConflictEmail(null);
                    }}
                    className="text-[12px] font-medium text-brand hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder={mode === "signin" ? "••••••••" : "Minimum 8 characters"}
                  className="pr-10"
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError>{errors.password}</FieldError>

              {/* Live Password Strength Meter for register & reset */}
              {(mode === "register" || mode === "reset") && password.length > 0 && (
                <div className="mt-2.5 rounded-xl bg-canvas p-2.5 ring-1 ring-hairline space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                    <span className="text-muted">Password strength</span>
                    <span
                      className={cn(
                        passwordScore.score <= 1
                          ? "text-rose-500"
                          : passwordScore.score === 2
                            ? "text-amber-500"
                            : passwordScore.score === 3
                              ? "text-emerald-500"
                              : "text-brand-deep font-bold",
                      )}
                    >
                      {passwordScore.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          idx <= passwordScore.score ? passwordScore.color : "bg-hairline",
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-muted">
                    <span className={cn("inline-flex items-center gap-1", passwordScore.hasMinLength ? "text-emerald-600 font-medium" : "")}>
                      {passwordScore.hasMinLength ? <Check className="h-3 w-3" /> : "○"} 8+ chars
                    </span>
                    <span className={cn("inline-flex items-center gap-1", passwordScore.hasUppercase ? "text-emerald-600 font-medium" : "")}>
                      {passwordScore.hasUppercase ? <Check className="h-3 w-3" /> : "○"} Uppercase
                    </span>
                    <span className={cn("inline-flex items-center gap-1", passwordScore.hasNumberOrSymbol ? "text-emerald-600 font-medium" : "")}>
                      {passwordScore.hasNumberOrSymbol ? <Check className="h-3 w-3" /> : "○"} Number/symbol
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6-digit code entry for verify, admin-code, and reset */}
          {codeStep && (
            <div>
              <Label htmlFor="auth-code" className="sr-only">
                {mode === "admin-code" ? "Sign-in code" : mode === "reset" ? "Reset code" : "Verification code"}
              </Label>
              <input
                id="auth-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                aria-invalid={Boolean(errors.code)}
                className="h-14 w-full rounded-[20px] border border-hairline bg-canvas text-center font-mono text-[28px] tracking-[0.4em] outline-none placeholder:text-stone focus-visible:border-ink"
              />
              <FieldError>{errors.code}</FieldError>
            </div>
          )}

          {formError && <FieldError>{formError}</FieldError>}

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "signin"
              ? "Sign in"
              : mode === "register"
                ? "Continue"
                : mode === "admin-code"
                  ? "Confirm sign-in"
                  : mode === "forgot"
                    ? "Send recovery code"
                    : mode === "reset"
                      ? "Update password & sign in"
                      : "Verify email"}
          </Button>
        </form>

        <div className="text-center text-[14px] tracking-[-0.014em] text-muted">
          {mode === "signin" && (
            <>
              New to LuxeBeau?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrors({});
                  setFormError("");
                  setConflictEmail(null);
                }}
                className="text-ink underline underline-offset-4"
              >
                Create an account
              </button>
            </>
          )}

          {mode === "register" && (
            <>
              Have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrors({});
                  setFormError("");
                  setConflictEmail(null);
                }}
                className="text-ink underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrors({});
                setFormError("");
                setConflictEmail(null);
              }}
              className="text-ink underline underline-offset-4"
            >
              Back to sign in
            </button>
          )}

          {mode === "reset" && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={resendIn > 0 || forgotPassword.isPending}
                onClick={() =>
                  forgotPassword.mutate(
                    { email: sanitizeEmail(email) },
                    {
                      onSuccess: () => setResendIn(RESEND_SECONDS),
                      onError: fail,
                    },
                  )
                }
                className="text-ink underline underline-offset-4 disabled:text-muted disabled:no-underline"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend recovery code"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-muted underline underline-offset-4"
              >
                Back to sign in
              </button>
            </div>
          )}

          {mode === "verify" && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={resendIn > 0 || resend.isPending}
                onClick={() =>
                  resend.mutate(sanitizeEmail(email), {
                    onSuccess: () => setResendIn(RESEND_SECONDS),
                    onError: fail,
                  })
                }
                className="text-ink underline underline-offset-4 disabled:text-muted disabled:no-underline"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" onClick={() => setMode("signin")} className="text-muted underline underline-offset-4">
                Use a different email
              </button>
            </div>
          )}

          {mode === "admin-code" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setCode("");
                setErrors({});
              }}
              className="text-muted underline underline-offset-4"
            >
              Didn&apos;t get it? Sign in again for a new code
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
