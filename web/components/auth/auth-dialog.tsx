"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Loader2 } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LuxeBeauMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoogleSignIn, useLogin, useRegister, useResendCode, useVerifyEmail, useVerifyLogin } from "@/lib/queries";
import { ApiError, loginSchema, registerSchema, type User } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { FieldError } from "@/components/site/states";

/* "verify" confirms a new email; "admin-code" is the admin sign-in step. */
type Mode = "signin" | "register" | "verify" | "admin-code";

interface AuthModalState {
  open: boolean;
  mode: Mode;
  reason?: string;
  onDone?: () => void;
  show: (mode?: "signin" | "register", onDone?: () => void, reason?: string) => void;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const login = useLogin();
  const register = useRegister();
  const verify = useVerifyEmail();
  const resend = useResendCode();
  const google = useGoogleSignIn();
  const verifyLogin = useVerifyLogin();
  const busy = login.isPending || register.isPending || verify.isPending || google.isPending || verifyLogin.isPending;
  const codeStep = mode === "verify" || mode === "admin-code";

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
    setResendIn(RESEND_SECONDS);
  };

  const fail = (err: unknown) => setFormError(getFriendlyErrorMessage(err));

  /* Admins confirm every sign-in with an emailed code. The API returns the
     account email so the Google path knows which account to confirm. */
  const toAdminCode = (err: ApiError) => {
    const details = err.details as { email?: unknown } | undefined;
    if (typeof details?.email === "string") setEmail(details.email);
    setMode("admin-code");
    setCode("");
    setFormError("");
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

    if (mode === "signin") {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      login.mutate(parsed.data, {
        onSuccess: ({ user }) => finish(user),
        onError: onAuthError,
      });
    } else if (mode === "register") {
      const parsed = registerSchema.safeParse({ name, email, password });
      if (!parsed.success) return fieldErrors(parsed.error.issues);
      register.mutate(parsed.data, {
        onSuccess: ({ email: confirmed }) => {
          setEmail(confirmed);
          toVerify();
        },
        onError: err =>
          err instanceof ApiError && err.status === 409
            ? setErrors({ email: "An account already uses this email. Sign in instead." })
            : fail(err),
      });
    } else if (mode === "admin-code") {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verifyLogin.mutate(
        { email, code },
        { onSuccess: ({ user }) => finish(user), onError: () => setErrors({ code: "That code is incorrect or has expired. Sign in again for a new one." }) },
      );
    } else {
      if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code." });
      verify.mutate(
        { email, code },
        { onSuccess: ({ user }) => finish(user), onError: () => setErrors({ code: "That code is incorrect or has expired." }) },
      );
    }
  };

  const onGoogle = (credential: string) =>
    google.mutate(credential, { onSuccess: ({ user }) => finish(user), onError: onAuthError });

  const title =
    mode === "verify" ? "Check your email" : mode === "admin-code" ? "Confirm it's you" : mode === "register" ? "Create your account" : "Sign in";
  const description =
    mode === "verify"
      ? `Enter the 6-digit code we sent to ${email}.`
      : mode === "admin-code"
        ? `Admin accounts confirm every sign-in. Enter the code we sent to ${email}.`
        : reason ?? (mode === "register" ? "Shop, book artisans and track your orders." : "Welcome back to LuxeBeau.");

  return (
    <Dialog open={open} onOpenChange={o => (o ? null : close())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[400px]">
        <DialogHeader className="text-left">
          <span className="group mb-1 inline-flex w-fit">
            <LuxeBeauMark tile size={48} />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!codeStep && GOOGLE_CLIENT_ID && (
          <>
            <GoogleButton onCredential={onGoogle} label={mode === "register" ? "signup_with" : "signin_with"} />
            <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
              <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
            </div>
          </>
        )}

        <form onSubmit={submit} noValidate className="space-y-3">
          {mode === "register" && (
            <div>
              <Label htmlFor="auth-name">Name</Label>
              <Input id="auth-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1.5" aria-invalid={Boolean(errors.name)} />
              <FieldError>{errors.name}</FieldError>
            </div>
          )}

          {!codeStep ? (
            <>
              <div>
                <Label htmlFor="auth-email">Email</Label>
                <Input id="auth-email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-1.5" aria-invalid={Boolean(errors.email)} />
                <FieldError>{errors.email}</FieldError>
              </div>
              <div>
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="mt-1.5"
                  aria-invalid={Boolean(errors.password)}
                />
                <FieldError>{errors.password}</FieldError>
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="auth-code" className="sr-only">{mode === "admin-code" ? "Sign-in code" : "Verification code"}</Label>
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
            {mode === "signin" ? "Sign in" : mode === "register" ? "Continue" : mode === "admin-code" ? "Confirm sign-in" : "Verify email"}
          </Button>
        </form>

        <div className="text-center text-[14px] tracking-[-0.014em] text-muted">
          {mode === "signin" && (
            <>New to LuxeBeau? <button type="button" onClick={() => { setMode("register"); setErrors({}); setFormError(""); }} className="text-ink underline underline-offset-4">Create an account</button></>
          )}
          {mode === "register" && (
            <>Have an account? <button type="button" onClick={() => { setMode("signin"); setErrors({}); setFormError(""); }} className="text-ink underline underline-offset-4">Sign in</button></>
          )}
          {mode === "verify" && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={resendIn > 0 || resend.isPending}
                onClick={() =>
                  resend.mutate(email, {
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
            <button type="button" onClick={() => { setMode("signin"); setCode(""); setErrors({}); }} className="text-muted underline underline-offset-4">
              Didn&apos;t get it? Sign in again for a new code
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
