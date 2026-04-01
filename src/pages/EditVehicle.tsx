import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Car, Loader2, Save, ArrowLeft } from "lucide-react";
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
import {
  getVehicleById,
  updateVehicle,
  getVehiclePhotos,
  VehicleFormData,
  VehiclePhoto,
} from "@/lib/vehicleService";
import { formatPostalCode, lookupAddressByPostalCode, sanitizePostalCode } from "@/lib/addressService";
import { VehiclePhotoGallery } from "@/components/vehicles/VehiclePhotoGallery";

const formSchema = z.object({
  title: z.string().min(3, "Titulo deve ter pelo menos 3 caracteres"),
  brand: z.string().min(1, "Marca e obrigatoria"),
  model: z.string().min(1, "Modelo e obrigatorio"),
  year: z.coerce.number().min(1990).max(new Date().getFullYear() + 1),
  color: z.string().min(1, "Cor e obrigatoria"),
  plate: z.string().optional(),
  renavam: z.string().optional(),
  fuel_type: z.string().min(1, "Combustivel e obrigatorio"),
  transmission: z.enum(["manual", "automatic"]),
  seats: z.coerce.number().min(2).max(9),
  location_city: z.string().min(1, "Cidade e obrigatoria"),
  location_state: z.string().min(2, "Estado e obrigatorio"),
  pickup_neighborhood: z.string().min(1, "Bairro e obrigatorio"),
  pickup_street: z.string().min(1, "Rua e obrigatoria"),
  pickup_number: z.string().min(1, "Numero e obrigatorio"),
  pickup_complement: z.string().optional(),
  pickup_zip_code: z.string().min(8, "CEP deve ter 8 digitos").max(9, "CEP invalido"),
  daily_price: z.coerce.number().min(1, "Preco diario e obrigatorio"),
  weekly_price: z.coerce.number().optional(),
  monthly_price: z.coerce.number().optional(),
  deposit_amount: z.coerce.number().optional(),
  has_driver_option: z.boolean().default(false),
  driver_daily_price: z.coerce.number().positive("Informe o valor da diaria com motorista").optional(),
  driver_notes: z.string().optional(),
  mileage_limit_per_day: z.coerce.number().int("Informe um valor inteiro").positive("Informe um limite maior que zero").optional(),
  body_type: z.string().optional(),
  segment: z.string().optional(),
  is_popular: z.boolean().default(false),
}).superRefine((values, ctx) => {
  if (values.has_driver_option && (!values.driver_daily_price || values.driver_daily_price <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["driver_daily_price"],
      message: "Informe o valor da diaria quando o motorista estiver disponivel.",
    });
  }
});

const brandOptions = [
  "Chevrolet", "Fiat", "Ford", "Honda", "Hyundai", "Jeep", "Nissan",
  "Peugeot", "Renault", "Toyota", "Volkswagen", "Outro",
];

const fuelOptions = ["Flex", "Gasolina", "Etanol", "Diesel", "ElÃ©trico", "HÃ­brido"];

const bodyTypeOptions = [
  { value: "hatch", label: "Hatch" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Pickup" },
  { value: "minivan", label: "Minivan" },
];

const segmentOptions = [
  { value: "economy", label: "EconÃ´mico" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxo" },
];

const stateOptions = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export default function EditVehicle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [searchingPickupPostalCode, setSearchingPickupPostalCode] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

  const hasDriverOption = form.watch("has_driver_option");

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const handlePickupPostalCodeLookup = async (value: string) => {
    const postalCode = sanitizePostalCode(value);
    if (postalCode.length !== 8) {
      return;
    }

    try {
      setSearchingPickupPostalCode(true);
      const address = await lookupAddressByPostalCode(postalCode);
      form.setValue("pickup_street", address.street, { shouldDirty: true });
      form.setValue("pickup_neighborhood", address.neighborhood, { shouldDirty: true });
      form.setValue("location_city", address.city, { shouldDirty: true });
      form.setValue("location_state", address.state, { shouldDirty: true });

      if (!form.getValues("pickup_complement")) {
        form.setValue("pickup_complement", address.complement, { shouldDirty: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel consultar o CEP.");
    } finally {
      setSearchingPickupPostalCode(false);
    }
  };
  const loadVehicle = async () => {
    if (!id) {
      navigate("/my-vehicles");
      return;
    }

    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      toast.error("VeÃ­culo nÃ£o encontrado");
      navigate("/my-vehicles");
      return;
    }

    form.reset({
      title: vehicle.title || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year || new Date().getFullYear(),
      color: vehicle.color || "",
      plate: vehicle.plate || "",
      renavam: vehicle.renavam || "",
      fuel_type: vehicle.fuel_type || "",
      transmission: vehicle.transmission || "automatic",
      seats: vehicle.seats || 5,
      location_city: vehicle.location_city || "",
      location_state: vehicle.location_state || "",
      pickup_neighborhood: vehicle.pickup_neighborhood || "",
      pickup_street: vehicle.pickup_street || "",
      pickup_number: vehicle.pickup_number || "",
      pickup_complement: vehicle.pickup_complement || "",
      pickup_zip_code: vehicle.pickup_zip_code || "",
      daily_price: vehicle.daily_price || 0,
      weekly_price: vehicle.weekly_price || undefined,
      monthly_price: vehicle.monthly_price || undefined,
      deposit_amount: vehicle.deposit_amount || undefined,
      has_driver_option: vehicle.has_driver_option || false,
      driver_daily_price: vehicle.driver_daily_price || undefined,
      driver_notes: vehicle.driver_notes || "",
      mileage_limit_per_day: vehicle.mileage_limit_per_day || undefined,
      body_type: vehicle.body_type || "",
      segment: vehicle.segment || "",
      is_popular: vehicle.is_popular || false,
    });

    // Load photos using the new service
    const vehiclePhotos = await getVehiclePhotos(id);
    setPhotos(vehiclePhotos);
    setLoading(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!id) return;

    setIsSubmitting(true);

    try {
      const success = await updateVehicle(id, values as VehicleFormData);

      if (!success) {
        toast.error("Erro ao atualizar veÃ­culo");
        setIsSubmitting(false);
        return;
      }

      toast.success("VeÃ­culo atualizado com sucesso!");
      navigate("/my-vehicles");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao atualizar veÃ­culo");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-vehicles")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Car className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Editar VeÃ­culo</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">InformaÃ§Ãµes BÃ¡sicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TÃ­tulo do anÃºncio</FormLabel>
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
                        <FormLabel>Marca</FormLabel>
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
                        <FormLabel>Modelo</FormLabel>
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
                        <FormLabel>Ano</FormLabel>
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
                        <FormLabel>Cor</FormLabel>
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
                        <FormLabel>Placa (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC1D23" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="renavam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renavam (opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Technical Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">EspecificaÃ§Ãµes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CombustÃ­vel</FormLabel>
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
                        <FormLabel>CÃ¢mbio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="automatic">AutomÃ¡tico</SelectItem>
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
                        <FormLabel>Lugares</FormLabel>
                        <FormControl>
                          <Input type="number" min={2} max={9} {...field} />
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
                        <FormLabel>Tipo de carroceria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bodyTypeOptions.map((type) => (
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Localizacao de retirada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="location_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
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
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Sao Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pickup_zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="00000-000"
                            value={formatPostalCode(field.value || "")}
                            onChange={(e) => field.onChange(formatPostalCode(e.target.value))}
                            onBlur={() => handlePickupPostalCodeLookup(field.value || "")}
                            maxLength={9}
                            inputMode="numeric"
                            className="pr-10"
                          />
                          {searchingPickupPostalCode ? <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Rua, bairro, cidade e UF sao preenchidos automaticamente pelo CEP.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pickup_street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua / endereco</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Rua das Flores" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="pickup_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numero</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pickup_complement"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, bloco, referencia..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pickup_neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Centro" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">O bairro aparece no anuncio. O endereco completo so e compartilhado nas etapas liberadas da reserva.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Precos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="daily_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diaria (R$) *</FormLabel>
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
                      <FormLabel>Caucao (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mileage_limit_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de quilometragem por dia</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="200" {...field} />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Esse limite sera exibido no anuncio e na etapa de vistoria da reserva.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="has_driver_option"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5 pr-4">
                        <FormLabel className="text-base">Motorista disponibilizado pelo locador</FormLabel>
                        <p className="text-sm text-muted-foreground">Ative para oferecer o veiculo com e sem motorista, deixando o adicional bem claro no anuncio.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {hasDriverOption ? (
                  <>
                    <FormField
                      control={form.control}
                      name="driver_daily_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor adicional da diaria com motorista (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="120" {...field} />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">O valor do anuncio continuara exibindo o preco sem motorista e o adicional com motorista.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="driver_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalhes do servico com motorista</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: transfer, eventos ou uso executivo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                <FormField
                  control={form.control}
                  name="is_popular"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Destacar como popular</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Seu veiculo aparecera em destaque nas buscas
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fotos do VeÃ­culo</CardTitle>
              </CardHeader>
              <CardContent>
                <VehiclePhotoGallery
                  vehicleId={id!}
                  photos={photos}
                  onPhotosChange={setPhotos}
                  maxPhotos={10}
                  editable={true}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar AlteraÃ§Ãµes
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </WebLayout>
  );
}




