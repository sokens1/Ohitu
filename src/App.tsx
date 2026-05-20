
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import PublicHomePage from "./pages/PublicHomePage";
import ElectionResults from "./pages/ElectionResults";
import Dashboard from "./pages/Dashboard";
import DashboardModernSimple from "./pages/DashboardModernSimple";
import ProtectedRoute from "./components/ProtectedRoute";
import ElectionManagementUnified from "./pages/ElectionManagementUnified";
import UserManagement from "./pages/UserManagement";
import Results from "./pages/Results";
import CampaignManagement from "./pages/CampaignManagement";
import OperationDetail from "./pages/OperationDetail";
import Conversations from "./pages/Conversations";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import VotingCenters from "./pages/VotingCenters";
import Voters from "./pages/Voters";
import AuditLogs from "./pages/AuditLogs";
// Create QueryClient outside of component to avoid recreation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <NotificationProvider>
              <BrowserRouter>
                <Routes>
                  {/* Page d'accueil désactivée temporairement */}
                  {/* <Route path="/home" element={<PublicHomePage />} /> */}
                  <Route path="/" element={<Login />} />
                  <Route path="/election/:electionId/results" element={<ElectionResults />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardModernSimple /></ProtectedRoute>} />
                  <Route path="/elections" element={<ProtectedRoute allowedRoles={['super-admin']}><ElectionManagementUnified /></ProtectedRoute>} />
                  <Route path="/centers" element={<ProtectedRoute><VotingCenters /></ProtectedRoute>} />
                  <Route path="/voters" element={<ProtectedRoute><Voters /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute allowedRoles={['super-admin']}><UserManagement /></ProtectedRoute>} />
                  <Route path="/audit" element={<ProtectedRoute allowedRoles={['super-admin']}><AuditLogs /></ProtectedRoute>} />
                  <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
                  <Route path="/campaign" element={<CampaignManagement />} />
                  <Route path="/campaign/operation/:id" element={<OperationDetail />} />
                  <Route path="/conversations" element={<Conversations />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              <Toaster />
              <Sonner />
            </NotificationProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
