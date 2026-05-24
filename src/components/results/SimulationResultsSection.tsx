import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Info, Users, TrendingUp, Filter, AlertTriangle, Calculator, ChevronDown, Check, Building2, MapPin, Vote, BarChart3, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { resolveCandidatesForElection } from '@/lib/candidateUtils';
import {
  getElectionElectorsTotal,
  getRegisteredVotersLabel,
  isProfessionalElection,
} from '@/utils/electionCalculations';

interface SimulationResultsSectionProps {
  electionId: string;
}

interface CandidateResult {
  id: string;
  name: string;
  party?: string;
  votes: number;
  percentage: number;
  color: string;
}

interface BureauData {
  candidate_votes: any;
  id: string;
  name: string;
  center_name: string;
  registered_voters: number;
  total_voters: number;
  total_expressed?: number;
  is_validated: boolean;
}

interface SimulationParams {
  globalAbstention: number;
  suffrageExprime: number;
  candidateDistribution: Record<string, number>;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SimulationResultsSection: React.FC<SimulationResultsSectionProps> = ({ electionId }) => {
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [validatedBureaux, setValidatedBureaux] = useState<BureauData[]>([]);
  const [pendingBureaux, setPendingBureaux] = useState<BureauData[]>([]);
  const [simulationParams, setSimulationParams] = useState<SimulationParams>({
    globalAbstention: 35,
    suffrageExprime: 85,
    candidateDistribution: {}
  });
  const [loading, setLoading] = useState(false);
  const [electionData, setElectionData] = useState<any>(null);
  const [totalElectorsElection, setTotalElectorsElection] = useState(0);
  const [realAbstentionRate, setRealAbstentionRate] = useState<number | null>(null);
  const [realSuffrageExprime, setRealSuffrageExprime] = useState<number | null>(null);
  
  // États pour simulation par candidat
  const [selectedCandidateForScore, setSelectedCandidateForScore] = useState<string>('');
  const [targetCandidateScore, setTargetCandidateScore] = useState<number>(50);
  
  // États pour simulation par bureau
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [selectedBureau, setSelectedBureau] = useState<string>('');
  const [simulatedBureaux, setSimulatedBureaux] = useState<Map<string, SimulationParams>>(new Map());
  const [bureauSimulationParams, setBureauSimulationParams] = useState<SimulationParams>({
    globalAbstention: 35,
    suffrageExprime: 85,
    candidateDistribution: {}
  });

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      if (!electionId) return;

      try {
        setLoading(true);

        // 1. Récupérer les données de l'élection pour vérifier la date de création
        const { data: electionInfo, error: electionError } = await supabase
          .from('elections')
          .select('created_at, title, status, nb_electeurs, type')
          .eq('id', electionId)
          .single();

        if (electionError) throw electionError;

        setElectionData(electionInfo);
        const electorsTotal = await getElectionElectorsTotal(electionId, electionInfo?.type);
        setTotalElectorsElection(electorsTotal);

        // Vérifier si la date de création est postérieure au 01/10/2025
        const creationDate = new Date(electionInfo.created_at);
        const cutoffDate = new Date('2025-10-01');

        // Si la date de création est antérieure au 01/10/2025, ne pas charger les données de simulation
        if (creationDate < cutoffDate) {
          console.log('Simulation désactivée : élection créée avant le 01/10/2025');
          setLoading(false);
          return;
        }

        // 2. Charger les candidats de l'élection
        const resolvedCandidates = await resolveCandidatesForElection(electionId, electionInfo?.type);

        const candidatesList = resolvedCandidates.map((candidate: any, index: number) => ({
          id: String(candidate.id),
          name: candidate.name,
          party: candidate.party,
          votes: 0,
          percentage: 0,
          color: COLORS[index % COLORS.length]
        }));

        setCandidates(candidatesList);

        // 2. Charger les PV validés ET publiés directement
        const { data: pvsValidatedAndPublished, error: pvsError } = await supabase
          .from('procès_verbaux')
          .select(`
            id,
            bureau_id,
            total_registered,
            total_voters,
            votes_expressed,
            null_votes,
            status,
            voting_bureaux!inner(id, name, center_id, registered_voters)
          `)
          .eq('election_id', electionId)
          .in('status', ['validated', 'published']);

        if (pvsError) throw pvsError;

        console.log('📊 [Simulation] PV validés + publiés récupérés:', pvsValidatedAndPublished?.length);

        // Récupérer les noms des centres
        const centerIds = [...new Set((pvsValidatedAndPublished || []).map((pv: any) => pv.voting_bureaux?.center_id).filter(Boolean))];
        const { data: centersData } = await supabase
          .from('voting_centers')
          .select('id, name')
          .in('id', centerIds);
        
        const centerNamesMap = new Map((centersData || []).map((c: any) => [c.id, c.name]));

        // Transformer en format compatible
        const validatedBureauxArray = (pvsValidatedAndPublished || []).map((pv: any) => ({
          id: pv.bureau_id,
          name: pv.voting_bureaux?.name || 'Bureau',
          center_name: centerNamesMap.get(pv.voting_bureaux?.center_id) || 'Centre',
          registered_voters: Number(pv.total_registered) || Number(pv.voting_bureaux?.registered_voters) || 0,
          total_voters: Number(pv.total_voters) || 0,
          total_expressed: Number(pv.votes_expressed) || 0,
          is_validated: true,
          candidate_votes: {} // On va remplir après
        }));

        // 2.5. Charger les résultats par candidat pour ces PV
        const pvIds = (pvsValidatedAndPublished || []).map(pv => pv.id);
        const { data: candidateResults, error: candidateResultsError } = await supabase
          .from('candidate_results')
          .select('pv_id, candidate_id, votes')
          .in('pv_id', pvIds);

        console.log('📊 [Simulation] Résultats candidats récupérés:', candidateResults?.length);
        console.log('📊 [Simulation] PV IDs:', pvIds);

        if (!candidateResultsError && candidateResults) {
          // Créer un mapping pv_id -> bureau_id
          const pvToBureauMap = new Map((pvsValidatedAndPublished || []).map((pv: any) => [pv.id, pv.bureau_id]));
          
          // Ajouter les votes par candidat aux bureaux
          validatedBureauxArray.forEach(bureau => {
            bureau.candidate_votes = {};
            candidateResults
              .filter((cr: any) => pvToBureauMap.get(cr.pv_id) === bureau.id)
              .forEach((cr: any) => {
                bureau.candidate_votes[cr.candidate_id] = Number(cr.votes) || 0;
              });
          });
        }

        setValidatedBureaux(validatedBureauxArray);
        
        console.log('📊 [Simulation] Bureaux validés transformés:', validatedBureauxArray.length);

        // 3. Charger les bureaux non validés
        const { data: allBureaux, error: allBureauxError } = await supabase
          .from('voting_bureaux')
          .select(`
            id,
            name,
            registered_voters,
            center_id,
            voting_centers!inner(name)
          `)
          .in('center_id', await getElectionCenters(electionId));

        if (allBureauxError) throw allBureauxError;

        const validatedBureauIds = new Set(validatedBureauxArray.map(b => b.id));
        const pendingBureauxList = (allBureaux || [])
          .filter((bureau: any) => !validatedBureauIds.has(bureau.id))
          .map((bureau: any) => ({
            id: bureau.id,
            name: bureau.name,
            center_name: bureau.voting_centers?.name || 'Centre',
            registered_voters: bureau.registered_voters || 0,
            total_voters: 0,
            is_validated: false
          }));

        console.log('Total bureaux for election:', allBureaux?.length);
        console.log('Validated bureaux count:', validatedBureauxArray.length);
        console.log('Pending bureaux count:', pendingBureauxList.length);

        setPendingBureaux(pendingBureauxList);

        // 3.5. Calculer le taux d'abstention réel depuis les bureaux validés UNIQUEMENT
        try {
          console.log('📊 ========================================');
          console.log('📊 CALCUL ABSTENTION - BUREAUX VALIDÉS UNIQUEMENT');
          console.log('📊 ========================================');
          console.log('📊 Nombre de bureaux validés:', validatedBureauxArray.length);
          
          // Afficher les détails de chaque bureau
          validatedBureauxArray.forEach((b, idx) => {
            console.log(`📊 Bureau ${idx + 1}:`, {
              id: b.id,
              name: b.name,
              registered_voters: b.registered_voters,
              total_voters: b.total_voters
            });
          });

          if (validatedBureauxArray.length > 0) {
            // Calculer le total des inscrits, votants et exprimés UNIQUEMENT depuis les bureaux validés
            const totalInscritsValidated = validatedBureauxArray.reduce((sum, b) => sum + (b.registered_voters || 0), 0);
            const totalVotersValidated = validatedBureauxArray.reduce((sum, b) => sum + (b.total_voters || 0), 0);
            const totalExpressedValidated = validatedBureauxArray.reduce((sum, b) => sum + (b.total_expressed || 0), 0);
            
            console.log('📊 ========================================');
            console.log('📊 TOTAUX (BUREAUX VALIDÉS UNIQUEMENT):');
            console.log('📊   Total inscrits:', totalInscritsValidated);
            console.log('📊   Total votants:', totalVotersValidated);
            console.log('📊   Total exprimés:', totalExpressedValidated);
            console.log('📊 ========================================');
            
            // Calculer les taux basés UNIQUEMENT sur les bureaux validés
            if (totalInscritsValidated > 0 && totalVotersValidated > 0) {
              const tauxParticipation = Number(((totalVotersValidated / totalInscritsValidated) * 100).toFixed(2));
              const tauxAbstention = Number((100 - tauxParticipation).toFixed(2));
              const tauxSuffrageExprime = Number(((totalExpressedValidated / totalVotersValidated) * 100).toFixed(2));
              
              console.log('✅ RÉSULTAT:');
              console.log('✅   Taux participation:', tauxParticipation + '%');
              console.log('✅   Taux abstention:', tauxAbstention + '%');
              console.log('✅   Taux suffrage exprimé:', tauxSuffrageExprime + '%');
              console.log('✅   Formule abstention: (' + totalVotersValidated + ' / ' + totalInscritsValidated + ') × 100');
              console.log('✅   Formule suffrage: (' + totalExpressedValidated + ' / ' + totalVotersValidated + ') × 100');
              console.log('📊 ========================================');
              
              setRealAbstentionRate(tauxAbstention);
              setRealSuffrageExprime(tauxSuffrageExprime);
              
              // Mettre à jour les paramètres de simulation
              setSimulationParams(prev => ({
                ...prev,
                globalAbstention: tauxAbstention,
                suffrageExprime: tauxSuffrageExprime
              }));
            } else {
              console.warn('⚠️ Total inscrits ou votants des bureaux validés est 0');
            }
          } else {
            console.warn('⚠️ Pas de bureaux validés pour calculer l\'abstention');
          }
        } catch (error) {
          console.error('❌ Erreur calcul abstention:', error);
        }

        // 4. Initialiser la distribution des candidats avec les pourcentages réels des bureaux validés
        const totalVotesByCandidate: Record<string, number> = {};
        let grandTotalVotes = 0;
        
        validatedBureauxArray.forEach(bureau => {
          candidatesList.forEach(candidate => {
            const votes = bureau.candidate_votes?.[candidate.id] || 0;
            totalVotesByCandidate[candidate.id] = (totalVotesByCandidate[candidate.id] || 0) + votes;
            grandTotalVotes += votes;
          });
        });
        
        const initialDistribution: Record<string, number> = {};
        if (grandTotalVotes > 0) {
          // Utiliser les pourcentages réels
          candidatesList.forEach(candidate => {
            initialDistribution[candidate.id] = Number(((totalVotesByCandidate[candidate.id] || 0) / grandTotalVotes * 100).toFixed(2));
          });
          console.log(' Distribution initiale (depuis bureaux validés):', initialDistribution);
        } else {
          // Fallback: distribution équitable
        candidatesList.forEach(candidate => {
          initialDistribution[candidate.id] = 100 / candidatesList.length;
        });
          console.log(' Distribution initiale (équitable):', initialDistribution);
        }

        setSimulationParams(prev => ({
          ...prev,
          candidateDistribution: initialDistribution
        }));

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [electionId]);

  // Fonction pour récupérer les centres de l'élection
  const getElectionCenters = async (electionId: string) => {
    const { data, error } = await supabase
      .from('election_centers')
      .select('center_id')
      .eq('election_id', electionId);
    
    if (error) throw error;
    return (data || []).map(row => row.center_id);
  };

  // Liste TOUS les centres (validés + non validés)
  const availableCenters = useMemo(() => {
    const centersMap = new Map<string, string>();
    
    // Ajouter les centres des bureaux validés
    validatedBureaux.forEach(bureau => {
      centersMap.set(bureau.center_name, bureau.center_name);
    });
    
    // Ajouter les centres des bureaux non validés
    pendingBureaux.forEach(bureau => {
      centersMap.set(bureau.center_name, bureau.center_name);
    });
    
    return Array.from(centersMap.values()).sort();
  }, [pendingBureaux, validatedBureaux]);

  // Liste TOUS les bureaux du centre sélectionné (validés + non validés)
  const bureausByCenter = useMemo(() => {
    if (!selectedCenter) return [];
    
    // Combiner bureaux validés et non validés du même centre
    const validesduCentre = validatedBureaux.filter(b => b.center_name === selectedCenter);
    const nonValidesduCentre = pendingBureaux.filter(b => b.center_name === selectedCenter);
    
    return [...validesduCentre, ...nonValidesduCentre]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingBureaux, validatedBureaux, selectedCenter]);

  // Bureau sélectionné en détail
  const selectedBureauData = useMemo(() => {
    // Chercher d'abord dans les bureaux non validés
    const pendingBureau = pendingBureaux.find(b => b.id === selectedBureau);
    if (pendingBureau) return pendingBureau;
    
    // Sinon dans les bureaux validés (mais ils ne pourront pas être simulés)
    return validatedBureaux.find(b => b.id === selectedBureau);
  }, [pendingBureaux, validatedBureaux, selectedBureau]);

  // Vérifier si un bureau est validé (publié)
  const isBureauValidated = (bureauId: string) => {
    return validatedBureaux.some(b => b.id === bureauId);
  };

  // Calculer les résultats simulés GLOBAUX (toujours tous les bureaux)
  const calculateSimulatedResults = useMemo(() => {
    if (candidates.length === 0) return [];

    // 1. Calculer les résultats validés (bureaux dépouillés)
    const validatedVotes: Record<string, number> = {};
    let totalValidatedVoters = 0;
    let totalValidatedExpressed = 0;

    validatedBureaux.forEach(bureau => {
      totalValidatedVoters += bureau.total_voters;
      totalValidatedExpressed += bureau.total_expressed || 0;
      candidates.forEach(candidate => {
        const votes = bureau.candidate_votes?.[candidate.id] || 0;
        validatedVotes[candidate.id] = (validatedVotes[candidate.id] || 0) + votes;
      });
    });

    console.log('📊 [Calcul Simulation] Votes des bureaux dépouillés:', validatedVotes);
    console.log('📊 [Calcul Simulation] Total exprimés dépouillés:', totalValidatedExpressed);

    // 2. Initialiser les votes simulés avec les votes validés
    const simulatedVotes: Record<string, number> = { ...validatedVotes };

    // Sauvegarder les paramètres du bureau actuel dans la Map
    let currentSimulatedBureaux = new Map(simulatedBureaux);
    if (selectedBureau && selectedBureauData) {
      currentSimulatedBureaux.set(selectedBureau, { ...bureauSimulationParams });
    }

    // A) Identifier les bureaux avec simulations spécifiques
    const bureauxAvecSimulationSpecifique = new Set(currentSimulatedBureaux.keys());
    const pendingWithoutSimulation = pendingBureaux.filter(b => !bureauxAvecSimulationSpecifique.has(b.id));
    
    // B) Calculer les électeurs simulés globaux
    const participationRateGlobal = 100 - simulationParams.globalAbstention;
    let totalSimulatedGlobal = 0;
    
    const knownPendingInscrits = pendingWithoutSimulation.reduce((sum, b) => sum + (b.registered_voters || 0), 0);
    
    if (knownPendingInscrits > 0) {
      // Au moins un bureau a ses inscrits renseignés, on utilise les valeurs réelles
      pendingWithoutSimulation.forEach(bureau => {
        totalSimulatedGlobal += Math.round(
          ((bureau.registered_voters || 0) * participationRateGlobal / 100) * 
          (simulationParams.suffrageExprime / 100)
        );
      });
    } else {
      // Tous les bureaux ont 0 inscrits, on essaie d'utiliser nb_electeurs global
      const validatedInscrits = validatedBureaux.reduce((sum, b) => sum + (b.registered_voters || 0), 0);
      const simulatedBureauxInscrits = Array.from(currentSimulatedBureaux.keys()).reduce((sum, bureauId) => {
        const b = pendingBureaux.find(p => p.id === bureauId);
        return sum + (b?.registered_voters || 0);
      }, 0);
      
      const totalKnown = validatedInscrits + simulatedBureauxInscrits;
      const remainingInscritsToSimulate = totalElectorsElection > 0
        ? Math.max(0, totalElectorsElection - totalKnown)
        : (electionData?.nb_electeurs ? Math.max(0, electionData.nb_electeurs - totalKnown) : 0);
      
      totalSimulatedGlobal = Math.round(
        (remainingInscritsToSimulate * participationRateGlobal / 100) * 
        (simulationParams.suffrageExprime / 100)
      );
    }
    // Répartir les votes des bureaux non sélectionnés
    if (totalSimulatedGlobal > 0) {
      // Si un candidat est sélectionné pour un score cible, calculer sa distribution
      if (selectedCandidateForScore && targetCandidateScore > 0) {
        // Calculer le total final attendu (bureaux dépouillés + bureaux avec paramètres globaux)
        // Note: On n'inclut pas les bureaux spécifiques car ils ont leurs propres paramètres
        const totalExpectedVotes = totalValidatedExpressed + totalSimulatedGlobal;
        
        // Calculer combien de votes le candidat doit avoir AU TOTAL (sur dépouillés + globaux) pour atteindre le score cible
        const targetTotalVotes = Math.round((totalExpectedVotes * targetCandidateScore) / 100);
        
        // Soustraire les votes déjà obtenus par le candidat dans les bureaux dépouillés
        const votesAlreadyObtained = validatedVotes[selectedCandidateForScore] || 0;
        const votesToSimulate = Math.max(0, targetTotalVotes - votesAlreadyObtained);
        
        // Vérifier que les votes à simuler ne dépassent pas le total disponible
        const actualSimulatedVotes = Math.min(votesToSimulate, totalSimulatedGlobal);
        const remainingVotes = totalSimulatedGlobal - actualSimulatedVotes;
        const otherCandidates = candidates.filter(c => c.id !== selectedCandidateForScore);
        
        console.log('📊 [Score Cible] Total attendu (dépouillés + globaux):', totalExpectedVotes);
        console.log('📊 [Score Cible] Votes cible total (pour atteindre ' + targetCandidateScore + '%):', targetTotalVotes);
        console.log('📊 [Score Cible] Votes déjà obtenus (bureaux dépouillés):', votesAlreadyObtained);
        console.log('📊 [Score Cible] Votes à simuler (bureaux non dépouillés):', actualSimulatedVotes);
        console.log('📊 [Score Cible] Votes restants (pour autres candidats):', remainingVotes);
        
        // Donner le score cible au candidat sélectionné
        simulatedVotes[selectedCandidateForScore] = (simulatedVotes[selectedCandidateForScore] || 0) + actualSimulatedVotes;
        
        // Distribuer le reste équitablement aux autres candidats
        if (otherCandidates.length > 0) {
          const exactVotesGlobal: { candidateId: string; exact: number; floor: number; remainder: number }[] = [];
          let totalFloorGlobal = 0;

          otherCandidates.forEach(candidate => {
            const exact = remainingVotes / otherCandidates.length;
            const floor = Math.floor(exact);
            const remainder = exact - floor;
            
            exactVotesGlobal.push({
              candidateId: candidate.id,
              exact,
              floor,
              remainder
            });
            
            totalFloorGlobal += floor;
          });
          
          const remainingGlobalVotes = remainingVotes - totalFloorGlobal;
          const sortedGlobal = [...exactVotesGlobal].sort((a, b) => b.remainder - a.remainder);
          
          otherCandidates.forEach(candidate => {
            const voteData = exactVotesGlobal.find(v => v.candidateId === candidate.id);
            if (!voteData) return;
            
            let allocatedVotes = voteData.floor;
            const index = sortedGlobal.findIndex(v => v.candidateId === candidate.id);
            if (index < remainingGlobalVotes) {
              allocatedVotes += 1;
            }
            
            simulatedVotes[candidate.id] = (simulatedVotes[candidate.id] || 0) + allocatedVotes;
          });
        }
      } else {
        // Distribution normale selon candidateDistribution
        const exactVotesGlobal: { candidateId: string; exact: number; floor: number; remainder: number }[] = [];
        let totalFloorGlobal = 0;

        candidates.forEach(candidate => {
          const candidatePercentage = simulationParams.candidateDistribution[candidate.id] || 0;
          const exact = (totalSimulatedGlobal * candidatePercentage) / 100;
          const floor = Math.floor(exact);
          const remainder = exact - floor;
          
          exactVotesGlobal.push({
            candidateId: candidate.id,
            exact,
            floor,
            remainder
          });
          
          totalFloorGlobal += floor;
        });
        
        const remainingGlobal = totalSimulatedGlobal - totalFloorGlobal;
        const sortedGlobal = [...exactVotesGlobal].sort((a, b) => b.remainder - a.remainder);
        
        candidates.forEach(candidate => {
          const voteData = exactVotesGlobal.find(v => v.candidateId === candidate.id);
          if (!voteData) return;
          
          let allocatedVotes = voteData.floor;
          const index = sortedGlobal.findIndex(v => v.candidateId === candidate.id);
          if (index < remainingGlobal) {
            allocatedVotes += 1;
          }
          
          simulatedVotes[candidate.id] = (simulatedVotes[candidate.id] || 0) + allocatedVotes;
        });
      }
    }

    // C) Simuler tous les bureaux avec simulations spécifiques
    let totalSimulatedSpecifiques = 0;
    currentSimulatedBureaux.forEach((params, bureauId) => {
      const bureauData = pendingBureaux.find(b => b.id === bureauId);
      if (!bureauData) return;
      
      const participationRateBureau = 100 - params.globalAbstention;
      const totalSimulatedBureau = Math.round(
        (bureauData.registered_voters * participationRateBureau / 100) * 
        (params.suffrageExprime / 100)
      );
      totalSimulatedSpecifiques += totalSimulatedBureau;

      // Répartir les votes du bureau spécifique
      const exactVotesBureau: { candidateId: string; exact: number; floor: number; remainder: number }[] = [];
      let totalFloorBureau = 0;
      
      candidates.forEach(candidate => {
        const candidatePercentage = params.candidateDistribution[candidate.id] || 0;
        const exact = (totalSimulatedBureau * candidatePercentage) / 100;
        const floor = Math.floor(exact);
        const remainder = exact - floor;
        
        exactVotesBureau.push({
          candidateId: candidate.id,
          exact,
          floor,
          remainder
        });
        
        totalFloorBureau += floor;
      });
      
      const remainingBureau = totalSimulatedBureau - totalFloorBureau;
      const sortedBureau = [...exactVotesBureau].sort((a, b) => b.remainder - a.remainder);
      
      candidates.forEach(candidate => {
        const voteData = exactVotesBureau.find(v => v.candidateId === candidate.id);
        if (!voteData) return;
        
        let allocatedVotes = voteData.floor;
        const index = sortedBureau.findIndex(v => v.candidateId === candidate.id);
        if (index < remainingBureau) {
          allocatedVotes += 1;
        }
        
        // AJOUTER les votes du bureau spécifique
        simulatedVotes[candidate.id] = (simulatedVotes[candidate.id] || 0) + allocatedVotes;
      });
    });

    console.log('📊 Bureaux avec simulation spécifique:', currentSimulatedBureaux.size);
    console.log('📊 Total simulé global:', totalSimulatedGlobal);
    console.log('📊 Total simulé spécifiques:', totalSimulatedSpecifiques);
    
    console.log('📊 [Calcul Final] Votes après simulation:', simulatedVotes);

    // 3. Calculer les pourcentages finaux
    const totalVotes = Object.values(simulatedVotes).reduce((sum, votes) => sum + votes, 0);
    
    console.log('📊 [Calcul Final] Total votes (dépouillés + simulés):', totalVotes);
    console.log('📊 [Calcul Final] Candidat ciblé:', selectedCandidateForScore);
    console.log('📊 [Calcul Final] Score cible:', targetCandidateScore);
    
    const finalResults = candidates.map(candidate => ({
      ...candidate,
      votes: simulatedVotes[candidate.id] || 0,
      percentage: totalVotes > 0 ? (simulatedVotes[candidate.id] || 0) / totalVotes * 100 : 0
    })).sort((a, b) => b.votes - a.votes);
    
    console.log('📊 [Classement Final] Résultats à afficher:', finalResults.map(c => ({
      nom: c.name,
      votes: c.votes,
      pourcentage: c.percentage.toFixed(2) + '%'
    })));
    
    return finalResults;
  }, [candidates, validatedBureaux, pendingBureaux, simulationParams, selectedBureau, selectedBureauData, bureauSimulationParams, simulatedBureaux, selectedCandidateForScore, targetCandidateScore]);

  // Calculer les résultats simulés POUR LE BUREAU SPÉCIFIQUE
  const bureauSpecificResults = useMemo(() => {
    if (!selectedBureauData || candidates.length === 0) return [];

    const participationRate = 100 - bureauSimulationParams.globalAbstention;
    const simulatedVotersInBureau = Math.round(
      (selectedBureauData.registered_voters * participationRate / 100) * 
      (bureauSimulationParams.suffrageExprime / 100)
    );

    return candidates.map(candidate => {
      const candidatePercentage = bureauSimulationParams.candidateDistribution[candidate.id] || 0;
      const votes = Math.round((simulatedVotersInBureau * candidatePercentage) / 100);
      
      return {
        ...candidate,
        votes,
        percentage: candidatePercentage
      };
    }).sort((a, b) => b.votes - a.votes);
  }, [selectedBureauData, candidates, bureauSimulationParams]);

  // Données pour le graphique en camembert
  const chartData = useMemo(() => {
    return calculateSimulatedResults.map(candidate => ({
      name: candidate.name,
      value: candidate.votes,
      percentage: candidate.percentage,
      color: candidate.color
    }));
  }, [calculateSimulatedResults]);

  // Statistiques de simulation (TOUJOURS GLOBALES - structure fixe)
  const simulationStats = useMemo(() => {
    const totalValidatedVoters = validatedBureaux.reduce((sum, bureau) => sum + bureau.total_voters, 0);
    const totalValidatedInscrits = validatedBureaux.reduce((sum, bureau) => sum + (bureau.registered_voters || 0), 0);
    
    // Toujours afficher les statistiques globales
    const participationRate = 100 - simulationParams.globalAbstention;
    const totalPendingVoters = pendingBureaux.reduce((sum, bureau) => 
      sum + Math.round((bureau.registered_voters * participationRate / 100)), 0);
    
    const sumPendingBureaux = pendingBureaux.reduce((sum, bureau) => sum + (bureau.registered_voters || 0), 0);
    const totalPendingInscrits = sumPendingBureaux > 0
      ? sumPendingBureaux
      : (totalElectorsElection > 0
          ? Math.max(0, totalElectorsElection - totalValidatedInscrits)
          : (electionData?.nb_electeurs ? Math.max(0, electionData.nb_electeurs - totalValidatedInscrits) : 0));
    
    return {
      totalValidatedBureaux: validatedBureaux.length,
      totalPendingBureaux: pendingBureaux.length,
      totalValidatedVoters,
      totalValidatedInscrits,
      totalPendingVoters,
      totalPendingInscrits,
      globalAbstention: simulationParams.globalAbstention,
      suffrageExprime: simulationParams.suffrageExprime
    };
  }, [validatedBureaux, pendingBureaux, simulationParams, electionData, totalElectorsElection]);


  const handleAbstentionChange = (value: number[]) => {
    setSimulationParams(prev => ({
      ...prev,
      globalAbstention: value[0]
    }));
  };

  const handleSuffrageChange = (value: number[]) => {
    setSimulationParams(prev => ({
      ...prev,
      suffrageExprime: value[0]
    }));
  };

  const handleCandidateDistributionChange = (candidateId: string, percentage: number) => {
    setSimulationParams(prev => ({
      ...prev,
      candidateDistribution: {
        ...prev.candidateDistribution,
        [candidateId]: Math.max(0, Math.min(100, percentage))
      }
    }));
  };

  // Gestionnaires pour simulation par bureau
  const handleCenterSelect = (centerName: string) => {
    setSelectedCenter(centerName);
    setSelectedBureau(''); // Réinitialiser le bureau sélectionné
  };

  const handleBureauSelect = (bureauId: string) => {
    // Vérifier si le bureau est déjà validé
    if (isBureauValidated(bureauId)) {
      console.log('⚠️ Bureau déjà publié, sélection pour affichage uniquement');
      setSelectedBureau(bureauId);
      return;
    }
    
    // Sauvegarder les paramètres du bureau actuel s'il y en a un
    if (selectedBureau && bureauSimulationParams && !isBureauValidated(selectedBureau)) {
      setSimulatedBureaux(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedBureau, { ...bureauSimulationParams });
        return newMap;
      });
    }
    
    setSelectedBureau(bureauId);
    
    // Charger les paramètres existants de ce bureau, ou créer nouveaux
    if (simulatedBureaux.has(bureauId)) {
      // Bureau déjà simulé : charger ses paramètres
      const existingParams = simulatedBureaux.get(bureauId)!;
      setBureauSimulationParams({ ...existingParams });
      console.log('📊 Chargement paramètres existants pour bureau:', bureauId);
    } else {
      // Nouveau bureau : calculer la distribution moyenne depuis les bureaux validés
      const totalVotes: Record<string, number> = {};
      let grandTotal = 0;
      
      validatedBureaux.forEach(bureau => {
        candidates.forEach(candidate => {
          const votes = bureau.candidate_votes?.[candidate.id] || 0;
          totalVotes[candidate.id] = (totalVotes[candidate.id] || 0) + votes;
          grandTotal += votes;
        });
      });
      
      const avgDistribution: Record<string, number> = {};
      if (grandTotal > 0) {
        candidates.forEach(candidate => {
          avgDistribution[candidate.id] = Number(((totalVotes[candidate.id] || 0) / grandTotal * 100).toFixed(2));
        });
      } else {
    const equalDistribution = 100 / candidates.length;
        candidates.forEach(candidate => {
          avgDistribution[candidate.id] = equalDistribution;
        });
      }
      
      setBureauSimulationParams({
        globalAbstention: realAbstentionRate !== null ? realAbstentionRate : 35,
        suffrageExprime: realSuffrageExprime !== null ? realSuffrageExprime : 85,
        candidateDistribution: avgDistribution
      });
      
      console.log('📊 Nouveaux paramètres pour bureau:', bureauId);
    }
  };

  const handleBureauAbstentionChange = (value: number[]) => {
    setBureauSimulationParams(prev => ({
      ...prev,
      globalAbstention: value[0]
    }));
    // Sauvegarder immédiatement dans la Map
    if (selectedBureau) {
      setSimulatedBureaux(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedBureau, { 
          ...bureauSimulationParams, 
          globalAbstention: value[0] 
        });
        return newMap;
      });
    }
  };

  const handleBureauSuffrageChange = (value: number[]) => {
    setBureauSimulationParams(prev => ({
      ...prev,
      suffrageExprime: value[0]
    }));
    // Sauvegarder immédiatement dans la Map
    if (selectedBureau) {
      setSimulatedBureaux(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedBureau, { 
          ...bureauSimulationParams, 
          suffrageExprime: value[0] 
        });
        return newMap;
      });
    }
  };

  const handleBureauCandidateDistributionChange = (candidateId: string, percentage: number) => {
    const newDistribution = {
      ...bureauSimulationParams.candidateDistribution,
      [candidateId]: Math.max(0, Math.min(100, percentage))
    };
    
    setBureauSimulationParams(prev => ({
      ...prev,
      candidateDistribution: newDistribution
    }));
    
    // Sauvegarder immédiatement dans la Map
    if (selectedBureau) {
      setSimulatedBureaux(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedBureau, { 
          ...bureauSimulationParams, 
          candidateDistribution: newDistribution
        });
        return newMap;
      });
    }
  };

  const resetBureauSimulation = () => {
    // Calculer la distribution moyenne depuis les bureaux validés
    const totalVotes: Record<string, number> = {};
    let grandTotal = 0;
    
    validatedBureaux.forEach(bureau => {
      candidates.forEach(candidate => {
        const votes = bureau.candidate_votes?.[candidate.id] || 0;
        totalVotes[candidate.id] = (totalVotes[candidate.id] || 0) + votes;
        grandTotal += votes;
      });
    });
    
    const avgDistribution: Record<string, number> = {};
    if (grandTotal > 0) {
      candidates.forEach(candidate => {
        avgDistribution[candidate.id] = Number(((totalVotes[candidate.id] || 0) / grandTotal * 100).toFixed(2));
      });
    } else {
      const equalDistribution = 100 / candidates.length;
      candidates.forEach(candidate => {
        avgDistribution[candidate.id] = equalDistribution;
      });
    }

    setBureauSimulationParams({
      globalAbstention: realAbstentionRate !== null ? realAbstentionRate : 35,
      suffrageExprime: realSuffrageExprime !== null ? realSuffrageExprime : 85,
      candidateDistribution: avgDistribution
    });
  };

  const resetToDefaults = () => {
    // Calculer la distribution moyenne depuis les bureaux validés
    const totalVotes: Record<string, number> = {};
    let grandTotal = 0;
    
    validatedBureaux.forEach(bureau => {
      candidates.forEach(candidate => {
        const votes = bureau.candidate_votes?.[candidate.id] || 0;
        totalVotes[candidate.id] = (totalVotes[candidate.id] || 0) + votes;
        grandTotal += votes;
      });
    });
    
    const newDistribution: Record<string, number> = {};
    if (grandTotal > 0) {
      candidates.forEach(candidate => {
        newDistribution[candidate.id] = Number(((totalVotes[candidate.id] || 0) / grandTotal * 100).toFixed(2));
      });
    } else {
      const equalDistribution = 100 / candidates.length;
    candidates.forEach(candidate => {
      newDistribution[candidate.id] = equalDistribution;
    });
    }

    setSimulationParams({
      globalAbstention: realAbstentionRate !== null ? realAbstentionRate : 35,
      suffrageExprime: realSuffrageExprime !== null ? realSuffrageExprime : 85,
      candidateDistribution: newDistribution
    });
    
    // Réinitialiser TOUTES les simulations de bureaux
    setSimulatedBureaux(new Map());
    setSelectedBureau('');
    setSelectedCenter('');
    
    // Réinitialiser la simulation par candidat
    setSelectedCandidateForScore('');
    setTargetCandidateScore(50);
    
    console.log('🔄 Réinitialisation complète - Toutes les simulations supprimées');
  };

  if (loading) {
    return (
      <Card className="gov-card">
        <CardHeader>
          <CardTitle className="text-gov-gray">Simulation des résultats globaux</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Chargement des données...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si la simulation est désactivée à cause de la date de création
  if (electionData && new Date(electionData.created_at) < new Date('2025-10-01')) {
    return null;
  }

  return (
    <>
    <Card className="gov-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gov-gray flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulation des résultats globaux
          </CardTitle>
          <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={pendingBureaux.length === 0}>
            Réinitialiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section gauche - Graphiques et résultats */}
          <div className="space-y-6">
            {/* Statistiques rapides */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                 <div className="flex items-center gap-2 mb-2">
                   <BarChart3 className="h-4 w-4 text-blue-600" />
                   <span className="text-sm font-medium text-blue-800">Bureaux déjà dépouillés</span>
                 </div>
                 <div className="text-2xl font-bold text-blue-900">{simulationStats?.totalValidatedBureaux ?? 0}</div>
                 <div className="text-xs text-blue-600">
                   <div>{(simulationStats?.totalValidatedVoters ?? 0).toLocaleString()} votants • {(simulationStats?.totalValidatedInscrits ?? 0).toLocaleString()} {getRegisteredVotersLabel(electionData?.type).toLowerCase()}</div>
                 </div>
                </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Bureaux restants</span>
                </div>
                <div className="text-2xl font-bold text-orange-900">{pendingBureaux.length}</div>
                <div className="text-xs text-orange-600">
                  {(() => {
                    const sumPending = pendingBureaux.reduce((sum, b) => sum + (b.registered_voters || 0), 0);
                    if (sumPending > 0) return sumPending;
                    const valInscrits = validatedBureaux.reduce((sum, b) => sum + (b.registered_voters || 0), 0);
                    const base = totalElectorsElection > 0 ? totalElectorsElection : (electionData?.nb_electeurs || 0);
                    return base > 0 ? Math.max(0, base - valInscrits) : 0;
                  })().toLocaleString()} {getRegisteredVotersLabel(electionData?.type).toLowerCase()}
                </div>
              </div>
            </div>

            {/* Graphique en camembert */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Résultats simulés
              </h3>
               <div className="flex flex-col sm:flex-row gap-4" style={{ minHeight: '10rem' }}>
                <div className="w-full sm:w-2/5 h-40 sm:h-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={55}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, _name: string, props: any) => [
                          `${value.toLocaleString()} voix (${props.payload.percentage.toFixed(1)}%)`,
                          props.payload.name
                        ]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px',
                          maxWidth: '200px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Légende compacte scrollable */}
                <div className="w-full sm:w-3/5 overflow-y-auto max-h-40 pr-1">
                  <div className="space-y-1">
                    {chartData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-gray-700 truncate flex-1" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="text-xs font-bold text-gray-800 flex-shrink-0 ml-1">
                          {entry.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats détaillés */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Classement simulé</h3>
                <div className="flex gap-2">
                  {selectedCandidateForScore && (
                    <Badge className="text-xs bg-blue-600 text-white">
                      <Trophy className="h-3 w-3 inline mr-1" />
                      Score cible actif
                    </Badge>
                  )}
                  {simulatedBureaux.size > 0 && (
                    <Badge className="text-xs bg-purple-600 text-white">
                      {simulatedBureaux.size} bureau(x) personnalisé(s)
                    </Badge>
                  )}
                </div>
              </div>
              {calculateSimulatedResults.map((candidate, index) => (
                <div key={candidate.id} className={`flex items-center justify-between p-3 rounded-lg ${
                  candidate.id === selectedCandidateForScore ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Badge className="text-white" style={{ backgroundColor: candidate.color }}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{candidate.name}</span>
                        {candidate.id === selectedCandidateForScore && (
                          <span title="Score cible défini">
                            <Trophy className="h-4 w-4 text-blue-600" />
                          </span>
                        )}
                      </div>
                      {candidate.party && (
                        <div className="text-sm text-gray-600">{candidate.party}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{candidate.votes.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">{candidate.percentage.toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section droite - Contrôles de simulation */}
          <div className="space-y-6">
            {!selectedBureauData && (
            <div className={`bg-yellow-50 p-4 rounded-lg border border-yellow-200 ${pendingBureaux.length === 0 ? 'opacity-50' : ''}`}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Vote className="h-4 w-4" />
                Paramètres de simulation
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {pendingBureaux.length > 0 
                  ? 'Ajustez ces paramètres pour simuler différents scénarios sur tous les bureaux non encore validés.'
                  : 'Tous les bureaux ayant été dépouillés, la simulation est désactivée.'}
              </p>

              {/* Taux d'abstention */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Taux d'abstention</Label>
                  {realAbstentionRate !== null && (
                    <Badge className="text-xs bg-blue-600 text-white hover:bg-blue-700">
                      Taux réel: {realAbstentionRate.toFixed(2)}%
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>0%</span>
                    <span className="font-medium">{simulationParams.globalAbstention.toFixed(2)}%</span>
                    <span>100%</span>
                  </div>
                  <Slider
                    value={[simulationParams.globalAbstention]}
                    onValueChange={handleAbstentionChange}
                    max={100}
                    step={0.01}
                    className="w-full"
                    disabled={pendingBureaux.length === 0 || !!selectedBureauData}
                  />
                </div>
                 {realAbstentionRate !== null && (
                   <p className="text-xs text-blue-600 font-medium">
                      Calculé depuis les {validatedBureaux.length} bureau(x) validé(s)
                   </p>
                 )}
              </div>

              {/* Suffrage exprimé */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                <Label>Suffrage exprimé (des votants)</Label>
                  {realSuffrageExprime !== null && (
                    <Badge className="text-xs bg-green-600 text-white hover:bg-green-700">
                      Taux réel: {realSuffrageExprime.toFixed(2)}%
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>0%</span>
                    <span className="font-medium">{simulationParams.suffrageExprime.toFixed(2)}%</span>
                    <span>100%</span>
                  </div>
                  <Slider
                    value={[simulationParams.suffrageExprime]}
                    onValueChange={handleSuffrageChange}
                    max={100}
                    step={0.01}
                    className="w-full"
                    disabled={pendingBureaux.length === 0 || !!selectedBureauData}
                  />
                </div>
                {realSuffrageExprime !== null && (
                  <p className="text-xs text-green-600 font-medium">
                     Calculé depuis les {validatedBureaux.length} bureau(x) validé(s)
                  </p>
                )}
              </div>

              {/* Simulation par score de candidat */}
              <div className="space-y-3 pt-4 border-t border-yellow-300">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4" />
                  <Label className="text-base font-semibold">Score cible d'un candidat</Label>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Définissez un score cible pour un candidat. Cette simulation s'applique uniquement aux bureaux non dépouillés.
                </p>

                <div className="space-y-2">
                  <Label className="text-sm">Candidat à cibler</Label>
                  <Select value={selectedCandidateForScore || 'none'} onValueChange={(value) => setSelectedCandidateForScore(value === 'none' ? '' : value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un candidat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Aucun (distribution par défaut) --</SelectItem>
                      {candidates.map(candidate => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} ({candidate.party})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Barre de score cible */}
                {selectedCandidateForScore && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Score cible (%)</Label>
                      <Badge className="text-xs bg-blue-600 text-white">
                        {targetCandidateScore.toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>0%</span>
                        <span className="font-medium">{targetCandidateScore.toFixed(2)}%</span>
                        <span>100%</span>
                      </div>
                      <Slider
                        value={[targetCandidateScore]}
                        onValueChange={(value) => setTargetCandidateScore(value[0])}
                        max={100}
                        step={0.1}
                        className="w-full"
                        disabled={pendingBureaux.length === 0 || !!selectedBureauData}
                      />
                    </div>
                    <p className="text-xs text-blue-600 font-medium">
                     {candidates.find(c => c.id === selectedCandidateForScore)?.name} obtiendra {targetCandidateScore.toFixed(2)}% des voix des {pendingBureaux.length} bureau(x) non dépouillé(s)
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Sélection Bureau spécifique */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Simulation par bureau
                </h3>
                {simulatedBureaux.size > 0 && (
                  <Badge className="bg-purple-600 text-white">
                    {simulatedBureaux.size} bureau(x) simulé(s)
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Sélectionnez des bureaux pour les simuler individuellement avec leurs propres paramètres
              </p>

              {/* Sélection Centre et Bureau */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3 w-3" />
                    Centre de vote
                  </Label>
                  <Select value={selectedCenter} onValueChange={handleCenterSelect}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un centre" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCenters.map(center => (
                        <SelectItem key={center} value={center}>
                          {center}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3 w-3" />
                    Bureau de vote
                  </Label>
                  <Select 
                    value={selectedBureau} 
                    onValueChange={handleBureauSelect}
                    disabled={!selectedCenter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un bureau" />
                    </SelectTrigger>
                  <SelectContent>
                    {bureausByCenter.map(bureau => {
                      const isValidated = isBureauValidated(bureau.id);
                      const isSimulated = simulatedBureaux.has(bureau.id);
                      
                      return (
                        <SelectItem 
                          key={bureau.id} 
                          value={bureau.id}
                          disabled={isValidated}
                          className={
                            isValidated 
                              ? 'bg-green-50 text-green-800 opacity-60' 
                              : isSimulated 
                                ? 'bg-yellow-50 text-yellow-900'
                                : ''
                          }
                        >
                          <span className="flex items-center gap-2">
                            {isValidated && <span className="text-green-600">✓ Publié</span>}
                            {!isValidated && isSimulated && <span className="text-yellow-600">⚡ Simulé</span>}
                            <span>{bureau.name} ({bureau.registered_voters.toLocaleString()} inscrits)</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                  </Select>
                </div>

                {selectedBureauData && (
                  <div className={`mt-3 p-3 rounded border ${isBureauValidated(selectedBureau) ? 'bg-green-50 border-green-300' : 'bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs font-medium ${isBureauValidated(selectedBureau) ? 'text-green-700' : 'text-purple-700'}`}>
                        {isBureauValidated(selectedBureau) ? '✓ Bureau publié (lecture seule)' : '📍 Bureau en cours d\'édition'}
                      </div>
                      <div className="flex gap-2">
                        {!isBureauValidated(selectedBureau) && simulatedBureaux.has(selectedBureau) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSimulatedBureaux(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(selectedBureau);
                                return newMap;
                              });
                              setSelectedBureau('');
                              setSelectedCenter('');
                            }}
                          >
                            🗑️ Supprimer
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={() => {
                            setSelectedBureau('');
                            setSelectedCenter('');
                          }}
                        >
                          ✕ Fermer
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700">{selectedBureauData.name}</div>
                    <div className="text-xs text-gray-500">{selectedBureauData.center_name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {selectedBureauData.registered_voters.toLocaleString()} électeurs inscrits
                    </div>
                    {!isBureauValidated(selectedBureau) && simulatedBureaux.has(selectedBureau) && (
                      <Badge variant="outline" className="text-xs mt-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                        ⚡ Bureau simulé
                      </Badge>
                    )}
                    {isBureauValidated(selectedBureau) && (
                      <div className="text-xs mt-2 text-green-700">
                        Ce bureau a déjà été dépouillé et ne peut pas être simulé
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Paramètres de simulation pour le bureau sélectionné */}
              {selectedBureauData && !isBureauValidated(selectedBureau) && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-purple-900">Paramètres de simulation du bureau</h4>
                    <Button variant="outline" size="sm" onClick={resetBureauSimulation} className="h-7 text-xs">
                      Réinitialiser
                    </Button>
                  </div>

                  {/* Taux d'abstention */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Taux d'abstention</Label>
                      {realAbstentionRate !== null && (
                        <Badge className="text-xs bg-blue-600 text-white">
                          Taux réel: {realAbstentionRate.toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>0%</span>
                        <span className="font-medium">{bureauSimulationParams.globalAbstention.toFixed(2)}%</span>
                        <span>100%</span>
                      </div>
                      <Slider
                        value={[bureauSimulationParams.globalAbstention]}
                        onValueChange={handleBureauAbstentionChange}
                        max={100}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Suffrage exprimé */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Suffrage exprimé (des votants)</Label>
                      {realSuffrageExprime !== null && (
                        <Badge className="text-xs bg-green-600 text-white">
                          Taux réel: {realSuffrageExprime.toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>0%</span>
                        <span className="font-medium">{bureauSimulationParams.suffrageExprime.toFixed(2)}%</span>
                        <span>100%</span>
                      </div>
                      <Slider
                        value={[bureauSimulationParams.suffrageExprime]}
                        onValueChange={handleBureauSuffrageChange}
                        max={100}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </CardContent>
    </Card>

  </>
  );
};

export default SimulationResultsSection;
