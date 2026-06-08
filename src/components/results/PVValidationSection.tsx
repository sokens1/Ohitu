/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
  PenLine,
  X as XIcon,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { resolveCandidatesForElection, isProfessionalElection } from '@/lib/candidateUtils';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/contexts/AuthContext';
import {
  notifyPVValidated,
  notifyPVRejected,
  notifyObserverOpinion,
  notifyOpinionReaction,
} from '@/lib/notificationService';
import { auditService } from '@/services/auditService';

// ── Composant Timeline circuit de validation ──────────────────────────────────
interface ObserverOpinion {
  id: string; observer_id: string; observer_name: string;
  annotation: string | null; conformity: 'conforme' | 'non_conforme' | null;
  annotated_at_str: string;
  reactions?: Array<{
    id: string;
    reactor_id: string;
    reactor_name: string;
    type: 'approved' | 'overridden';
    comment: string | null;
    reacted_at: string;
  }>;
}

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
    opinions?: ObserverOpinion[];
  };
}

const STEP_COLORS = {
  done:    { dot: 'bg-emerald-600 border-emerald-600', line: 'bg-emerald-500', text: 'text-emerald-700' },
  active:  { dot: 'bg-amber-500 border-amber-500',     line: 'bg-gray-200',   text: 'text-amber-600'   },
  pending: { dot: 'bg-white border-gray-300',           line: 'bg-gray-200',   text: 'text-gray-400'   },
  error:   { dot: 'bg-red-500 border-red-500',          line: 'bg-gray-200',   text: 'text-red-600'    },
  info:    { dot: 'bg-purple-500 border-purple-500',    line: 'bg-gray-200',   text: 'text-purple-700' },
  reserve: { dot: 'bg-amber-500 border-amber-500',      line: 'bg-gray-200',   text: 'text-amber-700'  },
};

const PVTimeline: React.FC<PVTimelineProps> = ({ pv }) => {
  const entryDone = ['entered', 'validated', 'published', 'anomaly'].includes(pv.status);
  const validDone  = ['validated', 'published'].includes(pv.status);
  const isAnomaly  = pv.status === 'anomaly';

  // Avis agrégés multi-observateurs
  const opinions = pv.opinions ?? [];
  const conformeCount    = opinions.filter(o => o.conformity === 'conforme').length;
  const nonConformeCount = opinions.filter(o => o.conformity === 'non_conforme').length;
  const hasAnyOpinion    = opinions.length > 0;
  const hasNonConforme   = nonConformeCount > 0;
  const aggConformity    = hasAnyOpinion ? (hasNonConforme ? 'non_conforme' : 'conforme') : null;
  // Libellé sous le point : "2 conformes, 1 réserves" ou nom unique
  const aggSublabel = hasAnyOpinion
    ? (opinions.length === 1
        ? opinions[0].observer_name
        : `${conformeCount} conforme${conformeCount > 1 ? 's' : ''} · ${nonConformeCount} réserves${nonConformeCount > 1 ? 's' : ''}`)
    : null;
  const conformityLabel  = aggConformity === 'conforme' ? 'Conforme' : aggConformity === 'non_conforme' ? 'Réserves' : null;

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
      label: isAnomaly ? 'Rejeté' : (validDone ? 'PV validé' : 'En attente de validation'),
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
      label: conformityLabel ?? (hasAnyOpinion ? 'Observé' : 'Observation'),
      sublabel: aggSublabel,
      date: hasAnyOpinion ? opinions[opinions.length - 1].annotated_at_str : undefined,
      icon: hasAnyOpinion
        ? <PenLine className="w-3.5 h-3.5 text-white" />
        : <Eye className="w-3.5 h-3.5 text-gray-400" />,
      color: aggConformity === 'conforme'
        ? STEP_COLORS.done
        : aggConformity === 'non_conforme'
          ? STEP_COLORS.reserve
          : hasAnyOpinion ? STEP_COLORS.info : STEP_COLORS.pending,
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

interface PVValidationSectionProps { selectedElection: string; readOnly?: boolean; onDataRefresh?: () => void; }

const PVValidationSection: React.FC<PVValidationSectionProps> = ({ selectedElection, readOnly = false, onDataRefresh }) => {
  const { role } = useRBAC();
  const { user } = useAuth();
  // Rôles pouvant soumettre un avis observateur sur un PV
  const isObserver = role === 'observateur' || role === 'president-etablissement';
  // Rôles pouvant réagir à un avis existant (approuver / annuler réserves)
  const canReact = role === 'super-admin' || role === 'admin';

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
  const [resettingAll, setResettingAll] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());

  // Filtres internes
  const [searchFilter, setSearchFilter] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [filterCenters, setFilterCenters] = useState<{ id: string; name: string }[]>([]);

  // Avis multiples d'observateurs  { pvId -> opinion[] }
  const [observerOpinions, setObserverOpinions] = useState<Map<string, Array<{
    id: string; observer_id: string; observer_name: string;
    annotation: string | null; conformity: 'conforme' | 'non_conforme' | null;
    annotated_at_str: string;
    reactions?: Array<{
      id: string; reactor_id: string; reactor_name: string;
      type: 'approved' | 'overridden'; comment: string | null; reacted_at: string;
    }>;
  }>>>(new Map());

  // Réactions
  const [reactionTarget, setReactionTarget] = useState<{ opinionId: string; comment: string } | null>(null);
  const [submittingReaction, setSubmittingReaction] = useState(false);

  // Rejet PV
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Rétractation
  const [retracting, setRetracting] = useState(false);

  // PV verrouillé : validé ou publié — boutons grisés (sauf pour super-admin et admin)
  const selectedPVStatus = pvs.find(p => p.id === selectedPV)?.status;
  const isLocked = (selectedPVStatus === 'validated' || selectedPVStatus === 'published')
    && role !== 'super-admin'
    && role !== 'admin';

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

  const submitReaction = async (opinionId: string, type: 'approved' | 'overridden', comment: string) => {
    if (type === 'overridden' && !comment.trim()) {
      toast.error('Un commentaire est obligatoire pour annuler une réserves.');
      return;
    }
    setSubmittingReaction(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const reactorId = authUser.user?.id ?? '';
      const reactorName = usersMap.get(reactorId) || 'Inconnu';
      const newReaction = {
        id: crypto.randomUUID(),
        reactor_id: reactorId,
        reactor_name: reactorName,
        type,
        comment: comment.trim() || null,
        reacted_at: new Date().toISOString(),
      };
      // Fetch current reactions first
      const { data: opRow } = await supabase
        .from('pv_observer_opinions')
        .select('reactions, conformity')
        .eq('id', opinionId)
        .single();
      const existing = opRow?.reactions ?? [];
      const updatedReactions = [...existing, newReaction];
      const updatePayload: Record<string, any> = { reactions: updatedReactions };
      if (type === 'overridden') updatePayload.conformity = 'conforme';
      const { data: updatedData, error } = await supabase
        .from('pv_observer_opinions')
        .update(updatePayload)
        .eq('id', opinionId)
        .select('id');
      if (error) { toast.error('Erreur lors de la réaction'); return; }
      if (!updatedData?.length) {
        toast.error('Mise à jour bloquée — appliquez la migration 20260529_opinion_reactions.sql dans Supabase.');
        return;
      }
      toast.success(type === 'approved' ? 'Réserves approuvée' : 'Réserves rejetée — avis mis à jour en conforme');
      // Audit + Notification observateur
      const pvOpinions = observerOpinions.get(selectedPV ?? '') ?? [];
      const opinion    = pvOpinions.find(op => op.id === opinionId);
      const pvData     = pvs.find(p => p.id === selectedPV);
      const bureau     = pvData ? bureauxMap.get(pvData.bureau_id) : null;
      auditService.log({
        action: type === 'approved' ? 'APPROVE' : 'UPDATE',
        resource_type: 'pv_opinion',
        resource_id: opinionId,
        description: `Réaction sur réserves (${type}) — ${bureau?.name ?? ''}${pvData?.college_type ? ` · Collège ${pvData.college_type}` : ''}`,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      }).catch(() => {});
      if (opinion && pvData) {
        const ctr = bureau ? centersMap.get(bureau.center_id) : null;
        notifyOpinionReaction({
          recipientId:   opinion.observer_id,
          pvId:          selectedPV!,
          electionId:    selectedElection,
          centerId:      bureau?.center_id ?? '',
          centerName:    ctr?.name ?? 'établissement',
          bureauName:    bureau?.name ?? 'bureau',
          collegeType:   pvData.college_type ?? null,
          reactionType:  type,
          actorName:     reactorName,
        }).catch(() => {/* silencieux */});
      }
      setReactionTarget(null);
      // Mise à jour optimiste immédiate de l'UI
      setObserverOpinions(prev => {
        const newMap = new Map(prev);
        const pvId = selectedPV;
        if (pvId) {
          const ops = (newMap.get(pvId) ?? []).map(op => {
            if (op.id !== opinionId) return op;
            return {
              ...op,
              reactions: [...(op.reactions ?? []), newReaction],
              ...(type === 'overridden' ? { conformity: 'conforme' as const } : {}),
            };
          });
          newMap.set(pvId, ops);
        }
        return newMap;
      });
      loadPVs();
    } finally {
      setSubmittingReaction(false);
    }
  };

  const loadPVs = useCallback(async () => {
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
        const { data: usersData } = await supabase.from('users').select('id, name, assigned_center_ids');
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
          let allowedCenterIds = new Set<string>((ecRows || []).map((r: any) => r.center_id as string));

          // ── Filtrage par rôle ─────────────────────────────────────────────────
          // validateur, agent-saisie, observateur → centres + collèges assignés
          // president-etablissement               → centres + bureaux assignés
          const roleColleges  = user?.role === 'validateur' || user?.role === 'agent-saisie' || user?.role === 'observateur' || user?.role === 'employeur';
          const roleBureaux   = user?.role === 'president-etablissement' || user?.role === 'suppleant-president';

          if (roleColleges) {
            // Restreindre allowedCenterIds aux centres présents dans assigned_center_colleges
            const assignedCenterIds = Object.keys(user.assigned_center_colleges ?? {});
            if (assignedCenterIds.length > 0) {
              allowedCenterIds = new Set([...allowedCenterIds].filter(id => assignedCenterIds.includes(id)));
            }
          } else if (roleBureaux) {
            // Restreindre allowedCenterIds aux centres présents dans assigned_center_bureaux
            const assignedCenterIds = Object.keys(user.assigned_center_bureaux ?? {});
            if (assignedCenterIds.length > 0) {
              allowedCenterIds = new Set([...allowedCenterIds].filter(id => assignedCenterIds.includes(id)));
            }
          }

          const filteredBureaus = (bureaus || []).filter(b => allowedCenterIds.has(b.center_id));
          const filteredCenterIds = Array.from(new Set(filteredBureaus.map(b => b.center_id)));

          const centerCollegesFilter: Record<string, string[]> = roleColleges ? (user.assigned_center_colleges ?? {}) : {};
          const centerBureauxFilter:  Record<string, string[]> = roleBureaux  ? (user.assigned_center_bureaux  ?? {}) : {};

          const filteredPvRows = (pvRows || []).filter(r => {
            const bureau = filteredBureaus.find(b => b.id === r.bureau_id);
            if (!bureau) return false;

            if (roleColleges) {
              // Filtre collège : vide = tous autorisés
              const allowedColleges = centerCollegesFilter[bureau.center_id];
              if (allowedColleges && allowedColleges.length > 0) {
                if (r.college_type && !allowedColleges.includes(r.college_type)) return false;
              }
            }

            if (roleBureaux) {
              // Filtre bureau : vide = tous autorisés pour ce centre
              const allowedBureaux = centerBureauxFilter[bureau.center_id];
              if (allowedBureaux && allowedBureaux.length > 0) {
                if (!allowedBureaux.includes(r.bureau_id)) return false;
              }
            }

            return true;
          });
          setPvs(filteredPvRows);

          const { data: centers, error: cErr } = centerIds.length
            ? await supabase.from('voting_centers').select('id, name').in('id', filteredCenterIds)
            : { data: [], error: null } as any;
          if (cErr) throw cErr;
          setBureauxMap(new Map(filteredBureaus.map(b => [b.id, b])));
          setCentersMap(new Map((centers || []).map(c => [c.id, c])));
          setFilterCenters((centers || []).map(c => ({ id: String(c.id), name: c.name })));

          // Charger les avis observateurs pour les PV filtrés
          if (filteredPvRows.length > 0) {
            const pvIds = filteredPvRows.map(r => r.id);
            const { data: opinions } = await supabase
              .from('pv_observer_opinions')
              .select('id, pv_id, observer_id, annotation, conformity, annotated_at, reactions')
              .in('pv_id', pvIds)
              .order('annotated_at', { ascending: true });
            const opinionsMap = new Map<string, any[]>();
            (opinions || []).forEach(op => {
              const list = opinionsMap.get(op.pv_id) || [];
              list.push({
                id: op.id,
                observer_id: op.observer_id,
                observer_name: usersData?.find(u => u.id === op.observer_id)?.name || op.observer_id,
                annotation: op.annotation ?? null,
                conformity: op.conformity ?? null,
                annotated_at_str: op.annotated_at
                  ? new Date(op.annotated_at).toLocaleDateString('fr-FR') + ' à ' + new Date(op.annotated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '',
                reactions: op.reactions ?? [],
              });
              opinionsMap.set(op.pv_id, list);
            });
            setObserverOpinions(opinionsMap);
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedElection,
    user?.id,
    user?.role,
    // Dépendances sérialisées pour éviter les re-renders infinis sur objets
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(user?.assigned_center_ids),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(user?.assigned_center_colleges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(user?.assigned_center_bureaux),
  ]);

  useEffect(() => { loadPVs(); }, [loadPVs]);

  const displayedPVs = useMemo(() => {
    const enriched = pvs.map(pv => {
      const bureau = bureauxMap.get(pv.bureau_id);
      const center = bureau ? centersMap.get(bureau.center_id) : undefined;
      return {
        id: pv.id,
        status: pv.status,
        centerId: bureau?.center_id ?? '',
        centerName: center?.name ?? '',
        bureauName: bureau?.name ?? '',
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
        college_type: (pv.college_type ?? null) as string | null,
        observer_annotation: pv.observer_annotation ?? null,
        observer_conformity: (pv.observer_conformity ?? null) as 'conforme' | 'non_conforme' | null,
        observer_name: pv.observer_id ? (usersMap.get(pv.observer_id) || pv.observer_id) : null,
        observer_annotated_at_str: pv.observer_annotated_at ? new Date(pv.observer_annotated_at).toLocaleDateString('fr-FR') + ' à ' + new Date(pv.observer_annotated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        bureau_id: pv.bureau_id,
        opinions: observerOpinions.get(pv.id) || [],
      };
    });

    return enriched.filter(e => {
      if (e.status === 'en_cours') return false; // PV réinitialisé — retirer de la validation
      if (filter !== 'all' && e.status !== filter) return false;
      if (centerFilter && e.centerId !== centerFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.trim().toLowerCase();
        if (!e.bureauLabel.toLowerCase().includes(q) &&
            !e.centerName.toLowerCase().includes(q) &&
            !e.bureauName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [pvs, bureauxMap, centersMap, filter, centerFilter, searchFilter, observerOpinions]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'entered':
        return 'Saisi';
      case 'validated':
        return 'Validé';
      case 'anomaly':
        return 'Rejeté';
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

  // Synchroniser l'annotation et la conformité avec le PV sélectionné (propre avis de l'observateur)
  useEffect(() => {
    if (!selectedPVData) return;
    // Chercher l'avis de l'observateur connecté dans la liste multi-avis
    const myOpinion = selectedPVData.opinions?.find(op => op.observer_id === user?.id);
    setObserverAnnotation(myOpinion?.annotation ?? selectedPVData.observer_annotation ?? '');
    setObserverConformity(myOpinion?.conformity ?? selectedPVData.observer_conformity ?? null);
  }, [selectedPVData?.id]);

  // Conformité observateur — upsert dans pv_observer_opinions (multi-avis)
  const submitObserverConformity = async (conformity: 'conforme' | 'non_conforme') => {
    if (!selectedPV || !user) return;
    setSavingAnnotation(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('pv_observer_opinions')
        .upsert({
          pv_id: selectedPV,
          observer_id: user.id,
          annotation: observerAnnotation.trim() || null,
          conformity,
          annotated_at: now,
        }, { onConflict: 'pv_id,observer_id' });
      if (error) { toast.error("Échec de l'enregistrement"); return; }

      setObserverConformity(conformity);

      // Mettre à jour la map locale des avis
      setObserverOpinions(prev => {
        const next = new Map(prev);
        const list = (next.get(selectedPV) || []).filter(op => op.observer_id !== user.id);
        list.push({
          id: `local_${user.id}`,
          observer_id: user.id,
          observer_name: user.name,
          annotation: observerAnnotation.trim() || null,
          conformity,
          annotated_at_str: new Date(now).toLocaleDateString('fr-FR') + ' à ' + new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        });
        next.set(selectedPV, list);
        return next;
      });

      toast.success(conformity === 'conforme' ? 'Avis enregistré : Conforme' : 'Avis enregistré : Réserves');
      // Audit + Notification admins + président du centre
      const pvData = pvs.find(p => p.id === selectedPV);
      const bureau = pvData ? bureauxMap.get(pvData.bureau_id) : null;
      const center = bureau ? centersMap.get(bureau.center_id) : null;
      auditService.log({
        action: 'OPINION',
        resource_type: 'pv_opinion',
        resource_id: selectedPV,
        description: `Avis ${conformity === 'conforme' ? 'conforme' : 'de réserves'} — ${bureau?.name ?? ''}${pvData?.college_type ? ` · Collège ${pvData.college_type}` : ''} — ${center?.name ?? ''}`,
        user_id: user.id,
      }).catch(() => {});
      if (pvData && bureau) {
        notifyObserverOpinion({
          pvId:        selectedPV,
          electionId:  selectedElection,
          centerId:    bureau.center_id,
          centerName:  center?.name ?? 'établissement',
          bureauName:  bureau.name,
          collegeType: pvData.college_type ?? null,
          conformity,
          actorName:   user.name,
        }).catch(() => {/* silencieux */});
      }
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

      // Supprimer le PV pour que le bureau redevienne "non saisi" (re-saisissable, retiré de la validation)
      const { error: resetPVError } = await supabase
        .from('procès_verbaux')
        .delete()
        .eq('id', selectedPV);

      if (resetPVError) {
        console.error('Erreur lors de la réinitialisation du PV:', resetPVError);
        toast.error('Erreur lors de la réinitialisation du PV');
        return;
      }

      // Recharger les PV depuis la DB pour garantir la cohérence (évite les désynchronisations)
      await loadPVs();

      toast.success('Les chiffres du bureau ont été réinitialisés avec succès');
      setFilter('all');
      onDataRefresh?.();
      setDetailOpen(false);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast.error('Erreur lors de la réinitialisation des données');
    } finally {
      setResetting(false);
    }
  };

  // Réinitialiser tous les PV non publiés de l'élection
  const handleResetAllPVs = async () => {
    if (!selectedElection) return;
    setResettingAll(true);
    try {
      // Récupérer les IDs des PV non publiés
      const { data: pvRows, error: fetchErr } = await supabase
        .from('procès_verbaux')
        .select('id')
        .eq('election_id', selectedElection)
        .not('status', 'in', '("published")');
      if (fetchErr) { toast.error('Erreur lors de la récupération des PV.'); return; }
      const ids = (pvRows || []).map((r: any) => r.id);
      if (ids.length === 0) { toast.info('Aucun PV à réinitialiser.'); return; }

      // Supprimer les résultats candidats
      const { error: crErr } = await supabase
        .from('candidate_results')
        .delete()
        .in('pv_id', ids);
      if (crErr) { toast.error('Erreur suppression résultats candidats.'); return; }

      // Supprimer les PV
      const { error: pvErr } = await supabase
        .from('procès_verbaux')
        .delete()
        .in('id', ids);
      if (pvErr) { toast.error('Erreur suppression des PV.'); return; }

      toast.success(`${ids.length} PV réinitialisé(s) avec succès.`);
      await loadPVs();
      onDataRefresh?.();
    } catch (err) {
      console.error('Erreur réinitialisation globale:', err);
      toast.error('Erreur lors de la réinitialisation.');
    } finally {
      setResettingAll(false);
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

        // Combiner candidats filtrés et résultats
        const mapped = filteredCandidates
          .map(c => ({
            id: c.id,
            name: c.name,
            party: c.party,
            suppleant: c.suppleant,
            college_type: c.college_type,
            votes: resultsMap.get(c.id) || 0
          }));

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
            <div className="flex items-center gap-2">
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  disabled={resettingAll || pvs.filter(p => p.status !== 'published').length === 0}
                  onClick={() => setShowResetAllConfirm(true)}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Réinitialiser tous les PV
                </Button>
              )}
              <Badge className="bg-orange-100 text-orange-800">
                {loading ? '...' : pvs.length} PV
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Barre de filtre locale */}
          <div className="flex flex-wrap gap-2 mb-4">
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
            {filterCenters.length > 1 && (
              <select
                value={centerFilter}
                onChange={e => setCenterFilter(e.target.value)}
                className="h-9 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 focus:border-blue-400 outline-none"
              >
                <option value="">Tous les établissements</option>
                {filterCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {(searchFilter || centerFilter) && (
              <button onClick={() => { setSearchFilter(''); setCenterFilter(''); }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">
                Effacer
              </button>
            )}
          </div>
          {/* Filtres statut */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'all',       label: 'Tous' },
                { value: 'pending',   label: 'En attente' },
                { value: 'entered',   label: 'Saisis' },
                { value: 'validated', label: 'Validés' },
                { value: 'anomaly',   label: 'Rejeté' },
                { value: 'published', label: 'Publiés' },
              ] as const).map(s => (
                <Button
                  key={s.value}
                  variant={filter === s.value ? 'default' : 'outline'}
                  onClick={() => setFilter(s.value)}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                >
                  {s.label}
                  {s.value !== 'all' && (
                    <span className="ml-1 opacity-60 text-[10px]">
                      {pvs.filter(p => p.status === s.value).length}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Reset filtre statut */}
            {filter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setFilter('all')}
              >
                <XIcon className="w-3 h-3 mr-1" /> Réinitialiser
              </Button>
            )}

            {/* Compteur résultats */}
            <span className="ml-auto text-xs text-gray-400">
              {displayedPVs.length} / {pvs.length} PV
            </span>
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
              {filteredPVs.map((pv) => {
                const quorumSeuil = (pv.total_registered || 0) / 2;
                const quorumAtteint = pv.total_registered
                  ? (pv.votes_expressed || 0) >= quorumSeuil
                  : true;
                return (
                <div
                  key={pv.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPV === pv.id
                      ? quorumAtteint ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50'
                      : quorumAtteint ? 'border-gray-200 hover:border-gray-300' : 'border-red-300 bg-red-50 hover:border-red-400'
                  }`}
                  onClick={() => { setSelectedPV(pv.id); setDetailOpen(true); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span className={`font-medium ${quorumAtteint ? 'text-gray-900' : 'text-red-800'}`}>{pv.bureauLabel}</span>
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
                      {!quorumAtteint && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                          Quorum non atteint
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

                  <div className={`mt-2 flex justify-between text-xs ${quorumAtteint ? 'text-gray-500' : 'text-red-600'}`}>
                    <span>Votants: {pv.total_voters}</span>
                    <span>Exprimés: {pv.votes_expressed}</span>
                    {!quorumAtteint && pv.total_registered > 0 && (
                      <span className="font-medium">Quorum: {quorumSeuil % 1 === 0 ? quorumSeuil : quorumSeuil.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        
      </div>

      {/* Modal détails PV */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setEditMode(false); setPreviewOpen(false); } }}>
        <DialogContent className={`${previewOpen ? 'max-w-7xl' : 'max-w-4xl'} max-h-[90vh] overflow-y-auto transition-all duration-300`}>
          <DialogHeader>
            <DialogTitle>Détails du PV</DialogTitle>
          </DialogHeader>
            {selectedPVData ? (
              <div className={previewOpen ? 'flex gap-6 items-start' : ''}>
              <div className={previewOpen ? 'w-[480px] flex-shrink-0 space-y-6 overflow-y-auto max-h-[75vh] pr-2' : 'space-y-6'}>

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
                {(editMode ? candidateResults.length > 0 : candidateResults.some(cr => cr.votes > 0)) ? (
                  <div className="space-y-2">
                    {isProElection ? (
                      // Élection professionnelle — groupé par syndicat (même affichage que la saisie)
                      (() => {
                        const syndicatMap = new Map<string, any>();
                        candidateResults.forEach(cr => {
                          const key = (cr.party?.split(' — ')[0] || cr.name || '').trim();
                          if (!syndicatMap.has(key)) {
                            syndicatMap.set(key, { ...cr, allNames: [cr.name], allSuppleants: [cr.suppleant || null] });
                          } else {
                            const existing = syndicatMap.get(key);
                            existing.allNames.push(cr.name);
                            existing.allSuppleants.push(cr.suppleant || null);
                          }
                        });
                        const grouped = Array.from(syndicatMap.values());
                        const collegeGroups = Array.from(new Set(grouped.map(c => c.college_type || 'general')));

                        return collegeGroups.map(ct => {
                          const groupLabel = ct === 'cadres' ? 'Collège Cadres' : ct === 'employes' ? 'Collège Maîtrise' : ct === 'ouvriers' ? 'Collège Exécution' : 'Collège Encadrement';
                          const groupCandidates = grouped.filter(c => (c.college_type || 'general') === ct);
                          return (
                            <div key={ct} className="space-y-2">
                              {collegeGroups.length > 1 && (
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{groupLabel}</h4>
                              )}
                              <div className="space-y-3">
                                {groupCandidates.map(candidate => {
                                  const syndicat = candidate.party?.split(' — ')[0] || '';
                                  const names: string[] = Array.isArray(candidate.allNames) ? candidate.allNames : [candidate.name];
                                  const suppleants: (string | null)[] = Array.isArray(candidate.allSuppleants) ? candidate.allSuppleants : [candidate.suppleant || null];
                                  const hasMultiple = names.length > 1;
                                  return (
                                    <div key={candidate.id} className="p-3 border border-gray-200 rounded-xl bg-white space-y-2">
                                      <p className="font-bold text-blue-700 text-sm">{syndicat}</p>
                                      {hasMultiple ? (
                                        <div className="grid grid-cols-2 gap-2">
                                          {names.map((n, i) => (
                                            <div key={i} className="bg-gray-50 rounded-lg p-2 space-y-0.5">
                                              <p className="text-xs text-gray-400 font-medium">Titulaire #{i + 1}</p>
                                              <p className="text-xs font-semibold text-gray-800 leading-tight">{n}</p>
                                              {suppleants[i] && (
                                                <p className="text-xs text-gray-500 leading-tight">
                                                  <span className="font-medium">Suppléant : </span>{suppleants[i]}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="space-y-0.5">
                                          <p className="text-xs text-gray-400 font-medium">Titulaire</p>
                                          <p className="text-sm font-semibold text-gray-800">{names[0]}</p>
                                          {suppleants[0] && (
                                            <p className="text-xs text-gray-500">
                                              <span className="font-medium">Suppléant : </span>{suppleants[0]}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                        <span className="text-xs text-gray-500">Voix</span>
                                        <div className="w-28">
                                          {editMode ? (
                                            <input
                                              type="number"
                                              className="border rounded px-2 py-1 w-full text-right"
                                              value={candidate.votes}
                                              onChange={e => {
                                                const value = parseInt(e.target.value || '0');
                                                const groupIds = candidateResults
                                                  .filter(cr => (cr.party?.split(' — ')[0] || cr.name || '').trim() === syndicat)
                                                  .map(cr => cr.id);
                                                setCandidateResults(prev => prev.map(c => groupIds.includes(c.id) ? { ...c, votes: value } : c));
                                              }}
                                            />
                                          ) : (
                                            <span className="font-bold text-gray-900 text-sm">{candidate.votes} <span className="text-xs font-normal text-gray-500">voix</span></span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()
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
                {/* ── Avis des observateurs ──────────────────────────────── */}
                {isObserver ? (
                  /* ── Formulaire d'annotation observateur ── */
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 space-y-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-1">
                      Mon annotation
                    </p>
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder={observerConformity === 'non_conforme' ? 'Motif obligatoire pour avis non conforme…' : 'Remarque ou observation (optionnel)…'}
                          value={observerAnnotation}
                          onChange={e => setObserverAnnotation(e.target.value)}
                          className={`flex-1 min-w-0 h-10 px-3 text-sm rounded-xl border bg-slate-50 focus:outline-none focus:bg-white transition ${
                            observerConformity === 'non_conforme' && observerAnnotation.trim().length === 0
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-slate-200 focus:border-slate-400'
                          }`}
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
                          disabled={savingAnnotation || observerAnnotation.trim().length === 0}
                          onClick={() => submitObserverConformity('non_conforme')}
                          title={observerAnnotation.trim().length === 0 ? 'Veuillez saisir un motif avant de signaler une réserves' : ''}
                          className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                            observerConformity === 'non_conforme'
                              ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                              : 'border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          Réserves
                        </button>
                      </div>
                      {/* Message d'aide pour signaler une réserves */}
                      {observerAnnotation.trim().length === 0 && (
                        <p className="text-[11px] text-amber-600 px-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          Un motif est requis pour signaler une réserves.
                        </p>
                      )}
                    </div>
                    {savingAnnotation && (
                      <p className="text-xs text-slate-400 px-1 animate-pulse">Enregistrement…</p>
                    )}
                    {/* Avis déjà soumis par les autres observateurs */}
                    {(selectedPVData?.opinions?.length ?? 0) > 1 && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Avis des autres observateurs</p>
                        {selectedPVData!.opinions!.filter(op => op.observer_id !== user?.id).map(op => (
                          <div key={op.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                            <PenLine className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-600 whitespace-nowrap">{op.observer_name}</span>
                            <span className="text-slate-400 whitespace-nowrap">{op.annotated_at_str}</span>
                            {op.conformity && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${op.conformity === 'conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {op.conformity === 'conforme' ? <><CheckCircle className="w-3 h-3" /> Conforme</> : <><AlertTriangle className="w-3 h-3" /> Réserves</>}
                              </span>
                            )}
                            {op.annotation && <span className="text-slate-600 italic truncate max-w-xs" title={op.annotation}>"{op.annotation}"</span>}
                            {((op as any).reactions ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 pl-3 w-full">
                                {((op as any).reactions ?? []).map((r: any) => (
                                  <span key={r.id} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    r.type === 'overridden' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {r.type === 'overridden' ? 'Réserves rejetée' : 'Approuvé'} — {r.reactor_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Autres rôles : liste de tous les avis */
                  (selectedPVData?.opinions?.length ?? 0) > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-1">
                        Avis observateurs ({selectedPVData!.opinions!.length})
                      </p>
                      {selectedPVData!.opinions!.map(op => {
                        const isTargeted = reactionTarget?.opinionId === op.id;
                        const opReactions = (op as any).reactions ?? [];
                        return (
                          <div key={op.id} className="border rounded-xl p-3 bg-slate-50 space-y-2">
                            {/* Opinion row */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <PenLine className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="font-medium text-slate-600 whitespace-nowrap">{op.observer_name}</span>
                              {op.annotated_at_str && <span className="text-slate-400 whitespace-nowrap">{op.annotated_at_str}</span>}
                              {op.conformity && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                  op.conformity === 'conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {op.conformity === 'conforme'
                                    ? <><CheckCircle className="w-3 h-3" /> Conforme</>
                                    : <><AlertTriangle className="w-3 h-3" /> Réserves</>}
                                </span>
                              )}
                              {op.annotation && (
                                <span className="text-slate-600 italic truncate max-w-xs" title={op.annotation}>"{op.annotation}"</span>
                              )}
                              {/* React button — only when opinion is réserves */}
                              {canReact && op.conformity === 'non_conforme' && !isTargeted && (
                                <button
                                  type="button"
                                  onClick={() => setReactionTarget({ opinionId: op.id, comment: '' })}
                                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap shadow-sm"
                                >
                                  <PenLine className="w-3 h-3" />
                                  Valider
                                </button>
                              )}
                            </div>
                            {/* Reactions list */}
                            {opReactions.length > 0 && (
                              <div className="space-y-1 pl-5">
                                {opReactions.map((r: any) => (
                                  <div key={r.id} className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                    <span className="font-medium text-slate-600">{r.reactor_name}</span>
                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold ${
                                      r.type === 'overridden' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {r.type === 'overridden' ? <><CheckCircle className="w-2.5 h-2.5" /> Réserves rejetée</> : <><CheckCircle className="w-2.5 h-2.5" /> Approuvé</>}
                                    </span>
                                    {r.comment && <span className="italic">"{r.comment}"</span>}
                                    <span className="text-slate-400">{new Date(r.reacted_at).toLocaleDateString('fr-FR')} à {new Date(r.reacted_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Reaction form */}
                            {canReact && isTargeted && (
                              <div className="pl-5 space-y-2 border-t border-slate-100 pt-2">
                                <textarea
                                  rows={2}
                                  placeholder="Commentaire (obligatoire pour annuler la réserves)"
                                  value={reactionTarget!.comment}
                                  onChange={e => setReactionTarget(prev => prev ? { ...prev, comment: e.target.value } : null)}
                                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    disabled={submittingReaction}
                                    onClick={() => submitReaction(op.id, 'approved', reactionTarget!.comment)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Approuver la réserves
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submittingReaction || !reactionTarget!.comment.trim()}
                                    onClick={() => submitReaction(op.id, 'overridden', reactionTarget!.comment)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title={!reactionTarget!.comment.trim() ? 'Commentaire obligatoire' : ''}
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Rejeter la réserves (→ Conforme)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setReactionTarget(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null
                )}

              {/* isLocked : PV validé ou publié — boutons grisés, seul "Se rétracter" reste actif */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-6">
                {!editMode && !readOnly && (
                  <Button disabled={isLocked} onClick={() => {
                    setEditValues({
                      total_registered: (editValues.total_registered || 0),
                      total_voters: (selectedPVData.total_voters || 0),
                      null_votes: (selectedPVData.null_votes || 0),
                      votes_expressed: (selectedPVData.votes_expressed || 0)
                    });
                    setEditMode(true);
                  }} variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    Modifier
                  </Button>
                )}
                {editMode && (
                  <Button disabled={isLocked} onClick={async () => {
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
                  }} className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                )}
      {!readOnly && <Button
        onClick={() => setShowResetConfirm(true)}
        disabled={resetting || isLocked}
        variant="outline"
        className="border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {resetting ? 'Réinitialisation...' : 'Réinitialiser les chiffres du bureau'}
      </Button>}

                {/* Se rétracter — admin + validateur uniquement, grisé si PV non validé/rejeté */}
                {!readOnly && (role === 'super-admin' || role === 'admin' || role === 'validateur') && (
                  <Button
                    variant="outline"
                    disabled={retracting || !(selectedPVData?.status === 'validated' || selectedPVData?.status === 'anomaly')}
                    className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (!selectedPV) return;
                      setRetracting(true);
                      try {
                        const { error } = await supabase
                          .from('procès_verbaux')
                          .update({
                            status: 'entered',
                            validated_by: null,
                            validated_at: null,
                            rejection_comment: null,
                          })
                          .eq('id', selectedPV);
                        if (error) { toast.error('Échec de la rétractation'); return; }
                        setPvs(prev => prev.map(p =>
                          p.id === selectedPV
                            ? { ...p, status: 'entered', validated_by: null, validated_at: null }
                            : p
                        ));
                        toast.success('Rétractation effectuée — PV remis en attente de validation');
                        setDetailOpen(false);
                      } finally {
                        setRetracting(false);
                      }
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {retracting ? 'Rétractation…' : 'Se rétracter'}
                  </Button>
                )}

                {/* Boutons d'action — masqués pour l'observateur, grisés si PV verrouillé */}
                {!readOnly && <>
                {/* Rejeter — grisé pour tous si PV validé ou publié */}
                <Button
                  variant="outline"
                  disabled={isLocked || selectedPVStatus === 'validated' || selectedPVStatus === 'published'}
                  className="border-orange-400 text-orange-700 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { setRejectComment(''); setShowRejectDialog(true); }}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Rejeter
                </Button>
                {/* Valider — grisé pour tous si PV validé ou publié */}
                <Button
                  disabled={isLocked || selectedPVStatus === 'validated' || selectedPVStatus === 'published'}
                  onClick={async () => {
                    if (!selectedPV) return;
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    const { error } = await supabase
                      .from('procès_verbaux')
                      .update({ status: 'validated', validated_at: new Date().toISOString(), validated_by: authUser?.id || null })
                      .eq('id', selectedPV);
                    if (!error) {
                      setPvs(prev => prev.map(p => p.id === selectedPV ? { ...p, status: 'validated', validated_by: authUser?.id || null, validated_at: new Date().toISOString() } : p));
                      // Audit
                      const pvD  = pvs.find(p => p.id === selectedPV);
                      const bur  = pvD ? bureauxMap.get(pvD.bureau_id) : null;
                      const ctr  = bur ? centersMap.get(bur.center_id) : null;
                      auditService.log({
                        action: 'VALIDATE',
                        resource_type: 'procès_verbaux',
                        resource_id: selectedPV!,
                        description: `Validation du PV — ${bur?.name ?? ''}${pvD?.college_type ? ` · Collège ${pvD.college_type}` : ''} — ${ctr?.name ?? ''}`,
                        user_id: authUser?.id,
                      }).catch(() => {});
                      // Notification : agent + admins
                      if (pvD && bur && user) {
                        notifyPVValidated({
                          pvId:          selectedPV!,
                          electionId:    selectedElection,
                          centerId:      bur.center_id,
                          centerName:    ctr?.name ?? 'établissement',
                          bureauName:    bur.name,
                          collegeType:   pvD.college_type ?? null,
                          submittedById: pvD.entered_by ?? null,
                          actorName:     user.name,
                        }).catch(() => {});
                      }
                      setDetailOpen(false);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Valider
                </Button>
                </>}
                </div>
              </div>
              {previewOpen && previewUrl && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h4 className="font-medium text-gray-900 text-sm">Document scanné</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewOpen(false)}
                      className="text-gray-400 hover:text-gray-600 h-7 w-7 p-0"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                  <div style={{ height: '70vh' }}>
                    {previewUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe src={previewUrl} className="w-full h-full border-0 rounded-lg shadow-sm" title="Document PV" />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border border-gray-200">
                        <img src={previewUrl} alt="PV" className="max-w-full max-h-full object-contain p-2" />
                      </div>
                    )}
                  </div>
                </div>
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

      {/* Modal de confirmation réinitialisation GLOBALE */}
      <Dialog open={showResetAllConfirm} onOpenChange={setShowResetAllConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Réinitialiser tous les PV
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Tous les PV saisis (hors publiés) seront supprimés définitivement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-2">Cette action va :</p>
                  <ul className="space-y-1 text-red-700">
                    <li>• Supprimer tous les PV en attente, saisis, validés et rejetés</li>
                    <li>• Supprimer tous les votes candidats associés</li>
                    <li>• Remettre tous les bureaux à "En attente de saisie"</li>
                    <li>• Les PV déjà publiés ne sont pas affectés</li>
                  </ul>
                  <p className="font-semibold mt-2">Cette action est irréversible.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetAllConfirm(false)} disabled={resettingAll}>
              Annuler
            </Button>
            <Button
              onClick={async () => { setShowResetAllConfirm(false); await handleResetAllPVs(); }}
              disabled={resettingAll}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {resettingAll ? 'Réinitialisation…' : 'Confirmer — Tout réinitialiser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de rejet avec commentaire obligatoire ──────────────────── */}
      <Dialog open={showRejectDialog} onOpenChange={v => { if (!rejecting) setShowRejectDialog(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <XCircle className="w-5 h-5" />
              Rejeter le PV — Renvoi en saisie
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Le PV sera renvoyé à l'agent de saisie pour correction. Un commentaire est obligatoire.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
              <span>Le statut passera à <strong>Rejeté</strong>. L'agent de saisie pourra consulter votre commentaire et corriger les données.</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Motif du rejet <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Expliquez pourquoi ce PV est rejeté (obligatoire)…"
                value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
                  rejectComment.trim().length === 0 ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-orange-200'
                }`}
              />
              {rejectComment.trim().length === 0 && (
                <p className="text-xs text-red-500">Le commentaire est requis pour rejeter un PV.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={rejecting}>
              Annuler
            </Button>
            <Button
              disabled={rejecting || rejectComment.trim().length === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={async () => {
                if (!selectedPV || rejectComment.trim().length === 0) return;
                setRejecting(true);
                try {
                  const { data: { user: authUser } } = await supabase.auth.getUser();
                  const { error } = await supabase
                    .from('procès_verbaux')
                    .update({
                      status: 'anomaly',
                      validated_by: authUser?.id || null,
                      validated_at: new Date().toISOString(),
                      rejection_comment: rejectComment.trim(),
                    })
                    .eq('id', selectedPV);
                  if (error) { toast.error('Échec du rejet'); return; }
                  setPvs(prev => prev.map(p =>
                    p.id === selectedPV
                      ? { ...p, status: 'anomaly', validated_by: authUser?.id || null, validated_at: new Date().toISOString() }
                      : p
                  ));
                  toast.success('PV rejeté — renvoyé en saisie');
                  // Audit + Notification : agent + admins
                  const pvD2 = pvs.find(p => p.id === selectedPV);
                  const bur2 = pvD2 ? bureauxMap.get(pvD2.bureau_id) : null;
                  const ctr2 = bur2 ? centersMap.get(bur2.center_id) : null;
                  auditService.log({
                    action: 'REJECT',
                    resource_type: 'procès_verbaux',
                    resource_id: selectedPV!,
                    description: `Rejet du PV — ${bur2?.name ?? ''}${pvD2?.college_type ? ` · Collège ${pvD2.college_type}` : ''} — ${ctr2?.name ?? ''} : ${rejectComment}`,
                    user_id: authUser?.id,
                  }).catch(() => {});
                  if (pvD2 && bur2 && user) {
                    notifyPVRejected({
                      pvId:          selectedPV!,
                      electionId:    selectedElection,
                      centerId:      bur2.center_id,
                      centerName:    ctr2?.name ?? 'établissement',
                      bureauName:    bur2.name,
                      collegeType:   pvD2.college_type ?? null,
                      submittedById: pvD2.entered_by ?? null,
                      comment:       rejectComment,
                      actorName:     user.name,
                    }).catch(() => {});
                  }
                  setShowRejectDialog(false);
                  setDetailOpen(false);
                } finally {
                  setRejecting(false);
                }
              }}
            >
              {rejecting ? 'Rejet en cours…' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PVValidationSection;
