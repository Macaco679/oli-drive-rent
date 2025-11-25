import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

export const MobileLayout = ({ children, showBottomNav = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container relative">
        <main className={showBottomNav ? "pb-20" : ""}>
          {children}
        </main>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
};
