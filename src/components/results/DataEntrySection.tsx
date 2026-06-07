import React, { useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  MapPin,
  TrendingUp,
  Users,
  Flag,
  Plus,
  Search,
  Download,
  Upload,
} from 'lucide-react';
import PVEntrySection from './PVEntrySection';
import { toast } from 'sonner';
import { importPVsFromExcel } from '@/utils/pvExcelImport';

// Retry automatique sur erreurs réseau (ERR_CONNECTION_RESET, ERR_HTTP2_PING_FAILED)
async function sbQuery<T>(
  fn: () => PromiseLike<{ data: T | null; error: any }>,
  retries = 3
): Promise<{ data: T | null; error: any }> {
  let lastResult: { data: T | null; error: any } = { data: null, error: null };
  for (let i = 0; i <= retries; i++) {
    try {
      lastResult = await fn() as { data: T | null; error: any };
      if (!lastResult.error) return lastResult;
      const msg = String(lastResult.error?.message || lastResult.error?.toString() || '').toLowerCase();
      const isNetwork = msg.includes('connection') || msg.includes('network') || msg.includes('ping') || msg.includes('failed to fetch') || msg.includes('reset') || msg.includes('ssl');
      if (!isNetwork || i === retries) return lastResult;
    } catch (err: any) {
      lastResult = { data: null, error: err };
      if (i === retries) return lastResult;
    }
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return lastResult;
}

interface DataEntrySectionProps {
  stats: {
    tauxSaisie: number;
    bureauxSaisis: number;
    totalBureaux: number;
    voixNotreCanidat: number;
    ecartDeuxieme: number;
    anomaliesDetectees: number;
  };
  selectedElection: string;
  readOnly?: boolean;
  refreshKey?: number;
}

const DataEntrySection: React.FC<DataEntrySectionProps> = ({ stats, selectedElection, readOnly = false, refreshKey }) => {
  const [expandedCenters, setExpandedCenters] = useState<string[]>([]);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [filterCenters, setFilterCenters] = useState<{ id: string; name: string }[]>([]);
  const [showPVEntry, setShowPVEntry] = useState(false);
  const [pvPrefill, setPvPrefill] = useState<{ centreId: string; bureauId: string; collegeType: string | null } | null>(null);
  const [votingCenters, setVotingCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [electionType, setElectionType] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ phase: string; current: number; total: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fetchVotingCenters = useCallback(async () => {
    if (!selectedElection) return;
      try {
        setLoading(true);

        // Charger le type de l'élection pour l'import Excel
        supabase.from('elections').select('type').eq('id', selectedElection).single()
          .then(({ data }) => setElectionType(data?.type ?? null));

        // Étape 1 : récupérer les centre_ids liés à cette élection
        const { data: ecRows, error: ecError } = await sbQuery<{ center_id: string }[]>(() =>
          supabase.from('election_centers').select('center_id').eq('election_id', selectedElection)
        );

        if (ecError) {
          console.error('Erreur lors du chargement de election_centers:', ecError);
          setVotingCenters([]);
          return;
        }

        const centerIds = (ecRows || []).map((r: any) => r.center_id).filter(Boolean);

        if (centerIds.length === 0) {
          setVotingCenters([]);
          return;
        }

        // Étape 2 : requêtes indépendantes — sérialisées pour éviter ERR_HTTP2_PING_FAILED
        const usersResult = await sbQuery<any[]>(() => supabase.from('users').select('id, name'));
        const bureauxResult = await sbQuery<any[]>(() =>
          supabase.from('voting_bureaux')
            .select('id, name, center_id, registered_voters, college_type, election_id, college, seats_to_fill')
            .in('center_id', centerIds)
        );
        const centersResult = await sbQuery<any[]>(() =>
          supabase.from('voting_centers')
            .select('id, name, address')
            .in('id', centerIds)
            .order('name', { ascending: true })
        );

        const usersMap = new Map((usersResult.data || []).map((u: any) => [u.id, u.name]));
        const bureauxData = bureauxResult.data;
        const { data, error } = centersResult;

        if (error) {
          console.error('Erreur lors du chargement des centres de vote:', error);
          return;
        }

        // Normalise n'importe quelle valeur collège vers la clé brute DB
        const toRawKey = (val: string | null | undefined): string | null => {
          if (!val) return null;
          const v = val.toLowerCase();
          if (v === 'general' || v === 'encadrement') return 'general';
          if (v === 'cadres' || v === 'cadre') return 'cadres';
          if (v === 'employes' || v === 'maîtrise' || v === 'maitrise') return 'employes';
          if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
          return val;
        };

        // Prédicat : pseudo-entrée collège
        const isCollegeEntry = (b: any) =>
          b.name?.startsWith?.('College -') ||
          (b.college != null && b.college !== 'general');

        // Étape 3 : récupérer les PV pour tous les bureaux (physiques ET pseudo-entrées)
        const allBureauIds = (bureauxData || []).map((b: any) => String(b.id));
        // pvMap  : bureauId (string) → PV
        const pvMap = new Map<string, any>();
        // pvByCollegeType : "${centerId}_${rawCollegeType}" → PV  (rétro-compat PV saisis via pseudo-entrée)
        const pvByCollegeType = new Map<string, any>();
        if (allBureauIds.length > 0) {
          const { data: pvRows } = await sbQuery<any[]>(() =>
            supabase.from('procès_verbaux')
              .select('id, bureau_id, status, entered_by, entered_at, anomalies, college_type')
              .eq('election_id', selectedElection)
              .in('bureau_id', allBureauIds)
          );
          (pvRows || []).forEach((pv: any) => {
            const bureauIdStr = String(pv.bureau_id);
            pvMap.set(bureauIdStr, pv);
            // Indexer aussi par centreId + college_type pour retrouver via bureau physique
            const srcBureau = (bureauxData || []).find((b: any) => String(b.id) === bureauIdStr);
            if (srcBureau) {
              const ct = toRawKey(pv.college_type || srcBureau.college_type || srcBureau.college);
              if (ct) pvByCollegeType.set(`${String(srcBureau.center_id)}_${ct}`, pv);
            }
          });
        }

        // Transformer les données
        const transformedCenters = data?.map(center => {
          const centerId = String(center.id);
          const allCenterBureaux = (bureauxData || []).filter((b: any) =>
            String(b.center_id) === centerId &&
            (!b.election_id || String(b.election_id) === String(selectedElection))
          );
          const physicalBureaux = allCenterBureaux.filter((b: any) => !isCollegeEntry(b));
          const collegeBureaux  = allCenterBureaux.filter((b: any) =>  isCollegeEntry(b));
          // Toujours afficher les vrais bureaux physiques ; pseudo-entrées en fallback si aucun physique
          const centerBureaux = physicalBureaux.length > 0 ? physicalBureaux : collegeBureaux;

          // Fallback centre : si TOUTES les pseudo-entrées collège ont un PV SAISI → bureaux physiques héritent du statut
          // On exclut les PVs en statut "pending" (réinitialisés) pour qu'ils redeviennent éditables
          const doneStatuses = ['entered', 'saisi', 'validated', 'validé', 'anomaly', 'published'];
          const allCollegePvs = collegeBureaux.map((cb: any) => {
            const cbKey = toRawKey(cb.college_type || cb.college);
            const pv = pvMap.get(String(cb.id)) || (cbKey ? pvByCollegeType.get(`${centerId}_${cbKey}`) : null);
            return pv && doneStatuses.includes(pv.status) ? pv : null;
          }).filter(Boolean);
          const allCollegesSubmitted = collegeBureaux.length > 0 && allCollegePvs.length === collegeBureaux.length;
          const centreRepresentativePv = allCollegesSubmitted ? allCollegePvs[0] : null;

          const bureaux = centerBureaux.map((bureau: any) => {
            const bureauIdStr = String(bureau.id);
            const bureauCt = toRawKey(bureau.college_type || bureau.college);
            const directPv = pvMap.get(bureauIdStr);
            const isPartialPhysicalCollegePv = directPv && !isCollegeEntry(bureau) && directPv.college_type && collegeBureaux.length > 0;
            // Ordre de priorité :
            // 1. PV direct complet (bureau physique saisi complètement)
            // 2. PV par centreId+collegeType (PV saisi via pseudo-entrée ancienne UI)
            // 3. Fallback centre : tous les collèges saisis → bureau physique considéré saisi
            const pv = (!isPartialPhysicalCollegePv ? directPv : null)
              || (isCollegeEntry(bureau) && bureauCt ? pvByCollegeType.get(`${centerId}_${bureauCt}`) : null)
              || (!isCollegeEntry(bureau) ? centreRepresentativePv : null);
            return {
              id: bureau.id.toString(),
              name: bureau.name,
              college_type: toRawKey(bureau.college_type ?? bureau.college) ?? null,
              college_key: toRawKey(bureau.college ?? bureau.college_type) ?? null,
              registered_voters: bureau.registered_voters ?? 0,
              status: pv?.status || 'pending',
              isCollege: isCollegeEntry(bureau),
              agent: pv?.entered_by ? (usersMap.get(pv.entered_by) || pv.entered_by) : '',
              time: pv?.entered_at ? new Date(pv.entered_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
              }) : '',
              dateStr: pv?.entered_at ? new Date(pv.entered_at).toLocaleDateString('fr-FR') : '',
              anomaly: pv?.anomalies || null,
            };
          }) || [];

          const enteredStatuses = ['entered', 'saisi', 'validated', 'validé', 'anomaly', 'published'];
          const electorsEntered = bureaux.reduce((sum: number, b: any) => {
            const entered = enteredStatuses.includes(b.status);
            return sum + (entered ? Number(b.registered_voters || 0) : 0);
          }, 0);
          const totalElectors = bureaux.reduce((sum: number, b: any) => sum + Number(b.registered_voters || 0), 0);
          const bureauxSaisis = bureaux.filter((b: any) => enteredStatuses.includes(b.status)).length;

          // Pour les élections professionnelles : compter les PVs par collège, pas les bureaux physiques
          const totalCollegePVs = collegeBureaux.length;
          const collegePvsSaisis = collegeBureaux.filter((cb: any) => {
            const cbKey = toRawKey(cb.college_type || cb.college);
            const pv = pvMap.get(String(cb.id)) || (cbKey ? pvByCollegeType.get(`${centerId}_${cbKey}`) : null);
            return pv && doneStatuses.includes(pv.status);
          }).length;

          return {
            id: center.id.toString(),
            name: center.name,
            totalBureaux: bureaux.length,
            totalCollegePVs,
            collegePvsSaisis,
            bureauxSaisis,
            electorsEntered,
            totalElectors,
            status: bureaux.length > 0 && bureauxSaisis === bureaux.length ? 'completed' :
                   bureauxSaisis > 0 ? 'in-progress' : 'pending',
            bureaux
          };
        }) || [];

        setVotingCenters(transformedCenters);
        setFilterCenters((data || []).map((c: any) => ({ id: String(c.id), name: c.name })));
      } catch (error) {
        console.error('Erreur lors du chargement des centres de vote:', error);
      } finally {
        setLoading(false);
      }
  }, [selectedElection]);

  // Charger initialement et à chaque changement d'élection
  useEffect(() => {
    fetchVotingCenters();
  }, [fetchVotingCenters]);

  // Rafraîchir après fermeture de la saisie PV
  useEffect(() => {
    if (!showPVEntry) {
      fetchVotingCenters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPVEntry]);

  // Rafraîchir quand le parent signale une réinitialisation externe (ex: reset PV)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchVotingCenters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleImportExcel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElection) return;
    e.target.value = '';
    setImporting(true);
    setImportProgress({ phase: 'Préparation…', current: 0, total: 1 });
    try {
      const result = await importPVsFromExcel(
        file,
        selectedElection,
        electionType,
        (phase, current, total) => setImportProgress({ phase, current, total })
      );
      setImportProgress(null);
      const parts: string[] = [];
      if (result.created > 0) parts.push(`${result.created} PV créé(s)`);
      if (result.updated > 0) parts.push(`${result.updated} mis à jour`);
      if (result.skipped > 0) parts.push(`${result.skipped} ignoré(s)`);
      if (parts.length > 0) toast.success(`Import réussi : ${parts.join(', ')}.`);
      if (result.errors.length > 0) {
        result.errors.slice(0, 5).forEach(err => toast.error(err));
        if (result.errors.length > 5) toast.error(`… et ${result.errors.length - 5} autre(s) erreur(s).`);
      }
      if (result.created > 0 || result.updated > 0) fetchVotingCenters();
    } catch (err: any) {
      setImportProgress(null);
      toast.error(`Erreur import : ${err?.message ?? 'inconnue'}`);
    } finally {
      setImporting(false);
    }
  }, [selectedElection, electionType, fetchVotingCenters]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-4 h-4 text-purple-600" />;
      case 'validé':
      case 'validated':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'saisi':
      case 'entered':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'anomaly':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'en_attente':
      case 'pending':
      case 'en_cours':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">🌐 Publié</Badge>;
      case 'validated':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Validé</Badge>;
      case 'entered':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Saisi</Badge>;
      case 'anomaly':
        return <Badge className="bg-red-100 text-red-800 border-red-200">🚩 Rejeté</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">En attente de saisie</Badge>;
      case 'en_cours':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Re-saisie en cours</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">En attente</Badge>;
    }
  };

  const getCenterStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const toggleCenter = (centerId: string) => {
    setExpandedCenters(prev =>
      prev.includes(centerId)
        ? prev.filter(id => id !== centerId)
        : [...prev, centerId]
    );
  };

  const filteredCenters = (() => {
    let result: typeof votingCenters = showAnomaliesOnly
      ? votingCenters.filter(center => center.bureaux.some((b: any) => b.status === 'anomaly'))
      : [...votingCenters];
    if (centerFilter) result = result.filter(c => c.id === centerFilter);
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.bureaux.some((b: any) => b.name.toLowerCase().includes(q))
      );
    }
    return result;
  })();

  const handleCloseBureau = async (bureau: any, center: any) => {
    if (!window.confirm(`Clôturer le bureau "${bureau.name}" avec 0 votant ?`)) return;
    try {
      const pvBase = {
        election_id: selectedElection,
        bureau_id: bureau.id,
        total_registered: 0,
        total_voters: 0,
        null_votes: 0,
        votes_expressed: 0,
        status: 'entered',
        entered_at: new Date().toISOString(),
        college_type: bureau.college_type || null,
      };
      const { data: existing } = await supabase
        .from('procès_verbaux')
        .select('id')
        .eq('election_id', selectedElection)
        .eq('bureau_id', bureau.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('procès_verbaux').update(pvBase).eq('id', existing.id);
      } else {
        await supabase.from('procès_verbaux').insert(pvBase);
      }
      toast.success(`Bureau "${bureau.name}" clôturé avec 0 votant.`);
      fetchVotingCenters();
    } catch {
      toast.error('Erreur lors de la clôture du bureau.');
    }
  };

  if (showPVEntry) {
    return (
      <PVEntrySection
        onClose={() => { setShowPVEntry(false); setPvPrefill(null); }}
        selectedElection={selectedElection}
        readOnly={readOnly}
        prefill={pvPrefill}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Boutons d'action */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Télécharger le modèle Excel */}
          <a href="/modele_saisie_pv.xlsx" download>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              Modèle Excel
            </Button>
          </a>

          {/* Importer un fichier rempli */}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Import en cours…' : 'Importer résultats'}
          </Button>

          {/* Saisie manuelle */}
          <Button
            onClick={() => setShowPVEntry(true)}
            size="lg"
            className="bg-gov-blue hover:bg-gov-blue-dark text-white px-8 py-3"
          >
            <Plus className="w-5 h-5 mr-2" />
            Saisir un PV
          </Button>
        </div>
      )}

      {/* Barre de progression import Excel */}
      {importing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 font-medium">
              {importProgress?.phase ?? 'Import en cours…'}
            </span>
            {importProgress && importProgress.total > 1 && (
              <span className="text-blue-500 text-xs">
                {importProgress.current} / {importProgress.total}
              </span>
            )}
          </div>
          <Progress
            value={importProgress && importProgress.total > 0
              ? Math.round((importProgress.current / importProgress.total) * 100)
              : 5}
            className="h-2 bg-blue-100"
          />
        </div>
      )}

      {/* Barre de filtre locale */}
      {filterCenters.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un bureau, un établissement…"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-400 outline-none transition-colors"
            />
          </div>
          <select
            value={centerFilter}
            onChange={e => setCenterFilter(e.target.value)}
            className="h-9 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 focus:border-blue-400 outline-none"
          >
            <option value="">Tous les établissements</option>
            {filterCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(searchFilter || centerFilter) && (
            <button onClick={() => { setSearchFilter(''); setCenterFilter(''); }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">
              Effacer
            </button>
          )}
        </div>
      )}

      {/* Vue hiérarchique */}
      <Card className="gov-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gov-gray">
            <MapPin className="w-5 h-5" />
            <span>Avancement par Centre de Vote</span>
            {showAnomaliesOnly && (
              <Badge className="bg-red-100 text-red-800">Anomalies uniquement</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement des centres de vote...</p>
              </div>
            </div>
          ) : filteredCenters.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun centre de vote trouvé
              </h3>
              <p className="text-gray-600">
                {showAnomaliesOnly 
                  ? 'Aucune anomalie détectée pour le moment.'
                  : 'Aucun centre de vote configuré pour cette élection.'}
              </p>
            </div>
          ) : (
          <div className="space-y-4">
            {filteredCenters.map((center) => (
              <div key={center.id} className="border border-gray-200 rounded-lg">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleCenter(center.id)}
                >
                  <div className="flex items-center space-x-3">
                    {getCenterStatusIcon(center.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {center.name}{' '}
                        {center.totalCollegePVs > 0
                          ? `(${center.collegePvsSaisis} / ${center.totalCollegePVs} PV${center.totalCollegePVs > 1 ? 's' : ''} joint${center.totalCollegePVs > 1 ? 's' : ''})`
                          : center.totalElectors > 0
                            ? `(${center.electorsEntered.toLocaleString()} / ${center.totalElectors.toLocaleString()} électeurs saisis)`
                            : `(${center.bureauxSaisis} / ${center.totalBureaux} bureaux saisis)`}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {center.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">✔️ Terminé</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">⏳ En cours</Badge>
                        )}
                        <Progress
                          value={center.totalCollegePVs > 0
                            ? (center.collegePvsSaisis / center.totalCollegePVs) * 100
                            : center.totalElectors > 0
                              ? (center.electorsEntered / center.totalElectors) * 100
                              : center.totalBureaux > 0 ? (center.bureauxSaisis / center.totalBureaux) * 100 : 0
                          }
                          className="w-32 h-2"
                        />
                      </div>
                    </div>
                  </div>
                  {expandedCenters.includes(center.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Détails des bureaux */}
                {expandedCenters.includes(center.id) && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {center.bureaux
                        .filter(bureau => !showAnomaliesOnly || bureau.status === 'anomaly')
                        .map((bureau) => {
                          const alreadyEntered = ['entered', 'validated', 'published', 'anomaly'].includes(bureau.status);
                          const canClose = !readOnly && center.totalBureaux > 1 && bureau.status === 'pending';
                          return (
                          <div
                            key={bureau.id}
                            className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                              alreadyEntered
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              if (alreadyEntered) {
                                toast.warning('Ce bureau a déjà été saisi. Utilisez l\'onglet "Valider les résultats" pour le modifier.', {
                                  duration: 4000,
                                  position: 'bottom-center'
                                });
                                return;
                              }
                              setPvPrefill({
                                centreId: center.id,
                                bureauId: bureau.id,
                                collegeType: bureau.college_type || null,
                              });
                              setShowPVEntry(true);
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              {getStatusIcon(bureau.status)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{bureau.name}</span>
                                  {bureau.college_type && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                      bureau.college_type === 'cadres'   ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                      bureau.college_type === 'employes' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      bureau.college_type === 'ouvriers' ? 'bg-green-50 text-green-700 border-green-200' :
                                      bureau.college_type === 'general'  ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                      'bg-gray-50 text-gray-600 border-gray-200'
                                    }`}>
                                      {bureau.college_type === 'cadres'   ? 'Cadres' :
                                       bureau.college_type === 'employes' ? 'Maîtrise' :
                                       bureau.college_type === 'ouvriers' ? 'Exécution' :
                                       bureau.college_type === 'general'  ? 'Encadrement' : bureau.college_type}
                                    </span>
                                  )}
                                </div>
                                {bureau.agent && (
                                  <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                                    <User className="w-3 h-3" />
                                    <span>Saisi par <strong>{bureau.agent}</strong> le {bureau.dateStr} à {bureau.time}</span>
                                  </div>
                                )}
                                {bureau.anomaly && (
                                  <div className="text-xs text-red-600 mt-1">{bureau.anomaly}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              {canClose && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs text-gray-500 border-gray-300 hover:bg-gray-100 h-7 px-2"
                                  onClick={() => handleCloseBureau(bureau, center)}
                                >
                                  Clôturer ce bureau
                                </Button>
                              )}
                              {getStatusBadge(bureau.status)}
                            </div>
                          </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataEntrySection;
