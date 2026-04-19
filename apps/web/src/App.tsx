import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider, useAuth } from "@/auth/auth-context";

import DashboardPage from "./pages/dashboard-page";
import ChurchDetailPage from "./pages/church-detail-page";
import LoginPage from "./pages/login-page";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="panel max-w-md text-center">
      <p className="section-kicker">Preparing Demo Workspace</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Loading the NGO Church Insights prototype</h1>
      <p className="mt-4 text-sm text-slate-600">
        Syncing your role-aware session and current network summary.
      </p>
    </div>
  </div>
);

const ProtectedRoutes = () => {
  const { session, currentUser, isLoading } = useAuth();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!session || !currentUser) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/churches/:churchId" element={<ChurchDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const PublicRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/*" element={<ProtectedRoutes />} />
  </Routes>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <PublicRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
