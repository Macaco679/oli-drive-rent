import { createContext, useContext, useState, ReactNode } from "react";

export type LicenseStatus = "not_sent" | "pending" | "approved" | "rejected";

export interface LicenseData {
  fullName: string;
  licenseNumber: string;
  category: string;
  expiresAt: string;
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
}

const defaultLicenseData: LicenseData = {
  fullName: "",
  licenseNumber: "",
  category: "",
  expiresAt: "",
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

export function DriverLicenseProvider({ children }: { children: ReactNode }) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>("not_sent");
  const [licenseData, setLicenseData] = useState<LicenseData>(defaultLicenseData);
  const [licenseFiles, setLicenseFiles] = useState<LicenseFiles>(defaultLicenseFiles);

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
