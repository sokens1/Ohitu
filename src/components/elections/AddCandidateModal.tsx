/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Users, Plus, Search, Star, Briefcase, Camera, Upload, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ModernForm, ModernFormSection, ModernFormActions, ModernFormGrid } from '@/components/ui/modern-form';
import MultiSelect from '@/components/ui/multi-select';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
  // Pro fields
  unionId?: string;
  college?: string;
}

interface AddCandidateModalProps {
  onClose: () => void;
  onSubmit: (candidates: Candidate[]) => void;
  electionId?: string;
  enterpriseId?: string;
  electionType?: string;
}

const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ onClose, onSubmit, electionId, enterpriseId, electionType }) => {
  console.log('AddCandidateModal - electionType:', electionType);
  const isPro = electionType?.trim() === 'Élection Professionnelle';
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Array<{id: string, name: string, party: string, isOurCandidate: boolean}>>([]);
  const [loading, setLoading] = useState(true);
  
  // Pro state: Unions
  const [unions, setUnions] = useState<any[]>([]);
  const [selectedUnions, setSelectedUnions] = useState<string[]>([]);
  const [selectedUnionId, setSelectedUnionId] = useState(''); // Added back for single selection in Create flow
  const [newUnion, setNewUnion] = useState({ name: '', acronym: '' });
  const [college, setCollege] = useState('general');
  
  // New fields for Head of List and Deputy
  const [teteDeListe, setTeteDeListe] = useState({ name: '', genre: '', anciennete: '', etablissement: '', photo: '', file: null as File | null, preview: '' });
  const [suppleant, setSuppleant] = useState({ name: '', genre: '', photo: '', file: null as File | null, preview: '' });

  const teteFileInputRef = useRef<HTMLInputElement>(null);
  const suppleantFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'tete' | 'suppleant') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'tete') {
          setTeteDeListe(prev => ({ ...prev, file, preview: reader.result as string }));
        } else {
          setSuppleant(prev => ({ ...prev, file, preview: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const bucket = 'avatars';
    // Ensure bucket exists (simplified)
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

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (isPro) {
          const { data, error } = await supabase
            .from('unions')
            .select('*')
            .order('name');
          if (error) throw error;
          setUnions(data || []);
          if (data && data.length > 0) setMode('select');
        } else {
          // Logic for political candidates
          let { data, error } = await supabase
            .from('candidats')
            .select('id, nom, parti, est_notre_candidat')
            .order('nom');

          if (error && (error.code === 'PGRST116' || error.code === 'PGRST205')) {
            const result = await supabase
              .from('candidates')
              .select('id, name, party, is_our_candidate')
              .order('name');
            data = result.data;
            error = result.error;
          }
          if (error) throw error;
          
          setCandidates((data || []).map((c: any) => ({
            id: c.id,
            name: c.nom || c.name || '',
            party: c.parti || c.party || '',
            isOurCandidate: c.est_notre_candidat || c.is_our_candidate || false
          })));
        }
      } catch (error: any) {
        console.error('Erreur chargement:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isPro]);

  const handleSubmitSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPro) {
      if (selectedUnions.length === 0) {
        toast.error('Veuillez sélectionner au moins un syndicat');
        return;
      }

      try {
        setLoading(true);
        const candidatesToAdd: Candidate[] = [];

        for (const unionId of selectedUnions) {
          const union = unions.find(u => u.id === unionId);
          
          // Créer une entrée dans union_lists pour chaque syndicat sélectionné
          const { data: listData, error: listError } = await supabase
            .from('union_lists')
            .insert({
              election_id: electionId,
              union_id: unionId,
              college: college,
              titulaires: [{ name: `Tête de liste ${union.acronym || union.name}`, role: 'Tête de liste' }],
              suppleants: [{ name: `Suppléant ${union.acronym || union.name}`, role: 'Suppléant' }]
            })
            .select()
            .single();

          if (listError) throw listError;

          candidatesToAdd.push({
            id: listData.id,
            name: union.name,
            party: union.acronym || 'Indépendant',
            isOurCandidate: false,
            unionId: unionId,
            college: college
          });
        }

        onSubmit(candidatesToAdd);
        toast.success(`${selectedUnions.length} liste${selectedUnions.length > 1 ? 's' : ''} ajoutée${selectedUnions.length > 1 ? 's' : ''}`);
      } catch (error: any) {
        console.error(error);
        toast.error(`Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      if (selectedCandidates.length > 0) {
        const candidatesToAdd = candidates
          .filter(c => selectedCandidates.includes(c.id))
          .map(c => ({
            ...c,
            photo: '/placeholder.svg'
          }));
        onSubmit(candidatesToAdd);
      } else {
        toast.error('Veuillez sélectionner au moins un candidat');
      }
    }
  };

  const handleAddUnionList = async (e: React.FormEvent) => {
    e.preventDefault();
    let unionId = selectedUnionId;

    try {
      setLoading(true);
      // Create union if in create mode
      if (mode === 'create') {
        if (!newUnion.name) {
          toast.error('Le nom du syndicat est requis');
          return;
        }
        const { data, error } = await supabase
          .from('unions')
          .insert({ name: newUnion.name, acronym: newUnion.acronym })
          .select()
          .single();
        if (error) throw error;
        unionId = data.id;
      }

      if (!unionId) {
        toast.error('Veuillez sélectionner ou créer un syndicat');
        return;
      }

      let tetePhotoUrl = teteDeListe.photo;
      let suppleantPhotoUrl = suppleant.photo;

      if (teteDeListe.file) {
        const path = `tete_${Date.now()}_${teteDeListe.file.name}`;
        tetePhotoUrl = await uploadFile(teteDeListe.file, path);
      }

      if (suppleant.file) {
        const path = `suppleant_${Date.now()}_${suppleant.file.name}`;
        suppleantPhotoUrl = await uploadFile(suppleant.file, path);
      }

      // Create Union List entry
      const { data: listData, error: listError } = await supabase
        .from('union_lists')
        .insert({
          election_id: electionId,
          union_id: unionId,
          college: college,
          titulaires: [{ name: teteDeListe.name, photo: tetePhotoUrl, role: 'Tête de liste', genre: teteDeListe.genre || undefined, anciennete: teteDeListe.anciennete || undefined, etablissement: teteDeListe.etablissement || undefined }],
          suppleants: [{ name: suppleant.name, photo: suppleantPhotoUrl, role: 'Suppléant', genre: suppleant.genre || undefined }]
        })
        .select()
        .single();

      if (listError) throw listError;

      // Map to Candidate format for compatibility
      const union = unions.find(u => u.id === unionId) || { name: newUnion.name, acronym: newUnion.acronym };
      const proCandidate: Candidate = {
        id: listData.id, // Using the list ID
        name: union.name,
        party: union.acronym || 'Indépendant',
        isOurCandidate: false,
        unionId: unionId,
        college: college
      };

      // Refresh lists
      const { data: updatedUnions } = await supabase.from('unions').select('*').order('name');
      setUnions(updatedUnions || []);
      
      // Auto-select the newly created union
      setSelectedUnions(prev => [...prev, unionId]);
      
      // Reset form and switch mode
      setNewUnion({ name: '', acronym: '' });
      setTeteDeListe({ name: '', genre: '', anciennete: '', etablissement: '', photo: '', file: null, preview: '' });
      setSuppleant({ name: '', genre: '', photo: '', file: null, preview: '' });
      setMode('select');
      
      toast.success('Liste syndicale ajoutée. Vous pouvez maintenant la sélectionner dans la liste.');
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
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-tight">
                {isPro ? 'Gestion des Listes Syndicales' : 'Sélection des Candidats'}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {isPro ? 'Ajoutez les listes en compétition pour cette élection' : 'Choisissez les candidats pour cette élection'}
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
                <Search className="w-3 h-3 mr-1" /> Sélectionner Syndicat
              </Button>
              <Button 
                variant={mode === 'create' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setMode('create')}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Nouveau Syndicat
              </Button>
            </div>
          )}

          {mode === 'select' ? (
            <form onSubmit={handleSubmitSelection} className="space-y-6">
              <MultiSelect
                options={isPro 
                  ? unions.map(u => ({ value: u.id, label: u.name, subtitle: u.acronym || 'N/A' }))
                  : candidates.map(c => ({ value: c.id, label: c.name, subtitle: c.party }))
                }
                selected={isPro ? selectedUnions : selectedCandidates}
                onSelectionChange={isPro ? setSelectedUnions : setSelectedCandidates}
                placeholder={isPro ? "Sélectionnez des syndicats..." : "Sélectionnez des candidats..."}
                title={isPro ? "Syndicats" : "Candidats"}
                icon={isPro ? <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" /> : <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#1e40af]" />}
                searchable={true}
                emptyMessage={isPro ? "Aucun syndicat trouvé. Utilisez l'onglet 'Nouveau Syndicat' pour en créer un." : "Aucun candidat trouvé."}
                className="w-full"
              />

              {isPro && (
                <FloatingSelect
                  label="Collège électoral pour ces listes"
                  value={college}
                  onChange={(val) => setCollege(val)}
                  options={[
                    { value: 'general', label: 'Encadrement' },
                    { value: 'cadres', label: 'Cadre' },
                    { value: 'employes', label: 'Maîtrise' },
                    { value: 'ouvriers', label: 'Exécution' }
                  ]}
                />
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-700 text-white" 
                  disabled={loading || (isPro ? selectedUnions.length === 0 : selectedCandidates.length === 0)}
                >
                  {loading ? 'Ajout...' : `Ajouter ${isPro ? selectedUnions.length : selectedCandidates.length} élément(s)`}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddUnionList} className="space-y-6">
              <ModernFormGrid cols={2}>
                <FloatingInput
                  label="Nom du Syndicat"
                  value={newUnion.name}
                  onChange={(e) => setNewUnion({...newUnion, name: e.target.value})}
                  required
                />
                <FloatingInput
                  label="Acronyme (ex: CGT, FO...)"
                  value={newUnion.acronym}
                  onChange={(e) => setNewUnion({...newUnion, acronym: e.target.value})}
                />
              </ModernFormGrid>

              <FloatingSelect
                label="Collège électoral"
                value={college}
                onChange={(val) => setCollege(val)}
                options={[
                  { value: 'general', label: 'Encadrement' },
                  { value: 'cadres', label: 'Cadre' },
                  { value: 'employes', label: 'Maîtrise' },
                  { value: 'ouvriers', label: 'Exécution' }
                ]}
              />

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> Représentants de la liste
                </h4>
                
                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Tête de liste (Titulaire)</p>
                      <FloatingInput
                        label="Nom complet"
                        value={teteDeListe.name}
                        onChange={(e) => setTeteDeListe({...teteDeListe, name: e.target.value})}
                        required
                      />
                      <FloatingSelect
                        label="Genre"
                        value={teteDeListe.genre}
                        onChange={(v) => setTeteDeListe({...teteDeListe, genre: v})}
                        options={[
                          { value: '', label: '—' },
                          { value: 'M', label: 'Masculin' },
                          { value: 'F', label: 'Féminin' }
                        ]}
                      />
                      <FloatingInput
                        label="Ancienneté"
                        value={teteDeListe.anciennete}
                        onChange={(e) => setTeteDeListe({...teteDeListe, anciennete: e.target.value})}
                      />
                      <FloatingInput
                        label="Etablissement"
                        value={teteDeListe.etablissement}
                        onChange={(e) => setTeteDeListe({...teteDeListe, etablissement: e.target.value})}
                      />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Photo Profil</label>
                        <div
                          onClick={() => teteFileInputRef.current?.click()}
                          className="relative h-24 w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center group"
                        >
                          {teteDeListe.preview ? (
                            <img src={teteDeListe.preview} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-gray-300 group-hover:text-purple-500 mb-1" />
                              <span className="text-[10px] text-gray-400 font-medium">Cliquer pour uploader</span>
                            </>
                          )}
                          <input
                            type="file"
                            ref={teteFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'tete')}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Suppléant</p>
                      <FloatingInput
                        label="Nom complet"
                        value={suppleant.name}
                        onChange={(e) => setSuppleant({...suppleant, name: e.target.value})}
                        required
                      />
                      <FloatingSelect
                        label="Genre"
                        value={suppleant.genre}
                        onChange={(v) => setSuppleant({...suppleant, genre: v})}
                        options={[
                          { value: '', label: '—' },
                          { value: 'M', label: 'Masculin' },
                          { value: 'F', label: 'Féminin' }
                        ]}
                      />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Photo Profil</label>
                        <div
                          onClick={() => suppleantFileInputRef.current?.click()}
                          className="relative h-24 w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center group"
                        >
                          {suppleant.preview ? (
                            <img src={suppleant.preview} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-gray-300 group-hover:text-blue-500 mb-1" />
                              <span className="text-[10px] text-gray-400 font-medium">Cliquer pour uploader</span>
                            </>
                          )}
                          <input
                            type="file"
                            ref={suppleantFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'suppleant')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={loading}>
                  {loading ? 'Traitement...' : 'Ajouter cette liste'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCandidateModal;
