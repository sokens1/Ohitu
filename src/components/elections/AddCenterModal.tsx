/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Building, Plus, Search, MapPin, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ModernForm, ModernFormSection, ModernFormActions, ModernFormGrid } from '@/components/ui/modern-form';
import { Card } from '@/components/ui/card';
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

interface CollegeData {
  siege: number;
  electeurs: number;
}

interface Bureau {
  id: string;
  name: string;
  college: 'general' | 'cadres' | 'employes' | 'ouvriers';
}

interface ProSiteFormData {
  region: string;
  name: string;
  responsable: string;
  contact_phone: string;
  lieu_vote: string;
  colleges: {
    encadrement: CollegeData;
    cadre: CollegeData;
    maitrise: CollegeData;
    execution: CollegeData;
  };
  bureaux: Bureau[];
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

  // State for new site creation - SIMPLIFIED FOR ELECTION TYPE
  const [newSiteSimple, setNewSiteSimple] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    total_voters: 0,
    total_bureaux: 1
  });

  // State for professional election site creation
  const [newProSite, setNewProSite] = useState<ProSiteFormData>({
    region: '',
    name: '',
    responsable: '',
    contact_phone: '',
    lieu_vote: '',
    colleges: {
      encadrement: { siege: 0, electeurs: 0 },
      cadre: { siege: 0, electeurs: 0 },
      maitrise: { siege: 0, electeurs: 0 },
      execution: { siege: 0, electeurs: 0 }
    },
    bureaux: []
  });

  // State for adding new bureaux
  const [newBureau, setNewBureau] = useState({ name: '', college: 'general' as const });

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

  const handleCreateSiteSimple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteSimple.name) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voting_centers')
        .insert({
          name: newSiteSimple.name,
          address: newSiteSimple.address,
          contact_name: newSiteSimple.contact_name,
          contact_phone: newSiteSimple.contact_phone,
          total_voters: newSiteSimple.total_voters,
          total_bureaux: newSiteSimple.total_bureaux,
          enterprise_id: enterpriseId
        })
        .select()
        .single();

      if (error) throw error;

      if (electionId) {
        await supabase.from('election_centers').insert({
          election_id: electionId,
          center_id: data.id
        });
      }

      const query = supabase.from('voting_centers').select('*');
      const { data: updatedCenters } = await query.order('name');

      const transformed = (updatedCenters || []).map((c: any) => ({
        id: c.id,
        name: c.name || '',
        address: c.address || '',
        totalVoters: c.total_voters || 0,
        totalBureaux: c.total_bureaux || 0
      }));
      setCenters(transformed);
      setSelectedCenters(prev => [...prev, data.id]);

      setNewSiteSimple({
        name: '',
        address: '',
        contact_name: '',
        contact_phone: '',
        total_voters: 0,
        total_bureaux: 1
      });
      setMode('select');

      toast.success('Centre créé avec succès');
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProSite.name || !newProSite.region) {
      toast.error('Nom et région sont requis');
      return;
    }

    try {
      setLoading(true);

      // Calculer totaux
      const totalSeats = Object.values(newProSite.colleges).reduce((sum, c) => sum + c.siege, 0);
      const totalVoters = Object.values(newProSite.colleges).reduce((sum, c) => sum + c.electeurs, 0);

      // Déterminer le nombre de bureaux
      let totalBureaux = 0;
      if (newProSite.bureaux.length > 0) {
        totalBureaux = newProSite.bureaux.length;
      } else {
        // Compter les collèges qui ont des sièges
        const collegesWithSeats = Object.values(newProSite.colleges).filter(c => c.siege > 0).length;
        totalBureaux = collegesWithSeats > 0 ? collegesWithSeats : 4;
      }

      const { data, error } = await supabase
        .from('voting_centers')
        .insert({
          name: newProSite.name,
          address: newProSite.region,
          contact_name: newProSite.responsable,
          contact_phone: newProSite.contact_phone,
          total_voters: totalVoters,
          total_bureaux: totalBureaux,
          enterprise_id: enterpriseId
        })
        .select()
        .single();

      if (error) throw error;

      if (electionId) {
        await supabase.from('election_centers').insert({
          election_id: electionId,
          center_id: data.id
        });

        // Créer les bureaux: soit les bureaux manuels, soit les bureaux générés des collèges
        let bureauxToCreate: any[] = [];

        if (newProSite.bureaux.length > 0) {
          // Utiliser les bureaux manuels
          bureauxToCreate = newProSite.bureaux.map(bureau => ({
            center_id: data.id,
            election_id: electionId,
            name: bureau.name,
            registered_voters: 0,
            seats_to_fill: 0,
            college: 'general',
            president_name: 'N/A',
            president_phone: '000000000'
          }));
        } else {
          // Auto-générer les bureaux à partir des collèges
          const colleges = [
            { name: 'College - Encadrement', college: 'general', ...newProSite.colleges.encadrement },
            { name: 'College - Cadre', college: 'cadres', ...newProSite.colleges.cadre },
            { name: 'College - Maîtrise', college: 'employes', ...newProSite.colleges.maitrise },
            { name: 'College - Exécution', college: 'ouvriers', ...newProSite.colleges.execution }
          ];

          bureauxToCreate = colleges
            .filter(college => college.siege > 0)
            .map(college => ({
              center_id: data.id,
              election_id: electionId,
              name: college.name,
              registered_voters: college.electeurs,
              seats_to_fill: college.siege,
              college: college.college,
              president_name: 'N/A',
              president_phone: '000000000'
            }));
        }

        // Insérer tous les bureaux
        for (const bureau of bureauxToCreate) {
          await supabase.from('voting_bureaux').insert(bureau);
        }
      }

      const query = supabase.from('voting_centers').select('*');
      const { data: updatedCenters } = await query.order('name');

      const transformed = (updatedCenters || []).map((c: any) => ({
        id: c.id,
        name: c.name || '',
        address: c.address || '',
        totalVoters: c.total_voters || 0,
        totalBureaux: c.total_bureaux || 0
      }));
      setCenters(transformed);
      setSelectedCenters(prev => [...prev, data.id]);

      setNewProSite({
        region: '',
        name: '',
        responsable: '',
        contact_phone: '',
        lieu_vote: '',
        colleges: {
          encadrement: { siege: 0, electeurs: 0 },
          cadre: { siege: 0, electeurs: 0 },
          maitrise: { siege: 0, electeurs: 0 },
          execution: { siege: 0, electeurs: 0 }
        },
        bureaux: []
      });
      setNewBureau({ name: '', college: 'general' });
      setMode('select');

      toast.success('Établissement créé avec succès');
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
          ) : isPro ? (
            // Formulaire professionnel avec collèges
            <form onSubmit={handleCreateProSite} className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                <p className="text-sm text-blue-800">📋 Remplissez les informations de l'établissement et les données par collège</p>
              </div>

              <ModernFormGrid cols={2}>
                <FloatingInput
                  label="Région / Localisation"
                  icon={<MapPin className="w-4 h-4" />}
                  value={newProSite.region}
                  onChange={(e) => setNewProSite({...newProSite, region: e.target.value})}
                  required
                />
                <FloatingInput
                  label="Nom de l'établissement"
                  icon={<Building className="w-4 h-4" />}
                  value={newProSite.name}
                  onChange={(e) => setNewProSite({...newProSite, name: e.target.value})}
                  required
                />
                <FloatingInput
                  label="Responsable"
                  value={newProSite.responsable}
                  onChange={(e) => setNewProSite({...newProSite, responsable: e.target.value})}
                />
                <FloatingInput
                  label="Contact téléphone"
                  value={newProSite.contact_phone}
                  onChange={(e) => setNewProSite({...newProSite, contact_phone: e.target.value})}
                />
              </ModernFormGrid>

              {/* Collèges */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Collèges & Électeurs
                </h4>

                {[
                  { key: 'encadrement', label: 'Encadrement' },
                  { key: 'cadre', label: 'Cadre' },
                  { key: 'maitrise', label: 'Maîtrise' },
                  { key: 'execution', label: 'Exécution' }
                ].map(college => (
                  <Card key={college.key} className="p-4 border border-gray-200">
                    <h5 className="font-medium text-gray-800 mb-3">{college.label}</h5>
                    <ModernFormGrid cols={2}>
                      <FloatingInput
                        label="Sièges à pourvoir"
                        type="number"
                        value={newProSite.colleges[college.key as keyof typeof newProSite.colleges].siege}
                        onChange={(e) => setNewProSite({
                          ...newProSite,
                          colleges: {
                            ...newProSite.colleges,
                            [college.key]: {
                              ...newProSite.colleges[college.key as keyof typeof newProSite.colleges],
                              siege: parseInt(e.target.value) || 0
                            }
                          }
                        })}
                      />
                      <FloatingInput
                        label="Électeurs"
                        type="number"
                        value={newProSite.colleges[college.key as keyof typeof newProSite.colleges].electeurs}
                        onChange={(e) => setNewProSite({
                          ...newProSite,
                          colleges: {
                            ...newProSite.colleges,
                            [college.key]: {
                              ...newProSite.colleges[college.key as keyof typeof newProSite.colleges],
                              electeurs: parseInt(e.target.value) || 0
                            }
                          }
                        })}
                      />
                    </ModernFormGrid>
                  </Card>
                ))}
              </div>

              {/* Bureaux Physiques */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Building className="w-4 h-4" /> Bureaux Physiques
                  </h4>
                  <span className="text-sm text-gray-600">{newProSite.bureaux.length} bureau{newProSite.bureaux.length !== 1 ? 'x' : ''}</span>
                </div>

                {newProSite.bureaux.length > 0 && (
                  <div className="space-y-2">
                    {newProSite.bureaux.map((bureau, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{bureau.name}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewProSite({
                              ...newProSite,
                              bureaux: newProSite.bureaux.filter((_, i) => i !== index)
                            });
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Card className="p-4 border border-gray-200">
                  <h5 className="font-medium text-gray-800 mb-3">Ajouter un bureau</h5>
                  <div className="space-y-3">
                    <FloatingInput
                      label="Nom du bureau"
                      value={newBureau.name}
                      onChange={(e) => setNewBureau({...newBureau, name: e.target.value})}
                      placeholder="Bureau n°1, Bureau A, etc."
                    />
                    <Button
                      type="button"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (newBureau.name.trim()) {
                          setNewProSite({
                            ...newProSite,
                            bureaux: [...newProSite.bureaux, { id: Math.random().toString(), name: newBureau.name, college: 'general' }]
                          });
                          setNewBureau({ name: '', college: 'general' });
                        } else {
                          toast.error('Le nom du bureau est requis');
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Ajouter le bureau
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                  {loading ? 'Création...' : 'Créer et Ajouter'}
                </Button>
              </div>
            </form>
          ) : (
            // Formulaire simple pour élections politiques
            <form onSubmit={handleCreateSiteSimple} className="space-y-6">
              <ModernFormGrid cols={2}>
                <FloatingInput
                  label="Nom du centre"
                  icon={<Building className="w-4 h-4" />}
                  value={newSiteSimple.name}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, name: e.target.value})}
                  required
                />
                <FloatingInput
                  label="Adresse"
                  icon={<MapPin className="w-4 h-4" />}
                  value={newSiteSimple.address}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, address: e.target.value})}
                />
                <FloatingInput
                  label="Responsable"
                  value={newSiteSimple.contact_name}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, contact_name: e.target.value})}
                />
                <FloatingInput
                  label="Contact téléphone"
                  value={newSiteSimple.contact_phone}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, contact_phone: e.target.value})}
                />
                <FloatingInput
                  label="Nombre d'électeurs"
                  type="number"
                  value={newSiteSimple.total_voters}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, total_voters: parseInt(e.target.value) || 0})}
                />
                <FloatingInput
                  label="Nombre de bureaux"
                  type="number"
                  value={newSiteSimple.total_bureaux}
                  onChange={(e) => setNewSiteSimple({...newSiteSimple, total_bureaux: parseInt(e.target.value) || 1})}
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
