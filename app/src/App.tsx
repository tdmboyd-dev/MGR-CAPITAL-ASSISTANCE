import { Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "./hooks/useAuth";
import AdminDashboard from "./routes/AdminDashboard";
import AdminCases from "./routes/AdminCases";
import AdminEmployees from "./routes/AdminEmployees";
import AdminBanking from "./routes/AdminBanking";
import AdminTraining from "./routes/AdminTraining";
import AdminIngestion from "./routes/AdminIngestion";
import AdminSettings from "./routes/AdminSettings";
import EmployeeOffice from "./routes/EmployeeOffice";
import EmployeeTraining from "./routes/EmployeeTraining";
import ClientPortal from "./routes/ClientPortal";
import ClientOnboarding from "./routes/ClientOnboarding";
import Login from "./routes/Login";

// Protected route wrapper
function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // FOUNDER has access to everything
  if (user.role === "FOUNDER") {
    return <>{children}</>;
  }

  // Check if user's role is in allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin/Founder Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/cases" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminCases />
        </ProtectedRoute>
      } />
      <Route path="/admin/employees" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminEmployees />
        </ProtectedRoute>
      } />
      <Route path="/admin/banking" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminBanking />
        </ProtectedRoute>
      } />
      <Route path="/admin/training" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminTraining />
        </ProtectedRoute>
      } />
      <Route path="/admin/ingestion" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminIngestion />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminSettings />
        </ProtectedRoute>
      } />

      {/* Employee Routes */}
      <Route path="/office" element={
        <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
          <EmployeeOffice />
        </ProtectedRoute>
      } />
      <Route path="/office/training" element={
        <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
          <EmployeeTraining />
        </ProtectedRoute>
      } />

      {/* Client Routes */}
      <Route path="/client/:caseId" element={<ClientPortal />} />
      <Route path="/client/:caseId/onboarding" element={<ClientOnboarding />} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
