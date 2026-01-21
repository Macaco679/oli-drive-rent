import { Home, Search, Calendar, MessageCircle, User, Car } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Início", path: "/home" },
  { icon: Search, label: "Buscar", path: "/search" },
  { icon: Car, label: "Meu Carro", path: "/profile/register-vehicle" },
  { icon: Calendar, label: "Reservas", path: "/reservations" },
  { icon: User, label: "Perfil", path: "/profile" },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors"
            activeClassName="text-primary bg-secondary/50"
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
