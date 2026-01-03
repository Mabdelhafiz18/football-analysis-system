import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import MatchDetail from "./pages/MatchDetail";
import RefereeDecisions from "./pages/RefereeDecisions";
import TacticalAnalysis from "./pages/TacticalAnalysis";
import Upload from "./pages/Upload";
import Matches from "./pages/Matches";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ProtectedRouteWithRole } from "./components/auth/ProtectedRouteWithRole";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Base Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/matches" 
                element={
                  <ProtectedRoute>
                    <Matches />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/match/:id" 
                element={
                  <ProtectedRoute>
                    <MatchDetail />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/match/:id/decisions" 
                element={
                  <ProtectedRoute>
                    <RefereeDecisions />
                  </ProtectedRoute>
                } 
              />

              {/* Role-Protected Routes */}
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRouteWithRole allowedRoles={["coach", "manager", "academy_admin"]}>
                    <Analytics />
                  </ProtectedRouteWithRole>
                } 
              />
              
              <Route 
                path="/upload" 
                element={
                  <ProtectedRouteWithRole allowedRoles={["coach", "manager", "academy_admin"]}>
                    <Upload />
                  </ProtectedRouteWithRole>
                } 
              />
              
              <Route 
                path="/match/:id/tactical" 
                element={
                  <ProtectedRouteWithRole allowedRoles={["coach", "manager", "academy_admin"]}>
                    <TacticalAnalysis />
                  </ProtectedRouteWithRole>
                } 
              />
              
              {/* Legacy route support */}
              <Route 
                path="/match/:analysisId/decisions" 
                element={
                  <ProtectedRoute>
                    <RefereeDecisions />
                  </ProtectedRoute>
                } 
              />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
