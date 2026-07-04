import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { TasksPage } from './pages/TasksPage';
import { TeamPage } from './pages/TeamPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Wraps the authenticated pages with the data provider (needs a logged-in user). */
function Private({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
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
          <Route path="/leads" element={<Private><LeadsPage /></Private>} />
          <Route path="/tareas" element={<Private><TasksPage /></Private>} />
          <Route path="/equipo" element={<Private adminOnly><TeamPage /></Private>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
