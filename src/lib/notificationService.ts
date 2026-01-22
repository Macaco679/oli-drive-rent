// Notification Service - sends email notifications via Edge Function
import { supabase } from "@/integrations/supabase/client";

const EDGE_FUNCTION_URL = "https://sgpktbljjlixmyjmhppa.supabase.co/functions/v1/send-notification-email";

type NotificationType = 
  | "new_message"
  | "rental_request"
  | "rental_approved"
  | "rental_rejected"
  | "contract_sent"
  | "contract_signed"
  | "dropoff_inspection_completed";

interface NotificationPayload {
  type: NotificationType;
  recipient_id: string;
  data: Record<string, unknown>;
}

async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGt0YmxqamxpeG15am1ocHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTE5MjksImV4cCI6MjA4NDQ4NzkyOX0.OoTf_1N0KWWGSfnk-6ZE-M2yg5z8wmej6E83bdWKUAU",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Notification error:", errorText);
      return false;
    }

    const result = await response.json();
    console.log("Notification sent:", result);
    return result.success ?? true;
  } catch (error) {
    console.error("Failed to send notification:", error);
    return false;
  }
}

// ============================================================
// NOTIFICATION HELPERS
// ============================================================

export async function notifyNewMessage(
  recipientId: string,
  senderName: string,
  messagePreview: string
): Promise<boolean> {
  return sendNotification({
    type: "new_message",
    recipient_id: recipientId,
    data: {
      sender_name: senderName,
      message_preview: messagePreview.substring(0, 100),
    },
  });
}

export async function notifyRentalRequest(
  ownerId: string,
  renterName: string,
  vehicleTitle: string,
  startDate: string,
  endDate: string,
  totalPrice: number
): Promise<boolean> {
  return sendNotification({
    type: "rental_request",
    recipient_id: ownerId,
    data: {
      renter_name: renterName,
      vehicle_title: vehicleTitle,
      start_date: startDate,
      end_date: endDate,
      total_price: totalPrice.toFixed(2),
    },
  });
}

export async function notifyRentalApproved(
  renterId: string,
  vehicleTitle: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  return sendNotification({
    type: "rental_approved",
    recipient_id: renterId,
    data: {
      vehicle_title: vehicleTitle,
      start_date: startDate,
      end_date: endDate,
    },
  });
}

export async function notifyRentalRejected(
  renterId: string,
  vehicleTitle: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  return sendNotification({
    type: "rental_rejected",
    recipient_id: renterId,
    data: {
      vehicle_title: vehicleTitle,
      start_date: startDate,
      end_date: endDate,
    },
  });
}

export async function notifyContractSent(
  renterId: string,
  vehicleTitle: string,
  contractNumber: string
): Promise<boolean> {
  return sendNotification({
    type: "contract_sent",
    recipient_id: renterId,
    data: {
      vehicle_title: vehicleTitle,
      contract_number: contractNumber,
    },
  });
}

export async function notifyContractSigned(
  ownerId: string,
  renterName: string,
  vehicleTitle: string,
  contractNumber: string
): Promise<boolean> {
  return sendNotification({
    type: "contract_signed",
    recipient_id: ownerId,
    data: {
      renter_name: renterName,
      vehicle_title: vehicleTitle,
      contract_number: contractNumber,
    },
  });
}

export async function notifyDropoffInspectionCompleted(
  ownerId: string,
  renterName: string,
  vehicleTitle: string,
  rentalId: string,
  hasDamages: boolean
): Promise<boolean> {
  return sendNotification({
    type: "dropoff_inspection_completed",
    recipient_id: ownerId,
    data: {
      renter_name: renterName,
      vehicle_title: vehicleTitle,
      rental_id: rentalId,
      has_damages: hasDamages,
    },
  });
}
