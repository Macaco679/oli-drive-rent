import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/supabase";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";

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
        navigate("/");
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
    <MobileLayout showBottomNav={false}>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary to-accent">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">OLI</h1>
            <p className="text-white/90">Aluguel de carros entre particulares</p>
          </div>

          <div className="bg-card p-6 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {isLogin ? "Entrar" : "Criar conta"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-pill bg-primary hover:bg-primary/90"
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
        </div>
      </div>
    </MobileLayout>
  );
}
