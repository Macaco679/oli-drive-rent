import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCurrentUser } from "@/lib/supabase";
import { getMyVehicles, deleteVehicle } from "@/lib/vehicleService";
import { Car, Plus, Edit, Trash2, MapPin, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Vehicle {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  daily_price: number;
  weekly_price: number | null;
  location_city: string;
  location_state: string;
  status: string;
  is_active: boolean;
  oli_vehicle_photos: { id: string; image_url: string; is_cover: boolean }[];
}

export default function MyVehicles() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const data = await getMyVehicles();
    setVehicles(data);
    setLoading(false);
  };

  const getCoverPhoto = (vehicle: Vehicle) => {
    const cover = vehicle.oli_vehicle_photos?.find((p) => p.is_cover);
    return cover?.image_url || vehicle.oli_vehicle_photos?.[0]?.image_url;
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      available: { label: "Disponível", variant: "default" },
      rented: { label: "Alugado", variant: "secondary" },
      maintenance: { label: "Manutenção", variant: "outline" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDelete = async () => {
    if (!vehicleToDelete) return;

    setDeleting(true);
    const success = await deleteVehicle(vehicleToDelete.id);
    setDeleting(false);

    if (success) {
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleToDelete.id));
      toast.success("Veículo excluído com sucesso");
    } else {
      toast.error("Erro ao excluir veículo");
    }

    setDeleteDialogOpen(false);
    setVehicleToDelete(null);
  };

  const openDeleteDialog = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Meus Veículos</h1>
          </div>
          <Button onClick={() => navigate("/profile/register-vehicle")}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Veículo
          </Button>
        </div>

        {vehicles.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center">
                <Car className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">Nenhum veículo cadastrado</h2>
              <p className="text-muted-foreground max-w-md">
                Cadastre seu primeiro veículo e comece a receber reservas de motoristas interessados.
              </p>
              <Button onClick={() => navigate("/profile/register-vehicle")} size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar meu primeiro veículo
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {vehicles.map((vehicle) => {
              const coverPhoto = getCoverPhoto(vehicle);
              return (
                <Card key={vehicle.id} className="overflow-hidden">
                  <div className="flex">
                    {/* Photo */}
                    <div className="w-40 h-40 bg-secondary flex-shrink-0">
                      {coverPhoto ? (
                        <img
                          src={coverPhoto}
                          alt={vehicle.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <CardContent className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {vehicle.title || `${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
                          </h3>
                          {getStatusBadge(vehicle.status, vehicle.is_active)}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3" />
                          {vehicle.location_city} - {vehicle.location_state}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold text-primary">
                            R$ {vehicle.daily_price?.toFixed(0)}
                          </span>
                          <span className="text-muted-foreground">/dia</span>
                          {vehicle.weekly_price && (
                            <span className="text-muted-foreground ml-2">
                              | R$ {vehicle.weekly_price?.toFixed(0)}/sem
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/my-vehicles/${vehicle.id}/edit`)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(vehicle)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{vehicleToDelete?.title}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </WebLayout>
  );
}
