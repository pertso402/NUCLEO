"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code";

/** Traduz o erro do Supabase Auth para algo acionável. */
function sendErrorMessage(error: { status?: number; code?: string }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "Limite de e-mails atingido. Espere alguns minutos e tente de novo.";
  }
  if (error.code === "otp_disabled" || error.code === "signup_disabled" || error.status === 422) {
    return "Este e-mail não tem acesso ao NÚCLEO.";
  }
  return "Não foi possível enviar o código. Tente de novo.";
}

const inputClass =
  "h-11 w-full rounded-sm border border-line bg-bg-3 px-3 text-text-0 placeholder:text-text-2 focus:border-line-strong focus:outline-none";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(sendErrorMessage(error));
      return;
    }
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError("Código inválido ou expirado.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-text-1">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {error && <p className="text-sm text-flare">{error}</p>}
        <Button type="submit" block disabled={busy || !email}>
          {busy ? "Enviando…" : "Enviar código"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm text-text-1">
        Código enviado para <span className="text-text-0">{email}</span>
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,10}"
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className={`${inputClass} num text-center text-xl tracking-[0.4em]`}
      />
      {error && <p className="text-sm text-flare">{error}</p>}
      <Button type="submit" block disabled={busy || code.length < 6}>
        {busy ? "Verificando…" : "Entrar"}
      </Button>
      <Button variant="ghost" onClick={() => setStep("email")}>
        Trocar e-mail
      </Button>
    </form>
  );
}
