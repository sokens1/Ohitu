/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Save, Users, Plus, Trash2, User, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { ModernForm, ModernFormSection, ModernFormGrid, ModernFormActions } from '@/components/ui/modern-form';
import { cn } from '@/lib/utils';

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
  electionId?: string;
  onClose: () => void;
  onUpdate: (updatedCandidate: Candidate) => void;
}

const EditCandidateModal: React.FC<EditCandidateModalProps> = ({
  candidate,
  electionType,
  electionId,
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
  });

  const [titulaires, setTitulaires] = useState<any[]>(candidate.titulaires || []);
  const [suppleants, setSuppleants] = useState<any[]>(candidate.suppleants || []);
  const [activeTab, setActiveTab] = useState<'titulaires' | 'suppleants'>('titulaires');
  const [establishments, setEstablishments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger les établissements de vote configurés pour cette élection
  useEffect(() => {
    const fetchEstablishments = async () => {
      if (!isPro || !electionId) return;
      try {
        const { data, error } = await supabase
          .from('election_centers')
          .select(`
            voting_centers (
              name
            )
          `)
          .eq('election_id', electionId);

        if (error) throw error;

        const names = data
          ?.map((link: any) => link.voting_centers?.name)
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i) || [];

        setEstablishments(names);
      } catch (err) {
        console.error('Erreur lors du chargement des établissements:', err);
      }
    };

    fetchEstablishments();
  }, [isPro, electionId]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddCandidateRow = () => {
    const defaultEtab = establishments[0] || '';
    const newCandidate = {
      name: '',
      photo: null,
      role: activeTab === 'titulaires' ? 'Titulaire' : 'Suppléant',
      etablissement: defaultEtab,
      genre: 'Non renseigné',
      seniority: 0,
    };

    if (activeTab === 'titulaires') {
      setTitulaires((prev) => [...prev, newCandidate]);
    } else {
      setSuppleants((prev) => [...prev, newCandidate]);
    }
    toast.success('Nouveau candidat ajouté à la liste');
  };

  const handleRemoveCandidateRow = (index: number, type: 'titulaires' | 'suppleants') => {
    if (type === 'titulaires') {
      setTitulaires((prev) => prev.filter((_, i) => i !== index));
    } else {
      setSuppleants((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleFieldChange = (index: number, type: 'titulaires' | 'suppleants', field: string, value: any) => {
    if (type === 'titulaires') {
      setTitulaires((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    } else {
      setSuppleants((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPro) {
      if (!formData.name.trim()) {
        toast.error('Le nom du candidat est requis');
        return;
      }
      if (!formData.party.trim()) {
        toast.error('Le parti politique est requis');
        return;
      }
    } else {
      // Valider que tous les candidats professionnels ont un nom
      const emptyTitulaires = titulaires.some((t) => !t.name?.trim());
      const emptySuppleants = suppleants.some((s) => !s.name?.trim());
      if (emptyTitulaires || emptySuppleants) {
        toast.error('Veuillez renseigner le nom de tous les candidats ou supprimer les lignes vides');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isPro) {
        // Formater les listes de candidats avant sauvegarde
        const finalTitulaires = titulaires.map((t, idx) => ({
          ...t,
          name: t.name.trim(),
          role: idx === 0 ? 'Tête de liste' : (t.role || 'Titulaire'),
          etablissement: t.etablissement || null,
          genre: t.genre === 'Non renseigné' ? null : t.genre,
          seniority: t.seniority ? Number(t.seniority) : 0,
        }));

        const finalSuppleants = suppleants.map((s) => ({
          ...s,
          name: s.name.trim(),
          role: s.role || 'Suppléant',
          etablissement: s.etablissement || null,
          genre: s.genre === 'Non renseigné' ? null : s.genre,
          seniority: s.seniority ? Number(s.seniority) : 0,
        }));

        // Mettre à jour la base de données
        const { error } = await supabase
          .from('union_lists')
          .update({
            college: formData.college,
            titulaires: finalTitulaires,
            suppleants: finalSuppleants,
          })
          .eq('id', candidate.id);

        if (error) throw error;

        // Préparer l'objet mis à jour pour le parent
        const updatedCandidate: Candidate = {
          ...candidate,
          college: formData.college,
          titulaires: finalTitulaires,
          suppleants: finalSuppleants,
        };

        onUpdate(updatedCandidate);
        toast.success('Liste syndicale mise à jour avec succès');
      } else {
        // Enregistrer le candidat politique
        const { error } = await supabase
          .from('candidates')
          .update({
            name: formData.name.trim(),
            party: formData.party.trim(),
            is_our_candidate: formData.isOurCandidate,
            photo_url: formData.photo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.id);

        if (error) throw error;

        const updatedCandidate: Candidate = {
          ...candidate,
          name: formData.name.trim(),
          party: formData.party.trim(),
          isOurCandidate: formData.isOurCandidate,
          photo: formData.photo,
        };

        onUpdate(updatedCandidate);
        toast.success('Candidat mis à jour avec succès');
      }
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGenreOptions = () => [
    { value: 'Non renseigné', label: 'Non renseigné' },
    { value: 'H', label: 'Homme' },
    { value: 'F', label: 'Femme' },
  ];

  const getEtablissementOptions = () => {
    const list = establishments.map((name) => ({ value: name, label: name }));
    if (list.length === 0) {
      return [{ value: 'Mouila - Siège', label: 'Mouila - Siège' }];
    }
    return list;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto p-4 sm:p-6 transition-all duration-300", isPro ? "max-w-4xl" : "max-w-xl")}>
        <DialogHeader className="pb-4 sm:pb-6 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <span>{isPro ? `Gérer la Liste Syndicale - ${formData.party}` : 'Modifier le Candidat'}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-500 mt-1 text-sm">
            {isPro
              ? `Gérez le collège électoral ainsi que l'ensemble des candidats titulaires et suppléants de la liste syndicale ${formData.name}.`
              : "Modifiez les informations de base du candidat sélectionné."}
          </DialogDescription>
        </DialogHeader>

        <ModernForm onSubmit={handleSubmit} className="mt-4">
          {isPro ? (
            <div className="space-y-6">
              {/* Paramètres de base de la liste syndicale */}
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/50 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Syndicat sélectionné</p>
                  <h4 className="text-base font-black text-gray-900 mt-0.5">{formData.name}</h4>
                  <p className="text-xs text-gray-500">Sigle : {formData.party}</p>
                </div>
                <div>
                  <FloatingSelect
                    label="Collège électoral"
                    value={formData.college}
                    onChange={(val) => handleInputChange('college', val)}
                    options={[
                      { value: 'general', label: 'Encadrement' },
                      { value: 'cadres', label: 'Cadre' },
                      { value: 'employes', label: 'Maîtrise' },
                      { value: 'ouvriers', label: 'Exécution' },
                    ]}
                  />
                </div>
              </div>

              {/* Navigation des Onglets de Candidats */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('titulaires')}
                  className={cn(
                    'flex-1 py-3 text-sm font-black border-b-2 transition-all flex items-center justify-center gap-2 outline-none',
                    activeTab === 'titulaires'
                      ? 'border-purple-600 text-purple-600 bg-purple-50/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  )}
                >
                  👥 Titulaires ({titulaires.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('suppleants')}
                  className={cn(
                    'flex-1 py-3 text-sm font-black border-b-2 transition-all flex items-center justify-center gap-2 outline-none',
                    activeTab === 'suppleants'
                      ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  )}
                >
                  👥 Suppléants ({suppleants.length})
                </button>
              </div>

              {/* Contenu de l'onglet actif */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {activeTab === 'titulaires' ? (
                  titulaires.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl">
                      Aucun candidat titulaire sur cette liste.
                    </div>
                  ) : (
                    titulaires.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group hover:border-purple-200 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded-lg">
                            {idx === 0 ? 'Tête de Liste' : `Titulaire #${idx + 1}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCandidateRow(idx, 'titulaires')}
                            className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <FloatingInput
                              label="Nom complet *"
                              value={item.name}
                              onChange={(e) => handleFieldChange(idx, 'titulaires', 'name', e.target.value)}
                              icon={<User className="h-4 w-4" />}
                              placeholder="Ex: Jean ABASSI"
                              required
                            />
                          </div>
                          <div>
                            <FloatingSelect
                              label="Établissement / Site"
                              value={item.etablissement || establishments[0] || 'Mouila - Siège'}
                              onChange={(val) => handleFieldChange(idx, 'titulaires', 'etablissement', val)}
                              options={getEtablissementOptions()}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <FloatingSelect
                              label="Genre"
                              value={item.genre || 'Non renseigné'}
                              onChange={(val) => handleFieldChange(idx, 'titulaires', 'genre', val)}
                              options={getGenreOptions()}
                            />
                            <FloatingInput
                              label="Ancienneté"
                              type="number"
                              value={item.seniority ?? 0}
                              onChange={(e) => handleFieldChange(idx, 'titulaires', 'seniority', e.target.value)}
                              icon={<Calendar className="h-4 w-4" />}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : suppleants.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl">
                    Aucun candidat suppléant sur cette liste.
                  </div>
                ) : (
                  suppleants.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg">
                          Suppléant #{idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCandidateRow(idx, 'suppleants')}
                          className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <FloatingInput
                            label="Nom complet *"
                            value={item.name}
                            onChange={(e) => handleFieldChange(idx, 'suppleants', 'name', e.target.value)}
                            icon={<User className="h-4 w-4" />}
                            placeholder="Ex: Paul MOUTSINGA"
                            required
                          />
                        </div>
                        <div>
                          <FloatingSelect
                            label="Établissement / Site"
                            value={item.etablissement || establishments[0] || 'Mouila - Siège'}
                            onChange={(val) => handleFieldChange(idx, 'suppleants', 'etablissement', val)}
                            options={getEtablissementOptions()}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <FloatingSelect
                            label="Genre"
                            value={item.genre || 'Non renseigné'}
                            onChange={(val) => handleFieldChange(idx, 'suppleants', 'genre', val)}
                            options={getGenreOptions()}
                          />
                          <FloatingInput
                            label="Ancienneté"
                            type="number"
                            value={item.seniority ?? 0}
                            onChange={(e) => handleFieldChange(idx, 'suppleants', 'seniority', e.target.value)}
                            icon={<Calendar className="h-4 w-4" />}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bouton d'ajout d'une nouvelle ligne */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddCandidateRow}
                className="w-full py-6 border-dashed border-2 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/10 flex items-center justify-center gap-2 rounded-xl transition-all font-bold"
              >
                <Plus className="h-5 w-5" />
                <span>Ajouter un candidat {activeTab === 'titulaires' ? 'titulaire' : 'suppléant'}</span>
              </Button>
            </div>
          ) : (
            // Formulaire standard d'élection politique
            <ModernFormSection
              title="Informations du Candidat"
              description="Modifiez les paramètres du candidat sélectionné"
              icon={<Users className="w-5 h-5" />}
            >
              <ModernFormGrid cols={2}>
                <FloatingInput
                  label="Nom complet"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  icon={<User className="h-4 w-4" />}
                  required
                />

                <FloatingInput
                  label="Parti politique"
                  value={formData.party}
                  onChange={(e) => handleInputChange('party', e.target.value)}
                  placeholder="Ex: PDG, UDB, Indépendant"
                  icon={<MapPin className="h-4 w-4" />}
                  required
                />
              </ModernFormGrid>

              <div className="space-y-2 mt-4">
                <Label className="text-xs text-gray-600 font-semibold">URL de la photo</Label>
                <FloatingInput
                  label="URL de l'image de profil"
                  value={formData.photo}
                  onChange={(e) => handleInputChange('photo', e.target.value)}
                  placeholder="Ex: https://image.com/photo.png"
                  icon={<User className="h-4 w-4" />}
                />
              </div>

              <div className="flex items-center space-x-2 p-4 bg-purple-50/50 rounded-lg border border-purple-100/50 mt-4">
                <input
                  type="checkbox"
                  id="isOurCandidate"
                  checked={formData.isOurCandidate}
                  onChange={(e) => handleInputChange('isOurCandidate', e.target.checked)}
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <Label
                  htmlFor="isOurCandidate"
                  className="text-sm font-medium text-purple-900 cursor-pointer"
                >
                  Notre candidat (soutenu officiellement par l'organisation)
                </Label>
              </div>
            </ModernFormSection>
          )}

          <ModernFormActions className="mt-6 border-t border-gray-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 sm:px-6 py-2 rounded-xl border-2 hover:bg-gray-100 transition-all duration-300 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-1.5"
            >
              <X className="h-4 w-4" />
              <span>Annuler</span>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-4 sm:px-8 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
            </Button>
          </ModernFormActions>
        </ModernForm>
      </DialogContent>
    </Dialog>
  );
};

export default EditCandidateModal;
