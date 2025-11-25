import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getProfile, signOut, OliProfile } from "@/lib/supabase";
import { User, Car, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const [profile, setProfile] = useState<OliProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

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
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </MobileLayout>
    );
  }

  if (!profile) {
    return (
      <MobileLayout>
        <div className="p-4">
          <p className="text-muted-foreground">Perfil não encontrado</p>
        </div>
      </MobileLayout>
    );
  }

  const menuItems = [
    {
      icon: User,
      label: "Meus dados pessoais",
      onClick: () => navigate("/profile/edit"),
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
      onClick: () => navigate("/my-vehicles"),
    });
  }

  menuItems.push({
    icon: HelpCircle,
    label: "Ajuda e suporte",
    onClick: () => toast.info("Em breve!"),
  });

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        <h1 className="text-2xl font-bold">Perfil</h1>

        {/* Profile Card */}
        <div className="card-elevated p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4">
            {getInitials(profile.full_name)}
          </div>
          <h2 className="text-xl font-semibold mb-1">{profile.full_name || "Usuário"}</h2>
          <p className="text-sm text-muted-foreground">{getRoleLabel(profile.role)}</p>
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full card-elevated p-4 flex items-center gap-3 hover:shadow-[var(--shadow-elevated)] transition-shadow"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <div className="flex-1 text-left">
                <p className="font-medium">{item.label}</p>
                {item.subtitle && (
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full btn-pill"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sair
        </Button>
      </div>
    </MobileLayout>
  );
}
