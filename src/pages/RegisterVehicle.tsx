import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Car, Loader2, CheckCircle, XCircle, ArrowLeft, Bike, Truck, Upload, X, Star, Clock, Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createVehicle, uploadVehiclePhoto, VehicleFormData, VehicleType, validatePhoto } from "@/lib/vehicleService";
import carBgPattern from "@/assets/car-bg-pattern.png";

const vehicleTypeOptions = [
  { value: "car", label: "Carro", icon: Car },
  { value: "motorcycle", label: "Moto", icon: Bike },
  { value: "truck", label: "Caminhão", icon: Truck },
  { value: "van", label: "Van", icon: Car },
] as const;

const formSchema = z.object({
  vehicle_type: z.enum(["car", "motorcycle", "truck", "van"]),
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number().min(1990, "Ano inválido").max(new Date().getFullYear() + 1, "Ano inválido"),
  color: z.string().min(1, "Cor é obrigatória"),
  plate: z.string().min(7, "Placa deve ter pelo menos 7 caracteres").max(8, "Placa inválida"),
  renavam: z.string().min(9, "Renavam deve ter pelo menos 9 dígitos").max(11, "Renavam inválido"),
  fuel_type: z.string().min(1, "Combustível é obrigatório"),
  transmission: z.enum(["manual", "automatic"]),
  seats: z.coerce.number().min(1, "Mínimo 1 lugar").max(50, "Máximo 50 lugares"),
  location_city: z.string().min(1, "Cidade é obrigatória"),
  location_state: z.string().min(2, "Estado é obrigatório"),
  daily_price: z.coerce.number().min(1, "Preço diário é obrigatório"),
  weekly_price: z.coerce.number().optional(),
  monthly_price: z.coerce.number().optional(),
  deposit_amount: z.coerce.number().optional(),
  body_type: z.string().optional(),
  segment: z.string().optional(),
  is_popular: z.boolean().default(false),
});

const brandOptions = [
  "Chevrolet", "Fiat", "Ford", "Honda", "Hyundai", "Jeep", "Nissan",
  "Peugeot", "Renault", "Toyota", "Volkswagen", "Outro"
];

const fuelOptions = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico", "Híbrido"];

const segmentOptions = [
  { value: "economy", label: "Econômico" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxo" },
];

const stateOptions = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
];

// Mask functions
const formatPlate = (value: string): string => {
  // Remove tudo que não é letra ou número
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  
  // Formato Mercosul: ABC1D23
  if (cleaned.length <= 3) {
    return cleaned.replace(/[^A-Z]/g, "");
  }
  
  const letters = cleaned.slice(0, 3).replace(/[^A-Z]/g, "");
  const rest = cleaned.slice(3, 7);
  
  if (rest.length === 0) return letters;
  
  // Formato: ABC1D23 (3 letras + 1 número + 1 letra + 2 números)
  let formatted = letters;
  if (rest[0]) formatted += rest[0].replace(/[^0-9]/g, "");
  if (rest[1]) formatted += rest[1].replace(/[^A-Z0-9]/g, "");
  if (rest[2]) formatted += rest[2].replace(/[^0-9]/g, "");
  if (rest[3]) formatted += rest[3].replace(/[^0-9]/g, "");
  
  return formatted;
};

const formatRenavam = (value: string): string => {
  // Apenas números, máximo 11 dígitos
  return value.replace(/\D/g, "").slice(0, 11);
};

export default function RegisterVehicle() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "approved" | "rejected">("idle");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicle_type: undefined,
      title: "",
      brand: "",
      model: "",
      year: new Date().getFullYear(),
      color: "",
      plate: "",
      renavam: "",
      fuel_type: "",
      transmission: "automatic",
      seats: 5,
      location_city: "",
      location_state: "",
      daily_price: 0,
      weekly_price: undefined,
      monthly_price: undefined,
      deposit_amount: undefined,
      body_type: "",
      segment: "",
      is_popular: false,
    },
  });

  const selectedVehicleType = form.watch("vehicle_type");

  // Get appropriate labels based on vehicle type
  const getVehicleLabels = () => {
    switch (selectedVehicleType) {
      case "motorcycle":
        return {
          title: "Cadastrar Minha Moto",
          seatsLabel: "Passageiros",
          seatsMin: 1,
          seatsMax: 2,
          seatsDefault: 2,
          bodyTypeLabel: "Tipo de moto",
          bodyTypeOptions: [
            { value: "scooter", label: "Scooter" },
            { value: "sport", label: "Esportiva" },
            { value: "cruiser", label: "Custom/Cruiser" },
            { value: "trail", label: "Trail" },
            { value: "naked", label: "Naked" },
            { value: "touring", label: "Touring" },
          ],
        };
      case "truck":
        return {
          title: "Cadastrar Meu Caminhão",
          seatsLabel: "Lugares na cabine",
          seatsMin: 2,
          seatsMax: 4,
          seatsDefault: 3,
          bodyTypeLabel: "Tipo de caminhão",
          bodyTypeOptions: [
            { value: "toco", label: "Toco" },
            { value: "truck", label: "Truck" },
            { value: "bitruck", label: "Bitruck" },
            { value: "carreta", label: "Carreta" },
            { value: "vuc", label: "VUC" },
          ],
        };
      case "van":
        return {
          title: "Cadastrar Minha Van",
          seatsLabel: "Lugares",
          seatsMin: 7,
          seatsMax: 20,
          seatsDefault: 15,
          bodyTypeLabel: "Tipo de van",
          bodyTypeOptions: [
            { value: "passageiro", label: "Passageiros" },
            { value: "executiva", label: "Executiva" },
            { value: "furgao", label: "Furgão" },
            { value: "microonibus", label: "Micro-ônibus" },
          ],
        };
      default: // car
        return {
          title: "Cadastrar Meu Carro",
          seatsLabel: "Lugares",
          seatsMin: 2,
          seatsMax: 9,
          seatsDefault: 5,
          bodyTypeLabel: "Tipo de carroceria",
          bodyTypeOptions: [
            { value: "hatch", label: "Hatch" },
            { value: "sedan", label: "Sedan" },
            { value: "suv", label: "SUV" },
            { value: "pickup", label: "Pickup" },
            { value: "minivan", label: "Minivan" },
          ],
        };
    }
  };

  const vehicleLabels = getVehicleLabels();

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesToAdd: { file: File; preview: string }[] = [];
    
    for (const file of Array.from(files)) {
      // Validate each file
      const validation = validatePhoto(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }
      filesToAdd.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setPhotos((prev) => [...prev, ...filesToAdd].slice(0, 10));
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    try {
      const vehicle = await createVehicle(values as VehicleFormData);

      if (!vehicle) {
        toast.error("Erro ao cadastrar veículo");
        setIsSubmitting(false);
        return;
      }

      // Upload photos
      const photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploadingPhotos(true);
        for (let i = 0; i < photos.length; i++) {
          const isCover = i === 0;
          const photo = await uploadVehiclePhoto(vehicle.id, photos[i].file, isCover);
          if (photo) photoUrls.push(photo.image_url);
        }
        setUploadingPhotos(false);
      }

      // Start verification via n8n webhook
      setVerificationState("verifying");
      setVerificationTimer(0);
      
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setVerificationTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const webhookPayload = {
          vehicle_id: vehicle.id,
          vehicle_type: values.vehicle_type,
          title: values.title,
          brand: values.brand,
          model: values.model,
          year: values.year,
          color: values.color,
          plate: values.plate,
          renavam: values.renavam,
          fuel_type: values.fuel_type,
          transmission: values.transmission,
          seats: values.seats,
          location_city: values.location_city,
          location_state: values.location_state,
          daily_price: values.daily_price,
          weekly_price: values.weekly_price,
          monthly_price: values.monthly_price,
          deposit_amount: values.deposit_amount,
          body_type: values.body_type,
          segment: values.segment,
          is_popular: values.is_popular,
          photos: photoUrls,
        };

        const webhookResponse = await fetch(
          "https://n8n.srv1153225.hstgr.cloud/webhook/validarcarro",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);
        if (timerRef.current) clearInterval(timerRef.current);

        if (webhookResponse.ok) {
          const rawText = await webhookResponse.text();
          let result: any;
          try {
            const parsed = JSON.parse(rawText);
            result = Array.isArray(parsed) ? parsed[0] : parsed;
          } catch {
            result = { aprovado: false };
          }

          const isApproved = result.aprovado === true || result.carro_aprovado === true || result.status === "approved";
          const newStatus = isApproved ? "available" : "inactive";

          // Update vehicle status
          await supabase
            .from("oli_vehicles")
            .update({ 
              status: newStatus as any,
              is_active: isApproved,
              updated_at: new Date().toISOString(),
            })
            .eq("id", vehicle.id);

          setVerificationState(isApproved ? "approved" : "rejected");
          setVerificationMessage(result.mensagem || result.message || (isApproved ? "Veículo aprovado com sucesso!" : "Veículo não aprovado. Verifique os documentos."));

          // Send notification email
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              await supabase.functions.invoke("send-notification-email", {
                body: {
                  type: isApproved ? "vehicle_approved" : "vehicle_rejected",
                  recipient_id: userData.user.id,
                  data: {
                    vehicle_title: values.title,
                    status_label: isApproved ? "Aprovado" : "Reprovado",
                  },
                },
              });
            }
          } catch (emailErr) {
            console.error("Erro ao enviar email:", emailErr);
          }
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
          setVerificationState("rejected");
          setVerificationMessage("Erro na verificação do veículo.");
        }
      } catch (fetchErr: any) {
        if (timerRef.current) clearInterval(timerRef.current);
        setVerificationState(fetchErr.name === "AbortError" ? "rejected" : "rejected");
        setVerificationMessage(
          fetchErr.name === "AbortError"
            ? "Tempo de verificação esgotado. Tente novamente."
            : "Erro na comunicação com o serviço de verificação."
        );
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao cadastrar veículo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary/5 relative">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url(${carBgPattern})`,
          backgroundSize: "600px auto",
          backgroundPosition: "center",
          backgroundRepeat: "repeat",
        }}
      />

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
              {selectedVehicleType === "motorcycle" ? <Bike className="w-7 h-7" /> : 
               selectedVehicleType === "truck" ? <Truck className="w-7 h-7" /> : 
               <Car className="w-7 h-7" />}
              <h1 className="text-xl font-bold">{vehicleLabels.title}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Verification overlay */}
      {verificationState !== "idle" && (
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-24">
          <Card className="shadow-md border-0">
            <CardContent className="pt-8 pb-8">
              {verificationState === "verifying" && (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold">Verificando veículo...</h2>
                  <p className="text-muted-foreground">Estamos validando os documentos do seu veículo. Aguarde.</p>
                  <div className="w-full max-w-xs">
                    <Progress value={Math.min((verificationTimer / 60) * 100, 95)} className="h-3" />
                  </div>
                  <div className="text-3xl font-mono font-bold text-primary">
                    {Math.floor(verificationTimer / 60).toString().padStart(2, "0")}:{(verificationTimer % 60).toString().padStart(2, "0")}
                  </div>
                  <p className="text-sm text-muted-foreground">Isso pode levar até 1 minuto</p>
                </div>
              )}

              {verificationState === "approved" && (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-green-700">Veículo Aprovado!</h2>
                  <p className="text-muted-foreground">{verificationMessage}</p>
                  <p className="text-sm text-muted-foreground">Seu veículo já está disponível para aluguel.</p>
                  <Button onClick={() => navigate("/my-vehicles")} className="mt-4">
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Ver Meus Veículos
                  </Button>
                </div>
              )}

              {verificationState === "rejected" && (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-red-700">Veículo Não Aprovado</h2>
                  <p className="text-muted-foreground">{verificationMessage}</p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate("/my-vehicles")}>
                      Meus Veículos
                    </Button>
                    <Button onClick={() => setVerificationState("idle")}>
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      {verificationState === "idle" && (
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-24">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Vehicle Type Selection */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">0</span>
                  </div>
                  Tipo de Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="vehicle_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecione o tipo de veículo *</FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                        {vehicleTypeOptions.map((type) => {
                          const Icon = type.icon;
                          const isSelected = field.value === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => field.onChange(type.value)}
                              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                                isSelected 
                                  ? "border-primary bg-primary/10 text-primary" 
                                  : "border-muted hover:border-primary/50 hover:bg-primary/5"
                              }`}
                            >
                              <Icon className={`w-8 h-8 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`font-medium text-sm ${isSelected ? "text-primary" : ""}`}>
                                {type.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Only show the rest of the form if vehicle type is selected */}
            {selectedVehicleType && (
              <>
            {/* Basic Info */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do anúncio *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Chevrolet Onix LT 2022" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {brandOptions.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
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
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Onix LT" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Prata" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ABC1D23" 
                            value={field.value}
                            onChange={(e) => {
                              const formatted = formatPlate(e.target.value);
                              field.onChange(formatted);
                            }}
                            className="uppercase tracking-wider font-mono"
                            maxLength={7}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Formato Mercosul: ABC1D23</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="renavam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renavam *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00000000000" 
                            value={field.value}
                            onChange={(e) => {
                              const formatted = formatRenavam(e.target.value);
                              field.onChange(formatted);
                            }}
                            className="font-mono tracking-wide"
                            maxLength={11}
                            inputMode="numeric"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">11 dígitos numéricos</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Technical Info */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  Especificações
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Combustível *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fuelOptions.map((fuel) => (
                              <SelectItem key={fuel} value={fuel}>
                                {fuel}
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
                    name="transmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Câmbio *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="automatic">Automático</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="seats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{vehicleLabels.seatsLabel} *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={vehicleLabels.seatsMin} 
                            max={vehicleLabels.seatsMax} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="body_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{vehicleLabels.bodyTypeLabel}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vehicleLabels.bodyTypeOptions.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="segment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segmento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {segmentOptions.map((seg) => (
                            <SelectItem key={seg.value} value={seg.value}>
                              {seg.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="location_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stateOptions.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
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
                    name="location_city"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Cidade *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">4</span>
                  </div>
                  Preços
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="daily_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diária (R$) *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="150" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="weekly_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semanal (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthly_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensal (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="deposit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caução (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_popular"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border bg-card p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Destacar como popular</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Seu veículo aparecerá em destaque nas buscas
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Photos */}
            <Card className="shadow-md border-0">
              <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">5</span>
                  </div>
                  Fotos do Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Adicione até 10 fotos. A primeira será a foto de capa.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={photo.preview}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {index === 0 && (
                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                          Capa
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {photos.length < 10 && (
                    <label className="aspect-square border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                      <Upload className="w-6 h-6 text-primary/60" />
                      <span className="text-xs text-primary/60 mt-1">Adicionar</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-14 text-lg shadow-lg"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {uploadingPhotos ? "Enviando fotos..." : "Cadastrando..."}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Cadastrar Veículo
                </>
              )}
            </Button>
              </>
            )}
          </form>
        </Form>
      </div>
      )}
    </div>
  );
}
