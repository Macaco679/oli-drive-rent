import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, createProfile, getProfile } from "@/lib/supabase";
import { toast } from "sonner";
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
      navigate("/home");
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
      navigate("/home");
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
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-accent items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <h1 className="text-6xl font-bold mb-6">OLI</h1>
          <p className="text-2xl mb-4">Bem-vindo!</p>
          <p className="text-white/80 text-lg">
            Vamos configurar seu perfil para você começar a usar a plataforma de aluguel de carros.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center">
            <h1 className="text-4xl font-bold text-primary mb-2">OLI</h1>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Configurar perfil</h2>
            <p className="text-muted-foreground">
              Complete suas informações para começar
            </p>
          </div>

          <div className="bg-card p-8 rounded-2xl shadow-xl border border-border space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="mt-1 h-12"
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
                  className="mt-1 h-12"
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
                      : "border-border bg-background hover:border-primary/50"
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
              className="w-full h-12 text-lg"
            >
              {loading ? "Salvando..." : "Começar a usar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}