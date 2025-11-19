import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Shield,
  Eye,
  FileText,
  CheckCircle,
  Mail,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Type definitions
type UserRole = 'super-admin' | 'agent-saisie' | 'validateur' | 'observateur';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedCenter?: string;
  isActive: boolean;
  createdAt: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('observateur');
  const [newActive, setNewActive] = useState(true);

  // Charger les utilisateurs depuis Supabase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            voting_centers(name)
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erreur lors du chargement des utilisateurs:', error);
          return;
        }

        // Transformer les données Supabase en format User
        const transformedUsers: User[] = data?.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          assignedCenter: user.voting_centers?.name || user.assigned_center_id,
          isActive: user.is_active,
          createdAt: new Date(user.created_at).toISOString().split('T')[0]
        })) || [];

        setUsers(transformedUsers);
      } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'super-admin':
        return 'default';
      case 'agent-saisie':
        return 'secondary';
      case 'validateur':
        return 'outline';
      case 'observateur':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'super-admin':
        return 'Super Admin';
      case 'agent-saisie':
        return 'Agent de Saisie';
      case 'validateur':
        return 'Validateur';
      case 'observateur':
        return 'Observateur';
      default:
        return role;
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        return;
      }

      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isActive: !currentStatus } : user
      ));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    }
  };

  const resetNewUserForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('observateur');
    setNewActive(true);
  };

  const handleCreateUser = async () => {
    try {
      if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
        toast.error('Nom, email et mot de passe sont requis');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      setCreating(true);

      // Créer l'utilisateur d'auth (Supabase Auth)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          emailRedirectTo: window.location.origin + '/login'
        }
      });
      if (signUpErr) {
        console.error('Erreur signUp:', signUpErr);
        toast.error("Échec de la création de l'utilisateur (auth)");
        return;
      }
      const authUserId = signUpData.user?.id;
      if (!authUserId) {
        toast.warning("Utilisateur créé, en attente de confirmation d'email");
      }

      // Insérer dans la table applicative users
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: authUserId || crypto.randomUUID(),
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          is_active: newActive
        })
        .select()
        .single();
      if (insertErr) {
        console.error('Erreur insert users:', insertErr);
        toast.error("Échec d'enregistrement en base");
        return;
      }

      const createdUser: User = {
        id: inserted.id,
        name: inserted.name,
        email: inserted.email,
        role: inserted.role,
        assignedCenter: inserted.assigned_center_id || undefined,
        isActive: inserted.is_active,
        createdAt: new Date(inserted.created_at).toISOString().split('T')[0]
      };
      setUsers(prev => [createdUser, ...prev]);
      toast.success("Utilisateur créé avec succès");
      toast.message('Email de confirmation envoyé', { description: 'Demandez à l’utilisateur de vérifier sa boîte mail.' });
      setShowAddModal(false);
      resetNewUserForm();
    } catch (e) {
      console.error(e);
      toast.error("Erreur inattendue lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleResendConfirmation = async (email: string) => {
    try {
      if (!email) return;
      const { data, error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        console.error('Erreur resend:', error);
        toast.error("Échec d'envoi de l'email de confirmation");
        return;
      }
      toast.success('Email de confirmation renvoyé');
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'envoi");
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewName(user.name);
    setNewEmail(user.email);
    setNewRole(user.role);
    setNewActive(user.isActive);
    setNewPassword(''); // Le mot de passe reste vide, optionnel
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      if (!newName.trim() || !newEmail.trim()) {
        toast.error('Nom et email sont requis');
        return;
      }
      setUpdating(true);

      // Mettre à jour dans la table users
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          is_active: newActive
        })
        .eq('id', editingUser.id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour:', updateError);
        toast.error('Échec de la mise à jour');
        return;
      }

      // Si un nouveau mot de passe est fourni, le mettre à jour dans Auth
      if (newPassword && newPassword.length >= 6) {
        const { error: pwdError } = await supabase.auth.admin.updateUserById(
          editingUser.id,
          { password: newPassword }
        );
        if (pwdError) {
          console.warn('Erreur mise à jour mot de passe (possible si pas admin):', pwdError);
          toast.warning('Utilisateur mis à jour, mais le mot de passe n\'a pas pu être changé');
        }
      }

      // Mettre à jour l'état local
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { 
              ...u, 
              name: newName.trim(), 
              email: newEmail.trim(), 
              role: newRole, 
              isActive: newActive 
            } 
          : u
      ));

      toast.success('Utilisateur mis à jour avec succès');
      setShowEditModal(false);
      setEditingUser(null);
      resetNewUserForm();
    } catch (e) {
      console.error(e);
      toast.error('Erreur inattendue lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    try {
      setDeleting(true);

      // Supprimer de la table users
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', deletingUser.id);

      if (deleteError) {
        console.error('Erreur lors de la suppression:', deleteError);
        toast.error('Échec de la suppression');
        return;
      }

      // Supprimer de Auth (nécessite des privilèges admin)
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
          deletingUser.id
        );
        if (authDeleteError) {
          console.warn('Erreur suppression Auth (possible si pas admin):', authDeleteError);
        }
      } catch (authError) {
        console.warn('Impossible de supprimer l\'utilisateur Auth:', authError);
      }

      // Mettre à jour l'état local
      setUsers(users.filter(u => u.id !== deletingUser.id));
      
      toast.success('Utilisateur supprimé avec succès');
      setShowDeleteModal(false);
      setDeletingUser(null);
    } catch (e) {
      console.error(e);
      toast.error('Erreur inattendue lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des utilisateurs...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Gérez les comptes utilisateurs et leurs permissions
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Ajouter un utilisateur</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4 lg:pt-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Rechercher par nom ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm">
                    <SelectValue placeholder="Rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    <SelectItem value="super-admin">Super Admin</SelectItem>
                    <SelectItem value="agent-saisie">Agent de Saisie</SelectItem>
                    <SelectItem value="validateur">Validateur</SelectItem>
                    <SelectItem value="observateur">Observateur</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="inactive">Inactifs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              Utilisateurs ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucun utilisateur trouvé
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Aucun utilisateur ne correspond aux critères de recherche.'
                    : 'Commencez par ajouter votre premier utilisateur.'}
                </p>
                {(!searchTerm && roleFilter === 'all' && statusFilter === 'all') && (
                  <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un utilisateur
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-sm sm:text-base">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{user.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{user.email}</p>
                        {user.assignedCenter && (
                          <p className="text-xs text-gray-500 truncate">
                            Centre: {user.assignedCenter}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions - Mobile & Desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                      {/* Badge Role */}
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs justify-center sm:justify-start">
                        {getRoleLabel(user.role)}
                      </Badge>

                      {/* Status Toggle */}
                      <div className="flex items-center justify-between sm:justify-start gap-2 py-2 sm:py-0">
                        <span className="text-xs sm:text-sm text-gray-600">
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                        <Switch
                          checked={user.isActive}
                          onCheckedChange={() => handleToggleStatus(user.id, user.isActive)}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 sm:flex-none"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="ml-1 sm:hidden text-xs">Modifier</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 sm:flex-none"
                          onClick={() => handleResendConfirmation(user.email)} 
                          title="Renvoyer l'email de confirmation"
                        >
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="ml-1 sm:hidden text-xs">Email</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeletingUser(user);
                            setShowDeleteModal(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="ml-1 sm:hidden text-xs">Supprimer</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Ajouter un nouvel utilisateur</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="name" className="text-xs sm:text-sm">Nom complet</Label>
                  <Input id="name" placeholder="Nom complet" value={newName} onChange={(e)=>setNewName(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="password" className="text-xs sm:text-sm">Mot de passe</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="role" className="text-xs sm:text-sm">Rôle</Label>
                  <Select value={newRole} onValueChange={(v: UserRole)=>setNewRole(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                      <SelectItem value="agent-saisie">Agent de Saisie</SelectItem>
                      <SelectItem value="validateur">Validateur</SelectItem>
                      <SelectItem value="observateur">Observateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newActive} onCheckedChange={(v)=>setNewActive(!!v)} />
                  <span className="text-xs sm:text-sm text-gray-600">Actif</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto">
                    Annuler
                  </Button>
                  <Button disabled={creating} onClick={handleCreateUser} className="w-full sm:w-auto">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {creating ? 'Création...' : "Créer l'utilisateur"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit User Modal */}
        {showEditModal && (
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Modifier l'utilisateur</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="edit-name" className="text-xs sm:text-sm">Nom complet</Label>
                  <Input id="edit-name" placeholder="Nom complet" value={newName} onChange={(e)=>setNewName(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="edit-email" className="text-xs sm:text-sm">Email</Label>
                  <Input id="edit-email" type="email" placeholder="email@example.com" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="edit-password" className="text-xs sm:text-sm">Nouveau mot de passe (optionnel)</Label>
                  <Input id="edit-password" type="password" placeholder="Laissez vide pour ne pas changer" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label htmlFor="edit-role" className="text-xs sm:text-sm">Rôle</Label>
                  <Select value={newRole} onValueChange={(v: UserRole)=>setNewRole(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                      <SelectItem value="agent-saisie">Agent de Saisie</SelectItem>
                      <SelectItem value="validateur">Validateur</SelectItem>
                      <SelectItem value="observateur">Observateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newActive} onCheckedChange={(v)=>setNewActive(!!v)} />
                  <span className="text-xs sm:text-sm text-gray-600">Actif</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="w-full sm:w-auto">
                    Annuler
                  </Button>
                  <Button disabled={updating} onClick={handleUpdateUser} className="w-full sm:w-auto">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {updating ? 'Mise à jour...' : 'Mettre à jour'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingUser && (
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Confirmer la suppression
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{deletingUser.name}</strong> ({deletingUser.email}) ?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs sm:text-sm text-red-800">
                    ⚠️ Cette action est irréversible. L'utilisateur perdra l'accès à la plateforme.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setShowDeleteModal(false); setDeletingUser(null); }}
                    className="w-full sm:w-auto"
                  >
                    Annuler
                  </Button>
                  <Button 
                    disabled={deleting} 
                    onClick={handleDeleteUser}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? 'Suppression...' : 'Supprimer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default UserManagement;
