import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type VehicleSample = {
  id: string;
  title: string | null;
  is_active: boolean;
  transmission: string | null;
  body_type: string | null;
  segment: string | null;
  is_popular: boolean;
};

type AuthInfo = {
  userId: string | null;
  email: string | null;
};

type DebugState = {
  running: boolean;
  url: string;
  projectRefFromUrl: string;
  activeCount: number | null;
  totalCount: number | null;
  activeSample: VehicleSample[];
  authInfo: AuthInfo;
  error: string | null;
};

function getProjectRefFromUrl(url: string) {
  try {
    const u = new URL(url);
    // sgpktbljjlixmyjmhppa.supabase.co -> sgpktbljjlixmyjmhppa
    return u.hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

export function SupabaseDebugPanel() {
  const [state, setState] = useState<DebugState>({
    running: false,
    url: (supabase as any)?.supabaseUrl ?? "(unknown)",
    projectRefFromUrl: getProjectRefFromUrl((supabase as any)?.supabaseUrl ?? ""),
    activeCount: null,
    totalCount: null,
    activeSample: [],
    authInfo: { userId: null, email: null },
    error: null,
  });

  const isExpectedProject = useMemo(
    () => state.projectRefFromUrl === "sgpktbljjlixmyjmhppa",
    [state.projectRefFromUrl]
  );

  const run = async () => {
    setState((s) => ({ ...s, running: true, error: null }));
    try {
      const url = (supabase as any)?.supabaseUrl ?? "(unknown)";

      // Auth info
      const { data: { user } } = await supabase.auth.getUser();
      const authInfo: AuthInfo = {
        userId: user?.id ?? null,
        email: user?.email ?? null,
      };

      // Sample com novos campos
      const sampleRes = await supabase
        .from("oli_vehicles")
        .select("id,title,is_active,transmission,body_type,segment,is_popular")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      // Count de ativos
      const activeCountRes = await supabase
        .from("oli_vehicles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Count total
      const totalCountRes = await supabase
        .from("oli_vehicles")
        .select("*", { count: "exact", head: true });

      const sampleErr = sampleRes.error?.message ?? null;
      const countErr = activeCountRes.error?.message ?? totalCountRes.error?.message ?? null;

      setState((s) => ({
        ...s,
        running: false,
        url,
        projectRefFromUrl: getProjectRefFromUrl(url),
        activeCount: activeCountRes.count ?? null,
        totalCount: totalCountRes.count ?? null,
        activeSample: (sampleRes.data as unknown as VehicleSample[]) ?? [],
        authInfo,
        error: sampleErr || countErr,
      }));

      // Log no console
      console.log("[SUPABASE DEBUG] url=", url);
      console.log("[SUPABASE DEBUG] auth=", authInfo);
      console.log("[SUPABASE DEBUG] totalCount=", totalCountRes.count, "activeCount=", activeCountRes.count);
      console.log("[SUPABASE DEBUG] sample=", sampleRes.data);
    } catch (e: any) {
      setState((s) => ({ ...s, running: false, error: e?.message ?? String(e) }));
    }
  };

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-4 border-dashed">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Debug Supabase (preview)</div>
          <div className="text-xs text-muted-foreground">
            URL runtime: <span className="font-mono">{state.url}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Project ref (derivado): <span className="font-mono">{state.projectRefFromUrl || "(unknown)"}</span>
          </div>
          <div className="text-xs">
            Esperado: <span className="font-mono">sgpktbljjlixmyjmhppa</span> —{" "}
            <span className={isExpectedProject ? "text-primary" : "text-destructive"}>
              {isExpectedProject ? "OK" : "DIVERGENTE"}
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={run} disabled={state.running}>
          {state.running ? "Rodando..." : "Rodar testes"}
        </Button>
      </div>

      <div className="mt-4 grid gap-2">
        {/* Auth Info */}
        <div className="text-sm border-b pb-2 mb-2">
          <span className="font-medium">Auth:</span>{" "}
          {state.authInfo.userId ? (
            <span className="text-primary">
              Logado — {state.authInfo.email} ({state.authInfo.userId.slice(0, 8)}...)
            </span>
          ) : (
            <span className="text-muted-foreground">Não autenticado</span>
          )}
        </div>
        <div className="text-sm">
          <span className="font-medium">Count total:</span>{" "}
          <span className="font-mono">{state.totalCount ?? "(null)"}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Count is_active=true:</span>{" "}
          <span className="font-mono">{state.activeCount ?? "(null)"}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Sample (até 3):</span>{" "}
          <span className="font-mono">{state.activeSample.length}</span>
        </div>
        {state.activeSample.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs font-mono w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">ID</th>
                  <th className="text-left p-1">Title</th>
                  <th className="text-left p-1">Trans.</th>
                  <th className="text-left p-1">Body</th>
                  <th className="text-left p-1">Segment</th>
                  <th className="text-left p-1">Popular</th>
                </tr>
              </thead>
              <tbody>
                {state.activeSample.map((v) => (
                  <tr key={v.id} className="border-b border-muted">
                    <td className="p-1">{v.id.slice(0, 8)}...</td>
                    <td className="p-1">{v.title ?? "-"}</td>
                    <td className="p-1">{v.transmission ?? "-"}</td>
                    <td className="p-1">{v.body_type ?? "-"}</td>
                    <td className="p-1">{v.segment ?? "-"}</td>
                    <td className="p-1">{v.is_popular ? "✓" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.error && (
          <div className="text-xs text-destructive">
            Erro: <span className="font-mono">{state.error}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
