"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

/**
 * Login de usuário único: só a senha. O e-mail do dono fica no servidor
 * (NUCLEO_OWNER_EMAIL) e nunca aparece na tela.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Digite a senha." };

  const email = process.env.NUCLEO_OWNER_EMAIL;
  if (!email) return { error: "Servidor sem NUCLEO_OWNER_EMAIL configurado." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.status === 429) return { error: "Muitas tentativas. Espere alguns minutos." };
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { error: "Senha incorreta." };
    }
    return { error: "Não foi possível entrar. Tente de novo." };
  }

  redirect("/");
}
