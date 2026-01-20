import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

export default function Messages() {
  const navigate = useNavigate();

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Mensagens</h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            Em breve você poderá falar com locadores e com a equipe OLI por aqui.
          </p>
          
          <Button onClick={() => navigate("/home")} size="lg">
            Voltar para Início
          </Button>
        </div>
      </div>
    </WebLayout>
  );
}
