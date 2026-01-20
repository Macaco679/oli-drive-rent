import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Calendar, MessageSquare, User, HelpCircle, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase";

interface WebLayoutProps {
  children: ReactNode;
}

const publicNavItems = [
  { path: "/home", label: "Início", icon: Home },
  { path: "/search", label: "Buscar", icon: Search },
];

const authNavItems = [
  { path: "/home", label: "Início", icon: Home },
  { path: "/search", label: "Buscar", icon: Search },
  { path: "/reservations", label: "Reservas", icon: Calendar },
  { path: "/messages", label: "Mensagens", icon: MessageSquare },
  { path: "/profile", label: "Perfil", icon: User },
];

export function WebLayout({ children }: WebLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { user } = await getCurrentUser();
      setIsAuthenticated(!!user);
    } catch {
      setIsAuthenticated(false);
    }
    setLoading(false);
  };

  const navItems = isAuthenticated ? authNavItems : publicNavItems;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/home" className="flex items-center gap-2">
              <span className="text-2xl font-bold">OLI</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2">
              {!loading && !isAuthenticated && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="hidden md:flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Entrar
                </Button>
              )}
              <button className="p-2 hover:bg-primary-foreground/10 rounded-full transition-colors">
                <HelpCircle className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t border-primary-foreground/20">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors",
                    isActive
                      ? "text-primary-foreground"
                      : "text-primary-foreground/60 hover:text-primary-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
            {!loading && !isAuthenticated && (
              <Link
                to="/auth"
                className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors text-primary-foreground/60 hover:text-primary-foreground"
              >
                <LogIn className="w-5 h-5" />
                <span className="text-xs font-medium">Entrar</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold text-primary mb-4">OLI</h3>
              <p className="text-muted-foreground text-sm">
                Plataforma de aluguel de carros entre particulares. Conectando motoristas e proprietários de veículos.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Úteis</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/search" className="hover:text-primary transition-colors">Buscar carros</Link></li>
                <li><Link to="/reservations" className="hover:text-primary transition-colors">Minhas reservas</Link></li>
                <li><Link to="/profile" className="hover:text-primary transition-colors">Meu perfil</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>contato@oliapp.com.br</li>
                <li>WhatsApp: (11) 99999-9999</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} OLI. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
