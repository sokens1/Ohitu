import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Check, Building, Calendar, Briefcase, FileText, Download, Upload } from 'lucide-react';
import { ModernForm, ModernFormSection, ModernFormGrid } from '@/components/ui/modern-form';
import FloatingInput from '@/components/ui/floating-input';
import FloatingSelect from '@/components/ui/floating-select';
import { toast } from 'sonner';
import { parseUnionListsSheet, parseEstablishmentsSheet } from '@/utils/excelImport';
// Import des utilitaires d'importation Excel pour l'élection professionnelle
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
    provinceName: prefilledData?.provinceName || '',
    communeName: prefilledData?.communeName || '',
    hrContactName: prefilledData?.hrContactName || '',
    hrContactPhone: prefilledData?.hrContactPhone || '',
    hrContactEmail: prefilledData?.hrContactEmail || '',
    
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
      secondRound.setDate(secondRound.getDate() + 9);
      
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

  // Recalculer les électeurs/sièges des collèges depuis les établissements importés
  useEffect(() => {
    if (!formData.votingCenters || formData.votingCenters.length === 0) return;
    const map: Record<string, { voters: number; seats: number }> = {};
    for (const center of formData.votingCenters) {
      for (const booth of (center.booths || [])) {
        if (booth.is_college) {
          const ct: string = booth.college || booth.college_type || 'general';
          if (!map[ct]) map[ct] = { voters: 0, seats: 0 };
          map[ct].voters += Number(booth.registered_voters) || 0;
          map[ct].seats  += Number(booth.seats_to_fill)    || 0;
        }
      }
    }
    setFormData(prev => ({
      ...prev,
      colleges: prev.colleges.map(c => ({
        ...c,
        voters: map[c.type]?.voters ?? c.voters,
        seats:  map[c.type]?.seats  ?? c.seats,
      }))
    }));
  }, [formData.votingCenters]);

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
    link.download = 'listes.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Modèle listes.xlsx téléchargé (feuille « Listes »)');
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
          const parsedCenters = await parseEstablishmentsSheet(workbook, true);

          if (!parsedCenters || parsedCenters.length === 0) {
            toast.error("Le fichier Excel semble vide ou mal formaté.");
            return;
          }

          let encadrementSeats = 0;
          let cadreSeats = 0;
          let maitriseSeats = 0;
          let executionSeats = 0;
          let totalBureaux = 0;

          parsedCenters.forEach((center) => {
            const physicalBooths = center.booths.filter((b: any) => !b.is_college);
            totalBureaux += physicalBooths.length;

            center.booths.forEach((booth: any) => {
              if (booth.is_college) {
                if (booth.name === 'College - Encadrement') encadrementSeats += booth.seats_to_fill || 0;
                if (booth.name === 'College - Cadre') cadreSeats += booth.seats_to_fill || 0;
                if (booth.name === 'College - Maîtrise') maitriseSeats += booth.seats_to_fill || 0;
                if (booth.name === 'College - Exécution') executionSeats += booth.seats_to_fill || 0;
              }
            });
          });

          const updatedColleges = formData.colleges.map(c => {
            if (c.type === 'general') return { ...c, voters: 0, seats: encadrementSeats || c.seats };
            if (c.type === 'cadres') return { ...c, voters: 0, seats: cadreSeats || c.seats };
            if (c.type === 'employes') return { ...c, voters: 0, seats: maitriseSeats || c.seats };
            if (c.type === 'ouvriers') return { ...c, voters: 0, seats: executionSeats || c.seats };
            return c;
          });

          const votingCenters = parsedCenters.map((center) => ({
            name: center.name,
            address: center.address,
            contactName: center.contact_name,
            contactPhone: center.contact_phone,
            voters: center.voters,
            bureaux: center.bureaux,
            booths: center.booths.map((booth: any) => ({
              name: booth.name,
              voters: booth.registered_voters || 0,
              registered_voters: booth.registered_voters || 0,
              seats_to_fill: booth.seats_to_fill || 0,
              is_college: booth.is_college || false
            }))
          }));

          setFormData(prev => ({
            ...prev,
            totalEmployees: '0',
            totalBureaux: totalBureaux.toString(),
            colleges: updatedColleges,
            votingCenters: votingCenters
          }));

          toast.success(`Fichier "${file.name}" analysé avec succès ! ${totalBureaux} bureau(x) physique(s) détecté(s).`);
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
          const parsedLists = await parseUnionListsSheet(workbook, true);

          if (parsedLists.length === 0) {
            toast.error('Aucune liste dans le fichier. Remplissez des lignes sous les en-têtes (feuille « Listes »).');
            return;
          }

          // Group by union & college to combine multiple titulaires/suppleants
          const groupedMap = new Map<string, {
            party: string;
            name: string;
            collegeType: typeof parsedLists[0]['college'];
            etablissement: string;
            candidates: Array<{ role: string; name: string; genre?: string; anciennete?: string }>;
          }>();

          for (const list of parsedLists) {
            const key = `${(list.unionAcronym || '').trim()}|||${(list.unionName || '').trim()}|||${list.college}`;
            if (!groupedMap.has(key)) {
              groupedMap.set(key, {
                party: list.unionAcronym || list.unionName,
                name: list.unionName,
                collegeType: list.college,
                etablissement: list.etablissement,
                candidates: []
              });
            }

            const group = groupedMap.get(key)!;

            if (list.titulaireName) {
              const rank = group.candidates.filter(c => c.role.startsWith('Titulaire') || c.role === 'Tête de liste').length + 1;
              const role = rank === 1 ? 'Tête de liste' : `Titulaire ${rank}`;
              group.candidates.push({
                role,
                name: list.titulaireName,
                genre: list.titulaireGenre || undefined,
                anciennete: list.titulaireAnciennete || undefined
              });
            }

            if (list.suppleantName) {
              const rank = group.candidates.filter(c => c.role.startsWith('Suppléant')).length + 1;
              const role = `Suppléant ${rank}`;
              group.candidates.push({
                role,
                name: list.suppleantName,
                genre: list.suppleantGenre || undefined
              });
            }
          }

          const candidates = Array.from(groupedMap.values());

          setFormData(prev => ({ ...prev, candidates }));
          toast.success(`Fichier "${file.name}" analysé : ${candidates.length} liste(s).`);
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
                label="Province / Région"
                value={formData.provinceName}
                onChange={(e) => setFormData({ ...formData, provinceName: e.target.value })}
              />
              <FloatingInput
                label="Commune / Ville"
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
                value={formData.hrContactEmail}
                onChange={(e) => setFormData({ ...formData, hrContactEmail: e.target.value })}
              />
            </ModernFormGrid>
            <ModernFormGrid cols={1}>
              <FloatingInput
                label="Effectif Total"
                type="number"
                value={formData.totalEmployees}
                onChange={(e) => setFormData({ ...formData, totalEmployees: e.target.value })}
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
               {formData.colleges.map((college) => (
                 <div key={college.id} className="p-3 border rounded-lg bg-gray-50 flex items-center gap-4">
                    <div className="font-medium w-1/4">{college.name}</div>
                    <div className="w-1/3">
                      <FloatingInput
                        label="Nombre d'électeurs"
                        type="number"
                        value={college.voters.toString()}
                        disabled
                      />
                    </div>
                    <div className="w-1/3">
                      <FloatingInput
                        label="Sièges à pourvoir"
                        type="number"
                        value={college.seats.toString()}
                        disabled
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
                  <p><strong>Nom du RH:</strong> {formData.hrContactName || 'Non renseigné'}</p>
                  <p><strong>Téléphone RH:</strong> {formData.hrContactPhone || 'Non renseigné'}</p>
                  <p><strong>Email RH:</strong> {formData.hrContactEmail || 'Non renseigné'}</p>
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
