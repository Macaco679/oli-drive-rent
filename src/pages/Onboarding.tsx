import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, createProfile, getProfile } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { formatPostalCode, isPostalCodeComplete, lookupAddressByPostalCode, sanitizePostalCode } from "@/lib/addressService";
import { toast } from "sonner";
import { Car, Loader2, MapPin, UserCheck, Users } from "lucide-react";

type UserRole = "renter" | "owner" | "both";

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [searchingPostalCode, setSearchingPostalCode] = useState(false);
  const lastPostalCodeLookupRef = useRef("");
  const navigate = useNavigate();

  useEffect(() => {
    checkProfile();
  }, []);

  useEffect(() => {
    const sanitizedPostalCode = sanitizePostalCode(postalCode);
    if (sanitizedPostalCode.length !== 8 || sanitizedPostalCode === lastPostalCodeLookupRef.current) {
      return;
    }

    let active = true;

    const runLookup = async () => {
      try {
        setSearchingPostalCode(true);
        const address = await lookupAddressByPostalCode(sanitizedPostalCode);
        if (!active) return;

        setStreet(address.street || "");
        setNeighborhood(address.neighborhood || "");
        setCity(address.city || "");
        setState(address.state || "");
        setComplement((currentValue) => currentValue || address.complement || "");
        lastPostalCodeLookupRef.current = sanitizedPostalCode;
      } catch (error) {
        if (!active) return;
        lastPostalCodeLookupRef.current = "";
        toast.error(error instanceof Error ? error.message : "Nao foi possivel buscar o CEP.");
      } finally {
        if (active) {
          setSearchingPostalCode(false);
        }
      }
    };

    void runLookup();

    return () => {
      active = false;
    };
  }, [postalCode]);

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

  const hasAnyAddressValue = () => {
    return [street, number, complement, neighborhood, city, state, postalCode].some((value) => value.trim().length > 0);
  };

  const saveUserAddress = async (userId: string) => {
    const sanitizedPostalCode = sanitizePostalCode(postalCode);

    if (!hasAnyAddressValue()) {
      return;
    }

    if (!isPostalCodeComplete(postalCode)) {
      throw new Error("Preencha um CEP valido para salvar o endereco.");
    }

    const addressPayload = {
      user_id: userId,
      street: street.trim() || null,
      number: number.trim() || null,
      complement: complement.trim() || null,
      neighborhood: neighborhood.trim() || null,
      city: city.trim() || null,
      state: state.trim().toUpperCase() || null,
      postal_code: sanitizedPostalCode || null,
      is_default: true,
      label: "Principal",
    };

    const { data: existingAddress } = await supabase
      .from("oli_user_addresses")
      .select("id")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAddress?.id) {
      const { error } = await supabase
        .from("oli_user_addresses")
        .update(addressPayload)
        .eq("id", existingAddress.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("oli_user_addresses").insert(addressPayload);
      if (error) throw error;
    }
  };

  const handleComplete = async () => {
    if (!selectedRole) {
      toast.error("Por favor, selecione um tipo de conta");
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      toast.error("Por favor, preencha nome e telefone");
      return;
    }

    setLoading(true);

    try {
      const { user } = await getCurrentUser();
      if (!user) {
        toast.error("Usuario nao encontrado");
        navigate("/auth");
        return;
      }

      const profile = await createProfile({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        whatsapp_phone: phone.trim(),
        role: selectedRole,
        street: street.trim() || null,
        neigbhorhood: neighborhood.trim() || null,
        number: number.trim() ? Number(number.trim()) : null,
        complemention: complement.trim() || null,
      });

      if (!profile) {
        toast.error("Erro ao criar perfil");
        return;
      }

      await saveUserAddress(user.id);

      toast.success("Perfil criado com sucesso!");
      navigate("/home");
    } catch (error) {
      console.error("Error creating profile:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar perfil");
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    {
      value: "renter" as UserRole,
      icon: UserCheck,
      title: "Quero alugar carros",
      description: "Sou motorista e preciso de um veiculo",
    },
    {
      value: "owner" as UserRole,
      icon: Car,
      title: "Quero anunciar meus carros",
      description: "Tenho veiculos e quero aluga-los",
    },
    {
      value: "both" as UserRole,
      icon: Users,
      title: "Quero as duas opcoes",
      description: "Alugar e anunciar veiculos",
    },
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-accent items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <h1 className="text-6xl font-bold mb-6">OLI</h1>
          <p className="text-2xl mb-4">Bem-vindo!</p>
          <p className="text-white/80 text-lg">
            Vamos configurar seu perfil para voce comecar a usar a plataforma de aluguel de carros.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-2xl space-y-8">
          <div className="lg:hidden text-center">
            <h1 className="text-4xl font-bold text-primary mb-2">OLI</h1>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Configurar perfil</h2>
            <p className="text-muted-foreground">Complete suas informacoes para comecar</p>
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
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Endereco principal</p>
                  <p className="text-sm text-muted-foreground">
                    Ao informar o CEP, rua, bairro, cidade e UF sao preenchidos automaticamente.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="postalCode">CEP</Label>
                <div className="relative mt-1">
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => {
                      setPostalCode(formatPostalCode(e.target.value));
                      if (sanitizePostalCode(e.target.value).length < 8) {
                        lastPostalCodeLookupRef.current = "";
                      }
                    }}
                    placeholder="00000-000"
                    className="h-12 pr-10"
                    inputMode="numeric"
                  />
                  {searchingPostalCode && <Loader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              </div>

              <div>
                <Label htmlFor="street">Rua / Logradouro</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Ex: Rua das Flores" className="mt-1 h-12" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className="mt-1 h-12" />
                </div>
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, bloco..." className="mt-1 h-12" />
                </div>
              </div>

              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex: Centro" className="mt-1 h-12" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo" className="mt-1 h-12" />
                </div>
                <div>
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    className="mt-1 h-12"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleComplete} disabled={loading || !selectedRole} className="w-full h-12 text-lg">
              {loading ? "Salvando..." : "Comecar a usar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
