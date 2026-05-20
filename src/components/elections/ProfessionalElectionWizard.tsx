import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Check, Building, Calendar, Briefcase, FileText, Download, Upload } from 'lucide-react';
import { ModernForm, ModernFormSection, ModernFormGrid } from '@/components/ui/modern-form';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { toast } from 'sonner';
import ImageUploader from '@/components/ui/ImageUploader';

interface ProfessionalElectionWizardProps {
  onClose: () => void;
  onSubmit?: (election: any) => void;
  onSuccess?: () => void;
  prefilledData?: any;
}

const ProfessionalElectionWizard: React.FC<ProfessionalElectionWizardProps> = ({ onClose, onSubmit, onSuccess, prefilledData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    'Informations',
    'Entreprise',
    'Collèges & Bureaux',
    'Chronogramme',
    'Récapitulatif'
  ];

  const [formData, setFormData] = useState({
    name: prefilledData?.name || '',
    type: prefilledData?.type || 'Élection Professionnelle',
    date: prefilledData?.date || '',
    legalFramework: prefilledData?.legalFramework || 'LOI-022-2021 + Arrêté 000147',
    
    // Entreprise
    enterpriseName: prefilledData?.enterpriseName || '',
    enterpriseSector: prefilledData?.enterpriseSector || 'prive',
    administrativeUnit: prefilledData?.administrativeUnit || '',
    totalEmployees: prefilledData?.totalEmployees || '',
    employeesCadres: prefilledData?.employeesCadres || '0',
    employeesEmployes: prefilledData?.employeesEmployes || '0',
    employeesOuvriers: prefilledData?.employeesOuvriers || '0',
    hrName: prefilledData?.hrName || '',
    hrPhone: prefilledData?.hrPhone || '',
    hrEmail: prefilledData?.hrEmail || '',
    
    // Collèges
    colleges: prefilledData?.colleges || [
      { id: '1', name: 'Cadres', type: 'cadres', voters: 0, seats: 1 },
      { id: '2', name: 'Agent de maîtrise', type: 'employes', voters: 0, seats: 1 },
      { id: '3', name: 'Employés et Ouvriers', type: 'ouvriers', voters: 0, seats: 1 }
    ],
    totalBureaux: prefilledData?.totalBureaux || '1',
    
    // Chronogramme
    listDisplayDate: prefilledData?.listDisplayDate || '',
    campaignStart: prefilledData?.campaignStart || '',
    campaignEnd: prefilledData?.campaignEnd || '',
    hasSecondRound: prefilledData?.hasSecondRound !== undefined ? prefilledData.hasSecondRound : true,
    secondRoundDate: prefilledData?.secondRoundDate || '',
    recoursStart: prefilledData?.recoursStart || '',
    recoursEnd: prefilledData?.recoursEnd || '',
    coverImage: prefilledData?.coverImage || '',
    carence: prefilledData?.carence !== undefined ? prefilledData.carence : false,

    // Données d'import supplémentaires
    votingCenters: prefilledData?.votingCenters || [],
    candidates: prefilledData?.candidates || []
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

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const headers = ["Matricule", "Nom", "Prénom", "Genre", "Poste", "Collège"];
      const examples = [
        ["MAT001", "Mba", "Jean", "M", "Directeur Technique", "Cadres"],
        ["MAT002", "Ndong", "Sylvie", "F", "Chef d'équipe", "Agent de maîtrise"],
        ["MAT003", "Obame", "Pierre", "M", "Opérateur de saisie", "Employés et Ouvriers"],
        ["MAT004", "Kassa", "Aline", "F", "Technicien de surface", "Employés et Ouvriers"]
      ];

      const wsData = [headers, ...examples];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Liste Électorale");

      XLSX.writeFile(wb, "modele_liste_electorale.xlsx");
      toast.success("Modèle de liste électorale téléchargé avec succès (format Excel .xlsx)");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création du modèle Excel.");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          if (!data) return;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          if (!jsonData || jsonData.length === 0) {
            toast.error("Le fichier Excel semble vide ou mal formaté.");
            return;
          }

          let cadresCount = 0;
          let maitriseCount = 0;
          let employesOuvriersCount = 0;
          let employesCount = 0;
          let ouvriersCount = 0;

          jsonData.forEach((row: any) => {
            const college = String(row["Collège"] || row["college"] || "").trim().toLowerCase();
            const poste = String(row["Poste"] || row["poste"] || "").trim().toLowerCase();

            if (college.includes("cadre")) {
              cadresCount++;
            } else if (college.includes("maîtrise") || college.includes("maitrise") || college.includes("agent")) {
              maitriseCount++;
              employesCount++;
            } else if (college.includes("ouvrier") || poste.includes("ouvrier")) {
              ouvriersCount++;
              employesOuvriersCount++;
            } else {
              employesCount++;
              employesOuvriersCount++;
            }
          });

          const total = cadresCount + employesCount + ouvriersCount;
          const totalCollegesVoters = cadresCount + maitriseCount + employesOuvriersCount;

          // Mettre à jour les collèges
          const updatedColleges = formData.colleges.map(c => {
            if (c.type === 'cadres') return { ...c, voters: cadresCount };
            if (c.type === 'employes') return { ...c, voters: maitriseCount };
            if (c.type === 'ouvriers') return { ...c, voters: employesOuvriersCount };
            return c;
          });

          setFormData(prev => ({
            ...prev,
            totalEmployees: total.toString(),
            employeesCadres: cadresCount.toString(),
            employeesEmployes: employesCount.toString(),
            employeesOuvriers: ouvriersCount.toString(),
            colleges: updatedColleges
          }));

          toast.success(`Fichier "${file.name}" analysé avec succès ! ${total} salariés et ${totalCollegesVoters} électeurs répartis par collèges.`);
        } catch (err) {
          console.error(err);
          toast.error("Erreur lors de la lecture des données Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.error("Erreur d'importation du parser Excel.");
    } finally {
      e.target.value = ''; // Reset input to allow re-upload
    }
  };

  const handleSubmit = async () => {
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      
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
        return formData.enterpriseName.trim() !== '' && parseInt(formData.totalEmployees) >= 10;
      case 3:
        return parseInt(formData.totalBureaux) > 0;
      case 4:
        return true;
      case 5:
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
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Date du scrutin (1er tour)"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </ModernFormGrid>

            <div className="mt-4">
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
                label="Effectif Agent de maîtrise"
                type="number"
                value={formData.employeesEmployes}
                onChange={(e) => setFormData({ ...formData, employeesEmployes: e.target.value })}
              />
              <FloatingInput
                label="Effectif Employés et Ouvriers"
                type="number"
                value={formData.employeesOuvriers}
                onChange={(e) => setFormData({ ...formData, employeesOuvriers: e.target.value })}
              />
            </ModernFormGrid>
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
          <ModernFormSection title="Collèges & Bureaux" description="Configuration des collèges électoraux" icon={<Briefcase className="w-5 h-5" />}>
             <div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
               <strong>Information :</strong> Sont électeurs les salariés âgés de seize (16) ans accomplis, ayant travaillé au moins six (6) mois dans l'entreprise, non frappés d'une incapacité électorale.
             </div>
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
             
             <div className="mt-6 border-t pt-6">
               <h4 className="text-sm font-semibold text-gray-900 mb-2">Import de la liste électorale (Optionnel)</h4>
               <p className="text-xs text-gray-600 mb-4">Téléchargez le modèle Excel, remplissez-le avec les informations des salariés (nom, prénom, collège, etc.) et importez-le ici pour automatiser la création du fichier électoral.</p>
               <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="text-xs flex items-center gap-2 border-gov-blue text-gov-blue hover:bg-gov-blue/5" 
                    onClick={downloadTemplate}
                  >
                    <Download className="w-4 h-4" />
                    Télécharger le modèle
                  </Button>
                  <div>
                    <input 
                      type="file" 
                      id="excel-upload" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      onChange={handleExcelUpload}
                    />
                    <label 
                      htmlFor="excel-upload" 
                      className="cursor-pointer bg-gov-blue hover:bg-gov-blue-dark text-white px-4 py-2 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Importer la liste remplie
                    </label>
                  </div>
               </div>
             </div>
          </ModernFormSection>
        );
      case 4:
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
      case 5:
        return (
          <ModernFormSection title="Récapitulatif" description="Vérifiez les informations" icon={<Check className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                <h4 className="font-semibold text-gray-900 mb-2">Élection</h4>
                <p><strong>Nom:</strong> {formData.name}</p>
                <p><strong>Date 1er tour:</strong> {formData.date}</p>
                <p><strong>Entreprise:</strong> {formData.enterpriseName} ({formData.totalEmployees} salariés)</p>
                {formData.administrativeUnit && (
                  <p><strong>Unité Administrative:</strong> {formData.administrativeUnit}</p>
                )}
                <p><strong>Secteur d'activité:</strong> {formData.enterpriseSector === 'prive' ? 'Privé' : formData.enterpriseSector === 'public' ? 'Public' : 'Parapublic'}</p>
              </div>

              {formData.votingCenters && formData.votingCenters.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2">Établissements & Bureaux importés ({formData.votingCenters.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {formData.votingCenters.map((vc: any, idx: number) => (
                      <div key={idx} className="border-b pb-1 last:border-0 text-xs">
                        <p><strong>{vc.name}</strong> ({vc.address}) - {vc.bureaux} bureau(x) / {vc.voters} électeurs</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.candidates && formData.candidates.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2">Candidats & Syndicats importés ({formData.candidates.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {formData.candidates.map((cand: any, idx: number) => (
                      <div key={idx} className="border-b pb-1 last:border-0 text-xs">
                        <p>
                          <strong>{cand.unionAcronym ? `[${cand.unionAcronym}] ` : ''}{cand.unionName}</strong> 
                          {cand.college ? ` (Collège ${cand.college})` : ''} : 
                          Titulaire : <em>{cand.titulaireName || 'Aucun'}</em> / Suppléant : <em>{cand.suppleantName || 'Aucun'}</em>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
