import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

const OPERATIONAL_ROLES: UserRole[] = ['agent-saisie', 'validateur', 'observateur', 'president-bureau'];

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      toast.error('Accès refusé', {
        description: 'Votre profil ne dispose pas des autorisations nécessaires pour accéder à cette section.',
        duration: 5000,
        position: 'top-right',
      });
    }
  }, [user, authLoading, allowedRoles]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006400]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback = OPERATIONAL_ROLES.includes(user.role) ? '/results' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default ProtectedRoute;
