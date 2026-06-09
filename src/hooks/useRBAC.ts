import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';

export type Permission =
  | 'view:dashboard'
  | 'view:elections'   // voir la liste des élections (tous les rôles)
  | 'view:centers'
  | 'view:voters'
  | 'view:users'
  | 'view:audit'
  | 'view:results'
  | 'elections:manage' // créer / modifier / supprimer des élections (admin+)
  | 'results:entry'    // voir l'onglet saisie
  | 'results:submit'   // soumettre un PV (super-admin, admin, agent-saisie)
  | 'results:validate'
  | 'results:publish'
  | 'results:observe'
  | 'results:documents'   // voir l'onglet Documents
  | 'documents:upload'    // joindre des documents (président d'établissement)
  | 'documents:review'    // donner un avis sur les documents (admin+)
  | 'documents:download'  // consulter et télécharger les documents (agent-saisie+)
  | 'manage:users:all'
  | 'manage:users:own';

const PERMISSIONS: Record<UserRole, Permission[]> = {
  'super-admin': [
    'view:dashboard', 'view:elections', 'view:centers', 'view:voters',
    'view:users', 'view:audit', 'view:results',
    'elections:manage',
    'results:entry', 'results:submit', 'results:validate', 'results:publish', 'results:observe',
    'results:documents', 'documents:review', 'documents:download',
    'manage:users:all',
  ],
  'admin': [
    'view:dashboard', 'view:elections', 'view:centers',
    'view:users', 'view:results',
    'elections:manage',
    'results:entry', 'results:submit', 'results:validate', 'results:publish', 'results:observe',
    'results:documents', 'documents:review', 'documents:download',
    'manage:users:own',
  ],
  // ── Rôles opérationnels : vue élection + résultats uniquement ──────────────
  'validateur': [
    'view:dashboard', 'view:elections', 'view:results',
    'results:validate',
  ],
  'agent-saisie': [
    'view:dashboard', 'view:elections', 'view:results',
    'results:entry', 'results:submit',
    'results:documents', 'documents:download',
  ],
  'observateur': [
    'view:dashboard', 'view:elections', 'view:results',
    'results:validate', // peut VOIR l'onglet validation (mais en readOnly via validationReadOnly)
    'results:observe',
  ],
  'president-bureau': [
    'view:dashboard', 'view:elections', 'view:results',
    'results:entry',           // voit l'onglet saisie
    // PAS results:submit → lecture seule sur l'onglet saisie
    'results:validate',
  ],
  'president-etablissement': [
    'view:dashboard', 'view:elections', 'view:results',
    'results:validate', // peut voir l'onglet résultats (readOnly) et donner son avis
    'results:observe',
    'results:documents', 'documents:upload', 'documents:download',
  ],
  // ── Nouveaux rôles ─────────────────────────────────────────────────────────
  'employeur': [
    // Mêmes droits que l'observateur
    'view:dashboard', 'view:elections', 'view:results',
    'results:validate', // voit l'onglet résultats en lecture seule
    'results:observe',
    'results:documents', 'documents:download', // accès aux documents en lecture seule (pas d'upload ni de revue)
  ],
  'suppleant-president': [
    // Suppléant du président : peut uniquement déposer des documents
    'view:dashboard', 'view:elections', 'view:results',
    'results:documents', 'documents:upload', 'documents:download',
  ],
};

const OPERATIONAL_ROLES: UserRole[] = [
  'agent-saisie', 'validateur', 'observateur',
  'president-bureau', 'president-etablissement',
  'employeur', 'suppleant-president',
];

export function useRBAC() {
  const { user } = useAuth();

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    return (PERMISSIONS[user.role] ?? []).includes(permission);
  };

  const defaultResultsTab = (): string => {
    if (!user) return 'entry';
    if (can('results:entry')) return 'entry';
    if (can('results:validate')) return 'validation';
    return 'entry';
  };

  const defaultRoute = (): string => {
    if (!user) return '/login';
    return OPERATIONAL_ROLES.includes(user.role) ? '/results' : '/dashboard';
  };

  // IDs des élections assignées (plusieurs possible)
  const assignedElectionIds: string[] =
    user?.assigned_election_ids?.length
      ? user.assigned_election_ids
      : user?.assigned_election_id
        ? [user.assigned_election_id]
        : [];

  return {
    can,
    defaultRoute,
    defaultResultsTab,
    role: user?.role,
    // Compatibilité : première élection assignée (ou null)
    assignedElectionId: assignedElectionIds[0] ?? null,
    assignedElectionIds,
    isGlobalAdmin: user?.role === 'super-admin' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    isOperational: OPERATIONAL_ROLES.includes(user?.role ?? '' as UserRole),
  };
}
