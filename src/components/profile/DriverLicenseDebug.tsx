import { Button } from "@/components/ui/button";
import { useDriverLicense, LicenseStatus } from "@/contexts/DriverLicenseContext";

export function DriverLicenseDebug() {
  const { licenseStatus, setLicenseStatus } = useDriverLicense();

  // Only show in development
  if (import.meta.env.PROD) return null;

  const statuses: LicenseStatus[] = ["not_sent", "pending", "approved", "rejected"];

  return (
    <div className="fixed bottom-4 right-4 bg-card border border-border rounded-xl p-4 shadow-lg z-50">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        DEBUG: CNH Status ({licenseStatus})
      </p>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Button
            key={status}
            variant={licenseStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setLicenseStatus(status)}
            className="text-xs"
          >
            {status}
          </Button>
        ))}
      </div>
    </div>
  );
}
