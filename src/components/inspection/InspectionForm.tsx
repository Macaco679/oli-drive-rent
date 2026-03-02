import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InspectionFormData,
  InspectionChecklist,
  CHECKLIST_LABELS,
  FUEL_LEVELS,
} from "@/lib/inspectionTypes";

interface InspectionFormFieldsProps {
  formData: InspectionFormData;
  onChange: (data: Partial<InspectionFormData>) => void;
  disabled?: boolean;
}

export function InspectionFormFields({ formData, onChange, disabled }: InspectionFormFieldsProps) {
  const updateChecklist = (key: keyof InspectionChecklist, value: boolean) => {
    onChange({ checklist: { ...formData.checklist, [key]: value } });
  };

  return (
    <div className="space-y-6">
      {/* Mileage & Fuel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dados do Veículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mileage">Quilometragem atual *</Label>
              <Input
                id="mileage"
                type="number"
                placeholder="Ex: 45230"
                value={formData.mileage}
                onChange={(e) => onChange({ mileage: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuel_level">Nível de combustível *</Label>
              <Select
                value={formData.fuel_level}
                onValueChange={(v) => onChange({ fuel_level: v })}
                disabled={disabled}
              >
                <SelectTrigger id="fuel_level">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_LEVELS.map((fl) => (
                    <SelectItem key={fl.value} value={fl.value}>
                      {fl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="is_clean"
              checked={formData.is_clean}
              onCheckedChange={(v) => onChange({ is_clean: v })}
              disabled={disabled}
            />
            <Label htmlFor="is_clean">Veículo limpo?</Label>
          </div>
        </CardContent>
      </Card>

      {/* Damage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Avarias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="has_visible_damage"
              checked={formData.has_visible_damage}
              onCheckedChange={(v) => onChange({ has_visible_damage: v })}
              disabled={disabled}
            />
            <Label htmlFor="has_visible_damage">Há avarias visíveis?</Label>
          </div>

          {formData.has_visible_damage && (
            <div className="space-y-2">
              <Label htmlFor="damage_notes">Descrição das avarias *</Label>
              <Textarea
                id="damage_notes"
                placeholder="Descreva as avarias encontradas..."
                value={formData.damage_notes}
                onChange={(e) => onChange({ damage_notes: e.target.value })}
                rows={3}
                disabled={disabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Checklist de Verificação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {(Object.keys(CHECKLIST_LABELS) as Array<keyof InspectionChecklist>).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`check-${key}`}
                  checked={formData.checklist[key]}
                  onCheckedChange={(checked) => updateChecklist(key, checked as boolean)}
                  disabled={disabled}
                />
                <Label htmlFor={`check-${key}`} className="text-sm cursor-pointer">
                  {CHECKLIST_LABELS[key]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Observações Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ex: Pequeno arranhão na porta traseira direita..."
            value={formData.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            disabled={disabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}
