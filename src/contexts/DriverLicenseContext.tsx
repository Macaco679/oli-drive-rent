import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDriverLicense, DriverLicenseRecord } from "@/lib/driverLicenseService";

export type LicenseStatus = "not_sent" | "pending" | "approved" | "rejected";

export interface LicenseData {
  fullName: string;
  licenseNumber: string;
  category: string;
  expiresAt: string;
  cpf: string;
  codigoSeguranca: string;
  nomeMae: string;
  frontPath?: string | null;
  backPath?: string | null;
  selfiePath?: string | null;
  notes?: string | null;
}

export interface LicenseFiles {
  front: File | null;
  back: File | null;
  selfie: File | null;
  frontPreview: string | null;
  backPreview: string | null;
  selfiePreview: string | null;
}

interface DriverLicenseContextType {
  licenseStatus: LicenseStatus;
  setLicenseStatus: (status: LicenseStatus) => void;
  licenseData: LicenseData;
  setLicenseData: (data: LicenseData) => void;
  licenseFiles: LicenseFiles;
  setLicenseFiles: (files: LicenseFiles) => void;
  submitLicense: (data: LicenseData, files: LicenseFiles) => void;
  resetLicense: () => void;
  loadFromSupabase: () => Promise<void>;
  isLoading: boolean;
}

const defaultLicenseData: LicenseData = {
  fullName: "",
  licenseNumber: "",
  category: "",
  expiresAt: "",
  cpf: "",
  codigoSeguranca: "",
  nomeMae: "",
  frontPath: null,
  backPath: null,
  selfiePath: null,
};

const defaultLicenseFiles: LicenseFiles = {
  front: null,
  back: null,
  selfie: null,
  frontPreview: null,
  backPreview: null,
  selfiePreview: null,
};

const DriverLicenseContext = createContext<DriverLicenseContextType | undefined>(undefined);

function mapStatusFromDb(status: string | null): LicenseStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "pending") return "pending";
  return "not_sent";
}

function mapRecordToData(record: DriverLicenseRecord): LicenseData {
  return {
    fullName: record.full_name || "",
    licenseNumber: record.license_number || "",
    category: record.category || "",
    expiresAt: record.expires_at || "",
    cpf: record.cpf ? String(record.cpf) : "",
    codigoSeguranca: record.codigo_seguranca ? String(record.codigo_seguranca) : "",
    nomeMae: record.nome_mae || "",
    frontPath: record.front_path,
    backPath: record.back_path,
    selfiePath: record.selfie_path,
  };
}

export function DriverLicenseProvider({ children }: { children: ReactNode }) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>("not_sent");
  const [licenseData, setLicenseData] = useState<LicenseData>(defaultLicenseData);
  const [licenseFiles, setLicenseFiles] = useState<LicenseFiles>(defaultLicenseFiles);
  const [isLoading, setIsLoading] = useState(false);

  const loadFromSupabase = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const license = await getDriverLicense(user.id);
      if (license) {
        setLicenseStatus(mapStatusFromDb(license.status));
        setLicenseData(mapRecordToData(license));
      } else {
        setLicenseStatus("not_sent");
        setLicenseData(defaultLicenseData);
      }
    } catch (err) {
      console.error("[DriverLicenseContext] Erro ao carregar CNH:", err);
    }
    setIsLoading(false);
  };

  // Carregar dados ao montar o contexto
  useEffect(() => {
    loadFromSupabase();

    // Escutar mudanÃ§as de autenticaÃ§Ã£o
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        loadFromSupabase();
      } else if (event === "SIGNED_OUT") {
        resetLicense();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const submitLicense = (data: LicenseData, files: LicenseFiles) => {
    setLicenseData(data);
    setLicenseFiles(files);
    setLicenseStatus("pending");
  };

  const resetLicense = () => {
    setLicenseStatus("not_sent");
    setLicenseData(defaultLicenseData);
    setLicenseFiles(defaultLicenseFiles);
  };

  return (
    <DriverLicenseContext.Provider
      value={{
        licenseStatus,
        setLicenseStatus,
        licenseData,
        setLicenseData,
        licenseFiles,
        setLicenseFiles,
        submitLicense,
        resetLicense,
        loadFromSupabase,
        isLoading,
      }}
    >
      {children}
    </DriverLicenseContext.Provider>
  );
}

export function useDriverLicense() {
  const context = useContext(DriverLicenseContext);
  if (context === undefined) {
    throw new Error("useDriverLicense must be used within a DriverLicenseProvider");
  }
  return context;
}

