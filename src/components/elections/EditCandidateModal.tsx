/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Save, Users, Star, Building } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { ModernForm, ModernFormSection, ModernFormGrid, ModernFormActions } from '@/components/ui/modern-form';

interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
  college?: string;
  titulaires?: any[];
  suppleants?: any[];
}

interface EditCandidateModalProps {
  candidate: Candidate;
  electionType?: string;
  onClose: () => void;
  onUpdate: (updatedCandidate: Candidate) => void;
}

const EditCandidateModal: React.FC<EditCandidateModalProps> = ({
  candidate,
  electionType,
  onClose,
  onUpdate,
}) => {
  const isPro = electionType?.trim() === 'Élection Professionnelle';

  const [formData, setFormData] = useState({
    name: candidate.name,
    party: candidate.party,
    isOurCandidate: candidate.isOurCandidate,
    photo: candidate.photo || '',
    college: candidate.college || 'general',
    teteDeListeName: candidate.titulaires?.[0]?.name || '',
    teteDeListePhoto: candidate.titulaires?.[0]?.photo || '',
    suppleantName: candidate.suppleants?.[0]?.name || '',
    suppleantPhoto: candidate.suppleants?.[0]?.photo || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isPro) {
      if (!formData.teteDeListeName.trim()) {
        toast.error('Le nom du représentant principal (tête de liste) est requis');
        return;
      }
      if (!formData.suppleantName.trim()) {
        toast.error('Le nom du suppléant est requis');
        return;
      }
    } else {
      if (!formData.name.trim()) {
        toast.error('Le nom du candidat est requis');
        return;
      }
      if (!formData.party.trim()) {
        toast.error('Le parti politique est requis');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isPro) {
        // Mettre à jour union_lists
        const { error } = await supabase
          .from('union_lists')
          .update({
            college: formData.college,
            titulaires: [{ name: formData.teteDeListeName.trim(), photo: formData.teteDeListePhoto.trim() || null, role: 'Tête de liste' }],
            suppleants: [{ name: formData.suppleantName.trim(), photo: formData.suppleantPhoto.trim() || null, role: 'Suppléant' }]
          })
          .eq('id', candidate.id);

        if (error) {
          console.error('Erreur lors de la mise à jour de la liste syndicale:', error);
          toast.error('Erreur lors de la mise à jour de la liste');
          return;
        }

        const updatedCandidate: Candidate = {
          ...candidate,
          college: formData.college,
          titulaires: [{ name: formData.teteDeListeName.trim(), photo: formData.teteDeListePhoto.trim(), role: 'Tête de liste' }],
          suppleants: [{ name: formData.suppleantName.trim(), photo: formData.suppleantPhoto.trim(), role: 'Suppléant' }]
        };

        onUpdate(updatedCandidate);
        toast.success('Liste syndicale modifiée avec succès');
      } else {
        // Mettre à jour le candidat politique dans la base de données
        const { error } = await supabase
          .from('candidates')
          .update({
            name: formData.name.trim(),
            party: formData.party.trim(),
            is_our_candidate: formData.isOurCandidate,
            photo_url: formData.photo.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.id);

        if (error) {
          console.error('Erreur lors de la mise à jour du candidat:', error);
          toast.error('Erreur lors de la mise à jour du candidat');
          return;
        }

        // Mettre à jour l'objet candidate local
        const updatedCandidate: Candidate = {
          ...candidate,
          name: formData.name.trim(),
          party: formData.party.trim(),
          isOurCandidate: formData.isOurCandidate,
          photo: formData.photo.trim(),
        };

        onUpdate(updatedCandidate);
        toast.success('Candidat modifié avec succès');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-4 sm:pb-6">
          <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <span>{isPro ? 'Modifier la Liste Syndicale' : 'Modifier le Candidat'}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2 text-sm sm:text-base">
            {isPro 
              ? 'Modifiez le collège électoral et les représentants de la liste syndicale.' 
              : 'Modifiez les informations du candidat sélectionné. Les champs marqués d\'un astérisque (*) sont obligatoires.'}
          </DialogDescription>
        </DialogHeader>

        <ModernForm onSubmit={handleSubmit}>
          <ModernFormSection
            title={isPro ? 'Paramètres de la Liste' : 'Informations du Candidat'}
            description={isPro ? 'Déterminez le collège et les candidats représentatifs' : 'Modifiez les paramètres de base du candidat'}
            icon={<Users className="w-5 h-5" />}
          >
            {isPro ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-800 border border-purple-100">
                  Syndicat : <strong>{formData.name}</strong> ({formData.party})
                </div>
                
                <FloatingSelect
                  label="Collège électoral"
                  value={formData.college}
                  onChange={(val) => handleInputChange('college', val)}
                  options={[
                    { value: 'general', label: 'Collège Unique / Général' },
                    { value: 'cadres', label: 'Cadres' },
                    { value: 'employes', label: 'Employés' },
                    { value: 'ouvriers', label: 'Ouvriers' }
                  ]}
                />

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700">Représentants de la liste</h4>
                  <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Tête de liste (Titulaire)</p>
                        <FloatingInput
                          label="Nom complet *"
                          value={formData.teteDeListeName}
                          onChange={(e) => handleInputChange('teteDeListeName', e.target.value)}
                          required
                        />
                        <FloatingInput
                          label="URL de la photo (Optionnelle)"
                          value={formData.teteDeListePhoto}
                          onChange={(e) => handleInputChange('teteDeListePhoto', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Suppléant</p>
                        <FloatingInput
                          label="Nom complet *"
                          value={formData.suppleantName}
                          onChange={(e) => handleInputChange('suppleantName', e.target.value)}
                          required
                        />
                        <FloatingInput
                          label="URL de la photo (Optionnelle)"
                          value={formData.suppleantPhoto}
                          onChange={(e) => handleInputChange('suppleantPhoto', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <ModernFormGrid cols={2}>
                  <FloatingInput
                    label="Nom complet"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Jean Dupont"
                    icon={<Users className="w-4 h-4" />}
                    required
                  />
                  
                  <FloatingInput
                    label="Parti politique"
                    value={formData.party}
                    onChange={(e) => handleInputChange('party', e.target.value)}
                    placeholder="Ex: PDG, UDB, Indépendant"
                    icon={<Building className="w-4 h-4" />}
                    required
                  />
                </ModernFormGrid>

                <div className="flex items-center space-x-2 p-4 bg-purple-50 rounded-lg border border-purple-200 mt-4">
                  <Checkbox
                    id="isOurCandidate"
                    checked={formData.isOurCandidate}
                    onCheckedChange={(checked) => handleInputChange('isOurCandidate', checked as boolean)}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <Label 
                    htmlFor="isOurCandidate" 
                    className="text-sm font-medium text-purple-900 cursor-pointer flex items-center gap-2"
                  >
                    <Star className="w-4 h-4 text-purple-600" />
                    Notre candidat (candidat soutenu par notre organisation)
                  </Label>
                </div>
              </>
            )}
          </ModernFormSection>

          <ModernFormActions>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded-xl border-2 hover:bg-gray-100 transition-all duration-300 text-sm sm:text-base w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-1 sm:mr-2" />
              <span>Annuler</span>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-4 sm:px-8 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-1 sm:mr-2" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
            </Button>
          </ModernFormActions>
        </ModernForm>
      </DialogContent>
    </Dialog>
  );
};

export default EditCandidateModal;
