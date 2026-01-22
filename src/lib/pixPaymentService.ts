import { OliRental, OliVehicle } from "./supabase";
import { supabase } from "@/integrations/supabase/client";

export interface PixPaymentData {
  id: string;
  rental_id: string;
  amount: number;
  pix_code: string;
  qr_code_base64: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  expires_at: string;
  paid_at: string | null;
  created_at: string;
}

// Generate a fake PIX code (EMV format - simplified)
function generatePixCode(amount: number, description: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const amountStr = amount.toFixed(2).replace(".", "");
  
  // Simplified PIX payload (not real EMV)
  const payload = [
    "00020126", // Payload format
    `52040000`, // Merchant category
    `5303986`, // Currency (BRL)
    `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`, // Amount
    `5802BR`, // Country
    `59${description.length.toString().padStart(2, "0")}${description}`.substring(0, 40), // Merchant name
    `6008BRASILIA`, // City
    `62${(12 + randomId.length).toString().padStart(2, "0")}0503***${randomId}`, // Additional data
  ].join("");

  return `${payload}${timestamp}6304ABCD`;
}

// Generate a simple QR code as base64 (using a simple placeholder for simulation)
async function generateQRCodeBase64(pixCode: string): Promise<string> {
  // For simulation, we'll create a simple SVG QR code placeholder
  // In production, you'd use a library like qrcode or call an API
  const size = 200;
  const qrSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="10" y="10" width="50" height="50" fill="black"/>
      <rect x="140" y="10" width="50" height="50" fill="black"/>
      <rect x="10" y="140" width="50" height="50" fill="black"/>
      <rect x="70" y="10" width="10" height="10" fill="black"/>
      <rect x="90" y="10" width="10" height="10" fill="black"/>
      <rect x="110" y="10" width="10" height="10" fill="black"/>
      <rect x="70" y="30" width="10" height="10" fill="black"/>
      <rect x="90" y="50" width="10" height="10" fill="black"/>
      <rect x="70" y="70" width="60" height="60" fill="black"/>
      <rect x="80" y="80" width="40" height="40" fill="white"/>
      <rect x="90" y="90" width="20" height="20" fill="black"/>
      <text x="100" y="180" text-anchor="middle" font-size="8" fill="black">PIX SIMULADO</text>
    </svg>
  `;
  
  const base64 = btoa(qrSvg);
  return `data:image/svg+xml;base64,${base64}`;
}

// Create a simulated PIX payment
export async function createPixPayment(rental: OliRental & { vehicle?: OliVehicle }): Promise<PixPaymentData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const amount = rental.total_price || 0;
  const description = `OLIDRIVE${rental.id.substring(0, 8).toUpperCase()}`;
  
  const pixCode = generatePixCode(amount, description);
  const qrCodeBase64 = await generateQRCodeBase64(pixCode);
  
  // Set expiration to 30 minutes from now
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  // In a real implementation, this would create a record in the database
  // and integrate with a real payment provider
  const paymentData: PixPaymentData = {
    id: `pix_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    rental_id: rental.id,
    amount,
    pix_code: pixCode,
    qr_code_base64: qrCodeBase64,
    status: "pending",
    expires_at: expiresAt.toISOString(),
    paid_at: null,
    created_at: new Date().toISOString(),
  };

  // For simulation, we'll store it in localStorage
  const storedPayments = JSON.parse(localStorage.getItem("oli_pix_payments") || "[]");
  storedPayments.push(paymentData);
  localStorage.setItem("oli_pix_payments", JSON.stringify(storedPayments));

  return paymentData;
}

// Get payment status (simulated)
export function getPixPayment(paymentId: string): PixPaymentData | null {
  const storedPayments = JSON.parse(localStorage.getItem("oli_pix_payments") || "[]");
  return storedPayments.find((p: PixPaymentData) => p.id === paymentId) || null;
}

// Get payment by rental ID
export function getPixPaymentByRentalId(rentalId: string): PixPaymentData | null {
  const storedPayments = JSON.parse(localStorage.getItem("oli_pix_payments") || "[]");
  return storedPayments.find((p: PixPaymentData) => p.rental_id === rentalId && p.status === "pending") || null;
}

// Simulate payment confirmation (for testing)
export async function simulatePixPaymentConfirmation(paymentId: string): Promise<boolean> {
  const storedPayments = JSON.parse(localStorage.getItem("oli_pix_payments") || "[]");
  const paymentIndex = storedPayments.findIndex((p: PixPaymentData) => p.id === paymentId);
  
  if (paymentIndex === -1) return false;
  
  storedPayments[paymentIndex].status = "paid";
  storedPayments[paymentIndex].paid_at = new Date().toISOString();
  localStorage.setItem("oli_pix_payments", JSON.stringify(storedPayments));
  
  // Also update the rental status and create payment record in Supabase
  const payment = storedPayments[paymentIndex];
  
  // Create payment record in database
  const { error: paymentError } = await supabase
    .from("oli_payments")
    .insert({
      rental_id: payment.rental_id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      payment_type: "rental",
      amount: payment.amount,
      method: "pix",
      status: "paid",
      external_reference: paymentId,
    });

  if (paymentError) {
    console.error("Error creating payment record:", paymentError);
  }

  // Update rental status to active
  const { error: rentalError } = await supabase
    .from("oli_rentals")
    .update({ status: "active" })
    .eq("id", payment.rental_id);

  if (rentalError) {
    console.error("Error updating rental status:", rentalError);
  }

  return true;
}

// Copy PIX code to clipboard
export function copyPixCode(pixCode: string): Promise<boolean> {
  return navigator.clipboard.writeText(pixCode)
    .then(() => true)
    .catch(() => false);
}
