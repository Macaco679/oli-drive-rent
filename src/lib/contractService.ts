import { supabase } from "@/integrations/supabase/client";
import { OliProfile, OliVehicle, OliRental } from "./supabase";

export interface ContractData {
  rental: OliRental;
  vehicle: OliVehicle;
  owner: OliProfile;
  renter: OliProfile;
  contract?: RentalContract | null;
}

export interface RentalContract {
  id: string;
  rental_id: string;
  status: "pending" | "signed" | "cancelled";
  contract_number: string | null;
  renter_signed_at: string | null;
  owner_signed_at: string | null;
  file_url: string | null;
  version: string | null;
  created_at: string;
  updated_at: string;
}

// Buscar contrato de uma reserva
export async function getContractByRentalId(rentalId: string): Promise<RentalContract | null> {
  const { data, error } = await supabase
    .from("oli_rental_contracts")
    .select("*")
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar contrato:", error);
    return null;
  }

  return data as RentalContract | null;
}

// Gerar número do contrato
function generateContractNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OLI-${year}${month}-${random}`;
}

// Criar/Enviar contrato (chamado pelo proprietário)
export async function createContract(rentalId: string): Promise<RentalContract | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Verificar se já existe contrato
  const existing = await getContractByRentalId(rentalId);
  if (existing) {
    // Atualiza timestamp para "reenviar"
    const { data, error } = await supabase
      .from("oli_rental_contracts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    
    if (error) {
      console.error("Erro ao atualizar contrato:", error);
      return null;
    }
    return data as RentalContract;
  }

  // Criar novo contrato
  const { data, error } = await supabase
    .from("oli_rental_contracts")
    .insert({
      rental_id: rentalId,
      contract_number: generateContractNumber(),
      status: "pending",
      version: "1.0",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar contrato:", error);
    return null;
  }

  return data as RentalContract;
}

// Assinar contrato (pelo locatário)
export async function signContractAsRenter(contractId: string): Promise<boolean> {
  const { error } = await supabase
    .from("oli_rental_contracts")
    .update({ 
      renter_signed_at: new Date().toISOString(),
      status: "signed"
    })
    .eq("id", contractId);

  if (error) {
    console.error("Erro ao assinar contrato:", error);
    return false;
  }

  return true;
}

// Formatar CPF para exibição
function formatCPF(cpf: string | null): string {
  if (!cpf) return "[CPF não informado]";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

// Formatar telefone
function formatPhone(phone: string | null): string {
  if (!phone) return "[Telefone não informado]";
  return phone;
}

// Formatar data
function formatDate(date: string | null): string {
  if (!date) return "[Data não informada]";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
}

// Calcular número de dias da locação
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Gerar texto do contrato com dados preenchidos
export function generateContractText(data: ContractData): string {
  const { rental, vehicle, owner, renter, contract } = data;
  const days = calculateDays(rental.start_date, rental.end_date);
  const contractNumber = contract?.contract_number || generateContractNumber();
  const today = new Date().toLocaleDateString("pt-BR");
  const city = vehicle.location_city || "[Cidade]";
  const state = vehicle.location_state || "[Estado]";

  return `CONTRATO DE LOCAÇÃO DE VEÍCULO PARA USO EM APLICATIVOS DE MOBILIDADE

Contrato Nº: ${contractNumber}
Data: ${today}

═══════════════════════════════════════════════════════════════

LOCADOR:

Nome: ${owner.full_name || "[Nome do Locador]"}
CPF nº: ${formatCPF(owner.cpf)}
Telefone: ${formatPhone(owner.phone || owner.whatsapp_phone)}
Email: ${owner.email || "[Email não informado]"}

═══════════════════════════════════════════════════════════════

LOCATÁRIO:

Nome: ${renter.full_name || "[Nome do Locatário]"}
CPF nº: ${formatCPF(renter.cpf)}
Data de Nascimento: ${formatDate(renter.birth_date)}
Telefone: ${formatPhone(renter.phone || renter.whatsapp_phone)}
Email: ${renter.email || "[Email não informado]"}

═══════════════════════════════════════════════════════════════

As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Locação de Veículo por Prazo Determinado, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.

CLÁUSULA PRIMEIRA - DO OBJETO DO CONTRATO

O presente contrato tem como OBJETO a locação do veículo:
• Marca: ${vehicle.brand || "[Marca]"}
• Modelo: ${vehicle.model || "[Modelo]"}
• Ano: ${vehicle.year || "[Ano]"}
• Cor: ${vehicle.color || "[Cor]"}
• Placa: ${vehicle.plate || "[Placa]"}
• RENAVAM: ${vehicle.renavam || "[RENAVAM]"}

De propriedade do LOCADOR.

CLÁUSULA SEGUNDA - DO USO

O veículo, objeto deste contrato, será utilizado exclusivamente pelo LOCATÁRIO para fins de transporte de passageiros por meio de aplicativos de mobilidade, tais como Uber, 99, etc. É vedado o uso do veículo para qualquer outra finalidade ou por terceiros não autorizados, sob pena de rescisão contratual e pagamento da multa prevista na Cláusula 7ª.

Parágrafo único: O LOCATÁRIO compromete-se a seguir as diretrizes e exigências das plataformas de transporte de passageiros.

CLÁUSULA TERCEIRA - DA DEVOLUÇÃO

O LOCATÁRIO deverá devolver o veículo ao LOCADOR nas mesmas condições em que foi recebido, conforme laudo de vistoria anexo, e responderá por quaisquer danos ou prejuízos.

CLÁUSULA QUARTA - DO PRAZO

O prazo da locação será de ${days} dias, iniciando-se no dia ${formatDate(rental.start_date)} e terminando no dia ${formatDate(rental.end_date)}, podendo ser renovado mediante acordo das partes. O veículo deverá ser devolvido na data de término no estado em que foi locado.

Local de Retirada: ${rental.pickup_location || "A combinar com o proprietário"}
Local de Devolução: ${rental.dropoff_location || "A combinar com o proprietário"}

CLÁUSULA QUINTA - DA MULTA POR ATRASO NA DEVOLUÇÃO

Caso o LOCATÁRIO não devolva o veículo na data estipulada, deverá pagar o valor de R$ ${(vehicle.daily_price || 0).toLocaleString("pt-BR")} por dia de atraso, além de responder por qualquer dano ao veículo, mesmo que decorrente de caso fortuito.

CLÁUSULA SEXTA - DA RESCISÃO

O contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 7 (sete) dias. O inadimplemento contratual por qualquer das partes justifica a rescisão imediata, dispensando o aviso prévio.

CLÁUSULA SÉTIMA - DA MULTA POR INADIMPLEMENTO

O descumprimento de qualquer cláusula contratual resultará em multa no valor de R$ ${((rental.total_price || 0) * 0.1).toLocaleString("pt-BR")}, a ser paga pela parte inadimplente.

CLÁUSULA OITAVA - DO PAGAMENTO

O valor da locação é de R$ ${(rental.total_price || 0).toLocaleString("pt-BR")} pelo período total de ${days} dias.

${rental.deposit_amount ? `Caução: R$ ${rental.deposit_amount.toLocaleString("pt-BR")}` : ""}

Parágrafo único: Em caso de inadimplemento, incidirão multa de mora de 2% e juros de 1% ao mês sobre o valor devido, calculados pro rata die.

CLÁUSULA NONA - DAS MULTAS E ENCARGOS

O LOCATÁRIO será responsável por multas de trânsito e encargos relacionados ao veículo durante o período de locação. Os impostos e encargos como IPVA, seguro obrigatório e licenciamento anual são de responsabilidade do LOCADOR.

CLÁUSULA DÉCIMA - DO SEGURO

O veículo está coberto por seguro contra furto, roubo e acidentes, custeado pelo LOCADOR. Em caso de sinistro causado por culpa do LOCATÁRIO, este será responsável pelo pagamento da franquia de seguro.

CLÁUSULA DÉCIMA PRIMEIRA - DO FORO

Fica eleito o foro da comarca de ${city}, ${state}, para dirimir quaisquer controvérsias oriundas deste contrato.

CLÁUSULA DÉCIMA SEGUNDA - DISPOSIÇÕES GERAIS

Este contrato é firmado em 2 (duas) vias de igual teor e forma, ficando uma via para cada parte.

═══════════════════════════════════════════════════════════════

LOCADOR:

_________________________________
${owner.full_name || "[Nome do Locador]"}


LOCATÁRIO:

_________________________________
${renter.full_name || "[Nome do Locatário]"}

═══════════════════════════════════════════════════════════════

Contrato gerado eletronicamente pela plataforma Oli Drive
${today}`;
}
