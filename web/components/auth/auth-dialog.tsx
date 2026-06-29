"use client";

import { useState } from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Mail, Phone, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useRegister } from "@/lib/queries";
import { loginSchema, registerSchema, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";

type Mode = "login" | "register";

interface AuthModalState {
  open: boolean;
  mode: Mode;
  onDone?: () => void;
  show: (mode?: Mode, onDone?: () => void) => void;
  close: () => void;
}

/* Global trigger: any component can call useAuthModal().show("login", cb). */
export const useAuthModal = create<AuthModalState>(set => ({
  open: false,
  mode: "login",
  onDone: undefined,
  show: (mode = "login", onDone) => set({ open: true, mode, onDone }),
  close: () => set({ open: false, onDone: undefined }),
}));

const fieldBase = "pl-10";

export function AuthDialog() {
  const { open, mode, onDone, close, show } = useAuthModal();
  const signIn = useAuth(s => s.signIn);
  const { toast } = useToast();
  const login = useLogin();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const busy = login.isPending || register.isPending;

  const reset = () => {
    setErrors({});
    setName("");
    setPassword("");
    setPhone("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === "login") {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return;
      }
      login.mutate(parsed.data, {
        onSuccess: ({ token, user }) => {
          signIn(token, user);
          toast(`Welcome back, ${user.name.split(" ")[0]}! We've loaded your profile.`, "success");
          onDone?.();
          close();
          reset();
        },
        onError: err => toast(messageFor(err), "error"),
      });
    } else {
      const parsed = registerSchema.safeParse({ name, email, password, phone, role: "buyer" });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return;
      }
      register.mutate(parsed.data, {
        onSuccess: ({ token, user }) => {
          signIn(token, user);
          toast(`Welcome to LuxeBeau, ${user.name.split(" ")[0]}! Let's find your perfect style.`, "success");
          onDone?.();
          close();
          reset();
        },
        onError: err => toast(messageFor(err), "error"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => (o ? null : close())}>
      <DialogContent className="card-velvet max-w-md border-velvet-700 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === "login" ? (
              <>Welcome <span className="text-gold-gradient italic">back</span></>
            ) : (
              <>Join <span className="text-gold-gradient italic">LuxeBeau</span></>
            )}
          </DialogTitle>
          <DialogDescription className="text-lavender-400">
            {mode === "login"
              ? "Sign in to access your dashboard, track orders, and secure booking slots."
              : "Join LuxeBeau to discover vetted artisans and premium local beauty brands."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          <motion.form
            key={mode}
            onSubmit={handleSubmit}
            noValidate
            initial={{ opacity: 0, x: mode === "login" ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 16 : -16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {mode === "register" && (
              <Field id="name" label="Full name" error={errors.name} icon={UserIcon}>
                <Input id="name" value={name} onChange={e => setName(e.target.value)}
                  autoComplete="name" placeholder="Adaeze Okafor" className={fieldBase}
                  aria-invalid={Boolean(errors.name)} />
              </Field>
            )}
            <Field id="email" label="Email" error={errors.email} icon={Mail}>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" inputMode="email" placeholder="you@email.com" className={fieldBase}
                aria-invalid={Boolean(errors.email)} />
            </Field>
            {mode === "register" && (
              <Field id="phone" label="Phone (WhatsApp preferred)" error={errors.phone} icon={Phone}>
                <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" className={fieldBase}
                  aria-invalid={Boolean(errors.phone)} />
              </Field>
            )}
            <Field id="password" label="Password" error={errors.password} icon={Lock}>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Your password" : "At least 8 characters"} className={fieldBase}
                aria-invalid={Boolean(errors.password)} />
            </Field>

            <Button type="submit" disabled={busy} className="h-12 w-full rounded-full text-sm font-semibold">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </motion.form>
        </AnimatePresence>

        <p className="text-center text-sm text-lavender-400">
          {mode === "login" ? "New to LuxeBeau? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { reset(); show(mode === "login" ? "register" : "login", onDone); }}
            className="font-semibold text-gold-300 hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id, label, error, icon: Icon, children,
}: {
  id: string; label: string; error?: string;
  icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-lavender-200">{label}</Label>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lavender-400" />
        {children}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

function fieldErrors(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function messageFor(err: unknown) {
  return getFriendlyErrorMessage(err);
}
