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
    enterpriseId: election.enterpriseId || (election as any).enterprise_id || '',
    enterpriseName: '',
    enterpriseSector: 'prive',
    totalEmployees: election.statistics.totalVoters.toString(),
    employeesCadres: '0',
    employeesEmployes: '0',
    employeesOuvriers: '0',
    administrativeUnit: '',
    provinceName: '',
    communeName: '',
    hrContactName: '',
    hrContactPhone: '',
    hrContactEmail: '',
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
              enterpriseSector: enterprise.sector || 'prive',
              employeesCadres: enterprise.employees_by_category?.cadres?.toString() || '0',
              employeesEmployes: enterprise.employees_by_category?.employes?.toString() || '0',
              employeesOuvriers: enterprise.employees_by_category?.ouvriers?.toString() || '0',
              administrativeUnit: enterprise.administrative_unit || '',
              provinceName: enterprise.province_name || '',
              communeName: enterprise.commune_name || '',
              hrContactName: enterprise.hr_contact?.name || '',
              hrContactPhone: enterprise.hr_contact?.phone || '',
              hrContactEmail: enterprise.hr_contact?.email || '',
            }));
          }
        }

        // 2. Charger les collèges depuis electoral_colleges (structure)
        const { data: colleges, error: collError } = await supabase
          .from('electoral_colleges')
          .select('*')
          .eq('election_id', election.id);

        const baseColleges = (!collError && colleges && colleges.length > 0)
          ? colleges.map((c: any) => ({
              id: c.id,
              name: c.name,
              type: c.college_type,
              voters: Number(c.total_voters) || 0,
              seats: Number(c.seats_to_fill) || 0,
            }))
          : [
              { id: '1', name: 'Cadre',        type: 'cadres',   voters: 0, seats: 1 },
              { id: '2', name: 'Maîtrise',     type: 'employes', voters: 0, seats: 1 },
              { id: '3', name: 'Exécution',    type: 'ouvriers', voters: 0, seats: 1 },
              { id: '4', name: 'Encadrement',  type: 'general',  voters: 0, seats: 1 },
            ];

        // Normalise un libellé collège vers la clé interne (cadres/employes/ouvriers/general)
        const normalizeCollegeKey = (raw: string): string => {
          const v = (raw || '').toLowerCase().trim();
          if (v === 'general' || v.includes('encadrement')) return 'general';
          if (v.includes('cadre'))                          return 'cadres';
          if (v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
          if (v.includes('ex') && (v.includes('cution') || v.includes('ecution'))) return 'ouvriers';
          return v;
        };

        // 3. Agréger les totaux réels depuis les pseudo-entrées voting_bureaux
        const { data: ecData } = await supabase
          .from('election_centers')
          .select('center_id')
          .eq('election_id', election.id);

        const totalsMap: Record<string, { voters: number; seats: number }> = {};
        if (ecData && ecData.length > 0) {
          const centerIds = ecData.map((ec: any) => ec.center_id).filter(Boolean);
          if (centerIds.length > 0) {
            // Récupérer toutes les pseudo-entrées (nom commence par "College -")
            const { data: bureaux } = await supabase
              .from('voting_bureaux')
              .select('name, college, college_type, registered_voters, seats_to_fill')
              .in('center_id', centerIds);

            for (const b of (bureaux || [])) {
              // Pseudo-entrée collège : nom "College - X" ou college non vide
              const isCollege = (b.name as string)?.startsWith('College -') ||
                (b.college != null && b.college !== '');
              if (!isCollege) continue;

              const rawKey = b.college_type || b.college || 'general';
              const ct = normalizeCollegeKey(String(rawKey));
              if (!totalsMap[ct]) totalsMap[ct] = { voters: 0, seats: 0 };
              totalsMap[ct].voters += Number(b.registered_voters) || 0;
              totalsMap[ct].seats  += Number(b.seats_to_fill)     || 0;
            }
          }
        }

        // Fusionner : priorité aux totaux voting_bureaux si > 0, sinon electoral_colleges
        const mergedColleges = baseColleges.map(c => ({
          ...c,
          voters: totalsMap[c.type]?.voters || c.voters,
          seats:  totalsMap[c.type]?.seats  || c.seats,
        }));

        setFormData(prev => ({ ...prev, colleges: mergedColleges }));
      } catch (error) {
        console.error('Erreur lors du chargement des données pro:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProData();
  }, [election.id, formData.enterpriseId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Sauvegarder les données entreprise si présentes
      if (formData.enterpriseId) {
        const { error: updateError } = await supabase
          .from('enterprises')
          .update({
            name: formData.enterpriseName,
            sector: formData.enterpriseSector,
            administrative_unit: formData.administrativeUnit,
            total_employees: parseInt(formData.totalEmployees) || 0,
            employees_by_category: {
              cadres: parseInt(formData.employeesCadres) || 0,
              employes: parseInt(formData.employeesEmployes) || 0,
              ouvriers: parseInt(formData.employeesOuvriers) || 0,
            },
            province_name: formData.provinceName || null,
            commune_name: formData.communeName || null,
            hr_contact: (formData.hrContactName || formData.hrContactPhone || formData.hrContactEmail)
              ? { name: formData.hrContactName, phone: formData.hrContactPhone, email: formData.hrContactEmail }
              : null,
          })
          .eq('id', formData.enterpriseId);

        if (updateError) {
          console.error('Erreur lors de la mise à jour de l\'entreprise:', updateError);
          toast.error('Erreur lors de la sauvegarde des données entreprise');
          return;
        }
      }

      // 2. Sauvegarder l'élection
      await onUpdate(formData);
      toast.success('Élection et entreprise mises à jour avec succès');
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
                    label="Organisation"
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
                <ModernFormGrid cols={2}>
                  <FloatingInput
                    label="Province (Localisation Siège)"
                    value={formData.provinceName}
                    onChange={(e) => setFormData({ ...formData, provinceName: e.target.value })}
                  />
                  <FloatingInput
                    label="Commune (Localisation Siège)"
                    value={formData.communeName}
                    onChange={(e) => setFormData({ ...formData, communeName: e.target.value })}
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={3}>
                  <FloatingInput
                    label="Contact RH — Nom"
                    value={formData.hrContactName}
                    onChange={(e) => setFormData({ ...formData, hrContactName: e.target.value })}
                  />
                  <FloatingInput
                    label="Contact RH — Téléphone"
                    value={formData.hrContactPhone}
                    onChange={(e) => setFormData({ ...formData, hrContactPhone: e.target.value })}
                  />
                  <FloatingInput
                    label="Contact RH — Email"
                    type="email"
                    value={formData.hrContactEmail}
                    onChange={(e) => setFormData({ ...formData, hrContactEmail: e.target.value })}
                  />
                </ModernFormGrid>
                <ModernFormGrid cols={1}>
                  <FloatingInput
                    label="Effectif Total (Nombre d'électeurs)"
                    type="number"
                    value={formData.totalEmployees}
                    onChange={(e) => setFormData({ ...formData, totalEmployees: e.target.value })}
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
                          label="Électeurs (total)"
                          type="number"
                          value={college.voters.toString()}
                          disabled
                        />
                      </div>
                      <div className="flex-1">
                        <FloatingInput
                          label="Sièges à pourvoir (total)"
                          type="number"
                          value={college.seats.toString()}
                          disabled
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
                  <FloatingInput label="Date 2nd Tour" type="date" value={formData.secondRoundDate} onChange={(e) => setFormData({...formData, secondRoundDate: e.target.value})} />
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
