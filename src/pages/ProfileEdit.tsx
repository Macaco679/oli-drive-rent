import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, User, Save, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getCurrentUser, getProfile, updateProfile, OliProfile } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { getMissingFields } from "@/hooks/useProfileCompletion";
import { FaceRecognitionField } from "@/components/profile/FaceRecognitionField";
import { MapPin } from "lucide-react";

// Validation schema
const formSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  rg: z.string().optional(),
  nationality: z.string().optional(),
  marital_status: z.string().optional(),
  profession: z.string().optional(),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").max(15, "Telefone inválido"),
  whatsapp_phone: z.string().optional(),
  // Address fields
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Marital status options
const maritalStatusOptions = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

// CPF formatting
const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Phone formatting
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// RG formatting (simple, varies by state)
const formatRG = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 20);
};

// CEP formatting
const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export default function ProfileEdit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<OliProfile | null>(null);
  const [email, setEmail] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      cpf: "",
      rg: "",
      nationality: "Brasileiro(a)",
      marital_status: "",
      profession: "",
      birth_date: "",
      phone: "",
      whatsapp_phone: "",
      street: "",
      number: "",
      neighborhood: "",
      complement: "",
      city: "",
      state: "",
      postal_code: "",
    },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { user } = await getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setEmail(user.email || "");

      const userProfile = await getProfile(user.id);
      if (userProfile) {
        setProfile(userProfile);

        // Load address from oli_user_addresses
        const { data: addrData } = await supabase
          .from("oli_user_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();

        form.reset({
          full_name: userProfile.full_name || "",
          cpf: userProfile.cpf ? formatCPF(userProfile.cpf) : "",
          rg: userProfile.rg || "",
          nationality: userProfile.nationality || "Brasileiro(a)",
          marital_status: userProfile.marital_status || "",
          profession: userProfile.profession || "",
          birth_date: userProfile.birth_date || "",
          phone: userProfile.phone ? formatPhone(userProfile.phone) : "",
          whatsapp_phone: userProfile.whatsapp_phone ? formatPhone(userProfile.whatsapp_phone) : "",
          street: addrData?.street || "",
          number: addrData?.number || "",
          neighborhood: addrData?.neighborhood || "",
          complement: addrData?.complement || "",
          city: addrData?.city || "",
          state: addrData?.state || "",
          postal_code: addrData?.postal_code ? formatCEP(addrData.postal_code) : "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;

    setSaving(true);
    try {
      // Remove formatting before saving
      const cleanedData: Record<string, unknown> = {
        full_name: data.full_name.trim(),
        cpf: data.cpf.replace(/\D/g, ""),
        rg: data.rg?.trim() || null,
        nationality: data.nationality?.trim() || "Brasileiro(a)",
        marital_status: data.marital_status || null,
        profession: data.profession?.trim() || null,
        birth_date: data.birth_date,
        phone: data.phone.replace(/\D/g, ""),
        whatsapp_phone: data.whatsapp_phone?.replace(/\D/g, "") || null,
        // Sync address fields to oli_profiles columns
        street: data.street?.trim() || null,
        neigbhorhood: data.neighborhood?.trim() || null,
        number: data.number?.trim() ? Number(data.number.trim()) : null,
        complemention: data.complement?.trim() || null,
      };

      const updated = await updateProfile(profile.id, cleanedData);
      if (updated) {
        setProfile(updated);

        // Save address to oli_user_addresses (upsert)
        const addressData = {
          user_id: profile.id,
          street: data.street?.trim() || null,
          number: data.number?.trim() || null,
          neighborhood: data.neighborhood?.trim() || null,
          complement: data.complement?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          postal_code: data.postal_code?.replace(/\D/g, "") || null,
          is_default: true,
          label: "Principal",
        };

        // Check if address already exists
        const { data: existingAddr } = await supabase
          .from("oli_user_addresses")
          .select("id")
          .eq("user_id", profile.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAddr) {
          await supabase
            .from("oli_user_addresses")
            .update(addressData)
            .eq("id", existingAddr.id);
        } else {
          await supabase
            .from("oli_user_addresses")
            .insert(addressData);
        }

        toast.success("Dados atualizados com sucesso!");
        navigate("/profile");
      } else {
        toast.error("Erro ao atualizar dados");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar dados");
    } finally {
      setSaving(false);
    }
  };

  const missingFields = getMissingFields(profile);
  const isIncomplete = missingFields.length > 0;

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WebLayout>
    );
  }

  return (
    <div className="min-h-screen bg-primary/5">
      {/* Header */}
      <div className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <User className="w-7 h-7" />
              <h1 className="text-xl font-bold">Meus Dados Pessoais</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {/* Alert for incomplete profile */}
        {isIncomplete && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Perfil incompleto!</strong> Complete seus dados para poder alugar veículos.
              <br />
              <span className="text-sm">
                Campos faltando: {missingFields.join(", ")}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {!isIncomplete && (
          <Alert className="mb-6 border-primary/50 bg-primary/5 text-primary">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Perfil completo!</strong> Você pode alugar veículos normalmente.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email (read-only) */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg">E-mail</CardTitle>
                <CardDescription>
                  O e-mail não pode ser alterado
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Input
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </CardContent>
            </Card>

            {/* Personal Data */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatCPF(e.target.value);
                            field.onChange(formatted);
                          }}
                          className="font-mono"
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RG (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000-0"
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatRG(e.target.value);
                            field.onChange(formatted);
                          }}
                          className="font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de nascimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nacionalidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Brasileiro(a)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marital_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado Civil</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {maritalStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissão</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Motorista de aplicativo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            field.onChange(formatted);
                          }}
                          className="font-mono"
                          inputMode="tel"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            field.onChange(formatted);
                          }}
                          className="font-mono"
                          inputMode="tel"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Se diferente do telefone principal
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Address */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <MapPin className="w-5 h-5 text-primary" />
                  Endereço
                </CardTitle>
                <CardDescription>
                  Necessário para geração do contrato de locação
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua / Logradouro</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Rua das Flores" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, Bloco..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Centro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado (UF)</FormLabel>
                        <FormControl>
                          <Input placeholder="SP" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-000"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCEP(e.target.value))}
                          className="font-mono"
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <FaceRecognitionField
              currentFaceUrl={(profile as any)?.face_recognition_url || null}
              validation={{
                status: (profile as any)?.face_validation_status || null,
                score: (profile as any)?.face_validation_score ?? null,
                provider: (profile as any)?.face_validation_provider || null,
                requestedAt: (profile as any)?.face_validation_requested_at || null,
                validatedAt: (profile as any)?.face_validation_validated_at || null,
                referenceId: (profile as any)?.face_validation_reference_id || null,
              }}
              onFaceChange={({ url, status, score, provider, requestedAt, validatedAt, referenceId }) => {
                if (profile) {
                  setProfile({
                    ...profile,
                    face_recognition_url: url,
                    face_validation_status: status ?? null,
                    face_validation_score: score ?? null,
                    face_validation_provider: provider ?? null,
                    face_validation_requested_at: requestedAt ?? null,
                    face_validation_validated_at: validatedAt ?? null,
                    face_validation_reference_id: referenceId ?? null,
                  } as any);
                }
              }}
            />

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-14 text-lg shadow-lg"
              size="lg"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
