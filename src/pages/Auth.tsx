import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { data, error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao entrar: " + error.message);
      } else if (data.user) {
        toast.success("Login realizado com sucesso!");
        navigate("/home");
      }
    } else {
      if (!fullName.trim()) {
        toast.error("Por favor, informe seu nome completo");
        setLoading(false);
        return;
      }
      
      const { data, error } = await signUp(email, password, fullName);
      if (error) {
        toast.error("Erro ao criar conta: " + error.message);
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        navigate("/onboarding");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-accent items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <h1 className="text-6xl font-bold mb-6">OLI</h1>
          <p className="text-2xl mb-4">Aluguel de carros entre particulares</p>
          <p className="text-white/80 text-lg">
            Conectando motoristas e proprietários de veículos. 
            Planos semanais e diários para motoristas de app e uso comum.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center">
            <h1 className="text-4xl font-bold text-primary mb-2">OLI</h1>
            <p className="text-muted-foreground">Aluguel de carros entre particulares</p>
          </div>

          {/* Demo mode alert */}
          <Alert className="bg-secondary border-border">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground text-sm">
              <strong>Modo Demo:</strong> Supabase desconectado. Use qualquer e-mail/senha para testar.
            </AlertDescription>
          </Alert>

          <div className="bg-card p-8 rounded-2xl shadow-xl border border-border">
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {isLogin ? "Entrar" : "Criar conta"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="mt-1 h-12"
                    placeholder="Seu nome completo"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 h-12"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 h-12"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-lg"
              >
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? "Não tem conta? Criar conta"
                  : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Ao criar sua conta, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}