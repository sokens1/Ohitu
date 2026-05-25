/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  RotateCcw,
  PenLine
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { resolveCandidatesForElection, isProfessionalElection } from '@/lib/candidateUtils';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/contexts/AuthContext';

// ── Composant Timeline circuit de validation ──────────────────────────────────
interface PVTimelineProps {
  pv: {
    status: string;
    entered_by?: string;
    entered_at_str?: string;
    validated_by?: string;
    validated_at_str?: string;
    observer_name?: string | null;
    observer_annotation?: string | null;
    observer_conformity?: 'conforme' | 'non_conforme' | null;
    observer_annotated_at_str?: string;
  };
}

const STEP_COLORS = {
  done:    { dot: 'bg-[#1B2E5A] border-[#1B2E5A]', line: 'bg-[#1B2E5A]', text: 'text-[#1B2E5A]' },
  active:  { dot: 'bg-amber-500 border-amber-500',  line: 'bg-gray-200',  text: 'text-amber-600'  },
  pending: { dot: 'bg-white border-gray-300',        line: 'bg-gray-200',  text: 'text-gray-400'  },
  error:   { dot: 'bg-red-500 border-red-500',       line: 'bg-gray-200',  text: 'text-red-600'   },
  info:    { dot: 'bg-purple-500 border-purple-500', line: 'bg-gray-200',  text: 'text-purple-700'},
};

const PVTimeline: React.FC<PVTimelineProps> = ({ pv }) => {
  const entryDone = ['entered', 'validated', 'published', 'anomaly'].includes(pv.status);
  const validDone  = ['validated', 'published'].includes(pv.status);
  const isAnomaly  = pv.status === 'anomaly';
  const hasAnnotation = !!pv.observer_annotation || !!pv.observer_conformity;
  const conformityLabel = pv.observer_conformity === 'conforme' ? 'Conforme' : pv.observer_conformity === 'non_conforme' ? 'Non conforme' : null;

  const steps = [
    {
      label: 'Saisie du PV',
      sublabel: entryDone ? pv.entered_by : 'En attente de saisie',
      date: pv.entered_at_str,
      icon: entryDone ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <Clock className="w-3.5 h-3.5 text-gray-400" />,
      color: entryDone ? STEP_COLORS.done : STEP_COLORS.pending,
      description: 'Agent de saisie',
    },
    {
      label: isAnomaly ? 'Anomalie signalée' : (validDone ? 'PV validé' : 'En attente de validation'),
      sublabel: validDone ? pv.validated_by : (isAnomaly ? pv.validated_by : 'Validateur'),
      date: (validDone || isAnomaly) ? pv.validated_at_str : undefined,
      icon: isAnomaly
        ? <AlertTriangle className="w-3.5 h-3.5 text-white" />
        : validDone
          ? <CheckCircle className="w-3.5 h-3.5 text-white" />
          : <Clock className="w-3.5 h-3.5 text-gray-400" />,
      color: isAnomaly ? STEP_COLORS.error : validDone ? STEP_COLORS.done : (entryDone ? STEP_COLORS.active : STEP_COLORS.pending),
      description: 'Validateur',
    },
    {
      label: conformityLabel ?? (hasAnnotation ? 'Annoté' : 'Observation'),
      sublabel: hasAnnotation ? pv.observer_name : 'Observateur',
      date: pv.observer_annotated_at_str,
      icon: hasAnnotation
        ? <PenLine className="w-3.5 h-3.5 text-white" />
        : <Eye className="w-3.5 h-3.5 text-gray-400" />,
      color: pv.observer_conformity === 'conforme'
        ? STEP_COLORS.done
        : pv.observer_conformity === 'non_conforme'
          ? STEP_COLORS.error
          : hasAnnotation ? STEP_COLORS.info : STEP_COLORS.pending,
      description: '',
      isInfo: true
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Circuit de validation
      </p>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            {/* Ligne de connexion gauche */}
            {i > 0 && (
              <div className={`absolute top-3.5 right-1/2 w-full h-0.5 ${steps[i - 1].color.line} -z-0`} />
            )}

            {/* Point */}
            <div className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center ${step.color.dot} shadow-sm`}>
              {step.icon}
            </div>

            {/* Texte */}
            <div className="mt-2 text-center px-1 w-full">
              <p className={`text-xs font-semibold leading-tight ${step.color.text}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{step.description}</p>
              {step.sublabel && (
                <p className="text-[10px] font-medium text-gray-700 mt-0.5 truncate">{step.sublabel}</p>
              )}
              {step.date && (
                <p className="text-[10px] text-gray-400 mt-0.5">{step.date}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PVValidationSectionProps { selectedElection: string; readOnly?: boolean; }

const PVValidationSection: React.FC<PVValidationSectionProps> = ({ selectedElection, readOnly = false }) => {
  const { role } = useRBAC();
  const { user } = useAuth();
  const isObserver = role === 'observateur';

  const [selectedPV, setSelectedPV] = useState<string | null>(null);
  const [observerAnnotation, setObserverAnnotation] = useState('');
  const [observerConformity, setObserverConformity] = useState<'conforme' | 'non_conforme' | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'entered' | 'validated' | 'anomaly' | 'published'>('all');
  const [loading, setLoading] = useState(false);
  const [pvs, setPvs] = useState<any[]>([]);
  const [bureauxMap, setBureauxMap] = useState<Map<string, { id: string; name: string; center_id: string }>>(new Map());
  const [centersMap, setCentersMap] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [detailOpen, setDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<{ total_registered: number; total_voters: number; null_votes: number; votes_expressed: number }>({ total_registered: 0, total_voters: 0, null_votes: 0, votes_expressed: 0 });
  const [candidateResults, setCandidateResults] = useState<Array<{ id: string; name: string; party?: string; suppleant?: string; college_type?: string | null; votes: number }>>([]);
  const [isProElection, setIsProElection] = useState(false);
  const [newPvFile, setNewPvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());

  // Helpers d'upload (alignés avec PVEntrySection)
  const ensureBucketExists = async (bucket: string) => {
    try {
      // @ts-ignore potentiellement non exposé selon droits
      await supabase.storage.createBucket(bucket, { public: true });
    } catch (err: any) {
      if (!(`${err?.message || ''}`.toLowerCase().includes('already exists'))) {
        // Ignorer: si réellement absent, l'upload échouera ensuite
      }
    }
  };

  const uploadPVFile = async (file: File, electionId: string, pvId: string) => {
    const bucket = 'pv-uploads';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const relPath = `${electionId}/${pvId}/${timestamp}_${safeName}`;

    let { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(relPath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' });

    if (uploadErr && (`${uploadErr?.message || ''}`.toLowerCase().includes('bucket not found') || `${uploadErr?.error || ''}`.toLowerCase().includes('bucket'))) {
      await ensureBucketExists(bucket);
      ({ data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(relPath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' }));
    }

    if (uploadErr) throw uploadErr;
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(uploadData!.path);
    return publicUrlData.publicUrl;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (!selectedElection) { setPvs([]); setBureauxMap(new Map()); setCentersMap(new Map()); setLoading(false); return; }
        const { data: pvRows, error: pvErr } = await supabase
          .from('procès_verbaux')
          .select('id, bureau_id, total_registered, total_voters, null_votes, votes_expressed, status, entered_by, entered_at, validated_by, validated_at, pv_photo_url, observer_annotation, observer_conformity, observer_id, observer_annotated_at, college_type')
          .eq('election_id', selectedElection)
          .order('created_at', { ascending: false })
          .limit(500);
        if (pvErr) throw pvErr;
        
        // Charger les utilisateurs
        const { data: usersData } = await supabase.from('users').select('id, name');
        setUsersMap(new Map(usersData?.map(u => [u.id, u.name]) || []));
        // Filtrer les PV aux centres liés à l'élection via election_centers
        const bureauIds = Array.from(new Set((pvRows || []).map(r => r.bureau_id).filter(Boolean)));
        if (bureauIds.length) {
          const { data: bureaus, error: bErr } = await supabase
            .from('voting_bureaux')
            .select('id, name, center_id')
            .in('id', bureauIds);
          if (bErr) throw bErr;
          const centerIds = Array.from(new Set((bureaus || []).map(b => b.center_id)));
          // Restreindre aux centers de election_centers
          const { data: ecRows, error: ecErr } = await supabase
            .from('election_centers')
            .select('center_id')
            .eq('election_id', selectedElection);
          if (ecErr) throw ecErr;
          const allowedCenterIds = new Set((ecRows || []).map((r: any) => r.center_id));
          const filteredBureaus = (bureaus || []).filter(b => allowedCenterIds.has(b.center_id));
          const filteredCenterIds = Array.from(new Set(filteredBureaus.map(b => b.center_id)));
          const filteredPvRows = (pvRows || []).filter(r => filteredBureaus.some(b => b.id === r.bureau_id));
          setPvs(filteredPvRows);
          const { data: centers, error: cErr } = centerIds.length
            ? await supabase.from('voting_centers').select('id, name').in('id', filteredCenterIds)
            : { data: [], error: null } as any;
          if (cErr) throw cErr;
          setBureauxMap(new Map(filteredBureaus.map(b => [b.id, b])));
          setCentersMap(new Map((centers || []).map(c => [c.id, c])));
        } else {
          setBureauxMap(new Map());
          setCentersMap(new Map());
        }
      } catch (e) {
        console.error('Erreur chargement PV:', e);
        setPvs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedElection]);

  const displayedPVs = useMemo(() => {
    const enriched = pvs.map(pv => {
      const bureau = bureauxMap.get(pv.bureau_id);
      const center = bureau ? centersMap.get(bureau.center_id) : undefined;
      return {
        id: pv.id,
        status: pv.status,
        bureauLabel: `${center?.name || 'Centre'} - ${bureau?.name || 'Bureau'}`,
        timestamp: pv.entered_at ? new Date(pv.entered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        total_registered: pv.total_registered,
        total_voters: pv.total_voters,
        votes_expressed: pv.votes_expressed,
        null_votes: pv.null_votes,
        pv_photo_url: pv.pv_photo_url,
        entered_by: pv.entered_by ? (usersMap.get(pv.entered_by) || pv.entered_by) : 'Inconnu',
        entered_at_str: pv.entered_at ? new Date(pv.entered_at).toLocaleDateString('fr-FR') + ' à ' + new Date(pv.entered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        validated_by: pv.validated_by ? (usersMap.get(pv.validated_by) || pv.validated_by) : 'Inconnu',
        validated_at_str: pv.validated_at ? new Date(pv.validated_at).toLocaleDateString('fr-FR') + ' à ' + new Date(pv.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        // Données observateur
        college_type: (pv.college_type ?? null) as string | null,
        observer_annotation: pv.observer_annotation ?? null,
        observer_conformity: (pv.observer_conformity ?? null) as 'conforme' | 'non_conforme' | null,
        observer_name: pv.observer_id ? (usersMap.get(pv.observer_id) || pv.observer_id) : null,
        observer_annotated_at_str: pv.observer_annotated_at ? new Date(pv.observer_annotated_at).toLocaleDateString('fr-FR') + ' à ' + new Date(pv.observer_annotated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        bureau_id: pv.bureau_id,
      };
    });
    if (filter === 'all') return enriched;
    return enriched.filter(e => e.status === filter);
  }, [pvs, bureauxMap, centersMap, filter]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'entered':
        return 'Saisi';
      case 'validated':
        return 'Validé';
      case 'anomaly':
        return 'Anomalie';
      case 'published':
        return 'Publié';
      default:
        return status;
    }
  };

  const getPriorityBadge = (status: string) => (
    <Badge className={
      status === 'validated' ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'anomaly' ? 'bg-red-100 text-red-800 border-red-200'
      : status === 'entered' ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-orange-100 text-orange-800 border-orange-200'
    }>
      {getStatusLabel(status)}
    </Badge>
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'validated':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'anomaly':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />;
    }
  };

  const filteredPVs = displayedPVs;


  const selectedPVData = useMemo(() => filteredPVs.find(pv => pv.id === selectedPV), [filteredPVs, selectedPV]);

  // Synchroniser l'annotation et la conformité avec le PV sélectionné
  useEffect(() => {
    setObserverAnnotation(selectedPVData?.observer_annotation ?? '');
    setObserverConformity(selectedPVData?.observer_conformity ?? null);
  }, [selectedPVData?.id]);

  // Conformité observateur — enregistre uniquement l'avis, sans modifier le statut du PV
  const submitObserverConformity = async (conformity: 'conforme' | 'non_conforme') => {
    if (!selectedPV || !user) return;
    setSavingAnnotation(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('procès_verbaux')
        .update({
          observer_annotation: observerAnnotation.trim() || null,
          observer_conformity: conformity,
          observer_id: user.id,
          observer_annotated_at: now,
        })
        .eq('id', selectedPV);
      if (error) { toast.error("Échec de l'enregistrement"); return; }

      setObserverConformity(conformity);
      setPvs(prev => prev.map(p => p.id === selectedPV ? {
        ...p,
        observer_annotation: observerAnnotation.trim() || null,
        observer_conformity: conformity,
        observer_id: user.id,
        observer_annotated_at: now,
      } : p));

      toast.success(conformity === 'conforme' ? 'Avis enregistré : Conforme' : 'Avis enregistré : Non conforme');
      setDetailOpen(false);
    } finally {
      setSavingAnnotation(false);
    }
  };


  const validateEditValues = () => {
    const errors: Record<string, string> = {};
    const inscrits = Number(editValues.total_registered) || 0;
    const votants = Number(editValues.total_voters) || 0;
    const nuls = Number(editValues.null_votes) || 0;
    const exprimes = Number(editValues.votes_expressed) || 0;
    const totalCandidat = candidateResults.reduce((s, c) => s + (Number(c.votes) || 0), 0);

    if (votants > inscrits) {
      errors.votants = `Le nombre de votants (${votants}) ne peut pas dépasser le nombre d'inscrits (${inscrits})`;
    }
    if (nuls + exprimes !== votants) {
      errors.total = `Bulletins nuls (${nuls}) + Suffrages exprimés (${exprimes}) = ${nuls + exprimes} ≠ Votants (${votants})`;
    }
    if (exprimes !== totalCandidat) {
      errors.candidateTotal = `Total voix candidats (${totalCandidat}) ≠ Suffrages exprimés (${exprimes})`;
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fonction pour réinitialiser les chiffres du bureau
  const handleResetBureauData = async () => {
    if (!selectedPV) return;
    
    setResetting(true);
    try {
      // Récupérer le nombre d'électeurs inscrits par défaut du bureau
      let defaultRegisteredVoters = 0;
      try {
        const { data: pvData } = await supabase
          .from('procès_verbaux')
          .select('bureau_id')
          .eq('id', selectedPV)
          .single();

        if (pvData?.bureau_id) {
          const { data: bureauData } = await supabase
            .from('voting_bureaux')
            .select('registered_voters')
            .eq('id', pvData.bureau_id)
            .single();

          defaultRegisteredVoters = bureauData?.registered_voters || 0;
        }
      } catch (error) {
        console.warn('Impossible de récupérer le nombre d\'électeurs inscrits par défaut:', error);
      }

      // Supprimer les résultats des candidats
      const { error: deleteResultsError } = await supabase
        .from('candidate_results')
        .delete()
        .eq('pv_id', selectedPV);

      if (deleteResultsError) {
        console.error('Erreur lors de la suppression des résultats candidats:', deleteResultsError);
        toast.error('Erreur lors de la suppression des résultats candidats');
        return;
      }

      // Réinitialiser le PV à "En attente de saisie" avec le nombre d'électeurs inscrits par défaut
      const { error: resetPVError } = await supabase
        .from('procès_verbaux')
        .update({
          status: 'pending',
          total_registered: defaultRegisteredVoters,
          total_voters: 0,
          null_votes: 0,
          votes_expressed: 0,
          entered_by: null,
          entered_at: null,
          validated_at: null,
          pv_photo_url: null,
          anomalies: null
        })
        .eq('id', selectedPV);

      if (resetPVError) {
        console.error('Erreur lors de la réinitialisation du PV:', resetPVError);
        toast.error('Erreur lors de la réinitialisation du PV');
        return;
      }

      // Mettre à jour l'état local
      setPvs(prev => prev.map(pv => 
        pv.id === selectedPV 
          ? { 
              ...pv, 
              status: 'pending',
              total_registered: defaultRegisteredVoters,
              total_voters: 0,
              null_votes: 0,
              votes_expressed: 0,
              entered_by: null,
              entered_at: null,
              validated_at: null,
              pv_photo_url: null,
              anomalies: null
            }
          : pv
      ));

      // Réinitialiser les valeurs d'édition avec le nombre d'électeurs inscrits par défaut
      setEditValues({
        total_registered: defaultRegisteredVoters,
        total_voters: 0,
        null_votes: 0,
        votes_expressed: 0
      });

      // Vider les résultats des candidats
      setCandidateResults([]);

      // Recharger les candidats pour cette élection (supporte élections pro)
      try {
        const { data: elecInfo } = await supabase
          .from('elections')
          .select('type')
          .eq('id', selectedElection)
          .single();
        const candidates = await resolveCandidatesForElection(selectedElection, elecInfo?.type);
        setCandidateResults(candidates.map(c => ({ id: c.id, name: c.name, votes: 0 })));
      } catch (error) {
        console.error('Erreur lors du rechargement des candidats:', error);
      }

      toast.success('Les chiffres du bureau ont été réinitialisés avec succès');
      setDetailOpen(false);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast.error('Erreur lors de la réinitialisation des données');
    } finally {
      setResetting(false);
    }
  };

  // Charger les résultats par candidat pour le PV sélectionné
  useEffect(() => {
    const loadCandidateResults = async () => {
      if (!selectedPV || !selectedElection) { setCandidateResults([]); return; }
      
      try {
        // Charger le type de l'élection
        const { data: elecInfo } = await supabase
          .from('elections')
          .select('type')
          .eq('id', selectedElection)
          .single();

        // Résoudre la liste des candidats (supporte pro + standard)
        const resolvedCandidates = await resolveCandidatesForElection(selectedElection, elecInfo?.type);
        setIsProElection(isProfessionalElection(elecInfo?.type));

        // Charger les résultats existants pour ce PV
        const { data: resultsData, error: resultsError } = await supabase
          .from('candidate_results')
          .select('id, votes, candidate_id')
          .eq('pv_id', selectedPV);

        if (resultsError) {
          console.error('Erreur chargement résultats candidats:', resultsError);
        }

        // Créer un map des résultats existants
        const resultsMap = new Map();
        (resultsData || []).forEach((r: any) => {
          resultsMap.set(r.candidate_id, r.votes || 0);
        });

        // Filtrer par collège et établissement du PV
        const pv = pvs.find(p => p.id === selectedPV);
        const pvCollegeType = pv?.college_type ?? null;
        const pvBureau = pv?.bureau_id ? bureauxMap.get(pv.bureau_id) : null;
        const pvCenter = pvBureau?.center_id ? centersMap.get(pvBureau.center_id) : null;
        const pvCenterName = (pvCenter?.name || '').toLowerCase();

        const filteredCandidates = resolvedCandidates.filter(c => {
          const collegeMatch = !pvCollegeType || !c.college_type || c.college_type === pvCollegeType;
          const etabMatch = !c.etablissement || !pvCenterName || c.etablissement.toLowerCase() === pvCenterName;
          return collegeMatch && etabMatch;
        });

        // Combiner candidats filtrés et résultats, n'afficher que ceux renseignés
        const mapped = filteredCandidates
          .map(c => ({
            id: c.id,
            name: c.name,
            party: c.party,
            suppleant: c.suppleant,
            college_type: c.college_type,
            votes: resultsMap.get(c.id) || 0
          }))
          .filter(cr => cr.votes > 0);

        setCandidateResults(mapped);
      } catch (error) {
        console.error('Erreur lors du chargement des candidats:', error);
        setCandidateResults([]);
      }
    };
    loadCandidateResults();
  }, [selectedPV, selectedElection, pvs, bureauxMap, centersMap]);

  useEffect(() => {
    if (!selectedPVData) return;
    setEditValues({
      total_registered: selectedPVData.total_registered || 0,
      total_voters: selectedPVData.total_voters || 0,
      null_votes: selectedPVData.null_votes || 0,
      votes_expressed: selectedPVData.votes_expressed || 0,
    });
  }, [selectedPVData]);

  return (
    <div className="space-y-6">
      {/* Filtres et statistiques */}
      <Card className="gov-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gov-gray">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-5 h-5" />
              <span>File d'Attente de Validation</span>
            </div>
            <Badge className="bg-orange-100 text-orange-800">
              {loading ? '...' : pvs.length} PV
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} size="sm">Tous</Button>
            <Button variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')} size="sm">En attente</Button>
            <Button variant={filter === 'entered' ? 'default' : 'outline'} onClick={() => setFilter('entered')} size="sm">Saisis</Button>
            <Button variant={filter === 'validated' ? 'default' : 'outline'} onClick={() => setFilter('validated')} size="sm">Validés</Button>
            <Button variant={filter === 'anomaly' ? 'default' : 'outline'} onClick={() => setFilter('anomaly')} size="sm">Anomalie</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Liste des PV en attente */}
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="text-lg text-gov-gray">PV à Valider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredPVs.map((pv) => (
                <div 
                  key={pv.id} 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPV === pv.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => { setSelectedPV(pv.id); setDetailOpen(true); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      {getStatusIcon(pv.status)}
                      <span className="font-medium text-gray-900">{pv.bureauLabel}</span>
                      {pv.college_type && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          pv.college_type === 'cadres'   ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          pv.college_type === 'employes' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          pv.college_type === 'ouvriers' ? 'bg-green-50 text-green-700 border-green-200' :
                          pv.college_type === 'general'  ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {pv.college_type === 'cadres' ? 'Cadres' : pv.college_type === 'employes' ? 'Maîtrise' : pv.college_type === 'ouvriers' ? 'Exécution' : pv.college_type === 'general' ? 'Encadrement' : 'Général'}
                        </span>
                      )}
                    </div>
                    {getPriorityBadge(pv.status)}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{pv.timestamp}</span>
                    </div>
                  </div>
                  
                  {pv.status === 'validated' && (
                    <div className="text-xs text-green-700 mt-1">
                      Validé par {pv.validated_by} le {pv.validated_at_str}
                    </div>
                  )}
                  
                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>Votants: {pv.total_voters}</span>
                    <span>Exprimés: {pv.votes_expressed}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        
      </div>

      {/* Modal détails PV */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setEditMode(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du PV</DialogTitle>
          </DialogHeader>
            {selectedPVData ? (
              <div className="space-y-6">

              {/* ── Timeline circuit de validation ──────────────────────────── */}
              <PVTimeline pv={selectedPVData} />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  {getStatusIcon(selectedPVData.status)}
                  <span className="font-semibold">{(() => {
                    const bureau = bureauxMap.get(pvs.find(p=>p.id===selectedPVData.id)?.bureau_id || '');
                    const center = bureau ? centersMap.get(bureau.center_id) : undefined;
                    return `${center?.name || 'Centre'} - ${bureau?.name || 'Bureau'}`;
                  })()}</span>
                  {selectedPVData.college_type && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      selectedPVData.college_type === 'cadres'   ? 'bg-orange-100 text-orange-700 border-orange-300' :
                      selectedPVData.college_type === 'employes' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      selectedPVData.college_type === 'ouvriers' ? 'bg-green-100 text-green-700 border-green-300' :
                      selectedPVData.college_type === 'general'  ? 'bg-purple-100 text-purple-700 border-purple-300' :
                      'bg-gray-100 text-gray-600 border-gray-300'
                    }`}>
                      {selectedPVData.college_type === 'cadres'   ? 'Collège Cadres' :
                       selectedPVData.college_type === 'employes' ? 'Collège Maîtrise' :
                       selectedPVData.college_type === 'ouvriers' ? 'Collège Exécution' :
                       selectedPVData.college_type === 'general'  ? 'Collège Encadrement' : 'Collège Général'}
                    </span>
                  )}
                </div>
                {getPriorityBadge(selectedPVData.status)}
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                  <h4 className="font-medium text-gray-900 mb-3">Participation</h4>
                  <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                    {editMode ? (
                        <div className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span>Inscrits:</span>
                          <input className={`border rounded px-2 py-1 w-28 ${editErrors.votants ? 'border-red-500' : ''}`} type="number" value={editValues.total_registered} onChange={e => setEditValues(v => ({ ...v, total_registered: parseInt(e.target.value) || 0 }))} />
                              </div>
                        <div className="flex items-center justify-between gap-4">
                            <span>Votants:</span>
                          <input className={`border rounded px-2 py-1 w-28 ${editErrors.votants ? 'border-red-500' : ''}`} type="number" value={editValues.total_voters} onChange={e => setEditValues(v => ({ ...v, total_voters: parseInt(e.target.value) || 0 }))} />
                            </div>
                        <div className="flex items-center justify-between gap-4">
                            <span>Bulletins nuls:</span>
                          <input className={`border rounded px-2 py-1 w-28 ${editErrors.total ? 'border-red-500' : ''}`} type="number" value={editValues.null_votes} onChange={e => setEditValues(v => ({ ...v, null_votes: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span>Suffrages exprimés:</span>
                          <input className={`border rounded px-2 py-1 w-28 ${editErrors.total || editErrors.candidateTotal ? 'border-red-500' : ''}`} type="number" value={editValues.votes_expressed} onChange={e => setEditValues(v => ({ ...v, votes_expressed: parseInt(e.target.value) || 0 }))} />
                      </div>
                        {(editErrors.votants || editErrors.total || editErrors.candidateTotal) && (
                          <div className="text-xs text-red-600 mt-2">
                            {editErrors.votants && <div>{editErrors.votants}</div>}
                            {editErrors.total && <div>{editErrors.total}</div>}
                            {editErrors.candidateTotal && <div>{editErrors.candidateTotal}</div>}
                          </div>
                        )}
                          </div>
                            ) : (
                              <>
                        <div className="flex justify-between"><span>Inscrits:</span><span className="font-medium">{editValues.total_registered || 0}</span></div>
                        <div className="flex justify-between"><span>Votants:</span><span className="font-medium">{editValues.total_voters || 0}</span></div>
                        <div className="flex justify-between"><span>Bulletins nuls:</span><span className="font-medium">{editValues.null_votes || 0}</span></div>
                        <div className="flex justify-between"><span>Suffrages exprimés:</span><span className="font-medium">{editValues.votes_expressed || 0}</span></div>
                        <div className="border-t border-gray-200 my-2 pt-2 text-xs text-gray-500">
                          <div>Saisi par : <strong>{selectedPVData.entered_by}</strong> {selectedPVData.entered_at_str ? `le ${selectedPVData.entered_at_str}` : ''}</div>
                          {selectedPVData.status === 'validated' && (
                            <div className="text-green-700 font-semibold mt-1">
                              Validé par : <strong>{selectedPVData.validated_by}</strong> {selectedPVData.validated_at_str ? `le ${selectedPVData.validated_at_str}` : ''}
                            </div>
                          )}
                        </div>
                              </>
                            )}
                        </div>
                      </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Document Scanné</h4>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                      <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      {!selectedPVData.pv_photo_url && (
                        <h5 className="font-medium text-gray-900 mb-2">Aucun document</h5>
                      )}
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={!selectedPVData.pv_photo_url} 
                          onClick={() => { if (selectedPVData.pv_photo_url) { setPreviewUrl(selectedPVData.pv_photo_url); setPreviewOpen(true); } }}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Voir
                        </Button>
                        {editMode && (
                          <>
                          <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={e => setNewPvFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                            Remplacer le document
                          </Button>
                          {newPvFile && (
                            <span className="text-xs text-gray-600">{newPvFile.name}</span>
                          )}
                              </>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

              {/* Résultats par candidat */}
                  <div>
                <h4 className="font-medium text-gray-900 mb-3">Résultats par Candidat</h4>
                {candidateResults.length > 0 ? (
                  <div className="space-y-2">
                    {isProElection ? (
                      // Élection professionnelle — blocs syndicat identiques à la saisie
                      candidateResults.map(cr => {
                        const syndicat = cr.party?.split(' — ')[0] || '';
                        return (
                          <div key={cr.id} className="p-3 border border-gray-200 rounded-xl bg-white flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-blue-700 text-sm truncate">{syndicat}</p>
                              <p className="text-sm text-gray-900 mt-0.5">
                                <span className="text-xs text-gray-500 font-medium">Titulaire : </span>
                                <span className="font-semibold">{cr.name}</span>
                              </p>
                              {cr.suppleant && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="font-medium">Suppléant : </span>{cr.suppleant}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {editMode ? (
                                <input
                                  type="number"
                                  className="border rounded px-2 py-1 w-24 text-right"
                                  value={cr.votes}
                                  onChange={e => {
                                    const value = parseInt(e.target.value || '0');
                                    setCandidateResults(prev => prev.map(c => c.id === cr.id ? { ...c, votes: value } : c));
                                  }}
                                />
                              ) : (
                                <span className="font-bold text-gray-900">{cr.votes} <span className="text-xs font-normal text-gray-500">voix</span></span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Élection standard — liste plate
                      candidateResults.map(cr => (
                        <div key={cr.id} className="p-3 border border-gray-200 rounded-xl bg-white flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{cr.name}</p>
                            {cr.party && <p className="text-xs text-blue-600 mt-0.5">{cr.party}</p>}
                            {cr.suppleant && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                <span className="font-medium">Suppléant : </span>{cr.suppleant}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                className="border rounded px-2 py-1 w-24 text-right"
                                value={cr.votes}
                                onChange={e => {
                                  const value = parseInt(e.target.value || '0');
                                  setCandidateResults(prev => prev.map(c => c.id === cr.id ? { ...c, votes: value } : c));
                                }}
                              />
                            ) : (
                              <span className="font-bold text-gray-900">{cr.votes} <span className="text-xs font-normal text-gray-500">voix</span></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Aucun résultat détaillé saisi</div>
                )}
                </div>

                {/* Commentaire de validation — masqué pour l'observateur */}
                {!isObserver && (
                  <div>
                    <Label htmlFor="comment">Commentaire de validation</Label>
                    <Textarea id="comment" placeholder="Ajouter un commentaire..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
                  </div>
                )}

                {/* ── Annotation observateur ──────────────────────────────── */}
                {isObserver ? (
                  /* ── Formulaire d'annotation observateur — ligne unique ── */
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
                      Annotation observateur
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        placeholder="Remarque ou observation (optionnel)…"
                        value={observerAnnotation}
                        onChange={e => setObserverAnnotation(e.target.value)}
                        className="flex-1 min-w-0 h-10 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                      />
                      <button
                        type="button"
                        disabled={savingAnnotation}
                        onClick={() => submitObserverConformity('conforme')}
                        className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-50 ${
                          observerConformity === 'conforme'
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Conforme
                      </button>
                      <button
                        type="button"
                        disabled={savingAnnotation}
                        onClick={() => submitObserverConformity('non_conforme')}
                        className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-50 ${
                          observerConformity === 'non_conforme'
                            ? 'border-red-600 bg-red-600 text-white shadow-sm'
                            : 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        Non conforme
                      </button>
                    </div>
                    {savingAnnotation && (
                      <p className="text-xs text-slate-400 mt-2 px-1 animate-pulse">Enregistrement…</p>
                    )}
                  </div>
                ) : (
                  /* Autres rôles : annotation sur une seule ligne compacte */
                  (selectedPVData?.observer_annotation || selectedPVData?.observer_conformity) ? (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                      <PenLine className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-600 whitespace-nowrap">
                        {selectedPVData.observer_name ?? 'Observateur'}
                      </span>
                      {selectedPVData.observer_annotated_at_str && (
                        <span className="text-slate-400 whitespace-nowrap">{selectedPVData.observer_annotated_at_str}</span>
                      )}
                      {selectedPVData.observer_conformity && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                          selectedPVData.observer_conformity === 'conforme'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {selectedPVData.observer_conformity === 'conforme'
                            ? <><CheckCircle className="w-3 h-3" /> Conforme</>
                            : <><XCircle className="w-3 h-3" /> Non conforme</>
                          }
                        </span>
                      )}
                      {selectedPVData.observer_annotation && (
                        <span className="text-slate-600 italic truncate max-w-xs" title={selectedPVData.observer_annotation}>
                          "{selectedPVData.observer_annotation}"
                        </span>
                      )}
                    </div>
                  ) : null
                )}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-6">
                {!editMode && !readOnly && (
                  <Button onClick={() => {
                    setEditValues({
                      total_registered: (editValues.total_registered || 0),
                      total_voters: (selectedPVData.total_voters || 0),
                      null_votes: (selectedPVData.null_votes || 0),
                      votes_expressed: (selectedPVData.votes_expressed || 0)
                    });
                    setEditMode(true);
                  }} variant="outline">
                    Modifier
                  </Button>
                )}
                {editMode && (
                  <Button onClick={async () => {
                    if (!selectedPV) return;
                    if (!validateEditValues()) {
                      toast.error("Veuillez corriger les incohérences avant d'enregistrer.");
                      return;
                    }
                    let pvPhotoUrl: string | null = null;
                    setSaving(true);
                    try {
                      if (newPvFile) {
                        try {
                          pvPhotoUrl = await uploadPVFile(newPvFile, selectedElection, selectedPV);
                        } catch (upErr: any) {
                          const msg = upErr?.message || upErr?.error || 'Upload échoué';
                          if ((msg || '').toLowerCase().includes('bucket')) {
                            toast.error("Bucket 'pv-uploads' introuvable ou accès refusé. Veuillez le créer et autoriser l'upload.");
                          } else {
                            toast.error(`Échec upload PV: ${msg}`);
                          }
                          throw upErr;
                        }
                      }
                      const updatePayload: any = {
                        total_registered: editValues.total_registered || 0,
                        total_voters: editValues.total_voters || 0,
                        null_votes: editValues.null_votes || 0,
                        votes_expressed: editValues.votes_expressed || 0,
                      };
                      if (pvPhotoUrl) updatePayload.pv_photo_url = pvPhotoUrl;
                      const { error: pvErr } = await supabase
                        .from('procès_verbaux')
                        .update(updatePayload)
                        .eq('id', selectedPV);
                      if (pvErr) throw pvErr;

                      for (const cr of candidateResults) {
                        const { data: existing } = await supabase
                          .from('candidate_results')
                          .select('id')
                          .eq('pv_id', selectedPV)
                          .eq('candidate_id', cr.id)
                          .maybeSingle();
                        if (existing?.id) {
                          await supabase
                            .from('candidate_results')
                            .update({ votes: cr.votes })
                            .eq('id', existing.id);
                        } else {
                          await supabase
                            .from('candidate_results')
                            .insert({ pv_id: selectedPV, candidate_id: cr.id, votes: cr.votes });
                        }
                      }

                      setPvs(prev => prev.map(p => p.id === selectedPV ? { ...p, total_voters: editValues.total_voters, null_votes: editValues.null_votes, votes_expressed: editValues.votes_expressed, pv_photo_url: pvPhotoUrl || p.pv_photo_url } : p));
                      setEditMode(false);
                      setNewPvFile(null);
                    } catch (err) {
                      console.error('Erreur maj PV/candidats:', err);
                      const msg = (err as any)?.message || (err as any)?.error || "Échec de l'enregistrement du PV";
                      toast.error(msg);
                    }
                    finally {
                      setSaving(false);
                    }
                  }} className="bg-green-600 hover:bg-green-700 text-white">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                )}
      {!readOnly && <Button
        onClick={() => setShowResetConfirm(true)}
        disabled={resetting}
        variant="outline"
        className="border-orange-300 text-orange-700 hover:bg-orange-50"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {resetting ? 'Réinitialisation...' : 'Réinitialiser les chiffres du bureau'}
      </Button>}

                {/* Boutons d'action — masqués pour l'observateur */}
                {!readOnly && <>
                <Button onClick={async () => {
                  if (!selectedPV) return;
                  if (!confirm('Supprimer ce PV ? Cette action est irréversible.')) return;
                  const { error: crErr } = await supabase.from('candidate_results').delete().eq('pv_id', selectedPV);
                  if (crErr) { console.error(crErr); return; }
                  const { error: pvErr } = await supabase.from('procès_verbaux').delete().eq('id', selectedPV);
                  if (pvErr) { console.error(pvErr); return; }
                  setPvs(prev => prev.filter(p => p.id !== selectedPV));
                  setDetailOpen(false);
                }} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                  Supprimer
                </Button>
                <Button onClick={async () => {
                  if (!selectedPV) return;
                  const { data: { user } } = await supabase.auth.getUser();
                  const { error } = await supabase
                    .from('procès_verbaux')
                    .update({ status: 'validated', validated_at: new Date().toISOString(), validated_by: user?.id || null })
                    .eq('id', selectedPV);
                  if (!error) {
                    setPvs(prev => prev.map(p => p.id === selectedPV ? { ...p, status: 'validated', validated_by: user?.id || null, validated_at: new Date().toISOString() } : p));
                    setDetailOpen(false);
                  }
                }} className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" /> Valider
                </Button>
                </>}
                </div>
              </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {/* Modal d'aperçu du document */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu du Document</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <div className="w-full h-[75vh]">
              {previewUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewUrl} className="w-full h-full" />
              ) : (
                <img src={previewUrl} alt="PV" className="max-w-full max-h-full mx-auto" />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation de réinitialisation */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la réinitialisation
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Êtes-vous sûr de vouloir réinitialiser les chiffres de ce bureau ?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-2">Cette action va :</p>
                  <ul className="space-y-1 text-orange-700">
                    <li>• Remettre le statut à "En attente de saisie"</li>
                    <li>• Supprimer toutes les données saisies</li>
                    <li>• Réinitialiser les votes des candidats à 0</li>
                    <li>• Restaurer le nombre d'électeurs inscrits par défaut</li>
                  </ul>
                  <p className="font-medium mt-2 text-orange-800">
                    Cette action est irréversible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
              disabled={resetting}
            >
              Annuler
            </Button>
            <Button
              onClick={async () => {
                setShowResetConfirm(false);
                await handleResetBureauData();
              }}
              disabled={resetting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {resetting ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PVValidationSection;
