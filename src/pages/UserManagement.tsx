import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  Users,
  Plus,
  Search,
  Edit,
  Mail,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Shield,
  UserCog,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import type { UserRole } from '@/contexts/AuthContext';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  assigned_election_id?: string | null;
  assigned_election_ids?: string[] | null;
  created_by?: string | null;
  electionTitle?: string;
  assigned_center_ids?: string[] | null;
  assigned_center_bureaux?: Record<string, string[]> | null;
  assigned_center_colleges?: Record<string, string[]> | null;
}

interface Election {
  id: string;
  title: string;
}

// Rôles que l'admin peut attribuer à ses sous-utilisateurs
const ADMIN_ASSIGNABLE_ROLES: { value: UserRole; label: string; disabled?: boolean }[] = [
  { value: 'validateur',              label: 'Validateur' },
  { value: 'agent-saisie',           label: 'Agent de Saisie' },
  { value: 'observateur',            label: 'Observateur' },
  { value: 'president-etablissement', label: "Président de Bureau" },
  // { value: 'president-bureau', label: 'Président de Bureau' }, // À venir
];

// Tous les rôles (super-admin seulement)
const ALL_ROLES: { value: UserRole; label: string; disabled?: boolean }[] = [
  { value: 'super-admin',             label: 'Super Administrateur' },
  { value: 'admin',                   label: 'Administrateur' },
  { value: 'validateur',              label: 'Validateur' },
  { value: 'agent-saisie',           label: 'Agent de Saisie' },
  { value: 'observateur',            label: 'Observateur' },
  { value: 'president-etablissement', label: "Président de Bureau" },
  // { value: 'president-bureau', label: 'Président de Bureau' }, // À venir
];

const ROLE_BADGE: Record<UserRole, string> = {
  'super-admin':              'bg-purple-100 text-purple-800 border-purple-200',
  'admin':                    'bg-blue-100 text-blue-800 border-blue-200',
  'validateur':               'bg-green-100 text-green-800 border-green-200',
  'agent-saisie':             'bg-yellow-100 text-yellow-800 border-yellow-200',
  'observateur':              'bg-gray-100 text-gray-700 border-gray-200',
  'president-bureau':         'bg-orange-100 text-orange-800 border-orange-200',
  'president-etablissement':  'bg-teal-100 text-teal-800 border-teal-200',
};

const getRoleLabel = (role: UserRole): string =>
  ALL_ROLES.find(r => r.value === role)?.label ?? role;

// ── Multi-select élections (inline, sans modal) ────────────────────────────
interface ElectionMultiSelectProps {
  label: string;
  elections: { id: string; title: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

const ElectionMultiSelect: React.FC<ElectionMultiSelectProps> = ({ label, elections, selected, onChange }) => {
  const [search, setSearch] = React.useState('');
  const filtered = elections.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="space-y-2 border-2 border-gray-300 rounded-xl p-3 bg-white hover:border-gray-400 transition-colors">
      {/* Label style floating */}
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>

      {/* Badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(id => {
            const title = elections.find(e => e.id === id)?.title ?? id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1B2E5A] text-white"
              >
                {title}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 hover:opacity-70 leading-none">
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Rechercher une élection…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm pl-8 border-gray-200 bg-gray-50 focus:bg-white"
        />
      </div>

      {/* Liste checkboxes */}
      <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y bg-white">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">Aucune élection trouvée</p>
        ) : filtered.map(e => (
          <label
            key={e.id}
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(e.id)}
              onChange={() => toggle(e.id)}
              className="h-4 w-4 rounded accent-[#1B2E5A]"
            />
            <span className="truncate text-gray-800">{e.title}</span>
            {selected.includes(e.id) && (
              <CheckCircle className="ml-auto h-3.5 w-3.5 text-[#1B2E5A] flex-shrink-0" />
            )}
          </label>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-gray-400">
          {selected.length} élection{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const { isGlobalAdmin, isAdmin } = useRBAC();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [allElections, setAllElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter]       = useState<string>('all');
  const [statusFilter, setStatusFilter]   = useState<string>('all');
  const [electionFilter, setElectionFilter] = useState<string>('all');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  // Champs formulaire
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fRole, setFRole] = useState<UserRole>('observateur');
  const [fActive, setFActive] = useState(true);
  const [fElectionIds, setFElectionIds] = useState<string[]>([]);
  /** map centerId → bureauId[]   (président de bureau) */
  const [fCenterBureaux,  setFCenterBureaux]  = useState<Record<string, string[]>>({});
  /** map centerId → college_types[] (validateur, agent-saisie, observateur) */
  const [fCenterColleges, setFCenterColleges] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [availableCenters,  setAvailableCenters]  = useState<{ id: string; name: string }[]>([]);
  const [availableBureaux,  setAvailableBureaux]  = useState<{ id: string; name: string; centerId: string }[]>([]);
  const [availableColleges, setAvailableColleges] = useState<{ value: string; label: string }[]>([]);

  // États d'opération
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const availableRoles = isGlobalAdmin ? ALL_ROLES : ADMIN_ASSIGNABLE_ROLES;

  // ── Chargement des élections ────────────────────────────────────────────────
  useEffect(() => {
    const fetchElections = async () => {
      const { data } = await supabase
        .from('elections')
        .select('id, title')
        .order('title', { ascending: true });
      setAllElections(data || []);
    };
    fetchElections();
  }, []);

  // ── Chargement des utilisateurs (scopé selon le rôle) ──────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('users')
          .select('*, elections:assigned_election_id(title)')
          .order('created_at', { ascending: false });

        // L'admin ne voit QUE ses propres sous-utilisateurs
        if (isAdmin && currentUser) {
          query = query.eq('created_by', currentUser.id);
        }

        const { data, error } = await query;
        if (error) { console.error(error); return; }

        // Dernières connexions
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('user_id, created_at')
          .eq('action', 'LOGIN')
          .order('created_at', { ascending: false });

        const lastLoginMap = new Map<string, string>();
        logsData?.forEach((log: { user_id: string | null; created_at: string }) => {
          if (log.user_id && !lastLoginMap.has(log.user_id)) {
            lastLoginMap.set(log.user_id, log.created_at);
          }
        });

        const transformed: AppUser[] = (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role as UserRole,
          isActive: u.is_active,
          createdAt: new Date(u.created_at).toISOString().split('T')[0],
          lastLogin: lastLoginMap.get(u.id),
          assigned_election_id: u.assigned_election_id,
          assigned_election_ids: u.assigned_election_ids ?? null,
          created_by: u.created_by,
          electionTitle: u.elections?.title ?? undefined,
          assigned_center_ids:      u.assigned_center_ids      ?? null,
          assigned_center_bureaux:  u.assigned_center_bureaux  ?? null,
          assigned_center_colleges: u.assigned_center_colleges ?? null,
        }));

        setUsers(transformed);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [currentUser, isAdmin]);

  // ── Filtrage local ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole     = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus   = statusFilter === 'all' ||
                          (statusFilter === 'active' && u.isActive) ||
                          (statusFilter === 'inactive' && !u.isActive);
    const matchElection = electionFilter === 'all' ||
                          u.assigned_election_id === electionFilter ||
                          u.assigned_election_ids?.includes(electionFilter);
    return matchSearch && matchRole && matchStatus && matchElection;
  });

  // ── Helpers formulaire ──────────────────────────────────────────────────────
  const resetForm = () => {
    setFName(''); setFEmail(''); setFPassword('');
    setFRole('observateur'); setFActive(true);
    setFElectionIds([]); setFCenterBureaux({}); setFCenterColleges({});
    setAvailableCenters([]); setAvailableBureaux([]); setAvailableColleges([]);
    setShowPassword(false);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setFName(u.name); setFEmail(u.email);
    setFPassword(''); setFRole(u.role); setFActive(u.isActive);
    const ids = u.assigned_election_ids?.length
      ? u.assigned_election_ids
      : u.assigned_election_id ? [u.assigned_election_id] : [];
    setFElectionIds(ids);
    if (ROLES_WITH_BUREAUX.includes(u.role)) {
      setFCenterBureaux(u.assigned_center_bureaux ?? {});
      setFCenterColleges(u.assigned_center_colleges ?? {});
    } else {
      setFCenterColleges(u.assigned_center_colleges ?? {});
      setFCenterBureaux({});
    }
    setShowEditModal(true);
  };

  const ROLES_WITH_BUREAUX:  UserRole[] = ['president-etablissement'];
  const ROLES_WITH_COLLEGES: UserRole[] = ['validateur', 'agent-saisie', 'observateur'];
  const ROLES_WITH_CENTERS:  UserRole[] = [...ROLES_WITH_BUREAUX, ...ROLES_WITH_COLLEGES];

  useEffect(() => {
    const loadCentersAndAssignables = async () => {
      if (!ROLES_WITH_CENTERS.includes(fRole) || fElectionIds.length === 0) {
        setAvailableCenters([]); setAvailableBureaux([]); setAvailableColleges([]); return;
      }
      try {
        const { data: ecRows } = await supabase
          .from('election_centers').select('center_id').in('election_id', fElectionIds);
        const centerIds = Array.from(new Set((ecRows || []).map((r: any) => r.center_id).filter(Boolean)));
        if (centerIds.length === 0) { setAvailableCenters([]); setAvailableBureaux([]); setAvailableColleges([]); return; }
        const { data: centersData } = await supabase
          .from('voting_centers').select('id, name').in('id', centerIds).order('name');
        setAvailableCenters(centersData || []);

        if (ROLES_WITH_BUREAUX.includes(fRole)) {
          const { data: bureauxData } = await supabase
            .from('voting_bureaux').select('id, name, center_id').in('center_id', centerIds).order('name');
          setAvailableBureaux(
            (bureauxData || [])
              .filter(b => !/^college/i.test(b.name.trim()))
              .map(b => ({ id: b.id, name: b.name, centerId: b.center_id }))
          );
          // Charger aussi les collèges pour le président (assigned_center_colleges)
          const { data: collegesData } = await supabase
            .from('electoral_colleges').select('college_type').in('election_id', fElectionIds);
          const distinctTypes = Array.from(new Set((collegesData || []).map((c: any) => c.college_type).filter(Boolean)));
          const COLLEGE_LABELS: Record<string, string> = {
            cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution', general: 'Encadrement',
          };
          setAvailableColleges(
            distinctTypes.length > 0
              ? distinctTypes.map(t => ({ value: t, label: COLLEGE_LABELS[t] ?? t }))
              : [
                  { value: 'cadres',   label: 'Cadres' },
                  { value: 'employes', label: 'Maîtrise' },
                  { value: 'ouvriers', label: 'Exécution' },
                  { value: 'general',  label: 'Encadrement' },
                ]
          );
        } else {
          const { data: collegesData } = await supabase
            .from('electoral_colleges').select('college_type').in('election_id', fElectionIds);
          const distinctTypes = Array.from(new Set((collegesData || []).map((c: any) => c.college_type).filter(Boolean)));
          const COLLEGE_LABELS: Record<string, string> = {
            cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution', general: 'Encadrement',
          };
          setAvailableColleges(
            distinctTypes.length > 0
              ? distinctTypes.map(t => ({ value: t, label: COLLEGE_LABELS[t] ?? t }))
              : [
                  { value: 'cadres',   label: 'Cadres' },
                  { value: 'employes', label: 'Maîtrise' },
                  { value: 'ouvriers', label: 'Exécution' },
                  { value: 'general',  label: 'Encadrement' },
                ]
          );
          setAvailableBureaux([]);
        }
      } catch {
        setAvailableCenters([]); setAvailableBureaux([]); setAvailableColleges([]);
      }
    };
    loadCentersAndAssignables();
  }, [fRole, fElectionIds]);

  // ── Création via l'endpoint serveur (évite la limite de taux de auth.signUp) ─
  const handleCreate = async () => {
    if (!fName.trim() || !fEmail.trim() || !fPassword.trim()) {
      toast.error('Nom, email et mot de passe sont requis'); return;
    }
    if (fPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    if (isAdmin && fElectionIds.length === 0) {
      toast.error('Vous devez assigner au moins une élection à cet utilisateur'); return;
    }
    setCreating(true);
    try {
      // Récupérer le token JWT de la session courante
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expirée, veuillez vous reconnecter'); return; }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: fName.trim(),
          email: fEmail.trim(),
          password: fPassword,
          role: fRole,
          is_active: fActive,
          assigned_election_id: fElectionIds[0] ?? null,
          assigned_election_ids: fElectionIds.length > 0 ? fElectionIds : null,
          assigned_center_ids: ROLES_WITH_CENTERS.includes(fRole)
            ? Object.keys(ROLES_WITH_BUREAUX.includes(fRole) ? fCenterBureaux : fCenterColleges)
            : null,
          assigned_center_bureaux: ROLES_WITH_BUREAUX.includes(fRole) && Object.keys(fCenterBureaux).length > 0
            ? fCenterBureaux : null,
          assigned_center_colleges: (ROLES_WITH_COLLEGES.includes(fRole) || ROLES_WITH_BUREAUX.includes(fRole)) && Object.keys(fCenterColleges).length > 0
            ? fCenterColleges : null,
          created_by: currentUser?.id || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(`Échec : ${result.error ?? response.statusText}`);
        return;
      }

      const inserted = result.user;
      const ids: string[] = inserted.assigned_election_ids ?? (inserted.assigned_election_id ? [inserted.assigned_election_id] : []);
      const electionTitle = ids.map((id: string) => allElections.find(e => e.id === id)?.title).filter(Boolean).join(', ');
      setUsers(prev => [{
        id: inserted.id,
        name: inserted.name,
        email: inserted.email,
        role: inserted.role,
        isActive: inserted.is_active,
        createdAt: new Date(inserted.created_at).toISOString().split('T')[0],
        assigned_election_id: inserted.assigned_election_id,
        assigned_election_ids: ids,
        created_by: inserted.created_by,
        electionTitle,
        assigned_center_ids:      inserted.assigned_center_ids      ?? null,
        assigned_center_bureaux:  inserted.assigned_center_bureaux  ?? null,
        assigned_center_colleges: inserted.assigned_center_colleges ?? null,
      }, ...prev]);

      toast.success('Utilisateur créé avec succès');
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error('handleCreate error:', err);
      toast.error('Erreur réseau — vérifiez que le serveur est accessible');
    } finally {
      setCreating(false);
    }
  };

  // ── Mise à jour ─────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingUser || !fName.trim() || !fEmail.trim()) {
      toast.error('Nom et email sont requis'); return;
    }
    setUpdating(true);
    try {
      // Payload de base (colonnes toujours présentes)
      const updatePayload: Record<string, unknown> = {
        name: fName.trim(),
        email: fEmail.trim(),
        role: fRole,
        is_active: fActive,
        assigned_election_id: fElectionIds[0] ?? null,
        assigned_election_ids: fElectionIds.length > 0 ? fElectionIds : null,
      };

      // Colonnes optionnelles (nécessitent la migration 20260526_multi_observer_validator_centers)
      if (ROLES_WITH_BUREAUX.includes(fRole)) {
        updatePayload.assigned_center_ids      = Object.keys(fCenterBureaux);
        updatePayload.assigned_center_bureaux  = Object.keys(fCenterBureaux).length > 0 ? fCenterBureaux : null;
        updatePayload.assigned_center_colleges = Object.keys(fCenterColleges).length > 0 ? fCenterColleges : null;
      } else if (ROLES_WITH_COLLEGES.includes(fRole)) {
        updatePayload.assigned_center_ids      = Object.keys(fCenterColleges);
        updatePayload.assigned_center_colleges = Object.keys(fCenterColleges).length > 0 ? fCenterColleges : null;
        updatePayload.assigned_center_bureaux  = null;
      } else {
        updatePayload.assigned_center_ids      = null;
        updatePayload.assigned_center_bureaux  = null;
        updatePayload.assigned_center_colleges = null;
      }

      const { data: updatedRows, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', editingUser.id)
        .select('id');

      if (error) {
        console.error('Erreur mise à jour utilisateur:', error);
        const msg = (error as any)?.message ?? '';
        if (msg.includes('column') && msg.includes('does not exist')) {
          toast.error('Colonnes manquantes en base — appliquez les migrations SQL dans Supabase.');
        } else {
          toast.error(`Échec de la mise à jour : ${msg || 'erreur inconnue'}`);
        }
        return;
      }

      if (!updatedRows?.length) {
        toast.error('Mise à jour bloquée — politique RLS manquante sur la table users. Appliquez la migration 20260529_users_rls_admin.sql dans Supabase.');
        return;
      }

      if (fPassword && fPassword.length >= 6) {
        const { error: pwdError } = await supabase.auth.admin.updateUserById(editingUser.id, { password: fPassword });
        if (pwdError) toast.warning('Utilisateur mis à jour, mais le mot de passe n\'a pas pu être changé');
      }

      const electionTitle = fElectionIds.map(id => allElections.find(e => e.id === id)?.title).filter(Boolean).join(', ');
      setUsers(prev => prev.map(u => u.id === editingUser.id
        ? {
            ...u,
            name: fName.trim(),
            email: fEmail.trim(),
            role: fRole,
            isActive: fActive,
            assigned_election_id: fElectionIds[0] ?? null,
            assigned_election_ids: fElectionIds,
            electionTitle,
            assigned_center_ids:      updatePayload.assigned_center_ids as string[] | null,
            assigned_center_bureaux:  updatePayload.assigned_center_bureaux  as Record<string, string[]> | null,
            assigned_center_colleges: updatePayload.assigned_center_colleges as Record<string, string[]> | null,
          }
        : u
      ));
      toast.success('Utilisateur mis à jour');
      setShowEditModal(false);
      setEditingUser(null);
      resetForm();
    } finally {
      setUpdating(false);
    }
  };

  // ── Suppression ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('users').delete().eq('id', deletingUser.id);
      if (error) { toast.error('Échec de la suppression'); return; }
      try { await supabase.auth.admin.deleteUser(deletingUser.id); } catch { /* ignore */ }
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      toast.success('Utilisateur supprimé');
      setShowDeleteModal(false);
      setDeletingUser(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Activer / désactiver ────────────────────────────────────────────────────
  const handleToggleStatus = async (userId: string, current: boolean) => {
    const { error } = await supabase.from('users').update({ is_active: !current }).eq('id', userId);
    if (error) { toast.error('Échec de la mise à jour du statut'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !current } : u));
  };

  const handleResend = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) { toast.error("Échec d'envoi de l'email"); return; }
    toast.success('Email de confirmation renvoyé');
  };

  // ── JSX partagé pour les champs communs du formulaire ──────────────────────
  const formFields = (
    <div className="space-y-4">
      {/* Ligne 1 : Nom + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FloatingInput
          label="Nom complet"
          value={fName}
          onChange={e => setFName(e.target.value)}
          autoComplete="off"
        />
        <FloatingInput
          label="Email"
          type="email"
          value={fEmail}
          onChange={e => setFEmail(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Ligne 2 : Rôle */}
      <FloatingSelect
        label="Rôle"
        options={availableRoles.map(r => ({ value: r.value, label: r.label }))}
        value={fRole}
        onChange={v => setFRole(v as UserRole)}
      />

      {/* Ligne 3 : Élections assignées */}
      {(isAdmin || fRole !== 'super-admin') && (
        <ElectionMultiSelect
          label={isAdmin ? 'Élections assignées (obligatoire)' : 'Élections assignées (optionnel)'}
          elections={allElections}
          selected={fElectionIds}
          onChange={ids => { setFElectionIds(ids); setFCenterBureaux({}); setFCenterColleges({}); }}
        />
      )}

      {/* Établissements + collèges/bureaux assignés */}
      {ROLES_WITH_CENTERS.includes(fRole) && fElectionIds.length > 0 && availableCenters.length === 0 && (
        <p className="text-xs text-amber-600 px-1 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Aucun établissement trouvé pour les élections sélectionnées.
        </p>
      )}
      {ROLES_WITH_CENTERS.includes(fRole) && availableCenters.length > 0 && (() => {
        const isBureaux = ROLES_WITH_BUREAUX.includes(fRole);
        const currentMap   = isBureaux ? fCenterBureaux  : fCenterColleges;
        const setCurrentMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>> =
          isBureaux ? setFCenterBureaux : setFCenterColleges;

        const cfg = fRole === 'validateur'
          ? { border: 'border-green-200',  bg: 'bg-green-50/30',  text: 'text-green-700',  sub: 'text-green-600',  chip: 'border-green-600 bg-green-600',   chipOff: 'border-green-200 bg-white text-green-700 hover:bg-green-100',   accent: 'accent-green-700',  rowHover: 'hover:bg-green-50',  rowBorder: 'border-green-100',  colBg: 'bg-green-50/50 border-green-100'  }
          : fRole === 'agent-saisie'
          ? { border: 'border-yellow-200', bg: 'bg-yellow-50/30', text: 'text-yellow-700', sub: 'text-yellow-600', chip: 'border-yellow-600 bg-yellow-500',  chipOff: 'border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-100', accent: 'accent-yellow-600', rowHover: 'hover:bg-yellow-50', rowBorder: 'border-yellow-100', colBg: 'bg-yellow-50/50 border-yellow-100' }
          : fRole === 'observateur'
          ? { border: 'border-indigo-200', bg: 'bg-indigo-50/30', text: 'text-indigo-700', sub: 'text-indigo-600', chip: 'border-indigo-600 bg-indigo-600', chipOff: 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100', accent: 'accent-indigo-700', rowHover: 'hover:bg-indigo-50', rowBorder: 'border-indigo-100', colBg: 'bg-indigo-50/50 border-indigo-100' }
          : { border: 'border-teal-200',   bg: 'bg-teal-50/30',   text: 'text-teal-700',   sub: 'text-teal-600',   chip: 'border-teal-600 bg-teal-600',     chipOff: 'border-teal-200 bg-white text-teal-700 hover:bg-teal-100',     accent: 'accent-teal-700',   rowHover: 'hover:bg-teal-50',   rowBorder: 'border-teal-100',   colBg: 'bg-teal-50/50 border-teal-100'   };

        const sectionLabel = isBureaux ? 'Établissements, Bureaux & Collèges' : 'Établissements & Collèges';
        const subLabel     = isBureaux ? 'tous les bureaux'                   : 'tous les collèges';

        const allCentersSelected = availableCenters.length > 0 && availableCenters.every(c => c.id in currentMap);
        const toggleAllCenters = () => {
          if (allCentersSelected) {
            setCurrentMap({});
          } else {
            const next: Record<string, string[]> = {};
            availableCenters.forEach(c => { next[c.id] = currentMap[c.id] ?? []; });
            setCurrentMap(next);
          }
        };

        return (
          <div className={`space-y-2 border-2 ${cfg.border} rounded-xl p-3 ${cfg.bg}`}>
            {/* En-tête section */}
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className={`w-3.5 h-3.5 ${cfg.text}`} />
              <span className={`text-xs font-semibold ${cfg.text}`}>{sectionLabel}</span>
              <span className={`text-[10px] font-normal ${cfg.sub} italic ml-1`}>vide = tous</span>
              <button
                type="button"
                onClick={toggleAllCenters}
                className={`ml-auto text-[11px] font-semibold ${cfg.text} underline-offset-2 hover:underline`}
              >
                {allCentersSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
              {availableCenters.map(c => {
                const isSelected   = c.id in currentMap;
                const selectedVals = currentMap[c.id] ?? [];
                const centerItems  = isBureaux
                  ? availableBureaux.filter(b => b.centerId === c.id).map(b => ({ val: b.id,    lbl: b.name }))
                  : availableColleges.map(col => ({ val: col.value, lbl: col.label }));
                const allItemsSel  = centerItems.length > 0 && centerItems.every(i => selectedVals.includes(i.val));

                const toggleCenter = () =>
                  setCurrentMap(prev => {
                    const next = { ...prev };
                    if (isSelected) delete next[c.id]; else next[c.id] = [];
                    return next;
                  });

                const toggleItem = (val: string) =>
                  setCurrentMap(prev => {
                    const list = prev[c.id] ?? [];
                    return { ...prev, [c.id]: list.includes(val) ? list.filter(v => v !== val) : [...list, val] };
                  });

                const toggleAllItems = () =>
                  setCurrentMap(prev => ({
                    ...prev,
                    [c.id]: allItemsSel ? [] : centerItems.map(i => i.val),
                  }));

                return (
                  <div key={c.id} className={`rounded-xl border ${cfg.rowBorder} bg-white overflow-hidden`}>
                    {/* Ligne centre */}
                    <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${cfg.rowHover} transition-colors`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={toggleCenter}
                        className={`h-4 w-4 rounded ${cfg.accent} flex-shrink-0`}
                      />
                      <span className="truncate text-sm font-medium text-gray-800">{c.name}</span>
                      {isSelected && selectedVals.length === 0 && (
                        <span className={`ml-auto text-[10px] ${cfg.sub} italic whitespace-nowrap flex-shrink-0`}>{subLabel}</span>
                      )}
                      {isSelected && selectedVals.length > 0 && (
                        <span className={`ml-auto text-[10px] ${cfg.text} font-semibold whitespace-nowrap flex-shrink-0`}>
                          {selectedVals.length} {isBureaux ? `bureau${selectedVals.length > 1 ? 'x' : ''}` : `collège${selectedVals.length > 1 ? 's' : ''}`}
                        </span>
                      )}
                    </label>

                    {/* Chips sous le centre */}
                    {isSelected && centerItems.length > 0 && (
                      <div className={`px-3 pb-2 pt-1.5 ${cfg.colBg} border-t space-y-1.5`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-medium ${cfg.sub}`}>{isBureaux ? 'Bureaux' : 'Collèges'}</span>
                          <button type="button" onClick={toggleAllItems} className={`text-[10px] font-semibold ${cfg.text} hover:underline`}>
                            {allItemsSel ? 'Aucun' : 'Tous'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {centerItems.map(({ val, lbl }) => (
                            <label
                              key={val}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-xs font-medium transition-all ${
                                selectedVals.includes(val) ? `${cfg.chip} text-white` : cfg.chipOff
                              }`}
                            >
                              <input type="checkbox" checked={selectedVals.includes(val)} onChange={() => toggleItem(val)} className="sr-only" />
                              {lbl}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {isSelected && centerItems.length === 0 && (
                      <div className={`px-3 py-1.5 ${cfg.colBg} border-t`}>
                        <span className={`text-[10px] ${cfg.sub} italic`}>{subLabel} de cet établissement</span>
                      </div>
                    )}

                    {/* Collèges assignés — uniquement pour president-etablissement */}
                    {isBureaux && isSelected && availableColleges.length > 0 && (() => {
                      const selColleges   = fCenterColleges[c.id] ?? [];
                      const allColSel     = availableColleges.length > 0 && availableColleges.every(col => selColleges.includes(col.value));
                      const toggleCollege = (val: string) =>
                        setFCenterColleges(prev => {
                          const list = prev[c.id] ?? [];
                          return { ...prev, [c.id]: list.includes(val) ? list.filter(v => v !== val) : [...list, val] };
                        });
                      const toggleAllCol = () =>
                        setFCenterColleges(prev => ({
                          ...prev,
                          [c.id]: allColSel ? [] : availableColleges.map(col => col.value),
                        }));
                      return (
                        <div className="px-3 pb-2 pt-1.5 bg-teal-50/70 border-t border-teal-100 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-teal-600">Collèges</span>
                            <button type="button" onClick={toggleAllCol} className="text-[10px] font-semibold text-teal-700 hover:underline">
                              {allColSel ? 'Aucun' : 'Tous'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {availableColleges.map(col => (
                              <label
                                key={col.value}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-xs font-medium transition-all ${
                                  selColleges.includes(col.value)
                                    ? 'border-teal-500 bg-teal-500 text-white'
                                    : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
                                }`}
                              >
                                <input type="checkbox" checked={selColleges.includes(col.value)} onChange={() => toggleCollege(col.value)} className="sr-only" />
                                {col.label}
                              </label>
                            ))}
                          </div>
                          {selColleges.length === 0 && (
                            <span className="text-[10px] text-teal-500 italic">tous les collèges</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {Object.keys(currentMap).length > 0 && (
              <p className={`text-xs ${cfg.sub} font-medium pt-0.5`}>
                {Object.keys(currentMap).length} établissement{Object.keys(currentMap).length > 1 ? 's' : ''} sélectionné{Object.keys(currentMap).length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        );
      })()}

      {/* Compte actif */}
      <div className="flex items-center gap-3 px-1 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <Switch checked={fActive} onCheckedChange={v => setFActive(!!v)} />
        <div>
          <span className="text-sm font-medium text-gray-800">Compte actif</span>
          <p className="text-xs text-gray-500">{fActive ? "L'utilisateur peut se connecter" : "Accès suspendu"}</p>
        </div>
      </div>
    </div>
  );

  // ── Rendu ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006400] mx-auto mb-4" />
            <p className="text-gray-600">Chargement des utilisateurs...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isGlobalAdmin ? <Shield className="h-5 w-5 text-purple-600" /> : <UserCog className="h-5 w-5 text-blue-600" />}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {isGlobalAdmin ? 'Gestion globale des utilisateurs' : 'Mes utilisateurs'}
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {isGlobalAdmin
                ? 'Tous les comptes de la plateforme'
                : 'Utilisateurs que vous avez créés et rattachés à vos élections'}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} className="w-full sm:w-auto bg-[#1B2E5A] hover:bg-[#142347] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un utilisateur
          </Button>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  {(isGlobalAdmin ? ALL_ROLES : ADMIN_ASSIGNABLE_ROLES).map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
              <Select value={electionFilter} onValueChange={setElectionFilter}>
                <SelectTrigger className="sm:w-52">
                  <SelectValue placeholder="Élection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les élections</SelectItem>
                  {allElections.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              Utilisateurs ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Aucun utilisateur ne correspond aux critères.'
                    : isAdmin ? 'Vous n\'avez pas encore créé d\'utilisateurs.' : 'Aucun utilisateur trouvé.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    {/* Infos utilisateur */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        {u.electionTitle && (
                          <p className="text-xs text-blue-600 truncate mt-0.5">
                            Élection : {u.electionTitle}
                          </p>
                        )}
                        {u.lastLogin ? (() => {
                          const d = new Date(u.lastLogin);
                          const online = Date.now() - d.getTime() < 15 * 60 * 1000;
                          return (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                              <span className="text-xs text-gray-400">
                                {online ? 'Connecté' : `Dernière connexion : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            </div>
                          );
                        })() : (
                          <p className="text-xs text-gray-400 mt-1">Aucune connexion enregistrée</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[u.role]}`}>
                        {getRoleLabel(u.role)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">{u.isActive ? 'Actif' : 'Inactif'}</span>
                        <Switch checked={u.isActive} onCheckedChange={() => handleToggleStatus(u.id, u.isActive)} />
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Modifier">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Renvoi email de confirmation — désactivé temporairement
                        <Button variant="ghost" size="sm" onClick={() => handleResend(u.email)} title="Renvoyer l'email">
                          <Mail className="h-4 w-4" />
                        </Button>
                        */}
                        <Button
                          variant="ghost" size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { setDeletingUser(u); setShowDeleteModal(true); }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Ajout */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent
          className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-lg font-semibold text-[#1B2E5A]">
              Nouvel utilisateur
            </DialogTitle>
            <DialogDescription className="sr-only">
              Créer un nouveau compte utilisateur et lui assigner une élection, des établissements et des rôles.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {formFields}

            {/* Mot de passe */}
            <div className="relative">
              <FloatingInput
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                value={fPassword}
                onChange={e => setFPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-full sm:w-auto bg-[#1B2E5A] hover:bg-[#142347] text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {creating ? 'Création en cours…' : "Créer l'utilisateur"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Modification */}
      <Dialog open={showEditModal} onOpenChange={v => { setShowEditModal(v); if (!v) setEditingUser(null); }}>
        <DialogContent
          className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-lg font-semibold text-[#1B2E5A]">
              Modifier l'utilisateur
            </DialogTitle>
            <DialogDescription className="sr-only">
              Modifier les informations et les assignations du compte utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {formFields}

            {/* Nouveau mot de passe */}
            <div className="relative">
              <FloatingInput
                label="Nouveau mot de passe (optionnel)"
                type={showPassword ? 'text' : 'password'}
                value={fPassword}
                onChange={e => setFPassword(e.target.value)}
                autoComplete="new-password"
                helperText="Laissez vide pour ne pas modifier le mot de passe actuel"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-[22px] text-gray-400 hover:text-gray-600 z-10"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="w-full sm:w-auto bg-[#1B2E5A] hover:bg-[#142347] text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {updating ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Suppression */}
      <Dialog open={showDeleteModal} onOpenChange={v => { setShowDeleteModal(v); if (!v) setDeletingUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirmer la suppression définitive de ce compte utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Supprimer <strong>{deletingUser?.name}</strong> ({deletingUser?.email}) ?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">Cette action est irréversible. L'utilisateur perdra l'accès à la plateforme.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeletingUser(null); }}>
                Annuler
              </Button>
              <Button disabled={deleting} onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default UserManagement;
