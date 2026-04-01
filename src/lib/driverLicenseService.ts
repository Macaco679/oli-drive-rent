import { supabase } from "@/integrations/supabase/client";

export interface DriverLicenseRecord {
  id?: string;
  user_id: string;
  full_name: string;
  license_number: string;
  category: string;
  expires_at: string;
  cpf?: number | null;
  codigo_seguranca?: number | null;
  nome_mae?: string | null;
  status: "pending" | "approved" | "rejected";
  front_path: string | null;
  back_path: string | null;
  selfie_path: string | null;
  notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Busca a CNH do usuário atual
 */
export async function getDriverLicense(userId: string): Promise<DriverLicenseRecord | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("oli_driver_licenses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getDriverLicense] Erro:", error);
    return null;
  }

  if (!data) return null;

  const mappedData = {
    ...(data as Record<string, unknown>),
    codigo_seguranca: (data as Record<string, unknown>)["codigo_segurança"] ?? null,
  };

  return mappedData as DriverLicenseRecord;
}

/**
 * Faz upload de uma imagem para o bucket driver-licenses
 */
export async function uploadLicenseImage(
  userId: string,
  file: File,
  type: "front" | "back" | "selfie"
): Promise<string | null> {
  try {
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${userId}/${type}.${fileExt}`;

    // Remove arquivo anterior se existir
    await supabase.storage.from("driver-licenses").remove([filePath]);

    // Upload do novo arquivo
    const { error: uploadError } = await supabase.storage
      .from("driver-licenses")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error(`[uploadLicenseImage] Erro no upload ${type}:`, uploadError);
      return null;
    }

    return filePath;
  } catch (err) {
    console.error("[uploadLicenseImage] Erro inesperado:", err);
    return null;
  }
}

/**
 * Obtém URL assinada para visualizar imagem privada
 */
export async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("driver-licenses")
    .createSignedUrl(path, 3600); // 1 hora de validade

  if (error) {
    console.error("[getSignedImageUrl] Erro:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Salva ou atualiza a CNH no banco de dados
 */
export async function saveDriverLicense(
  userId: string,
  data: {
    full_name: string;
    license_number: string;
    category: string;
    expires_at: string;
    front_path?: string | null;
    back_path?: string | null;
    selfie_path?: string | null;
    cpf?: string | null;
    codigo_seguranca?: string | null;
    nome_mae?: string | null;
  }
): Promise<DriverLicenseRecord | null> {
  const upsertData = {
    user_id: userId,
    full_name: data.full_name,
    license_number: data.license_number,
    category: data.category,
    expires_at: data.expires_at || null,
    status: "pending" as const,
    updated_at: new Date().toISOString(),
    ...(data.front_path && { front_path: data.front_path }),
    ...(data.back_path && { back_path: data.back_path }),
    ...(data.selfie_path !== undefined && { selfie_path: data.selfie_path }),
    ...(data.cpf !== undefined && { cpf: data.cpf ? Number(data.cpf.replace(/\D/g, "")) : null }),
    ...(data.codigo_seguranca !== undefined && { "codigo_segurança": data.codigo_seguranca ? Number(data.codigo_seguranca.replace(/\D/g, "")) : null }),
    ...(data.nome_mae !== undefined && { nome_mae: data.nome_mae }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .from("oli_driver_licenses")
    .upsert(upsertData, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[saveDriverLicense] Erro:", error);
    return null;
  }

  const mappedResult = {
    ...(result as Record<string, unknown>),
    codigo_seguranca: (result as Record<string, unknown>)["codigo_segurança"] ?? null,
  };

  return mappedResult as DriverLicenseRecord;
}

/**
 * Submete CNH completa: upload de imagens + dados
 */
export async function submitDriverLicense(
  userId: string,
  formData: {
    fullName: string;
    licenseNumber: string;
    category: string;
    expiresAt: string;
    cpf?: string;
    codigoSeguranca?: string;
    nomeMae?: string;
  },
  files: {
    front: File | null;
    back: File | null;
    selfie: File | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Upload das imagens
    let frontPath: string | null = null;
    let backPath: string | null = null;
    let selfiePath: string | null = null;

    if (files.front) {
      frontPath = await uploadLicenseImage(userId, files.front, "front");
      if (!frontPath) {
        return { success: false, error: "Falha ao enviar foto da frente" };
      }
    }

    if (files.back) {
      backPath = await uploadLicenseImage(userId, files.back, "back");
      if (!backPath) {
        return { success: false, error: "Falha ao enviar foto do verso" };
      }
    }

    if (files.selfie) {
      selfiePath = await uploadLicenseImage(userId, files.selfie, "selfie");
      // Selfie é opcional, não retorna erro
    }

    // 2. Salvar dados na tabela
    const savedLicense = await saveDriverLicense(userId, {
      full_name: formData.fullName,
      license_number: formData.licenseNumber,
      category: formData.category,
      expires_at: formData.expiresAt,
      front_path: frontPath,
      back_path: backPath,
      selfie_path: selfiePath,
      cpf: formData.cpf,
      codigo_seguranca: formData.codigoSeguranca,
      nome_mae: formData.nomeMae,
    });

    if (!savedLicense) {
      return { success: false, error: "Falha ao salvar dados da CNH" };
    }

    return { success: true };
  } catch (err) {
    console.error("[submitDriverLicense] Erro:", err);
    return { success: false, error: "Erro inesperado ao enviar CNH" };
  }
}


