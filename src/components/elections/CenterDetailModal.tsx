
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Plus, Edit, Trash2, Building, Users, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import EditBureauModal from './EditBureauModal';
import { useRBAC } from '@/hooks/useRBAC';

interface Center {
  id: string;
  name: string;
  address: string;
  responsable: string;
  contact: string;
  bureaux: number;
  voters: number;
}

interface Bureau {
  id: string;
  name: string;
  center_id: string;
  registered_voters: number;
  president_name: string;
  president_phone: string;
  urns_count: number;
}

interface CenterDetailModalProps {
  center: Center;
  onClose: () => void;
}

const CenterDetailModal: React.FC<CenterDetailModalProps> = ({ center, onClose }) => {
  const { can } = useRBAC();
  const canManage = can('elections:manage');

  const [showAddBureau, setShowAddBureau] = useState(false);
  const [showEditBureau, setShowEditBureau] = useState(false);
  const [selectedBureau, setSelectedBureau] = useState<Bureau | null>(null);
  const [bureaux, setBureaux] = useState<Bureau[]>([]);
  const [loading, setLoading] = useState(true);

  const [newBureau, setNewBureau] = useState({
    name: '',
    registered_voters: 0
  });

  // Charger les bureaux depuis Supabase
  useEffect(() => {
    const fetchBureaux = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('voting_bureaux')
          .select('id, name, center_id, registered_voters, president_name, president_phone, urns_count')
          .eq('center_id', center.id)
          .order('name', { ascending: true });

        if (error) {
          console.error('Erreur lors du chargement des bureaux:', error);
          toast.error('Erreur lors du chargement des bureaux');
          return;
        }

        setBureaux(data || []);
      } catch (error) {
        console.error('Erreur lors du chargement des bureaux:', error);
        toast.error('Erreur lors du chargement des bureaux');
      } finally {
        setLoading(false);
      }
    };

    fetchBureaux();
  }, [center.id]);

  const handleAddBureau = async () => {
    if (!newBureau.name.trim()) {
      toast.error('Le nom du bureau est requis');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('voting_bureaux')
        .insert({
          name: newBureau.name.trim(),
          center_id: center.id,
          registered_voters: 0, // Initialisé à 0, les vrais inscrits sont gérés dans les PV
          president_name: 'N/A',
          president_phone: '000000000',
          urns_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de l\'ajout du bureau:', error);
        toast.error(`Erreur lors de l'ajout du bureau: ${error.message}`);
        return;
      }

      setBureaux([...bureaux, data]);
      setNewBureau({ name: '', registered_voters: 0 });
      setShowAddBureau(false);
      toast.success('Bureau ajouté avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du bureau:', error);
      toast.error('Erreur lors de l\'ajout du bureau');
    }
  };

  // Fonctions CRUD pour les bureaux
  const handleEditBureau = (bureau: Bureau) => {
    setSelectedBureau(bureau);
    setShowEditBureau(true);
  };

  const handleUpdateBureau = (updatedBureau: Bureau) => {
    setBureaux(bureaux.map(b => b.id === updatedBureau.id ? updatedBureau : b));
    setShowEditBureau(false);
    setSelectedBureau(null);
  };

  const handleDeleteBureau = async (bureauId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bureau ?')) {
      try {
        const { error } = await supabase
          .from('voting_bureaux')
          .delete()
          .eq('id', bureauId);

        if (error) {
          console.error('Erreur lors de la suppression du bureau:', error);
          toast.error('Erreur lors de la suppression du bureau');
          return;
        }

        setBureaux(bureaux.filter(b => b.id !== bureauId));
        toast.success('Bureau supprimé avec succès');
      } catch (error) {
        console.error('Erreur lors de la suppression du bureau:', error);
        toast.error('Erreur lors de la suppression du bureau');
      }
    }
  };

  const handleRemoveBureau = async (id: string) => {
    try {
      const { error } = await supabase
        .from('voting_bureaux')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erreur lors de la suppression du bureau:', error);
        toast.error('Erreur lors de la suppression du bureau');
        return;
      }

      setBureaux(bureaux.filter(b => b.id !== id));
      toast.success('Bureau supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression du bureau:', error);
      toast.error('Erreur lors de la suppression du bureau');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden border border-gray-100">
        {/* Header moderne */}
        <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Building className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Détails du Centre de Vote</h2>
                <p className="text-blue-100 text-xs sm:text-sm">{center.name}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-auto max-h-[calc(95vh-120px)] space-y-6">
          {/* Informations du centre - Design moderne */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building className="w-4 h-4 text-[#1e40af]" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">{center.name}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-100 rounded-md">
                    <Building className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Adresse</span>
                </div>
                <p className="text-gray-900 text-sm font-medium break-words">{center.address}</p>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-purple-100 rounded-md">
                    <Users className="w-3 h-3 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Responsable</span>
                </div>
                <p className="text-gray-900 text-sm font-medium">{center.responsable}</p>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-orange-100 rounded-md">
                    <Phone className="w-3 h-3 text-orange-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Contact</span>
                </div>
                <p className="text-gray-900 text-sm font-medium">{center.contact}</p>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <Users className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Électeurs</span>
                </div>
                <p className="text-[#1e40af] font-bold text-lg">{center.voters.toLocaleString('fr-FR')}</p>
              </div>
            </div>
          </div>

          {/* Section Bureaux de Vote - Design moderne */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header de la section */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 sm:px-6 py-4 border-b border-green-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Bureaux de Vote</h3>
                    <p className="text-green-700 text-sm">{bureaux.length} bureau{bureaux.length > 1 ? 'x' : ''} configuré{bureaux.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                {canManage && (
                <Button
                  onClick={() => setShowAddBureau(true)}
                  className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="font-medium">Ajouter un bureau</span>
                </Button>
                )}
              </div>
            </div>

            {/* Formulaire d'ajout - Design moderne */}
            {showAddBureau && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 border-b border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-500 rounded-md">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Nouveau Bureau de Vote</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bureauName" className="text-sm font-medium text-gray-700">
                      Nom du Bureau *
                    </Label>
                    <Input
                      id="bureauName"
                      value={newBureau.name}
                      onChange={(e) => setNewBureau({ ...newBureau, name: e.target.value })}
                      placeholder="Ex: Bureau 05"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bureauVoters" className="text-sm font-medium text-gray-700">
                      Nombre d'électeurs inscrits
                    </Label>
                    <Input
                      id="bureauVoters"
                      type="number"
                      min="0"
                      value={newBureau.registered_voters}
                      onChange={(e) => setNewBureau({ ...newBureau, registered_voters: parseInt(e.target.value) || 0 })}
                      placeholder="350"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
                
                {/* Boutons d'action - Design moderne */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button 
                    onClick={handleAddBureau} 
                    disabled={!newBureau.name.trim()} 
                    className="flex-1 sm:flex-none bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter le bureau
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddBureau(false)} 
                    className="flex-1 sm:flex-none border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 px-6 py-2 rounded-lg transition-all duration-300 font-medium"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Tableau des bureaux - Design moderne */}
            <div className="overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Chargement des bureaux...</p>
                </div>
              ) : bureaux.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Building className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun bureau configuré</h3>
                  <p className="text-gray-600 mb-4">Commencez par ajouter un bureau de vote à ce centre.</p>
                  {canManage && (
                  <Button
                    onClick={() => setShowAddBureau(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter le premier bureau
                  </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-sm font-semibold text-gray-700 py-4 px-6">Nom du Bureau</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 py-4 px-6">Électeurs Inscrits</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 py-4 px-6 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bureaux.map((bureau, index) => (
                        <TableRow 
                          key={bureau.id} 
                          className={`hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                          }`}
                        >
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <Building className="w-4 h-4 text-green-600" />
                              </div>
                              <span className="font-medium text-gray-900">{bureau.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-100 rounded-md">
                                <Users className="w-3 h-3 text-blue-600" />
                              </div>
                              <span className="font-semibold text-[#1e40af]">
                                {(bureau.registered_voters || 0).toLocaleString('fr-FR')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditBureau(bureau)}
                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-300 transition-all duration-200"
                                title="Modifier ce bureau"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              )}
                              {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteBureau(bureau.id)}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 transition-all duration-200"
                                title="Supprimer ce bureau"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Résumé - Design moderne */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-4 border-t border-blue-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Résumé des Bureaux</h4>
                    <p className="text-sm text-gray-600">Total des électeurs inscrits</p>
                  </div>
                </div>
                <div className="text-right">
                <div className="text-2xl sm:text-3xl font-bold text-[#1e40af]">
                  {bureaux.reduce((sum, bureau) => sum + (bureau.registered_voters || 0), 0).toLocaleString('fr-FR')}
                </div>
                  <p className="text-sm text-gray-600">électeurs inscrits</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale d'édition des bureaux */}
      {showEditBureau && selectedBureau && (
        <EditBureauModal
          bureau={selectedBureau}
          centerId={center.id}
          onClose={() => {
            setShowEditBureau(false);
            setSelectedBureau(null);
          }}
          onUpdate={handleUpdateBureau}
        />
      )}
    </div>
  );
};

export default CenterDetailModal;
