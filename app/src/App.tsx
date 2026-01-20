import { Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./routes/AdminDashboard";
import AdminCases from "./routes/AdminCases";
import EmployeeOffice from "./routes/EmployeeOffice";
import EmployeeTraining from "./routes/EmployeeTraining";
import ClientPortal from "./routes/ClientPortal";
import ClientOnboarding from "./routes/ClientOnboarding";
import Login from "./routes/Login";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/cases" element={<AdminCases />} />
      <Route path="/office" element={<EmployeeOffice />} />
      <Route path="/office/training" element={<EmployeeTraining />} />
      <Route path="/client/:caseId" element={<ClientPortal />} />
      <Route path="/client/:caseId/onboarding" element={<ClientOnboarding />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
