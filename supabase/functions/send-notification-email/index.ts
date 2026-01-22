import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types for notification events
type NotificationType = 
  | "new_message"
  | "rental_request"
  | "rental_approved"
  | "rental_rejected"
  | "contract_sent"
  | "contract_signed";

interface NotificationPayload {
  type: NotificationType;
  recipient_id: string;
  data: Record<string, unknown>;
}

// Email templates
const emailTemplates: Record<NotificationType, { subject: string; html: (data: Record<string, unknown>) => string }> = {
  new_message: {
    subject: "💬 Nova mensagem recebida - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova mensagem!</h2>
        <p>Você recebeu uma nova mensagem de <strong>${data.sender_name || "um usuário"}</strong>.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #374151;">"${data.message_preview || "..."}"</p>
        </div>
        <a href="https://oli-drive-rent.lovable.app/messages" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Ver mensagem
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
  rental_request: {
    subject: "🚗 Nova solicitação de aluguel - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova solicitação de aluguel!</h2>
        <p><strong>${data.renter_name || "Um motorista"}</strong> quer alugar seu veículo:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Veículo:</strong> ${data.vehicle_title || "Seu veículo"}</p>
          <p style="margin: 0 0 8px 0;"><strong>Período:</strong> ${data.start_date || "?"} até ${data.end_date || "?"}</p>
          <p style="margin: 0;"><strong>Valor total:</strong> R$ ${data.total_price || "0"}</p>
        </div>
        <a href="https://oli-drive-rent.lovable.app/reservations" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Ver solicitação
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
  rental_approved: {
    subject: "✅ Reserva aprovada! - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Sua reserva foi aprovada! 🎉</h2>
        <p>O proprietário aprovou seu pedido de aluguel:</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p style="margin: 0 0 8px 0;"><strong>Veículo:</strong> ${data.vehicle_title || "Veículo"}</p>
          <p style="margin: 0 0 8px 0;"><strong>Período:</strong> ${data.start_date || "?"} até ${data.end_date || "?"}</p>
          <p style="margin: 0;"><strong>Próximo passo:</strong> Assinar o contrato e efetuar o pagamento</p>
        </div>
        <a href="https://oli-drive-rent.lovable.app/reservations" 
           style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Ver reserva
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
  rental_rejected: {
    subject: "❌ Reserva não aprovada - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Reserva não aprovada</h2>
        <p>Infelizmente, o proprietário não pôde aprovar seu pedido:</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
          <p style="margin: 0 0 8px 0;"><strong>Veículo:</strong> ${data.vehicle_title || "Veículo"}</p>
          <p style="margin: 0;"><strong>Período solicitado:</strong> ${data.start_date || "?"} até ${data.end_date || "?"}</p>
        </div>
        <p>Não desanime! Explore outros veículos disponíveis na plataforma.</p>
        <a href="https://oli-drive-rent.lovable.app/search" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Buscar veículos
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
  contract_sent: {
    subject: "📝 Contrato disponível para assinatura - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Contrato pronto para assinatura!</h2>
        <p>O contrato do seu aluguel está disponível para assinatura:</p>
        <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bfdbfe;">
          <p style="margin: 0 0 8px 0;"><strong>Veículo:</strong> ${data.vehicle_title || "Veículo"}</p>
          <p style="margin: 0 0 8px 0;"><strong>Contrato nº:</strong> ${data.contract_number || "N/A"}</p>
          <p style="margin: 0;"><strong>Ação necessária:</strong> Revisar e assinar o contrato</p>
        </div>
        <a href="https://oli-drive-rent.lovable.app/reservations" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Assinar contrato
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
  contract_signed: {
    subject: "✍️ Contrato assinado! - Oli Drive",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Contrato assinado com sucesso! ✍️</h2>
        <p>O contrato foi assinado pelo locatário:</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p style="margin: 0 0 8px 0;"><strong>Locatário:</strong> ${data.renter_name || "Motorista"}</p>
          <p style="margin: 0 0 8px 0;"><strong>Veículo:</strong> ${data.vehicle_title || "Veículo"}</p>
          <p style="margin: 0;"><strong>Contrato nº:</strong> ${data.contract_number || "N/A"}</p>
        </div>
        <a href="https://oli-drive-rent.lovable.app/reservations" 
           style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Ver detalhes
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          Oli Drive - Aluguel de veículos entre pessoas
        </p>
      </div>
    `,
  },
};

// Get user email from profile or auth
async function getUserEmail(userId: string, supabaseAdmin: any): Promise<string | null> {
  // First try oli_profiles
  const { data: profile } = await supabaseAdmin
    .from("oli_profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (profile?.email) {
    return profile.email as string;
  }

  // Fallback to auth.users via service role
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  return authUser?.user?.email || null;
}

async function getUserName(userId: string, supabaseAdmin: any): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("oli_profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  return (profile?.full_name as string) || "Usuário";
}

// Send email using Resend REST API directly
async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Oli Drive <noreply@olidrive.com.br>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: NotificationPayload = await req.json();
    const { type, recipient_id, data } = payload;

    console.log(`Processing notification: ${type} for user ${recipient_id}`);

    // Get recipient email
    const recipientEmail = await getUserEmail(recipient_id, supabaseAdmin);
    if (!recipientEmail) {
      console.log(`No email found for user ${recipient_id}, skipping notification`);
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email template
    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    // Send email via Resend REST API
    const emailResponse = await sendEmail(recipientEmail, template.subject, template.html(data));

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending notification email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
