/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  MapPin,
  Users,
  Building,
  Plus,
  Star,
  Eye,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  RefreshCcw,
  BarChart3,
  Globe,
  Lock,
  Globe2,
  Upload,
  Download,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AddCenterModal from './AddCenterModal';
import AddCandidateModal from './AddCandidateModal';
import CenterDetailModal from './CenterDetailModal';
import EditCenterModal from './EditCenterModal';
import EditCandidateModal from './EditCandidateModal';
import EditBureauModal from './EditBureauModal';
import CandidateProfileModal from './CandidateProfileModal';
import InitialsAvatar from '@/components/ui/initials-avatar';
import { useRBAC } from '@/hooks/useRBAC';
import {
  parseEstablishmentsSheet,
  importEstablishmentsToElection,
  parseUnionListsSheet,
  importUnionListsToElection,
} from '@/utils/excelImport';

interface Election {
  id: string; // UUID
  title: string;
  date: string;
  status: string;
  description: string;
  voters: number;
  candidates: number;
  centers: number;
  bureaux: number;
  location: string;
  type: string;
  seatsAvailable: number;
  budget?: number;
  voteGoal?: number;
  province: string;
  department: string;
  commune: string;
  arrondissement: string;
  enterpriseId?: string;
  has_second_round?: boolean;
  second_round_date?: string | null;
  hiddenFromPublic?: boolean;
  is_published?: boolean;
}

interface Center {
  id: string;
  name: string;
  address: string;
  responsable: string;
  contact: string;
  bureaux: number;
  voters: number;
  seats?: number;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
  votes?: number;
  percentage?: number;
  college?: string;
  titulaires?: any[];
  suppleants?: any[];
  unionLogo?: string | null;
  unionId?: string | null;
  seatsToFill?: number;
}

interface ElectionDetailViewProps {
  election: Election;
  onBack: () => void;
  onDataChange?: () => void;
}

const ElectionDetailView: React.FC<ElectionDetailViewProps> = ({ election, onBack, onDataChange }) => {
  const { can } = useRBAC();
  const canManage = can('elections:manage');
  const isProfessional = election.type?.trim() === 'Élection Professionnelle' || !!(election.enterpriseId || (election as any).enterprise_id);
  const queryClient = useQueryClient();

  const [showAddCenter, setShowAddCenter] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showEditCenter, setShowEditCenter] = useState(false);
  const [showEditCandidate, setShowEditCandidate] = useState(false);
  const [showEditBureau, setShowEditBureau] = useState(false);
  const [showCandidateProfile, setShowCandidateProfile] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedBureau, setSelectedBureau] = useState<any>(null);
  
  const centersFileInputRef = useRef<HTMLInputElement>(null);
  const candidatesFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [statistics, setStatistics] = useState({
    totalVoters: 0,
    totalCenters: 0,
    totalBureaux: 0,
    totalCandidates: 0,
    totalSeats: 0
  });
  const [centersViewMode, setCentersViewMode] = useState<'grid' | 'list'>('grid');
  const [candidatesViewMode, setCandidatesViewMode] = useState<'grid' | 'list'>('grid');
  const [isPublished, setIsPublished] = useState(election.is_published || false);

  const [candidatesSearch, setCandidatesSearch] = useState('');
  const [candidatesCollegeFilter, setCandidatesCollegeFilter] = useState('all');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesGridPage, setCandidatesGridPage] = useState(1);
  const CANDIDATES_PAGE_SIZE = 20;
  const CANDIDATES_GRID_PAGE_SIZE = 12;

  const togglePublication = async () => {
    try {
      const { error } = await supabase
        .from('elections')
        .update({ is_published: !isPublished })
        .eq('id', election.id);
        
      if (error) throw error;
      
      setIsPublished(!isPublished);
      toast.success(isPublished ? 'Les résultats ont été masqués du grand public.' : 'Les résultats sont désormais publics !');
      
      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la publication:', err);
      toast.error('Erreur lors de la modification du statut de publication');
    }
  };

  // --- Query functions (standalone, no setState) ---

  async function fetchCentersData(electionId: string): Promise<Center[]> {
    const { data, error } = await supabase
      .from('election_centers')
      .select(`
        voting_centers(
          id, name, address, contact_name, contact_phone, enterprise_id,
          total_voters, total_bureaux,
          voting_bureaux!center_id(id, name, registered_voters, election_id, seats_to_fill, lieu_vote, college)
        )
      `)
      .eq('election_id', electionId);

    if (error) {
      console.error('Erreur lors du chargement des centres:', error);
      return [];
    }

    const transformedCenters: Center[] = (data ?? []).map((link: any) => {
      const center = link.voting_centers as any;
      if (!center) return null;

      const bureaux = (Array.isArray(center.voting_bureaux) ? center.voting_bureaux : [])
        .filter((b: any) => b.election_id === electionId || String(b.election_id) === String(electionId));

      const isCollegeEntry = (b: any) =>
        b.name?.startsWith?.('College -') || (b.college != null && b.college !== '' && b.college !== 'general');
      const physicalBureaux = bureaux.filter((b: any) => !isCollegeEntry(b));
      const collegeBureaux  = bureaux.filter((b: any) =>  isCollegeEntry(b));
      const countableBureaux = physicalBureaux.length > 0 ? physicalBureaux : collegeBureaux;

      const votersFromBureaux = bureaux.reduce((sum: number, bureau: any) =>
        sum + (bureau.registered_voters || 0), 0);
      const finalVoters = votersFromBureaux > 0 ? votersFromBureaux : (Number(center.total_voters) || 0);

      const totalBureauxCount = countableBureaux.length;
      const finalBureaux = totalBureauxCount > 0 ? totalBureauxCount : (Number(center.total_bureaux) || 0);

      const totalSeats = bureaux.reduce((sum: number, b: any) => sum + (Number(b.seats_to_fill) || 0), 0);

      return {
        id: center.id.toString(),
        name: center.name,
        address: center.address || '',
        responsable: center.contact_name || '',
        contact: center.contact_phone || '',
        bureaux: finalBureaux,
        voters: finalVoters,
        seats: totalSeats
      };
    }).filter(Boolean) as Center[];

    return transformedCenters;
  }

  async function fetchCandidatesData(electionId: string, electionType: string): Promise<Candidate[]> {
    if (electionType === 'Élection Professionnelle') {
      let rawData: any[] | null = null;
      let hasLogo = true;

      const { data: dataWithLogo, error: errWithLogo } = await supabase
        .from('union_lists')
        .select(`id, college, titulaires, suppleants, unions(id, name, acronym, logo)`)
        .eq('election_id', electionId);

      if (errWithLogo) {
        hasLogo = false;
        const { data: dataNoLogo, error: errNoLogo } = await supabase
          .from('union_lists')
          .select(`id, college, titulaires, suppleants, unions(id, name, acronym)`)
          .eq('election_id', electionId);
        if (errNoLogo) throw errNoLogo;
        rawData = dataNoLogo;
      } else {
        rawData = dataWithLogo;
      }

      const { data: electoralColleges } = await supabase
        .from('electoral_colleges')
        .select('college_type, seats_to_fill')
        .eq('election_id', electionId);

      const seatsMap = new Map<string, number>(
        (electoralColleges || []).map((ec: any) => [String(ec.college_type), Number(ec.seats_to_fill) || 1])
      );

      const transformed: Candidate[] = (rawData ?? []).map((list: any) => ({
        id: list.id,
        name: list.unions?.name || 'Syndicat inconnu',
        party: list.unions?.acronym || 'Indépendant',
        isOurCandidate: false,
        college: list.college,
        titulaires: list.titulaires || [],
        suppleants: list.suppleants || [],
        unionLogo: hasLogo ? (list.unions?.logo || null) : null,
        unionId: list.unions?.id || null,
        seatsToFill: seatsMap.get(list.college) || 1,
      }));

      console.log(`📋 ${transformed.length} listes syndicales chargées pour l'élection`);
      return transformed;
    }

    const { data, error } = await supabase
      .from('election_candidates')
      .select(`
        candidates(id, name, party, photo_url, is_our_candidate),
        is_our_candidate
      `)
      .eq('election_id', electionId);

    if (error) {
      console.error('Erreur lors du chargement des candidats:', error);
      return [];
    }

    const transformedCandidates: Candidate[] = (data ?? []).map((link: any) => ({
      id: String(link.candidates.id),
      name: link.candidates.name || '',
      party: link.candidates.party || '',
      isOurCandidate: link.is_our_candidate || false,
      photo: link.candidates.photo_url || '/placeholder.svg',
    }));

    return transformedCandidates;
  }

  async function fetchEnterpriseData(entId: string): Promise<any> {
    const { data, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('id', entId)
      .single();

    if (error) {
      console.error('Erreur lors du chargement de l\'entreprise:', error);
      throw error;
    }
    return data;
  }

  // --- useQuery hooks ---

  const entId = election.enterpriseId || (election as any).enterprise_id;

  const { data: centersData, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ['election-centers', election.id],
    queryFn: () => fetchCentersData(election.id),
    staleTime: 5 * 60 * 1000,
  });

  const { data: candidatesData } = useQuery<Candidate[]>({
    queryKey: ['election-candidates', election.id, election.type],
    queryFn: () => fetchCandidatesData(election.id, election.type),
    staleTime: 5 * 60 * 1000,
  });

  const { data: enterpriseData, isLoading: loadingEnterprise } = useQuery<any>({
    queryKey: ['election-enterprise', entId],
    queryFn: () => fetchEnterpriseData(entId),
    staleTime: 5 * 60 * 1000,
    enabled: !!entId,
  });

  // Derive state-like constants from query data
  const centers: Center[] = centersData ?? [];
  const candidates: Candidate[] = candidatesData ?? [];
  const enterprise = enterpriseData ?? null;
  const loading = centersLoading;


  // Mettre à jour les statistiques quand les données changent
  useEffect(() => {
    const totalVoters = centers.reduce((sum, center) => sum + center.voters, 0);
    const totalBureaux = centers.reduce((sum, center) => sum + center.bureaux, 0);
    const totalSeats = centers.reduce((sum, center) => sum + (center.seats || 0), 0);

    setStatistics({
      totalVoters: totalVoters || election.voters,
      totalCenters: centers.length || election.centers,
      totalBureaux: totalBureaux || election.bureaux,
      totalCandidates: candidates.length || election.candidates,
      totalSeats: totalSeats || election.seatsAvailable
    });
  }, [centers, candidates, election]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'À venir': return 'default';
      case 'En cours': return 'secondary';
      case 'Terminée': return 'outline';
      default: return 'default';
    }
  };

  const handleAddCenter = async (centersData: Center[]) => {
    try {
      console.log('handleAddCenter appelé avec:', centersData);
      
      // Si ce n'est pas une élection professionnelle, on doit lier les centres manuellement
      // Pour les pro, le modal a déjà créé le lien election_centers lors de la création du site
      if (election.type !== 'Élection Professionnelle') {
        // Lier les centres sélectionnés à l'élection
        const centerLinks = centersData.map(center => ({
          election_id: election.id,
          center_id: center.id
        }));

        const { error: linkError } = await supabase
          .from('election_centers')
          .insert(centerLinks);

        if (linkError) {
          console.error('Erreur lors de l\'association centres-élection:', linkError);
          toast.error(`Erreur lors de l'association des centres: ${linkError.message}`);
          return;
        }
      }

      // Recharger les centres depuis la base de données
      await queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });

      // Notifier le parent pour rafraîchir les données
      if (onDataChange) {
        onDataChange();
      }

      setShowAddCenter(false);
      toast.success(`${centersData.length} centre${centersData.length > 1 ? 's' : ''} ajouté${centersData.length > 1 ? 's' : ''} et rattaché${centersData.length > 1 ? 's' : ''} à l'élection`);
    } catch (error) {
      console.error('Erreur lors de l\'ajout des centres:', error);
      toast.error('Erreur lors de l\'ajout des centres');
    }
  };

  const handleDownloadCentersTemplate = async () => {
    try {
      if (election.type === 'Élection Professionnelle') {
        const link = document.createElement('a');
        link.href = '/modele_etablissements.xlsx';
        link.download = 'modele_etablissements.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Modèle Établissements téléchargé !");
        return;
      }
      
      const XLSX = await import('xlsx');
      const ws_data = [
        ["Région / Localisation", "Nom Établissement / Site", "Responsable Établissement", "Contact Téléphone", "Nom Bureau de vote", "Nombre d'électeurs", "Collège concerné"],
        ["Libreville", "Siège Social", "Jean Dupont", "061234567", "Bureau 1", "50", "Employés"],
        ["Libreville", "Siège Social", "Jean Dupont", "061234567", "Bureau 2", "50", "Cadres"],
        ["Port-Gentil", "Agence Port-Gentil", "Marie Claire", "062345678", "Bureau Unique", "30", "Général"]
      ];
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Établissements & Bureaux");
      XLSX.writeFile(wb, "Modele_Unites_De_Vote.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du modèle");
    }
  };

  const handleImportCenters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          if (!data) throw new Error("Fichier vide");
          const workbook = XLSX.read(data, { type: 'array' });
          const isPro = election.type === 'Élection Professionnelle';
          const parsedCenters = await parseEstablishmentsSheet(workbook, isPro);
          if (parsedCenters.length === 0) {
            throw new Error('Aucun établissement valide trouvé dans le fichier.');
          }

          const entId = enterprise?.id || election.enterpriseId || (election as any).enterprise_id;
          const importResult = await importEstablishmentsToElection(
            supabase,
            election.id,
            entId,
            parsedCenters
          );

          if (importResult.linked === 0) {
            const detail = importResult.errors[0] || 'vérifiez le fichier et les noms déjà en base';
            toast.error(`Import impossible : ${detail}`);
          } else {
            const parts = [`${importResult.linked} établissement(s) rattaché(s)`];
            if (importResult.created > 0) parts.push(`${importResult.created} créé(s)`);
            if (importResult.skipped > 0) parts.push(`${importResult.skipped} ignoré(s)`);
            toast.success(parts.join(' · '));
            if (importResult.errors.length > 0) {
              console.warn('Import établissements — avertissements:', importResult.errors);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });
          if (onDataChange) onDataChange();
        } catch (err: any) {
          toast.error(err.message || "Erreur de lecture du fichier");
        } finally {
          setIsImporting(false);
          if (centersFileInputRef.current) centersFileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'import");
      setIsImporting(false);
      if (centersFileInputRef.current) centersFileInputRef.current.value = '';
    }
  };

  const handleAddCandidate = async (candidatesData: Candidate[]) => {
    try {
      console.log('handleAddCandidate appelé avec:', candidatesData);
      
      // Si c'est une élection professionnelle, le modal a déjà fait l'insertion
      if (election.type !== 'Élection Professionnelle') {
        // Lier les candidats sélectionnés à l'élection
        const candidateLinks = candidatesData.map(candidate => ({
          election_id: election.id,
          candidate_id: candidate.id,
          is_our_candidate: candidate.isOurCandidate
        }));

        const { error: linkError } = await supabase
          .from('election_candidates')
          .insert(candidateLinks);

        if (linkError) {
          console.error('Erreur lors de l\'association candidats-élection:', linkError);
          toast.error(`Erreur lors de l'association des candidats: ${linkError.message}`);
          return;
        }
      }

      // Recharger les candidats depuis la base de données
      await queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });

      // Notifier le parent pour rafraîchir les données
      if (onDataChange) {
        onDataChange();
      }

      setShowAddCandidate(false);
      toast.success(`${candidatesData.length} candidat${candidatesData.length > 1 ? 's' : ''} ajouté${candidatesData.length > 1 ? 's' : ''} et rattaché${candidatesData.length > 1 ? 's' : ''} à l'élection`);
    } catch (error) {
      console.error('Erreur lors de l\'ajout des candidats:', error);
      toast.error('Erreur lors de l\'ajout des candidats');
    }
  };

  const handleDownloadCandidatesTemplate = async () => {
    try {
      if (election.type === 'Élection Professionnelle') {
        const link = document.createElement('a');
        link.href = '/modele_listes.xlsx';
        link.download = 'listes.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Modèle listes.xlsx téléchargé (feuille « Listes »)');
        return;
      }

      const XLSX = await import('xlsx');
      const ws_data = [
        ["Sigle Syndicat", "Nom Complet Syndicat", "Collège concerné", "Nom complet du Titulaire", "Nom complet du Suppléant"],
        ["SYND-A", "Syndicat A", "Maîtrise", "Paul Martin", "Sophie Legrand"],
        ["SYND-A", "Syndicat A", "Cadre", "Lucie Durant", "Marc Dubois"],
        ["IND", "Indépendant", "Encadrement", "Jacques Lambert", ""]
      ];
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Candidats & Syndicats");
      XLSX.writeFile(wb, "Modele_Listes_Syndicales.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du modèle");
    }
  };

  const handleImportCandidates = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          if (!data) throw new Error("Fichier vide");
          const workbook = XLSX.read(data, { type: 'array' });
          const isPro = election.type === 'Élection Professionnelle';
          const parsedLists = await parseUnionListsSheet(workbook, isPro);

          if (parsedLists.length === 0) {
            throw new Error(
              'Aucune liste trouvée dans le fichier. Remplissez au moins une ligne sous les en-têtes (feuille « Listes »).'
            );
          }

          const importResult = await importUnionListsToElection(supabase, election.id, parsedLists);

          if (importResult.imported === 0) {
            const detail = importResult.errors[0] || 'vérifiez les colonnes du modèle listes.xlsx (feuille « Listes »)';
            toast.error(`Import impossible : ${detail}`);
          } else {
            const parts = [`${importResult.imported} liste(s) importée(s)`];
            if (importResult.skipped > 0) parts.push(`${importResult.skipped} déjà présente(s) ou ignorée(s)`);
            toast.success(parts.join(' · '));
            if (importResult.errors.length > 0) {
              console.warn('Import listes — avertissements:', importResult.errors);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });
          if (onDataChange) onDataChange();
        } catch (err: any) {
          toast.error(err.message || "Erreur de lecture du fichier");
        } finally {
          setIsImporting(false);
          if (candidatesFileInputRef.current) candidatesFileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'import");
      setIsImporting(false);
      if (candidatesFileInputRef.current) candidatesFileInputRef.current.value = '';
    }
  };

  const handleRemoveCenter = async (id: string) => {
    toast.warning('Supprimer ce centre de cette élection ?', {
      action: {
        label: 'Supprimer',
        onClick: async () => {
          try {
            // Supprimer uniquement le lien centre-élection
            const { error } = await supabase
              .from('election_centers')
              .delete()
              .eq('election_id', election.id)
              .eq('center_id', id);

            if (error) {
              console.error('Erreur lors de la suppression du lien centre-élection:', error);
              toast.error('Suppression impossible');
              return;
            }

            // Recharger les centres depuis la base de données
            await queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });

            // Notifier le parent pour rafraîchir les données
            if (onDataChange) {
              onDataChange();
            }

            toast.success('Centre retiré de l\'élection');
          } catch (err) {
            console.error('Erreur lors de la suppression du centre:', err);
            toast.error('Erreur lors de la suppression');
          }
        }
      },
      duration: 6000
    });
  };

  const handleRemoveCandidate = async (id: string) => {
    toast.warning('Supprimer ce candidat/cette liste de cette élection ?', {
      action: {
        label: 'Supprimer',
        onClick: async () => {
          try {
            if (election.type === 'Élection Professionnelle') {
              const { error: unionListError } = await supabase
                .from('union_lists')
                .delete()
                .eq('id', id);

              if (unionListError) {
                console.error('Erreur lors de la suppression de la liste:', unionListError);
                toast.error('Suppression impossible');
                return;
              }
            } else {
              // Supprimer l'association candidat-élection
              const { error: electionCandidateError } = await supabase
                .from('election_candidates')
                .delete()
                .eq('election_id', election.id)
                .eq('candidate_id', id);

              if (electionCandidateError) {
                console.error('Erreur lors de la suppression de l\'association:', electionCandidateError);
                toast.error('Suppression impossible');
                return;
              }
            }

            // Recharger les candidats depuis la base de données
            await queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });

            // Notifier le parent pour rafraîchir les données
            if (onDataChange) {
              onDataChange();
            }

            toast.success('Candidat retiré de l\'élection');
          } catch (err) {
            console.error('Erreur lors de la suppression du candidat:', err);
            toast.error('Erreur lors de la suppression');
          }
        }
      },
      duration: 6000
    });
  };

  // Fonctions CRUD pour les centres
  const handleEditCenter = (center: Center) => {
    setSelectedCenter(center);
    setShowEditCenter(true);
  };

  const handleUpdateCenter = (updatedCenter: Center) => {
    queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });
    setShowEditCenter(false);
    setSelectedCenter(null);
    if (onDataChange) {
      onDataChange();
    }
  };

  // Fonctions CRUD pour les candidats
  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowEditCandidate(true);
  };

  const handleUpdateCandidate = (updatedCandidate: Candidate) => {
    queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });
    setShowEditCandidate(false);
    setSelectedCandidate(null);
    if (onDataChange) {
      onDataChange();
    }
  };

  // Fonctions CRUD pour les bureaux
  const handleEditBureau = (bureau: any) => {
    setSelectedBureau(bureau);
    setShowEditBureau(true);
  };

  const handleUpdateBureau = (_updatedBureau: any) => {
    // Recharger les centres pour refléter les modifications du bureau
    queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });
    setShowEditBureau(false);
    setSelectedBureau(null);
    if (onDataChange) {
      onDataChange();
    }
  };

  const handleDeleteBureau = async (bureauId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bureau ?')) {
      try {
        const { error } = await supabase
          .from('voting_bureaux')
          .delete()
          .eq('id', bureauId);

        if (error) {
          console.error('Erreur lors de la suppression du bureau:', error);
          toast.error('Erreur lors de la suppression du bureau');
          return;
        }

        toast.success('Bureau supprimé avec succès');
        queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] }); // Recharger les centres pour mettre à jour les bureaux
        
        if (onDataChange) {
          onDataChange();
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du bureau:', error);
        toast.error('Erreur lors de la suppression du bureau');
      }
    }
  };

  // Fonction pour ouvrir le profil du candidat
  const handleViewCandidateProfile = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowCandidateProfile(true);
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = candidatesSearch.toLowerCase();
    const matchSearch = !q || [
      c.name, c.party,
      ...(c.titulaires?.map((t: any) => t.name) ?? []),
      ...(c.titulaires?.map((t: any) => t.etablissement) ?? []),
    ].some((v) => String(v || '').toLowerCase().includes(q));

    const matchCollege =
      candidatesCollegeFilter === 'all' || c.college === candidatesCollegeFilter;

    return matchSearch && matchCollege;
  });

  const totalCandidatesPages = Math.max(1, Math.ceil(filteredCandidates.length / CANDIDATES_PAGE_SIZE));
  const totalCandidatesGridPages = Math.max(1, Math.ceil(filteredCandidates.length / CANDIDATES_GRID_PAGE_SIZE));
  const pagedCandidates = filteredCandidates.slice(
    (candidatesPage - 1) * CANDIDATES_PAGE_SIZE,
    candidatesPage * CANDIDATES_PAGE_SIZE
  );
  const pagedCandidatesGrid = filteredCandidates.slice(
    (candidatesGridPage - 1) * CANDIDATES_GRID_PAGE_SIZE,
    candidatesGridPage * CANDIDATES_GRID_PAGE_SIZE
  );

  const allPageSelected =
    pagedCandidates.length > 0 &&
    pagedCandidates.every((c) => selectedCandidateIds.has(c.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedCandidateIds((prev) => {
        const next = new Set(prev);
        pagedCandidates.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedCandidateIds((prev) => {
        const next = new Set(prev);
        pagedCandidates.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCandidateIds.size === 0) return;
    toast.warning(`Supprimer ${selectedCandidateIds.size} liste(s) ?`, {
      action: {
        label: 'Confirmer',
        onClick: async () => {
          try {
            const ids = Array.from(selectedCandidateIds);
            if (election.type === 'Élection Professionnelle') {
              await supabase.from('union_lists').delete().in('id', ids);
            } else {
              await supabase.from('election_candidates')
                .delete()
                .eq('election_id', election.id)
                .in('candidate_id', ids);
            }
            setSelectedCandidateIds(new Set());
            await queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });
            if (onDataChange) onDataChange();
            toast.success('Suppression effectuée');
          } catch (err) {
            toast.error('Erreur lors de la suppression');
          }
        }
      },
      duration: 6000
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des détails de l'élection...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header moderne avec gradient - Mobile First */}
        <div className="relative overflow-hidden bg-gradient-to-r from-gov-blue/5 via-gov-blue-light/5 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={onBack}
                  className="hover:bg-white/50 transition-all duration-300 rounded-lg px-2 sm:px-3 py-2 text-sm sm:text-base"
                >
                  <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Retour aux élections</span>
                  <span className="xs:hidden">Retour</span>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['election-candidates', election.id, election.type] });
                    queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] });
                    toast.success('Données actualisées');
                  }}
                  className="hover:bg-white/50 transition-all duration-300 rounded-lg px-2"
                >
                  <RefreshCcw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
                  <span className="text-xs sm:text-sm">Actualiser</span>
                </Button>
              </div>
              
              <Badge 
                variant={election.hiddenFromPublic ? 'outline' : getStatusVariant(election.status)}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium ${
                  election.hiddenFromPublic
                    ? 'bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-100'
                    : ''
                }`}
              >
                {election.hiddenFromPublic ? 'Masqué au public' : election.status}
              </Badge>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">{election.title}</h1>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-2xl line-clamp-2 sm:line-clamp-none">{election.description}</p>
                  <div className="text-xs sm:text-sm text-gray-500">
                    <span className="font-medium">Date:</span> {new Date(election.date).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
              
              {/* Statistiques compactes - Mobile First */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                
              <div className="bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-4 border border-white/20">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                    <div className="p-1 sm:p-1.5 bg-green-500 rounded-md sm:rounded-lg">
                      <Building className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Centres</span>
                  </div>
                  <div className="text-sm sm:text-xl font-bold text-green-900">
                    {statistics.totalCenters}
                  </div>
                </div>
                                
                <div className="bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-4 border border-white/20">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                    <div className="p-1 sm:p-1.5 bg-[#1e40af] rounded-md sm:rounded-lg">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-[#1e40af] uppercase tracking-wide">Bureaux</span>
                  </div>
                  <div className="text-sm sm:text-xl font-bold text-[#1e40af]">
                    {statistics.totalBureaux}
                  </div>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-4 border border-white/20">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                    <div className="p-1 sm:p-1.5 bg-purple-500 rounded-md sm:rounded-lg">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">
                      {election.type === 'Élection Professionnelle' ? 'Listes' : 'Candidats'}
                    </span>
                  </div>
                  <div className="text-sm sm:text-xl font-bold text-purple-900">
                    {statistics.totalCandidates}
                  </div>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-4 border border-white/20">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                    <div className="p-1 sm:p-1.5 bg-[#1e40af] rounded-md sm:rounded-lg">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-[#1e40af] uppercase tracking-wide">
                      {election.type === 'Élection Professionnelle' ? 'Salariés Électeurs' : 'Électeurs'}
                    </span>
                  </div>
                  <div className="text-sm sm:text-xl font-bold text-[#1e40af]">
                    {statistics.totalVoters.toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content avec onglets modernisés - Mobile First */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="flex h-auto w-full bg-gray-50 p-1 rounded-none overflow-x-auto whitespace-nowrap scrollbar-none justify-start md:justify-around gap-1">
              <TabsTrigger 
                value="info" 
                className="flex-shrink-0 flex-1 min-w-[100px] sm:min-w-0 flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:shadow-sm transition-all duration-300 data-[state=active]:border-l-4 data-[state=active]:border-blue-500"
              >
                <div className="p-1 sm:p-1.5 bg-gov-blue/10 rounded-md data-[state=active]:bg-blue-500 transition-colors duration-300">
                  <Building className="w-3 h-3 sm:w-4 sm:h-4 text-gov-blue data-[state=active]:text-white" />
                </div>
                <div className="text-left hidden xs:block">
                  <div className="font-medium text-xs sm:text-sm">Informations</div>
                  <div className="text-xs text-gray-500">Détails généraux</div>
                </div>
                <div className="text-left xs:hidden">
                  <div className="font-medium text-xs">Info</div>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="centers" 
                className="flex-shrink-0 flex-1 min-w-[100px] sm:min-w-0 flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 rounded-lg data-[state=active]:bg-green-50 data-[state=active]:shadow-sm transition-all duration-300 data-[state=active]:border-l-4 data-[state=active]:border-green-500"
              >
                <div className="p-1 sm:p-1.5 bg-green-100 rounded-md data-[state=active]:bg-green-500 transition-colors duration-300">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 data-[state=active]:text-white" />
                </div>
                <div className="text-left hidden xs:block">
                  <div className="font-medium text-xs sm:text-sm">
                    {election.type === 'Élection Professionnelle' ? 'Établissements' : 'Centres & Bureaux'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {election.type === 'Élection Professionnelle' ? 'Établissements' : 'Organisation territoriale'}
                  </div>
                </div>
                <div className="text-left xs:hidden">
                  <div className="font-medium text-xs">Centres</div>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="candidates" 
                className="flex-shrink-0 flex-1 min-w-[100px] sm:min-w-0 flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 rounded-lg data-[state=active]:bg-purple-50 data-[state=active]:shadow-sm transition-all duration-300 data-[state=active]:border-l-4 data-[state=active]:border-purple-500"
              >
                <div className="p-1 sm:p-1.5 bg-purple-100 rounded-md data-[state=active]:bg-purple-500 transition-colors duration-300">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 data-[state=active]:text-white" />
                </div>
                <div className="text-left hidden xs:block">
                  <div className="font-medium text-xs sm:text-sm">
                    {election.type === 'Élection Professionnelle' ? 'Listes Syndicales' : 'Candidats'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {election.type === 'Élection Professionnelle' ? 'Listes en compétition' : 'Liste des candidats'}
                  </div>
                </div>
                <div className="text-left xs:hidden">
                  <div className="font-medium text-xs">
                    {election.type === 'Élection Professionnelle' ? 'Listes' : 'Candidats'}
                  </div>
                </div>
              </TabsTrigger>
            </TabsList>

          {/* Section Informations modernisée */}
          <TabsContent value="info" className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informations générales */}
              <Card className="election-card group hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-gov-blue/10 rounded-lg">
                      <Building className="w-5 h-5 text-gov-blue" />
                    </div>
                    Informations Générales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type d'élection</label>
                      <p className="text-lg font-bold text-gray-900">{election.type}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</label>
                      <div className="mt-1">
                        <Badge 
                          variant={election.hiddenFromPublic ? 'outline' : getStatusVariant(election.status)}
                          className={`px-2 py-1 text-xs font-medium ${
                            election.hiddenFromPublic
                              ? 'bg-violet-100 text-violet-800 border-violet-300'
                              : ''
                          }`}
                        >
                          {election.hiddenFromPublic ? 'Masqué au public' : election.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date du scrutin</label>
                    <p className="text-lg font-bold text-gray-900">
                      {new Date(election.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {election.type === 'Élection Professionnelle' && election.has_second_round && (
                    <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                      <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                        Calendrier des Scrutins liés (1er & 2nd Tour)
                      </h4>
                      <div className="relative flex items-center justify-between">
                        <div className="flex-1 text-center p-2 bg-white rounded-lg border border-purple-100 shadow-sm z-10">
                          <span className="text-[10px] text-gray-500 font-semibold block uppercase">1er Tour</span>
                          <span className="text-sm font-bold text-gray-800">
                            {new Date(election.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center relative px-2">
                          <span className="text-[9px] text-purple-600 font-bold mb-1 bg-purple-100 px-1.5 py-0.5 rounded-full">+9 jours</span>
                          <div className="w-full h-0.5 bg-dashed bg-purple-300"></div>
                        </div>
                        <div className="flex-1 text-center p-2 bg-white rounded-lg border border-purple-100 shadow-sm z-10">
                          <span className="text-[10px] text-gray-500 font-semibold block uppercase">2nd Tour</span>
                          <span className="text-sm font-bold text-gray-800">
                            {election.second_round_date ? new Date(election.second_round_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Non défini'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sièges à pourvoir</label>
                    <p className="text-xl font-bold text-gov-blue">{statistics.totalSeats || 0}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Informations géographiques ou Entreprise */}
              <Card className="election-card group hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-green-100 rounded-lg">
                        {isProfessional ? (
                          <Building className="w-5 h-5 text-green-600" />
                        ) : (
                          <MapPin className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {isProfessional ? 'Informations Entreprise' : 'Circonscription Électorale'}
                    </CardTitle>
                    {isProfessional && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['election-enterprise', entId] });
                          toast.success('Données entreprise actualisées');
                        }}
                        className="hover:bg-green-50 transition-all duration-300 rounded-lg px-2"
                      >
                        <RefreshCcw className={cn("w-4 h-4 mr-1", loadingEnterprise && "animate-spin")} />
                        <span className="text-xs">Rafraîchir</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {isProfessional ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Organisation</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.name || 'Non renseignée')}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Secteur</label>
                            <p className="text-sm font-bold text-gray-900 mt-1 capitalize">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.sector?.trim() ? enterprise.sector : <span className="text-gray-400 italic">Non renseigné</span>)}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Effectif Total</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.total_employees && enterprise.total_employees > 0 ? <span>{enterprise.total_employees} employés</span> : <span className="text-gray-400 italic">Non renseigné</span>)}
                            </p>
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tutelle</label>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {loadingEnterprise ? 'Chargement...' : (enterprise?.administrative_unit?.trim() ? enterprise.administrative_unit : <span className="text-gray-400 italic">Non renseignée</span>)}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Localisation Siège</label>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {loadingEnterprise
                              ? 'Chargement...'
                              : (() => {
                                  const parts = [enterprise?.province_name?.trim(), enterprise?.commune_name?.trim()].filter(Boolean);
                                  return parts.length > 0 ? parts.join(', ') : <span className="text-gray-400 italic">Non renseignée</span>;
                                })()}
                          </p>
                        </div>
                        {!loadingEnterprise && (
                          enterprise?.hr_contact && enterprise.hr_contact.name?.trim() ? (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <label className="text-xs font-medium text-blue-600 uppercase tracking-wide">Contact RH</label>
                              <p className="text-sm font-bold text-blue-900 mt-1">{enterprise.hr_contact.name}</p>
                              <p className="text-xs text-blue-700">{enterprise.hr_contact.phone} | {enterprise.hr_contact.email}</p>
                            </div>
                          ) : (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact RH</label>
                              <p className="text-sm text-gray-400 italic mt-1">Non renseigné</p>
                            </div>
                          )
                        )}
                      </div>
                    ) : (

                      <>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Province</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">{election.province || 'Non spécifiée'}</p>
                          </div>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commune</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">{election.commune || 'Non spécifiée'}</p>
                          </div>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Arrondissement</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">{election.arrondissement || 'Non spécifié'}</p>
                          </div>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Section Centres et Bureaux modernisée - Mobile First */}
          <TabsContent value="centers" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {election.type === 'Élection Professionnelle' ? 'Établissements (Centres)' : 'Centres de Vote'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {election.type === 'Élection Professionnelle' ? 'Gérez les établissements et leurs urnes (bureaux)' : 'Gérez les centres de vote et leurs bureaux'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Boutons de vue */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCentersViewMode('grid')}
                    className={`h-8 w-8 p-0 rounded-md transition-all duration-200 ${
                      centersViewMode === 'grid' 
                        ? 'bg-white shadow-sm text-green-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCentersViewMode('list')}
                    className={`h-8 w-8 p-0 rounded-md transition-all duration-200 ${
                      centersViewMode === 'list' 
                        ? 'bg-white shadow-sm text-green-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={centersFileInputRef} 
                      className="hidden" 
                      accept=".xlsx,.xls"
                      onChange={handleImportCenters} 
                    />
                    <Button
                      variant="outline"
                      onClick={handleDownloadCentersTemplate}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                      title="Télécharger le modèle Excel"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden xs:inline ml-2">Modèle</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => centersFileInputRef.current?.click()}
                      disabled={isImporting}
                      className="border-green-600 text-green-600 hover:bg-green-50 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Upload className={cn("w-4 h-4 mr-1 sm:mr-2", isImporting && "animate-bounce")} />
                      <span className="hidden xs:inline">Importer</span>
                    </Button>
                    <Button
                      onClick={() => setShowAddCenter(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden xs:inline">Ajouter un centre</span>
                      <span className="xs:hidden">Ajouter</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {centersViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {centers.map((center) => (
                <Card 
                  key={center.id} 
                  className="election-card group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md"
                  onClick={() => setSelectedCenter(center)}
                >
                  <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300 line-clamp-1">
                          {center.name}
                        </CardTitle>
                        <p className="text-xs text-gray-600 line-clamp-2">{center.address}</p>
                      </div>
                      <div className="p-1 sm:p-1.5 bg-green-100 rounded-md group-hover:bg-green-500 transition-colors duration-300 flex-shrink-0">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 group-hover:text-white" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs font-medium text-gray-600">Responsable:</span>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate ml-2">{center.responsable}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-sm sm:text-lg font-bold text-orange-600">
                          {election.type === 'Élection Professionnelle' ? (center.seats || 0) : center.bureaux}
                        </div>
                        <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">
                          {election.type === 'Élection Professionnelle' ? 'Sièges' : 'Bureaux'}
                        </div>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-gov-blue/5 rounded-lg border border-gov-blue/20">
                        <div className="text-sm sm:text-lg font-bold text-gov-blue">{center.voters.toLocaleString('fr-FR')}</div>
                        <div className="text-xs text-gov-blue font-medium uppercase tracking-wide">Électeurs</div>
                      </div>
                    </div>

                    <div className="flex space-x-1 sm:space-x-2 pt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCenter(center);
                        }}
                        className="flex-1 bg-white border-gray-200 text-gray-700 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all duration-300 text-xs py-1 sm:py-2"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        <span className="hidden xs:inline">Détails</span>
                        <span className="xs:hidden">Voir</span>
                      </Button>
                      {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditCenter(center); }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-all duration-300"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      )}
                      {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCenter(center.id); }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 transition-all duration-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            ) : (
              <div className="space-y-3">
                {centers.map((center) => (
                  <Card 
                    key={center.id} 
                    className="election-card group hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-sm"
                    onClick={() => setSelectedCenter(center)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                            <MapPin className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-600 transition-colors duration-300 line-clamp-1">
                              {center.name}
                            </h3>
                            <p className="text-sm text-gray-600 line-clamp-1">{center.address}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1">
                                <Building className="w-4 h-4 text-orange-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {election.type === 'Élection Professionnelle' ? `${center.seats || 0} sièges` : `${center.bureaux} bureaux`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-gray-700">{center.voters.toLocaleString('fr-FR')} électeurs</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCenter(center);
                            }}
                            className="bg-white border-gray-200 text-gray-700 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all duration-300"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Détails
                          </Button>
                          {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleEditCenter(center); }}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-all duration-300"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Section Candidats modernisée */}
          <TabsContent value="candidates" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Titre + actions */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {election.type === 'Élection Professionnelle' ? 'Listes Syndicales Validées' : 'Candidats Validés'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {election.type === 'Élection Professionnelle' ? 'Gérez les listes en compétition pour cette élection' : 'Gérez la liste des candidats à l\'élection'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCandidatesViewMode('grid')}
                    className={`h-8 w-8 p-0 rounded-md transition-all duration-200 ${
                      candidatesViewMode === 'grid'
                        ? 'bg-white shadow-sm text-purple-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCandidatesViewMode('list')}
                    className={`h-8 w-8 p-0 rounded-md transition-all duration-200 ${
                      candidatesViewMode === 'list'
                        ? 'bg-white shadow-sm text-purple-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={candidatesFileInputRef}
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={handleImportCandidates}
                    />
                    <Button
                      variant="outline"
                      onClick={handleDownloadCandidatesTemplate}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                      title="Télécharger le modèle Excel"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden xs:inline ml-2">Modèle</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => candidatesFileInputRef.current?.click()}
                      disabled={isImporting}
                      className="border-purple-600 text-purple-600 hover:bg-purple-50 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Upload className={cn("w-4 h-4 mr-1 sm:mr-2", isImporting && "animate-bounce")} />
                      <span className="hidden xs:inline">Importer</span>
                    </Button>
                    <Button
                      onClick={() => setShowAddCandidate(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden xs:inline">
                        {election.type === 'Élection Professionnelle' ? 'Ajouter une liste' : 'Ajouter un candidat'}
                      </span>
                      <span className="xs:hidden">Ajouter</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Barre de recherche + filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={election.type === 'Élection Professionnelle' ? 'Rechercher syndicat, tête de liste, établissement…' : 'Rechercher candidat, parti…'}
                  value={candidatesSearch}
                  onChange={(e) => { setCandidatesSearch(e.target.value); setCandidatesPage(1); setCandidatesGridPage(1); }}
                  className="pl-9"
                />
              </div>
              {election.type === 'Élection Professionnelle' && (
                <Select
                  value={candidatesCollegeFilter}
                  onValueChange={(v) => { setCandidatesCollegeFilter(v); setCandidatesPage(1); setCandidatesGridPage(1); }}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Tous les collèges" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les collèges</SelectItem>
                    <SelectItem value="general">Encadrement</SelectItem>
                    <SelectItem value="cadres">Cadre</SelectItem>
                    <SelectItem value="employes">Maîtrise</SelectItem>
                    <SelectItem value="ouvriers">Exécution</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <span className="self-center text-xs text-gray-500 whitespace-nowrap">
                {filteredCandidates.length} résultat{filteredCandidates.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Action de suppression groupée (vue liste) */}
            {candidatesViewMode === 'list' && selectedCandidateIds.size > 0 && canManage && (
              <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                <span className="text-sm font-medium text-purple-700">
                  {selectedCandidateIds.size} sélectionné{selectedCandidateIds.size > 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Supprimer la sélection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCandidateIds(new Set())}
                  className="text-gray-500 hover:bg-gray-100"
                >
                  Désélectionner
                </Button>
              </div>
            )}

            {/* Vue grille */}
            {candidatesViewMode === 'grid' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pagedCandidatesGrid.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className={`election-card group hover:shadow-xl transition-all duration-300 ${
                      candidate.isOurCandidate
                        ? 'border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100'
                        : 'border-0 shadow-md'
                    }`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col items-center text-center space-y-4 pt-2">
                        <div className="relative">
                          {election.type === 'Élection Professionnelle' ? (
                            <>
                              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-purple-50 group-hover:scale-105 transition-transform duration-500">
                                {candidate.titulaires?.[0]?.photo ? (
                                  <img src={candidate.titulaires[0].photo} alt="Head" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-purple-600 bg-purple-100 uppercase">
                                    {candidate.titulaires?.[0]?.name?.charAt(0) || candidate.party?.charAt(0) || 'S'}
                                  </div>
                                )}
                              </div>
                              {candidate.unionLogo && (
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-white shadow-lg border-2 border-white overflow-hidden">
                                  <img src={candidate.unionLogo} alt="Logo syndicat" className="w-full h-full object-contain p-0.5" />
                                </div>
                              )}
                            </>
                          ) : (
                            <InitialsAvatar
                              name={candidate.name}
                              size="xl"
                              className="w-24 h-24 sm:w-32 sm:h-32 shadow-xl border-4 border-white group-hover:scale-105 transition-transform duration-500"
                              backgroundColor="#1e40af"
                            />
                          )}
                        </div>

                        <div className="space-y-1 w-full px-2">
                          <h3 className="font-black text-base sm:text-xl text-gray-900 group-hover:text-purple-600 transition-colors duration-300 line-clamp-2">
                            {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0]
                              ? candidate.titulaires[0].name
                              : candidate.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-blue-600 font-bold uppercase tracking-widest opacity-80">
                            {election.type === 'Élection Professionnelle'
                              ? `${candidate.name} (${candidate.party})`
                              : candidate.party}
                          </p>
                          {election.type === 'Élection Professionnelle' && candidate.college && (
                            <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 mt-1 mx-auto block w-fit ${
                              candidate.college === 'cadres' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              candidate.college === 'employes' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              candidate.college === 'ouvriers' ? 'bg-green-50 text-green-700 border-green-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {candidate.college === 'general' ? 'Encadrement' :
                               candidate.college === 'cadres' ? 'Cadre' :
                               candidate.college === 'employes' ? 'Maîtrise' :
                               candidate.college === 'ouvriers' ? 'Exécution' : candidate.college}
                            </Badge>
                          )}
                          {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0]?.etablissement && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{candidate.titulaires[0].etablissement}</p>
                          )}
                        </div>

                        {election.type === 'Élection Professionnelle' && (
                          (candidate.titulaires?.length || 0) > 1 ? (
                            // Collège multi-sièges : deux colonnes côte à côte
                            <div className="w-full mt-2 pt-3 border-t border-gray-100">
                              <div className="grid grid-cols-2 gap-x-2">
                                <p className="text-[9px] font-black text-purple-700 uppercase text-center mb-1.5">Titulaires</p>
                                <p className="text-[9px] font-black text-blue-700 uppercase text-center mb-1.5">Suppléants</p>
                                {(candidate.titulaires || []).map((t: any, i: number) => {
                                  const s = candidate.suppleants?.[i];
                                  return (
                                    <React.Fragment key={i}>
                                      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-purple-100 flex-shrink-0 flex items-center justify-center">
                                          {t.photo
                                            ? <img src={t.photo} alt="" className="w-full h-full object-cover" />
                                            : <span className="text-[8px] font-bold text-purple-600">{t.name?.charAt(0) || 'T'}</span>}
                                        </div>
                                        <p className="text-[9px] font-bold text-gray-700 truncate leading-tight">{t.name}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                                        {s && (
                                          <>
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-blue-100 flex-shrink-0 flex items-center justify-center">
                                              {s.photo
                                                ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                                                : <span className="text-[8px] font-bold text-blue-600">{s.name?.charAt(0) || 'S'}</span>}
                                            </div>
                                            <p className="text-[9px] font-bold text-gray-700 truncate leading-tight">{s.name}</p>
                                          </>
                                        )}
                                      </div>
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          ) : candidate.suppleants?.[0] ? (
                            // Collège 1 siège : affichage simple existant
                            <div className="w-full mt-2 pt-3 border-t border-gray-100 flex flex-col items-center justify-center gap-2">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 border-2 border-white shadow-sm">
                                {candidate.suppleants[0].photo ? (
                                  <img src={candidate.suppleants[0].photo} alt="Deputy" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-blue-600">S</div>
                                )}
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] font-black text-gray-400 uppercase leading-none">Suppléant</p>
                                <p className="text-[10px] font-bold text-gray-700 break-words">{candidate.suppleants[0].name}</p>
                              </div>
                            </div>
                          ) : null
                        )}

                        {canManage && (
                          <div className="flex w-full gap-2 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCandidate(candidate)}
                              className="flex-1 bg-gray-50 hover:bg-blue-50 text-blue-600 rounded-xl h-10 font-bold transition-all"
                            >
                              <Edit className="w-4 h-4 mr-1.5" />
                              Gérer
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCandidate(candidate.id)}
                              className="w-10 h-10 bg-gray-50 hover:bg-red-50 text-red-500 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>

                {/* Pagination grille */}
                {totalCandidatesGridPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      Page {candidatesGridPage} / {totalCandidatesGridPages} · {filteredCandidates.length} résultat{filteredCandidates.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCandidatesGridPage((p) => Math.max(1, p - 1))}
                        disabled={candidatesGridPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {Array.from({ length: Math.min(5, totalCandidatesGridPages) }, (_, i) => {
                        const half = 2;
                        let start = Math.max(1, candidatesGridPage - half);
                        const end = Math.min(totalCandidatesGridPages, start + 4);
                        start = Math.max(1, end - 4);
                        return start + i;
                      }).map((page) => (
                        <Button
                          key={page}
                          variant={page === candidatesGridPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCandidatesGridPage(page)}
                          className={`h-8 w-8 p-0 text-xs ${page === candidatesGridPage ? 'bg-purple-600 hover:bg-purple-700 border-purple-600' : ''}`}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCandidatesGridPage((p) => Math.min(totalCandidatesGridPages, p + 1))}
                        disabled={candidatesGridPage === totalCandidatesGridPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Vue liste avec cases à cocher et pagination */}
                {/* En-tête de la liste */}
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-purple-600 cursor-pointer flex-shrink-0"
                    />
                  )}
                  <span className="flex-1">
                    {election.type === 'Élection Professionnelle' ? 'Syndicat / Tête de liste' : 'Candidat / Parti'}
                  </span>
                  {election.type === 'Élection Professionnelle' && (
                    <span className="w-28 text-center hidden sm:block">Collège</span>
                  )}
                  {election.type === 'Élection Professionnelle' && (
                    <span className="w-40 hidden md:block">Établissement</span>
                  )}
                  {canManage && <span className="w-24 text-right">Actions</span>}
                </div>

                {filteredCandidates.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className={`election-card group hover:shadow-lg transition-all duration-300 ${
                      selectedCandidateIds.has(candidate.id)
                        ? 'border border-purple-300 bg-purple-50/40'
                        : candidate.isOurCandidate
                        ? 'border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100'
                        : 'border-0 shadow-sm'
                    }`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        {canManage && (
                          <input
                            type="checkbox"
                            checked={selectedCandidateIds.has(candidate.id)}
                            onChange={() => toggleSelectOne(candidate.id)}
                            className="w-4 h-4 rounded accent-purple-600 cursor-pointer flex-shrink-0"
                          />
                        )}
                        <div className="relative flex-shrink-0">
                          {election.type === 'Élection Professionnelle' ? (
                            <>
                              <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm border-2 border-white bg-purple-100">
                                {candidate.titulaires?.[0]?.photo ? (
                                  <img src={candidate.titulaires[0].photo} alt="Head" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-purple-600 uppercase">
                                    {candidate.titulaires?.[0]?.name?.charAt(0) || candidate.party?.charAt(0) || 'S'}
                                  </div>
                                )}
                              </div>
                              {candidate.unionLogo && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-white shadow border border-gray-100 overflow-hidden">
                                  <img src={candidate.unionLogo} alt="Logo" className="w-full h-full object-contain" />
                                </div>
                              )}
                            </>
                          ) : (
                            <InitialsAvatar
                              name={candidate.name}
                              size="md"
                              className="shadow border-2 border-white"
                              backgroundColor="#1e40af"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-gray-900 group-hover:text-purple-600 transition-colors duration-300 line-clamp-1">
                            {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0]
                              ? candidate.titulaires[0].name
                              : candidate.name}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {election.type === 'Élection Professionnelle'
                              ? `${candidate.name} (${candidate.party})`
                              : candidate.party}
                          </p>
                        </div>
                        {election.type === 'Élection Professionnelle' && candidate.college && (
                          <Badge variant="outline" className={`hidden sm:flex text-[10px] font-bold px-2 py-0.5 w-28 justify-center flex-shrink-0 ${
                            candidate.college === 'cadres' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            candidate.college === 'employes' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            candidate.college === 'ouvriers' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {candidate.college === 'general' ? 'Encadrement' :
                             candidate.college === 'cadres' ? 'Cadre' :
                             candidate.college === 'employes' ? 'Maîtrise' :
                             candidate.college === 'ouvriers' ? 'Exécution' : candidate.college}
                          </Badge>
                        )}
                        {election.type === 'Élection Professionnelle' && (
                          <span className="hidden md:block text-xs text-gray-400 w-40 truncate flex-shrink-0">
                            {candidate.titulaires?.[0]?.etablissement || '—'}
                          </span>
                        )}
                        {canManage && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCandidate(candidate)}
                              className="text-blue-600 hover:bg-blue-50 transition-all duration-300 h-8 px-2"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCandidate(candidate.id)}
                              className="text-red-500 hover:bg-red-50 transition-all duration-300 h-8 w-8"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Résumé des résultats */}
                {filteredCandidates.length > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {filteredCandidates.length} résultat{filteredCandidates.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>

        {/* Modals */}
        {showAddCenter && (
          <AddCenterModal
            onClose={() => setShowAddCenter(false)}
            onSubmit={handleAddCenter}
            electionId={election.id}
            enterpriseId={election.enterpriseId}
            electionType={election.type}
          />
        )}

        {showAddCandidate && (
          <AddCandidateModal
            onClose={() => setShowAddCandidate(false)}
            onSubmit={handleAddCandidate}
            electionId={election.id}
            enterpriseId={election.enterpriseId}
            electionType={election.type}
          />
        )}

        {selectedCenter && (
          <CenterDetailModal
            center={selectedCenter}
            onClose={() => setSelectedCenter(null)}
            isProfessional={isProfessional}
            onDataChange={() => queryClient.invalidateQueries({ queryKey: ['election-centers', election.id] })}
            electionId={election.id}
          />
        )}

        {/* Modales d'édition */}
        {showEditCenter && selectedCenter && isProfessional ? (
          <AddCenterModal
            editingCenter={selectedCenter}
            onClose={() => {
              setShowEditCenter(false);
              setSelectedCenter(null);
            }}
            onEditSubmit={(updatedCenter) => {
              handleUpdateCenter(updatedCenter);
              setShowEditCenter(false);
              setSelectedCenter(null);
              // Rafraîchir les données après modification
              if (onDataChange) {
                onDataChange();
              }
            }}
            electionId={election.id}
            enterpriseId={election.enterpriseId}
            electionType={election.type}
          />
        ) : showEditCenter && selectedCenter ? (
          <EditCenterModal
            center={selectedCenter}
            onClose={() => {
              setShowEditCenter(false);
              setSelectedCenter(null);
            }}
            onUpdate={handleUpdateCenter}
          />
        ) : null}

        {showEditCandidate && selectedCandidate && (
          <EditCandidateModal
            candidate={selectedCandidate}
            electionType={election.type}
            onClose={() => {
              setShowEditCandidate(false);
              setSelectedCandidate(null);
            }}
            onUpdate={handleUpdateCandidate}
          />
        )}

        {showEditBureau && selectedBureau && (
          <EditBureauModal
            bureau={selectedBureau}
            centerId={selectedCenter?.id || ''}
            onClose={() => {
              setShowEditBureau(false);
              setSelectedBureau(null);
            }}
            onUpdate={handleUpdateBureau}
          />
        )}


      </div>
    </Layout>
  );
};

export default ElectionDetailView;
