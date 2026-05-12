/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronLeft, ChevronRight, Star, Trash2, Edit, Search, Calendar, MapPin, Users, Building, Vote, Target, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import FloatingInput from '@/components/ui/floating-input';
import FloatingTextarea from '@/components/ui/floating-textarea';
import FloatingSelect from '@/components/ui/floating-select';
import FloatingCheckbox from '@/components/ui/floating-checkbox';
import Select2, { Select2Option } from '@/components/ui/select2';
import { ModernForm, ModernFormSection, ModernFormGrid, ModernFormActions } from '@/components/ui/modern-form';
import MultiSelect from '@/components/ui/multi-select';
import ImageUploader from '@/components/ui/ImageUploader';


interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
}

interface ElectionWizardProps {
  onClose: () => void;
  onSubmit?: (election: any) => void;
  onSuccess?: () => void;
}

const ElectionWizard: React.FC<ElectionWizardProps> = ({ onClose, onSubmit, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Étape 1
    name: '',
    type: '',
    date: '',
    seatsAvailable: '',
    budget: '',
    voteGoal: '',
    
    // Étape 2
    province: '',
    commune: '',
    arrondissement: '',
    
    // Étape 3 - Candidats sélectionnés
    selectedCandidates: [] as string[],
    
    // Étape 4 - Centres sélectionnés
    selectedCenters: [] as string[],
    totalVoters: '',
    coverImage: ''
  });


  // Initialiser la date avec la date d'aujourd'hui
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
    setFormData(prev => ({ ...prev, date: prev.date || formattedDate }));
  }, []);

  // États pour les données de candidats et centres
  const [candidates, setCandidates] = useState<Array<{identifiant: string, nom: string, parti: string, est_notre_candidat: boolean}>>([]);
  const [centers, setCenters] = useState<Array<{identifiant: string, nom: string, adresse: string, total_voters: number, total_bureaux: number}>>([]);

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

  // Charger les candidats (essaie les deux conventions de tables/colonnes)
  const loadCandidates = async () => {
    try {
      console.log('🔄 Chargement des candidats...');
      // 1) Essai: table en anglais avec alias PostgREST → normaliser en champs FR attendus
      const { data, error } = await supabase
        .from('candidates')
        .select('identifiant:id, nom:name, parti:party, est_notre_candidat:is_our_candidate')
        .order('name');
      
      console.log('📊 Résultat candidats (table candidates):', { data, error });
      
      if (!error) {
        setCandidates(data || []);
        console.log('✅ Candidats chargés depuis table "candidates":', data?.length || 0);
        return;
      }
      throw error;
    } catch (_) {
      try {
        console.log('🔄 Fallback: tentative table "candidats"...');
        // 2) Fallback: table/français
        const { data, error } = await supabase
          .from('candidats')
          .select('identifiant, nom, parti, est_notre_candidat')
          .order('nom');
        
        console.log('📊 Résultat candidats (table candidats):', { data, error });
        
        if (error) throw error;
        setCandidates(data || []);
        console.log('✅ Candidats chargés depuis table "candidats":', data?.length || 0);
      } catch (error) {
        console.error('❌ Erreur lors du chargement des candidats:', error);
        setCandidates([]);
      }
    }
  };

  // Charger les centres de vote (essaie anglais puis français)
  const loadCenters = async () => {
    try {
      console.log('🔄 Chargement des centres de vote...');
      // 1) Essai: table en anglais avec alias → normaliser en champs FR
      const { data, error } = await supabase
        .from('voting_centers')
        .select('identifiant:id, nom:name, adresse:address, total_voters, total_bureaux')
        .order('name');
      
      console.log('📊 Résultat centres (table voting_centers):', { data, error });
      
      if (!error) {
        setCenters(data || []);
        console.log('✅ Centres chargés depuis table "voting_centers":', data?.length || 0);
        return;
      }
      throw error;
    } catch (_) {
      try {
        console.log('🔄 Fallback: tentative table "centres_de_vote"...');
        // 2) Fallback: table/français
        const { data, error } = await supabase
          .from('centres_de_vote')
          .select('identifiant, nom, adresse, total_voters, total_bureaux')
          .order('nom');
        
        console.log('📊 Résultat centres (table centres_de_vote):', { data, error });
        
        if (error) throw error;
        setCenters(data || []);
        console.log('✅ Centres chargés depuis table "centres_de_vote":', data?.length || 0);
      } catch (error) {
        console.error('❌ Erreur lors du chargement des centres:', error);
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
    loadCandidates();
    loadCenters();
  }, []);

  const steps = [
    'Informations Générales',
    'Circonscription Électorale',
    'Candidats',
    'Centres et Bureaux',
    'Récapitulatif'
  ];

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };


  const handleSubmit = async () => {
    if (onSubmit) {
      const selectedCandidatesData = formData.selectedCandidates.map(id => 
        candidates.find(c => c.identifiant === id)
      ).filter(Boolean);

      const selectedCentersData = formData.selectedCenters.map(id => 
        centers.find(c => c.identifiant === id)
      ).filter(Boolean);

      const totalBureaux = selectedCentersData.reduce((sum, center) => sum + (center.total_bureaux || 0), 0);
      const totalElecteurs = selectedCentersData.reduce((sum, center) => sum + (center.total_voters || 0), 0);

      const election = {
        name: formData.name,
        title: formData.name, // Doubler pour compatibilité
        type: formData.type,
        date: formData.date,
        seatsAvailable: Number(formData.seatsAvailable) || 1,
        budget: Number(formData.budget) || 0,
        voteGoal: Number(formData.voteGoal) || 0,
        province: formData.province,
        commune: formData.commune,
        arrondissement: formData.arrondissement,
        candidates: selectedCandidatesData,
        centers: selectedCentersData,
        totalCandidates: selectedCandidatesData.length,
        totalCenters: selectedCentersData.length,
        totalBureaux: totalBureaux,
        totalVoters: totalElecteurs || Number(formData.totalVoters) || 0,
        coverImage: formData.coverImage
      };

      await onSubmit(election);
      
      if (onSuccess) {
        onSuccess();
      }
    } else if (onSuccess) {
      onSuccess();
    }
  };

  const canProceed = () => {
    let canProceedResult = false;
    
    switch (currentStep) {
      case 1:
        // Vérifie que les champs requis sont remplis
        canProceedResult = formData.name.trim() !== '' && 
                         formData.type.trim() !== '' && 
                         formData.date.trim() !== '';
        console.log('Étape 1 - Peut continuer:', canProceedResult, {
          name: formData.name,
          type: formData.type,
          date: formData.date
        });
        break;
      case 2:
        // Vérifie que la province et la commune sont renseignées
        canProceedResult = formData.province.trim() !== '' && 
                         formData.commune.trim() !== '';
        console.log('Étape 2 - Peut continuer:', canProceedResult, {
          province: formData.province,
          commune: formData.commune
        });
        break;
      case 3:
        // Les candidats sont optionnels, donc on peut toujours passer à l'étape suivante
        canProceedResult = true;
        console.log('Étape 3 - Peut continuer: true (optionnel)');
        break;
      case 4:
        // Vérifie qu'au moins un centre est sélectionné
        canProceedResult = formData.selectedCenters.length > 0;
        console.log('Étape 4 - Peut continuer:', canProceedResult, {
          selectedCenters: formData.selectedCenters.length
        });
        break;
      case 5:
        // Dernière étape, toujours possible de valider
        canProceedResult = true;
        console.log('Étape 5 - Peut continuer: true (dernière étape)');
        break;
      default:
        canProceedResult = false;
        console.log('Étape inconnue - Peut continuer: false');
    }
    
    console.log(`[canProceed] Étape ${currentStep}:`, canProceedResult);
    return canProceedResult;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ModernFormSection
            title="Informations Générales"
            description="Définissez les paramètres de base de votre élection"
            icon={<Vote className="w-5 h-5" />}
          >
            <ModernFormGrid cols={2}>
              <FloatingInput
                label="Nom de l'élection"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Législatives 2023 - Siège unique Moanda"
                icon={<Building className="w-4 h-4" />}
                required
              />
              
              <FloatingSelect
                label="Type d'élection"
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: value })}
                options={[
                  { value: "Législatives", label: "Législatives" },
                  { value: "Locales", label: "Locales" }
                ]}
                icon={<Vote className="w-4 h-4" />}
                required
              />
            </ModernFormGrid>

            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Date du scrutin"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                icon={<Calendar className="w-4 h-4" />}
                required
              />
            </ModernFormGrid>

            <div className="mt-4">
              <ImageUploader 
                onUploadSuccess={(url) => setFormData({ ...formData, coverImage: url })}
                defaultValue={formData.coverImage}
              />
            </div>
          </ModernFormSection>

        );
        
      case 2:
        return (
          <ModernFormSection
            title="Circonscription Électorale"
            description="Définissez la zone géographique de votre élection"
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
                    setFormData({ ...formData, province: selectedOption.label });
                  } else {
                    setSelectedProvinceId('');
                    setFormData({ ...formData, province: '' });
                  }
                }}
              />
            </ModernFormGrid>

            <ModernFormGrid cols={2}>
              <Select2
                label="Commune / Canton / District"
                placeholder="Rechercher une commune..."
                options={communes.map(c => ({ value: c.id, label: c.name }))}
                value={communes.find(c => c.id === selectedCommuneId) ? 
                  { value: selectedCommuneId, label: communes.find(c => c.id === selectedCommuneId)?.name || '' } : null}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setSelectedCommuneId(selectedOption.value);
                    setFormData({ ...formData, commune: selectedOption.label });
                  } else {
                    setSelectedCommuneId('');
                    setFormData({ ...formData, commune: '' });
                  }
                }}
              />
              
              <Select2
                label="Arrondissement / Siège"
                placeholder="Rechercher un arrondissement..."
                options={arrondissements.map(a => ({ value: a.id, label: a.name }))}
                value={arrondissements.find(a => a.id === selectedArrondissementId) ? 
                  { value: selectedArrondissementId, label: arrondissements.find(a => a.id === selectedArrondissementId)?.name || '' } : null}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setSelectedArrondissementId(selectedOption.value);
                    setFormData({ ...formData, arrondissement: selectedOption.label });
                  } else {
                    setSelectedArrondissementId('');
                    setFormData({ ...formData, arrondissement: '' });
                  }
                }}
              />
            </ModernFormGrid>
          </ModernFormSection>
        );
        
      case 3: {
        console.log('🎯 Génération des options candidats:', { 
          candidatesCount: candidates.length, 
          candidates: candidates.slice(0, 3) // Afficher les 3 premiers pour debug
        });
        
        const candidatesOptions = candidates.map(candidate => ({
          value: candidate.identifiant,
          label: candidate.nom,
          subtitle: candidate.parti,
          metadata: { est_notre_candidat: candidate.est_notre_candidat }
        }));
        
        console.log('📋 Options candidats générées:', candidatesOptions.slice(0, 3));

        return (
          <ModernFormSection
            title={formData.type === "Locales" ? "Ajouter une liste" : "Sélection des Candidats"}
            description={formData.type === "Locales" ? "Choisissez la liste qui participera à cette élection" : "Choisissez les candidats qui participeront à cette élection"}
            icon={<Users className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <MultiSelect
                options={candidatesOptions}
                selected={formData.selectedCandidates}
                onSelectionChange={(selected) => setFormData({...formData, selectedCandidates: selected})}
                placeholder="Rechercher et sélectionner des candidats..."
                title={formData.type === "Locales" ? "Listes" : "Candidats"}
                  icon={<Users className="w-4 h-4 text-gov-blue" />}
                emptyMessage="Aucun candidat sélectionné"
                renderOption={(option) => (
                  <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors min-h-[50px]">
                    <div className="w-8 h-8 bg-gov-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-5 h-5 bg-gov-blue rounded text-white text-xs font-bold flex items-center justify-center">
                        {option.subtitle?.charAt(0) || 'P'}
                      </div>
            </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{option.label}</p>
                      <p className="text-xs text-gray-600 truncate">{option.subtitle}</p>
                      {option.metadata?.est_notre_candidat && (
                        <Badge className="bg-gov-blue text-white px-2 py-1 text-xs mt-1">
                                <Star className="w-3 h-3 mr-1" />
                          {formData.type === "Locales" ? "C'est notre liste" : "Notre Candidat"}
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
          </ModernFormSection>
        );
      }
        
      case 4: {
        console.log('🎯 Génération des options centres:', { 
          centersCount: centers.length, 
          centers: centers.slice(0, 3) // Afficher les 3 premiers pour debug
        });
        
        const centersOptions = centers.map(center => ({
          value: center.identifiant,
          label: center.nom,
          subtitle: center.adresse,
          metadata: { 
            total_voters: center.total_voters, 
            total_bureaux: center.total_bureaux 
          }
        }));
        
        console.log('📋 Options centres générées:', centersOptions.slice(0, 3));

        const selectedCentersData = formData.selectedCenters.map(id => 
          centers.find(c => c.identifiant === id)
        ).filter(Boolean);

        const totalBureaux = selectedCentersData.reduce((sum, center) => sum + (center.total_bureaux || 0), 0);
        const totalElecteurs = selectedCentersData.reduce((sum, center) => sum + (center.total_voters || 0), 0);

        return (
          <div className="space-y-6">
            <ModernFormSection
              title="Centres et Bureaux de Vote"
              description="Choisissez les centres de vote pour cette élection"
              icon={<Building className="w-5 h-5" />}
            >
          <div className="space-y-4">
                <MultiSelect
                  options={centersOptions}
                  selected={formData.selectedCenters}
                  onSelectionChange={(selected) => setFormData({...formData, selectedCenters: selected})}
                  placeholder="Rechercher et sélectionner des centres..."
                  title="Centres de Vote"
                  icon={<Building className="w-4 h-4 text-green-600" />}
                  emptyMessage="Aucun centre sélectionné"
                  renderOption={(option) => (
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors min-h-[50px]">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{option.label}</p>
                        <p className="text-xs text-gray-600 truncate">{option.subtitle}</p>
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
            </ModernFormSection>

            {/* Récapitulatif automatique */}
            {selectedCentersData.length > 0 && (
              <div className="bg-gradient-to-r from-gov-blue/5 to-green-50 rounded-xl border border-gov-blue/20 p-3 sm:p-4">
                <h5 className="font-semibold text-gov-blue mb-3 flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4" />
                  Récapitulatif Automatique
                </h5>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-lg sm:text-xl font-bold text-gov-blue">{selectedCentersData.length}</div>
                    <div className="text-xs text-gov-blue">Centres</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-lg sm:text-xl font-bold text-green-600">{totalBureaux}</div>
                    <div className="text-xs text-green-600">Bureaux</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-lg sm:text-xl font-bold text-purple-600">{totalElecteurs.toLocaleString('fr-FR')}</div>
                    <div className="text-xs text-purple-600">Électeurs</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-lg sm:text-xl font-bold text-orange-600">
                      {totalBureaux > 0 ? Math.round(totalElecteurs / totalBureaux) : 0}
                    </div>
                    <div className="text-xs text-orange-600">Électeurs/bureau</div>
                  </div>
                </div>
              </div>
            )}

            {/* Champ manuel pour les électeurs si nécessaire */}
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Nombre total de Bureaux de vote"
                type="number"
                value={totalBureaux}
                onChange={() => {}} // Lecture seule, calculé automatiquement
                placeholder="Calculé automatiquement"
                min="1"
                icon={<Building className="w-4 h-4" />}
                helperText="Calculé automatiquement à partir des centres sélectionnés"
                disabled
              />
            </ModernFormGrid>
          </div>
        );
      }
        
      case 5: {
        const selectedCandidatesData = formData.selectedCandidates.map(id => 
          candidates.find(c => c.identifiant === id)
        ).filter(Boolean);

        const selectedCentersData = formData.selectedCenters.map(id => 
          centers.find(c => c.identifiant === id)
        ).filter(Boolean);

        const totalBureaux = selectedCentersData.reduce((sum, center) => sum + (center.total_bureaux || 0), 0);
        const totalElecteurs = selectedCentersData.reduce((sum, center) => sum + (center.total_voters || 0), 0);

        return (
          <div className="space-y-6">
            <ModernFormSection
              title="Récapitulatif de l'élection"
              description="Vérifiez les informations avant de créer l'élection"
              icon={<Check className="w-5 h-5" />}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="p-4 bg-gov-blue/5 rounded-xl border border-gov-blue/20">
                    <h5 className="font-semibold text-gov-blue mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Informations Générales
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gov-blue">Nom :</span>
                        <span className="text-sm text-gov-blue">{formData.name}</span>
                  </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gov-blue">Type :</span>
                        <span className="text-sm text-gov-blue">{formData.type}</span>
                  </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gov-blue">Date :</span>
                        <span className="text-sm text-gov-blue">
                      {formData.date ? new Date(formData.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Non définie'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Circonscription
                    </h5>
                    <div className="text-sm text-green-900">
                       {formData.province} {formData.commune ? `→ ${formData.commune}` : ''} {formData.arrondissement ? `→ ${formData.arrondissement}` : ''}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Statistiques
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-purple-700">Centres :</span>
                        <span className="text-sm text-purple-900">{selectedCentersData.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-purple-700">Bureaux :</span>
                        <span className="text-sm text-purple-900">{totalBureaux}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-purple-700">Électeurs :</span>
                        <span className="text-sm text-purple-900">{(totalElecteurs || formData.totalVoters).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-purple-700">Candidats :</span>
                        <span className="text-sm text-purple-900">{selectedCandidatesData.length}</span>
                      </div>
                  </div>
                  </div>
                  </div>
                  </div>
                  
              {/* Détail des candidats sélectionnés */}
              {selectedCandidatesData.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Candidats Sélectionnés
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedCandidatesData.map(candidate => (
                      <div key={candidate.identifiant} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-gov-blue rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-3 h-3 text-white" />
                  </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 line-clamp-1">{candidate.nom}</span>
                            <span className="text-xs text-gray-500 block">{candidate.parti}</span>
                    </div>
                          {candidate.est_notre_candidat && (
                            <Badge className="bg-gov-blue text-white px-1.5 py-1 text-xs flex-shrink-0">
                              <Star className="w-2 h-2 mr-1" />
                              <span className="hidden xs:inline">Notre Candidat</span>
                              <span className="xs:hidden">Notre</span>
                            </Badge>
                  )}
                </div>
              </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Détail des centres sélectionnés */}
              {selectedCentersData.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Centres de Vote Sélectionnés
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedCentersData.map(center => (
                      <div key={center.identifiant} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 line-clamp-1">{center.nom}</span>
                            <div className="flex items-center space-x-1 mt-1">
                              <Badge variant="outline" className="text-xs">{center.total_bureaux} bureaux</Badge>
                              <Badge variant="outline" className="text-xs">{center.total_voters} électeurs</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
            </div>
            </div>
              )}
            </ModernFormSection>
          </div>
        );
      }
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 lg:p-8">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl xl:max-w-5xl max-h-[90vh] lg:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Header moderne - Compact */}
        <div className="relative bg-gradient-to-r from-gov-blue to-gov-blue-light p-3 sm:p-4 lg:p-5 text-white">
          <div className="absolute inset-0 bg-black/10 rounded-t-xl sm:rounded-t-2xl"></div>
          <div className="relative flex items-center justify-between">
          <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">Configurer une nouvelle élection</h2>
              <p className="text-gov-blue-light/80 mt-1 text-xs sm:text-sm">Étape {currentStep} sur 5 : {steps[currentStep - 1]}</p>
          </div>
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="text-white hover:bg-white/20 rounded-xl p-1.5 sm:p-2 flex-shrink-0 ml-2"
            >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          </div>
        </div>

        {/* Progress moderne - Compact */}
        <div className="px-3 sm:px-4 lg:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-center space-x-2 sm:space-x-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  index + 1 <= currentStep 
                    ? 'bg-gov-blue text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 sm:ml-3 text-xs sm:text-sm font-medium hidden sm:inline transition-colors duration-300 ${
                  index + 1 <= currentStep ? 'text-gov-blue' : 'text-gray-500'
                }`}>
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-4 sm:w-8 h-1 mx-2 sm:mx-4 rounded-full transition-all duration-300 ${
                    index + 1 < currentStep ? 'bg-gov-blue' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content avec scroll - Compact */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <ModernForm>
            {renderStep()}
          </ModernForm>
        </div>

        {/* Footer moderne - Compact */}
        <div className="bg-gray-50 border-t border-gray-200 p-3 sm:p-4 lg:p-5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
              className="flex items-center px-3 sm:px-4 py-2 rounded-xl border-2 hover:bg-gray-100 transition-all duration-300 text-xs sm:text-sm"
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Précédent</span>
            <span className="sm:hidden">Préc.</span>
          </Button>
          
            <div className="flex space-x-2 sm:space-x-3">
            {currentStep < 5 && (
              <Button
                onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex items-center px-4 sm:px-6 py-2 bg-gov-blue hover:bg-gov-blue-dark text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Suivant</span>
                <span className="sm:hidden">Suiv.</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              </Button>
            )}
            
            {currentStep === 5 && (
              <Button
                onClick={handleSubmit}
                  className="flex items-center px-6 sm:px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm"
              >
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Créer l'élection</span>
                <span className="sm:hidden">Créer</span>
              </Button>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionWizard;
