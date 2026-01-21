import { useState, useEffect } from "react";
import { getCurrentUser, getProfile, OliProfile } from "@/lib/supabase";

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  profile: OliProfile | null;
  loading: boolean;
}

const REQUIRED_FIELDS: { key: keyof OliProfile; label: string }[] = [
  { key: "full_name", label: "Nome completo" },
  { key: "cpf", label: "CPF" },
  { key: "birth_date", label: "Data de nascimento" },
  { key: "phone", label: "Telefone" },
];

export function useProfileCompletion(): ProfileCompletionStatus {
  const [status, setStatus] = useState<ProfileCompletionStatus>({
    isComplete: false,
    missingFields: [],
    profile: null,
    loading: true,
  });

  useEffect(() => {
    checkProfileCompletion();
  }, []);

  const checkProfileCompletion = async () => {
    try {
      const { user } = await getCurrentUser();
      if (!user) {
        setStatus({
          isComplete: false,
          missingFields: REQUIRED_FIELDS.map((f) => f.label),
          profile: null,
          loading: false,
        });
        return;
      }

      const profile = await getProfile(user.id);
      if (!profile) {
        setStatus({
          isComplete: false,
          missingFields: REQUIRED_FIELDS.map((f) => f.label),
          profile: null,
          loading: false,
        });
        return;
      }

      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        const value = profile[field.key];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missingFields.push(field.label);
        }
      }

      setStatus({
        isComplete: missingFields.length === 0,
        missingFields,
        profile,
        loading: false,
      });
    } catch (error) {
      console.error("Error checking profile completion:", error);
      setStatus({
        isComplete: false,
        missingFields: [],
        profile: null,
        loading: false,
      });
    }
  };

  return status;
}

export function isProfileComplete(profile: OliProfile | null): boolean {
  if (!profile) return false;
  
  for (const field of REQUIRED_FIELDS) {
    const value = profile[field.key];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      return false;
    }
  }
  
  return true;
}

export function getMissingFields(profile: OliProfile | null): string[] {
  if (!profile) return REQUIRED_FIELDS.map((f) => f.label);
  
  const missingFields: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = profile[field.key];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(field.label);
    }
  }
  
  return missingFields;
}
