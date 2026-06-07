/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Save, Users, Star, Building, Upload } from 'lucide-react';
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
  unionLogo?: string | null;
  unionId?: string | null;
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
    teteDeListeGenre: candidate.titulaires?.[0]?.genre || '',
    teteDeListeAge: candidate.titulaires?.[0]?.age?.toString() || '',
    teteDeListeAnciennete: candidate.titulaires?.[0]?.anciennete?.toString() || '',
    teteDeListeEtablissement: candidate.titulaires?.[0]?.etablissement || '',
    suppleantName: candidate.suppleants?.[0]?.name || '',
    suppleantPhoto: candidate.suppleants?.[0]?.photo || '',
    suppleantGenre: candidate.suppleants?.[0]?.genre || '',
    suppleantAge: candidate.suppleants?.[0]?.age?.toString() || '',
    suppleantAnciennete: candidate.suppleants?.[0]?.anciennete?.toString() || '',
  });

  const [files, setFiles] = useState<{
    political: { file: File | null; preview: string };
    tete: { file: File | null; preview: string };
    suppleant: { file: File | null; preview: string };
    logo: { file: File | null; preview: string };
  }>({
    political: { file: null, preview: candidate.photo || '' },
    tete: { file: null, preview: candidate.titulaires?.[0]?.photo || '' },
    suppleant: { file: null, preview: candidate.suppleants?.[0]?.photo || '' },
    logo: { file: null, preview: candidate.unionLogo || '' },
  });

  const politicalFileInputRef = useRef<HTMLInputElement>(null);
  const teteFileInputRef = useRef<HTMLInputElement>(null);
  const suppleantFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'political' | 'tete' | 'suppleant' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFiles(prev => ({
          ...prev,
          [type]: { file, preview: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const bucket = 'avatars';
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (uploadErr) {
      if (uploadErr.message.includes('bucket not found')) {
        await supabase.storage.createBucket(bucket, { public: true });
        const { data: retryData, error: retryErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: '3600', upsert: true });
        if (retryErr) throw retryErr;
        const { data } = supabase.storage.from(bucket).getPublicUrl(retryData.path);
        return data.publicUrl;
      }
      throw uploadErr;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
    return data.publicUrl;
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
        let tetePhotoUrl = formData.teteDeListePhoto;
        let suppleantPhotoUrl = formData.suppleantPhoto;
        let logoUrl = candidate.unionLogo || '';

        if (files.tete.file) {
          const path = `tete_${Date.now()}_${files.tete.file.name}`;
          tetePhotoUrl = await uploadFile(files.tete.file, path);
        }
        if (files.suppleant.file) {
          const path = `suppleant_${Date.now()}_${files.suppleant.file.name}`;
          suppleantPhotoUrl = await uploadFile(files.suppleant.file, path);
        }
        if (files.logo.file && candidate.unionId) {
          const path = `logos/union_${candidate.unionId}_${Date.now()}_${files.logo.file.name}`;
          logoUrl = await uploadFile(files.logo.file, path);
          const acronym = candidate.party?.split(' — ')[0]?.trim();
          if (acronym) {
            await supabase.from('unions').update({ logo: logoUrl }).eq('acronym', acronym);
          } else {
            await supabase.from('unions').update({ logo: logoUrl }).eq('id', candidate.unionId);
          }
        }

        // Conserver les données existantes non éditées (matricule, age, etablissement…)
        const existingTete = (candidate.titulaires?.[0] as any) || {};
        const existingSupp = (candidate.suppleants?.[0] as any) || {};

        const newTitulaire = {
          ...existingTete,
          name: formData.teteDeListeName.trim(),
          photo: tetePhotoUrl || null,
          role: 'Tête de liste',
          genre: formData.teteDeListeGenre || existingTete.genre || null,
          age: formData.teteDeListeAge !== '' ? Number(formData.teteDeListeAge) : existingTete.age ?? null,
          anciennete: formData.teteDeListeAnciennete !== ''
            ? Number(formData.teteDeListeAnciennete)
            : existingTete.anciennete ?? null,
          etablissement: formData.teteDeListeEtablissement.trim() || existingTete.etablissement || null,
        };
        const newSuppleant = {
          ...existingSupp,
          name: formData.suppleantName.trim(),
          photo: suppleantPhotoUrl || null,
          role: 'Suppléant',
          genre: formData.suppleantGenre || existingSupp.genre || null,
          age: formData.suppleantAge !== '' ? Number(formData.suppleantAge) : existingSupp.age ?? null,
          anciennete: formData.suppleantAnciennete !== '' ? Number(formData.suppleantAnciennete) : existingSupp.anciennete ?? null,
        };

        // Préserver les sièges supplémentaires (siège #2+) non éditables ici
        const newTitulaires = [...(candidate.titulaires || [])];
        newTitulaires[0] = newTitulaire;
        const newSuppleants = [...(candidate.suppleants || [])];
        newSuppleants[0] = newSuppleant;

        // Mettre à jour union_lists
        const { error } = await supabase
          .from('union_lists')
          .update({
            college: formData.college,
            titulaires: newTitulaires,
            suppleants: newSuppleants,
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
          titulaires: newTitulaires,
          suppleants: newSuppleants,
          unionLogo: logoUrl || candidate.unionLogo,
        };

        onUpdate(updatedCandidate);
        toast.success('Liste syndicale modifiée avec succès');
      } else {
        let photoUrl = formData.photo;
        if (files.political.file) {
          const path = `political_${Date.now()}_${files.political.file.name}`;
          photoUrl = await uploadFile(files.political.file, path);
        }

        // Mettre à jour le candidat politique dans la base de données
        const { error } = await supabase
          .from('candidates')
          .update({
            name: formData.name.trim(),
            party: formData.party.trim(),
            is_our_candidate: formData.isOurCandidate,
            photo_url: photoUrl,
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
          photo: photoUrl,
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

                {/* Logo du syndicat */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                      {files.logo.preview ? (
                        <img src={files.logo.preview} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-300 uppercase">{formData.party?.charAt(0) || 'S'}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Logo du syndicat</p>
                    <p className="text-[10px] text-gray-400 mb-2">Ce logo sera affiché sur toutes les cartes de ce syndicat</p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={logoFileInputRef}
                      onChange={(e) => handleFileChange(e, 'logo')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Upload className="w-3 h-3" /> {files.logo.preview ? 'Changer le logo' : 'Uploader un logo'}
                    </Button>
                  </div>
                </div>

                <FloatingSelect
                  label="Collège électoral"
                  value={formData.college}
                  onChange={(val) => handleInputChange('college', val)}
                  options={[
                    { value: 'general', label: 'Encadrement' },
                    { value: 'cadres', label: 'Cadre' },
                    { value: 'employes', label: 'Maîtrise' },
                    { value: 'ouvriers', label: 'Exécution' }
                  ]}
                />
                <FloatingInput
                  label="Établissement"
                  value={formData.teteDeListeEtablissement}
                  onChange={(e) => handleInputChange('teteDeListeEtablissement', e.target.value)}
                  placeholder="Ex: Ancien Siège"
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
                        <FloatingSelect
                          label="Genre"
                          value={formData.teteDeListeGenre}
                          onChange={(val) => handleInputChange('teteDeListeGenre', val)}
                          options={[
                            { value: '', label: 'Non renseigné' },
                            { value: 'Homme', label: 'Homme' },
                            { value: 'Femme', label: 'Femme' },
                          ]}
                        />
                        <FloatingInput
                          label="Âge (ans)"
                          type="number"
                          value={formData.teteDeListeAge}
                          onChange={(e) => handleInputChange('teteDeListeAge', e.target.value)}
                        />
                        <FloatingInput
                          label="Ancienneté (ans)"
                          type="number"
                          value={formData.teteDeListeAnciennete}
                          onChange={(e) => handleInputChange('teteDeListeAnciennete', e.target.value)}
                        />
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-600 font-semibold">Photo du représentant</Label>
                          <div className="flex flex-col gap-2">
                            {files.tete.preview && (
                              <img src={files.tete.preview} alt="Aperçu tête de liste" className="w-16 h-16 rounded-lg object-cover border" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              ref={teteFileInputRef}
                              onChange={(e) => handleFileChange(e, 'tete')}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => teteFileInputRef.current?.click()}
                              className="flex items-center gap-2 w-full sm:w-auto justify-center"
                            >
                              <Upload className="w-4 h-4" /> Téléverser la photo
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Suppléant</p>
                        <FloatingInput
                          label="Nom complet *"
                          value={formData.suppleantName}
                          onChange={(e) => handleInputChange('suppleantName', e.target.value)}
                          required
                        />
                        <FloatingSelect
                          label="Genre"
                          value={formData.suppleantGenre}
                          onChange={(val) => handleInputChange('suppleantGenre', val)}
                          options={[
                            { value: '', label: 'Non renseigné' },
                            { value: 'Homme', label: 'Homme' },
                            { value: 'Femme', label: 'Femme' },
                          ]}
                        />
                        <FloatingInput
                          label="Âge (ans)"
                          type="number"
                          value={formData.suppleantAge}
                          onChange={(e) => handleInputChange('suppleantAge', e.target.value)}
                        />
                        <FloatingInput
                          label="Ancienneté (ans)"
                          type="number"
                          value={formData.suppleantAnciennete}
                          onChange={(e) => handleInputChange('suppleantAnciennete', e.target.value)}
                        />
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-600 font-semibold">Photo du suppléant</Label>
                          <div className="flex flex-col gap-2">
                            {files.suppleant.preview && (
                              <img src={files.suppleant.preview} alt="Aperçu suppléant" className="w-16 h-16 rounded-lg object-cover border" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              ref={suppleantFileInputRef}
                              onChange={(e) => handleFileChange(e, 'suppleant')}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => suppleantFileInputRef.current?.click()}
                              className="flex items-center gap-2 w-full sm:w-auto justify-center"
                            >
                              <Upload className="w-4 h-4" /> Téléverser la photo
                            </Button>
                          </div>
                        </div>
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

                <div className="space-y-2 mt-4">
                  <Label className="text-xs text-gray-600 font-semibold">Photo de profil</Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {files.political.preview && (
                      <img src={files.political.preview} alt="Aperçu candidat" className="w-20 h-20 rounded-xl object-cover border shadow-sm" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      ref={politicalFileInputRef}
                      onChange={(e) => handleFileChange(e, 'political')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => politicalFileInputRef.current?.click()}
                      className="flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                      <Upload className="w-4 h-4" /> Sélectionner une photo
                    </Button>
                  </div>
                </div>

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
