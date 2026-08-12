import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isRoadmapOwner } from '../../lib/roadmapGate';
import { PageLoader } from '../ui/misc';

export function ProtectedRoute({
  children,
  adminOnly = false,
  ownerOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  /** Solo el dueño del Roadmap (admin id 117mgd…) — más estricto que adminOnly. */
  ownerOnly?: boolean;
}) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <PageLoader />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (ownerOnly && !isRoadmapOwner(user)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
