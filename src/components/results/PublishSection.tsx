/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Upload,
  Download,
  Users,
  TrendingUp,
  FileText,
  Eye,
  EyeOff,
  BarChart3,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import SimulationResultsSection from './SimulationResultsSection';
import { resolveCandidatesForElection } from '@/lib/candidateUtils';
import {
  getElectionElectorsTotal,
  getRegisteredVotersLabel,
  isProfessionalElection,
} from '@/utils/electionCalculations';
// Normalise n'importe quelle étiquette de collège vers la clé brute DB utilisée dans procès_verbaux
function normalizeCollegeKey(val: string | null | undefined): string | null {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (v === 'general' || v === 'encadrement') return 'general';
  if (v === 'cadres' || v === 'cadre') return 'cadres';
  if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
  if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
  return v;
}

// D'Hondt — conservé comme fallback pour seatsToFill > 2
function dhondt(votes: number[], totalSeats: number): number[] {
  const seats = new Array(votes.length).fill(0);
  for (let s = 0; s < totalSeats; s++) {
    let maxQ = -1, maxIdx = 0;
    votes.forEach((v, i) => {
      const q = v / (seats[i] + 1);
      if (q > maxQ) { maxQ = q; maxIdx = i; }
    });
    seats[maxIdx]++;
  }
  return seats;
}

// ─── Algorithme légal CSE (art. L2314-xx) ─────────────────────────────────────
// Cas 1 (1 siège) : majorité simple, départage par ancienneté puis âge
// Cas 2 (2 sièges) : quotient électoral + plus forte moyenne
// Cas >2           : fallback D'Hondt
interface SyndicatVotes {
  partyKey: string;
  votes: number;
  anciennete: number; // en mois — 0 si inconnu
  age: number;        // en années — 0 si inconnu
}
interface CollegeAllocation {
  seats: Record<string, number>;
  manualTie?: string[]; // présent si égalité absolue → traitement manuel
}

function allocateSeatsForCollege(syndicats: SyndicatVotes[], seatsToFill: number): CollegeAllocation {
  const empty: Record<string, number> = {};
  syndicats.forEach(s => { empty[s.partyKey] = 0; });
  if (!syndicats.length || seatsToFill === 0) return { seats: empty };
  const suffrages = syndicats.reduce((sum, s) => sum + s.votes, 0);
  if (suffrages === 0) return { seats: empty };

  // Sous-départage ancienneté → âge → égalité absolue
  const ancAgeTie = (tied: SyndicatVotes[]): SyndicatVotes | null => {
    const maxAnc = Math.max(...tied.map(t => t.anciennete));
    const byAnc = tied.filter(t => t.anciennete === maxAnc);
    if (byAnc.length === 1) return byAnc[0];
    const maxAge = Math.max(...byAnc.map(t => t.age));
    const byAge = byAnc.filter(t => t.age === maxAge);
    return byAge.length === 1 ? byAge[0] : null;
  };

  // ── Cas 1 : 1 siège ──────────────────────────────────────────────────────────
  if (seatsToFill === 1) {
    const maxV = Math.max(...syndicats.map(s => s.votes));
    const tied = syndicats.filter(s => s.votes === maxV);
    if (tied.length === 1) return { seats: { ...empty, [tied[0].partyKey]: 1 } };
    const winner = ancAgeTie(tied);
    if (!winner) return { seats: empty, manualTie: tied.map(s => s.partyKey) };
    return { seats: { ...empty, [winner.partyKey]: 1 } };
  }

  // ── Cas 2 : 2 sièges ─────────────────────────────────────────────────────────
  if (seatsToFill === 2) {
    const quotient = suffrages / 2;
    const allocated = { ...empty };
    syndicats.forEach(s => { allocated[s.partyKey] = Math.floor(s.votes / quotient); });
    let remaining = 2 - Object.values(allocated).reduce((a, b) => a + b, 0);
    if (remaining === 0) return { seats: allocated };

    while (remaining > 0) {
      const withMoy = syndicats.map(s => ({ ...s, moy: s.votes / (allocated[s.partyKey] + 1) }));
      const maxMoy = Math.max(...withMoy.map(m => m.moy));
      const tied = withMoy.filter(m => m.moy === maxMoy);
      if (tied.length === 1) { allocated[tied[0].partyKey]++; remaining--; continue; }

      // Égalité de moyenne → voix totales → ancienneté → âge → manuel
      const maxV = Math.max(...tied.map(t => t.votes));
      const byVotes = tied.filter(t => t.votes === maxV);
      if (byVotes.length === 1) { allocated[byVotes[0].partyKey]++; remaining--; continue; }
      const winner = ancAgeTie(byVotes);
      if (!winner) return { seats: allocated, manualTie: byVotes.map(s => s.partyKey) };
      allocated[winner.partyKey]++;
      remaining--;
    }
    return { seats: allocated };
  }

  // ── Cas >2 : D'Hondt (hors périmètre du document) ────────────────────────────
  const dhondtResult = dhondt(syndicats.map(s => s.votes), seatsToFill);
  const res = { ...empty };
  syndicats.forEach((s, i) => { res[s.partyKey] = dhondtResult[i]; });
  return { seats: res };
}

interface PublishSectionProps {
  selectedElection: string;
  readOnly?: boolean;
}

const PublishSection: React.FC<PublishSectionProps> = ({ selectedElection, readOnly = false }) => {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finalResults, setFinalResults] = useState<any | null>(null);
  const [detailedResults, setDetailedResults] = useState<any[]>([]);
  const [centerBreakdown, setCenterBreakdown] = useState<any[]>([]);
  const [bureauBreakdown, setBureauBreakdown] = useState<any[]>([]);
  const [collegeBreakdown, setCollegeBreakdown] = useState<any[]>([]);
  const [unionLists, setUnionLists] = useState<any[]>([]);
  const [nonValidatedByCenter, setNonValidatedByCenter] = useState<any[]>([]);
  const [nonValidatedByBureau, setNonValidatedByBureau] = useState<any[]>([]);
  const [nonValidatedCount, setNonValidatedCount] = useState<number>(0);
  const [electionType, setElectionType] = useState<string | undefined>();
  const [rawResultsData, setRawResultsData] = useState<{
    crRows: any[];
    pvMeta: Map<string, { centerId: string; centerName: string; collegeType: string | null }>;
    baseVotesByCandidate: Record<string, any>;
    availableCenters: { id: string; name: string }[];
    availableColleges: string[];
    bureauSeats: Map<string, number>; // "centerId_collegeType" → seats_to_fill (per-establishment)
    collegeSeatsMap: Record<string, number>; // collegeType → seats_to_fill (global fallback)
  } | null>(null);
  const [logosByParty, setLogosByParty] = useState<Record<string, string>>({});
  const [showSimulation, setShowSimulation] = useState(() =>
    selectedElection ? localStorage.getItem(`sim_visible_${selectedElection}`) === 'true' : false
  );
  const [hideSimulationFromPublic, setHideSimulationFromPublic] = useState(() =>
    selectedElection ? localStorage.getItem(`sim_public_hidden_${selectedElection}`) !== 'false' : true
  );

  // Synchroniser les états simulation quand l'élection change
  useEffect(() => {
    if (!selectedElection) return;
    setShowSimulation(localStorage.getItem(`sim_visible_${selectedElection}`) === 'true');
    setHideSimulationFromPublic(localStorage.getItem(`sim_public_hidden_${selectedElection}`) !== 'false');
  }, [selectedElection]);

  // Persister les états simulation
  useEffect(() => {
    if (!selectedElection) return;
    localStorage.setItem(`sim_visible_${selectedElection}`, String(showSimulation));
  }, [showSimulation, selectedElection]);

  useEffect(() => {
    if (!selectedElection) return;
    localStorage.setItem(`sim_public_hidden_${selectedElection}`, String(hideSimulationFromPublic));
  }, [hideSimulationFromPublic, selectedElection]);

  // Fonction pour charger les résultats (provisoires = entered + validés) et calculer les agrégats
  const loadFinalResults = useCallback(async () => {
      if (!selectedElection) return;
      let _loadingTimeout: ReturnType<typeof setTimeout> | null = null;
      try {
        setLoading(true);
        _loadingTimeout = setTimeout(() => setLoading(false), 3000);

        // 0) Charger le type de l'élection (pour différencier pro / standard)
        const { data: electionData } = await supabase
          .from('elections')
          .select('type, nb_electeurs')
          .eq('id', selectedElection)
          .single();

        const isPro = isProfessionalElection(electionData?.type);
        setElectionType(electionData?.type);

        const [
          totalElectorsElection,
          pvsValidatedResult,
          pvsEnteredResult,
          ecRowsResult,
          electionCandidates,
          unionListsResult
        ] = await Promise.all([
          getElectionElectorsTotal(selectedElection, electionData?.type),
          supabase
            .from('procès_verbaux')
            .select('id, bureau_id, total_registered, total_voters, null_votes, votes_expressed, status, entered_at, college_type')
            .eq('election_id', selectedElection)
            .in('status', ['validated', 'validé', 'published']),
          supabase
            .from('procès_verbaux')
            .select('id, bureau_id, total_registered, total_voters, null_votes, votes_expressed, status, entered_at, college_type')
            .eq('election_id', selectedElection)
            .in('status', ['entered', 'saisi']),
          supabase
            .from('election_centers')
            .select('center_id')
            .eq('election_id', selectedElection),
          resolveCandidatesForElection(selectedElection, electionData?.type),
          supabase
            .from('union_lists')
            .select('id, college, titulaires, suppleants, unions(id, name, acronym)')
            .eq('election_id', selectedElection)
        ]);

        const pvsValidated = pvsValidatedResult.data || [];
        const pvsEntered = pvsEnteredResult.data || [];
        const loadedUnionLists = unionListsResult.data || [];
        setUnionLists(loadedUnionLists);

        if (pvsValidatedResult.error) throw pvsValidatedResult.error;
        if (pvsEnteredResult.error) throw pvsEnteredResult.error;
        if (ecRowsResult.error) throw ecRowsResult.error;
        if (unionListsResult.error) throw unionListsResult.error;

        const allowedCenterIds = new Set((ecRowsResult.data || []).map((r: any) => r.center_id));

        let totalInscritsElection = 0;
        let allBureaux: any[] = [];
        let bureauSeats = new Map<string, number>();
        if (allowedCenterIds.size > 0) {
          const { data: bureauRows, error: bureauErr } = await supabase
            .from('voting_bureaux')
            .select('id, name, center_id, registered_voters, college, college_type, seats_to_fill')
            .in('center_id', Array.from(allowedCenterIds));
          if (bureauErr) throw bureauErr;
          allBureaux = bureauRows || [];
          totalInscritsElection = allBureaux.reduce((sum, b) => sum + (Number(b.registered_voters) || 0), 0);
          // Build "centerId_collegeType" → seats_to_fill from pseudo-entries
          allBureaux.forEach((b: any) => {
            const colKey = normalizeCollegeKey(b.college || b.college_type);
            if (b.seats_to_fill && colKey && b.center_id) {
              const key = `${String(b.center_id)}_${colKey}`;
              bureauSeats.set(key, Number(b.seats_to_fill) || 0);
            }
          });
        }

        if (totalInscritsElection === 0 && totalElectorsElection > 0) {
          totalInscritsElection = totalElectorsElection;
        }

        

        const allowedBureauIds = new Set(allBureaux.map((b: any) => b.id));
        const filteredValidatedPvs = pvsValidated.filter((pv: any) => !allowedCenterIds.size || allowedBureauIds.has(pv.bureau_id));
        const filteredEnteredPvs = pvsEntered.filter((pv: any) => !allowedCenterIds.size || allowedBureauIds.has(pv.bureau_id));
        const filteredPvsAll = [...filteredValidatedPvs, ...filteredEnteredPvs];
        setNonValidatedCount(filteredEnteredPvs.length);

        

        // 2) Récupérer résultats par candidat pour ces PV
        const pvIds = Array.from(new Set((filteredPvsAll || []).map((p: any) => p.id).filter(Boolean)));
        let crRows: any[] = [];
        if (pvIds.length > 0) {
          const { data: cr, error: crErr } = await supabase
            .from('candidate_results')
            .select('pv_id, candidate_id, votes, candidates!inner(id, name, party)')
            .in('pv_id', pvIds);
          if (crErr) throw crErr;
          crRows = cr || [];
        }

        // On n'utilise pas la vue agrégée ici pour respecter le filtre election_centers
        const electionCandidatesList = electionCandidates || [];

        // 4) Récupérer libellés bureaux/centres pour les PV valides/saisis
        const bureauIds = Array.from(new Set(filteredPvsAll.map((pv: any) => pv.bureau_id).filter(Boolean)));
        const bureaux = allBureaux.filter((b: any) => bureauIds.includes(b.id));

        const centerIds = Array.from(new Set(bureaux.map((b: any) => b.center_id).filter(Boolean)));
        let centers: any[] = [];
        if (centerIds.length > 0) {
          const { data: cRows, error: cErr } = await supabase
            .from('voting_centers')
            .select('id, name, total_voters')
            .in('id', centerIds);
          if (cErr) throw cErr;
          centers = cRows || [];
        }

        const bureauMap = new Map(bureaux.map((b: any) => [b.id, b]));
        const centerMap = new Map(centers.map((c: any) => [c.id, c]));

        // 5) Agrégations (n'afficher que les candidats de cette élection, même à 0 voix)
        const votesByCandidate: Record<string, { id: string; name: string; party: string; suppleant?: string; college_type?: string | null; votes: number }> = {};
        electionCandidatesList.forEach((c: any) => {
          votesByCandidate[c.id] = { id: c.id, name: c.name, party: c.party, suppleant: c.suppleant, college_type: c.college_type, votes: 0 };
        });
        let totalVotants = 0;
        let bulletinsNuls = 0;
        let totalExprimesPV = 0;

        const pvMeta = new Map<string, { centerId: string; centerName: string; collegeType: string | null; status: string }>();
        filteredPvsAll.forEach((pv: any) => {
          const bureau = bureauMap.get(pv.bureau_id);
          const center = bureau ? centerMap.get(bureau.center_id) : undefined;
          pvMeta.set(pv.id, {
            centerId: bureau?.center_id ? String(bureau.center_id) : '',
            centerName: center?.name || '',
            collegeType: pv.college_type || null,
            status: pv.status || '',
          });
        });
        const availableCenters = centers.map((c: any) => ({ id: String(c.id), name: c.name }));
        const availableColleges = [...new Set(filteredPvsAll.map((pv: any) => pv.college_type).filter(Boolean))] as string[];

        const enteredCandidateIds = new Set<string>();
        crRows.forEach((r: any) => {
          const cid = r.candidates?.id || r.candidate_id;
          if (!votesByCandidate[cid]) return;
          votesByCandidate[cid].votes += r.votes || 0;
          enteredCandidateIds.add(cid);
        });

        // Sièges par collège depuis electoral_colleges (source de vérité)
        // Les clés sont NORMALISÉES pour correspondre aux college_type des PV
        // (electoral_colleges peut avoir "Encadrement" → normalise en "general", etc.)
        const collegeSeatsMap: Record<string, number> = {};
        if (isPro) {
          const { data: ecollRows } = await supabase
            .from('electoral_colleges')
            .select('college_type, seats_to_fill')
            .eq('election_id', selectedElection);
          (ecollRows || []).forEach((ec: any) => {
            const nk = normalizeCollegeKey(ec.college_type);
            if (nk && !(nk in collegeSeatsMap)) {
              collegeSeatsMap[nk] = Number(ec.seats_to_fill) || 0;
            }
          });
        }

        setRawResultsData({ crRows, pvMeta, baseVotesByCandidate: { ...votesByCandidate }, availableCenters, availableColleges, bureauSeats, collegeSeatsMap });

        if (isPro) {
          try {
            const { data: ulLogos, error: ulLogoErr } = await supabase
              .from('union_lists')
              .select('unions(acronym, logo)')
              .eq('election_id', selectedElection);
            if (!ulLogoErr) {
              const newLogosByParty: Record<string, string> = {};
              (ulLogos ?? []).forEach((ul: any) => {
                const acronym = ul.unions?.acronym;
                const logo = ul.unions?.logo;
                if (acronym && logo) newLogosByParty[acronym] = logo;
              });
              setLogosByParty(newLogosByParty);
            }
          } catch (_) { /* logo column absent — silencieux */ }
        } else {
          setLogosByParty({});
        }

        // Calculate total inscrits based on PVs: prefer pv.total_registered, then bureau.registered_voters, then center.total_voters
        const totalInscritsDesBureauxAvecPV = (filteredPvsAll || []).reduce((sum: number, pv: any) => {
          const bureau = bureauMap.get(pv.bureau_id);
          const centerTotal = bureau ? Number(centerMap.get(bureau.center_id)?.total_voters) || 0 : 0;
          const regFromPV = Number(pv.total_registered) || 0;
          const regFromBureau = Number(bureau?.registered_voters) || 0;
          const chosen = regFromPV > 0 ? regFromPV : (regFromBureau > 0 ? regFromBureau : centerTotal);
          return sum + chosen;
        }, 0);

        (filteredPvsAll || []).forEach((pv: any) => {
          totalVotants += Number(pv.total_voters) || 0;
          bulletinsNuls += Number(pv.null_votes) || 0;
          totalExprimesPV += Number(pv.votes_expressed) || 0;
        });

        // Prefer the PV-based base when available (shows electors entered / electors total)
        const totalInscrits = (totalInscritsDesBureauxAvecPV && totalInscritsDesBureauxAvecPV > 0)
          ? totalInscritsDesBureauxAvecPV
          : totalInscritsElection;
        
        

        const candidates = Object.values(votesByCandidate).filter(c => enteredCandidateIds.has(c.id)).sort((a, b) => b.votes - a.votes);
        const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
        const baseExprimes = totalExprimesPV > 0 ? totalExprimesPV : totalVotes;
        const colorPalette = ['#22c55e','#ef4444','#3b82f6','#a855f7','#f59e0b','#06b6d4'];
        const candidatesWithPct = candidates.map((c, idx) => ({
          ...c,
          percentage: baseExprimes > 0 ? Number(((100 * c.votes) / baseExprimes).toFixed(2)) : 0,
          color: colorPalette[idx % colorPalette.length]
        }));

        const validatedBureaux = filteredValidatedPvs.length;
        const physicalBureaux = allBureaux.filter((b: any) =>
          !b.name?.startsWith?.('College -') && (b.college == null || b.college === '' || b.college === 'general')
        );
        const totalBureaux = physicalBureaux.length > 0 ? physicalBureaux.length : allBureaux.length;

        setFinalResults({
          participation: {
            totalInscrits,
            totalInscritsElection,
            totalVotants,
            tauxParticipation: totalInscrits > 0 ? Number(((totalVotants / totalInscrits) * 100).toFixed(2)) : 0,
            bulletinsNuls,
            suffragesExprimes: baseExprimes,
            verificationAlt: {
              exprimesAlt: totalVotes,
              tauxAlt: totalInscrits > 0 ? Number(((((totalVotes) + bulletinsNuls) / totalInscrits) * 100).toFixed(2)) : 0
            }
          },
          candidates: candidatesWithPct,
          validatedBureaux,
          totalBureaux,
          lastUpdate: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });

        // 5) Résultats détaillés par bureau
        const detailed = (filteredPvsAll || []).map((pv: any) => {
          const b = bureauMap.get(pv.bureau_id);
          const c = b ? centerMap.get(b.center_id) : undefined;
          
          const pvCandidateResults = crRows.filter((r: any) => r.pv_id === pv.id);
          const candidateVotes: Record<string, number> = {};
          
          // Initialiser tous les candidats à 0
          electionCandidatesList.forEach(cand => {
             candidateVotes[cand.id] = 0;
          });
          
          // Ajouter les votes du PV
          pvCandidateResults.forEach((cr: any) => {
             const cid = cr.candidates?.id || cr.candidate_id;
             if (candidateVotes[cid] !== undefined) {
               candidateVotes[cid] += cr.votes || 0;
             }
          });
          
          return {
            center: c?.name || 'Centre',
            bureau: b?.name || 'Bureau',
            inscrits: pv.total_registered || 0, // Utiliser le nombre d'inscrits par défaut du bureau
            votants: pv.total_voters || 0,
            candidateVotes
          };
        });
        setDetailedResults(detailed);

        // 6) Construire les breakdowns par centre et bureau manuellement depuis les PV validés/publiés
        try {
          
          
          // Construire les données par bureau (UNIQUEMENT validés + publiés - lignes vertes)
          const bureauxBreakdownData = (filteredValidatedPvs || []).map((pv: any) => {
            const b = bureauMap.get(pv.bureau_id);
            const c = b ? centerMap.get(b.center_id) : undefined;
            return {
              election_id: selectedElection,
              bureau_id: pv.bureau_id,
              bureau_name: b?.name || 'Bureau',
              center_id: b?.center_id,
              center_name: c?.name || 'Centre',
              total_registered: Number(b?.registered_voters) || 0,
              total_voters: Number(pv.total_voters) || 0,
              total_null_votes: Number(pv.null_votes) || 0,
              total_expressed_votes: Number(pv.votes_expressed) || 0,
              participation_pct: Number(b?.registered_voters) > 0 ? (Number(pv.total_voters) / Number(b.registered_voters)) * 100 : 0
            };
          });

          // Tri croissant par nom de bureau (ou id si pas de nom)
          const sortedBureaux = bureauxBreakdownData.sort((a: any, b: any) => {
            const ax = String(a.bureau_name ?? a.bureau_id ?? '').trim();
            const bx = String(b.bureau_name ?? b.bureau_id ?? '').trim();
            const anx = Number(ax); const bnx = Number(bx);
            if (!Number.isNaN(anx) && !Number.isNaN(bnx)) return anx - bnx;
            return ax.localeCompare(bx, 'fr', { numeric: true, sensitivity: 'base' });
          });
          setBureauBreakdown(sortedBureaux);

          // Agréger par centre
          const centerAggMap = new Map();
          bureauxBreakdownData.forEach((b: any) => {
            const key = String(b.center_id || '');
            const prev = centerAggMap.get(key) || {
              election_id: selectedElection,
              center_id: b.center_id,
              center_name: b.center_name,
              total_registered: 0,
              total_voters: 0,
              total_null_votes: 0,
              total_expressed_votes: 0
            };
            prev.total_registered += b.total_registered;
            prev.total_voters += b.total_voters;
            prev.total_null_votes += b.total_null_votes;
            prev.total_expressed_votes += b.total_expressed_votes;
            prev.participation_pct = prev.total_registered > 0 ? (prev.total_voters / prev.total_registered) * 100 : 0;
            centerAggMap.set(key, prev);
          });

          setCenterBreakdown(Array.from(centerAggMap.values()));
          
          
          
          // Construire les lignes pour les PV saisis (non validés) - affichés en jaune
          const enteredByBureau = (filteredEnteredPvs || []).map((pv: any) => {
            const b = bureauMap.get(pv.bureau_id);
            const c = b ? centerMap.get(b.center_id) : undefined;
            return {
              election_id: selectedElection,
              center_id: b?.center_id,
              center_name: c?.name || 'Centre',
              bureau_id: pv.bureau_id,
              bureau_name: b?.name || 'Bureau',
              total_registered: Number(b?.registered_voters) || 0,
              total_voters: Number(pv.total_voters) || 0,
              total_null_votes: Number(pv.null_votes) || 0,
              total_expressed_votes: Number(pv.votes_expressed) || 0
            };
          });
          setNonValidatedByBureau(enteredByBureau);
          
          // Agréger par centre pour les PV saisis
          const centerAggMapEntered = new Map();
          enteredByBureau.forEach((b: any) => {
            const key = String(b.center_id || '');
            const prev = centerAggMapEntered.get(key) || {
              center_id: b.center_id,
              center_name: b.center_name,
              total_registered: 0,
              total_voters: 0,
              total_null_votes: 0,
              total_expressed_votes: 0
            };
            prev.total_registered += b.total_registered;
            prev.total_voters += b.total_voters;
            prev.total_null_votes += b.total_null_votes;
            prev.total_expressed_votes += b.total_expressed_votes;
            centerAggMapEntered.set(key, prev);
          });
          setNonValidatedByCenter(Array.from(centerAggMapEntered.values()));

          // Agrégation par collège (élections professionnelles)
          const COLLEGE_LABELS: Record<string, string> = {
            general: 'Encadrement', cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution',
          };
          const collegeAggMap = new Map<string, any>();
          filteredValidatedPvs.forEach((pv: any) => {
            const key = pv.college_type || 'general';
            const prev = collegeAggMap.get(key) || {
              college_type: key,
              college_label: COLLEGE_LABELS[key] || key,
              total_registered: 0, total_voters: 0, total_null_votes: 0, total_expressed_votes: 0, pv_count: 0,
            };
            prev.total_registered    += Number(pv.total_registered) || 0;
            prev.total_voters        += Number(pv.total_voters) || 0;
            prev.total_null_votes    += Number(pv.null_votes) || 0;
            prev.total_expressed_votes += Number(pv.votes_expressed) || 0;
            prev.pv_count            += 1;
            collegeAggMap.set(key, prev);
          });
          const collegeOrder = ['general', 'cadres', 'employes', 'ouvriers'];
          setCollegeBreakdown(
            Array.from(collegeAggMap.values()).sort(
              (a, b) => collegeOrder.indexOf(a.college_type) - collegeOrder.indexOf(b.college_type)
            )
          );
        } catch (_) {
          setCenterBreakdown([]);
          setBureauBreakdown([]);
          setCollegeBreakdown([]);
          setNonValidatedByCenter([]);
          setNonValidatedByBureau([]);
        }
      } catch (e) {
        console.error('Erreur chargement résultats finaux:', e);
        setFinalResults(null);
        setDetailedResults([]);
      } finally {
        if (_loadingTimeout) clearTimeout(_loadingTimeout);
        setLoading(false);
      }
  }, [selectedElection]);

  // Charger les résultats au montage et lors du changement d'élection
  useEffect(() => {
    loadFinalResults();
  }, [loadFinalResults]);

  // Calcul des sièges par algorithme légal CSE (Cas 1/2) par bureau (collège électoral au sein d'un établissement)
  const computedSeatsResult = useMemo<{
    seats: Record<string, number>;
    manualTies: { group: string; parties: string[] }[];
  }>(() => {
    const empty = { seats: {} as Record<string, number>, manualTies: [] as { group: string; parties: string[] }[] };
    if (!rawResultsData || !isProfessionalElection(electionType)) return empty;
    const { crRows, pvMeta, baseVotesByCandidate, bureauSeats } = rawResultsData;

    const activeCenter  = '';
    const activeCollege = '';
    const resultSeats: Record<string, number> = {};
    const manualTies: { group: string; parties: string[] }[] = [];

    // Construire une Map des attributs des candidats : "syndicat_college" -> { age, seniority }
    const candidateInfoMap = new Map<string, { age: number; seniority: number }>();
    unionLists.forEach(ul => {
      const acronym = ul.unions?.acronym?.trim();
      const name = ul.unions?.name?.trim();
      const collegeKey = normalizeCollegeKey(ul.college);
      
      let age = 0;
      let seniority = 0;
      
      const t = Array.isArray(ul.titulaires) && ul.titulaires.length > 0
        ? ul.titulaires[0]
        : (typeof ul.titulaires === 'string' ? JSON.parse(ul.titulaires || '[]')[0] : null);

      if (t) {
        age = Number(t.age) || 0;
        seniority = Number(t.anciennete) || 0;
      }
      
      if (collegeKey) {
        if (acronym) candidateInfoMap.set(`${acronym}_${collegeKey}`, { age, seniority });
        if (name) candidateInfoMap.set(`${name}_${collegeKey}`, { age, seniority });
      }
    });

    // 1) Récupérer les voix par PV
    const pvCandidateResults = new Map<string, any[]>();
    crRows.forEach((r: any) => {
      if (!pvCandidateResults.has(r.pv_id)) pvCandidateResults.set(r.pv_id, []);
      pvCandidateResults.get(r.pv_id)!.push(r);
    });

    // 2) Effectuer le calcul bureau par bureau
    pvCandidateResults.forEach((results, pvId) => {
      const meta = pvMeta.get(pvId);
      if (!meta) return;

      // Exclure les PV non validés du calcul officiel des sièges
      if (meta.status === 'entered' || meta.status === 'saisi') return;

      // Appliquer les filtres établissement / collège
      if (activeCenter && meta.centerId !== activeCenter) return;
      if (activeCollege && meta.collegeType !== activeCollege) return;

      const centerId = meta.centerId;
      const colKey = normalizeCollegeKey(meta.collegeType);
      const seatsToFillKey = `${centerId}_${colKey}`;
      const seatsToFill = bureauSeats.get(seatsToFillKey) || 0;

      if (seatsToFill === 0) return;

      // Agréger les voix par syndicat pour ce PV
      const partyVotes = new Map<string, number>();
      results.forEach((r: any) => {
        const cid = r.candidates?.id || r.candidate_id;
        const cand = baseVotesByCandidate[cid];
        if (!cand) return;
        const pk = (cand.party?.split(' — ')[0] || cand.name || '').trim();
        partyVotes.set(pk, (partyVotes.get(pk) || 0) + (r.votes || 0));
      });

      // Construire l'entrée des syndicats avec l'âge et l'ancienneté
      const syndicats: SyndicatVotes[] = Array.from(partyVotes.entries()).map(([pk, v]) => {
        const infoKey = `${pk}_${colKey}`;
        const info = candidateInfoMap.get(infoKey) || { age: 0, seniority: 0 };
        return {
          partyKey: pk,
          votes: v,
          anciennete: info.seniority,
          age: info.age
        };
      });

      const alloc = allocateSeatsForCollege(syndicats, seatsToFill);

      // Cumuler les sièges obtenus
      Object.entries(alloc.seats).forEach(([pk, s]) => {
        resultSeats[pk] = (resultSeats[pk] || 0) + s;
      });

      if (alloc.manualTie) {
        manualTies.push({
          group: `${meta.centerName || 'Centre'} - ${toCollegeLabel(meta.collegeType || '')}`,
          parties: alloc.manualTie
        });
      }
    });

    return { seats: resultSeats, manualTies };
  }, [rawResultsData, electionType, unionLists]);

  const computedSeats    = computedSeatsResult.seats;
  const seatManualTies   = computedSeatsResult.manualTies;

  // Pour les élections pro, plusieurs shadow-candidats partagent le même party (syndicat + collège,
  // un par établissement). On les fusionne ici pour n'afficher qu'une ligne par liste syndicale.
  const groupedCandidates = useMemo(() => {
    const raw: any[] = finalResults?.candidates ?? [];
    if (!isProfessionalElection(electionType) || raw.length === 0) return raw;

    const colorPalette = ['#22c55e','#ef4444','#3b82f6','#a855f7','#f59e0b','#06b6d4'];
    const partyMap = new Map<string, any>();
    for (const c of raw) {
      const key = (c.party?.split(' — ')[0] || c.name || '').trim();
      if (partyMap.has(key)) {
        partyMap.get(key).votes += Number(c.votes) || 0;
      } else {
        partyMap.set(key, { ...c, votes: Number(c.votes) || 0 });
      }
    }
    const merged = Array.from(partyMap.values()).sort((a, b) => {
      const aKey = (a.party?.split(' — ')[0] || a.name || '').trim();
      const bKey = (b.party?.split(' — ')[0] || b.name || '').trim();
      const aSeats = computedSeats[aKey] ?? 0;
      const bSeats = computedSeats[bKey] ?? 0;
      if (bSeats !== aSeats) return bSeats - aSeats;
      return b.votes - a.votes;
    });
    const total = merged.reduce((s, c) => s + c.votes, 0);
    return merged.map((c, idx) => ({
      ...c,
      percentage: total > 0 ? Number(((100 * c.votes) / total).toFixed(2)) : 0,
      color: colorPalette[idx % colorPalette.length],
    }));
  }, [finalResults, electionType, computedSeats]);

  // Candidats — utiliser directement les candidats groupés
  const displayedCandidates = groupedCandidates;

  const toCollegeLabel = (key: string) => {
    if (key === 'general') return 'Encadrement';
    if (key === 'cadres') return 'Cadres';
    if (key === 'employes') return 'Maîtrise';
    if (key === 'ouvriers') return 'Exécution';
    return key;
  };

  const pieChartData = useMemo(() => (
    groupedCandidates.map((candidate: any) => ({
      name: (candidate.party?.split(' — ')[0] || candidate.name || '—'),
      value: Number(candidate.votes) || 0,
      percentage: Number(candidate.percentage) || 0,
      color: candidate.color || '#3b82f6'
    }))
  ), [groupedCandidates]);

  const barChartData = useMemo(() => (
    groupedCandidates.map((candidate: any) => ({
      name: (candidate.party?.split(' — ')[0] || candidate.name || '—').split(' ').slice(0, 2).join(' '),
      votes: Number(candidate.votes) || 0,
      color: candidate.color
    }))
  ), [groupedCandidates]);

  const CenterAndBureauTables = () => {
    const filteredNVCenter    = nonValidatedByCenter;
    const filteredCenterBreak = centerBreakdown;
    const filteredCollegeBreak = collegeBreakdown;

    return (
    <div className="mt-8 space-y-8">
      {(filteredNVCenter.length > 0 || filteredCenterBreak.length > 0) && (
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="text-gov-dark flex items-center justify-between">
              <span>Par Centre de Vote</span>
              {filteredNVCenter.length > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800">{filteredNVCenter.length} centre(s) avec PV non validés</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre</TableHead>
                    <TableHead className="text-right">Votants</TableHead>
                    <TableHead className="text-right">Nuls</TableHead>
                    <TableHead className="text-right">Exprimés</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNVCenter.map((row: any, idx: number) => (
                    <TableRow key={`nv-center-${idx}`} className="bg-yellow-50">
                      <TableCell className="font-medium text-yellow-900">{row.center_name}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_voters || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_null_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_expressed_votes || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {filteredCenterBreak.map((row: any) => (
                    <TableRow key={`${row.center_id}`}>
                      <TableCell>{row.center_name}</TableCell>
                      <TableCell className="text-right">{Number(row.total_voters || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_null_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_expressed_votes || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredCollegeBreak.length > 0 && (
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="text-gov-dark">Par Collège</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collège</TableHead>
                    <TableHead className="text-right">PV</TableHead>
                    <TableHead className="text-right">Électeurs</TableHead>
                    <TableHead className="text-right">Votants</TableHead>
                    <TableHead className="text-right">Nuls</TableHead>
                    <TableHead className="text-right">Exprimés</TableHead>
                    <TableHead className="text-right">Participation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollegeBreak.map((row: any) => (
                    <TableRow key={row.college_type}>
                      <TableCell className="font-medium">{row.college_label}</TableCell>
                      <TableCell className="text-right text-gray-500">{row.pv_count}</TableCell>
                      <TableCell className="text-right">{Number(row.total_registered || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_voters || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_null_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_expressed_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {row.total_registered > 0
                          ? `${((row.total_voters / row.total_registered) * 100).toFixed(1)}%`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    );
  };

  const handlePublish = async () => {
    try {
      console.log('🚀 [Publication] Début de la publication...');
      
      // 1. Mettre à jour l'élection
      const { error: electionError } = await supabase
        .from('elections')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq('id', selectedElection);
      
      if (electionError) {
        console.error('❌ [Publication] Erreur publication élection:', electionError);
        toast.error('Échec de la publication de l\'élection');
        return;
      }
      
      console.log('✅ [Publication] Élection mise à jour');

      // 2. Changer le statut de TOUS les PV validés en 'published'
      const { data: updatedPVs, error: pvError } = await supabase
        .from('procès_verbaux')
        .update({ status: 'published' })
        .eq('election_id', selectedElection)
        .eq('status', 'validated')
        .select('id, bureau_id, status');
      
      if (pvError) {
        console.error('❌ [Publication] Erreur publication PV:', pvError);
        toast.error('Échec de la publication des PV');
        return;
      }

      console.log('✅ [Publication] PV mis à jour:', updatedPVs);
      console.log('✅ [Publication] Nombre de PV publiés:', updatedPVs?.length || 0);

      setShowPublishConfirm(false);
      const count = updatedPVs?.length || finalResults?.validatedBureaux || 0;
      toast.success(`Résultats publiés : ${count} PV ont été publiés publiquement.`);
      
      // Recharger les données pour afficher les PV publiés
      console.log('🔄 [Publication] Rechargement des données...');
      await loadFinalResults();
    } catch (e) {
      console.error('❌ [Publication] Erreur:', e);
      toast.error('Échec de la publication');
    }
  };

  const exportToPDF = () => {
    console.log('Export PDF...');
  };

  const exportToCSV = () => {
    console.log('Export CSV...');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="gov-card border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-14 w-64" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-2 w-full mt-3" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="gov-card">
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
          <Card className="gov-card">
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
        </div>
        <Card className="gov-card">
          <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statut de validation */}
      <Card className="gov-card border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Résultats Validés Prêts</h3>
                <p className="text-sm text-gray-600">
                  {finalResults ? (
                    <>
                      {finalResults.validatedBureaux} bureaux validés sur {finalResults.totalBureaux}
                      {' '}({finalResults.totalBureaux > 0 ? ((finalResults.validatedBureaux / finalResults.totalBureaux) * 100).toFixed(2) : '0.00'}%)
                    </>
                  ) : '—'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Dernière mise à jour</div>
              <div className="font-medium">{finalResults?.lastUpdate || '—'}</div>
            </div>
          </div>
          <Progress 
            value={finalResults && finalResults.totalBureaux > 0 ? (finalResults.validatedBureaux / finalResults.totalBureaux) * 100 : 0} 
            className="mt-3"
          />
        </CardContent>
      </Card>

      {/* Résultats globaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs de participation */}
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gov-gray">
              <Users className="w-5 h-5" />
              <span>Abstention Électorale</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                  {finalResults ? (100 - Number(finalResults.participation.tauxParticipation)).toFixed(2) : '0.00'}%
                </div>
                <div className="text-sm text-gray-600">Taux d'abstention</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-900">
                    {finalResults ? Number(finalResults.participation.totalVotants).toLocaleString() : '0'}
                  </div>
                  <div className="text-gray-600">Votants</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {finalResults ? (
                      <>
                        {Number(finalResults.participation.totalInscrits).toLocaleString()}
                        {finalResults.participation.totalInscritsElection && (
                          <span className="text-gray-500 font-normal">
                            {' '}/{' '}{Number(finalResults.participation.totalInscritsElection).toLocaleString()}
                          </span>
                        )}
                      </>
                    ) : '0'}
                  </div>
                  <div className="text-gray-600">{getRegisteredVotersLabel(electionType)}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {finalResults ? Number(finalResults.participation.suffragesExprimes).toLocaleString() : '0'}
                  </div>
                  <div className="text-gray-600">Exprimés</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                  {finalResults ? Number(finalResults.participation.bulletinsNuls).toLocaleString() : '0'}
                  </div>
                  <div className="text-gray-600">Bulletins nuls</div>
                </div>
              </div>

              {finalResults?.participation?.verificationAlt && (
                <div className="mt-3 text-xs">
                  <span className="inline-block px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Vérif (modèle 2) — Exprimés: {Number(finalResults.participation.verificationAlt.exprimésAlt || finalResults.participation.verificationAlt.exprimesAlt).toLocaleString()} • Taux (participation): {Number(finalResults.participation.verificationAlt.tauxAlt).toFixed(2)}% • Abstention: {(100 - Number(finalResults.participation.verificationAlt.tauxAlt)).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Graphique camembert */}
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gov-gray">
              <BarChart3 className="w-5 h-5" />
              <span>Score par Syndicat</span>
            </CardTitle>
          </CardHeader>
        <CardContent className="overflow-visible">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                    outerRadius={90}
                  dataKey="value"
                    label={({ percentage }: any) => `${percentage}%`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500">Aucune donnée à afficher</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Détails par centre et par bureau */}
      <CenterAndBureauTables />

      {/* Alertes égalités — traitement manuel requis */}
      {seatManualTies.length > 0 && (
        <Card className="gov-card border-l-4 border-l-orange-500 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 text-sm">Égalité absolue — traitement manuel requis</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  L'algorithme n'a pas pu départager automatiquement les syndicats suivants.
                  Renseignez l'ancienneté et l'âge des candidats en tête de liste pour résoudre l'égalité.
                </p>
                <ul className="mt-2 space-y-1">
                  {seatManualTies.map((tie, i) => (
                    <li key={i} className="text-xs text-orange-800 font-medium">
                      • Collège / Groupe «&nbsp;{tie.group}&nbsp;» : {tie.parties.join(' — ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau récapitulatif */}
      <Card className="gov-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gov-gray">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Résultats Finaux par Candidat</span>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800">
              Inclut PV saisis non validés
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedCandidates.map((candidate: any, index: number) => {
              const isPro = isProfessionalElection(electionType);
              const syndicat = isPro ? (candidate.party?.split(' — ')[0] || candidate.name || '') : '';
              // Détails candidat (titulaire/suppléant) uniquement quand un filtre est actif
              const showCandidateDetails = !isPro;
              return (
                <div key={candidate.id || index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-2xl font-bold text-gray-400 w-8 text-center flex-shrink-0">
                      #{index + 1}
                    </div>
                    {/* Avatar : logo syndicat ou initiale */}
                    {isPro ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white flex items-center justify-center flex-shrink-0">
                        {logosByParty[syndicat] ? (
                          <img src={logosByParty[syndicat]} alt={syndicat} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-purple-600 bg-purple-100 uppercase">
                            {syndicat?.charAt(0) || 'S'}
                          </div>
                        )}
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      {isPro ? (
                        <>
                          <p className="font-bold text-blue-700 truncate">{syndicat}</p>
                          {showCandidateDetails && (
                            <>
                              <p className="text-sm text-gray-900 mt-0.5">
                                <span className="text-xs text-gray-500 font-medium">Titulaire : </span>
                                <span className="font-semibold">{candidate.name}</span>
                              </p>
                              {candidate.suppleant && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="font-medium">Suppléant : </span>{candidate.suppleant}
                                </p>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                          {candidate.party && <p className="text-sm text-blue-600 mt-0.5">{candidate.party}</p>}
                          {candidate.suppleant && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              <span className="font-medium">Suppléant : </span>{candidate.suppleant}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold" style={{ color: candidate.color }}>
                      {candidate.votes.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {Number(candidate.percentage).toFixed(2)}%
                    </div>
                    {isPro && Object.keys(computedSeats).length > 0 && (() => {
                      const syndicatKey = (candidate.party?.split(' — ')[0] || candidate.name || '').trim();
                      const seats = computedSeats[syndicatKey] ?? 0;
                      return (
                        <div className={`mt-1 text-xs font-semibold rounded px-2 py-0.5 ${seats > 0 ? 'text-green-700 bg-green-50 border border-green-200' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                          {seats} siège{seats !== 1 ? 's' : ''}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graphique en barres */}
          <div className="mt-6">
            {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                  <Bar dataKey="votes">
                    {barChartData.map((entry: any, index: number) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500">Aucune donnée à afficher</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions principales */}
      <div className="grid grid-cols-1 gap-4">
        {/* Publication */}
        <Card className="gov-card border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-blue-600 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                  Publier les Résultats
                </h3>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Rendre les résultats visibles publiquement sur le tableau de bord
                </p>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowPublishConfirm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                    disabled={readOnly || !finalResults || finalResults.validatedBureaux === 0}
                    title={readOnly ? 'Accès en lecture seule' : (!finalResults || finalResults.validatedBureaux === 0 ? 'La publication nécessite au moins un PV validé' : undefined)}
                  >
                     Publier les résultats
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Données Détaillées retirée sur demande */}
      </div>

      {/* Modal de confirmation de publication */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span>Confirmer la publication</span>
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir publier ces résultats ? Cette action rendra les résultats 
              visibles publiquement sur le tableau de bord et ne pourra pas être annulée.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Résumé de la publication :</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• {finalResults ? finalResults.validatedBureaux : 0} bureaux validés</li>
                <li>• {finalResults ? finalResults.participation.suffragesExprimes.toLocaleString() : 0} suffrages exprimés</li>
                <li>• Taux de participation : {finalResults ? finalResults.participation.tauxParticipation : 0}%</li>
                <li>• En tête : {groupedCandidates[0] ? `${groupedCandidates[0].party?.split(' — ')[0] || groupedCandidates[0].name} (${groupedCandidates[0].percentage}%)` : '—'}</li>
              </ul>
            </div>
            
            <div className="flex space-x-4">
              <Button
                onClick={handlePublish}
                disabled={readOnly}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                Confirmer la publication
              </Button>
              <Button
                onClick={() => setShowPublishConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal vue détaillée */}
      <Dialog open={showDetailedView} onOpenChange={setShowDetailedView}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Résultats Détaillés par Bureau de Vote</DialogTitle>
            <DialogDescription>
              Vue complète des résultats validés pour tous les bureaux de vote
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre de Vote</TableHead>
                    <TableHead>Bureau</TableHead>
                    <TableHead>{getRegisteredVotersLabel(electionType)}</TableHead>
                    <TableHead>Votants</TableHead>
                    {finalResults?.candidates.map((c) => (
                      <TableHead key={c.id}>{c.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{result.center}</TableCell>
                      <TableCell>{result.bureau}</TableCell>
                      <TableCell>{result.inscrits}</TableCell>
                      <TableCell>{result.votants}</TableCell>
                      {finalResults?.candidates.map((c) => (
                        <TableCell key={c.id}>{result.candidateVotes?.[c.id] || 0}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section de simulation — interrupteur ON/OFF */}
      {selectedElection && (
        <div className="mt-6">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Ligne 1 : toggle admin */}
            <button
              onClick={() => setShowSimulation(prev => !prev)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                showSimulation
                  ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Simulation des résultats</span>
              </div>
              {/* Interrupteur visuel */}
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showSimulation ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  showSimulation ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
            </button>

            {/* Ligne 2 : option vue publique (toujours visible) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                {hideSimulationFromPublic
                  ? <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                  : <Eye className="w-3.5 h-3.5 text-green-500" />}
                <span className="text-xs text-gray-500">
                  {hideSimulationFromPublic
                    ? 'Masquée de la vue publique'
                    : 'Visible dans la vue publique'}
                </span>
              </div>
              <button
                onClick={() => setHideSimulationFromPublic(prev => !prev)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hideSimulationFromPublic ? 'bg-gray-300' : 'bg-green-500'
                }`}
                title={hideSimulationFromPublic ? 'Rendre visible publiquement' : 'Masquer de la vue publique'}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  hideSimulationFromPublic ? 'translate-x-1' : 'translate-x-4'
                }`} />
              </button>
            </div>
          </div>

          {showSimulation && (
            <div className="mt-3">
              <SimulationResultsSection electionId={selectedElection} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublishSection;
