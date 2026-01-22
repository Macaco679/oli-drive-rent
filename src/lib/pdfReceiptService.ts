import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReceiptData {
  id: string;
  amount: number;
  paymentType: string;
  vehicleTitle: string;
  status: string;
  createdAt: string;
  externalReference?: string | null;
  rentalPeriod?: {
    startDate: string;
    endDate: string;
  };
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  completed: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
};

// Gera QR code como data URL
async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 120,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch {
    console.error("Erro ao gerar QR code");
    return "";
  }
}

// Logo SVG simples da Oli Drive em base64
const OLI_LOGO_SVG = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="30" cy="30" r="25" fill="url(#grad)"/>
  <text x="30" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">O</text>
  <text x="120" y="42" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#1f2937">
    <tspan fill="url(#grad)">Oli</tspan><tspan fill="#6b7280"> Drive</tspan>
  </text>
</svg>
`)}`;

export async function generatePaymentReceiptPDF(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // ========== HEADER ==========
  // Logo placeholder (retângulo azul com texto)
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, 40, 15, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Oli Drive", margin + 20, y + 10, { align: "center" });

  // Título do comprovante
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Comprovante de Pagamento", pageWidth / 2, y + 8, { align: "center" });

  y += 25;

  // Linha separadora
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ========== QR CODE ==========
  // Gerar QR code com dados do pagamento
  const qrData = JSON.stringify({
    type: "OLI_PAYMENT",
    id: data.id.slice(0, 8).toUpperCase(),
    amount: data.amount,
    date: data.createdAt,
    ref: data.externalReference || "",
  });

  const qrCodeUrl = await generateQRCodeDataURL(qrData);
  if (qrCodeUrl) {
    const qrSize = 35;
    const qrX = pageWidth - margin - qrSize;
    doc.addImage(qrCodeUrl, "PNG", qrX, y, qrSize, qrSize);
  }

  // ========== INFORMAÇÕES PRINCIPAIS ==========
  const infoX = margin;
  const infoWidth = pageWidth - margin * 2 - 45; // Espaço para o QR code

  // Código do pagamento
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Código do pagamento", infoX, y);
  y += 5;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text(data.id.slice(0, 8).toUpperCase(), infoX, y);
  y += 10;

  // Data e hora
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Data e hora", infoX, y);
  y += 5;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
  doc.text(format(new Date(data.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }), infoX, y);
  y += 10;

  // Status
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Status", infoX, y);
  y += 5;
  
  // Badge de status
  const statusLabel = statusLabels[data.status] || data.status;
  const statusColor = data.status === "completed" ? [22, 163, 74] : [107, 114, 128];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(infoX, y - 3.5, doc.getTextWidth(statusLabel) + 8, 6, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, infoX + 4, y + 1);

  y += 20;

  // Linha separadora
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ========== DETALHES DO PAGAMENTO ==========
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Detalhes do Pagamento", margin, y);
  y += 10;

  // Container com fundo
  const detailsHeight = data.rentalPeriod ? 45 : 35;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, y - 3, pageWidth - margin * 2, detailsHeight, 3, 3, "F");

  const labelX = margin + 5;
  const valueX = pageWidth - margin - 5;

  // Tipo de pagamento
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Tipo", labelX, y + 5);
  doc.setTextColor(31, 41, 55);
  doc.text(data.paymentType, valueX, y + 5, { align: "right" });

  // Veículo
  doc.setTextColor(107, 114, 128);
  doc.text("Veículo", labelX, y + 15);
  doc.setTextColor(31, 41, 55);
  doc.text(data.vehicleTitle, valueX, y + 15, { align: "right" });

  // Método
  doc.setTextColor(107, 114, 128);
  doc.text("Método de pagamento", labelX, y + 25);
  doc.setTextColor(31, 41, 55);
  doc.text("PIX", valueX, y + 25, { align: "right" });

  // Período do aluguel (se existir)
  if (data.rentalPeriod) {
    const periodText = `${format(new Date(data.rentalPeriod.startDate), "dd/MM/yyyy")} a ${format(new Date(data.rentalPeriod.endDate), "dd/MM/yyyy")}`;
    doc.setTextColor(107, 114, 128);
    doc.text("Período do aluguel", labelX, y + 35);
    doc.setTextColor(31, 41, 55);
    doc.text(periodText, valueX, y + 35, { align: "right" });
  }

  y += detailsHeight + 10;

  // Referência externa (se existir)
  if (data.externalReference) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("Código de referência PIX", margin, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    doc.text(data.externalReference, margin, y);
    y += 15;
  }

  // ========== VALOR TOTAL ==========
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 25, 3, 3, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("Valor Total", margin + 10, y + 10);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`R$ ${data.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, pageWidth - margin - 10, y + 16, { align: "right" });

  y += 35;

  // ========== FOOTER ==========
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175);
  doc.text("Este é um comprovante digital gerado pela plataforma Oli Drive.", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("Para dúvidas ou suporte, entre em contato pelo app ou email.", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, y, { align: "center" });

  // Download do PDF
  const fileName = `comprovante-oli-${data.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
}
