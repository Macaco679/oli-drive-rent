import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Bike, Car, CheckCircle, Clock, Loader2, Search as SearchIcon, Truck, Upload, X, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createVehicle, uploadVehiclePhoto, VehicleFormData, validatePhoto } from "@/lib/vehicleService";
import { formatPostalCode, lookupAddressByPostalCode, sanitizePostalCode } from "@/lib/addressService";
import carBgPattern from "@/assets/car-bg-pattern.png";

const vehicleTypeOptions = [
  { value: "car", label: "Carro", icon: Car },
  { value: "motorcycle", label: "Moto", icon: Bike },
  { value: "truck", label: "Caminhao", icon: Truck },
  { value: "van", label: "Van", icon: Car },
] as const;

const brandOptions = ["Chevrolet", "Fiat", "Ford", "Honda", "Hyundai", "Jeep", "Nissan", "Peugeot", "Renault", "Toyota", "Volkswagen", "Outro"];
const fuelOptions = ["Flex", "Gasolina", "Etanol", "Diesel", "Eletrico", "Hibrido"];
const segmentOptions = [
  { value: "economy", label: "Economico" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxo" },
];
const stateOptions = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const formSchema = z.object({
  vehicle_type: z.enum(["car", "motorcycle", "truck", "van"]),
  title: z.string().min(3),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().min(1990).max(new Date().getFullYear() + 1),
  color: z.string().min(1),
  plate: z.string().min(7).max(8),
  renavam: z.string().min(9).max(11),
  owner_cpf: z.string().min(11).max(14),
  fuel_type: z.string().min(1),
  transmission: z.enum(["manual", "automatic"]),
  seats: z.coerce.number().min(1).max(50),
  location_city: z.string().min(1),
  location_state: z.string().min(2),
  pickup_neighborhood: z.string().min(1),
  pickup_street: z.string().min(1),
  pickup_number: z.string().min(1),
  pickup_complement: z.string().optional(),
  pickup_zip_code: z.string().min(8).max(9),
  daily_price: z.coerce.number().min(1),
  weekly_price: z.coerce.number().optional(),
  monthly_price: z.coerce.number().optional(),
  deposit_amount: z.coerce.number().optional(),
  has_driver_option: z.boolean().default(false),
  driver_daily_price: z.coerce.number().positive().optional(),
  driver_notes: z.string().optional(),
  mileage_limit_per_day: z.coerce.number().int().positive().optional(),
  body_type: z.string().optional(),
  segment: z.string().optional(),
  is_popular: z.boolean().default(false),
}).superRefine((values, ctx) => {
  if (values.has_driver_option && (!values.driver_daily_price || values.driver_daily_price <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["driver_daily_price"], message: "Informe a diaria com motorista." });
  }
});

const formatPlate = (value: string) => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 3) return cleaned.replace(/[^A-Z]/g, "");
  const letters = cleaned.slice(0, 3).replace(/[^A-Z]/g, "");
  const rest = cleaned.slice(3, 7);
  return `${letters}${(rest[0] || "").replace(/[^0-9]/g, "")}${(rest[1] || "").replace(/[^A-Z0-9]/g, "")}${(rest[2] || "").replace(/[^0-9]/g, "")}${(rest[3] || "").replace(/[^0-9]/g, "")}`;
};
const formatRenavam = (value: string) => value.replace(/\D/g, "").slice(0, 11);
const formatCPF = (value: string) => {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
};

export default function RegisterVehicle() {
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "approved" | "rejected">("idle");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [searchingPickupPostalCode, setSearchingPickupPostalCode] = useState(false);

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
      owner_cpf: "",
      fuel_type: "",
      transmission: "automatic",
      seats: 5,
      location_city: "",
      location_state: "",
      pickup_neighborhood: "",
      pickup_street: "",
      pickup_number: "",
      pickup_complement: "",
      pickup_zip_code: "",
      daily_price: 0,
      weekly_price: undefined,
      monthly_price: undefined,
      deposit_amount: undefined,
      has_driver_option: false,
      driver_daily_price: undefined,
      driver_notes: "",
      mileage_limit_per_day: undefined,
      body_type: "",
      segment: "",
      is_popular: false,
    },
  });

  const selectedVehicleType = form.watch("vehicle_type");
  const hasDriverOption = form.watch("has_driver_option");

  const vehicleLabels = selectedVehicleType === "motorcycle"
    ? { title: "Cadastrar Minha Moto", seatsLabel: "Passageiros", seatsDefault: 2, bodyTypeLabel: "Tipo de moto", bodyTypeOptions: [{ value: "scooter", label: "Scooter" }, { value: "sport", label: "Esportiva" }, { value: "cruiser", label: "Cruiser" }, { value: "trail", label: "Trail" }, { value: "naked", label: "Naked" }, { value: "touring", label: "Touring" }] }
    : selectedVehicleType === "truck"
      ? { title: "Cadastrar Meu Caminhao", seatsLabel: "Lugares na cabine", seatsDefault: 3, bodyTypeLabel: "Tipo de caminhao", bodyTypeOptions: [{ value: "toco", label: "Toco" }, { value: "truck", label: "Truck" }, { value: "bitruck", label: "Bitruck" }, { value: "carreta", label: "Carreta" }, { value: "vuc", label: "VUC" }] }
      : selectedVehicleType === "van"
        ? { title: "Cadastrar Minha Van", seatsLabel: "Lugares", seatsDefault: 15, bodyTypeLabel: "Tipo de van", bodyTypeOptions: [{ value: "passageiro", label: "Passageiros" }, { value: "executiva", label: "Executiva" }, { value: "furgao", label: "Furgao" }, { value: "microonibus", label: "Micro-onibus" }] }
        : { title: "Cadastrar Meu Carro", seatsLabel: "Lugares", seatsDefault: 5, bodyTypeLabel: "Tipo de carroceria", bodyTypeOptions: [{ value: "hatch", label: "Hatch" }, { value: "sedan", label: "Sedan" }, { value: "suv", label: "SUV" }, { value: "pickup", label: "Pickup" }, { value: "minivan", label: "Minivan" }] };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, [photos]);

  useEffect(() => {
    if (selectedVehicleType) {
      form.setValue("seats", vehicleLabels.seatsDefault, { shouldDirty: true });
    }
  }, [selectedVehicleType]);

  const handlePickupPostalCodeLookup = async (value: string) => {
    const postalCode = sanitizePostalCode(value);
    if (postalCode.length !== 8) return;
    try {
      setSearchingPickupPostalCode(true);
      const address = await lookupAddressByPostalCode(postalCode);
      form.setValue("pickup_street", address.street, { shouldDirty: true });
      form.setValue("pickup_neighborhood", address.neighborhood, { shouldDirty: true });
      form.setValue("location_city", address.city, { shouldDirty: true });
      form.setValue("location_state", address.state, { shouldDirty: true });
      if (!form.getValues("pickup_complement")) form.setValue("pickup_complement", address.complement, { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel consultar o CEP.");
    } finally {
      setSearchingPickupPostalCode(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: Array<{ file: File; preview: string }> = [];
    for (const file of Array.from(files)) {
      const validation = validatePhoto(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }
      newPhotos.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos((current) => [...current, ...newPhotos].slice(0, 10));
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => {
      const updated = [...current];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const vehicle = await createVehicle(values as VehicleFormData);
      if (!vehicle) {
        toast.error("Erro ao cadastrar veiculo");
        return;
      }

      const photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploadingPhotos(true);
        for (let index = 0; index < photos.length; index += 1) {
          const uploaded = await uploadVehiclePhoto(vehicle.id, photos[index].file, index === 0);
          if (uploaded) photoUrls.push(uploaded.image_url);
        }
        setUploadingPhotos(false);
      }

      setVerificationState("verifying");
      setVerificationTimer(0);
      const startTime = Date.now();
      timerRef.current = setInterval(() => setVerificationTimer(Math.floor((Date.now() - startTime) / 1000)), 1000);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        const formData = new FormData();
        formData.append("_webhook_target", "validarcarro");

        const webhookPayload: Record<string, unknown> = {
          vehicle_id: vehicle.id,
          vehicle_type: values.vehicle_type,
          title: values.title,
          brand: values.brand,
          model: values.model,
          year: values.year,
          color: values.color,
          plate: values.plate,
          renavam: values.renavam,
          owner_cpf: values.owner_cpf,
          fuel_type: values.fuel_type,
          transmission: values.transmission,
          seats: values.seats,
          location_city: values.location_city,
          location_state: values.location_state,
          pickup_neighborhood: values.pickup_neighborhood,
          pickup_street: values.pickup_street,
          pickup_number: values.pickup_number,
          pickup_complement: values.pickup_complement,
          pickup_zip_code: values.pickup_zip_code,
          daily_price: values.daily_price,
          weekly_price: values.weekly_price,
          monthly_price: values.monthly_price,
          deposit_amount: values.deposit_amount,
          has_driver_option: values.has_driver_option,
          driver_daily_price: values.driver_daily_price,
          driver_notes: values.driver_notes,
          mileage_limit_per_day: values.mileage_limit_per_day,
          body_type: values.body_type,
          segment: values.segment,
          is_popular: values.is_popular,
          photos: photoUrls,
        };

        formData.append("payload", JSON.stringify(webhookPayload));
        for (const [key, value] of Object.entries(webhookPayload)) {
          if (key === "photos") continue;
          formData.append(key, typeof value === "string" ? value : JSON.stringify(value));
        }
        photos.forEach((photo, index) => {
          const ext = photo.file.name.split(".").pop()?.toLowerCase() || "jpg";
          formData.append(`photo_${index}`, photo.file, `photo_${index}.${ext}`);
        });

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-proxy`, {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (timerRef.current) clearInterval(timerRef.current);

        const rawText = await response.text();
        let result: any = null;
        if (response.ok) {
          try { result = JSON.parse(rawText); } catch { result = rawText; }
          result = Array.isArray(result) ? result[0] : result;
          if (typeof result === "string") {
            try { result = JSON.parse(result); } catch { result = { approved: false }; }
          }
          if (result?.output && typeof result.output === "string") {
            try { result = { ...result, ...JSON.parse(result.output) }; } catch { /* ignore */ }
          }
        }

        const isApproved = result?.approved === true || result?.aprovado === true || result?.carro_aprovado === true || result?.status === "approved";
        await supabase.from("oli_vehicles").update({ status: (isApproved ? "available" : "inactive") as any, is_active: !!isApproved, updated_at: new Date().toISOString() }).eq("id", vehicle.id);
        setVerificationState(isApproved ? "approved" : "rejected");
        setVerificationMessage(result?.mensagem || result?.message || (isApproved ? "Veiculo aprovado com sucesso!" : "Veiculo nao aprovado. Verifique os documentos."));
      } catch (fetchError) {
        if (timerRef.current) clearInterval(timerRef.current);
        console.error("Erro no webhook do veiculo:", fetchError);
        setVerificationState("rejected");
        setVerificationMessage("Erro na comunicacao com o servico de verificacao.");
      }
    } catch (error) {
      console.error("Erro ao cadastrar veiculo:", error);
      toast.error("Erro ao cadastrar veiculo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary/5 relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url(${carBgPattern})`, backgroundSize: "600px auto", backgroundPosition: "center", backgroundRepeat: "repeat" }} />

      <div className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {selectedVehicleType === "motorcycle" ? <Bike className="w-7 h-7" /> : selectedVehicleType === "truck" ? <Truck className="w-7 h-7" /> : <Car className="w-7 h-7" />}
              <h1 className="text-xl font-bold">{vehicleLabels.title}</h1>
            </div>
          </div>
        </div>
      </div>

      {verificationState !== "idle" ? (
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-24">
          <Card className="shadow-md border-0">
            <CardContent className="pt-8 pb-8">
              {verificationState === "verifying" ? (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"><Clock className="w-10 h-10 text-primary animate-pulse" /></div>
                  <h2 className="text-xl font-bold">Verificando veiculo...</h2>
                  <p className="text-muted-foreground">Estamos validando os documentos do seu veiculo. Aguarde.</p>
                  <div className="w-full max-w-xs"><Progress value={Math.min((verificationTimer / 90) * 100, 95)} className="h-3" /></div>
                  <div className="text-3xl font-mono font-bold text-primary">{Math.floor(verificationTimer / 60).toString().padStart(2, "0")}:{(verificationTimer % 60).toString().padStart(2, "0")}</div>
                </div>
              ) : null}
              {verificationState === "approved" ? (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-green-600" /></div>
                  <h2 className="text-xl font-bold text-green-700">Veiculo aprovado!</h2>
                  <p className="text-muted-foreground">{verificationMessage}</p>
                  <Button onClick={() => navigate("/my-vehicles")} className="mt-4"><SearchIcon className="w-4 h-4 mr-2" />Ver meus veiculos</Button>
                </div>
              ) : null}
              {verificationState === "rejected" ? (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="w-10 h-10 text-red-600" /></div>
                  <h2 className="text-xl font-bold text-red-700">Veiculo nao aprovado</h2>
                  <p className="text-muted-foreground">{verificationMessage}</p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate("/my-vehicles")}>Meus veiculos</Button>
                    <Button onClick={() => setVerificationState("idle")}>Tentar novamente</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-24">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card className="shadow-md border-0">
                <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Tipo de veiculo</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  <FormField control={form.control} name="vehicle_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecione o tipo de veiculo *</FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                        {vehicleTypeOptions.map((type) => {
                          const Icon = type.icon;
                          const isSelected = field.value === type.value;
                          return (
                            <button key={type.value} type="button" onClick={() => field.onChange(type.value)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${isSelected ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50 hover:bg-primary/5"}`}>
                              <Icon className={`w-8 h-8 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`font-medium text-sm ${isSelected ? "text-primary" : ""}`}>{type.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {selectedVehicleType ? (
                <>
                  <Card className="shadow-md border-0">
                    <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Informacoes basicas</CardTitle></CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Titulo do anuncio *</FormLabel><FormControl><Input {...field} placeholder="Ex: Chevrolet Onix LT 2022" /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="brand" render={({ field }) => (<FormItem><FormLabel>Marca *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{brandOptions.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Modelo *</FormLabel><FormControl><Input {...field} placeholder="Ex: Onix LT" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Ano *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="color" render={({ field }) => (<FormItem><FormLabel>Cor *</FormLabel><FormControl><Input {...field} placeholder="Ex: Prata" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="plate" render={({ field }) => (<FormItem><FormLabel>Placa *</FormLabel><FormControl><Input value={field.value} onChange={(e) => field.onChange(formatPlate(e.target.value))} placeholder="ABC1D23" maxLength={7} className="uppercase font-mono" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="renavam" render={({ field }) => (<FormItem><FormLabel>Renavam *</FormLabel><FormControl><Input value={field.value} onChange={(e) => field.onChange(formatRenavam(e.target.value))} placeholder="00000000000" maxLength={11} inputMode="numeric" className="font-mono" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="owner_cpf" render={({ field }) => (<FormItem><FormLabel>CPF do proprietario *</FormLabel><FormControl><Input value={field.value} onChange={(e) => field.onChange(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} inputMode="numeric" className="font-mono" /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-0">
                    <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Especificacoes</CardTitle></CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="fuel_type" render={({ field }) => (<FormItem><FormLabel>Combustivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{fuelOptions.map((fuel) => <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="transmission" render={({ field }) => (<FormItem><FormLabel>Cambio *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="automatic">Automatico</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="seats" render={({ field }) => (<FormItem><FormLabel>{vehicleLabels.seatsLabel} *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="body_type" render={({ field }) => (<FormItem><FormLabel>{vehicleLabels.bodyTypeLabel}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{vehicleLabels.bodyTypeOptions.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="segment" render={({ field }) => (<FormItem><FormLabel>Segmento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{segmentOptions.map((segment) => <SelectItem key={segment.value} value={segment.value}>{segment.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-0">
                    <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Localizacao</CardTitle></CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="location_state" render={({ field }) => (<FormItem><FormLabel>Estado *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl><SelectContent>{stateOptions.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="location_city" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Cidade *</FormLabel><FormControl><Input {...field} placeholder="Ex: Sao Paulo" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="pickup_zip_code" render={({ field }) => (<FormItem><FormLabel>CEP *</FormLabel><FormControl><div className="relative"><Input value={formatPostalCode(field.value || "")} onChange={(e) => field.onChange(formatPostalCode(e.target.value))} onBlur={() => handlePickupPostalCodeLookup(field.value || "")} placeholder="00000-000" maxLength={9} inputMode="numeric" className="pr-10" />{searchingPickupPostalCode ? <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}</div></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="pickup_street" render={({ field }) => (<FormItem><FormLabel>Rua / endereco *</FormLabel><FormControl><Input {...field} placeholder="Ex: Rua das Flores" /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="pickup_number" render={({ field }) => (<FormItem><FormLabel>Numero *</FormLabel><FormControl><Input {...field} placeholder="123" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pickup_complement" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Complemento</FormLabel><FormControl><Input {...field} placeholder="Apto, bloco, referencia..." /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="pickup_neighborhood" render={({ field }) => (<FormItem><FormLabel>Bairro *</FormLabel><FormControl><Input {...field} placeholder="Ex: Centro" /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-0">
                    <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Precos</CardTitle></CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <FormField control={form.control} name="daily_price" render={({ field }) => (<FormItem><FormLabel>Diaria (R$) *</FormLabel><FormControl><Input type="number" {...field} placeholder="150" /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="weekly_price" render={({ field }) => (<FormItem><FormLabel>Semanal (R$)</FormLabel><FormControl><Input type="number" {...field} placeholder="900" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="monthly_price" render={({ field }) => (<FormItem><FormLabel>Mensal (R$)</FormLabel><FormControl><Input type="number" {...field} placeholder="3000" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="deposit_amount" render={({ field }) => (<FormItem><FormLabel>Caucao (R$)</FormLabel><FormControl><Input type="number" {...field} placeholder="500" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="mileage_limit_per_day" render={({ field }) => (<FormItem><FormLabel>Limite de quilometragem por dia</FormLabel><FormControl><Input type="number" {...field} placeholder="200" /></FormControl><p className="text-sm text-muted-foreground">Esse limite aparecera no anuncio e durante a vistoria da reserva.</p><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="has_driver_option" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border bg-card p-4"><div className="space-y-0.5 pr-4"><FormLabel className="text-base">Motorista disponibilizado pelo locador</FormLabel><p className="text-sm text-muted-foreground">Ofereca o anuncio com e sem motorista, deixando o adicional bem claro.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                      {hasDriverOption ? (<><FormField control={form.control} name="driver_daily_price" render={({ field }) => (<FormItem><FormLabel>Valor adicional da diaria com motorista (R$)</FormLabel><FormControl><Input type="number" {...field} placeholder="120" /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="driver_notes" render={({ field }) => (<FormItem><FormLabel>Detalhes do servico com motorista</FormLabel><FormControl><Input {...field} placeholder="Ex: transfer, eventos ou uso executivo" /></FormControl><FormMessage /></FormItem>)} /></>) : null}
                      <FormField control={form.control} name="is_popular" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border bg-card p-4"><div className="space-y-0.5"><FormLabel className="text-base">Destacar como popular</FormLabel><p className="text-sm text-muted-foreground">Seu veiculo aparecera em destaque nas buscas.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-0">
                    <CardHeader className="bg-primary/5 rounded-t-lg"><CardTitle>Fotos do veiculo</CardTitle></CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <p className="text-sm text-muted-foreground">Adicione ate 10 fotos. A primeira sera a foto de capa.</p>
                      <div className="grid grid-cols-3 gap-3">
                        {photos.map((photo, index) => (<div key={index} className="relative aspect-square"><img src={photo.preview} alt={`Foto ${index + 1}`} className="w-full h-full object-cover rounded-lg" />{index === 0 ? <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">Capa</span> : null}<button type="button" onClick={() => removePhoto(index)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full"><X className="w-4 h-4" /></button></div>))}
                        {photos.length < 10 ? (<label className="aspect-square border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"><Upload className="w-6 h-6 text-primary/60" /><span className="text-xs text-primary/60 mt-1">Adicionar</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect} className="hidden" /></label>) : null}
                      </div>
                    </CardContent>
                  </Card>

                  <Button type="submit" className="w-full h-14 text-lg shadow-lg" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />{uploadingPhotos ? "Enviando fotos..." : "Cadastrando..."}</>) : (<><CheckCircle className="w-5 h-5 mr-2" />Cadastrar veiculo</>)}
                  </Button>
                </>
              ) : null}
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
