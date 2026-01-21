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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getCurrentUser, getProfile, updateProfile, OliProfile } from "@/lib/supabase";
import { getMissingFields } from "@/hooks/useProfileCompletion";

// Validation schema
const formSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").max(15, "Telefone inválido"),
  whatsapp_phone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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
      birth_date: "",
      phone: "",
      whatsapp_phone: "",
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
        form.reset({
          full_name: userProfile.full_name || "",
          cpf: userProfile.cpf ? formatCPF(userProfile.cpf) : "",
          birth_date: userProfile.birth_date || "",
          phone: userProfile.phone ? formatPhone(userProfile.phone) : "",
          whatsapp_phone: userProfile.whatsapp_phone ? formatPhone(userProfile.whatsapp_phone) : "",
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
      const cleanedData = {
        full_name: data.full_name.trim(),
        cpf: data.cpf.replace(/\D/g, ""),
        birth_date: data.birth_date,
        phone: data.phone.replace(/\D/g, ""),
        whatsapp_phone: data.whatsapp_phone?.replace(/\D/g, "") || null,
      };

      const updated = await updateProfile(profile.id, cleanedData);
      if (updated) {
        setProfile(updated);
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
