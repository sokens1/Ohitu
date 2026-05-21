/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Save, Building, Users, Calendar, Briefcase, FileText, Check, Globe } from 'lucide-react';
import { ModernForm, ModernFormSection, ModernFormGrid, ModernFormActions } from '@/components/ui/modern-form';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import ImageUploader from '@/components/ui/ImageUploader';
import { Election } from '@/types/elections';

interface EditProfessionalElectionModalProps {
  election: Election;
  onClose: () => void;
  onUpdate: (updatedData: any) => void;
}

const EditProfessionalElectionModal: React.FC<EditProfessionalElectionModalProps> = ({
  election,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = useState({
    name: election.title,
    type: election.type,
    date: election.date instanceof Date ? election.date.toISOString().split('T')[0] : (election.date as string).split('T')[0],
    status: election.status,
    description: election.description || '',
    legalFramework: (election as any).legal_framework || 'LOI-022-2021 + Arrêté 000147',
    
    // Entreprise
    enterpriseId: (election as any).enterprise_id || '',
    enterpriseName: '',
    enterpriseSector: 'prive',
    totalEmployees: election.statistics.totalVoters.toString(),
    employeesCadres: '0',
    employeesEmployes: '0',
    employeesOuvriers: '0',
    administrativeUnit: '',
    region: 'Estuaire',
    villes: [] as string[],
    
    // Collèges
    colleges: [] as any[],
    totalBureaux: election.statistics.totalBureaux.toString(),
    
    // Chronogramme
    listDisplayDate: (election as any).list_display_date || '',
    campaignStart: (election as any).campaign_start || '',
    campaignEnd: (election as any).campaign_end || '',
    hasSecondRound: (election as any).has_second_round ?? true,
    secondRoundDate: (election as any).second_round_date || '',
    recoursStart: (election as any).recours_period_start || '',
    recoursEnd: (election as any).recours_period_end || '',
    coverImage: election.cover_image || '',
    carence: (election as any).carence || false,
  });
  
  // Auto-calculer l'effectif total
  useEffect(() => {
    const total = (parseInt(formData.employeesCadres) || 0) + 
                  (parseInt(formData.employeesEmployes) || 0) + 
                  (parseInt(formData.employeesOuvriers) || 0);
    if (total > 0 && total.toString() !== formData.totalEmployees) {
      setFormData(prev => ({ ...prev, totalEmployees: total.toString() }));
    }
  }, [formData.employeesCadres, formData.employeesEmployes, formData.employeesOuvriers, formData.totalEmployees]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les données de l'entreprise et des collèges
  useEffect(() => {
    const loadProData = async () => {
      try {
        setLoading(true);
        
        // 1. Charger l'entreprise
        if (formData.enterpriseId) {
          const { data: enterprise, error: entError } = await supabase
            .from('enterprises')
            .select('*')
            .eq('id', formData.enterpriseId)
            .single();
            
          if (!entError && enterprise) {
            setFormData(prev => ({
              ...prev,
              enterpriseName: enterprise.name,
              enterpriseSector: enterprise.sector,
              employeesCadres: enterprise.employees_by_category?.cadres?.toString() || '0',
              employeesEmployes: enterprise.employees_by_category?.employes?.toString() || '0',
              employeesOuvriers: enterprise.employees_by_category?.ouvriers?.toString() || '0',
              administrativeUnit: enterprise.administrative_unit || '',
            }));
          }
        }

        // 2. Charger les collèges
        const { data: colleges, error: collError } = await supabase
          .from('electoral_colleges')
          .select('*')
          .eq('election_id', election.id);
          
        if (!collError && colleges) {
          setFormData(prev => ({
            ...prev,
            colleges: colleges.map((c: any) => ({
              id: c.id,
              name: c.name,
              type: c.college_type,
              voters: c.total_voters,
              seats: c.seats_to_fill
            }))
          }));
        } else if (!collError && (!colleges || colleges.length === 0)) {
           // Fallback default colleges if none found
           setFormData(prev => ({
            ...prev,
            colleges: [
              { id: '1', name: 'Cadre', type: 'cadres', voters: 0, seats: 1 },
              { id: '2', name: 'Maîtrise', type: 'employes', voters: 0, seats: 1 },
              { id: '3', name: 'Exécution', type: 'ouvriers', voters: 0, seats: 1 },
              { id: '4', name: 'Encadrement', type: 'general', voters: 0, seats: 1 }
            ]
          }));
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données pro:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProData();
  }, [election.id, formData.enterpriseId]);

  // Calcul automatique de l'effectif total
  useEffect(() => {
    const cadres = parseInt(formData.employeesCadres) || 0;
    const employes = parseInt(formData.employeesEmployes) || 0;
    const ouvriers = parseInt(formData.employeesOuvriers) || 0;
    const total = cadres + employes + ouvriers;
    if (total > 0) {
      setFormData(prev => ({ ...prev, totalEmployees: total.toString() }));
    }
  }, [formData.employeesCadres, formData.employeesEmployes, formData.employeesOuvriers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // On passe tout l'objet formData au parent qui gérera l'update complexe
      await onUpdate(formData);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour de l\'élection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md h-[40vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gov-blue"></div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl xl:max-w-5xl max-h-[90vh] lg:max-h-[85vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
        <DialogHeader className="pb-4 sm:pb-6 lg:pb-8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gov-blue/10 rounded-lg">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-gov-blue" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                Modifier Élection Professionnelle
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Gérez les détails de l'entreprise, les collèges et le chronogramme. Les champs marqués d'un astérisque (*) sont obligatoires.
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
              {/* Informations Générales */}
              <ModernFormSection 
                title="Informations Générales" 
                description="Paramètres de base du scrutin" 
                icon={<FileText className="w-5 h-5 text-gov-blue" />}
              >
                <ModernFormGrid cols={1}>
                  <FloatingInput
                    label="Nom de l'élection"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={2}>
                  <FloatingInput
                    label="Date du scrutin (1er tour)"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                  <FloatingSelect
                    label="Statut"
                    value={formData.status}
                    onChange={(v) => setFormData({ ...formData, status: v as any })}
                    options={[
                      { value: 'À venir', label: 'À venir' },
                      { value: 'En cours', label: 'En cours' },
                      { value: 'Terminée', label: 'Terminée' },
                      { value: 'Annulée', label: 'Annulée' }
                    ]}
                  />
                </ModernFormGrid>
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Image de couverture</label>
                  <ImageUploader 
                    onUploadSuccess={(url) => setFormData({ ...formData, coverImage: url })}
                    defaultValue={formData.coverImage}
                  />
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-sm text-gray-500">
                  <span>Cadre légal de référence :</span>
                  <a 
                    href="https://www.droit-afrique.com/uploads/Gabon-Code-du-travail-2021.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gov-blue hover:text-gov-blue-dark font-semibold inline-flex items-center gap-1 transition-colors hover:underline"
                  >
                    LOI-022-2021 + Arrêté 000147
                  </a>
                </div>
              </ModernFormSection>

              {/* Entreprise */}
              <ModernFormSection 
                title="Entreprise / Établissement" 
                description="Informations sur l'employeur et les effectifs" 
                icon={<Building className="w-5 h-5 text-gov-blue" />}
              >
                <ModernFormGrid cols={2}>
                  <FloatingInput
                    label="Raison Sociale"
                    value={formData.enterpriseName}
                    onChange={(e) => setFormData({ ...formData, enterpriseName: e.target.value })}
                    required
                  />
                  <FloatingSelect
                    label="Secteur"
                    value={formData.enterpriseSector}
                    onChange={(v) => setFormData({ ...formData, enterpriseSector: v })}
                    options={[
                      { value: 'prive', label: 'Privé' },
                      { value: 'parapublic', label: 'Parapublic' },
                      { value: 'public', label: 'Public' }
                    ]}
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={1}>
                  <FloatingInput
                    label="Tutelle"
                    value={formData.administrativeUnit}
                    onChange={(e) => setFormData({ ...formData, administrativeUnit: e.target.value })}
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={3}>
                  <FloatingInput
                    label="Effectif Cadres"
                    type="number"
                    value={formData.employeesCadres}
                    onChange={(e) => setFormData({ ...formData, employeesCadres: e.target.value })}
                  />
                  <FloatingInput
                    label="Effectif Employés"
                    type="number"
                    value={formData.employeesEmployes}
                    onChange={(e) => setFormData({ ...formData, employeesEmployes: e.target.value })}
                  />
                  <FloatingInput
                    label="Effectif Ouvriers"
                    type="number"
                    value={formData.employeesOuvriers}
                    onChange={(e) => setFormData({ ...formData, employeesOuvriers: e.target.value })}
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={1}>
                  <FloatingInput
                    label="Effectif Total (Nombre d'électeurs)"
                    type="number"
                    value={formData.totalEmployees}
                    disabled
                    className="bg-gray-100 font-bold text-gov-blue"
                  />
                </ModernFormGrid>
              </ModernFormSection>

              {/* Collèges & Bureaux */}
              <ModernFormSection 
                title="Collèges & Bureaux" 
                description="Répartition des sièges et organisation" 
                icon={<Users className="w-5 h-5 text-gov-blue" />}
              >
                <div className="space-y-4 mb-6">
                  {formData.colleges.map((college, idx) => (
                    <div key={college.id || idx} className="p-4 border rounded-xl bg-white shadow-sm flex items-center gap-4">
                      <div className="font-semibold text-gray-700 w-1/4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gov-blue" />
                        {college.name}
                      </div>
                      <div className="flex-1">
                        <FloatingInput
                          label="Électeurs"
                          type="number"
                          value={college.voters.toString()}
                          onChange={(e) => {
                            const newColleges = [...formData.colleges];
                            newColleges[idx].voters = parseInt(e.target.value) || 0;
                            setFormData({...formData, colleges: newColleges});
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <FloatingInput
                          label="Sièges à pourvoir"
                          type="number"
                          value={college.seats.toString()}
                          onChange={(e) => {
                            const newColleges = [...formData.colleges];
                            newColleges[idx].seats = parseInt(e.target.value) || 0;
                            setFormData({...formData, colleges: newColleges});
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <ModernFormGrid cols={2}>
                  <FloatingInput
                    label="Nombre de bureaux de vote"
                    type="number"
                    value={formData.totalBureaux}
                    onChange={(e) => setFormData({...formData, totalBureaux: e.target.value})}
                    required
                  />
                  <div className="flex items-center space-x-2 h-full">
                    <input 
                      type="checkbox" 
                      id="edit-carence" 
                      checked={formData.carence} 
                      onChange={(e) => setFormData({...formData, carence: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-gov-blue focus:ring-gov-blue"
                    />
                    <label htmlFor="edit-carence" className="text-sm font-medium text-gray-700">Constat de carence au 1er tour</label>
                  </div>
                </ModernFormGrid>
              </ModernFormSection>

              {/* Chronogramme */}
              <ModernFormSection 
                title="Chronogramme Électoral" 
                description="Calendrier des opérations" 
                icon={<Calendar className="w-5 h-5 text-gov-blue" />}
              >
                <ModernFormGrid cols={2}>
                  <FloatingInput label="Affichage des listes" type="date" value={formData.listDisplayDate} onChange={(e) => setFormData({...formData, listDisplayDate: e.target.value})} />
                  <FloatingInput label="Début de campagne" type="date" value={formData.campaignStart} onChange={(e) => setFormData({...formData, campaignStart: e.target.value})} />
                  <FloatingInput label="Fin de campagne" type="date" value={formData.campaignEnd} onChange={(e) => setFormData({...formData, campaignEnd: e.target.value})} />
                  <FloatingInput label="Date 2nd Tour" type="date" value={formData.secondRoundDate} onChange={(e) => setFormData({...formData, secondRoundDate: e.target.value})} />
                  <FloatingInput label="Début des recours" type="date" value={formData.recoursStart} onChange={(e) => setFormData({...formData, recoursStart: e.target.value})} />
                  <FloatingInput label="Fin des recours" type="date" value={formData.recoursEnd} onChange={(e) => setFormData({...formData, recoursEnd: e.target.value})} />
                </ModernFormGrid>
              </ModernFormSection>

              <ModernFormActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-8 rounded-xl border-2"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-12 bg-gov-blue hover:bg-gov-blue-dark text-white rounded-xl shadow-lg transition-all"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  {!isSubmitting && <Save className="ml-2 h-5 w-5" />}
                </Button>
              </ModernFormActions>
            </ModernForm>
          </DialogContent>
        </Dialog>
  );
};

export default EditProfessionalElectionModal;
