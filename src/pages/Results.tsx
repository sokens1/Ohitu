import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileCheck, Upload, Lock } from 'lucide-react';
import DataEntrySection from '@/components/results/DataEntrySection';
import PVValidationSection from '@/components/results/PVValidationSection';
import PublishSection from '@/components/results/PublishSection';
import { useRBAC } from '@/hooks/useRBAC';
import { getElectionElectorsTotal } from '@/utils/electionCalculations';

// ─── Types internes ───────────────────────────────────────────────────────────
interface ElectionOption { id: string; name: string; }

interface GlobalStats {
  tauxSaisie: number;
  bureauxSaisis: number;
  totalBureaux: number;
  voixNotreCanidat: number;
  ecartDeuxieme: number;
  anomaliesDetectees: number;
  pvsEnAttente: number;
}

// ─── Définition des onglets disponibles par permission ───────────────────────
const TAB_DEFS = [
  { value: 'entry',      icon: FileText,  label: 'Saisir les résultats',   labelShort: 'Saisir',  permission: 'results:entry'    as const },
  { value: 'validation', icon: FileCheck, label: 'Valider les résultats',  labelShort: 'Valider', permission: 'results:validate' as const },
  { value: 'publish',    icon: Upload,    label: 'Publier les résultats',   labelShort: 'Publier', permission: 'results:publish'  as const },
];

// ─── Composant ────────────────────────────────────────────────────────────────
const Results = () => {
  const { can, assignedElectionId, assignedElectionIds, role, isGlobalAdmin } = useRBAC();
  const hasMultipleElections = assignedElectionIds.length > 1;

  const allowedTabs = TAB_DEFS.filter(t => can(t.permission));

  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('results_active_tab') || '';
    return allowedTabs.some(t => t.value === saved) ? saved : (allowedTabs[0]?.value ?? 'entry');
  });

  const [selectedElection, setSelectedElection] = useState<string>(
    () => assignedElectionId ?? localStorage.getItem('results_selected_election') ?? ''
  );
  const [availableElections, setAvailableElections] = useState<ElectionOption[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    tauxSaisie: 0, bureauxSaisis: 0, totalBureaux: 0,
    voixNotreCanidat: 0, ecartDeuxieme: 0, anomaliesDetectees: 0, pvsEnAttente: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  // ── Chargement des élections ───────────────────────────────────────────────
  // Règle : seul le super-admin voit toutes les élections.
  // Tous les autres rôles ne voient QUE l'élection qui leur est assignée.
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);

        // Non super-admin sans élection assignée → aucune élection accessible
        if (!isGlobalAdmin && assignedElectionIds.length === 0) {
          setAvailableElections([]);
          setSelectedElection('');
          return;
        }

        let query = supabase.from('elections').select('id, title').order('election_date', { ascending: false });

        // Tout rôle non super-admin : restreindre aux élections assignées
        if (!isGlobalAdmin && assignedElectionIds.length > 0) {
          query = assignedElectionIds.length === 1
            ? query.eq('id', assignedElectionIds[0])
            : query.in('id', assignedElectionIds);
        }

        const { data, error } = await query;
        if (error) { console.error('Erreur chargement élections:', error); return; }

        const elections: ElectionOption[] = (data ?? []).map(
          (e: { id: string; title: string }) => ({ id: e.id.toString(), name: e.title })
        );
        setAvailableElections(elections);

        if (assignedElectionIds.length === 1) {
          setSelectedElection(assignedElectionIds[0]);
        } else if (!localStorage.getItem('results_selected_election') && elections.length > 0) {
          setSelectedElection(elections[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchElections();
  }, [assignedElectionId]);

  // ── Persistence localStorage (super-admin uniquement) ─────────────────────
  useEffect(() => {
    if (isGlobalAdmin && selectedElection) {
      localStorage.setItem('results_selected_election', selectedElection);
    }
  }, [selectedElection, isGlobalAdmin]);

  useEffect(() => {
    localStorage.setItem('results_active_tab', activeTab);
  }, [activeTab]);

  // ── Statistiques globales ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedElection) return;

    const fetchGlobalStats = async () => {
      // Récupérer PVs avec champs utiles
      const { data: pvData } = await supabase
        .from('procès_verbaux')
        .select('id, status, bureau_id, total_voters, college_type')
        .eq('election_id', selectedElection);

      // Total électeurs élection (dénominateur)
      const totalElectors = await getElectionElectorsTotal(selectedElection);

      // Statuts considérés comme saisis
      const enteredStatuses = ['entered','saisi','validated','validé'];

      // Calculer électeurs saisis : priorité pv.total_voters, fallback sera calculé plus bas
      const pvs = pvData || [];
      let electorsEntered = 0;
      let bureauxSaisis = 0;
      for (const pv of pvs) {
        if (enteredStatuses.includes(String(pv.status))) {
          bureauxSaisis += 1;
          const tv = Number(pv.total_voters) || 0;
          electorsEntered += tv;
        }
      }

      // Si aucun total_voters présent sur PVs, essayer d'utiliser registered_voters depuis voting_bureaux
      if (electorsEntered === 0 && pvs.length > 0) {
        const bureauIds = pvs.map((pv: any) => String(pv.bureau_id)).filter(Boolean);
        if (bureauIds.length > 0) {
          const { data: bureaux } = await supabase
            .from('voting_bureaux')
            .select('id, registered_voters')
            .in('id', bureauIds);
          const bureauxMap = new Map((bureaux || []).map((b: any) => [String(b.id), Number(b.registered_voters) || 0]));
          electorsEntered = 0;
          bureauxSaisis = 0;
          for (const pv of pvs) {
            if (enteredStatuses.includes(String(pv.status))) {
              const bid = String(pv.bureau_id);
              const rv = (bureauxMap.get(bid) as number) || 0;
              electorsEntered += rv;
              bureauxSaisis += 1;
            }
          }
        }
      }

      const tauxSaisie = totalElectors > 0 ? Math.round((electorsEntered / totalElectors) * 100) : 0;

      // Voix/candidate stats unchanged
      const { data: ecData } = await supabase
        .from('election_candidates')
        .select('candidate_id')
        .eq('election_id', selectedElection);

      const candidateIds = (ecData ?? []).map((ec: { candidate_id: string }) => ec.candidate_id);
      let voixNotreCanidat = 0;
      let ecartDeuxieme    = 0;

      if (candidateIds.length > 0) {
        const { data: results } = await supabase
          .from('candidate_results')
          .select('votes')
          .in('candidate_id', candidateIds)
          .order('votes', { ascending: false });

        if (results && results.length > 0) {
          voixNotreCanidat = results[0].votes ?? 0;
          ecartDeuxieme    = results.length > 1 ? voixNotreCanidat - (results[1].votes ?? 0) : 0;
        }
      }

      setGlobalStats({ tauxSaisie, bureauxSaisis, totalBureaux: totalElectors, voixNotreCanidat, ecartDeuxieme, anomaliesDetectees: 0, pvsEnAttente: pvs.filter((pv: any) => pv.status === 'en_attente').length || 0 });
    };

    fetchGlobalStats();
  }, [selectedElection]);

  // ── Permissions par section ────────────────────────────────────────────────
  // readOnly sur la validation : observateur peut voir mais pas agir
  const validationReadOnly = role === 'observateur';
  // readOnly sur la saisie : seuls super-admin, admin et agent-saisie peuvent soumettre
  const entryReadOnly = !can('results:submit');
  // readOnly sur la publication : seuls admin et super-admin peuvent publier
  const publishReadOnly = !can('results:publish');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006400] mx-auto mb-4" />
            <p className="text-gray-600">Chargement des résultats...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Cas : non super-admin sans élection assignée
  if (!isGlobalAdmin && !assignedElectionId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Lock className="h-12 w-12 text-gray-300" />
          <div className="text-center">
            <p className="font-semibold text-gray-700">Aucune élection assignée</p>
            <p className="text-sm text-gray-500 mt-1">
              Votre compte n'est rattaché à aucune élection. Contactez votre administrateur.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* En-tête */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gov-gray">Résultats</h1>

          {/* Sélecteur / indicateur d'élection */}
          <Card className="gov-card bg-blue-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Élection active :
                </label>

                {/* Sélecteur selon le rôle :
                    - super-admin : toutes les élections (libre)
                    - rôle avec 1 élection : verrouillé
                    - rôle avec plusieurs élections : sélecteur restreint */}
                {!isGlobalAdmin && !hasMultipleElections ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-800 w-full sm:w-80">
                    <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      {availableElections.find(e => e.id === selectedElection)?.name ?? 'Chargement…'}
                    </span>
                  </div>
                ) : (
                  <Select value={selectedElection} onValueChange={setSelectedElection}>
                    <SelectTrigger className="w-full sm:w-80 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableElections.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Onglets — seuls ceux autorisés sont affichés */}
        <Card className="gov-card">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b overflow-x-auto">
                <TabsList
                  className={`grid w-full bg-transparent h-auto p-0`}
                  style={{ gridTemplateColumns: `repeat(${allowedTabs.length}, 1fr)` }}
                >
                  {allowedTabs.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center justify-center space-x-1 sm:space-x-2 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 text-xs sm:text-sm"
                    >
                      <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.labelShort}</span>
                      {tab.value === 'validation' && globalStats.pvsEnAttente > 0 && (
                        <Badge className="bg-red-500 text-white text-xs ml-1">
                          {globalStats.pvsEnAttente}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-3 sm:p-4 lg:p-6">
                <TabsContent value="entry" className="space-y-6 mt-0">
                  <DataEntrySection stats={globalStats} selectedElection={selectedElection} readOnly={entryReadOnly} refreshKey={dataRefreshKey} />
                </TabsContent>

                <TabsContent value="validation" className="space-y-6 mt-0">
                  <PVValidationSection selectedElection={selectedElection} readOnly={validationReadOnly} onDataRefresh={() => setDataRefreshKey(k => k + 1)} />
                </TabsContent>

                <TabsContent value="publish" className="space-y-6 mt-0">
                  <PublishSection selectedElection={selectedElection} readOnly={publishReadOnly} />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Results;
