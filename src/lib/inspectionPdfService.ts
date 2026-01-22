// ============================================================
// INSPECTION PDF SERVICE - Gera relatório PDF da vistoria
// ============================================================

import jsPDF from "jspdf";
import { Inspection, InspectionPhoto, INSPECTION_PHOTO_TYPES } from "./inspectionService";
import { OliVehicle, OliRental, OliProfile } from "./supabase";

export interface InspectionReportData {
  inspection: Inspection;
  photos: InspectionPhoto[];
  vehicle: OliVehicle;
  rental: OliRental;
  owner: OliProfile | null;
  renter: OliProfile | null;
}

// Convert image URL to base64 for embedding in PDF
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao converter imagem:", error);
    return null;
  }
}

// Format date for display
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

// Generate inspection PDF report
export async function generateInspectionPDF(data: InspectionReportData): Promise<void> {
  const { inspection, photos, vehicle, rental, owner, renter } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const kindLabel = inspection.inspection_kind === "pickup" ? "RETIRADA" : "DEVOLUÇÃO";

  // Header
  doc.setFillColor(39, 39, 42); // zinc-800
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("OLI DRIVE", margin, 18);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`RELATÓRIO DE VISTORIA - ${kindLabel}`, margin, 28);

  doc.setTextColor(0, 0, 0);
  y = 45;

  // Info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DA LOCAÇÃO", margin + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const vehicleTitle = vehicle.title || `${vehicle.brand} ${vehicle.model}`;
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;

  doc.text(`Veículo: ${vehicleTitle}`, col1X, y + 16);
  doc.text(`Ano: ${vehicle.year || "-"}`, col2X, y + 16);
  doc.text(`Placa: ${vehicle.plate || "-"}`, col1X, y + 22);
  doc.text(`Cor: ${vehicle.color || "-"}`, col2X, y + 22);
  doc.text(`Proprietário: ${owner?.full_name || "-"}`, col1X, y + 28);
  doc.text(`Locatário: ${renter?.full_name || "-"}`, col2X, y + 28);
  doc.text(`Período: ${formatDate(rental.start_date)} a ${formatDate(rental.end_date)}`, col1X, y + 34);
  doc.text(`Vistoria realizada em: ${formatDate(inspection.created_at)}`, col2X, y + 34);

  y += 48;

  // Photos section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("REGISTRO FOTOGRÁFICO", margin, y);
  y += 6;

  // Calculate grid for photos
  const photoWidth = (pageWidth - margin * 2 - 10) / 2;
  const photoHeight = 45;
  const photosPerRow = 2;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const col = i % photosPerRow;
    const photoX = margin + col * (photoWidth + 10);

    // Check if we need a new page
    if (y + photoHeight + 15 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Photo label
    const photoType = INSPECTION_PHOTO_TYPES.find(
      (t) => t.label === photo.description || t.id === photo.description
    );
    const label = photoType?.label || photo.description || `Foto ${i + 1}`;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label, photoX, y);

    // Damage indicator
    if (photo.has_damage) {
      doc.setTextColor(220, 38, 38); // red-600
      doc.text(" [AVARIA]", photoX + doc.getTextWidth(label), y);
      doc.setTextColor(0, 0, 0);
    }

    // Try to embed image
    try {
      const base64 = await imageUrlToBase64(photo.image_url);
      if (base64) {
        doc.addImage(base64, "JPEG", photoX, y + 2, photoWidth, photoHeight);
      } else {
        // Placeholder for failed image
        doc.setFillColor(229, 231, 235);
        doc.rect(photoX, y + 2, photoWidth, photoHeight, "F");
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text("Imagem não disponível", photoX + photoWidth / 2 - 15, y + photoHeight / 2);
        doc.setTextColor(0, 0, 0);
      }
    } catch {
      doc.setFillColor(229, 231, 235);
      doc.rect(photoX, y + 2, photoWidth, photoHeight, "F");
    }

    // Move to next row after every 2 photos
    if (col === 1) {
      y += photoHeight + 12;
    }
  }

  // If odd number of photos, move to next row
  if (photos.length % 2 === 1) {
    y += photoHeight + 12;
  }

  // Notes section
  if (inspection.notes) {
    if (y + 30 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES", margin, y);
    y += 5;

    doc.setFillColor(255, 251, 235); // amber-50
    doc.roundedRect(margin, y, pageWidth - margin * 2, 25, 2, 2, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(inspection.notes, pageWidth - margin * 2 - 10);
    doc.text(splitNotes, margin + 5, y + 6);
    y += 30;
  }

  // Damage summary
  const damagePhotos = photos.filter((p) => p.has_damage);
  if (damagePhotos.length > 0) {
    if (y + 25 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(254, 242, 242); // red-50
    doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`⚠ AVARIAS IDENTIFICADAS: ${damagePhotos.length}`, margin + 5, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const damageLabels = damagePhotos.map((p) => p.description).join(", ");
    doc.text(damageLabels, margin + 5, y + 14);

    doc.setTextColor(0, 0, 0);
    y += 25;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Relatório gerado automaticamente pela plataforma Oli Drive em ${formatDate(new Date().toISOString())}`,
    margin,
    pageHeight - 10
  );
  doc.text(`ID da vistoria: ${inspection.id}`, margin, pageHeight - 6);

  // Download
  const kindSuffix = inspection.inspection_kind === "pickup" ? "retirada" : "devolucao";
  const filename = `vistoria-${kindSuffix}-${vehicle.plate || inspection.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// Generate comparison PDF (pickup vs dropoff)
export async function generateComparisonPDF(
  pickupData: InspectionReportData,
  dropoffData: InspectionReportData
): Promise<void> {
  const { vehicle, rental, owner, renter } = pickupData;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // Header
  doc.setFillColor(39, 39, 42);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OLI DRIVE", margin, 15);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("COMPARATIVO DE VISTORIAS - RETIRADA vs DEVOLUÇÃO", margin, 24);

  doc.setTextColor(0, 0, 0);
  y = 38;

  // Vehicle info
  const vehicleTitle = vehicle.title || `${vehicle.brand} ${vehicle.model}`;
  doc.setFontSize(9);
  doc.text(
    `Veículo: ${vehicleTitle} | Placa: ${vehicle.plate || "-"} | Locatário: ${renter?.full_name || "-"}`,
    margin,
    y
  );
  y += 8;

  // Column headers
  const colWidth = (pageWidth - margin * 2 - 10) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 10;

  doc.setFillColor(220, 252, 231); // green-100
  doc.rect(col1X, y, colWidth, 8, "F");
  doc.setFillColor(254, 226, 226); // red-100
  doc.rect(col2X, y, colWidth, 8, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`RETIRADA - ${formatDate(pickupData.inspection.created_at)}`, col1X + 5, y + 5.5);
  doc.text(`DEVOLUÇÃO - ${formatDate(dropoffData.inspection.created_at)}`, col2X + 5, y + 5.5);
  y += 12;

  // Compare photos side by side
  const photoHeight = 35;
  const photoWidth = colWidth - 10;

  for (let i = 0; i < INSPECTION_PHOTO_TYPES.length; i++) {
    const photoType = INSPECTION_PHOTO_TYPES[i];
    const pickupPhoto = pickupData.photos.find((p) => p.description === photoType.label);
    const dropoffPhoto = dropoffData.photos.find((p) => p.description === photoType.label);

    // Check if we need a new page
    if (y + photoHeight + 15 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Label
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(photoType.label, col1X, y);

    // Pickup photo
    if (pickupPhoto) {
      try {
        const base64 = await imageUrlToBase64(pickupPhoto.image_url);
        if (base64) {
          doc.addImage(base64, "JPEG", col1X, y + 2, photoWidth, photoHeight);
        }
      } catch {
        doc.setFillColor(229, 231, 235);
        doc.rect(col1X, y + 2, photoWidth, photoHeight, "F");
      }

      if (pickupPhoto.has_damage) {
        doc.setTextColor(220, 38, 38);
        doc.text("[AVARIA]", col1X + photoWidth - 15, y + photoHeight - 2);
        doc.setTextColor(0, 0, 0);
      }
    }

    // Dropoff photo
    if (dropoffPhoto) {
      try {
        const base64 = await imageUrlToBase64(dropoffPhoto.image_url);
        if (base64) {
          doc.addImage(base64, "JPEG", col2X, y + 2, photoWidth, photoHeight);
        }
      } catch {
        doc.setFillColor(229, 231, 235);
        doc.rect(col2X, y + 2, photoWidth, photoHeight, "F");
      }

      if (dropoffPhoto.has_damage) {
        doc.setTextColor(220, 38, 38);
        doc.text("[AVARIA]", col2X + photoWidth - 15, y + photoHeight - 2);
        doc.setTextColor(0, 0, 0);
      }
    }

    y += photoHeight + 8;
  }

  // Damage comparison summary
  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO COMPARATIVO", margin, y);
  y += 10;

  const pickupDamages = pickupData.photos.filter((p) => p.has_damage);
  const dropoffDamages = dropoffData.photos.filter((p) => p.has_damage);
  const newDamages = dropoffDamages.filter(
    (d) => !pickupDamages.some((p) => p.description === d.description)
  );

  // Summary table
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  doc.text(`Avarias na retirada: ${pickupDamages.length}`, margin, y);
  y += 6;
  doc.text(`Avarias na devolução: ${dropoffDamages.length}`, margin, y);
  y += 6;

  if (newDamages.length > 0) {
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    doc.text(`⚠ NOVAS AVARIAS IDENTIFICADAS: ${newDamages.length}`, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    newDamages.forEach((d) => {
      doc.text(`  • ${d.description}`, margin, y);
      y += 5;
    });
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(22, 163, 74); // green-600
    doc.setFont("helvetica", "bold");
    doc.text("✓ Nenhuma nova avaria identificada", margin, y);
    doc.setTextColor(0, 0, 0);
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Relatório gerado automaticamente pela plataforma Oli Drive em ${formatDate(new Date().toISOString())}`,
    margin,
    pageHeight - 6
  );

  // Download
  const filename = `comparativo-vistorias-${vehicle.plate || rental.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}
