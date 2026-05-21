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
  const [currentStep, setCurrentStep] = useState(prefilledData && Object.keys(prefilledData).length > 0 ? 5 : 1);
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
      { id: '1', name: 'Cadre', type: 'cadres', voters: 0, seats: 1 },
      { id: '2', name: 'Maîtrise', type: 'employes', voters: 0, seats: 1 },
      { id: '3', name: 'Exécution', type: 'ouvriers', voters: 0, seats: 1 },
      { id: '4', name: 'Encadrement', type: 'general', voters: 0, seats: 1 }
    ],
    totalBureaux: prefilledData?.totalBureaux || '1',
    
    // Chronogramme
    listDisplayDate: prefilledData?.listDisplayDate || '',
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

  // Sécurité pour éviter le blocage du scroll et des clics (bug Radix Dialog)
  useEffect(() => {
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Auto-calculate dates based on election date
  useEffect(() => {
    if (formData.date) {
      const electionDate = new Date(formData.date);
      
      const listDisplay = new Date(electionDate);
      listDisplay.setDate(listDisplay.getDate() - 5);
      
      const secondRound = new Date(electionDate);
      secondRound.setDate(secondRound.getDate() + 7);
      
      const recoursStart = new Date(electionDate);
      recoursStart.setDate(recoursStart.getDate() + 1);
      
      const recoursEnd = new Date(recoursStart);
      recoursEnd.setDate(recoursEnd.getDate() + 2);

      setFormData(prev => ({
        ...prev,
        listDisplayDate: listDisplay.toISOString().split('T')[0],
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

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/modele_etablissements.xlsx';
    link.download = 'modele_etablissements.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Modèle d'établissements téléchargé avec succès");
  };

  const downloadListesTemplate = () => {
    const link = document.createElement('a');
    link.href = '/modele_listes.xlsx';
    link.download = 'modele_listes.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Modèle de listes syndicales téléchargé avec succès");
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

          let encadrementCount = 0;
          let cadreCount = 0;
          let maitriseCount = 0;
          let executionCount = 0;
          
          let encadrementSeats = 0;
          let cadreSeats = 0;
          let maitriseSeats = 0;
          let executionSeats = 0;
          let totalBureaux = 0;
          
          const votingCenters: any[] = [];
          const centerGroups: { [key: string]: any } = {};

          jsonData.forEach((row: any) => {
            const region = row["Region__Localisation"] || row["Région"] || "Général";
            const name = row["Nom_Etablissement__Site"] || row["Etablissement"] || "";
            const resp = row["Responsable_Etablissement"] || "";
            const phone = String(row["Contact_Telephone"] || "");
            const lieuVote = row["Lieu_vote"] || "";
            
            const vEncadrement = Number(row["Nbre_electeurs_Encadrement"] || 0);
            const vCadre = Number(row["Nbre_electeurs_Cadre"] || 0);
            const vMaitrise = Number(row["Nbre _electeurs_Maitrise"] || row["Nbre_electeurs_Maitrise"] || 0);
            const vExecution = Number(row["Nbre _electeurs_Execution"] || row["Nbre_electeurs_Execution"] || 0);

            const sEncadrement = Number(row["nb_sieges_Encadrement"] || 0);
            const sCadre = Number(row["nb_sieges_Cadre"] || 0);
            const sMaitrise = Number(row["nb_sieges_Maitrise"] || 0);
            const sExecution = Number(row["nb_sieges_Execution"] || 0);

            encadrementCount += vEncadrement;
            cadreCount += vCadre;
            maitriseCount += vMaitrise;
            executionCount += vExecution;
            
            encadrementSeats += sEncadrement;
            cadreSeats += sCadre;
            maitriseSeats += sMaitrise;
            executionSeats += sExecution;
            
            if (!name) return;

            const groupKey = `${region}_${name}`;
            if (!centerGroups[groupKey]) {
              centerGroups[groupKey] = {
                name: name,
                address: region,
                contactName: resp,
                contactPhone: phone,
                voters: 0,
                bureaux: 0,
                booths: []
              };
            }
            
            const totalRowVoters = vEncadrement + vCadre + vMaitrise + vExecution;
            centerGroups[groupKey].voters += totalRowVoters;
            centerGroups[groupKey].bureaux += 1;
            totalBureaux += 1;
            
            if (lieuVote) {
              if (vEncadrement > 0) centerGroups[groupKey].booths.push({ name: `${lieuVote} - Encadrement`, voters: vEncadrement, collegeType: 'general' });
              if (vCadre > 0) centerGroups[groupKey].booths.push({ name: `${lieuVote} - Cadre`, voters: vCadre, collegeType: 'cadres' });
              if (vMaitrise > 0) centerGroups[groupKey].booths.push({ name: `${lieuVote} - Maîtrise`, voters: vMaitrise, collegeType: 'employes' });
              if (vExecution > 0) centerGroups[groupKey].booths.push({ name: `${lieuVote} - Exécution`, voters: vExecution, collegeType: 'ouvriers' });
            }
          });
          
          Object.values(centerGroups).forEach((c: any) => votingCenters.push(c));

          const total = encadrementCount + cadreCount + maitriseCount + executionCount;

          // Mettre à jour les collèges
          const updatedColleges = formData.colleges.map(c => {
            if (c.type === 'general') return { ...c, voters: encadrementCount, seats: encadrementSeats || c.seats };
            if (c.type === 'cadres') return { ...c, voters: cadreCount, seats: cadreSeats || c.seats };
            if (c.type === 'employes') return { ...c, voters: maitriseCount, seats: maitriseSeats || c.seats };
            if (c.type === 'ouvriers') return { ...c, voters: executionCount, seats: executionSeats || c.seats };
            return c;
          });

          setFormData(prev => ({
            ...prev,
            totalEmployees: total.toString(),
            totalBureaux: totalBureaux.toString(),
            colleges: updatedColleges,
            votingCenters: votingCenters
          }));

          toast.success(`Fichier "${file.name}" analysé avec succès ! ${total} électeurs répartis par collèges.`);
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

  const handleListesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

          const candidates: any[] = [];
          jsonData.forEach((row: any) => {
            const unionAcronym = row["Acronyme_Representation"] || row["Sigle"] || "";
            const unionName = row["Representation"] || row["Nom"] || "";
            const etablissement = row["Etablissement"] || "";
            
            let college = "general";
            const collegeVal = String(row["College"] || "").toLowerCase();
            if (collegeVal.includes('cadre')) college = "cadres";
            else if (collegeVal.includes('maitrise') || collegeVal.includes('maîtrise')) college = "employes";
            else if (collegeVal.includes('execution') || collegeVal.includes('exécution')) college = "ouvriers";
            else if (collegeVal.includes('encadrement')) college = "general";
            
            const titulaireName = row["Titulaire"] || "";
            const titulaireGenre = row["Genre_Titulaire"] || "";
            const titulaireAnciennete = row["Anciennete_Titulaire"] || "";
            
            const suppleantName = row["Suppleant"] || row["Suppléant"] || "";
            const suppleantGenre = row["Genre_Suppleant"] || "";
            
            if (unionName || titulaireName) {
              candidates.push({
                party: unionAcronym || unionName,
                name: unionName || unionAcronym,
                collegeType: college,
                etablissement,
                candidates: [
                  { 
                    role: "Titulaire", 
                    name: titulaireName,
                    genre: titulaireGenre,
                    anciennete: titulaireAnciennete
                  },
                  { 
                    role: "Suppléant", 
                    name: suppleantName,
                    genre: suppleantGenre
                  }
                ]
              });
            }
          });

          setFormData(prev => ({ ...prev, candidates }));
          toast.success(`Fichier "${file.name}" analysé avec succès ! ${candidates.length} listes importées.`);
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
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      // onSuccess is handled by the parent component or not needed here because onSubmit already handles closing and toast
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
        return formData.enterpriseName.trim() !== '';
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
          </ModernFormSection>
        );
      case 2:
        return (
          <ModernFormSection title="L'Entreprise / Établissement" description="Informations sur l'employeur" icon={<Building className="w-5 h-5" />}>
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
            <ModernFormGrid cols={3}>
              <FloatingInput
                label="Tutelle"
                value={formData.administrativeUnit}
                onChange={(e) => setFormData({ ...formData, administrativeUnit: e.target.value })}
              />
              <FloatingInput
                label="Effectif Cadres (Facultatif)"
                type="number"
                value={formData.employeesCadres}
                onChange={(e) => setFormData({ ...formData, employeesCadres: e.target.value })}
              />
              <FloatingInput
                label="Effectif Agent de maîtrise (Facultatif)"
                type="number"
                value={formData.employeesEmployes}
                onChange={(e) => setFormData({ ...formData, employeesEmployes: e.target.value })}
              />
              <FloatingInput
                label="Effectif Employés et Ouvriers (Facultatif)"
                type="number"
                value={formData.employeesOuvriers}
                onChange={(e) => setFormData({ ...formData, employeesOuvriers: e.target.value })}
              />
            </ModernFormGrid>
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Effectif Total (Facultatif)"
                type="number"
                value={formData.totalEmployees}
                onChange={(e) => setFormData({ ...formData, totalEmployees: e.target.value })}
                disabled
                helperText="Ces effectifs pourront être précisés ultérieurement."
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
              <div className="mt-6 border-t pt-6">
               <h4 className="text-sm font-semibold text-gray-900 mb-2">Import des Établissements & Bureaux (Optionnel)</h4>
               <p className="text-xs text-gray-600 mb-4">Téléchargez le modèle Excel des établissements, remplissez-le et importez-le ici pour créer automatiquement la structure des électeurs et des sièges.</p>
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
                      Importer le fichier
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
              <div className="relative">
                <select
                  value={formData.hasSecondRound ? "Oui" : "Non"}
                  onChange={(e) => setFormData({...formData, hasSecondRound: e.target.value === "Oui"})}
                  className="block px-3 pb-2.5 pt-5 w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-0 focus:border-gov-blue peer"
                >
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
                <label className="absolute text-xs text-gray-500 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                  Deuxième tour prévisible (Oui/Non)
                </label>
              </div>
            </ModernFormGrid>

            <div className="mt-6 border-t pt-6">
               <h4 className="text-sm font-semibold text-gray-900 mb-2">Import des Listes Syndicales (Optionnel)</h4>
               <p className="text-xs text-gray-600 mb-4">Téléchargez le modèle Excel des listes, renseignez les candidats et importez-le ici.</p>
               <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="text-xs flex items-center gap-2 border-purple-600 text-purple-600 hover:bg-purple-50" 
                    onClick={downloadListesTemplate}
                  >
                    <Download className="w-4 h-4" />
                    Télécharger le modèle Listes
                  </Button>
                  <div>
                    <input 
                      type="file" 
                      id="listes-upload" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      onChange={handleListesUpload}
                    />
                    <label 
                      htmlFor="listes-upload" 
                      className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Importer les listes
                    </label>
                  </div>
               </div>
            </div>
          </ModernFormSection>
        );
      case 5:
        return (
          <ModernFormSection title="Récapitulatif" description="Vérifiez les informations" icon={<Check className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Image de couverture</h4>
                <ImageUploader 
                  onUploadSuccess={(url) => setFormData({ ...formData, coverImage: url })}
                  defaultValue={formData.coverImage}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Informations de l'Élection</h4>
                  <p><strong>Nom:</strong> {formData.name || 'Non renseigné'}</p>
                  <p><strong>Date 1er tour:</strong> {formData.date || 'Non renseignée'}</p>
                  <p><strong>Entreprise:</strong> {formData.enterpriseName || 'Non renseignée'}</p>
                  <p><strong>Secteur d'activité:</strong> {formData.enterpriseSector === 'prive' ? 'Privé' : formData.enterpriseSector === 'public' ? 'Public' : 'Parapublic'}</p>
                  {formData.administrativeUnit && (
                    <p><strong>Tutelle:</strong> {formData.administrativeUnit}</p>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Ressources Humaines</h4>
                  <p><strong>Nom du RH:</strong> {formData.hrName || 'Non renseigné'}</p>
                  <p><strong>Téléphone RH:</strong> {formData.hrPhone || 'Non renseigné'}</p>
                  <p><strong>Email RH:</strong> {formData.hrEmail || 'Non renseigné'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Chronogramme Électoral</h4>
                  <p><strong>Affichage des listes:</strong> {formData.listDisplayDate || 'Non renseigné'}</p>
                  <p><strong>Deuxième tour prévisible:</strong> {formData.hasSecondRound ? 'Oui' : 'Non'}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-700">
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Collèges Électoraux</h4>
                  {formData.colleges && formData.colleges.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-1">
                      {formData.colleges.map((c, i) => (
                        <li key={i}>{c.name} ({c.type})</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">Aucun collège configuré</p>
                  )}
                </div>
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
