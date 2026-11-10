"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, Loader2, ShieldCheck } from "@/components/icons";
import { LuxeBeauMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/site/states";
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
import { evaluatePassword, sanitizeEmail, sanitizeName } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

export type AuthPageMode = "signin" | "register" | "verify" | "admin-code" | "forgot" | "reset";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const RESEND_SECONDS = 60;

/* ── Google button (same as dialog) ── */
interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

let gisLoading: Promise<void> | null = null;
function loadGoogle(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error("google script failed")); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

function GoogleButton({ onCredential, label }: { onCredential: (c: string) => void; label: "signin_with" | "signup_with" }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  useEffect(() => { cb.current = onCredential; }, [onCredential]);
  useEffect(() => {
    let cancelled = false;
    loadGoogle().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: r => cb.current(r.credential), ux_mode: "popup" });
      window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", shape: "pill", text: label, width: Math.min(ref.current.offsetWidth || 400, 400) });
    }).catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [label]);
  if (failed) return <p className="t-meta text-center font-normal text-muted">Google sign-in couldn&apos;t load. Use your email instead.</p>;
  return <div ref={ref} className="flex h-11 w-full justify-center" />;
}

/* ── Password strength meter ── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const s = evaluatePassword(password);
  return (
    <div className="mt-2.5 rounded-[16px] bg-canvas p-3 ring-1 ring-hairline space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
        <span className="text-muted">Strength</span>
        <span className={cn(
          s.score <= 1 ? "text-rose-500" : s.score === 2 ? "text-amber-500" : s.score === 3 ? "text-emerald-500" : "text-brand-deep font-bold"
        )}>{s.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i <= s.score ? s.color : "bg-hairline")} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted">
        {([
          [s.hasMinLength, "8+ chars"],
          [s.hasUppercase, "Uppercase"],
          [s.hasNumberOrSymbol, "Number/symbol"],
        ] as [boolean, string][]).map(([met, label]) => (
          <span key={label} className={cn("inline-flex items-center gap-1", met && "text-emerald-600 font-medium")}>
            {met ? <Check className="h-3 w-3" /> : "○"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main page form ── */
export function AuthPage({ initialMode = "signin" }: { initialMode?: AuthPageMode }) {
  const router = useRouter();
  const signIn = useAuth(s => s.signIn);

  const [mode, setMode] = useState<AuthPageMode>(initialMode);
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

  const busy = login.isPending || register.isPending || verify.isPending || google.isPending ||
    verifyLogin.isPending || forgotPassword.isPending || resetPassword.isPending;

  const codeStep = mode === "verify" || mode === "admin-code" || mode === "reset";

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finish = (user: User) => {
    signIn(user);
    const dest = user.role === "seller" || user.role === "artisan" ? `/dashboard/${user.role}` : "/dashboard";
    router.push(dest);
  };

  const toVerify = () => { setMode("verify"); setCode(""); setFormError(""); setConflictEmail(null); setResendIn(RESEND_SECONDS); };
  const toAdminCode = (err: ApiError) => {
    const details = err.details as { email?: unknown } | undefined;
    if (typeof details?.email === "string") setEmail(details.email);
    setMode("admin-code"); setCode(""); setFormError(""); setConflictEmail(null);
  };
  const fail = (err: unknown) => {
    if (err instanceof ApiError && (err.status === 409 || err.code === "CONFLICT")) { setConflictEmail(sanitizeEmail(email)); return; }
    setFormError(getFriendlyErrorMessage(err));
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
    setErrors({}); setFormError(""); setConflictEmail(null);
    const cleanEmail = sanitizeEmail(email);
    const cleanName = sanitizeName(name);

    if (mode === "signin") {
      const p = loginSchema.safeParse({ email: cleanEmail, password });
      if (!p.success) return fieldErrors(p.error.issues);
      login.mutate(p.data, { onSuccess: ({ user }) => finish(user), onError: onAuthError });
    } else if (mode === "register") {
      const p = registerSchema.safeParse({ name: cleanName, email: cleanEmail, password });
      if (!p.success) return fieldErrors(p.error.issues);
      register.mutate(p.data, {
        onSuccess: ({ email: confirmed }) => { setEmail(confirmed); toVerify(); },
        onError: err => {
          if ((err instanceof ApiError && (err.status === 409 || err.code === "CONFLICT")) ||
            (err instanceof Error && err.message?.toLowerCase().includes("already exists"))) {
            setConflictEmail(cleanEmail);
          } else { fail(err); }
        },
      });
    } else if (mode === "admin-code") {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verifyLogin.mutate({ email: sanitizeEmail(email), code }, {
        onSuccess: ({ user }) => finish(user),
        onError: () => setErrors({ code: "That code is incorrect or has expired. Sign in again for a new one." }),
      });
    } else if (mode === "forgot") {
      const p = forgotPasswordSchema.safeParse({ email: sanitizeEmail(email) });
      if (!p.success) return fieldErrors(p.error.issues);
      forgotPassword.mutate(p.data, {
        onSuccess: () => { setMode("reset"); setCode(""); setPassword(""); setResendIn(RESEND_SECONDS); },
        onError: fail,
      });
    } else if (mode === "reset") {
      const p = resetPasswordSchema.safeParse({ email: sanitizeEmail(email), code, password });
      if (!p.success) return fieldErrors(p.error.issues);
      resetPassword.mutate(p.data, { onSuccess: ({ user }) => finish(user), onError: fail });
    } else {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verify.mutate({ email: sanitizeEmail(email), code }, {
        onSuccess: ({ user }) => finish(user),
        onError: () => setErrors({ code: "That code is incorrect or has expired." }),
      });
    }
  };

  const onGoogle = (credential: string) =>
    google.mutate(credential, { onSuccess: ({ user }) => finish(user), onError: onAuthError });

  const titles: Record<AuthPageMode, string> = {
    signin: "Sign in",
    register: "Create your account",
    verify: "Check your email",
    "admin-code": "Confirm it's you",
    forgot: "Reset your password",
    reset: "Set a new password",
  };
  const descriptions: Record<AuthPageMode, string> = {
    signin: "Welcome back to LuxeBeau.",
    register: "Shop, book artisans and track your orders.",
    verify: `Enter the 6-digit code we sent to ${email}.`,
    "admin-code": `Admin accounts confirm every sign-in. Enter the code we sent to ${email}.`,
    forgot: "Enter your email and we'll send you a 6-digit recovery code.",
    reset: `Enter the code sent to ${email} and choose a strong password.`,
  };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      {/* Brand mark */}
      <Link href="/" aria-label="LuxeBeau home" className="lb-press group mb-6 inline-flex">
        <LuxeBeauMark tile size={48} />
      </Link>

      <h1 className="text-[26px] font-bold tracking-[-0.03em] text-ink">{titles[mode]}</h1>
      <p className="mt-1 text-[15px] text-muted">{descriptions[mode]}</p>

      {/* Conflict alert */}
      {conflictEmail && (
        <div className="mt-5 rounded-[20px] bg-brand-wash p-4 ring-1 ring-brand/30">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-surface">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-brand-deep">Account already exists</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                <strong className="text-ink">{conflictEmail}</strong> is already registered.
              </p>
              <button
                type="button"
                onClick={() => { setEmail(conflictEmail); setMode("signin"); setConflictEmail(null); setFormError(""); setErrors({}); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-surface transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign in with this email <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google */}
      {!codeStep && mode !== "forgot" && GOOGLE_CLIENT_ID && (
        <div className="mt-5 space-y-4">
          <GoogleButton onCredential={onGoogle} label={mode === "register" ? "signup_with" : "signin_with"} />
          <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
            <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {mode === "register" && (
          <div>
            <Label htmlFor="ap-name">Full name</Label>
            <Input id="ap-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1.5" placeholder="Adaeze Adeleke" aria-invalid={Boolean(errors.name)} />
            <FieldError>{errors.name}</FieldError>
          </div>
        )}

        {mode !== "verify" && mode !== "admin-code" && (
          <div>
            <Label htmlFor="ap-email">Email address</Label>
            <Input id="ap-email" type="email" inputMode="email" value={email}
              onChange={e => { setEmail(e.target.value); if (conflictEmail) setConflictEmail(null); }}
              autoComplete="email" placeholder="ada@example.com" className="mt-1.5" aria-invalid={Boolean(errors.email)} />
            <FieldError>{errors.email}</FieldError>
          </div>
        )}

        {(mode === "signin" || mode === "register" || mode === "reset") && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ap-password">{mode === "reset" ? "New password" : "Password"}</Label>
              {mode === "signin" && (
                <button type="button" onClick={() => { setMode("forgot"); setFormError(""); setErrors({}); setConflictEmail(null); }}
                  className="text-[12px] font-medium text-brand hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative mt-1.5">
              <Input
                id="ap-password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError>{errors.password}</FieldError>
            {(mode === "register" || mode === "reset") && <PasswordStrength password={password} />}
          </div>
        )}

        {codeStep && (
          <div>
            <Label htmlFor="ap-code" className="sr-only">
              {mode === "admin-code" ? "Sign-in code" : mode === "reset" ? "Reset code" : "Verification code"}
            </Label>
            <input
              id="ap-code"
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
          {mode === "signin" ? "Sign in"
            : mode === "register" ? "Continue"
            : mode === "admin-code" ? "Confirm sign-in"
            : mode === "forgot" ? "Send recovery code"
            : mode === "reset" ? "Update password & sign in"
            : "Verify email"}
        </Button>
      </form>

      {/* Footer links */}
      <div className="mt-5 text-center text-[14px] tracking-[-0.014em] text-muted">
        {mode === "signin" && (
          <p>New to LuxeBeau?{" "}
            <button type="button" onClick={() => { setMode("register"); setErrors({}); setFormError(""); setConflictEmail(null); }}
              className="text-ink underline underline-offset-4">Create an account</button>
          </p>
        )}
        {mode === "register" && (
          <p>Have an account?{" "}
            <button type="button" onClick={() => { setMode("signin"); setErrors({}); setFormError(""); setConflictEmail(null); }}
              className="text-ink underline underline-offset-4">Sign in</button>
          </p>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("signin"); setErrors({}); setFormError(""); setConflictEmail(null); }}
            className="text-ink underline underline-offset-4">Back to sign in</button>
        )}
        {mode === "reset" && (
          <div className="flex flex-col items-center gap-2">
            <button type="button"
              disabled={resendIn > 0 || forgotPassword.isPending}
              onClick={() => forgotPassword.mutate({ email: sanitizeEmail(email) }, { onSuccess: () => setResendIn(RESEND_SECONDS), onError: fail })}
              className="text-ink underline underline-offset-4 disabled:text-muted disabled:no-underline">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend recovery code"}
            </button>
            <button type="button" onClick={() => setMode("signin")} className="text-muted underline underline-offset-4">Back to sign in</button>
          </div>
        )}
        {mode === "verify" && (
          <div className="flex flex-col items-center gap-2">
            <button type="button"
              disabled={resendIn > 0 || resend.isPending}
              onClick={() => resend.mutate(sanitizeEmail(email), { onSuccess: () => setResendIn(RESEND_SECONDS), onError: fail })}
              className="text-ink underline underline-offset-4 disabled:text-muted disabled:no-underline">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <button type="button" onClick={() => setMode("signin")} className="text-muted underline underline-offset-4">Use a different email</button>
          </div>
        )}
        {mode === "admin-code" && (
          <button type="button" onClick={() => { setMode("signin"); setCode(""); setErrors({}); }}
            className="text-muted underline underline-offset-4">
            Didn&apos;t get it? Sign in again for a new code
          </button>
        )}
      </div>
    </div>
  );
}
