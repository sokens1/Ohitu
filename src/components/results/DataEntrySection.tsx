import React, { useState, useEffect, useCallback } from 'react';
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
  Plus
} from 'lucide-react';
import PVEntrySection from './PVEntrySection';
import { toast } from 'sonner';

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
}

const DataEntrySection: React.FC<DataEntrySectionProps> = ({ stats, selectedElection, readOnly = false }) => {
  const [expandedCenters, setExpandedCenters] = useState<string[]>([]);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [showPVEntry, setShowPVEntry] = useState(false);
  const [votingCenters, setVotingCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVotingCenters = useCallback(async () => {
    if (!selectedElection) return;
      try {
        setLoading(true);

        // Étape 1 : récupérer les centre_ids liés à cette élection
        const { data: ecRows, error: ecError } = await supabase
          .from('election_centers')
          .select('center_id')
          .eq('election_id', selectedElection);

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

        // Étape 2 : requêtes indépendantes en parallèle
        const [usersResult, bureauxResult, centersResult] = await Promise.all([
          supabase.from('users').select('id, name'),
          supabase
            .from('voting_bureaux')
            .select('id, name, center_id, registered_voters, college_type, election_id, college, seats_to_fill')
            .in('center_id', centerIds),
          supabase
            .from('voting_centers')
            .select('id, name, address')
            .in('id', centerIds)
            .order('name', { ascending: true }),
        ]);

        const usersMap = new Map((usersResult.data || []).map((u: any) => [u.id, u.name]));
        const bureauxData = bureauxResult.data;
        const { data, error } = centersResult;

        if (error) {
          console.error('Erreur lors du chargement des centres de vote:', error);
          return;
        }

        // Étape 3 : récupérer les PV (nécessite les bureau_ids de l'étape 2)
        const allBureauIds = (bureauxData || []).map((b: any) => b.id);
        const pvMap = new Map<string, any>();
        if (allBureauIds.length > 0) {
          const { data: pvRows } = await supabase
            .from('procès_verbaux')
            .select('id, bureau_id, status, entered_by, entered_at, anomalies, college_type')
            .eq('election_id', selectedElection)
            .in('bureau_id', allBureauIds);
          (pvRows || []).forEach((pv: any) => pvMap.set(pv.bureau_id, pv));
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
          (b.college != null && (b.seats_to_fill ?? 0) > 0);

        // Transformer les données
        const transformedCenters = data?.map(center => {
          const allCenterBureaux = (bureauxData || []).filter((b: any) =>
            b.center_id === center.id &&
            (b.election_id === selectedElection || String(b.election_id) === String(selectedElection))
          );
          const physicalBureaux = allCenterBureaux.filter((b: any) => !isCollegeEntry(b));
          const collegeBureaux = allCenterBureaux.filter((b: any) => isCollegeEntry(b));
          // Pour les élections pro : les PV sont sur les pseudo-entrées collège → priorité sur les bureaux physiques
          const centerBureaux = collegeBureaux.length > 0 ? collegeBureaux : physicalBureaux;
          const isProCenter = collegeBureaux.length > 0;

          const bureaux = centerBureaux.map((bureau: any) => {
            const pv = pvMap.get(bureau.id);
            return {
              id: bureau.id.toString(),
              name: bureau.name,
              college_type: toRawKey(bureau.college_type ?? bureau.college) ?? null,
              college_key: toRawKey(bureau.college ?? bureau.college_type) ?? null,
              registered_voters: bureau.registered_voters ?? 0,
              status: pv?.status || 'pending',
              isCollege: isProCenter,
              agent: pv?.entered_by ? (usersMap.get(pv.entered_by) || pv.entered_by) : '',
              time: pv?.entered_at ? new Date(pv.entered_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
              }) : '',
              dateStr: pv?.entered_at ? new Date(pv.entered_at).toLocaleDateString('fr-FR') : '',
              anomaly: pv?.anomalies || null,
            };
          }) || [];

          const bureauxSaisis = bureaux.filter((b: any) => 
            b.status === 'entered' || b.status === 'validated' || b.status === 'anomaly' || b.status === 'published'
          ).length;

          return {
            id: center.id.toString(),
            name: center.name,
            totalBureaux: bureaux.length,
            bureauxSaisis,
            status: bureaux.length > 0 && bureauxSaisis === bureaux.length ? 'completed' :
                   bureauxSaisis > 0 ? 'in-progress' : 'pending',
            bureaux
          };
        }) || [];

        setVotingCenters(transformedCenters);
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
        return <Badge className="bg-red-100 text-red-800 border-red-200">🚩 Anomalie</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">En attente de saisie</Badge>;
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

  const filteredCenters = showAnomaliesOnly 
    ? votingCenters.filter(center => 
        center.bureaux.some(bureau => bureau.status === 'anomaly')
      )
    : votingCenters;

  if (showPVEntry) {
    return <PVEntrySection onClose={() => setShowPVEntry(false)} selectedElection={selectedElection} readOnly={readOnly} />;
  }

  return (
    <div className="space-y-6">
      {/* Bouton d'action principal */}
      {!readOnly && (
        <div className="flex justify-end">
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

      {/* KPIs retirés sur demande */}

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
                        {center.name} ({center.bureauxSaisis} / {center.totalBureaux} saisis)
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {center.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">✔️ Terminé</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">⏳ En cours</Badge>
                        )}
                        <Progress 
                          value={(center.bureauxSaisis / center.totalBureaux) * 100} 
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
                        .map((bureau) => (
                        <div
                          key={bureau.id}
                          className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                            (bureau.isCollege
                              ? ['entered', 'validated', 'published', 'anomaly'].includes(bureau.status)
                              : bureau.status === 'entered' || bureau.status === 'saisi')
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            if (bureau.isCollege) {
                              if (['entered', 'validated', 'published', 'anomaly'].includes(bureau.status)) {
                                toast.warning('Ce collège a déjà été saisi. Utilisez l\'onglet "Valider les résultats" pour le modifier.', {
                                  duration: 4000,
                                  position: 'bottom-center'
                                });
                                return;
                              }
                              setShowPVEntry(true);
                              try {
                                localStorage.setItem('pv_prefill_center_id', center.id);
                                localStorage.setItem('pv_prefill_college_type', bureau.college_key || bureau.college_type || '');
                              } catch {}
                              return;
                            }
                            // Vérifier si le bureau est déjà saisi
                            if (bureau.status === 'entered' || bureau.status === 'saisi') {
                              toast.warning('Ce bureau a déjà été saisi. Utilisez l\'onglet "Valider les résultats" pour le modifier.', {
                                duration: 4000,
                                position: 'bottom-center'
                              });
                              return;
                            }

                            setShowPVEntry(true);
                            // pré-remplir via stockage local minimal
                            try {
                              localStorage.setItem('pv_prefill_center_id', center.id);
                              localStorage.setItem('pv_prefill_center_name', center.name);
                              localStorage.setItem('pv_prefill_bureau_id', bureau.id);
                              localStorage.setItem('pv_prefill_bureau_name', bureau.name);
                            } catch {}
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(bureau.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{bureau.name}</span>
                                {bureau.college_type && !bureau.isCollege && (
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
                          {getStatusBadge(bureau.status)}
                        </div>
                      ))}
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
