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
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle multipart/form-data (for inspection photo uploads)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const targetKey = formData.get("_webhook_target") as string | null;
      const targetUrl = targetKey ? ALLOWED_URLS[targetKey] : null;

      if (!targetUrl) {
        return new Response(
          JSON.stringify({ error: `Webhook target "${targetKey}" not allowed` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove internal routing field before forwarding
      formData.delete("_webhook_target");

      console.log(`=== WEBHOOK PROXY (multipart) → ${targetKey} ===`);

      const n8nResponse = await fetch(targetUrl, {
        method: "POST",
        body: formData,
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
