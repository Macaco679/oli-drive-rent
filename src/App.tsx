import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DriverLicenseProvider } from "@/contexts/DriverLicenseContext";
import { ChatWidgetProvider } from "@/contexts/ChatWidgetContext";
import { ChatWidget } from "@/components/chat/ChatWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Search from "./pages/Search";
import VehicleDetails from "./pages/VehicleDetails";
import BookVehicle from "./pages/BookVehicle";
import Reservations from "./pages/Reservations";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import PaymentHistory from "./pages/PaymentHistory";
import DriverLicenseForm from "./pages/DriverLicenseForm";
import RegisterVehicle from "./pages/RegisterVehicle";
import MyVehicles from "./pages/MyVehicles";
import EditVehicle from "./pages/EditVehicle";
import VehicleInspection from "./pages/VehicleInspection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DriverLicenseProvider>
        <ChatWidgetProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/home" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/vehicle/:id" element={<VehicleDetails />} />
              <Route path="/book/:id" element={<BookVehicle />} />
              <Route path="/reservations" element={<Reservations />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/chat/:conversationId" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/profile/payments" element={<PaymentHistory />} />
              <Route path="/profile/driver-license" element={<DriverLicenseForm />} />
              <Route path="/profile/register-vehicle" element={<RegisterVehicle />} />
              <Route path="/my-vehicles" element={<MyVehicles />} />
              <Route path="/my-vehicles/:id/edit" element={<EditVehicle />} />
              <Route path="/reservations/:rentalId/inspection" element={<VehicleInspection />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ChatWidget />
          </BrowserRouter>
        </ChatWidgetProvider>
      </DriverLicenseProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
