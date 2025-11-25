import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, createProfile, getProfile } from "@/lib/supabase";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Car, UserCheck, Users } from "lucide-react";

type UserRole = "renter" | "owner" | "both";

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const profile = await getProfile(user.id);
    if (profile) {
      navigate("/");
    }
  };

  const handleComplete = async () => {
    if (!selectedRole) {
      toast.error("Por favor, selecione um tipo de conta");
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);

    const { user } = await getCurrentUser();
    if (!user) {
      toast.error("Usuário não encontrado");
      navigate("/auth");
      return;
    }

    const profile = await createProfile({
      id: user.id,
      full_name: fullName,
      phone: phone,
      whatsapp_phone: phone,
      role: selectedRole,
    });

    setLoading(false);

    if (profile) {
      toast.success("Perfil criado com sucesso!");
      navigate("/");
    } else {
      toast.error("Erro ao criar perfil");
    }
  };

  const roleOptions = [
    {
      value: "renter" as UserRole,
      icon: UserCheck,
      title: "Quero alugar carros",
      description: "Sou motorista e preciso de um veículo",
    },
    {
      value: "owner" as UserRole,
      icon: Car,
      title: "Quero anunciar meus carros",
      description: "Tenho veículos e quero alugá-los",
    },
    {
      value: "both" as UserRole,
      icon: Users,
      title: "Quero as duas opções",
      description: "Alugar e anunciar veículos",
    },
  ];

  return (
    <MobileLayout showBottomNav={false}>
      <div className="min-h-screen p-6 bg-background">
        <div className="max-w-md mx-auto space-y-8 pt-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Bem-vindo ao OLI!</h1>
            <p className="text-muted-foreground">
              Vamos configurar seu perfil
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone/WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Tipo de conta</Label>
            {roleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedRole(option.value)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedRole === option.value
                    ? "border-primary bg-secondary/50"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <option.icon className={`w-6 h-6 mt-0.5 ${
                    selectedRole === option.value ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <div className="flex-1">
                    <h3 className="font-semibold">{option.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={handleComplete}
            disabled={loading || !selectedRole}
            className="w-full btn-pill bg-primary hover:bg-primary/90 text-lg h-12"
          >
            {loading ? "Salvando..." : "Começar a usar"}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
