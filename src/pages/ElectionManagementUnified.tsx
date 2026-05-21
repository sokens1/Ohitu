/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useElectionState } from '@/hooks/useElectionState';
import { Election, CreateElectionData } from '@/types/elections';
import { validateCreateElection, formatValidationErrors } from '@/lib/validation/electionSchemas';
import { useAudit } from '@/hooks/useAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Calendar, 
  Users, 
  MapPin, 
  Building,
  Eye,
  ArrowRight,
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  X,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  Copy,
  FileDown,
  RefreshCcw,
  TrendingUp,
  Upload
} from 'lucide-react';
import ElectionWizard from '@/components/elections/ElectionWizard';
import ProfessionalElectionWizard from '@/components/elections/ProfessionalElectionWizard';
import ElectionDetailView from '@/components/elections/ElectionDetailView';
import EditElectionModal from '@/components/elections/EditElectionModal';
import EditProfessionalElectionModal from '@/components/elections/EditProfessionalElectionModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';

const ElectionManagementUnified = () => {
  const { user } = useAuth();
  const { can, isGlobalAdmin, assignedElectionIds } = useRBAC();
  const {
    elections,
    selectedElection,
    loading,
    error,
    statistics,
    setLoading,
    setError,
    setElections,
    addElection,
    updateElection,
    deleteElection,
    setSelectedElection,
    setFilters,
    setSearchQuery,
  } = useElectionState();
  const { logCreate, logUpdate, logDelete, logExport } = useAudit();

  const [showWizard, setShowWizard] = useState(false);
  const [showProWizard, setShowProWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingElection, setEditingElection] = useState<Election | null>(null);
  const [searchQuery, setSearchQueryLocal] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [electionToDelete, setElectionToDelete] = useState<Election | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States pour le choix du mode de création (manuel vs import)
  const [showCreationModeModal, setShowCreationModeModal] = useState(false);
  const [selectedElectionCategory, setSelectedElectionCategory] = useState<'political' | 'professional'>('political');
  const [prefilledData, setPrefilledData] = useState<any>(null);


  // Télécharger un modèle Excel (.xlsx)
  const downloadXLSXTemplate = async (category: 'political' | 'professional') => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      if (category === 'professional') {
        const configData = [
          { Key: "Nom de l'élection", Value: "Élection Professionnelle SEEG 2026" },
          { Key: "Raison Sociale", Value: "Société d'Énergie et d'Eau du Gabon" },
          { Key: "Numéro Enregistrement", Value: "RG-4920492" },
          { Key: "Secteur (Privé, Parapublic, Public)", Value: "Privé" },
          { Key: "Unité Administrative (Ministère de rattachement)", Value: "" },
          { Key: "Nom RH", Value: "Jean Dupont" },
          { Key: "Téléphone RH", Value: "+24166123456" },
          { Key: "Email RH", Value: "j.dupont@seeg.ga" },
          { Key: "Date du scrutin (AAAA-MM-JJ)", Value: "2026-06-20" },
          { Key: "Affichage listes (AAAA-MM-JJ)", Value: "2026-06-01" },
          { Key: "Début campagne (AAAA-MM-JJ)", Value: "2026-06-05" },
          { Key: "Fin campagne (AAAA-MM-JJ)", Value: "2026-06-15" },
          { Key: "Deuxième tour (Oui/Non)", Value: "Oui" }
        ];

        const collegesData = [
          { "Nom du collège": "Cadre", Code: "cadres" },
          { "Nom du collège": "Maîtrise", Code: "employes" },
          { "Nom du collège": "Exécution", Code: "ouvriers" },
          { "Nom du collège": "Encadrement", Code: "general" }
        ];

        const establishmentsData = [
          { 
            "Région / Localisation": "Estuaire", 
            "Nom Établissement / Site": "Siège Social Libreville", 
            "Responsable Établissement": "Marc Ondo", 
            "Contact Téléphone": "+24177123456",
            "Nom Bureau de vote": "Bureau A - Rez de chaussée",
            "Nombre d'électeurs": 250,
            "Collège concerné": "Employés et Ouvriers"
          },
          { 
            "Région / Localisation": "Estuaire", 
            "Nom Établissement / Site": "Siège Social Libreville", 
            "Responsable Établissement": "Marc Ondo", 
            "Contact Téléphone": "+24177123456",
            "Nom Bureau de vote": "Bureau B - 1er étage",
            "Nombre d'électeurs": 150,
            "Collège concerné": "Agent de maîtrise"
          },
          { 
            "Région / Localisation": "Haut-Ogooué", 
            "Nom Établissement / Site": "Agence Franceville", 
            "Responsable Établissement": "Lucie Mba", 
            "Contact Téléphone": "+24166987654",
            "Nom Bureau de vote": "Bureau Unique - Franceville",
            "Nombre d'électeurs": 115,
            "Collège concerné": "general"
          }
        ];

        const candidatesData = [
          {
            "Sigle Syndicat": "COSYG",
            "Nom Complet Syndicat": "Confédération Syndicale Gabonaise",
            "Collège concerné": "ouvriers",
            "Nom complet du Titulaire": "Pierre Mba",
            "Nom complet du Suppléant": "Charles Obiang"
          },
          {
            "Sigle Syndicat": "SYLSEEG",
            "Nom Complet Syndicat": "Syndicat Libre des Employés de la SEEG",
            "Collège concerné": "employes",
            "Nom complet du Titulaire": "Marie-Claire Eyeghe",
            "Nom complet du Suppléant": "Alain Ndong"
          },
          {
            "Sigle Syndicat": "COSYG",
            "Nom Complet Syndicat": "Confédération Syndicale Gabonaise",
            "Collège concerné": "cadres",
            "Nom complet du Titulaire": "Christian Bignoumba",
            "Nom complet du Suppléant": "Sylvie Kombila"
          }
        ];

        const wsConfig = XLSX.utils.json_to_sheet(configData);
        const wsColleges = XLSX.utils.json_to_sheet(collegesData);
        const wsEstablishments = XLSX.utils.json_to_sheet(establishmentsData);
        const wsCandidates = XLSX.utils.json_to_sheet(candidatesData);

        XLSX.utils.book_append_sheet(wb, wsConfig, "Configuration");
        XLSX.utils.book_append_sheet(wb, wsColleges, "Collèges");
        XLSX.utils.book_append_sheet(wb, wsEstablishments, "Établissements & Bureaux");
        XLSX.utils.book_append_sheet(wb, wsCandidates, "Candidats & Syndicats");
      } else {
        const configData = [
          { Key: "Nom de l'élection", Value: "Législatives 2026 - Siège unique Moanda" },
          { Key: "Type d'élection", Value: "Législatives" },
          { Key: "Date du scrutin (AAAA-MM-JJ)", Value: "2026-06-20" },
          { Key: "Sièges disponibles", Value: 1 },
          { Key: "Budget (FCFA)", Value: 50000000 },
          { Key: "Objectif de voix", Value: 8000 },
          { Key: "Province", Value: "Haut-Ogooué" },
          { Key: "Commune", Value: "Moanda" },
          { Key: "Arrondissement", Value: "1er Arrondissement" }
        ];

        const wsConfig = XLSX.utils.json_to_sheet(configData);
        XLSX.utils.book_append_sheet(wb, wsConfig, "Configuration");
      }

      XLSX.writeFile(wb, `modele_configuration_${category}.xlsx`);
      toast.success("Modèle de configuration Excel téléchargé !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la génération du modèle Excel.");
    }
  };

  // Parser le fichier Excel
  const parseXLSXConfig = async (file: File, category: 'political' | 'professional'): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      try {
        const XLSX = await import('xlsx');
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            if (!data) {
              reject(new Error("Fichier vide"));
              return;
            }
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Lire la feuille Configuration
            const configSheet = workbook.Sheets["Configuration"];
            if (!configSheet) {
              reject(new Error("La feuille 'Configuration' est manquante."));
              return;
            }
            const configRows = XLSX.utils.sheet_to_json<any>(configSheet);
            
            // Mapper les clés-valeurs en objet simple
            const configMap: any = {};
            configRows.forEach((row: any) => {
              const key = String(row.Key || row.Clé || row.column1 || "").trim();
              const val = row.Value || row.Valeur || row.column2;
              if (key) {
                configMap[key] = val;
              }
            });

            if (category === 'professional') {
              // Lire la feuille Collèges
              const collegesSheet = workbook.Sheets["Collèges"];
              const colleges: any[] = [];
              if (collegesSheet) {
                const collegesRows = XLSX.utils.sheet_to_json<any>(collegesSheet);
                collegesRows.forEach((row: any, index: number) => {
                  const name = row["Nom du collège"] || row["Nom"] || "";
                  const type = row["Code"] || row["Type"] || "";
                  const voters = Number(row["Nombre d'électeurs"] || row["Nombre de votants"] || row["Votants"] || 0);
                  const seats = Number(row["Sièges à pourvoir"] || row["Sièges"] || 1);
                  colleges.push({
                    id: String(index + 1),
                    name,
                    type,
                    voters,
                    seats
                  });
                });
              }

              // 1. Lire la feuille Établissements & Bureaux
              const estSheet = workbook.Sheets["Établissements & Bureaux"] || workbook.Sheets["Etablissements & Bureaux"] || workbook.Sheets["Établissements et Bureaux"] || workbook.Sheets["Etablissements et Bureaux"];
              const votingCenters: any[] = [];
              if (estSheet) {
                const estRows = XLSX.utils.sheet_to_json<any>(estSheet);
                
                // On va grouper par Établissement/Site pour créer un voting_center avec ses bureaux
                const centerGroups: { [key: string]: any } = {};
                estRows.forEach((row: any) => {
                  const region = row["Région / Localisation"] || row["Région"] || row["Province"] || "Général";
                  const name = row["Nom Établissement / Site"] || row["Nom Établissement"] || row["Site"] || row["Etablissement"] || "";
                  const resp = row["Responsable Établissement"] || row["Responsable"] || "";
                  const phone = String(row["Contact Téléphone"] || row["Téléphone"] || row["Contact"] || "");
                  const boothName = row["Nom Bureau de vote"] || row["Nom Bureau"] || row["Bureau"] || "";
                  const voters = Number(row["Nombre d'électeurs"] || row["Votants"] || row["Electeurs"] || 0);
                  const college = row["Collège concerné"] || row["College"] || "general";
                  
                  if (!name) return; // ignore invalid rows

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
                  
                  centerGroups[groupKey].voters += voters;
                  centerGroups[groupKey].bureaux += 1;
                  if (boothName) {
                    centerGroups[groupKey].booths.push({
                      name: boothName,
                      voters: voters,
                      collegeType: college.toLowerCase().trim()
                    });
                  }
                });
                
                Object.values(centerGroups).forEach((c: any) => {
                  votingCenters.push(c);
                });
              }

              // 2. Lire la feuille Candidats & Syndicats
              const candSheet = workbook.Sheets["Candidats & Syndicats"] || workbook.Sheets["Candidats"] || workbook.Sheets["Candidats et Syndicats"];
              const candidates: any[] = [];
              if (candSheet) {
                const candRows = XLSX.utils.sheet_to_json<any>(candSheet);
                candRows.forEach((row: any) => {
                  const unionAcronym = row["Sigle Syndicat"] || row["Sigle"] || row["Acronyme"] || "";
                  const unionName = row["Nom Complet Syndicat"] || row["Nom Syndicat"] || row["Syndicat"] || "";
                  const college = row["Collège concerné"] || row["Collège"] || row["College"] || "general";
                  const titulaireName = row["Nom complet du Titulaire"] || row["Titulaire"] || "";
                  const suppleantName = row["Nom complet du Suppléant"] || row["Suppléant"] || row["Suppleant"] || "";
                  
                  if (!unionName && !unionAcronym) return;

                  candidates.push({
                    unionAcronym,
                    unionName: unionName || unionAcronym,
                    college: college.toLowerCase().trim(),
                    titulaireName,
                    suppleantName
                  });
                });
              }

              const rawSector = String(configMap["Secteur (Privé, Parapublic, Public)"] || configMap["Secteur"] || configMap["Secteur Activité"] || "").trim().toLowerCase();
              let sector = 'prive';
              if (rawSector.includes('public') && !rawSector.includes('para')) {
                sector = 'public';
              } else if (rawSector.includes('para')) {
                sector = 'parapublic';
              }

              const cadres = String(configMap["Effectif Cadres"] ?? '0').trim();
              const employes = String(configMap["Effectif Employés"] ?? configMap["Effectif Agent de maîtrise"] ?? '0').trim();
              const ouvriers = String(configMap["Effectif Ouvriers"] ?? configMap["Effectif Employés et Ouvriers"] ?? '0').trim();
              const total = (Number(cadres) + Number(employes) + Number(ouvriers)).toString();

              const computedBureaux = votingCenters.reduce((sum: number, vc: any) => sum + (vc.bureaux || 0), 0);
              const totalBureaux = computedBureaux > 0 ? computedBureaux.toString() : (configMap["Nombre total de bureaux"] || configMap["Bureaux"] || "1").toString();

              resolve({
                name: configMap["Nom de l'élection"] || configMap["Nom"] || "",
                enterpriseName: configMap["Raison Sociale"] || configMap["Entreprise"] || "",
                numEnregistrement: configMap["Numéro Enregistrement"] || configMap["N° Enregistrement"] || "",
                enterpriseSector: sector,
                administrativeUnit: configMap["Unité Administrative (Ministère de rattachement)"] || configMap["Unité Administrative"] || "",
                employeesCadres: cadres,
                employeesEmployes: employes,
                employeesOuvriers: ouvriers,
                totalEmployees: total,
                hrName: configMap["Nom RH"] || "",
                hrPhone: String(configMap["Téléphone RH"] || ""),
                hrEmail: configMap["Email RH"] || "",
                date: configMap["Date du scrutin (AAAA-MM-JJ)"] || configMap["Date scrutin"] || "",
                listDisplayDate: configMap["Affichage listes (AAAA-MM-JJ)"] || configMap["Affichage listes"] || "",
                campaignStart: configMap["Début campagne (AAAA-MM-JJ)"] || configMap["Début campagne"] || "",
                campaignEnd: configMap["Fin campagne (AAAA-MM-JJ)"] || configMap["Fin campagne"] || "",
                hasSecondRound: String(configMap["Deuxième tour (Oui/Non)"] || "").toLowerCase() === 'oui',
                colleges: colleges.length > 0 ? colleges : undefined,
                votingCenters: votingCenters.length > 0 ? votingCenters : undefined,
                candidates: candidates.length > 0 ? candidates : undefined,
                totalBureaux: totalBureaux
              });
            } else {
              resolve({
                name: configMap["Nom de l'élection"] || configMap["Nom"] || "",
                type: configMap["Type d'élection"] || configMap["Type"] || "",
                date: configMap["Date du scrutin (AAAA-MM-JJ)"] || configMap["Date"] || "",
                seatsAvailable: Number(configMap["Sièges disponibles"] || configMap["Sièges"] || 1),
                budget: Number(configMap["Budget (FCFA)"] || configMap["Budget"] || 0),
                voteGoal: Number(configMap["Objectif de voix"] || configMap["Objectif"] || 0),
                province: configMap["Province"] || "",
                commune: configMap["Commune"] || "",
                arrondissement: configMap["Arrondissement"] || ""
              });
            }
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        reject(err);
      }
    });
  };

  // Gérer l'importation de fichier
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      let importedData: any = null;
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        importedData = await parseXLSXConfig(file, selectedElectionCategory);
      } else {
        toast.error("Format de fichier non pris en charge. Veuillez utiliser un fichier Excel (.xlsx ou .xls)");
        return;
      }
      
      if (!importedData) {
        throw new Error("Impossible de lire les données du fichier.");
      }
      
      // Valider les champs obligatoires minimaux
      if (!importedData.name) {
        throw new Error("Le champ 'name' (Nom de l'élection) est obligatoire dans le fichier de configuration.");
      }
      
      // Pré-remplir et ouvrir le bon assistant
      setPrefilledData(importedData);
      setShowCreationModeModal(false);
      
      if (selectedElectionCategory === 'political') {
        setShowWizard(true);
      } else {
        setShowProWizard(true);
      }
      
      toast.success(`Fichier de configuration "${file.name}" chargé avec succès dans l'assistant !`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur d'importation : ${err.message || 'Fichier mal formaté'}`);
    } finally {
      // Réinitialiser la valeur du file input pour permettre de ré-importer le même fichier
      e.target.value = '';
    }
  };

  // Fonction pour recalculer automatiquement le nombre d'électeurs d'une élection
  const recalculateElectionVoters = useCallback(async (electionId: string) => {
    try {
      const { data: centersData } = await supabase
        .from('election_centers')
        .select(`
          voting_centers (
            id,
            total_voters,
            voting_bureaux (
              registered_voters
            )
          )
        `)
        .eq('election_id', electionId);
      let totalElecteurs = 0;
      let hasCenters = false;
      
      if (centersData && centersData.length > 0) {
        centersData.forEach(center => {
          if (center.voting_centers) {
            hasCenters = true;
            const vc = center.voting_centers as any;
            const bureaux = Array.isArray(vc.voting_bureaux) ? vc.voting_bureaux : [];
              
            const votersFromBureaux = bureaux.reduce((sum: number, bureau: any) => 
              sum + (Number(bureau.registered_voters) || 0), 0);
            
            const votersCount = votersFromBureaux > 0 ? votersFromBureaux : (Number(vc.total_voters) || 0);
            totalElecteurs += votersCount;
          }
        });
      }

      // Si pas de centres ou si on veut aussi les collèges (pro)
      const { data: collegesData } = await supabase
        .from('electoral_colleges')
        .select('total_voters')
        .eq('election_id', electionId);
        
      if (collegesData && collegesData.length > 0) {
        const collegesTotal = collegesData.reduce((sum, college) => sum + (Number(college.total_voters) || 0), 0);
        // Pour les pro, les collèges sont la source primaire
        if (!hasCenters) {
          totalElecteurs = collegesTotal;
        }
      }

      // Mettre à jour la colonne nb_electeurs
      await supabase
        .from('elections')
        .update({ 
          nb_electeurs: totalElecteurs,
          updated_at: new Date().toISOString()
        })
        .eq('id', electionId);

      return totalElecteurs;
    } catch (error) {
      console.error('Erreur recalculateElectionVoters:', error);
      return 0;
    }
  }, []);

  // Fonction utilitaire pour rafraîchir les données des élections
  const refreshElectionsData = useCallback(async () => {
    try {
      console.log('🔄 Rafraîchissement des données des élections...');
      setLoading(true);
      
      let query = supabase
        .from('elections')
        .select(`
          *,
          enterprises (id, name, province_name, commune_name)
        `);

      // Super-admin : voit toutes les élections
      // Tous les autres rôles : uniquement les élections qui leur sont assignées
      if (!isGlobalAdmin) {
        if (assignedElectionIds.length > 0) {
          query = assignedElectionIds.length === 1
            ? query.eq('id', assignedElectionIds[0])
            : query.in('id', assignedElectionIds);
        } else if (user) {
          // Admin sans élection assignée : voit celles qu'il a créées
          query = query.eq('created_by', user.id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur lors de la récupération des élections:', error);
        throw error;
      }

      console.log(`📊 ${data?.length || 0} élections récupérées de la base de données`);
      
      // Récupérer les compteurs de candidats, centres et bureaux pour chaque élection
      const electionsWithCounts = await Promise.all(
        (data || []).map(async (election) => {
          // Récupérer les candidats liés
          const { data: candidatesData } = await supabase
            .from('election_candidates')
            .select('id')
            .eq('election_id', election.id);

          // Récupérer les centres liés avec leurs bureaux pour calculer les vrais totaux
          const { data: centersData } = await supabase
            .from('election_centers')
            .select(`
              id,
              voting_centers(
                id,
                total_voters,
                total_bureaux,
                voting_bureaux!center_id(id, registered_voters)
              )
            `)
            .eq('election_id', election.id);

          // Calculer le total des bureaux et électeurs en temps réel
          let totalBureaux = 0;
          let totalElecteurs = 0;
          
          if (centersData && centersData.length > 0) {
            centersData.forEach(center => {
              if (center.voting_centers) {
                const vc = center.voting_centers as any;
                // Compter les bureaux : soit depuis la liste, soit depuis la colonne total_bureaux
                const bureaux = Array.isArray(vc.voting_bureaux) ? vc.voting_bureaux : [];
                const bureauxCount = bureaux.length > 0 ? bureaux.length : (Number(vc.total_bureaux) || 0);
                totalBureaux += bureauxCount;
                
                // Calculer les électeurs : soit depuis les bureaux, soit depuis la colonne total_voters
                const votersFromBureaux = bureaux.reduce((sum: number, bureau: any) => 
                  sum + (Number(bureau.registered_voters) || 0), 0);
                
                const votersCount = votersFromBureaux > 0 ? votersFromBureaux : (Number(vc.total_voters) || 0);
                totalElecteurs += votersCount;
              }
            });
          }

          // Pour les élections professionnelles, vérifier aussi les collèges électoraux
          if (election.type === 'Élection Professionnelle') {
            const { data: collegesData } = await supabase
              .from('electoral_colleges')
              .select('total_voters')
              .eq('election_id', election.id);
            
            if (collegesData && collegesData.length > 0) {
              const collegesTotal = collegesData.reduce((sum, college) => sum + (Number(college.total_voters) || 0), 0);
              // Si on n'a pas de centres, on prend le total des collèges
              if (totalElecteurs === 0) {
                totalElecteurs = collegesTotal;
              }
            }
          }


          // Mettre à jour automatiquement la colonne nb_electeurs dans la table elections
          if (totalElecteurs !== election.nb_electeurs) {
            try {
              await supabase
                .from('elections')
                .update({ 
                  nb_electeurs: totalElecteurs,
                  updated_at: new Date().toISOString()
                })
                .eq('id', election.id);
              
              console.log(`Mise à jour automatique nb_electeurs pour ${election.title}: ${totalElecteurs}`);
            } catch (updateError) {
              console.error(`Erreur lors de la mise à jour nb_electeurs pour ${election.title}:`, updateError);
            }
          }

          return {
            ...election,
            candidates_count: candidatesData?.length || 0,
            centers_count: centersData?.length || 0,
            voting_bureaux_count: totalBureaux,
            nb_electeurs: totalElecteurs
          };
        })
      );

      // Recalculer automatiquement le nombre d'électeurs pour toutes les élections
      // pour s'assurer que la colonne nb_electeurs est synchronisée
      try {
        await Promise.all(
          electionsWithCounts.map(async (election) => {
            try {
              await recalculateElectionVoters(election.id);
            } catch (error) {
              console.warn(`Erreur lors du recalcul pour l'élection ${election.title}:`, error);
            }
          })
        );
        console.log('Recalcul automatique effectué pour toutes les élections');
      } catch (error) {
        console.warn('Erreur lors du recalcul global des électeurs:', error);
      }

      // Transformer les données Supabase en format Election unifié
      const transformedElections: Election[] = electionsWithCounts.map(election => {
        console.log('Données de localisation pour l\'élection:', election.title, {
          province_name: election.province_name,
          commune_name: election.commune_name,
          arrondissement_name: election.arrondissement_name,
          province: election.province,
          commune: election.commune,
          arrondissement: election.arrondissement
        });
        return {
          id: String(election.id),
          title: election.title,
          type: election.type || 'Législatives',
          status: election.status || 'À venir',
          date: new Date(election.election_date || election.created_at),
          description: election.description || '',
          location: {
            province: (election.type === 'Élection Professionnelle')
              ? (election.enterprises?.province_name || 'Non spécifiée')
              : (election.province_name || election.province || 'Haut-Ogooué'),
            commune: (election.type === 'Élection Professionnelle')
              ? (election.enterprises?.commune_name || 'Non spécifiée')
              : (election.commune_name || election.commune || 'Moanda'),
            arrondissement: (election.type === 'Élection Professionnelle')
              ? 'Multi-établissements'
              : (election.arrondissement_name || election.arrondissement || '1er Arrondissement'),
            fullAddress: (election.type === 'Élection Professionnelle')
              ? (election.enterprises?.name || 'Entreprise')
              : (election.localisation || 
                `${election.commune_name || election.commune || 'Moanda'}, ${election.province_name || election.province || 'Haut-Ogooué'}` ||
                'Moanda, Haut-Ogooué'),
          },
          cover_image: election.cover_image_url,
          enterpriseId: election.enterprise_id,
          has_second_round: election.has_second_round,
          second_round_date: election.second_round_date,
          configuration: {
            seatsAvailable: election.seats_available || 1,
            budget: election.budget || 0,
            voteGoal: election.vote_goal || 0,
            allowMultipleCandidates: true,
            requirePhotoValidation: false,
          },
          statistics: {
            totalVoters: election.nb_electeurs || election.registered_voters || 0,
            totalCandidates: election.candidates_count || 0,
            totalCenters: election.centers_count || 0,
            totalBureaux: election.voting_bureaux_count || 0,
            completedSteps: 0,
            totalSteps: 5,
            progressPercentage: 0,
          },
          timeline: {
            created: new Date(election.created_at),
            configured: election.status === 'À venir' ? new Date(election.created_at) : null,
            started: election.status === 'En cours' ? new Date(election.election_date || election.created_at) : null,
            ended: election.status === 'Terminée' ? new Date(election.election_date || election.created_at) : null,
            published: null,
          },
          createdAt: new Date(election.created_at),
          updatedAt: new Date(election.updated_at),
          createdBy: election.created_by || 'system',
        };
      });

      console.log('✅ Données transformées avec succès:', transformedElections.length);
      setElections(transformedElections);
    } catch (err) {
      console.error('Erreur lors du rafraîchissement:', err);
      setError('Erreur lors du rafraîchissement des données');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLoading, setError, setElections, recalculateElectionVoters, user, isGlobalAdmin, JSON.stringify(assignedElectionIds)]);

  // Charger les élections depuis Supabase
  useEffect(() => {
    refreshElectionsData();
  }, [refreshElectionsData]);


  // Mettre à jour les filtres dans le hook
  useEffect(() => {
    setSearchQuery(searchQuery);
    setFilters({
      status: statusFilter === 'all' ? undefined : [statusFilter as 'À venir' | 'En cours' | 'Terminée' | 'Annulée'],
      type: typeFilter === 'all' ? undefined : [typeFilter as 'Législatives' | 'Locales'],
    });
  }, [searchQuery, statusFilter, typeFilter, setSearchQuery, setFilters]);

  // Utiliser les élections filtrées du hook
  const filteredElections = elections.filter(election => {
    const matchesSearch = searchQuery === '' || 
      election.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      election.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      election.location.commune.toLowerCase().includes(searchQuery.toLowerCase()) ||
      election.location.province.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || election.status === statusFilter;
    const matchesType = typeFilter === 'all' || election.type === typeFilter;
    const electionYear = new Date(election.date).getFullYear().toString();
    const electionMonth = (new Date(election.date).getMonth() + 1).toString();
    const matchesYear = yearFilter === 'all' || electionYear === yearFilter;
    const matchesMonth = monthFilter === 'all' || electionMonth === monthFilter;

    return matchesSearch && matchesStatus && matchesType && matchesYear && matchesMonth;
  });

  // Fonction pour déterminer la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'à venir':
      case 'programmée':
        return 'gray';
      case 'en cours':
      case 'active':
        return 'orange';
      case 'terminée':
      case 'completed':
        return 'green';
      case 'annulée':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusVariant = (color: string) => {
    switch (color) {
      case 'gray':
        return 'secondary';
      case 'orange':
        return 'outline';
      case 'green':
        return 'default';
      case 'red':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleViewElection = (election: Election) => {
    setSelectedElection(election);
  };

  const handleCloseDetail = async () => {
    setSelectedElection(null);
    // Rafraîchir les données pour s'assurer que les cartes sont à jour
    await refreshElectionsData();
  };

  const handleEditElection = (election: Election) => {
    setEditingElection(election);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingElection(null);
  };

  const handleUpdateElection = async (updatedData: Partial<Election>) => {
    if (!editingElection) return;

    try {
      setLoading(true);

      // Préparer les données pour Supabase (champs de base uniquement)
      const supabaseData = {
        title: updatedData.title,
        type: updatedData.type, // Utiliser 'type' au lieu de 'election_type'
        election_date: updatedData.date?.toISOString().split('T')[0],
        status: updatedData.status,
        description: updatedData.description || '',
        nb_electeurs: updatedData.statistics?.totalVoters,
        cover_image_url: (updatedData as any).coverImage || (updatedData as any).cover_image_url || (updatedData as any).cover_image,
      };


      console.log('Données à envoyer à Supabase:', supabaseData);
      console.log('ID de l\'élection à modifier:', editingElection.id);
      console.log('Type de l\'ID:', typeof editingElection.id);

      // Vérifier que l'ID existe et est valide
      if (!editingElection.id) {
        throw new Error('ID de l\'élection manquant');
      }

      // D'abord vérifier que l'élection existe et récupérer les anciennes valeurs pour l'audit
      const { data: existingElection, error: fetchError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', editingElection.id)
        .single();

      if (fetchError) {
        console.error('Erreur lors de la vérification de l\'élection:', fetchError);
        throw new Error(`Élection non trouvée: ${fetchError.message}`);
      }

      console.log('Élection trouvée:', existingElection);
      
      // Sauvegarder les anciennes valeurs pour l'audit
      const oldValues = {
        title: existingElection.title,
        type: existingElection.type || existingElection.election_type,
        election_date: existingElection.election_date,
        status: existingElection.status,
        description: existingElection.description,
        nb_electeurs: existingElection.nb_electeurs,
      };

      const { error } = await supabase
        .from('elections')
        .update(supabaseData)
        .eq('id', editingElection.id);

      if (error) {
        console.error('Erreur lors de la mise à jour de l\'élection:', error);
        console.error('Détails de l\'erreur:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Essayer une approche alternative si l'erreur persiste
        console.log('Tentative d\'approche alternative...');
        
        // Essayer de mettre à jour seulement le titre d'abord
        const { error: simpleError } = await supabase
          .from('elections')
          .update({ title: updatedData.title })
          .eq('id', editingElection.id);
          
        if (simpleError) {
          console.error('Erreur même avec approche simple:', simpleError);
          toast.error(`Erreur lors de la modification: ${error.message}`);
          return;
        } else {
          console.log('Mise à jour simple réussie, tentative de mise à jour complète...');
          // Si la mise à jour simple fonctionne, essayer la mise à jour complète
          const { error: fullError } = await supabase
            .from('elections')
            .update(supabaseData)
            .eq('id', editingElection.id);
            
          if (fullError) {
            console.error('Erreur lors de la mise à jour complète:', fullError);
            toast.error(`Erreur lors de la modification: ${fullError.message}`);
            return;
          }
        }
      }

      // Recalculer automatiquement le nombre d'électeurs après modification
      try {
        await recalculateElectionVoters(editingElection.id);
        console.log('Recalcul automatique des électeurs effectué');
      } catch (recalcError) {
        console.warn('Erreur lors du recalcul automatique des électeurs:', recalcError);
        // Ne pas bloquer la modification si le recalcul échoue
      }

      // Recharger les données depuis la base de données
      await refreshElectionsData();
      
      // Enregistrer dans l'audit
      await logUpdate(
        'election',
        editingElection.id,
        oldValues,
        supabaseData,
        `Modification de l'élection "${existingElection.title}"`
      );
      
      setShowEditModal(false);
      await refreshElectionsData();
      toast.success('Élection mise à jour avec succès');
      handleCloseEditModal();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour de l\'élection');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProElection = async (formData: any) => {
    if (!editingElection) return;

    try {
      setLoading(true);

      // 1. Mettre à jour l'entreprise
      if (formData.enterpriseId) {
        const { error: entError } = await supabase
          .from('enterprises')
          .update({
            name: formData.enterpriseName,
            sector: formData.enterpriseSector,
            total_employees: parseInt(formData.totalEmployees),
            employees_by_category: {
              cadres: parseInt(formData.employeesCadres),
              employes: parseInt(formData.employeesEmployes),
              ouvriers: parseInt(formData.employeesOuvriers)
            },
            administrative_unit: formData.administrativeUnit
          })
          .eq('id', formData.enterpriseId);
        if (entError) throw entError;
      }

      // 2. Mettre à jour l'élection
      const supabaseData = {
        title: formData.name,
        type: formData.type,
        election_date: formData.date,
        status: formData.status,
        nb_electeurs: parseInt(formData.totalEmployees),
        legal_framework: formData.legalFramework,
        carence: formData.carence,
        list_display_date: formData.listDisplayDate || null,
        campaign_start: formData.campaignStart || null,
        campaign_end: formData.campaignEnd || null,
        has_second_round: formData.hasSecondRound,
        second_round_date: formData.secondRoundDate || null,
        recours_period_start: formData.recoursStart || null,
        recours_period_end: formData.recoursEnd || null,
        seats_available: formData.colleges.reduce((acc: number, c: any) => acc + (parseInt(c.seats) || 0), 0),
        cover_image_url: formData.coverImage || null
      };

      const { error: electionError } = await supabase
        .from('elections')
        .update(supabaseData)
        .eq('id', editingElection.id);

      if (electionError) throw electionError;

      // 3. Mettre à jour les collèges (on supprime et on réinsère pour faire simple)
      const { error: delError } = await supabase
        .from('electoral_colleges')
        .delete()
        .eq('election_id', editingElection.id);
      
      if (delError) throw delError;

      if (formData.colleges && formData.colleges.length > 0) {
        const collegesData = formData.colleges.map((c: any) => ({
          election_id: editingElection.id,
          name: c.name,
          college_type: c.type,
          total_voters: c.voters,
          seats_to_fill: c.seats
        }));
        await supabase.from('electoral_colleges').insert(collegesData);
      }

      toast.success('Élection professionnelle mise à jour avec succès');
      await refreshElectionsData();
      handleCloseEditModal();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour de l\'élection professionnelle');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteElection = (election: Election) => {
    setElectionToDelete(election);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!electionToDelete) return;
    try {
      setIsDeleting(true);
      const electionId = electionToDelete.id;
      
      // Récupérer les données de l'élection avant suppression pour l'audit
      const { data: electionData } = await supabase
        .from('elections')
        .select('*')
        .eq('id', electionId)
        .single();

      // 1. Supprimer les votes/candidatures dans candidate_results liés aux PVs de cette élection
      try {
        const { data: pvs } = await supabase
          .from('procès_verbaux')
          .select('id')
          .eq('election_id', electionId);
          
        if (pvs && pvs.length > 0) {
          const pvIds = pvs.map(p => p.id);
          await supabase.from('candidate_results').delete().in('pv_id', pvIds);
        }
      } catch (e) {
        console.warn("Échec de la suppression dans candidate_results:", e);
      }

      // 2. Supprimer les procès_verbaux liés à l'élection
      try {
        await supabase.from('procès_verbaux').delete().eq('election_id', electionId);
      } catch (e) {
        console.warn("Échec de la suppression dans procès_verbaux:", e);
      }

      // 3. Supprimer les candidats liés à l'élection
      try {
        await supabase.from('election_candidates').delete().eq('election_id', electionId);
      } catch (e) {
        console.warn("Échec de la suppression dans election_candidates:", e);
      }

      // 4. Supprimer les centres liés à l'élection
      try {
        await supabase.from('election_centers').delete().eq('election_id', electionId);
      } catch (e) {
        console.warn("Échec de la suppression dans election_centers:", e);
      }

      // 5. Supprimer les collèges électoraux (élections pro)
      try {
        await supabase.from('electoral_colleges').delete().eq('election_id', electionId);
      } catch (e) {
        console.warn("Échec de la suppression dans electoral_colleges:", e);
      }

      // 6. Supprimer les étapes de l'élection si applicable
      try {
        await supabase.from('election_steps').delete().eq('election_id', electionId);
      } catch (e) {
        console.warn("Échec de la suppression dans election_steps:", e);
      }

      // 7. Supprimer l'élection de la base de données
      const { error: dbDeleteErr } = await supabase
        .from('elections')
        .delete()
        .eq('id', electionId);

      if (dbDeleteErr) {
        throw dbDeleteErr;
      }
      
      // 8. Mettre à jour l'état local
      await deleteElection(electionId);
      
      // Enregistrer dans l'audit
      if (electionData) {
        await logDelete(
          'election',
          electionId,
          `Suppression de l'élection "${electionData.title}"`,
          electionData
        );
      }
      
      toast.success('Élection supprimée avec succès');
      setShowDeleteModal(false);
      setElectionToDelete(null);
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(`Erreur lors de la suppression: ${error?.message || error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateElection = (election: Election) => {
    const duplicatedElection = {
      ...election,
      id: crypto.randomUUID(),
      title: `${election.title} (Copie)`,
      status: 'À venir' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    try {
      addElection(duplicatedElection);
      toast.success('Élection dupliquée avec succès');
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      toast.error('Erreur lors de la duplication de l\'élection');
    }
  };

  const handleExportElection = async (election: Election) => {
    const data = {
      title: election.title,
      type: election.type,
      date: election.date.toISOString(),
      status: election.status,
      location: election.location,
      statistics: election.statistics,
      configuration: election.configuration
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `election-${election.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Enregistrer dans l'audit
    await logExport(
      'election',
      `Export de l'élection "${election.title}"`,
      election.id
    );
    
    toast.success('Élection exportée avec succès');
  };

  const handleExportAllElections = async () => {
    const data = {
      elections: filteredElections.map(election => ({
        title: election.title,
        type: election.type,
        date: election.date.toISOString(),
        status: election.status,
        location: election.location,
        statistics: election.statistics,
        configuration: election.configuration
      })),
      exportDate: new Date().toISOString(),
      totalElections: filteredElections.length
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elections-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Enregistrer dans l'audit
    await logExport(
      'election',
      `Export de ${filteredElections.length} élection(s)`
    );
    
    toast.success(`${filteredElections.length} élection(s) exportée(s) avec succès`);
  };

  const handleCreateElection = async (electionData: CreateElectionData) => {
    try {
      console.log('Validation des données d\'élection:', electionData);
      console.log('Structure des données reçues:', {
        hasLocation: !!electionData.location,
        hasConfiguration: !!electionData.configuration,
        hasStatistics: !!electionData.statistics,
        directProps: {
          province: (electionData as any).province,
          commune: (electionData as any).commune,
          seatsAvailable: (electionData as any).seatsAvailable,
          totalVoters: (electionData as any).totalVoters
        }
      });
      
      // Validation des données
      const validation = validateCreateElection(electionData);
      console.log('Résultat de la validation:', validation);
      
      if (!validation.success) {
        const errors = formatValidationErrors(validation.error);
        console.log('Erreurs de validation détaillées:', errors);
        const errorMessages = Object.values(errors).flat();
        toast.error(`Erreurs de validation: ${errorMessages.join(', ')}`);
        return;
      }

      setLoading(true);

      // Récupérer les IDs des localisations
      console.log('🔍 Récupération des IDs de localisation...');
      
      const provinceName = (electionData as any).province || electionData.location?.province || '';
      const communeName = (electionData as any).commune || electionData.location?.commune || '';
      const arrondissementName = (electionData as any).arrondissement || electionData.location?.arrondissement || '';

      console.log('📍 Noms de localisation:', { provinceName, communeName, arrondissementName });

      // Récupérer l'ID de la province
      const { data: provinceData } = await supabase
        .from('provinces')
        .select('id')
        .eq('name', provinceName)
        .single();

      // Récupérer l'ID de la commune
      const { data: communeData } = await supabase
        .from('communes')
        .select('id')
        .eq('name', communeName)
        .single();

      // Récupérer l'ID de l'arrondissement
      const { data: arrondissementData } = await supabase
        .from('arrondissements')
        .select('id')
        .eq('name', arrondissementName)
        .single();

      console.log('🆔 IDs récupérés:', {
        provinceId: provinceData?.id,
        communeId: communeData?.id,
        arrondissementId: arrondissementData?.id
      });

      // Récupérer l'utilisateur authentifié pour filled created_by si UUID requis
      let createdBy: string | null = null;
      try {
        const { data: auth } = await supabase.auth.getUser();
        createdBy = auth?.user?.id ?? null;
        console.log('👤 Utilisateur authentifié (created_by):', createdBy);
      } catch (e) {
        console.warn('Impossible de récupérer l\'utilisateur authentifié, created_by sera null');
      }

      // Préparer les données pour Supabase
      const supabaseData = {
        title: (electionData as any).name || electionData.title,
        type: electionData.type,
        election_date: electionData.date,
        status: 'À venir',
        description: electionData.description || '',
        province_id: provinceData?.id || null,
        commune_id: communeData?.id || null,
        arrondissement_id: arrondissementData?.id || null,
        seats_available: (electionData as any).seatsAvailable || electionData.configuration?.seatsAvailable || 1,
        budget: (electionData as any).budget || electionData.configuration?.budget || 0,
        vote_goal: (electionData as any).voteGoal || electionData.configuration?.voteGoal || 0,
        nb_electeurs: (electionData as any).totalVoters || electionData.statistics?.totalVoters || 0,
        cover_image_url: (electionData as any).coverImage || (electionData as any).cover_image_url || (electionData as any).cover_image,
        enterprise_id: (electionData as any).enterpriseId || (electionData as any).enterprise_id || null,
        ...(createdBy ? { created_by: createdBy } : {}),
      };


      const { data, error } = await supabase
        .from('elections')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création de l\'élection:', error);
        toast.error(`Erreur lors de la création: ${error.message}`);
        return;
      }

      const electionId = String(data.id);

      // Lier les candidats à l'élection
      const candidates = (electionData as any).candidates || electionData.candidates || [];
      console.log('👥 Candidats reçus:', candidates);
      
      if (candidates && candidates.length > 0) {
        const candidateLinks = candidates.map((candidate: any) => ({
          election_id: electionId,
          candidate_id: candidate.identifiant || candidate.id,
          is_our_candidate: candidate.est_notre_candidat || candidate.isOurCandidate || false
        }));

        console.log('🔗 Liens candidats à créer:', candidateLinks);

        const { error: candidateError } = await supabase
          .from('election_candidates')
          .insert(candidateLinks);

        if (candidateError) {
          console.error('❌ Erreur lors de la liaison des candidats:', candidateError);
          toast.error('Erreur lors de la liaison des candidats');
        } else {
          console.log('✅ Candidats liés avec succès');
        }
      } else {
        console.log('ℹ️ Aucun candidat à lier pour cette élection');
      }

      // Lier les centres à l'élection
      const centers = (electionData as any).centers || electionData.centers || [];
      console.log('🏢 Centres reçus:', centers);
      
      if (centers && centers.length > 0) {
        const centerLinks = centers.map((center: any) => ({
          election_id: electionId,
          center_id: center.identifiant || center.id
        }));

        console.log('🔗 Liens centres à créer:', centerLinks);

        const { error: centerError } = await supabase
          .from('election_centers')
          .insert(centerLinks);

        if (centerError) {
          console.error('❌ Erreur lors de la liaison des centres:', centerError);
          toast.error('Erreur lors de la liaison des centres');
        } else {
          console.log('✅ Centres liés avec succès');
        }
      } else {
        console.log('ℹ️ Aucun centre à lier pour cette élection');
      }

      // Créer l'objet Election complet
      const newElection: Election = {
        id: String(data.id),
        title: electionData.title,
        type: electionData.type,
        status: 'À venir',
        date: new Date(electionData.date),
        description: electionData.description,
        location: {
          province: (electionData as any).province || electionData.location?.province || '',
          commune: (electionData as any).commune || electionData.location?.commune || '',
          arrondissement: (electionData as any).arrondissement || electionData.location?.arrondissement || '',
          fullAddress: `${(electionData as any).commune || electionData.location?.commune || ''}, ${(electionData as any).province || electionData.location?.province || ''}`,
        },
        configuration: {
          seatsAvailable: (electionData as any).seatsAvailable || electionData.configuration?.seatsAvailable || 1,
          budget: (electionData as any).budget || electionData.configuration?.budget || 0,
          voteGoal: (electionData as any).voteGoal || electionData.configuration?.voteGoal || 0,
          allowMultipleCandidates: true,
          requirePhotoValidation: false,
        },
        statistics: ({
          totalVoters: Number((electionData as any).totalVoters) || electionData.statistics?.totalVoters || 0,
          totalCandidates: Number((electionData as any).totalCandidates) || 0,
          totalCenters: Number((electionData as any).totalCenters) || 0,
          totalBureaux: Number((electionData as any).totalBureaux) || 0,
          completedSteps: 1,
          totalSteps: 5,
          progressPercentage: 20,
        } as any),
        timeline: {
          created: new Date(),
          configured: new Date(),
          started: null,
          ended: null,
          published: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'current-user',
        enterpriseId: undefined
      };

      // Recalculer automatiquement le nombre d'électeurs après création
      try {
        await recalculateElectionVoters(electionId);
        console.log('Recalcul automatique des électeurs effectué après création');
      } catch (recalcError) {
        console.warn('Erreur lors du recalcul automatique des électeurs après création:', recalcError);
        // Ne pas bloquer la création si le recalcul échoue
      }

      // Recharger les données depuis la base de données
      await refreshElectionsData();
      
      // Enregistrer dans l'audit
      await logCreate(
        'election',
        electionId,
        `Création de l'élection "${electionData.title}" (${electionData.type})`,
        { new_values: supabaseData }
      );
      
      setShowWizard(false);
      toast.success('Élection créée avec succès');
    } catch (error) {
      console.error('Erreur lors de la création de l\'élection:', error);
      toast.error('Erreur lors de la création de l\'élection');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProElection = async (electionData: any) => {
    try {
      setLoading(true);
      // Récupérer l'utilisateur
      let createdBy: string | null = null;
      try {
        const { data: auth } = await supabase.auth.getUser();
        createdBy = auth?.user?.id ?? null;
      } catch (e) {}

      // Créer l'entreprise d'abord si elle n'existe pas ou l'insérer
      const { data: enterprise, error: entError } = await supabase
        .from('enterprises')
        .insert({
          name: electionData.enterpriseName,
          sector: electionData.enterpriseSector,
          total_employees: parseInt(electionData.totalEmployees),
          employees_by_category: {
            cadres: parseInt(electionData.employeesCadres),
            employes: parseInt(electionData.employeesEmployes),
            ouvriers: parseInt(electionData.employeesOuvriers)
          },
          administrative_unit: electionData.administrativeUnit
        })
        .select()
        .single();
        
      if (entError) {
        console.error('Erreur lors de la création de l\'entreprise:', entError);
        throw entError;
      }

      // Créer l'élection
      const supabaseData = {
        title: electionData.name,
        type: electionData.type,
        election_date: electionData.date,
        status: 'À venir',
        enterprise_id: enterprise.id,
        nb_electeurs: parseInt(electionData.totalEmployees),
        legal_framework: electionData.legalFramework,
        carence: electionData.carence,
        list_display_date: electionData.listDisplayDate || null,
        campaign_start: electionData.campaignStart || null,
        campaign_end: electionData.campaignEnd || null,
        has_second_round: electionData.hasSecondRound,
        second_round_date: electionData.secondRoundDate || null,
        recours_period_start: electionData.recoursStart || null,
        recours_period_end: electionData.recoursEnd || null,
        seats_available: electionData.colleges.reduce((acc: number, c: any) => acc + (parseInt(c.seats) || 0), 0),
        cover_image_url: electionData.coverImage || null
      };

      
      // Ajouter le created_by seulement s'il est défini (comme pour l'élection classique)
      if (createdBy) {
        (supabaseData as any).created_by = createdBy;
      }

      const { data, error } = await supabase
        .from('elections')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création de l\'élection:', error);
        throw error;
      }
      
      const electionId = String(data.id);

      // Insérer les collèges
      if (electionData.colleges && electionData.colleges.length > 0) {
        const collegesData = electionData.colleges.map((c: any) => ({
          election_id: electionId,
          name: c.name,
          college_type: c.type,
          total_voters: c.voters,
          seats_to_fill: c.seats
        }));
        const { error: collError } = await supabase.from('electoral_colleges').insert(collegesData);
        if (collError) {
          console.error('Erreur lors de la création des collèges:', collError);
          throw collError;
        }
      }

      // Insérer les établissements & bureaux importés
      if (electionData.votingCenters && electionData.votingCenters.length > 0) {
        for (const center of electionData.votingCenters) {
          // Créer le voting_center
          const { data: centerData, error: centerErr } = await supabase
            .from('voting_centers')
            .insert({
              name: center.name,
              address: center.address,
              contact_name: center.contactName || 'N/A',
              contact_phone: center.contactPhone || 'N/A',
              total_voters: center.voters || 0,
              total_bureaux: center.bureaux || 0,
              enterprise_id: enterprise.id
            })
            .select()
            .single();

          if (centerErr) {
            console.error('Erreur lors de la création du centre de vote:', centerErr);
            continue;
          }

          // Lier le centre à l'élection
          const { error: linkErr } = await supabase
            .from('election_centers')
            .insert({
              election_id: electionId,
              center_id: centerData.id
            });

          if (linkErr) {
            console.error('Erreur lors de la liaison du centre:', linkErr);
          }

          // Insérer les bureaux de vote pour ce centre
          if (center.booths && center.booths.length > 0) {
            const boothsToInsert = center.booths.map((booth: any) => ({
              name: booth.name,
              center_id: centerData.id,
              registered_voters: booth.voters || 0,
              president_name: 'N/A',
              president_phone: '000000000',
              urns_count: 0
            }));

            const { error: boothErr } = await supabase
              .from('voting_bureaux')
              .insert(boothsToInsert);

            if (boothErr) {
              console.error('Erreur lors de la création des bureaux:', boothErr);
            }
          }
        }
      }

      // Insérer les listes syndicales/candidats importés
      if (electionData.candidates && electionData.candidates.length > 0) {
        for (const cand of electionData.candidates) {
          // Rechercher si le syndicat existe déjà
          let unionId = null;
          let query = supabase.from('unions').select('id');
          if (cand.unionAcronym && cand.unionName) {
            query = query.or(`acronym.eq.${cand.unionAcronym},name.eq.${cand.unionName}`);
          } else if (cand.unionAcronym) {
            query = query.eq('acronym', cand.unionAcronym);
          } else {
            query = query.eq('name', cand.unionName);
          }
          
          const { data: existingUnion } = await query.maybeSingle();

          if (existingUnion) {
            unionId = existingUnion.id;
          } else {
            // Créer le syndicat
            const { data: newUnionData, error: newUnionErr } = await supabase
              .from('unions')
              .insert({
                name: cand.unionName,
                acronym: cand.unionAcronym
              })
              .select()
              .single();

            if (newUnionErr) {
              console.error('Erreur lors de la création du syndicat:', newUnionErr);
              continue;
            }
            unionId = newUnionData.id;
          }

          // Créer la liste (union_list)
          const { error: listErr } = await supabase
            .from('union_lists')
            .insert({
              election_id: electionId,
              union_id: unionId,
              college: cand.college || 'general',
              titulaires: cand.titulaireName ? [{ name: cand.titulaireName, role: 'Tête de liste' }] : [],
              suppleants: cand.suppleantName ? [{ name: cand.suppleantName, role: 'Suppléant' }] : []
            });

          if (listErr) {
            console.error('Erreur lors de la création de la liste syndicale:', listErr);
          }
        }
      }

      await refreshElectionsData();
      
      await logCreate(
        'election',
        electionId,
        `Création de l'élection professionnelle "${electionData.name}"`,
        { new_values: supabaseData }
      );
      
      setShowProWizard(false);
      toast.success('Élection professionnelle créée avec succès');
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur: ${error.message || 'Erreur lors de la création'}`);
    } finally {
      setLoading(false);
    }
  };

  if (selectedElection) {
    const adaptedElection = {
      id: selectedElection.id,
      title: selectedElection.title,
      date: selectedElection.date.toISOString().split('T')[0],
      status: selectedElection.status,
      description: selectedElection.description || `${selectedElection.location.commune}, ${selectedElection.location.province}`,
      voters: selectedElection.statistics.totalVoters,
      centers: selectedElection.statistics.totalCenters,
      candidates: selectedElection.statistics.totalCandidates,
      location: selectedElection.location.fullAddress,
      type: selectedElection.type,
      budget: selectedElection.configuration.budget,
      voteGoal: selectedElection.configuration.voteGoal,
      seatsAvailable: selectedElection.configuration.seatsAvailable,
      province: selectedElection.location.province,
      commune: selectedElection.location.commune,
      arrondissement: selectedElection.location.arrondissement,
      has_second_round: selectedElection.has_second_round,
      second_round_date: selectedElection.second_round_date,
      enterpriseId: selectedElection.enterpriseId || (selectedElection as any).enterprise_id,
    };

    return (
      <ElectionDetailView 
        election={adaptedElection as any} 
        onBack={handleCloseDetail}
        onDataChange={refreshElectionsData}
      />
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des élections...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header avec statistiques - Mobile First */}
        <div className="relative overflow-hidden bg-gradient-to-r from-gov-blue/5 to-gov-blue-light/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative z-10">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Gestion des Élections</h1>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Gérez et supervisez toutes les élections du système
                </p>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 w-full">
                {can('elections:manage') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="btn-primary shadow-lg hover:shadow-xl transition-all duration-300 w-full xs:w-auto text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                      size="lg"
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="hidden xs:inline">Nouvelle Élection</span>
                      <span className="xs:hidden">Nouvelle</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={() => { setSelectedElectionCategory('political'); setShowCreationModeModal(true); }} className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">Politique</span>
                        <span className="text-xs text-gray-500">Législatives, Locales</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setSelectedElectionCategory('professional'); setShowCreationModeModal(true); }} className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-purple-700">Professionnelle</span>
                        <span className="text-xs text-gray-500">Délégués du personnel (Entreprises)</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                )} {/* fin can('elections:manage') */}

                <Button
                  variant="outline"
                  onClick={refreshElectionsData}
                  className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-sm px-4 py-2 sm:px-6 sm:py-3 h-auto"
                >
                  <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                  Actualiser
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques rapides - Mobile First */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Total Élections</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gov-blue">{statistics.total}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-gov-blue/20 rounded-full">
                    <div className="w-full h-full bg-gov-blue rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-gov-blue/10 rounded-full flex-shrink-0 ml-2">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gov-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">En Cours</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{statistics.byStatus['En cours'] || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-orange-200 rounded-full">
                    <div className="w-full h-full bg-orange-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-orange-100 rounded-full flex-shrink-0 ml-2">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">À Venir</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-600">{statistics.byStatus['À venir'] || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-gray-200 rounded-full">
                    <div className="w-full h-full bg-gray-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-full flex-shrink-0 ml-2">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Terminées</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{statistics.byStatus['Terminée'] || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-green-200 rounded-full">
                    <div className="w-full h-full bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-green-100 rounded-full flex-shrink-0 ml-2">
                  <Building className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres et recherche - Mobile First */}
        <div className="bg-aqua-50 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
        
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <Input
                placeholder="Rechercher une élection..."
                value={searchQuery}
                onChange={(e) => setSearchQueryLocal(e.target.value)}
                className="pl-10 pr-10 py-3 sm:py-4 text-sm sm:text-base border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQueryLocal('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Filtres et contrôles */}
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Statut" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="À venir">À venir</SelectItem>
                    <SelectItem value="En cours">En cours</SelectItem>
                    <SelectItem value="Terminée">Terminée</SelectItem>
                    <SelectItem value="Annulée">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Building className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="Législatives">Législatives</SelectItem>
                    <SelectItem value="Locales">Locales</SelectItem>
                    <SelectItem value="Élection Professionnelle">Professionnelle</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Année" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les années</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Mois" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les mois</SelectItem>
                    <SelectItem value="1">Janvier</SelectItem>
                    <SelectItem value="2">Février</SelectItem>
                    <SelectItem value="3">Mars</SelectItem>
                    <SelectItem value="4">Avril</SelectItem>
                    <SelectItem value="5">Mai</SelectItem>
                    <SelectItem value="6">Juin</SelectItem>
                    <SelectItem value="7">Juillet</SelectItem>
                    <SelectItem value="8">Août</SelectItem>
                    <SelectItem value="9">Septembre</SelectItem>
                    <SelectItem value="10">Octobre</SelectItem>
                    <SelectItem value="11">Novembre</SelectItem>
                    <SelectItem value="12">Décembre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Boutons de vue */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors",
                    viewMode === 'grid' && "bg-gov-blue/10 text-gov-blue hover:bg-gov-blue/20"
                  )}
                >
                  <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors",
                    viewMode === 'list' && "bg-gov-blue/10 text-gov-blue hover:bg-gov-blue/20"
                  )}
                >
                  <List className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des élections - Mobile First */}
        {filteredElections.length === 0 ? (
          <Card className="election-card border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 px-4">
              <div className="p-3 sm:p-4 bg-gray-100 rounded-full mb-4 sm:mb-6">
                <Calendar className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-gray-400" />
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 text-gray-700 text-center">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
                  ? 'Aucune élection trouvée' 
                  : 'Aucune élection trouvée'
                }
              </h3>
              <p className="text-sm sm:text-base text-gray-500 text-center mb-6 sm:mb-8 max-w-md">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Essayez de modifier vos critères de recherche pour trouver des élections correspondantes.'
                  : 'Commencez par créer votre première élection pour gérer le processus électoral.'
                }
              </p>
              {can('elections:manage') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="btn-primary shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                    size="lg"
                  >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="hidden xs:inline">Créer une élection</span>
                    <span className="xs:hidden">Créer</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => { setSelectedElectionCategory('political'); setShowCreationModeModal(true); }} className="py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">Politique</span>
                      <span className="text-xs text-gray-500">Législatives, Locales</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setSelectedElectionCategory('professional'); setShowCreationModeModal(true); }} className="py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-purple-700">Professionnelle</span>
                      <span className="text-xs text-gray-500">Délégués du personnel</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </CardContent>
          </Card>
        ) : (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredElections.map((election) => (
                <Card 
                  key={election.id} 
                  className={`election-card group transition-all duration-300 ${election.status === 'Annulée' ? 'opacity-60 bg-gray-50 border-dashed border-gray-300 grayscale-[0.5]' : 'hover:shadow-lg'}`}
                >
                  <CardHeader className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base font-semibold group-hover:text-primary-blue mb-1 sm:mb-2 line-clamp-2 leading-snug">
                          {election.title}
                        </CardTitle>
                        <Badge 
                          variant={getStatusVariant(getStatusColor(election.status))}
                          className="status-badge text-[10px] px-2 py-0.5"
                          data-status={getStatusColor(election.status)}
                        >
                          {election.status}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 sm:p-2 flex-shrink-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewElection(election); }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir les détails
                          </DropdownMenuItem>
                          {can('elections:manage') && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditElection(election); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          )}
                          {can('elections:manage') && <DropdownMenuSeparator />}
                          {can('elections:manage') && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDeleteElection(election); }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Fonctionnalité 'Désactiver' en cours de développement"); }}>
                            <span className="mr-2 opacity-70">⏸</span>
                            Désactiver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Fonctionnalité 'Archiver' en cours de développement"); }}>
                            <span className="mr-2 opacity-70">📦</span>
                            Archiver
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-3 pt-0">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600">
                          <div className="p-1 bg-[#1e40af]/10 rounded flex-shrink-0">
                            <Calendar className="h-3 w-3 text-[#1e40af]" />
                          </div>
                          <span className="font-medium truncate">
                            {election.date ? election.date.toLocaleDateString('fr-FR', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'Date non définie'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600">
                          <div className="p-1 bg-green-100 rounded flex-shrink-0">
                            <MapPin className="h-3 w-3 text-green-600" />
                          </div>
                          <span className="font-medium line-clamp-1">{election.location.fullAddress}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-200">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="flex items-center justify-center gap-1 text-green-600 mb-0.5">
                            <Building className="h-3 w-3" />
                            <span className="text-[11px] font-semibold">Centres</span>
                          </div>
                          <p className="text-xs font-bold text-green-700">
                            {election.statistics.totalCenters}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-[#1e40af]/10 rounded">
                          <div className="flex items-center justify-center gap-1 text-[#1e40af] mb-0.5">
                            <Building className="h-3 w-3" />
                            <span className="text-[11px] font-semibold">Bureaux</span>
                          </div>
                          <p className="text-xs font-bold text-[#1e40af]">
                            {election.statistics.totalBureaux}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="flex items-center justify-center gap-1 text-purple-600 mb-0.5">
                            <Users className="h-3 w-3" />
                            <span className="text-[11px] font-semibold">Électeurs</span>
                          </div>
                          <p className="text-xs font-bold text-purple-700">
                            {election.statistics.totalVoters.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 rounded">
                          <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-[11px] font-semibold">Particip.</span>
                          </div>
                          <p className="text-xs font-bold text-amber-700">
                            {(election.statistics as any).participationRate ? `${(election.statistics as any).participationRate.toFixed(1)}%` : '-'}
                          </p>
                        </div>
                      </div>

                      {election.type === 'Élection Professionnelle' && election.has_second_round && (
                        <div className="p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100/50 space-y-1.5 my-1">
                          <div className="text-[10px] font-semibold text-purple-700 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                              Scrutin à 2 Tours liés
                            </span>
                            <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded">
                              Pro
                            </span>
                          </div>
                          <div className="grid grid-cols-5 items-center text-[10px] text-gray-500 font-medium">
                            <div className="col-span-2 text-left truncate">
                              <span className="text-[9px] text-gray-400 block">1er Tour</span>
                              {election.date ? election.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-'}
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <div className="h-0.5 w-full bg-purple-300 relative">
                                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-600 text-[8px]">➜</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-right truncate">
                              <span className="text-[9px] text-gray-400 block">2nd Tour</span>
                              {election.second_round_date ? new Date(election.second_round_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-'}
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 bg-white border-gray-200 text-gray-700 hover:bg-[#1e40af] hover:text-white hover:border-[#1e40af] hover:shadow-md transition-all duration-300 py-1.5 text-xs group-hover:bg-[#1e40af] group-hover:text-white group-hover:border-[#1e40af] group-hover:shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewElection(election);
                        }}
                      >
                        <span className="hidden xs:inline">Voir les détails</span>
                        <span className="xs:hidden">Détails</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:gap-4">
              {filteredElections.map((election) => (
                <Card
                  key={election.id}
                  className={`election-card group transition-all duration-300 ${election.status === 'Annulée' ? 'opacity-60 bg-gray-50 border-dashed border-gray-300 grayscale-[0.5]' : 'hover:shadow-lg'}`}
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      {/* Contenu principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <CardTitle className="text-base sm:text-lg font-semibold group-hover:text-primary-blue line-clamp-1 flex-1 pr-2">
                            {election.title}
                          </CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 flex-shrink-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewElection(election); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir les détails
                              </DropdownMenuItem>
                              {can('elections:manage') && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditElection(election); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              )}
                              {can('elections:manage') && <DropdownMenuSeparator />}
                              {can('elections:manage') && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleDeleteElection(election); }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Fonctionnalité 'Désactiver' en cours de développement"); }}>
                                <span className="mr-2 opacity-70">⏸</span>
                                Désactiver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Fonctionnalité 'Archiver' en cours de développement"); }}>
                                <span className="mr-2 opacity-70">📦</span>
                                Archiver
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                          <Badge
                            variant={getStatusVariant(getStatusColor(election.status))}
                            className="status-badge text-xs px-2 py-1 w-fit"
                            data-status={getStatusColor(election.status)}
                          >
                            {election.status}
                          </Badge>
                          
                          <div className="flex items-center text-gray-600 text-xs sm:text-sm">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-gray-500 flex-shrink-0" />
                            <span className="truncate">
                              {election.date ? election.date.toLocaleDateString('fr-FR', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              }) : 'Date non définie'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-gray-600 text-xs sm:text-sm mb-2">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-gray-500 flex-shrink-0" />
                          <span className="line-clamp-1">{election.location.fullAddress}</span>
                        </div>

                        {election.type === 'Élection Professionnelle' && election.has_second_round && (
                          <div className="p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100/50 space-y-1.5 mb-3 max-w-md">
                            <div className="text-[10px] font-semibold text-purple-700 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                Scrutin à 2 Tours liés (Professionnel)
                              </span>
                            </div>
                            <div className="grid grid-cols-5 items-center text-[10px] text-gray-500 font-medium">
                              <div className="col-span-2 text-left truncate">
                                <span className="text-[9px] text-gray-400 block">1er Tour</span>
                                {election.date ? election.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-'}
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <div className="h-0.5 w-full bg-purple-300 relative">
                                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-600 text-[8px]">➜</span>
                                </div>
                              </div>
                              <div className="col-span-2 text-right truncate">
                                <span className="text-[9px] text-gray-400 block">2nd Tour</span>
                                {election.second_round_date ? new Date(election.second_round_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Statistiques */}
                        <div className="flex items-center gap-3 sm:gap-4 text-gray-700 text-xs sm:text-sm mb-2">
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                            <span className="font-medium">{election.statistics.totalCenters}</span>
                            <span className="text-gray-500 hidden xs:inline">centres</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3 sm:h-4 sm:w-4 text-[#1e40af]" />
                            <span className="font-medium">{election.statistics.totalBureaux}</span>
                            <span className="text-gray-500 hidden xs:inline">bureaux</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                            <span className="font-medium">{election.statistics.totalVoters.toLocaleString()}</span>
                            <span className="text-gray-500 hidden xs:inline">électeurs</span>
                          </div>
                        </div>
                      </div>

                      {/* Bouton d'action */}
                      <div className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border-gray-200 text-gray-700 hover:bg-[#1e40af] hover:text-white hover:border-[#1e40af] hover:shadow-md transition-all duration-300 py-2 text-sm group-hover:bg-[#1e40af] group-hover:text-white group-hover:border-[#1e40af] group-hover:shadow-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewElection(election);
                          }}
                        >
                          <span className="hidden xs:inline">Voir les détails</span>
                          <span className="xs:hidden">Détails</span>
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Election Wizard Modal */}
        {showWizard && (
          <ElectionWizard 
            onClose={() => setShowWizard(false)}
            onSubmit={handleCreateElection}
            onSuccess={() => {
              setShowWizard(false);
              toast.success('Élection créée avec succès');
            }}
            prefilledData={prefilledData}
          />
        )}

        {/* Professional Election Wizard Modal */}
        {showProWizard && (
          <ProfessionalElectionWizard 
            onClose={() => setShowProWizard(false)}
            onSubmit={handleCreateProElection}
            prefilledData={prefilledData}
          />
        )}

        {/* Modal de sélection du mode de création */}
        {showCreationModeModal && (
          <Dialog open={showCreationModeModal} onOpenChange={(open) => {
            setShowCreationModeModal(open);
            if (!open) {
              setPrefilledData(null);
            }
          }}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden p-0">
              <div className="p-6 bg-gradient-to-br from-[#1e40af]/5 to-[#1e3a8a]/5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="p-2 bg-[#1e40af]/10 rounded-lg text-[#1e40af]">
                      <Plus className="h-5 w-5" />
                    </span>
                    Initialiser l'élection {selectedElectionCategory === 'professional' ? 'Professionnelle' : 'Politique'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500 mt-1">
                    Choisissez votre méthode pour créer l'élection
                  </DialogDescription>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Manuelle */}
                  <div
                    onClick={() => {
                      setShowCreationModeModal(false);
                      setPrefilledData(null);
                      if (selectedElectionCategory === 'political') {
                        setShowWizard(true);
                      } else {
                        setShowProWizard(true);
                      }
                    }}
                    className="group border border-gray-100 hover:border-blue-300 hover:shadow-lg rounded-xl p-6 cursor-pointer bg-white transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="p-3 bg-blue-50 text-[#1e40af] rounded-lg group-hover:bg-[#1e40af] group-hover:text-white transition-all duration-300">
                          <Edit className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-semibold bg-blue-50 text-[#1e40af] px-2 py-0.5 rounded-full">
                          Standard
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base mb-1">Création Manuelle</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Saisissez pas à pas toutes les caractéristiques de l'élection à l'aide de notre assistant guidé.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center text-xs font-semibold text-[#1e40af] group-hover:translate-x-1 transition-transform duration-300">
                      Commencer l'assistant <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                  </div>

                  {/* Option 2: Fichier de configuration */}
                  <div
                    onClick={() => {
                      document.getElementById('config-file-input')?.click();
                    }}
                    className="group border border-purple-100 hover:border-purple-300 hover:shadow-lg rounded-xl p-6 cursor-pointer bg-[#faf5ff] hover:bg-[#f3e8ff]/40 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="p-3 bg-purple-100 text-purple-700 rounded-lg group-hover:bg-purple-700 group-hover:text-white transition-all duration-300">
                          <Upload className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Rapide
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-purple-950 text-base mb-1">Importer une configuration</h3>
                        <p className="text-xs text-purple-700/70 leading-relaxed mb-3">
                          Initialisez l'élection en chargeant un fichier Excel pré-rempli contenant tous les paramètres.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadXLSXTemplate(selectedElectionCategory);
                          }}
                          className="h-7 text-[10px] font-semibold text-purple-700 hover:text-purple-950 hover:bg-purple-100 bg-purple-50/50 p-2 rounded gap-1.5 w-fit"
                        >
                          <Download className="h-3 w-3" />
                          Télécharger le modèle Excel (.xlsx)
                        </Button>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center text-xs font-semibold text-purple-700 group-hover:translate-x-1 transition-transform duration-300">
                      Sélectionner un fichier <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                    <input
                      id="config-file-input"
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileImport}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Election Modal */}
        {showEditModal && editingElection && (
          editingElection.type === 'Élection Professionnelle' ? (
            <EditProfessionalElectionModal
              election={editingElection}
              onClose={handleCloseEditModal}
              onUpdate={handleUpdateProElection}
            />
          ) : (
            <EditElectionModal
              election={editingElection}
              onClose={handleCloseEditModal}
              onUpdate={handleUpdateElection}
            />
          )
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && electionToDelete && (
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg text-red-600 flex items-center gap-2">
                  <span className="p-1 bg-red-100 rounded text-red-600">⚠️</span>
                  Supprimer l'élection
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 pt-2">
                  Êtes-vous absolument sûr de vouloir supprimer l'élection <strong className="text-gray-900">"{electionToDelete.title}"</strong> ?
                  <br /><br />
                  Cette action est <span className="font-semibold text-red-600">irréversible</span>. Elle supprimera définitivement cette élection ainsi que toutes les données associées : les procès-verbaux, les votes saisis, les candidats liés et les collèges électoraux.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setElectionToDelete(null);
                  }}
                  disabled={isDeleting}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? 'Suppression en cours...' : 'Confirmer la suppression'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default ElectionManagementUnified;
