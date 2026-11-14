import "server-only";
import type { NextRequest } from "next/server";
import { isValidApiToken } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "./run";

/**
 * Autoriza a captura por `x-nucleo-token` (WhatsApp, Siri) OU pela sessão do dono (botão de
 * captura e command palette dentro do app, onde o token não pode ir para o navegador).
 */
export async function authorizeIngest(request: NextRequest): Promise<boolean> {
  if (isValidApiToken(request.headers.get("x-nucleo-token"))) return true;
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return false;
  return data.user.id === (await resolveOwnerId(createAdminClient()));
}
