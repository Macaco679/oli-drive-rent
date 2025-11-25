import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

export default function Messages() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">Mensagens</h1>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
            <MessageCircle className="w-12 h-12 text-primary" />
          </div>

          <h2 className="text-xl font-semibold mb-2">Em breve!</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-sm">
            Em breve você poderá falar com locadores e com a equipe OLI por aqui.
          </p>

          <Button
            onClick={() => navigate("/")}
            className="btn-pill bg-primary hover:bg-primary/90"
          >
            Voltar para início
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
