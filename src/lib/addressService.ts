export interface PostalCodeLookupResult {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  complemento?: string;
  erro?: boolean;
}

const postalCodeCache = new Map<string, PostalCodeLookupResult>();

export function sanitizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatPostalCode(value: string): string {
  const digits = sanitizePostalCode(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isPostalCodeComplete(value: string): boolean {
  return sanitizePostalCode(value).length === 8;
}

export async function lookupAddressByPostalCode(postalCode: string): Promise<PostalCodeLookupResult> {
  const sanitizedPostalCode = sanitizePostalCode(postalCode);

  if (sanitizedPostalCode.length !== 8) {
    throw new Error("Informe um CEP com 8 digitos.");
  }

  const cached = postalCodeCache.get(sanitizedPostalCode);
  if (cached) return cached;

  const response = await fetch(`https://viacep.com.br/ws/${sanitizedPostalCode}/json/`);

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar o CEP.");
  }

  const data = (await response.json()) as ViaCepResponse;

  if (data.erro) {
    throw new Error("CEP nao encontrado.");
  }

  const result: PostalCodeLookupResult = {
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: (data.uf || "").toUpperCase(),
    complement: data.complemento || "",
  };

  postalCodeCache.set(sanitizedPostalCode, result);
  return result;
}
