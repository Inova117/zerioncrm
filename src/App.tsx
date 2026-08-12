import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadFinderPage } from './pages/LeadFinderPage';
import { CopilotPage } from './pages/CopilotPage';
import { CopilotMetricsPage } from './pages/CopilotMetricsPage';
import { LeadsPage } from './pages/LeadsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { TasksPage } from './pages/TasksPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamPage } from './pages/TeamPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Wraps the authenticated pages with the data provider (needs a logged-in user). */
function Private({
  children,
  adminOnly,
  ownerOnly,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}) {
  return (
    <ProtectedRoute adminOnly={adminOnly} ownerOnly={ownerOnly}>
      <DataProvider>{children}</DataProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Private><DashboardPage /></Private>} />
          <Route path="/lead-finder" element={<Private><LeadFinderPage /></Private>} />
          <Route path="/copilot" element={<Private><CopilotPage /></Private>} />
          <Route path="/copilot/metricas" element={<Private><CopilotMetricsPage /></Private>} />
          <Route path="/leads" element={<Private><LeadsPage /></Private>} />
          <Route path="/empresas" element={<Private><CompaniesPage /></Private>} />
          <Route path="/tareas" element={<Private><TasksPage /></Private>} />
          <Route path="/reportes" element={<Private><ReportsPage /></Private>} />
          <Route path="/equipo" element={<Private adminOnly><TeamPage /></Private>} />
          {/* Roadmap Zerion: módulo personal del fundador (ownerOnly = solo admin 117mgd…) */}
          <Route path="/roadmap" element={<Private ownerOnly><RoadmapPage /></Private>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
