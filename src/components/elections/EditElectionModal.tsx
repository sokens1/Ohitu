/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Election } from '@/types/elections';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Select2, { Select2Option } from '@/components/ui/select2';
import { X, Save, Calendar, MapPin, Users, Building, Vote, Target, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import FloatingInput from '@/components/ui/floating-input';
import FloatingTextarea from '@/components/ui/floating-textarea';
import FloatingSelect from '@/components/ui/floating-select';
import { ModernForm, ModernFormSection, ModernFormGrid, ModernFormActions } from '@/components/ui/modern-form';
import MultiSelect from '@/components/ui/multi-select';
import ImageUploader from '@/components/ui/ImageUploader';


interface EditElectionModalProps {
  election: Election;
  onClose: () => void;
  onUpdate: (updatedData: Partial<Election>) => void;
}

const EditElectionModal: React.FC<EditElectionModalProps> = ({
  election,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = useState({
    title: election.title,
    type: election.type,
    status: election.status,
    date: election.date.toISOString().split('T')[0],
    description: election.description || '',
    province: election.location.province,
    commune: election.location.commune,
    arrondissement: election.location.arrondissement,
    seatsAvailable: election.configuration.seatsAvailable || '',
    budget: election.configuration.budget || '',
    voteGoal: election.configuration.voteGoal || '',
    nbElecteurs: election.statistics.totalVoters || '',
    selectedCandidates: [] as string[],
    selectedCenters: [] as string[],
    coverImage: (election as any).cover_image || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États pour les données de localisation
  const [provinces, setProvinces] = useState<Array<{id: string, name: string}>>([]);
  // const [departments, setDepartments] = useState<Array<{id: string, name: string}>>([]);
  const [communes, setCommunes] = useState<Array<{id: string, name: string}>>([]);
  const [arrondissements, setArrondissements] = useState<Array<{id: string, name: string}>>([]);
  
  // États pour les IDs sélectionnés
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  // const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCommuneId, setSelectedCommuneId] = useState<string>('');
  const [selectedArrondissementId, setSelectedArrondissementId] = useState<string>('');

  // États pour les données de candidats et centres
  const [candidates, setCandidates] = useState<Array<{identifiant: string, nom: string, parti: string, est_notre_candidat: boolean}>>([]);
  const [centers, setCenters] = useState<Array<{identifiant: string, nom: string, adresse: string, total_voters: number, total_bureaux: number}>>([]);

  // Charger les provinces
  const loadProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('provinces')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setProvinces(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des provinces:', error);
    }
  };

  // Charger les départements
  // const loadDepartments = async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('departments')
  //       .select('id, name')
  //       .order('name');
      
  //     if (error) throw error;
  //     setDepartments(data || []);
  //   } catch (error) {
  //     console.error('Erreur lors du chargement des départements:', error);
  //   }
  // };

  // Charger les communes
  const loadCommunes = async () => {
    try {
      const { data, error } = await supabase
        .from('communes')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setCommunes(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des communes:', error);
    }
  };

  // Charger les arrondissements
  const loadArrondissements = async () => {
    try {
      const { data, error } = await supabase
        .from('arrondissements')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setArrondissements(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des arrondissements:', error);
    }
  };

  // Charger les candidats (politiques ou syndicaux selon le type)
  const loadCandidates = async () => {
    try {
      if (formData.type === 'Élection Professionnelle') {
        const { data, error } = await supabase
          .from('unions')
          .select('identifiant:id, nom:name, acronym')
          .order('name');
        
        if (error) throw error;
        
        // Formater les syndicats pour qu'ils ressemblent à des candidats
        const formattedUnions = (data || []).map(u => ({
          identifiant: u.identifiant,
          nom: u.acronym ? `${u.acronym} - ${u.nom}` : u.nom,
          parti: u.acronym || 'Syndicat',
          est_notre_candidat: false
        }));
        setCandidates(formattedUnions);
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .select('identifiant:id, nom:name, parti:party, est_notre_candidat:is_our_candidate')
          .order('name');
        if (!error) {
          setCandidates(data || []);
          return;
        }
        throw error;
      }
    } catch (_) {
      // Fallback si la table 'candidates' n'existe pas (cas de 'candidats')
      if (formData.type !== 'Élection Professionnelle') {
        try {
          const { data, error } = await supabase
            .from('candidats')
            .select('identifiant, nom, parti, est_notre_candidat')
            .order('nom');
          if (error) throw error;
          setCandidates(data || []);
        } catch (error) {
          console.error('Erreur lors du chargement des candidats:', error);
          setCandidates([]);
        }
      }
    }
  };


  // Charger les centres de vote (essaie EN puis FR)
  const loadCenters = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_centers')
        .select('identifiant:id, nom:name, adresse:address, total_voters, total_bureaux')
        .order('name');
      if (!error) {
        setCenters(data || []);
        return;
      }
      throw error;
    } catch (_) {
      try {
        const { data, error } = await supabase
          .from('centres_de_vote')
          .select('identifiant, nom, adresse, total_voters, total_bureaux')
          .order('nom');
        if (error) throw error;
        setCenters(data || []);
      } catch (error) {
        console.error('Erreur lors du chargement des centres:', error);
        setCenters([]);
      }
    }
  };

  // Charger toutes les données
  useEffect(() => {
    loadProvinces();
    // loadDepartments();
    loadCommunes();
    loadArrondissements();
    loadCenters();
  }, []);

  // Recharger les candidats quand le type change
  useEffect(() => {
    loadCandidates();
  }, [formData.type]);


  // Pré-sélectionner candidats et centres liés à l'élection (via tables de jonction)
  useEffect(() => {
    const loadLinkedSelections = async () => {
      try {
        const [{ data: ec, error: ecError }, { data: ez, error: ezError }] = await Promise.all([
          supabase.from('election_candidates').select('candidate_id').eq('election_id', election.id),
          supabase.from('election_centers').select('center_id').eq('election_id', election.id)
        ]);

        if (!ecError && ec) {
          const candidateIds = ec.map((r: any) => r.candidate_id as string);
          setFormData(prev => ({ ...prev, selectedCandidates: candidateIds }));
        }

        if (!ezError && ez) {
          const centerIds = ez.map((r: any) => r.center_id as string);
          setFormData(prev => ({ ...prev, selectedCenters: centerIds }));
        }
      } catch (error) {
        console.error('Erreur lors du chargement des liaisons candidats/centres:', error);
      }
    };

    loadLinkedSelections();
  }, [election.id]);

  // Initialiser les IDs sélectionnés avec les valeurs actuelles
  useEffect(() => {
    if (provinces.length > 0) {
      const currentProvince = provinces.find(p => p.name === formData.province);
      if (currentProvince) setSelectedProvinceId(currentProvince.id);
    }
  }, [provinces, formData.province]);

  // useEffect(() => {
  //   if (departments.length > 0) {
  //     const currentDepartment = departments.find(d => d.name === formData.department);
  //     if (currentDepartment) setSelectedDepartmentId(currentDepartment.id);
  //   }
  // }, [departments, formData.department]);

  useEffect(() => {
    if (communes.length > 0) {
      const currentCommune = communes.find(c => c.name === formData.commune);
      if (currentCommune) setSelectedCommuneId(currentCommune.id);
    }
  }, [communes, formData.commune]);

  useEffect(() => {
    if (arrondissements.length > 0) {
      const currentArrondissement = arrondissements.find(a => a.name === formData.arrondissement);
      if (currentArrondissement) setSelectedArrondissementId(currentArrondissement.id);
    }
  }, [arrondissements, formData.arrondissement]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Fonction pour mettre à jour les liens candidats/centres
  const updateElectionLinks = async (electionId: string, candidateIds: string[], centerIds: string[]) => {
    try {
      console.log('updateElectionLinks appelé avec:', { electionId, candidateIds, centerIds });
      
      // Supprimer les anciens liens
      console.log('Suppression des anciens liens...');
      const { error: deleteCandidatesError } = await supabase
        .from('election_candidates')
        .delete()
        .eq('election_id', electionId);

      if (deleteCandidatesError) {
        console.error('Erreur lors de la suppression des candidats:', deleteCandidatesError);
        throw deleteCandidatesError;
      }

      const { error: deleteCentersError } = await supabase
        .from('election_centers')
        .delete()
        .eq('election_id', electionId);

      if (deleteCentersError) {
        console.error('Erreur lors de la suppression des centres:', deleteCentersError);
        throw deleteCentersError;
      }

      console.log('Anciens liens supprimés avec succès');

      // Créer les nouveaux liens candidats
      const uniqueCandidateIds = Array.from(new Set(candidateIds));
      if (uniqueCandidateIds.length > 0) {
        const candidateLinks = uniqueCandidateIds.map(candidateId => ({
          election_id: electionId,
          candidate_id: candidateId,
          is_our_candidate: false // Par défaut, sera mis à jour si nécessaire
        }));

        console.log('Insertion des nouveaux liens candidats:', candidateLinks);

        const { data: candidateData, error: candidateError } = await supabase
          .from('election_candidates')
          .insert(candidateLinks)
          .select();

        if (candidateError) {
          console.error('Erreur lors de l\'insertion des candidats:', candidateError);
          throw candidateError;
        }

        console.log('Candidats insérés avec succès:', candidateData);
      } else {
        console.log('Aucun candidat à insérer');
      }

      // Créer les nouveaux liens centres
      const uniqueCenterIds = Array.from(new Set(centerIds));
      if (uniqueCenterIds.length > 0) {
        const centerLinks = uniqueCenterIds.map(centerId => ({
          election_id: electionId,
          center_id: centerId
        }));

        console.log('Insertion des nouveaux liens centres:', centerLinks);

        const { data: centerData, error: centerError } = await supabase
          .from('election_centers')
          .insert(centerLinks)
          .select();

        if (centerError) {
          console.error('Erreur lors de l\'insertion des centres:', centerError);
          throw centerError;
        }

        console.log('Centres insérés avec succès:', centerData);
      } else {
        console.log('Aucun centre à insérer');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des liens:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Le titre de l\'élection est requis');
      return;
    }

    if (!formData.type) {
      toast.error('Le type d\'élection est requis');
      return;
    }

    if (!formData.date) {
      toast.error('La date de l\'élection est requise');
      return;
    }

    if (new Date(formData.date) < new Date()) {
      toast.error('La date de l\'élection ne peut pas être dans le passé');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedData: Partial<Election> = {
        title: formData.title.trim(),
        type: formData.type as 'Législatives' | 'Locales',
        status: formData.status as 'À venir' | 'En cours' | 'Terminée' | 'Annulée',
        date: new Date(formData.date),
        description: formData.description.trim(),
        location: {
          province: formData.province,
          commune: formData.commune,
          arrondissement: formData.arrondissement,
          fullAddress: `${formData.commune}, ${formData.province}`,
        },
        configuration: {
          seatsAvailable: Number(formData.seatsAvailable) || 1,
          budget: Number(formData.budget) || 0,
          voteGoal: Number(formData.voteGoal) || 0,
          allowMultipleCandidates: election.configuration.allowMultipleCandidates,
          requirePhotoValidation: election.configuration.requirePhotoValidation,
        },
        statistics: {
          ...election.statistics,
          // Utiliser la valeur calculée automatiquement depuis la base de données
          totalVoters: election.statistics.totalVoters || 0,
        },
        cover_image: (formData as any).coverImage || (formData as any).cover_image,
      };

      // Mettre à jour les liens candidats/centres
      console.log('Données de sélection avant mise à jour des liens:', {
        selectedCandidates: formData.selectedCandidates,
        selectedCenters: formData.selectedCenters
      });
      
      await updateElectionLinks(election.id, formData.selectedCandidates, formData.selectedCenters);

      await onUpdate(updatedData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl xl:max-w-5xl max-h-[90vh] lg:max-h-[85vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
        <DialogHeader className="pb-4 sm:pb-6 lg:pb-8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gov-blue/10 rounded-lg">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-gov-blue" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                Modification de l'élection
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Modifiez les informations de l'élection sélectionnée. Les champs marqués d'un astérisque (*) sont obligatoires.
              </DialogDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-gray-500 hover:bg-gray-100 -mr-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <ModernForm onSubmit={handleSubmit}>
          {/* Informations générales */}
          <ModernFormSection
            title="Informations Générales"
            description="Modifiez les paramètres de base de l'élection"
            icon={<Vote className="w-5 h-5" />}
          >
            <ModernFormGrid cols={2}>
              <FloatingInput
                label="Titre de l'élection"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Ex: Élections Locales 2025"
                icon={<Building className="w-4 h-4 sm:w-5 sm:h-5" />}
                required
              />
              
              <FloatingSelect
                label="Type d'élection"
                value={formData.type}
                onChange={(value) => handleInputChange('type', value)}
                options={[
                  { value: "Législatives", label: "Législatives" },
                  { value: "Locales", label: "Locales" },
                  { value: "Élection Professionnelle", label: "Professionnelle" },
                ]}
                icon={<Vote className="w-4 h-4 sm:w-5 sm:h-5" />}
                required
              />
            </ModernFormGrid>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Image de couverture</label>
              <ImageUploader 
                onUploadSuccess={(url) => setFormData({ ...formData, coverImage: url } as any)}
                defaultValue={(election as any).cover_image || (election as any).coverImage}
              />
            </div>

            <ModernFormGrid cols={2}>
              <FloatingInput
                label="Date de l'élection"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                icon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
                required
              />
              
              <FloatingSelect
                label="Statut"
                value={formData.status}
                onChange={(value) => handleInputChange('status', value)}
                options={[
                  { value: "À venir", label: "À venir" },
                  { value: "En cours", label: "En cours" },
                  { value: "Terminée", label: "Terminée" },
                  { value: "Annulée", label: "Annulée" }
                ]}
                icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
              />
            </ModernFormGrid>

            <ModernFormGrid cols={1}>
              <FloatingTextarea
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Description de l'élection..."
                rows={3}
                icon={<Building className="w-4 h-4 sm:w-5 sm:h-5" />}
                // helperText="Décrivez les objectifs et le contexte de cette élection"
              />
            </ModernFormGrid>
          </ModernFormSection>

          {/* Localisation */}
          <ModernFormSection
            title="Circonscription Électorale"
            description="Modifiez la zone géographique de l'élection"
            icon={<MapPin className="w-5 h-5" />}
          >
            <ModernFormGrid cols={1}>
              <Select2
                label="Province"
                placeholder="Rechercher une province..."
                options={provinces.map(p => ({ value: p.id, label: p.name }))}
                value={provinces.find(p => p.id === selectedProvinceId) ? 
                  { value: selectedProvinceId, label: provinces.find(p => p.id === selectedProvinceId)?.name || '' } : null}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setSelectedProvinceId(selectedOption.value);
                    handleInputChange('province', selectedOption.label);
                  } else {
                    setSelectedProvinceId('');
                    handleInputChange('province', '');
                  }
                }}
              />
            </ModernFormGrid>

            <ModernFormGrid cols={2}>
              <Select2
                label="Commune"
                placeholder="Rechercher une commune..."
                options={communes.map(c => ({ value: c.id, label: c.name }))}
                value={communes.find(c => c.id === selectedCommuneId) ? 
                  { value: selectedCommuneId, label: communes.find(c => c.id === selectedCommuneId)?.name || '' } : null}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setSelectedCommuneId(selectedOption.value);
                    handleInputChange('commune', selectedOption.label);
                  } else {
                    setSelectedCommuneId('');
                    handleInputChange('commune', '');
                  }
                }}
              />
              
              <Select2
                label="Arrondissement"
                placeholder="Rechercher un arrondissement..."
                options={arrondissements.map(a => ({ value: a.id, label: a.name }))}
                value={arrondissements.find(a => a.id === selectedArrondissementId) ? 
                  { value: selectedArrondissementId, label: arrondissements.find(a => a.id === selectedArrondissementId)?.name || '' } : null}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setSelectedArrondissementId(selectedOption.value);
                    handleInputChange('arrondissement', selectedOption.label);
                  } else {
                    setSelectedArrondissementId('');
                    handleInputChange('arrondissement', '');
                  }
                }}
              />
            </ModernFormGrid>
          </ModernFormSection>

          {/* Configuration */}
          <ModernFormSection
            title="Configuration"
            description="Modifiez les paramètres de configuration de l'élection"
            icon={<Building className="w-5 h-5" />}
          >
            <ModernFormGrid cols={2}>
              <FloatingInput
                label="Sièges disponibles"
                type="number"
                min="1"
                value={formData.seatsAvailable}
                onChange={(e) => handleInputChange('seatsAvailable', parseInt(e.target.value))}
                icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
                // helperText="Nombre de sièges à pourvoir"
              />
              
              <FloatingInput
                label="Nombre d'électeurs"
                type="number"
                min="0"
                value={formData.nbElecteurs}
                onChange={(e) => handleInputChange('nbElecteurs', parseInt(e.target.value))}
                placeholder="Ex: 50000"
                icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
                // helperText="Nombre total d'électeurs inscrits"
              />
            </ModernFormGrid>

            <ModernFormGrid cols={2}>
              <FloatingInput
                label="Budget (FCFA)"
                type="number"
                min="0"
                value={formData.budget}
                onChange={(e) => handleInputChange('budget', parseInt(e.target.value))}
                icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
                // helperText="Budget alloué en francs CFA"
              />
              
              <FloatingInput
                label="Objectif de voix"
                type="number"
                min="0"
                value={formData.voteGoal}
                onChange={(e) => handleInputChange('voteGoal', parseInt(e.target.value))}
                icon={<Vote className="w-4 h-4 sm:w-5 sm:h-5" />}
                // helperText="Nombre de voix visées"
              />
            </ModernFormGrid>
          </ModernFormSection>

          {/* Configuration Électorale */}
          <ModernFormSection
            title="Configuration Électorale"
            description="Sélectionnez les candidats et centres de vote pour cette élection"
            icon={<Users className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Sélection des candidats */}
              <div className="space-y-4">
                <MultiSelect
                  options={candidates.map(candidate => ({
                    value: candidate.identifiant,
                    label: candidate.nom,
                    subtitle: candidate.parti,
                    metadata: { est_notre_candidat: candidate.est_notre_candidat }
                  }))}
                  selected={formData.selectedCandidates}
                  onSelectionChange={(selected) => setFormData({...formData, selectedCandidates: selected})}
                  placeholder="Rechercher et sélectionner des candidats..."
                  title="Candidats"
                  icon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-gov-blue" />}
                  emptyMessage="Aucun candidat sélectionné"
                  renderOption={(option) => (
                    <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors min-h-[60px]">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gov-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-gov-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{option.label}</p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{option.subtitle}</p>
                        {option.metadata?.est_notre_candidat && (
                          <Badge className="bg-gov-blue text-white px-2 py-1 text-xs mt-1">
                            <Star className="w-3 h-3 mr-1" />
                            Notre Candidat
                          </Badge>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Checkbox
                          checked={formData.selectedCandidates.includes(option.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (!formData.selectedCandidates.includes(option.value)) {
                                setFormData({
                                  ...formData,
                                  selectedCandidates: [...formData.selectedCandidates, option.value]
                                });
                              }
                            } else {
                              setFormData({
                                ...formData,
                                selectedCandidates: formData.selectedCandidates.filter(id => id !== option.value)
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                />
              </div>

              {/* Sélection des centres */}
              <div className="space-y-4">
                <MultiSelect
                  options={centers.map(center => ({
                    value: center.identifiant,
                    label: center.nom,
                    subtitle: center.adresse,
                    metadata: { 
                      total_voters: center.total_voters, 
                      total_bureaux: center.total_bureaux 
                    }
                  }))}
                  selected={formData.selectedCenters}
                  onSelectionChange={(selected) => setFormData({...formData, selectedCenters: selected})}
                  placeholder="Rechercher et sélectionner des centres..."
                  title="Centres de Vote"
                  icon={<Building className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />}
                  emptyMessage="Aucun centre sélectionné"
                  renderOption={(option) => (
                    <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors min-h-[60px]">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{option.label}</p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{option.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {option.metadata?.total_bureaux || 0} bureaux
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {option.metadata?.total_voters || 0} électeurs
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Checkbox
                          checked={formData.selectedCenters.includes(option.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (!formData.selectedCenters.includes(option.value)) {
                                setFormData({
                                  ...formData,
                                  selectedCenters: [...formData.selectedCenters, option.value]
                                });
                              }
                            } else {
                              setFormData({
                                ...formData,
                                selectedCenters: formData.selectedCenters.filter(id => id !== option.value)
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Récapitulatif automatique */}
            {(() => {
              const selectedCandidatesData = formData.selectedCandidates.map(id => 
                candidates.find(c => c.identifiant === id)
              ).filter(Boolean);

              const selectedCentersData = formData.selectedCenters.map(id => 
                centers.find(c => c.identifiant === id)
              ).filter(Boolean);

              const totalBureaux = selectedCentersData.reduce((sum, center) => sum + (center.total_bureaux || 0), 0);
              const totalElecteurs = selectedCentersData.reduce((sum, center) => sum + (center.total_voters || 0), 0);

              return (
                <div className="mt-6 lg:mt-8 p-4 sm:p-6 lg:p-8 bg-gradient-to-r from-gov-blue/5 to-green-50 rounded-xl border border-gov-blue/20">
                  <h5 className="font-semibold text-gov-blue mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base lg:text-lg">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                    Récapitulatif Automatique
                  </h5>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gov-blue">{selectedCandidatesData.length}</div>
                      <div className="text-xs sm:text-sm text-gov-blue">Candidats</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{selectedCentersData.length}</div>
                      <div className="text-xs sm:text-sm text-green-600">Centres</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">{totalBureaux}</div>
                      <div className="text-xs sm:text-sm text-purple-600">Bureaux</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">{totalElecteurs.toLocaleString('fr-FR')}</div>
                      <div className="text-xs sm:text-sm text-orange-600">Électeurs</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </ModernFormSection>

          {/* Actions - Responsive */}
          <ModernFormActions>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 rounded-xl border-2 hover:bg-gray-100 transition-all duration-300 text-sm sm:text-base lg:text-lg w-full sm:w-auto"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">Annuler</span>
              <span className="sm:hidden">Annuler</span>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-6 sm:px-8 lg:px-12 py-2 sm:py-3 lg:py-4 bg-gov-blue hover:bg-gov-blue-dark text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 text-sm sm:text-base lg:text-lg w-full sm:w-auto"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">{isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
              <span className="sm:hidden">{isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}</span>
            </Button>
          </ModernFormActions>
        </ModernForm>
      </DialogContent>
    </Dialog>
);
};

export default EditElectionModal;
