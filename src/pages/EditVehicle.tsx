import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Car, Upload, X, Loader2, Save, ArrowLeft, Trash2 } from "lucide-react";
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
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  VehicleFormData,
} from "@/lib/vehicleService";

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number().min(1990).max(new Date().getFullYear() + 1),
  color: z.string().min(1, "Cor é obrigatória"),
  plate: z.string().optional(),
  renavam: z.string().optional(),
  fuel_type: z.string().min(1, "Combustível é obrigatório"),
  transmission: z.enum(["manual", "automatic"]),
  seats: z.coerce.number().min(2).max(9),
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
  "Peugeot", "Renault", "Toyota", "Volkswagen", "Outro",
];

const fuelOptions = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico", "Híbrido"];

const bodyTypeOptions = [
  { value: "hatch", label: "Hatch" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Pickup" },
  { value: "minivan", label: "Minivan" },
];

const segmentOptions = [
  { value: "economy", label: "Econômico" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxo" },
];

const stateOptions = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

interface ExistingPhoto {
  id: string;
  image_url: string;
  is_cover: boolean;
}

export default function EditVehicle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

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
      daily_price: 0,
      weekly_price: undefined,
      monthly_price: undefined,
      deposit_amount: undefined,
      body_type: "",
      segment: "",
      is_popular: false,
    },
  });

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const loadVehicle = async () => {
    if (!id) {
      navigate("/my-vehicles");
      return;
    }

    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      toast.error("Veículo não encontrado");
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
      daily_price: vehicle.daily_price || 0,
      weekly_price: vehicle.weekly_price || undefined,
      monthly_price: vehicle.monthly_price || undefined,
      deposit_amount: vehicle.deposit_amount || undefined,
      body_type: vehicle.body_type || "",
      segment: vehicle.segment || "",
      is_popular: vehicle.is_popular || false,
    });

    setExistingPhotos(vehicle.oli_vehicle_photos || []);
    setLoading(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const photos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    const totalPhotos = existingPhotos.length + newPhotos.length + photos.length;
    setNewPhotos((prev) => [...prev, ...photos].slice(0, Math.max(0, 10 - existingPhotos.length)));
    e.target.value = "";
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDeleteExistingPhoto = async (photo: ExistingPhoto) => {
    setDeletingPhotoId(photo.id);
    const success = await deleteVehiclePhoto(photo.id, photo.image_url);
    setDeletingPhotoId(null);

    if (success) {
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast.success("Foto removida");
    } else {
      toast.error("Erro ao remover foto");
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!id) return;

    setIsSubmitting(true);

    try {
      const success = await updateVehicle(id, values as VehicleFormData);

      if (!success) {
        toast.error("Erro ao atualizar veículo");
        setIsSubmitting(false);
        return;
      }

      // Upload new photos
      for (let i = 0; i < newPhotos.length; i++) {
        const isCover = existingPhotos.length === 0 && i === 0;
        await uploadVehiclePhoto(id, newPhotos[i].file, isCover);
      }

      toast.success("Veículo atualizado com sucesso!");
      navigate("/my-vehicles");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao atualizar veículo");
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
          <h1 className="text-2xl font-bold">Editar Veículo</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do anúncio</FormLabel>
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
                <CardTitle className="text-lg">Especificações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Combustível</FormLabel>
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
                        <FormLabel>Câmbio</FormLabel>
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
                <CardTitle className="text-lg">Localização</CardTitle>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preços</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Destacar como popular</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Seu veículo aparecerá em destaque nas buscas
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
                <CardTitle className="text-lg">Fotos do Veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Você pode ter até 10 fotos. A primeira é a foto de capa.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Existing photos */}
                  {existingPhotos.map((photo, index) => (
                    <div key={photo.id} className="relative aspect-square">
                      <img
                        src={photo.image_url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {photo.is_cover && (
                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                          Capa
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingPhoto(photo)}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full disabled:opacity-50"
                      >
                        {deletingPhotoId === photo.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}

                  {/* New photos */}
                  {newPhotos.map((photo, index) => (
                    <div key={`new-${index}`} className="relative aspect-square">
                      <img
                        src={photo.preview}
                        alt={`Nova foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border-2 border-dashed border-primary"
                      />
                      <span className="absolute top-1 left-1 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded">
                        Nova
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNewPhoto(index)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Add photo button */}
                  {existingPhotos.length + newPhotos.length < 10 && (
                    <label className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                      <input
                        type="file"
                        accept="image/*"
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
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </WebLayout>
  );
}
