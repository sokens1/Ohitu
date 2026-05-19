import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      toast.error('Accès Refusé', {
        description: 'Votre profil ne possède pas les autorisations nécessaires pour accéder à cette section.',
        duration: 5000,
        position: 'top-right',
      });
    }
  }, [user, authLoading, allowedRoles]);

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gov-gray">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Chargement de la session sécurisée...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
