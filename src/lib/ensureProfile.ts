import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que o perfil do usuário exista e tenha o email atualizado.
 * Faz upsert em oli_profiles preenchendo email e full_name (se vazio).
 * Não sobrescreve dados editados manualmente pelo usuário.
 */
export async function ensureProfile(): Promise<void> {
  try {
    // 1. Buscar usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("[ensureProfile] Usuário não autenticado");
      return;
    }

    const userId = user.id;
    const userEmail = user.email;
    const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || null;

    // 2. Buscar perfil atual
    const { data: existingProfile, error: selectError } = await supabase
      .from("oli_profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      console.error("[ensureProfile] Erro ao buscar perfil:", selectError);
      return;
    }

    // 3. Preparar dados para upsert - usando any para permitir coluna email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertData: any = {
      id: userId,
      updated_at: new Date().toISOString(),
    };

    // Sempre incluir email se disponível
    if (userEmail) {
      upsertData.email = userEmail;
    }

    // Preencher full_name apenas se estiver vazio no perfil
    if (!existingProfile?.full_name && metadataName) {
      upsertData.full_name = metadataName;
    }

    // Se perfil não existe, definir role padrão
    if (!existingProfile) {
      upsertData.role = "renter";
      if (metadataName) upsertData.full_name = metadataName;
    }

    // 4. Fazer upsert
    const { error: upsertError } = await supabase
      .from("oli_profiles")
      .upsert(upsertData, { onConflict: "id" });

    if (upsertError) {
      console.error("[ensureProfile] Erro no upsert:", upsertError);
      return;
    }

    console.log("[ensureProfile] Perfil sincronizado com sucesso", { userId, email: userEmail });
  } catch (err) {
    console.error("[ensureProfile] Erro inesperado:", err);
  }
}
