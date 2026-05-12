/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Building, Plus, Search, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ModernForm, ModernFormSection, ModernFormActions, ModernFormGrid } from '@/components/ui/modern-form';
import MultiSelect from '@/components/ui/multi-select';
import FloatingInput from '@/components/ui/floating-input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Center {
  id: string;
  name: string;
  address: string;
  responsable: string;
  contact: string;
  bureaux: number;
  voters: number;
}

interface AddCenterModalProps {
  onClose: () => void;
  onSubmit: (centers: Center[]) => void;
  electionId?: string;
  enterpriseId?: string;
  electionType?: string;
}

const AddCenterModal: React.FC<AddCenterModalProps> = ({ onClose, onSubmit, electionId, enterpriseId, electionType }) => {
  console.log('AddCenterModal - electionType:', electionType);
  const isPro = electionType?.trim() === 'Élection Professionnelle';
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [centers, setCenters] = useState<Array<{id: string, name: string, address: string, total_voters: number, total_bureaux: number}>>([]);
  const [loading, setLoading] = useState(true);
  
  // State for new site creation
  const [newSite, setNewSite] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    total_voters: 0,
    total_bureaux: 1
  });

  // Charger les centres disponibles
  useEffect(() => {
    const loadCenters = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('voting_centers')
          .select('id, name, address, total_voters, total_bureaux');
          
        if (isPro) {
          // Si pro, on ne montre que les sites de l'entreprise
          // Si enterpriseId est manquant, on force un filtre qui ne retourne rien
          query = query.eq('enterprise_id', enterpriseId || '00000000-0000-0000-0000-000000000000');
        } else {
          // Si politique, on ne montre que les centres publics (enterprise_id is null)
          query = query.is('enterprise_id', null);
        }

        let { data, error } = await query.order('name');

        if (error && (error.code === 'PGRST116' || error.code === 'PGRST205')) {
          // Table 'voting_centers' n'existe pas, essayer 'centres_de_vote'
          let fallbackQuery = supabase
            .from('centres_de_vote')
            .select('id, nom, adresse, total_voters, total_bureaux');
          
          if (isPro) {
            fallbackQuery = fallbackQuery.eq('enterprise_id', enterpriseId || '00000000-0000-0000-0000-000000000000');
          } else {
            fallbackQuery = fallbackQuery.is('enterprise_id', null);
          }

          const result = await fallbackQuery.order('nom');
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Erreur lors du chargement des centres:', error);
          // Don't toast error if it's just no data for pro
          if (!isPro) toast.error('Erreur lors du chargement des centres');
          setCenters([]);
          return;
        }

        console.log(`📊 ${data?.length || 0} centres chargés pour l'entreprise ${enterpriseId}`);
        const transformedCenters = (data || []).map((center: any) => ({
          id: center.id,
          name: center.name || center.nom || '',
          address: center.address || center.adresse || '',
          totalVoters: center.total_voters || 0,
          totalBureaux: center.total_bureaux || 0
        }));

        setCenters(transformedCenters);
        
        // If pro and we have existing sites, allow selection mode
        if (isPro && transformedCenters.length > 0) {
          setMode('select');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des centres:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCenters();
  }, [isPro, enterpriseId]);

  const handleSubmitSelect = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCenters.length > 0) {
      const centersToAdd = centers
        .filter(c => selectedCenters.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          responsable: '',
          contact: '',
          bureaux: c.total_bureaux || 0,
          voters: c.total_voters || 0
        }));
      onSubmit(centersToAdd);
    } else {
      toast.error('Veuillez sélectionner au moins un centre');
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.name) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voting_centers')
        .insert({
          name: newSite.name,
          address: newSite.address,
          contact_name: newSite.contact_name,
          contact_phone: newSite.contact_phone,
          total_voters: newSite.total_voters,
          total_bureaux: newSite.total_bureaux,
          enterprise_id: enterpriseId
        })
        .select()
        .single();

      if (error) throw error;

      // Créer le lien avec l'élection
      if (electionId) {
        await supabase.from('election_centers').insert({
          election_id: electionId,
          center_id: data.id
        });
      }

      const createdCenter: Center = {
        id: data.id,
        name: data.name,
        address: data.address || '',
        responsable: data.contact_name || '',
        contact: data.contact_phone || '',
        bureaux: data.total_bureaux || 0,
        voters: data.total_voters || 0
      };

      // Refresh lists
      let query = supabase.from('voting_centers').select('*');
      if (isPro) query = query.eq('enterprise_id', enterpriseId);
      const { data: updatedCenters } = await query.order('name');
      
      const transformed = (updatedCenters || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.nom || '',
        address: c.address || c.adresse || '',
        totalVoters: c.total_voters || 0,
        totalBureaux: c.total_bureaux || 0
      }));
      setCenters(transformed);
      
      // Auto-select
      setSelectedCenters(prev => [...prev, data.id]);
      
      // Reset and switch mode
      setNewSite({
        name: '',
        address: '',
        contact_name: '',
        contact_phone: '',
        total_voters: 0,
        total_bureaux: 1
      });
      setMode('select');
      
      toast.success('Site créé avec succès. Vous pouvez maintenant le sélectionner dans la liste.');
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-0">
        <DialogHeader className="pb-4 sm:pb-6">
          <DialogTitle className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-tight">
                {isPro ? 'Gestion des Établissements' : 'Sélection des Centres de Vote'}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {isPro ? 'Gérez les sites physiques de l\'entreprise' : 'Choisissez les centres de vote pour cette élection'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isPro && (
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit mx-auto">
              <Button 
                variant={mode === 'select' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setMode('select')}
                className="text-xs"
              >
                <Search className="w-3 h-3 mr-1" /> Sélectionner
              </Button>
              <Button 
                variant={mode === 'create' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setMode('create')}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Créer Nouveau
              </Button>
            </div>
          )}

          {mode === 'select' ? (
            <form onSubmit={handleSubmitSelect} className="space-y-6">
              <MultiSelect
                options={(centers || []).map(c => ({
                  value: c.id,
                  label: c.name,
                  subtitle: c.address
                }))}
                selected={selectedCenters}
                onSelectionChange={setSelectedCenters}
                placeholder={isPro ? "Sélectionnez des sites..." : "Sélectionnez des centres..."}
                title={isPro ? "Sites" : "Centres"}
                icon={<Building className="w-4 h-4 sm:w-5 sm:h-5 text-[#1e40af]" />}
                searchable={true}
                emptyMessage={isPro ? "Aucun site trouvé pour cette entreprise. Utilisez l'onglet 'Créer Nouveau' pour en ajouter un." : "Aucun centre trouvé."}
                className="w-full"
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button 
                  type="submit" 
                  className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white" 
                  disabled={selectedCenters.length === 0}
                >
                  Ajouter {selectedCenters.length} {isPro ? 'site' : 'centre'}{selectedCenters.length > 1 ? 's' : ''}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateSite} className="space-y-6">
              <ModernFormGrid columns={2}>
                <FloatingInput
                  label="Nom de l'établissement"
                  icon={<Building className="w-4 h-4" />}
                  value={newSite.name}
                  onChange={(e) => setNewSite({...newSite, name: e.target.value})}
                  required
                />
                <FloatingInput
                  label="Localisation / Ville"
                  icon={<MapPin className="w-4 h-4" />}
                  value={newSite.address}
                  onChange={(e) => setNewSite({...newSite, address: e.target.value})}
                />
                <FloatingInput
                  label="Responsable du site"
                  value={newSite.contact_name}
                  onChange={(e) => setNewSite({...newSite, contact_name: e.target.value})}
                />
                <FloatingInput
                  label="Contact téléphone"
                  value={newSite.contact_phone}
                  onChange={(e) => setNewSite({...newSite, contact_phone: e.target.value})}
                />
                <FloatingInput
                  label="Nombre d'électeurs sur site"
                  type="number"
                  value={newSite.total_voters}
                  onChange={(e) => setNewSite({...newSite, total_voters: parseInt(e.target.value)})}
                />
                <FloatingInput
                  label="Nombre de bureaux (urnes)"
                  type="number"
                  value={newSite.total_bureaux}
                  onChange={(e) => setNewSite({...newSite, total_bureaux: parseInt(e.target.value)})}
                />
              </ModernFormGrid>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                  {loading ? 'Création...' : 'Créer et Ajouter'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCenterModal;
