/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Globe2
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
}

interface Center {
  id: string;
  name: string;
  address: string;
  responsable: string;
  contact: string;
  bureaux: number;
  voters: number;
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

  const [showAddCenter, setShowAddCenter] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showEditCenter, setShowEditCenter] = useState(false);
  const [showEditCandidate, setShowEditCandidate] = useState(false);
  const [showEditBureau, setShowEditBureau] = useState(false);
  const [showCandidateProfile, setShowCandidateProfile] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedBureau, setSelectedBureau] = useState<any>(null);
  const [enterprise, setEnterprise] = useState<any>(null);
  const [loadingEnterprise, setLoadingEnterprise] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalVoters: 0,
    totalCenters: 0,
    totalBureaux: 0,
    totalCandidates: 0
  });
  const [centersViewMode, setCentersViewMode] = useState<'grid' | 'list'>('grid');
  const [candidatesViewMode, setCandidatesViewMode] = useState<'grid' | 'list'>('grid');
  const [isPublished, setIsPublished] = useState(election.is_published || false);

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

  // Fonction pour charger les centres de vote liés à cette élection
  const fetchCenters = useCallback(async () => {
      try {
        setLoading(true);
        
        // Récupérer les centres liés à cette élection via la table de jonction
        const { data, error } = await supabase
          .from('election_centers')
          .select(`
            voting_centers(
              id, name, address, contact_name, contact_phone, enterprise_id,
              total_voters, total_bureaux,
              voting_bureaux!center_id(id, name, registered_voters)
            )
          `)
          .eq('election_id', election.id);

        if (error) {
          console.error('Erreur lors du chargement des centres:', error);
          setCenters([]);
          setLoading(false);
          return;
        }

        // Transformer les données Supabase en format Center
        const transformedCenters: Center[] = data?.map((link: any) => {
          const center = link.voting_centers as any;
          if (!center) return null;

          const bureaux = Array.isArray(center.voting_bureaux) ? center.voting_bureaux : [];
          
          // Calculer les électeurs réels à partir des bureaux, ou fallback sur la colonne total_voters
          const votersFromBureaux = bureaux.reduce((sum: number, bureau: any) => 
            sum + (bureau.registered_voters || 0), 0);
          const finalVoters = votersFromBureaux > 0 ? votersFromBureaux : (Number(center.total_voters) || 0);

          // Nombre de bureaux
          const finalBureaux = bureaux.length > 0 ? bureaux.length : (Number(center.total_bureaux) || 0);
          
          return {
            id: center.id.toString(),
            name: center.name,
            address: center.address || '',
            responsable: center.contact_name || '',
            contact: center.contact_phone || '',
            bureaux: finalBureaux,
            voters: finalVoters
          };
        }).filter(Boolean) || [];

        setCenters(transformedCenters);
      } catch (error) {
        console.error('Erreur lors du chargement des centres:', error);
      } finally {
        setLoading(false);
      }
    }, [election.id]);

  // Charger les centres de vote liés à cette élection
  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  // Fonction pour charger les candidats liés à cette élection
  const fetchCandidates = useCallback(async () => {
      try {
        if (election.type === 'Élection Professionnelle') {
          const { data, error } = await supabase
            .from('union_lists')
            .select(`
              id,
              college,
              titulaires,
              suppleants,
              unions(id, name, acronym)
            `)
            .eq('election_id', election.id);

          if (error) throw error;

          const transformed: Candidate[] = data?.map((list: any) => ({
            id: list.id,
            name: list.unions?.name || 'Syndicat inconnu',
            party: list.unions?.acronym || 'Indépendant',
            isOurCandidate: false, 
            college: list.college,
            titulaires: list.titulaires || [],
            suppleants: list.suppleants || []
          })) || [];

          setCandidates(transformed);
          return;
        }

        const { data, error } = await supabase
          .from('election_candidates')
          .select(`
            candidates(id, name, party, photo_url, is_our_candidate),
            is_our_candidate
          `)
          .eq('election_id', election.id);

        if (error) {
          console.error('Erreur lors du chargement des candidats:', error);
          setCandidates([]);
          return;
        }

        // Transformer les données Supabase en format Candidate
        const transformedCandidates: Candidate[] = data?.map((link: any) => ({
          id: String(link.candidates.id),
          name: link.candidates.name || '',
          party: link.candidates.party || '',
          isOurCandidate: link.is_our_candidate || false,
          photo: link.candidates.photo_url || '/placeholder.svg',
        })) || [];

        setCandidates(transformedCandidates);
      } catch (error) {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    }, [election.id, election.type]);

  // Charger les candidats liés à cette élection
  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Charger les informations de l'entreprise si c'est une élection pro ou liée à une entreprise
  useEffect(() => {
    const fetchEnterprise = async () => {
      const entId = election.enterpriseId || (election as any).enterprise_id;
      if (entId) {
        setLoadingEnterprise(true);
        try {
          const { data, error } = await supabase
            .from('enterprises')
            .select('*')
            .eq('id', entId)
            .single();
            
          if (error) throw error;
          setEnterprise(data);
        } catch (error) {
          console.error('Erreur lors du chargement de l\'entreprise:', error);
        } finally {
          setLoadingEnterprise(false);
        }
      } else {
        setEnterprise(null);
        setLoadingEnterprise(false);
      }
    };
    fetchEnterprise();
  }, [election.enterpriseId, (election as any).enterprise_id]);


  // Mettre à jour les statistiques quand les données changent
  useEffect(() => {
    const totalVoters = centers.reduce((sum, center) => sum + center.voters, 0);
    const totalBureaux = centers.reduce((sum, center) => sum + center.bureaux, 0);
    
    setStatistics({
      totalVoters: totalVoters || election.voters,
      totalCenters: centers.length || election.centers,
      totalBureaux: totalBureaux || election.bureaux,
      totalCandidates: candidates.length || election.candidates
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
      await fetchCenters();
      
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
      await fetchCandidates();
      
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
            await fetchCenters();
            
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
    toast.warning('Supprimer ce candidat de cette élection ?', {
      action: {
        label: 'Supprimer',
        onClick: async () => {
          try {
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

            // Recharger les candidats depuis la base de données
            await fetchCandidates();
            
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
    setCenters(centers.map(c => c.id === updatedCenter.id ? updatedCenter : c));
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
    setCandidates(candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c));
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

  const handleUpdateBureau = (updatedBureau: any) => {
    // Mettre à jour le bureau dans la liste des centres
    setCenters(centers.map(center => {
      if (center.id === selectedCenter?.id) {
        // Ici, vous devriez mettre à jour les bureaux du centre
        // Pour simplifier, on recharge les centres
        fetchCenters();
      }
      return center;
    }));
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
        fetchCenters(); // Recharger les centres pour mettre à jour les bureaux
        
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
                    fetchCandidates();
                    fetchCenters();
                    toast.success('Données actualisées');
                  }}
                  className="hover:bg-white/50 transition-all duration-300 rounded-lg px-2"
                >
                  <RefreshCcw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
                  <span className="text-xs sm:text-sm">Actualiser</span>
                </Button>
              </div>
              
              <Badge 
                variant={getStatusVariant(election.status)}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
              >
                {election.status}
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
                  <div className="font-medium text-xs sm:text-sm">Centres & Bureaux</div>
                  <div className="text-xs text-gray-500">Organisation territoriale</div>
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
                          variant={getStatusVariant(election.status)}
                          className="px-2 py-1 text-xs font-medium"
                        >
                          {election.status}
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

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                    <p className="text-sm text-gray-700 leading-relaxed">{election.description || 'Aucune description'}</p>
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
                          <span className="text-[9px] text-purple-600 font-bold mb-1 bg-purple-100 px-1.5 py-0.5 rounded-full">+7 jours</span>
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
                    <p className="text-xl font-bold text-gov-blue">{election.seatsAvailable}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Informations géographiques ou Entreprise */}
              <Card className="election-card group hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {isProfessional ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Raison Sociale</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.name || 'Non renseignée')}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Secteur</label>
                            <p className="text-sm font-bold text-gray-900 mt-1 capitalize">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.sector || '-')}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Effectif Total</label>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {loadingEnterprise ? 'Chargement...' : (enterprise?.total_employees || '-')}
                            </p>
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unité Administrative</label>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {loadingEnterprise ? 'Chargement...' : (enterprise?.administrative_unit || '-')}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Localisation Siège</label>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {loadingEnterprise 
                              ? 'Chargement...' 
                              : (enterprise?.province_name ? `${enterprise.province_name}, ${enterprise.commune_name}` : 'Non renseignée')}
                          </p>
                        </div>
                        {!loadingEnterprise && enterprise?.hr_contact && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <label className="text-xs font-medium text-blue-600 uppercase tracking-wide">Contact RH</label>
                            <p className="text-sm font-bold text-blue-900 mt-1">{enterprise.hr_contact.name}</p>
                            <p className="text-xs text-blue-700">{enterprise.hr_contact.phone} | {enterprise.hr_contact.email}</p>
                          </div>
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
                <Button
                  onClick={() => setShowAddCenter(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 w-full sm:w-auto text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Ajouter un centre</span>
                  <span className="xs:hidden">Ajouter</span>
                </Button>
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
                        <div className="text-sm sm:text-lg font-bold text-orange-600">{center.bureaux}</div>
                        <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">Bureaux</div>
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
                                <span className="text-sm font-medium text-gray-700">{center.bureaux} bureaux</span>
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
                {/* Boutons de vue */}
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
                )}
              </div>
            </div>

            {candidatesViewMode === 'grid' ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {candidates.map((candidate) => (
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
                        {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0] ? (
                          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-purple-50 group-hover:scale-105 transition-transform duration-500">
                            {candidate.titulaires[0].photo ? (
                              <img src={candidate.titulaires[0].photo} alt="Head" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-purple-600 bg-purple-100 uppercase">
                                {candidate.titulaires[0].name?.charAt(0) || 'T'}
                              </div>
                            )}
                          </div>
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
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold px-2 py-0.5 mt-1 mx-auto block w-fit">
                            {candidate.college === 'general' ? 'Collège Général' : 
                             candidate.college === 'cadres' ? 'Collège Cadres' :
                             candidate.college === 'employes' ? 'Collège Employés' :
                             candidate.college === 'ouvriers' ? 'Collège Ouvriers' : candidate.college}
                          </Badge>
                        )}
                      </div>

                      {election.type === 'Élection Professionnelle' && candidate.suppleants?.[0] && (
                        <div className="w-full mt-2 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 border-2 border-white shadow-sm">
                            {candidate.suppleants[0].photo ? (
                              <img src={candidate.suppleants[0].photo} alt="Deputy" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-blue-600">S</div>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-[9px] font-black text-gray-400 uppercase leading-none">Suppléant</p>
                            <p className="text-[10px] font-bold text-gray-700 truncate max-w-[100px]">{candidate.suppleants[0].name}</p>
                          </div>
                        </div>
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
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate) => (
                  <Card 
                    key={candidate.id} 
                    className={`election-card group hover:shadow-lg transition-all duration-300 ${
                      candidate.isOurCandidate 
                        ? 'border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100' 
                        : 'border-0 shadow-sm'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="relative flex-shrink-0">
                            {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0] ? (
                              <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm border-2 border-white bg-purple-50">
                                {candidate.titulaires[0].photo ? (
                                  <img src={candidate.titulaires[0].photo} alt="Head" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-purple-600 bg-purple-100 uppercase">
                                    {candidate.titulaires[0].name?.charAt(0) || 'T'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <InitialsAvatar 
                                name={candidate.name}
                                size="lg"
                                className="shadow-lg border-2 border-white"
                                backgroundColor="#1e40af"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-purple-600 transition-colors duration-300 line-clamp-1">
                              {election.type === 'Élection Professionnelle' && candidate.titulaires?.[0] 
                                ? candidate.titulaires[0].name 
                                : candidate.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm text-gray-600 line-clamp-1">
                                {election.type === 'Élection Professionnelle' 
                                  ? `${candidate.name} (${candidate.party})` 
                                  : candidate.party}
                              </p>
                              {election.type === 'Élection Professionnelle' && candidate.college && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold px-2 py-0.5">
                                  {candidate.college === 'general' ? 'Collège Général' : 
                                   candidate.college === 'cadres' ? 'Collège Cadres' :
                                   candidate.college === 'employes' ? 'Collège Employés' :
                                   candidate.college === 'ouvriers' ? 'Collège Ouvriers' : candidate.college}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {canManage && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCandidate(candidate)}
                            className="text-blue-600 hover:bg-blue-50 transition-all duration-300"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Gérer
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCandidate(candidate.id)}
                            className="text-red-500 hover:bg-red-50 transition-all duration-300"
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
          />
        )}

        {/* Modales d'édition */}
        {showEditCenter && selectedCenter && (
          <EditCenterModal
            center={selectedCenter}
            onClose={() => {
              setShowEditCenter(false);
              setSelectedCenter(null);
            }}
            onUpdate={handleUpdateCenter}
          />
        )}

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
