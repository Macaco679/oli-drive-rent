import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DebugState = {
  running: boolean;
  url: string;
  projectRefFromUrl: string;
  activeCount: number | null;
  activeSample: Array<{ id: string; title: string | null; is_active: boolean }>;
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
    activeSample: [],
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

      const sampleRes = await supabase
        .from("oli_vehicles")
        .select("id,title,is_active")
        .eq("is_active", true)
        .limit(3);

      const countRes = await supabase
        .from("oli_vehicles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const sampleErr = sampleRes.error?.message ?? null;
      const countErr = countRes.error?.message ?? null;

      setState((s) => ({
        ...s,
        running: false,
        url,
        projectRefFromUrl: getProjectRefFromUrl(url),
        activeCount: countRes.count ?? null,
        activeSample: (sampleRes.data ?? []) as any,
        error: sampleErr || countErr,
      }));

      // Também loga no console para evidência
      // eslint-disable-next-line no-console
      console.log("[SUPABASE DEBUG] url=", url);
      // eslint-disable-next-line no-console
      console.log("[SUPABASE DEBUG] activeCount=", countRes.count, "error=", countRes.error);
      // eslint-disable-next-line no-console
      console.log("[SUPABASE DEBUG] sampleLen=", sampleRes.data?.length, "sample=", sampleRes.data, "error=", sampleRes.error);
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
        <div className="text-sm">
          <span className="font-medium">Count is_active=true:</span>{" "}
          <span className="font-mono">{state.activeCount ?? "(null)"}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Sample (até 3):</span>{" "}
          <span className="font-mono">{state.activeSample.length}</span>
        </div>
        {state.activeSample.length > 0 && (
          <ul className="text-xs font-mono list-disc pl-4">
            {state.activeSample.map((v) => (
              <li key={v.id}>
                {v.id} — {v.title ?? "(sem título)"} — active={String(v.is_active)}
              </li>
            ))}
          </ul>
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
