import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';

export type Permission =
  | 'view:dashboard'
  | 'view:elections'
  | 'view:centers'
  | 'view:voters'
  | 'view:users'
  | 'view:audit'
  | 'view:results'
  | 'results:entry'
  | 'results:validate'
  | 'results:publish'
  | 'results:observe'
  | 'manage:users:all'
  | 'manage:users:own';

const PERMISSIONS: Record<UserRole, Permission[]> = {
  'super-admin': [
    'view:dashboard', 'view:elections', 'view:centers', 'view:voters',
    'view:users', 'view:audit', 'view:results',
    'results:entry', 'results:validate', 'results:publish', 'results:observe',
    'manage:users:all',
  ],
  'admin': [
    'view:dashboard', 'view:elections', 'view:centers',
    'view:users', 'view:results',
    'results:entry', 'results:validate', 'results:publish', 'results:observe',
    'manage:users:own',
  ],
  'validateur': [
    'view:dashboard', 'view:results',
    'results:validate',
  ],
  'agent-saisie': [
    'view:dashboard', 'view:results',
    'results:entry',
  ],
  'observateur': [
    'view:dashboard', 'view:results',
    'results:observe',
  ],
  'president-bureau': [
    'view:dashboard', 'view:results',
    'results:entry', 'results:validate',
  ],
};

const OPERATIONAL_ROLES: UserRole[] = ['agent-saisie', 'validateur', 'observateur', 'president-bureau'];

export function useRBAC() {
  const { user } = useAuth();

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    return (PERMISSIONS[user.role] ?? []).includes(permission);
  };

  // Onglet Results accessible selon le rôle (le premier autorisé)
  const defaultResultsTab = (): string => {
    if (!user) return 'entry';
    if (can('results:entry') && (user.role === 'super-admin' || user.role === 'admin' || user.role === 'agent-saisie' || user.role === 'president-bureau')) return 'entry';
    if (can('results:validate')) return 'validation';
    return 'entry';
  };

  // Route par défaut après connexion
  const defaultRoute = (): string => {
    if (!user) return '/login';
    return OPERATIONAL_ROLES.includes(user.role) ? '/results' : '/dashboard';
  };

  return {
    can,
    defaultRoute,
    defaultResultsTab,
    role: user?.role,
    assignedElectionId: user?.assigned_election_id ?? null,
    isGlobalAdmin: user?.role === 'super-admin',
    isAdmin: user?.role === 'admin',
    isOperational: OPERATIONAL_ROLES.includes(user?.role ?? '' as UserRole),
  };
}
