import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getProfile, signOut, OliProfile } from "@/lib/supabase";
import { ensureProfile } from "@/lib/ensureProfile";
import { DriverLicenseCard } from "@/components/profile/DriverLicenseCard";
import { DriverLicenseDebug } from "@/components/profile/DriverLicenseDebug";
import { useDriverLicense } from "@/contexts/DriverLicenseContext";
import { User, Car, HelpCircle, LogOut, ChevronRight, Mail, Phone, Receipt, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const [profile, setProfile] = useState<OliProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { licenseStatus } = useDriverLicense();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Garantir que o email esteja sincronizado (fallback)
    await ensureProfile();

    const userProfile = await getProfile(user.id);
    setProfile(userProfile);
    setLoading(false);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Você saiu da sua conta");
      navigate("/auth");
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      renter: "Motorista",
      owner: "Locador",
      both: "Motorista e Locador",
    };
    return roleMap[role] || role;
  };

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </WebLayout>
    );
  }

  if (!profile) {
    return (
      <WebLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Perfil não encontrado</p>
        </div>
      </WebLayout>
    );
  }

  const menuItems = [
    {
      icon: User,
      label: "Meus dados pessoais",
      subtitle: "Editar nome, telefone e informações",
      onClick: () => navigate("/profile/edit"),
    },
    {
      icon: MessageCircle,
      label: "Mensagens",
      subtitle: "Ver conversas com proprietários e locatários",
      onClick: () => navigate("/messages"),
    },
    {
      icon: Receipt,
      label: "Histórico de pagamentos",
      subtitle: "Ver recibos e comprovantes PIX",
      onClick: () => navigate("/profile/payments"),
    },
    {
      icon: Car,
      label: "Tipo de conta",
      subtitle: getRoleLabel(profile.role),
      onClick: () => navigate("/profile/account-type"),
    },
  ];

  if (profile.role === "owner" || profile.role === "both") {
    menuItems.push({
      icon: Car,
      label: "Meus veículos",
      subtitle: "Gerenciar carros cadastrados",
      onClick: () => navigate("/my-vehicles"),
    });
  }

  menuItems.push({
    icon: HelpCircle,
    label: "Ajuda e suporte",
    subtitle: "FAQ, contato e dúvidas",
    onClick: () => toast.info("Em breve!"),
  });

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Meu Perfil</h1>

        <div className="grid gap-8">
          {/* Profile Card */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground text-3xl font-bold flex items-center justify-center">
                {getInitials(profile.full_name)}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold mb-1">{profile.full_name || "Usuário"}</h2>
                <p className="text-muted-foreground mb-3">{getRoleLabel(profile.role)}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                  {profile.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {profile.email}
                    </span>
                  )}
                  {profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {profile.phone}
                    </span>
                  )}
                </div>
              </div>
              {profile.score != null && (
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                    profile.score >= 700 ? "border-emerald-500 text-emerald-600" :
                    profile.score >= 400 ? "border-amber-500 text-amber-600" :
                    "border-red-500 text-red-600"
                  }`}>
                    {profile.score}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Score</span>
                </div>
              )}
            </div>
          </div>

          {/* CNH Verification Card */}
          <DriverLicenseCard status={licenseStatus} />

          {/* Menu Items */}
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full p-6 flex items-center gap-4 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{item.label}</p>
                  <p className="text-muted-foreground">{item.subtitle}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* Sign Out */}
          <Button
            onClick={handleSignOut}
            variant="destructive"
            size="lg"
            className="w-full h-14 text-lg"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair da conta
          </Button>
        </div>

        {/* Debug Panel */}
        <DriverLicenseDebug />
      </div>
    </WebLayout>
  );
}
