import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronLeft, ChevronRight, Check, Building, Users, Calendar, MapPin, Briefcase, FileText, Settings } from 'lucide-react';
import { ModernForm, ModernFormSection, ModernFormGrid } from '@/components/ui/modern-form';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ProfessionalElectionWizardProps {
  onClose: () => void;
  onSubmit?: (election: any) => void;
  onSuccess?: () => void;
}

const ProfessionalElectionWizard: React.FC<ProfessionalElectionWizardProps> = ({ onClose, onSubmit, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    'Informations',
    'Entreprise',
    'Listes Syndicales',
    'Collèges & Bureaux',
    'Chronogramme',
    'Récapitulatif'
  ];

  const [formData, setFormData] = useState({
    name: '',
    type: 'Élection Professionnelle',
    date: '',
    legalFramework: 'LOI-022-2021 + Arrêté 000147',
    
    // Entreprise
    enterpriseName: '',
    enterpriseSector: 'prive',
    administrativeUnit: '',
    totalEmployees: '',
    employeesCadres: '0',
    employeesEmployes: '0',
    employeesOuvriers: '0',
    hrName: '',
    hrPhone: '',
    hrEmail: '',
    region: 'Estuaire',
    villes: [] as string[],
    
    // Listes Syndicales
    unionLists: [] as any[],
    carence: false,
    
    // Collèges
    colleges: [
      { id: '1', name: 'Cadres', type: 'cadres', voters: 0, seats: 1 },
      { id: '2', name: 'Employés', type: 'employes', voters: 0, seats: 1 },
      { id: '3', name: 'Ouvriers', type: 'ouvriers', voters: 0, seats: 1 }
    ],
    totalBureaux: '1',
    
    // Chronogramme
    listDisplayDate: '',
    campaignStart: '',
    campaignEnd: '',
    hasSecondRound: true,
    secondRoundDate: '',
    recoursStart: '',
    recoursEnd: ''
  });

  // Auto-calculate dates based on election date
  useEffect(() => {
    if (formData.date) {
      const electionDate = new Date(formData.date);
      
      const listDisplay = new Date(electionDate);
      listDisplay.setDate(listDisplay.getDate() - 5);
      
      const campaignEnd = new Date(electionDate);
      campaignEnd.setDate(campaignEnd.getDate() - 1);
      
      const campaignStart = new Date(campaignEnd);
      campaignStart.setDate(campaignStart.getDate() - 7);
      
      const secondRound = new Date(electionDate);
      secondRound.setDate(secondRound.getDate() + 7);
      
      const recoursStart = new Date(electionDate);
      recoursStart.setDate(recoursStart.getDate() + 1);
      
      const recoursEnd = new Date(recoursStart);
      recoursEnd.setDate(recoursEnd.getDate() + 2);

      setFormData(prev => ({
        ...prev,
        listDisplayDate: listDisplay.toISOString().split('T')[0],
        campaignStart: campaignStart.toISOString().split('T')[0],
        campaignEnd: campaignEnd.toISOString().split('T')[0],
        secondRoundDate: secondRound.toISOString().split('T')[0],
        recoursStart: recoursStart.toISOString().split('T')[0],
        recoursEnd: recoursEnd.toISOString().split('T')[0]
      }));
    }
  }, [formData.date]);

  // Handle total employees auto-calc
  useEffect(() => {
    const cadres = parseInt(formData.employeesCadres) || 0;
    const employes = parseInt(formData.employeesEmployes) || 0;
    const ouvriers = parseInt(formData.employeesOuvriers) || 0;
    const total = cadres + employes + ouvriers;
    if (total > 0) {
      setFormData(prev => ({ ...prev, totalEmployees: total.toString() }));
    }
  }, [formData.employeesCadres, formData.employeesEmployes, formData.employeesOuvriers]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      if (onSubmit) {
        onSubmit(formData);
      }
      
      // Ici on pourrait insérer directement dans Supabase si on veut gérer ça dans le composant
      // Mais on va laisser ElectionManagementUnified le faire comme pour l'ancien wizard
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la création de l'élection professionnelle");
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() !== '' && formData.date.trim() !== '';
      case 2:
        return formData.enterpriseName.trim() !== '' && parseInt(formData.totalEmployees) >= 10 && formData.villes.length > 0;
      case 3:
        return true; // Optional for now, can proceed
      case 4:
        return parseInt(formData.totalBureaux) > 0;
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ModernFormSection title="Informations Générales" description="Paramètres de base de l'élection professionnelle" icon={<FileText className="w-5 h-5" />}>
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Nom de l'élection"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Élection Délégués du Personnel 2026"
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
              <FloatingInput
                label="Cadre Légal"
                value={formData.legalFramework}
                onChange={(e) => setFormData({ ...formData, legalFramework: e.target.value })}
                disabled
              />
            </ModernFormGrid>
          </ModernFormSection>
        );
      case 2:
        return (
          <ModernFormSection title="L'Entreprise / Établissement" description="Informations sur l'employeur" icon={<Building className="w-5 h-5" />}>
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
              <FloatingSelect
                label="Région (Province)"
                value={formData.region}
                onChange={(v) => setFormData({ ...formData, region: v })}
                options={[
                  { value: 'Estuaire', label: 'Estuaire' },
                  { value: 'Haut-Ogooué', label: 'Haut-Ogooué' },
                  { value: 'Moyen-Ogooué', label: 'Moyen-Ogooué' },
                  { value: 'Ngounié', label: 'Ngounié' },
                  { value: 'Nyanga', label: 'Nyanga' },
                  { value: 'Ogooué-Ivindo', label: 'Ogooué-Ivindo' },
                  { value: 'Ogooué-Lolo', label: 'Ogooué-Lolo' },
                  { value: 'Ogooué-Maritime', label: 'Ogooué-Maritime' },
                  { value: 'Woleu-Ntem', label: 'Woleu-Ntem' }
                ]}
              />
            </ModernFormGrid>
            <div className="space-y-3 mt-4">
              <label className="text-sm font-medium text-gray-700">Villes d'implantation (Plusieurs choix possibles)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border rounded-xl bg-gray-50">
                {['Libreville', 'Owendo', 'Akanda', 'Port-Gentil', 'Franceville', 'Moanda', 'Oyem', 'Bitam', 'Mouila', 'Lambaréné', 'Tchibanga', 'Makokou', 'Koulamoutou', 'Ntoum'].map((ville) => (
                  <div key={ville} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`ville-${ville}`}
                      checked={formData.villes.includes(ville)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, villes: [...formData.villes, ville] });
                        } else {
                          setFormData({ ...formData, villes: formData.villes.filter(v => v !== ville) });
                        }
                      }}
                      className="rounded border-gray-300 text-gov-blue focus:ring-gov-blue"
                    />
                    <label htmlFor={`ville-${ville}`} className="text-sm cursor-pointer">{ville}</label>
                  </div>
                ))}
              </div>
            </div>
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Effectif Total"
                type="number"
                value={formData.totalEmployees}
                onChange={(e) => setFormData({ ...formData, totalEmployees: e.target.value })}
                disabled
                helperText={parseInt(formData.totalEmployees) < 10 ? "L'effectif doit être ≥ 10 pour organiser des élections" : "Éligible aux élections professionnelles"}
              />
            </ModernFormGrid>
          </ModernFormSection>
        );
      case 3:
        return (
          <ModernFormSection title="Listes Syndicales" description="Saisie des listes candidates" icon={<Users className="w-5 h-5" />}>
             <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> La gestion détaillée des listes (titulaires/suppléants par collège) sera configurée dans le module de gestion une fois l'élection créée.
                </p>
             </div>
             <ModernFormGrid cols={1}>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="carence" 
                    checked={formData.carence} 
                    onChange={(e) => setFormData({...formData, carence: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="carence" className="text-sm font-medium">Constat de carence au 1er tour (aucune liste syndicale présentée)</label>
                </div>
             </ModernFormGrid>
          </ModernFormSection>
        );
      case 4:
        return (
          <ModernFormSection title="Collèges & Bureaux" description="Configuration des collèges électoraux" icon={<Briefcase className="w-5 h-5" />}>
             <div className="space-y-4">
               {formData.colleges.map((college, idx) => (
                 <div key={college.id} className="p-3 border rounded-lg bg-gray-50 flex items-center gap-4">
                    <div className="font-medium w-1/4">{college.name}</div>
                    <div className="w-1/3">
                      <FloatingInput
                        label="Nombre d'électeurs"
                        type="number"
                        value={college.voters.toString()}
                        onChange={(e) => {
                          const newColleges = [...formData.colleges];
                          newColleges[idx].voters = parseInt(e.target.value) || 0;
                          setFormData({...formData, colleges: newColleges});
                        }}
                      />
                    </div>
                    <div className="w-1/3">
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
             <div className="mt-4">
               <ModernFormGrid cols={1}>
                 <FloatingInput
                   label="Nombre total de bureaux de vote prévus"
                   type="number"
                   value={formData.totalBureaux}
                   onChange={(e) => setFormData({...formData, totalBureaux: e.target.value})}
                   required
                 />
               </ModernFormGrid>
             </div>
          </ModernFormSection>
        );
      case 5:
        return (
          <ModernFormSection title="Chronogramme Électoral" description="Calendrier des opérations" icon={<Calendar className="w-5 h-5" />}>
            <ModernFormGrid cols={2}>
              <FloatingInput label="Affichage des listes (J-5)" type="date" value={formData.listDisplayDate} onChange={(e) => setFormData({...formData, listDisplayDate: e.target.value})} />
              <FloatingInput label="Début de campagne" type="date" value={formData.campaignStart} onChange={(e) => setFormData({...formData, campaignStart: e.target.value})} />
              <FloatingInput label="Fin de campagne" type="date" value={formData.campaignEnd} onChange={(e) => setFormData({...formData, campaignEnd: e.target.value})} />
              <FloatingInput label="Date 2nd Tour (+7J si besoin)" type="date" value={formData.secondRoundDate} onChange={(e) => setFormData({...formData, secondRoundDate: e.target.value})} />
              <FloatingInput label="Début des recours" type="date" value={formData.recoursStart} onChange={(e) => setFormData({...formData, recoursStart: e.target.value})} />
              <FloatingInput label="Fin des recours" type="date" value={formData.recoursEnd} onChange={(e) => setFormData({...formData, recoursEnd: e.target.value})} />
            </ModernFormGrid>
          </ModernFormSection>
        );
      case 6:
        return (
          <ModernFormSection title="Récapitulatif" description="Vérifiez les informations" icon={<Check className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Élection</h4>
                <p><strong>Nom:</strong> {formData.name}</p>
                <p><strong>Date 1er tour:</strong> {formData.date}</p>
                <p><strong>Entreprise:</strong> {formData.enterpriseName} ({formData.totalEmployees} salariés)</p>
              </div>
            </div>
          </ModernFormSection>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-gov-blue to-gov-blue-light p-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Configurer une Élection Professionnelle</h2>
            <p className="text-sm opacity-80">Étape {currentStep} sur {steps.length} : {steps[currentStep - 1]}</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/20"><X className="w-5 h-5" /></Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <ModernForm>
            {renderStep()}
          </ModernForm>
        </div>

        <div className="bg-gray-50 border-t p-4 flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
          </Button>
          {currentStep < steps.length ? (
            <Button onClick={handleNext} disabled={!canProceed()} className="bg-gov-blue hover:bg-gov-blue-dark text-white">
              Suivant <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white">
              <Check className="w-4 h-4 mr-1" /> Créer l'élection
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalElectionWizard;
