
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
  BarChart3,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import SimulationResultsSection from './SimulationResultsSection';
import { resolveCandidatesForElection } from '@/lib/candidateUtils';

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
  const [nonValidatedByCenter, setNonValidatedByCenter] = useState<any[]>([]);
  const [nonValidatedByBureau, setNonValidatedByBureau] = useState<any[]>([]);
  const [nonValidatedCount, setNonValidatedCount] = useState<number>(0);

  // Fonction pour charger les résultats (provisoires = entered + validés) et calculer les agrégats
  const loadFinalResults = useCallback(async () => {
      if (!selectedElection) return;
      try {
        setLoading(true);

        // 0) Charger le type de l'élection (pour différencier pro / standard)
        const { data: electionData } = await supabase
          .from('elections')
          .select('type')
          .eq('id', selectedElection)
          .single();

        // 1) Récupérer PV par statut (validés ET publiés ensemble)
        const { data: pvsValidated, error: pvValErr } = await supabase
          .from('procès_verbaux')
          .select('id, bureau_id, total_registered, total_voters, null_votes, votes_expressed, status, entered_at')
          .eq('election_id', selectedElection)
          .in('status', ['validated', 'published']); // Inclure les publiés

        
        const { data: pvsEntered, error: pvEntErr } = await supabase
          .from('procès_verbaux')
          .select('id, bureau_id, total_registered, total_voters, null_votes, votes_expressed, status, entered_at')
          .eq('election_id', selectedElection)
          .eq('status', 'entered');

        if (pvValErr) throw pvValErr;
        if (pvEntErr) throw pvEntErr;

        console.log('📊 [PublishSection] PV validés + publiés:', pvsValidated?.length || 0);
        console.log('📊 [PublishSection] PV saisis:', pvsEntered?.length || 0);

        // Restreindre aux centres liés à l'élection via election_centers
        const { data: ecRows, error: ecCentersErr } = await supabase
          .from('election_centers')
          .select('center_id')
          .eq('election_id', selectedElection);
        if (ecCentersErr) throw ecCentersErr;
        const allowedCenterIds = new Set((ecRows || []).map((r: any) => r.center_id));

        // Calculer le vrai total d'inscrits de TOUS les bureaux de l'élection
        let totalInscritsElection = 0;
        let filteredValidatedPvs = pvsValidated || [];
        let filteredEnteredPvs = pvsEntered || [];
        if (allowedCenterIds.size > 0) {
          const { data: bureauRows, error: bureauErr } = await supabase
          .from('voting_bureaux')
            .select('id, center_id, registered_voters')
            .in('center_id', Array.from(allowedCenterIds));
          if (bureauErr) throw bureauErr;
          
          // Calculer le total réel d'inscrits de TOUS les bureaux
          totalInscritsElection = (bureauRows || []).reduce((sum, b) => sum + (Number(b.registered_voters) || 0), 0);
          
          const allowedBureauIds = new Set((bureauRows || []).map((b: any) => b.id));
          filteredValidatedPvs = filteredValidatedPvs.filter((pv: any) => allowedBureauIds.has(pv.bureau_id));
          filteredEnteredPvs = filteredEnteredPvs.filter((pv: any) => allowedBureauIds.has(pv.bureau_id));
        }
        
        console.log('📊 [PublishSection] Total inscrits calculé depuis TOUS les bureaux:', totalInscritsElection);
        
        const filteredPvsAll = [...filteredValidatedPvs, ...filteredEnteredPvs];
        setNonValidatedCount(filteredEnteredPvs.length);

        // 2) Récupérer résultats par candidat pour ces PV
        const pvIds = (filteredPvsAll || []).map(p => p.id);
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

        // 3) Charger la liste des candidats de l'élection (supporte pro + standard)
        const electionCandidates = await resolveCandidatesForElection(selectedElection, electionData?.type);

        // 4) Récupérer libellés bureaux/centres
        const bureauIds = Array.from(new Set((filteredPvsAll || []).map(p => p.bureau_id).filter(Boolean)));
        let bureaux: any[] = [];
        let centers: any[] = [];
        if (bureauIds.length > 0) {
          const { data: bRows, error: bErr } = await supabase
            .from('voting_bureaux')
            .select('id, name, center_id, registered_voters')
            .in('id', bureauIds);
          if (bErr) throw bErr;
          bureaux = bRows || [];
          const centerIds = Array.from(new Set(bureaux.map(b => b.center_id)));
          if (centerIds.length > 0) {
            const { data: cRows, error: cErr } = await supabase
              .from('voting_centers')
              .select('id, name')
              .in('id', centerIds);
            if (cErr) throw cErr;
            centers = cRows || [];
          }
        }

        const bureauMap = new Map(bureaux.map(b => [b.id, b]));
        const centerMap = new Map(centers.map(c => [c.id, c]));

        // 5) Agrégations (n'afficher que les candidats de cette élection, même à 0 voix)
        const votesByCandidate: Record<string, { id: string; name: string; party: string; votes: number }> = {};
        electionCandidates.forEach(c => {
          votesByCandidate[c.id] = { id: c.id, name: c.name, party: c.party, votes: 0 };
        });
        let totalVotants = 0;
        let bulletinsNuls = 0;
        let totalExprimesPV = 0;

        // Agrégation locale à partir des candidate_results (respecte le filtre précédent)
        crRows.forEach((r: any) => {
            const cid = r.candidates?.id || r.candidate_id;
          if (!votesByCandidate[cid]) return;
            votesByCandidate[cid].votes += r.votes || 0;
          });

        // Calculer le total des inscrits UNIQUEMENT des bureaux avec PV (validés + saisis)
        const totalInscritsDesBureauxAvecPV = bureaux.reduce((sum, b) => sum + (Number(b.registered_voters) || 0), 0);

        (filteredPvsAll || []).forEach((pv: any) => {
          totalVotants += Number(pv.total_voters) || 0;
          bulletinsNuls += Number(pv.null_votes) || 0;
          totalExprimesPV += Number(pv.votes_expressed) || 0;
        });

        // Pour le calcul du taux : utiliser les inscrits des bureaux avec PV
        const totalInscrits = totalInscritsDesBureauxAvecPV;
        
        console.log('📊 [PublishSection] Total inscrits (bureaux avec PV):', totalInscrits);
        console.log('📊 [PublishSection] Total inscrits élection (TOUS bureaux - calculé):', totalInscritsElection);
        console.log('📊 [PublishSection] Total votants:', totalVotants);
        console.log('📊 [PublishSection] Nombre de bureaux avec PV:', bureaux.length);

        const candidates = Object.values(votesByCandidate).sort((a, b) => b.votes - a.votes);
        const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
        // Base de pourcentage: privilégier la valeur des PV (plus fiable), fallback sur somme candidats
        const baseExprimes = totalExprimesPV > 0 ? totalExprimesPV : totalVotes;
        const colorPalette = ['#22c55e','#ef4444','#3b82f6','#a855f7','#f59e0b','#06b6d4'];
        const candidatesWithPct = candidates.map((c, idx) => ({
          ...c,
          percentage: baseExprimes > 0 ? Number(((100 * c.votes) / baseExprimes).toFixed(2)) : 0,
          color: colorPalette[idx % colorPalette.length]
        }));

        const validatedBureaux = (filteredValidatedPvs || []).length;
        
        // Récupérer le nombre total de bureaux de l'élection
        let totalBureaux = 0;
        if (allowedCenterIds.size > 0) {
          const { data: totalBureauxData, error: totalBureauxErr } = await supabase
            .from('voting_bureaux')
            .select('id', { count: 'exact' })
            .in('center_id', Array.from(allowedCenterIds));
          if (totalBureauxErr) {
            console.error('Erreur récupération total bureaux:', totalBureauxErr);
            totalBureaux = validatedBureaux; // fallback
          } else {
            totalBureaux = totalBureauxData?.length || 0;
          }
        } else {
          totalBureaux = validatedBureaux; // fallback si total inconnu
        }

        setFinalResults({
          participation: {
            totalInscrits,
            totalInscritsElection: totalInscritsElection, // Nombre total pour affichage statique
            totalVotants,
            tauxParticipation: totalInscrits > 0 ? Number(((totalVotants / totalInscrits) * 100).toFixed(2)) : 0,
            bulletinsNuls,
            suffragesExprimes: baseExprimes,
            // Vérification (modèle précédent basé sur somme des voix candidats)
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
          return {
            center: c?.name || 'Centre',
            bureau: b?.name || 'Bureau',
            inscrits: pv.total_registered || 0, // Utiliser le nombre d'inscrits par défaut du bureau
            votants: pv.total_voters || 0,
            notreCandidat: 0,
            adversaire1: 0,
            adversaire2: 0
          };
        });
        setDetailedResults(detailed);

        // 6) Construire les breakdowns par centre et bureau manuellement depuis les PV validés/publiés
        try {
          console.log('📊 [PublishSection] Construction breakdown - PV validés/publiés:', filteredValidatedPvs.length);
          console.log('📊 [PublishSection] Construction breakdown - PV saisis:', filteredEnteredPvs.length);
          console.log('📊 [PublishSection] Bureaux map size:', bureauMap.size);
          console.log('📊 [PublishSection] Centres map size:', centerMap.size);
          
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
          
          console.log('📊 [PublishSection] Bureaux breakdown construits (validés/publiés):', sortedBureaux.length);
          console.log('📊 [PublishSection] Centres breakdown construits (validés/publiés):', centerAggMap.size);
          
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
          
          console.log('📊 [PublishSection] Bureaux saisis (non validés):', enteredByBureau.length);
          console.log('📊 [PublishSection] Centres avec PV saisis:', centerAggMapEntered.size);
        } catch (_) {
          setCenterBreakdown([]);
          setBureauBreakdown([]);
          setNonValidatedByCenter([]);
          setNonValidatedByBureau([]);
        }
      } catch (e) {
        console.error('Erreur chargement résultats finaux:', e);
        setFinalResults(null);
        setDetailedResults([]);
      } finally {
        setLoading(false);
      }
  }, [selectedElection]);

  // Charger les résultats au montage et lors du changement d'élection
  useEffect(() => {
    loadFinalResults();
  }, [loadFinalResults]);

  const pieChartData = useMemo(() => (
    finalResults && Array.isArray(finalResults.candidates)
      ? finalResults.candidates.map((candidate: any) => ({
          name: candidate.name || '—',
          value: Number(candidate.votes) || 0,
          percentage: Number(candidate.percentage) || 0,
          color: candidate.color || '#3b82f6'
        }))
      : []
  ), [finalResults]);

  const barChartData = useMemo(() => (
    finalResults && Array.isArray(finalResults.candidates)
      ? finalResults.candidates.map((candidate: any) => ({
          name: (candidate.name || '—').split(' ').slice(0, 2).join(' '),
          votes: Number(candidate.votes) || 0,
    color: candidate.color
        }))
      : []
  ), [finalResults]);

  const CenterAndBureauTables = () => (
    <div className="mt-8 space-y-8">
      {(nonValidatedByCenter.length > 0 || centerBreakdown.length > 0) && (
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="text-gov-dark flex items-center justify-between">
              <span>Par Centre de Vote</span>
              {nonValidatedByCenter.length > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800">{nonValidatedByCenter.length} centre(s) avec PV non validés</Badge>
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
                  {nonValidatedByCenter.map((row: any, idx: number) => (
                    <TableRow key={`nv-center-${idx}`} className="bg-yellow-50">
                      <TableCell className="font-medium text-yellow-900">{row.center_name}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_voters || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_null_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_expressed_votes || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {centerBreakdown.map((row: any) => (
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

      {(nonValidatedByBureau.length > 0 || bureauBreakdown.length > 0) && (
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="text-gov-dark flex items-center justify-between">
              <span>Par Bureau</span>
              {nonValidatedByBureau.length > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800">{nonValidatedByBureau.length} PV non validés</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre</TableHead>
                    <TableHead>Bureau</TableHead>
                    <TableHead className="text-right">Votants</TableHead>
                    <TableHead className="text-right">Nuls</TableHead>
                    <TableHead className="text-right">Exprimés</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonValidatedByBureau.map((row: any, idx: number) => (
                    <TableRow key={`nv-bureau-${idx}`} className="bg-yellow-50">
                      <TableCell className="font-medium text-yellow-900">{row.center_name}</TableCell>
                      <TableCell className="text-yellow-900">{row.bureau_name}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_voters || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_null_votes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-yellow-900">{Number(row.total_expressed_votes || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {bureauBreakdown.map((row: any) => (
                    <TableRow key={`${row.bureau_id}`}>
                      <TableCell>{centerBreakdown.find((c:any)=>c.center_id===row.center_id)?.center_name || 'Centre'}</TableCell>
                      <TableCell>{row.bureau_name}</TableCell>
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
    </div>
  );

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
                  <div className="text-gray-600">Inscrits</div>
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
              <span>Score par candidat</span>
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
          <div className="space-y-4">
            {(finalResults ? finalResults.candidates : []).map((candidate: any, index: number) => (
              <div key={candidate.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold text-gray-600">
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                    <p className="text-sm text-gray-600">{candidate.party}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: candidate.color }}>
                    {candidate.votes.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Score : {Number(candidate.percentage).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
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
                <li>• Candidat en tête : {finalResults && finalResults.candidates[0] ? `${finalResults.candidates[0].name} (${finalResults.candidates[0].percentage}%)` : '—'}</li>
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
                    <TableHead>Inscrits</TableHead>
                    <TableHead>Votants</TableHead>
                    <TableHead>Notre Candidat</TableHead>
                    <TableHead>Adversaire 1</TableHead>
                    <TableHead>Adversaire 2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{result.center}</TableCell>
                      <TableCell>{result.bureau}</TableCell>
                      <TableCell>{result.inscrits}</TableCell>
                      <TableCell>{result.votants}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        {result.notreCandidat}
                      </TableCell>
                      <TableCell>{result.adversaire1}</TableCell>
                      <TableCell>{result.adversaire2}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section de simulation */}
      {selectedElection && (
        <div className="mt-6">
          <SimulationResultsSection electionId={selectedElection} />
        </div>
      )}
    </div>
  );
};

export default PublishSection;
