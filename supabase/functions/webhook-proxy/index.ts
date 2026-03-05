import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowed webhook destinations (whitelist for security)
const ALLOWED_URLS: Record<string, string> = {
  "validarcarro": "https://n8n.srv1153225.hstgr.cloud/webhook/validarcarro",
  "oli-contrato": "https://n8n.srv1153225.hstgr.cloud/webhook/oli-contrato",
  "cnhcheck": "https://n8n.srv1153225.hstgr.cloud/webhook/cnhcheck",
  "oli-vistoria-validar": "https://n8n.srv1153225.hstgr.cloud/webhook/oli-vistoria-validar",
  "oli-vistoria": "https://n8n.srv1153225.hstgr.cloud/webhook/oli-vistoria",
  "oli-asaas-criar-cobranca": "https://n8n.srv1153225.hstgr.cloud/webhook/oli-asaas-criar-cobranca",
  "oli-pagamento-pix": "https://n8n.srv1153225.hstgr.cloud/webhook/oli/sp/pagar",
  "oli-pagamento-cartao": "https://n8n.srv1153225.hstgr.cloud/webhook/oli/sp/pagar",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle multipart/form-data (for inspection photo uploads)
    if (contentType.includes("multipart/form-data")) {
      const incomingForm = await req.formData();
      const targetKey = incomingForm.get("_webhook_target") as string | null;
      const targetUrl = targetKey ? ALLOWED_URLS[targetKey] : null;

      if (!targetUrl) {
        return new Response(
          JSON.stringify({ error: `Webhook target "${targetKey}" not allowed` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reconstruct FormData with fresh File objects to avoid Deno forwarding issues
      const outgoing = new FormData();
      const fieldNames: string[] = [];
      let payloadObj: Record<string, unknown> | null = null;
      let inspectionId: string | null = null;

      for (const [key, value] of incomingForm.entries()) {
        if (key === "_webhook_target") continue; // skip routing field

        if (value instanceof File) {
          // Re-read file content to ensure binary data is preserved
          const arrayBuffer = await value.arrayBuffer();
          const newFile = new File([arrayBuffer], value.name, { type: value.type || "application/octet-stream" });
          outgoing.append(key, newFile, value.name);
          fieldNames.push(`${key} (File: ${value.name}, ${newFile.size} bytes, ${value.type})`);
        } else {
          const stringValue = String(value);

          if (key === "inspection_id" && stringValue.trim()) {
            inspectionId = stringValue.trim();
          }

          if (key === "payload") {
            try {
              const parsed = JSON.parse(stringValue);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                payloadObj = parsed as Record<string, unknown>;
                if (typeof payloadObj.inspection_id === "string" && payloadObj.inspection_id.trim()) {
                  inspectionId = payloadObj.inspection_id.trim();
                }
              }
            } catch {
              // keep as string if not valid JSON
            }
          }

          outgoing.append(key, stringValue);
          fieldNames.push(`${key}: ${stringValue.slice(0, 150)}`);
        }
      }

      // Keep inspection_id redundant in BOTH places (payload + standalone field)
      if (payloadObj && !payloadObj.inspection_id && inspectionId) {
        payloadObj.inspection_id = inspectionId;
        outgoing.delete("payload");
        outgoing.append("payload", JSON.stringify(payloadObj));
      }

      if (!inspectionId && payloadObj?.inspection_id && typeof payloadObj.inspection_id === "string") {
        inspectionId = payloadObj.inspection_id.trim();
      }

      if (inspectionId && !incomingForm.get("inspection_id")) {
        outgoing.append("inspection_id", inspectionId);
        fieldNames.push(`inspection_id: ${inspectionId}`);
      }

      // Only require inspection_id for inspection-related webhooks
      const inspectionTargets = ["oli-vistoria", "oli-vistoria-validar"];
      if (!inspectionId && inspectionTargets.includes(targetKey || "")) {
        return new Response(
          JSON.stringify({ error: "inspection_id ausente no multipart/form-data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`=== WEBHOOK PROXY (multipart) → ${targetKey} ===`);
      console.log("inspection_id:", inspectionId);
      console.log(`Fields (${fieldNames.length}):`, fieldNames.join(" | "));

      const n8nResponse = await fetch(targetUrl, {
        method: "POST",
        body: outgoing,
      });

      console.log("n8n response status:", n8nResponse.status);
      const responseText = await n8nResponse.text();
      console.log("n8n response body:", responseText.slice(0, 300));

      return new Response(responseText, {
        status: n8nResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle JSON requests (original behavior)
    const body = await req.json();
    
    const targetKey = body._webhook_target as string | undefined;
    const targetUrl = targetKey ? ALLOWED_URLS[targetKey] : ALLOWED_URLS["validarcarro"];

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: `Webhook target "${targetKey}" not allowed` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { _webhook_target, ...payload } = body;

    console.log(`=== WEBHOOK PROXY → ${targetKey || "validarcarro"} ===`);
    console.log("Payload:", JSON.stringify(payload).slice(0, 500));

    const n8nResponse = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("n8n response status:", n8nResponse.status);
    const responseText = await n8nResponse.text();
    console.log("n8n response body:", responseText.slice(0, 300));

    return new Response(responseText, {
      status: n8nResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao comunicar com serviço externo", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
