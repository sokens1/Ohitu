/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Upload,
  FileText,
  Calculator,
  ArrowLeft,
  Calendar,
  Users,
  FolderOpen,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { resolveCandidatesForElection } from '@/lib/candidateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { notifyPVSubmitted } from '@/lib/notificationService';
import DocumentPreviewModal from '@/components/ui/DocumentPreviewModal';
import { getRegisteredVotersLabel, isProfessionalElection } from '@/utils/electionCalculations';

import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { Skeleton } from '@/components/ui/skeleton';

// Normalise n'importe quelle valeur de collège vers les clés brutes DB
const toRawCollegeKey = (val: string | null | undefined): string | null => {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v === 'general' || v === 'encadrement') return 'general';
  if (v === 'cadres' || v === 'cadre') return 'cadres';
  if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
  if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
  return val;
};
const toCollegeLabel = (key: string | null | undefined): string => {
  if (key === 'general')  return 'Encadrement';
  if (key === 'cadres')   return 'Cadres';
  if (key === 'employes') return 'Maîtrise';
  if (key === 'ouvriers') return 'Exécution';
  return key || '—';
};

interface PrefillData {
  centreId?: string;
  bureauId?: string;
  collegeType?: string | null;
}

interface PVEntrySectionProps {
  onClose: () => void;
  selectedElection: string;
  readOnly?: boolean;
  prefill?: PrefillData | null;
}

const PVEntrySection: React.FC<PVEntrySectionProps> = ({ onClose, selectedElection, readOnly = false, prefill = null }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [electionInfo, setElectionInfo] = useState<any>(null);
  const [candidatesData, setCandidatesData] = useState<any[]>([]);
  const [electoralColleges, setElectoralColleges] = useState<any[]>([]);
  const [votingCenters, setVotingCenters] = useState<any[]>([]);
  const [votingBureaux, setVotingBureaux] = useState<any[]>([]);
  // Collèges rattachés à chaque établissement (pseudo-entrées de voting_bureaux avec college non null)
  // Clé : center_id | Valeur : tableau de { college, seats_to_fill, ... }
  const [centerCollegesMap, setCenterCollegesMap] = useState<Map<string, any[]>>(new Map());
  // Clés "centreId_bureauId" des PV déjà soumis pour cette élection
  const [submittedColleges, setSubmittedColleges] = useState<Set<string>>(new Set());
  // Clés "bureauId_collegeKey" pour tracker les PV soumis par bureau physique et collège
  const [submittedBureauColleges, setSubmittedBureauColleges] = useState<Set<string>>(new Set());
  // Nb votants déjà saisis par bureauId (pour pré-remplir le champ votants)
  const [submittedVotersMap, setSubmittedVotersMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showQuorumWarning, setShowQuorumWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Sélection d'un PV existant
  const [showExistingPvPicker, setShowExistingPvPicker] = useState(false);
  const [existingValidatedPvs, setExistingValidatedPvs] = useState<{ id: string; bureau_name: string; pv_photo_url: string }[]>([]);
  const [loadingExistingPvs, setLoadingExistingPvs] = useState(false);
  const [selectedExistingPvUrl, setSelectedExistingPvUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('Document');
  const [formData, setFormData] = useState({
    province: '',
    ville: '',
    centre: '',
    college: '',   // clé brute du collège sélectionné (pro elections uniquement)
    bureau: '',
    inscrits: '',
    sieges: '',
    votants: '',
    bulletinsNuls: '',
    suffragesExprimes: '',
    candidateVotes: {} as Record<string, string>,
    uploadedFile: null as File | null
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const network = useNetworkQuality();
  const [hasDraft, setHasDraft] = useState(false);

  // Sauvegarde automatique du brouillon (hors fichier binaire)
  useEffect(() => {
    if (!selectedElection) return;
    const { uploadedFile, ...serializableData } = formData;
    
    const hasData = serializableData.centre || 
                    serializableData.bureau || 
                    serializableData.votants || 
                    serializableData.bulletinsNuls || 
                    Object.keys(serializableData.candidateVotes).length > 0;
                    
    if (hasData) {
      localStorage.setItem(`ohitu_pv_draft_${selectedElection}`, JSON.stringify(serializableData));
    }
  }, [formData, selectedElection]);

  // Détecter la présence d'un brouillon au montage
  useEffect(() => {
    if (!selectedElection) return;
    const saved = localStorage.getItem(`ohitu_pv_draft_${selectedElection}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        // Ne considérer comme brouillon que s'il y a des données réelles
        if (draft && (draft.centre || draft.bureau || draft.votants || Object.keys(draft.candidateVotes || {}).length > 0)) {
          setHasDraft(true);
        }
      } catch (e) {
        console.error('Erreur lecture brouillon:', e);
      }
    }
  }, [selectedElection]);

  const restoreDraft = () => {
    if (!selectedElection) return;
    const saved = localStorage.getItem(`ohitu_pv_draft_${selectedElection}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setFormData(prev => ({
          ...prev,
          ...draft,
          uploadedFile: null
        }));
        if (draft.bureau) {
          setCurrentStep(2);
        }
        setHasDraft(false);
        toast.success('Brouillon de saisie restauré avec succès.');
      } catch (e) {
        toast.error('Échec de la restauration du brouillon.');
      }
    }
  };

  const discardDraft = () => {
    if (!selectedElection) return;
    localStorage.removeItem(`ohitu_pv_draft_${selectedElection}`);
    setHasDraft(false);
    toast.info('Brouillon supprimé.');
  };

  // Référence stable vers prefill pour l'utiliser dans loadAll sans le mettre en dépendance
  const prefillRef = useRef(prefill);
  useEffect(() => { prefillRef.current = prefill; }, [prefill]);

  // Chargement unique : centres/bureaux + données élection en parallèle
  useEffect(() => {
    const loadAll = async () => {
      if (!selectedElection) return;
      setLoading(true);

      try {
        // Étape 1 : centres+bureaux ET info élection en parallèle
        const [centersResult, electionResult] = await Promise.all([
          supabase
            .from('election_centers')
            .select(`
              voting_centers(
                id, name,
                voting_bureaux!center_id(id, name, center_id, registered_voters, college_type, election_id, college, seats_to_fill)
              )
            `)
            .eq('election_id', selectedElection),
          supabase
            .from('elections')
            .select('*')
            .eq('id', selectedElection)
            .single(),
        ]);

        // Traitement centres/bureaux
        const centersData = centersResult.data;
        const centers: Array<{ id: string; name: string }> = [];
        const physicalBureaux: Array<any> = [];
        const collegesMap = new Map<string, any[]>();

        if (!centersResult.error && centersData && centersData.length > 0) {
          const isCollegeEntry = (b: any) =>
            b.name?.startsWith?.('College -') ||
            (b.college != null && b.college !== 'general');

          for (const link of centersData) {
            const center = (link as any).voting_centers;
            if (!center) continue;
            centers.push({ id: center.id, name: center.name });

            const centerBureaux = (Array.isArray(center.voting_bureaux) ? center.voting_bureaux : [])
              .filter((b: any) =>
                !b.election_id ||
                b.election_id === selectedElection ||
                String(b.election_id) === String(selectedElection)
              );

            const collegePseudos = centerBureaux.filter(isCollegeEntry);
            const physical       = centerBureaux.filter((b: any) => !isCollegeEntry(b));

            physicalBureaux.push(...physical);
            if (collegePseudos.length > 0) collegesMap.set(center.id, collegePseudos);
          }
        }

        setVotingCenters(centers);
        setVotingBureaux(physicalBureaux);
        setCenterCollegesMap(collegesMap);

        // Traitement info élection
        if (electionResult.error) throw electionResult.error;
        const election = electionResult.data;
        setElectionInfo(election);

        // Étape 2 : collèges + candidats en parallèle (nécessite le type d'élection)
        const isPro = isProfessionalElection(election?.type);
        const [mappedCandidates, collegesResult] = await Promise.all([
          resolveCandidatesForElection(selectedElection, election?.type),
          isPro
            ? supabase
                .from('electoral_colleges')
                .select('id, name, college_type, total_voters, seats_to_fill')
                .eq('election_id', selectedElection)
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        setCandidatesData(mappedCandidates);
        const loadedColleges = (collegesResult as any).data || [];
        setElectoralColleges(loadedColleges);

        // Charger les PV déjà soumis pour verrouiller les collèges déjà saisis
        if (isPro) {
          const { data: existingPVs } = await supabase
            .from('procès_verbaux')
            .select('bureau_id, college_type, total_voters')
            .eq('election_id', selectedElection)
            .in('status', ['entered', 'saisi', 'validated', 'published']);

          // Construire la map inverse : pseudo-entry id → center_id + college_key
          const pseudoToCenterMap = new Map<string, string>();
          const pseudoToCollegeKeyMap = new Map<string, string>();
          collegesMap.forEach((pseudos, centerId) => {
            pseudos.forEach((p: any) => {
              const bureauId = String(p.id);
              pseudoToCenterMap.set(bureauId, centerId);
              pseudoToCollegeKeyMap.set(bureauId, toRawCollegeKey(p.college_type || p.college) || 'general');
            });
          });

          const doneKeys = new Set<string>();
          const bcDoneKeys = new Set<string>();
          const votersMap = new Map<string, number>();
          (existingPVs || []).forEach((pv: any) => {
            const bureauId = String(pv.bureau_id);
            if (pv.bureau_id) votersMap.set(bureauId, Number(pv.total_voters) || 0);

            const centerId = pseudoToCenterMap.get(bureauId);
            const collegeKey = toRawCollegeKey(pv.college_type || pseudoToCollegeKeyMap.get(bureauId)) || 'general';

            if (bureauId && collegeKey) {
              bcDoneKeys.add(`${bureauId}_${collegeKey}`);
            }

            if (centerId) {
              doneKeys.add(`${centerId}_${bureauId}`);
              doneKeys.add(`${centerId}_${collegeKey}`);
            } else {
              const physical = physicalBureaux.find((b: any) => String(b.id) === bureauId);
              if (physical && physical.center_id) {
                const physicalCenterId = String(physical.center_id);
                doneKeys.add(`${physicalCenterId}_${bureauId}`);
                if (pv.college_type) {
                  doneKeys.add(`${physicalCenterId}_${collegeKey}`);
                }
              }
            }
          });
          setSubmittedColleges(doneKeys);
          setSubmittedBureauColleges(bcDoneKeys);
          setSubmittedVotersMap(votersMap);
        }

        // Pré-remplissage depuis la prop prefill (transmise par DataEntrySection, sans localStorage)
        const pf = prefillRef.current;
        if (pf?.centreId) {
          const preCenterId    = pf.centreId;
          const preBureauId    = pf.bureauId || '';
          const preCollegeType = toRawCollegeKey(pf.collegeType || '') || pf.collegeType || null;

          let bureauId = preBureauId;
          let rv = 0;
          let sieges = 0;

          if (isPro && preCollegeType) {
            // inscrits depuis la pseudo-entrée du collège (per-établissement)
            // NE PAS utiliser electoral_colleges.total_voters qui est le total GLOBAL de tous les établissements
            const pseudos = collegesMap.get(preCenterId) || [];
            const pseudo  = pseudos.find((p: any) =>
              (toRawCollegeKey(p.college_type || p.college) || 'general') === preCollegeType
            );
            rv = Number(pseudo?.registered_voters) || 0;
            if (!bureauId && pseudo?.id) bureauId = String(pseudo.id);
            // Sièges : priorité aux données per-établissement (voting_bureaux), fallback global electoral_colleges
            const col  = loadedColleges.find((c: any) => toRawCollegeKey(c.college_type) === preCollegeType);
            sieges = Number(pseudo?.seats_to_fill) || Number(col?.seats_to_fill) || 0;
          } else if (bureauId) {
            const preBureau = physicalBureaux.find((b: any) => String(b.id) === bureauId);
            rv = Number(preBureau?.registered_voters) || 0;
          }

          setFormData(prev => ({
            ...prev,
            centre:   preCenterId,
            ...(preCollegeType ? { college: preCollegeType } : {}),
            ...(bureauId       ? { bureau:  bureauId }       : {}),
            ...(rv > 0         ? { inscrits: String(rv) }    : {}),
            ...(sieges > 0     ? { sieges:   String(sieges) } : {}),
          }));
        }

      } catch (error) {
        console.error('Erreur lors du chargement PVEntry:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [selectedElection]);

  // Auto-sélection du bureau quand il n'y en a qu'un seul pour le collège/centre en cours
  useEffect(() => {
    if (!formData.college || !formData.centre) return;
    const realBureaux = votingBureaux.filter((b: any) => String(b.center_id) === String(formData.centre));
    const ps = centerCollegesMap.get(formData.centre) || [];
    const allB = realBureaux.length > 0 ? realBureaux : ps;
    if (allB.length !== 1) return;
    const singleId = String(allB[0].id);
    setFormData(prev => {
      if (prev.bureau === singleId) return prev;
      return { ...prev, bureau: singleId };
    });
  }, [formData.college, formData.centre, votingBureaux, centerCollegesMap]);

  // Validation en temps réel
  const validateParticipation = () => {
    const errors: Record<string, string> = {};
    const votants = parseInt(formData.votants) || 0;
    const nuls = parseInt(formData.bulletinsNuls) || 0;
    const exprimes = parseInt(formData.suffragesExprimes) || 0;
    // Inscrits saisis en priorité, sinon depuis le bureau sélectionné
    const selectedBureau = votingBureaux.find(b => b.id === formData.bureau);
    const inscrits = (parseInt(formData.inscrits) || 0) || (selectedBureau?.registered_voters || 0);

    const inscritsLabel = getRegisteredVotersLabel(electionInfo?.type).toLowerCase();
    if (votants > inscrits) {
      errors.votants = `Le nombre de votants (${votants}) ne peut pas dépasser le nombre d'${inscritsLabel} (${inscrits})`;
    }

    if ((nuls + exprimes) !== votants && votants > 0) {
      errors.total = `Bulletins nuls (${nuls}) + Suffrages exprimés (${exprimes}) = ${nuls + exprimes} ≠ Votants (${votants})`;
    }

    return errors;
  };

  const validateCandidateVotes = () => {
    const errors: Record<string, string> = {};
    if (!candidatesData || candidatesData.length === 0) return errors;
    const exprimes = parseInt(formData.suffragesExprimes) || 0;
    const totalVotes = Object.values(formData.candidateVotes).reduce((sum, votes) => sum + (parseInt(votes) || 0), 0);
    if (totalVotes !== exprimes && exprimes > 0) {
      errors.candidateTotal = `Total des voix des candidats (${totalVotes}) ≠ Suffrages exprimés (${exprimes})`;
    }
    return errors;
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!formData.centre) errors.centre = 'Veuillez sélectionner un établissement.';
    if (isProfessionalElection(electionInfo?.type) && !formData.college) errors.college = 'Veuillez sélectionner un collège.';
    if (!formData.bureau) errors.bureau = 'Veuillez sélectionner un bureau de vote.';
    return errors;
  };

  const handleStepValidation = (step: number) => {
    let errors: Record<string, string> = {};

    if (step === 1) {
      errors = validateStep1();
    } else if (step === 2) {
      errors = validateParticipation();
    } else if (step === 3) {
      errors = { ...validateParticipation(), ...validateCandidateVotes() };
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (handleStepValidation(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const compressImageFile = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1600;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.substring(0, file.name.lastIndexOf('.')) + '.jpg', {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Ouvre le picker de PV existants pour le centre + bureau + collège sélectionnés
  const handleOpenExistingPvPicker = async () => {
    if (!formData.centre) {
      toast.warning('Veuillez d\'abord sélectionner un établissement.');
      return;
    }
    setLoadingExistingPvs(true);
    setShowExistingPvPicker(true);
    try {
      // Collège du bureau sélectionné (pour filtrer les establishment_documents)
      const selectedBureauObj = votingBureaux.find((b: any) => String(b.id) === String(formData.bureau));
      const bureauCollegeType: string | null =
        selectedBureauObj?.college_type || selectedBureauObj?.college || null;

      const results: { id: string; bureau_name: string; pv_photo_url: string }[] = [];

      // ── Source 1 : procès_verbaux (PVs déjà saisis avec photo) ─────────────
      const { data: pvRows } = await supabase
        .from('procès_verbaux')
        .select('id, pv_photo_url, bureau_id, college_type, voting_bureaux!bureau_id(id, name, center_id)')
        .eq('election_id', selectedElection)
        .in('status', ['validated', 'validé', 'published'])
        .not('pv_photo_url', 'is', null);

      (pvRows || [])
        .filter((pv: any) =>
          String((pv as any).voting_bureaux?.center_id) === String(formData.centre) &&
          pv.pv_photo_url
        )
        .forEach((pv: any) => {
          results.push({
            id:          `pv_${pv.id}`,
            bureau_name: (pv as any).voting_bureaux?.name || 'Bureau',
            pv_photo_url: pv.pv_photo_url as string,
          });
        });

      // ── Source 2 : establishment_documents (PV déposés par le président) ────
      // Filtres : élection + centre + type PV + statut validé/réservé
      // + collège correspondant au bureau sélectionné (si connu)
      let docQuery = supabase
        .from('establishment_documents')
        .select('id, file_url, file_name, college_type, status, uploaded_at')
        .eq('election_id', selectedElection)
        .eq('center_id', formData.centre)
        .eq('document_type', 'pv')
        .in('status', ['validated', 'reserved']);

      // Filtrer par collège uniquement si le bureau a un collège défini
      if (bureauCollegeType) {
        docQuery = docQuery.eq('college_type', bureauCollegeType);
      }

      const { data: docRows } = await docQuery.order('uploaded_at', { ascending: false });

      (docRows || []).forEach((doc: any) => {
        const collegeLabel = doc.college_type
          ? ` — ${doc.college_type}`
          : '';
        const statusLabel  = doc.status === 'reserved' ? ' (réserve)' : '';
        results.push({
          id:           `doc_${doc.id}`,
          bureau_name:  `PV président${collegeLabel}${statusLabel}`,
          pv_photo_url: doc.file_url,
        });
      });

      if (results.length === 0) {
        toast.info('Aucun PV validé trouvé pour cet établissement / collège.');
      }

      setExistingValidatedPvs(results);
    } catch (e) {
      toast.error('Erreur lors du chargement des PV existants.');
      setShowExistingPvPicker(false);
    } finally {
      setLoadingExistingPvs(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const isSlowConnection = network.quality === 'poor' || network.quality === 'fair' || !network.isOnline;
      
      if (isSlowConnection && file.type.startsWith('image/')) {
        const loadingToast = toast.loading('Qualité réseau limitée détectée. Compression du PV en cours...');
        try {
          const compressed = await compressImageFile(file);
          setFormData({ ...formData, uploadedFile: compressed });
          toast.dismiss(loadingToast);
          toast.success(`Compression terminée : ${(file.size / 1024 / 1024).toFixed(1)} Mo ➔ ${(compressed.size / 1024).toFixed(0)} Ko.`);
        } catch (e) {
          toast.dismiss(loadingToast);
          setFormData({ ...formData, uploadedFile: file });
        }
      } else {
        setFormData({ ...formData, uploadedFile: file });
      }
    }
  };

  const ensureBucketExists = async (bucket: string) => {
    // Supabase Storage n'a pas d'API REST directe listant les buckets via client JS v2,
    // on tente createBucket (idempotent côté serveur si même nom), sinon on ignore si déjà existant.
    try {
      // @ts-ignore: createBucket disponible sur supabase.storage via admin policies si autorisé
      await supabase.storage.createBucket(bucket, { public: true });
    } catch (err: any) {
      // Si existe déjà, on continue
      if (!(`${err?.message || ''}`.toLowerCase().includes('already exists'))) {
        // On ignore l'erreur, l'upload échouera s'il n'existe vraiment pas
      }
    }
  };

  const uploadPVFile = async (file: File, electionId: string, centerId: string, bureauId: string) => {
    const bucket = 'pv-uploads';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const relPath = `${electionId}/${centerId || 'center'}/${bureauId || 'bureau'}/${timestamp}_${safeName}`;

    // Première tentative
    let { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(relPath, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });

    // Si bucket introuvable, tenter de le créer puis réessayer
    if (uploadErr && (`${uploadErr?.message || ''}`.toLowerCase().includes('bucket not found') || `${uploadErr?.error || ''}`.toLowerCase().includes('bucket'))) {
      await ensureBucketExists(bucket);
      ({ data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(relPath, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined }));
    }

    if (uploadErr) throw uploadErr;
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(uploadData!.path);
    return publicUrlData.publicUrl;
  };

  // Fonction pour recalculer le total des inscrits d'une élection
  // basé uniquement sur les PV de cette élection (sans écraser les données des bureaux)
  const recalculateElectionVoters = async (electionId: string) => {
    try {
      // Récupérer tous les PV de cette élection
      const { data: pvs, error: pvError } = await supabase
        .from('procès_verbaux')
        .select('total_registered')
        .eq('election_id', electionId);
      
      if (pvError) {
        console.error('Erreur lors du calcul des inscrits:', pvError);
        return;
      }
      
      // Calculer le total des inscrits pour cette élection
      const totalInscrits = (pvs || []).reduce((sum, pv) => sum + (pv.total_registered || 0), 0);
      
      // Mettre à jour le champ nb_electeurs de l'élection
      const { error: updateError } = await supabase
        .from('elections')
        .update({ 
          nb_electeurs: totalInscrits,
          updated_at: new Date().toISOString()
        })
        .eq('id', electionId);
      
      if (updateError) {
        console.error('Erreur lors de la mise à jour nb_electeurs:', updateError);
      } else {
        console.log(`✅ Total inscrits mis à jour pour l'élection ${electionId}: ${totalInscrits}`);
      }
    } catch (err) {
      console.error('Erreur lors du recalcul des inscrits:', err);
    }
  };

  const handleSubmitPVConfirmed = async () => {
    setShowQuorumWarning(false);
    await doSubmitPV();
  };

  const handleSubmitPV = async () => {
    if (!canSubmit() || !selectedElection) return;
    const inscrits = parseInt(formData.inscrits) || 0;
    const exprimes = parseInt(formData.suffragesExprimes) || 0;
    const quorum = inscrits / 2;
    if (inscrits > 0 && exprimes < quorum) {
      setShowQuorumWarning(true);
      return;
    }
    await doSubmitPV();
  };

  const doSubmitPV = async () => {
    if (!canSubmit() || !selectedElection) return;
    try {
      setSubmitting(true);
      const bureauId = formData.bureau;
      const centerId = formData.centre;

      if (!bureauId) {
        toast.error('Aucun bureau sélectionné. Veuillez retourner à l\'étape 1.');
        setCurrentStep(1);
        setSubmitting(false);
        return;
      }

      // Récupérer les inscrits du bureau si possible, mais prioriser champ saisi
      let registeredVoters = parseInt(formData.inscrits) || 0;
      try {
        const { data: bInfo, error: bErr } = await supabase
          .from('voting_bureaux')
          .select('registered_voters')
          .eq('id', bureauId)
          .single();
        if (!bErr && bInfo && !registeredVoters) {
          registeredVoters = bInfo.registered_voters || 0;
          setFormData(prev => ({ ...prev, inscrits: String(registeredVoters) }));
        }
      } catch (e) {
        // ignore et rester à 0
      }

      let pvPhotoUrl: string | null = selectedExistingPvUrl || null;
      if (formData.uploadedFile) {
        try {
          pvPhotoUrl = await uploadPVFile(formData.uploadedFile, selectedElection, centerId, bureauId);
        } catch (uploadErr: any) {
          console.error('Upload PV échoué:', uploadErr);
          toast.warning(`Upload du PV échoué: ${uploadErr?.message || 'erreur inconnue'}. Enregistrement sans fichier.`);
        }
      }

      const total_voters = parseInt(formData.votants) || 0;
      const null_votes = parseInt(formData.bulletinsNuls) || 0;
      const votes_expressed = parseInt(formData.suffragesExprimes) || 0;

      // Pour les élections pro, le collège vient directement du formData
      const collegeType = isProfessionalElection(electionInfo?.type)
        ? (formData.college || null)
        : (votingBureaux.find(b => b.id === bureauId)?.college_type ?? null);

      // Empêcher une double saisie : PV pour (election_id, bureau_id [, college_type pour pro])
      let pvFindQuery = supabase
        .from('procès_verbaux')
        .select('id')
        .eq('election_id', selectedElection)
        .eq('bureau_id', bureauId);
      if (collegeType) pvFindQuery = pvFindQuery.eq('college_type', collegeType);
      const { data: existingPv, error: findPvErr } = await pvFindQuery.limit(1).maybeSingle();
      if (findPvErr) throw findPvErr;

      let pv;
      if (existingPv?.id) {
        const { data: updated, error: updateErr } = await supabase
          .from('procès_verbaux')
          .update({
            total_registered: registeredVoters,
            total_voters,
            null_votes,
            votes_expressed,
            status: 'entered',
            entered_at: new Date().toISOString(),
            pv_photo_url: pvPhotoUrl || undefined,
            college_type: collegeType,
          })
          .eq('id', existingPv.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        pv = updated;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('procès_verbaux')
          .insert({
            election_id: selectedElection,
            bureau_id: bureauId,
            total_registered: registeredVoters,
            total_voters,
            null_votes,
            votes_expressed,
            status: 'entered',
            entered_at: new Date().toISOString(),
            pv_photo_url: pvPhotoUrl,
            college_type: collegeType,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        pv = inserted;
      }

      const candidateEntries = Object.entries(formData.candidateVotes)
        .map(([candidateId, votes]) => ({
          pv_id: pv.id,
          candidate_id: candidateId,
          votes: parseInt(votes) || 0
        }));
      if (candidateEntries.length > 0) {
        // Supprimer les anciens résultats avant de réinsérer (mise à jour d'un PV existant)
        await supabase.from('candidate_results').delete().eq('pv_id', pv.id);
        const { error: crErr } = await supabase.from('candidate_results').insert(candidateEntries);
        if (crErr) throw crErr;
      }

      // Recalculer le total des inscrits pour cette élection
      await recalculateElectionVoters(selectedElection);

      // Supprimer le brouillon local après soumission réussie
      localStorage.removeItem(`ohitu_pv_draft_${selectedElection}`);

      toast.success(existingPv?.id ? 'PV mis à jour avec succès.' : 'PV enregistré avec succès.');
      // Notifier les validateurs + admins du centre concerné
      if (!existingPv?.id && user) {
        // Récupérer le nom du bureau et du centre pour le message
        const { data: bInfo } = await supabase
          .from('voting_bureaux')
          .select('name, center_id, college_type, voting_centers(name)')
          .eq('id', bureauId)
          .single();
        if (bInfo) {
          notifyPVSubmitted({
            pvId:        pv.id,
            electionId:  selectedElection,
            centerId:    bInfo.center_id,
            centerName:  (bInfo as any).voting_centers?.name ?? 'établissement',
            bureauName:  bInfo.name,
            collegeType: bInfo.college_type ?? null,
            actorName:   user.name,
          }).catch(() => {});
        }
      }
      onClose();
    } catch (err) {
      console.error('Erreur soumission PV:', err);
      toast.error('Échec enregistrement PV');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = () => {
    const step2Valid = Object.keys(validateParticipation()).length === 0;
    const step3Valid = Object.keys(validateCandidateVotes()).length === 0;
    // La pièce-jointe n'est pas obligatoire à la saisie
    return step2Valid && step3Valid;
  };

  const getStepIcon = (step: number) => {
    if (currentStep > step) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (currentStep === step) return <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{step}</div>;
    return <div className="w-5 h-5 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-bold">{step}</div>;
  };

  const renderWizardStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isProfessionalElection(electionInfo?.type)
                ? "Identification de l'Établissement et du Bureau"
                : 'Identification du Bureau de Vote'}
            </h3>
            
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : votingCenters.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-xl">⚠️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isProfessionalElection(electionInfo?.type)
                    ? 'Aucun établissement trouvé'
                    : 'Aucun centre de vote trouvé'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {isProfessionalElection(electionInfo?.type)
                    ? "Aucun établissement n'est rattaché à cette élection professionnelle."
                    : "Aucun centre de vote n'est configuré pour cette élection dans la zone géographique correspondante."}
                </p>
                <p className="text-sm text-gray-500">
                  {isProfessionalElection(electionInfo?.type)
                    ? 'Veuillez d\'abord configurer les établissements depuis la section "Gestion des Élections".'
                    : 'Veuillez d\'abord configurer les centres de vote dans la section "Gestion des Élections".'}
                </p>
              </div>
            ) : (
              <div className={`grid grid-cols-1 gap-4 ${isProfessionalElection(electionInfo?.type) ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <div>
                  <Label htmlFor="centre">
                    {isProfessionalElection(electionInfo?.type) ? 'Établissement' : 'Centre de Vote'}
                  </Label>
                  <Select
                    value={formData.centre}
                    onValueChange={(value) => setFormData({ ...formData, centre: value, college: '', bureau: '' })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        isProfessionalElection(electionInfo?.type)
                          ? 'Sélectionner un établissement'
                          : 'Sélectionner un centre'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {votingCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Élection professionnelle : select collège + bureau */}
                {isProfessionalElection(electionInfo?.type) ? (() => {
                  const allPseudos = centerCollegesMap.get(formData.centre) || [];
                  // Grouper les pseudo-entrées par clé de collège (plusieurs bureaux possibles par collège)
                  const collegeMap = new Map<string, { label: string; pseudos: any[] }>();
                  allPseudos.forEach((p: any) => {
                    const key = toRawCollegeKey(p.college_type || p.college) || 'general';
                    if (!collegeMap.has(key)) collegeMap.set(key, { label: toCollegeLabel(key), pseudos: [] });
                    collegeMap.get(key)!.pseudos.push(p);
                  });
                  // Fallback : construire depuis electoral_colleges si aucune pseudo-entrée
                  if (collegeMap.size === 0) {
                    electoralColleges.forEach((ec: any) => {
                      const key = toRawCollegeKey(ec.college_type) || 'general';
                      if (!collegeMap.has(key)) collegeMap.set(key, { label: toCollegeLabel(key), pseudos: [] });
                    });
                  }
                  const options = Array.from(collegeMap.entries()).map(([key, { label, pseudos: ps }]) => ({ key, label, pseudos: ps }));

                  // Pseudo-entrées du collège sélectionné (pour fallback bureau unique)
                  const collegePseudos = formData.college ? (collegeMap.get(formData.college)?.pseudos || []) : [];
                  // Vrais bureaux de vote du centre (non pseudo-entrées)
                  const realBureauxForCenter = votingBureaux.filter((b: any) =>
                    String(b.center_id) === String(formData.centre)
                  );
                  // Physiques si disponibles, sinon pseudo-entrée comme bureau unique implicite
                  const allBureauxForCollege = realBureauxForCenter.length > 0 ? realBureauxForCenter : collegePseudos;
                  // Le select bureau est actif seulement s'il y a plusieurs vrais bureaux
                  const multiplesBureaux = realBureauxForCenter.length > 1;
                  // physicalForCollege alias pour le trigger "Bureau unique" (1 seul bureau physique)
                  const physicalForCollege = realBureauxForCenter;

                  // Calcul des votants pré-remplis : inscrits - votants déjà saisis sur les autres bureaux du même collège
                  const computeVotantsPrefill = (bureauId: string, inscrits: number): string => {
                    if (!inscrits) return '';
                    const otherVotants = allBureauxForCollege
                      .filter((b: any) => String(b.id) !== bureauId)
                      .reduce((sum: number, b: any) => sum + (submittedVotersMap.get(String(b.id)) || 0), 0);
                    const prefill = Math.max(0, inscrits - otherVotants);
                    return prefill > 0 ? String(prefill) : '';
                  };

                  return (
                    <>
                      <div>
                        <Label>Collège</Label>
                        <Select
                          value={formData.college}
                          onValueChange={(collegeKey) => {
                            const col = collegeMap.get(collegeKey);
                            const ps = col?.pseudos || [];
                            // Vrais bureaux du centre (tous, sans filtre college_type)
                            const realBureaux = votingBureaux.filter((b: any) =>
                              String(b.center_id) === String(formData.centre)
                            );
                            // Vrais bureaux si disponibles, sinon pseudo-entrée comme bureau unique
                            const allB = realBureaux.length > 0 ? realBureaux : ps;
                            // Auto-sélectionner si un seul bureau
                            const bureauId = allB.length === 1 ? String(allB[0].id) : '';
                            // inscrits depuis les pseudo-entrées du collège (per-établissement)
                            // NE PAS utiliser ec?.total_voters (electoral_colleges) qui est le total GLOBAL
                            const ec = electoralColleges.find((c: any) => toRawCollegeKey(c.college_type) === collegeKey);
                            const rv = ps.reduce((s: number, p: any) => s + (Number(p.registered_voters) || 0), 0);
                            // Sièges : priorité aux données per-établissement (voting_bureaux), fallback global
                            const sieges = ps.reduce((s: number, p: any) => s + (Number(p.seats_to_fill) || 0), 0) || Number(ec?.seats_to_fill) || 0;
                            // Pré-remplir votants = inscrits - votants déjà saisis sur les autres bureaux du collège
                            const otherVotants = allB
                              .filter((b: any) => String(b.id) !== bureauId)
                              .reduce((sum: number, b: any) => sum + (submittedVotersMap.get(String(b.id)) || 0), 0);
                            const votantsPrefill = rv > 0 ? Math.max(0, rv - otherVotants) : 0;
                            setFormData({ ...formData, college: collegeKey, bureau: bureauId, inscrits: rv > 0 ? String(rv) : '', sieges: sieges > 0 ? String(sieges) : '', votants: votantsPrefill > 0 ? String(votantsPrefill) : '' });
                          }}
                          disabled={!formData.centre || loading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un collège" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map(o => {
                              const allBForOption = [
                                ...o.pseudos,
                                ...votingBureaux.filter((b: any) =>
                                  String(b.center_id) === String(formData.centre) &&
                                  (toRawCollegeKey(b.college_type || b.college) || 'general') === o.key &&
                                  !o.pseudos.some((sp: any) => String(sp.id) === String(b.id))
                                ),
                              ];
                              const collegeDoneKey = `${formData.centre}_${o.key}`;
                              const collegePseudoDone = o.pseudos.some((p: any) =>
                                submittedColleges.has(`${formData.centre}_${String(p.id)}`)
                              );
                              const collegePhysicalDone = allBForOption.length > 0 && allBForOption.every((b: any) =>
                                submittedColleges.has(`${formData.centre}_${String(b.id)}`) ||
                                submittedColleges.has(`${formData.centre}_${toRawCollegeKey(b.college_type || b.college) || 'general'}`)
                              );
                              const alreadyDone = submittedColleges.has(collegeDoneKey) || collegePseudoDone || collegePhysicalDone;
                              return (
                                <SelectItem key={o.key} value={o.key} disabled={alreadyDone}>
                                  <span className="flex items-center gap-2">
                                    {o.label}
                                    {alreadyDone && (
                                      <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-medium">
                                        ✓ Saisi
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {validationErrors.college && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />{validationErrors.college}
                          </p>
                        )}
                      </div>

                      {/* Select bureau : toujours présent pour alignement 3 colonnes, actif si plusieurs bureaux */}
                      <div>
                        <Label>Bureau</Label>
                        {multiplesBureaux ? (
                          <Select
                            value={formData.bureau}
                            onValueChange={(bureauId) => {
                              const b = allBureauxForCollege.find((p: any) => String(p.id) === bureauId);
                              const rv = Number(b?.registered_voters) || 0;
                              const inscrits = rv > 0 ? rv : (parseInt(formData.inscrits) || 0);
                              const votantsPrefill = computeVotantsPrefill(bureauId, inscrits);
                              setFormData({ ...formData, bureau: bureauId, inscrits: rv > 0 ? String(rv) : formData.inscrits, votants: votantsPrefill });
                            }}
                            disabled={!formData.college || loading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un bureau" />
                            </SelectTrigger>
                            <SelectContent>
                              {allBureauxForCollege.map((b: any) => {
                                const bureauDone = formData.college
                                  ? submittedBureauColleges.has(`${String(b.id)}_${formData.college}`)
                                  : submittedColleges.has(`${formData.centre}_${String(b.id)}`) ||
                                    submittedColleges.has(`${formData.centre}_${toRawCollegeKey(b.college_type || b.college) || 'general'}`);
                                return (
                                  <SelectItem key={b.id} value={String(b.id)} disabled={bureauDone}>
                                    <span className="flex items-center gap-2">
                                      {b.name}
                                      {bureauDone && (
                                        <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-medium">
                                          ✓ Saisi
                                        </span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          /* Bureau unique auto-sélectionné : afficher le nom directement, sans passer par SelectValue */
                          <Select disabled>
                            <SelectTrigger>
                              <span className="text-sm truncate">
                                {!formData.college
                                  ? <span className="text-muted-foreground">—</span>
                                  : physicalForCollege.length === 1
                                    ? physicalForCollege[0].name
                                    : collegePseudos.length > 0
                                      ? 'Bureau unique'
                                      : <span className="text-muted-foreground">—</span>}
                              </span>
                            </SelectTrigger>
                          </Select>
                        )}
                        {validationErrors.bureau && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />{validationErrors.bureau}
                          </p>
                        )}
                      </div>
                    </>
                  );
                })() : (
                  /* Élection standard : select bureau */
                  <div>
                    <Label htmlFor="bureau">Bureau de Vote</Label>
                    <Select
                      value={formData.bureau}
                      onValueChange={(value) => {
                        const bureau = votingBureaux.find(b => b.id === value);
                        const rv = bureau?.registered_voters || 0;
                        setFormData({ ...formData, bureau: value, inscrits: rv > 0 ? String(rv) : '' });
                      }}
                      disabled={!formData.centre || loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un bureau" />
                      </SelectTrigger>
                      <SelectContent>
                        {votingBureaux
                          .filter(b => b.center_id === formData.centre)
                          .map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {validationErrors.bureau && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />{validationErrors.bureau}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Récapitulatif sélection */}
            {(formData.college || formData.bureau) && (() => {
              const selectedCenter = votingCenters.find(c => c.id === formData.centre);
              const isPro = isProfessionalElection(electionInfo?.type);
              if (isPro && formData.college) {
                return (
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                    <h4 className="font-semibold text-blue-900 text-sm">Récapitulatif</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-blue-500 font-medium">Établissement</p>
                        <p className="font-semibold text-blue-900">{selectedCenter?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 font-medium">Collège</p>
                        <p className="font-semibold text-blue-900">{toCollegeLabel(formData.college)}</p>
                      </div>
                      {Number(formData.sieges) > 0 && (
                        <div>
                          <p className="text-xs text-blue-500 font-medium">Sièges à pourvoir</p>
                          <p className="font-semibold text-blue-900">{formData.sieges}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              const selectedBureau = votingBureaux.find(b => b.id === formData.bureau);
              return (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                  <h4 className="font-semibold text-blue-900 text-sm">Récapitulatif du bureau</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Centre</p>
                      <p className="font-semibold text-blue-900">{selectedCenter?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Bureau</p>
                      <p className="font-semibold text-blue-900">{selectedBureau?.name || '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );

      case 2: {
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Saisie des Chiffres de Participation</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="inscrits">{getRegisteredVotersLabel(electionInfo?.type)}</Label>
                <Input
                  id="inscrits"
                  type="number"
                  value={formData.inscrits}
                  onChange={(e) => setFormData({ ...formData, inscrits: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="votants">Nombre de Votants</Label>
                <Input
                  id="votants"
                  type="number"
                  value={formData.votants}
                  onChange={(e) => setFormData({ ...formData, votants: e.target.value, suffragesExprimes: String((parseInt(e.target.value)||0) - (parseInt(formData.bulletinsNuls)||0)) })}
                  className={validationErrors.votants ? 'border-red-500' : ''}
                />
                {validationErrors.votants && (
                  <div className="flex items-center space-x-1 mt-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs">{validationErrors.votants}</span>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="bulletinsNuls">Bulletins Nuls</Label>
                <Input
                  id="bulletinsNuls"
                  type="number"
                  value={formData.bulletinsNuls}
                  onChange={(e) => setFormData({ ...formData, bulletinsNuls: e.target.value, suffragesExprimes: String((parseInt(formData.votants)||0) - (parseInt(e.target.value)||0)) })}
                />
              </div>

              <div>
                <Label htmlFor="suffragesExprimes">Suffrages Exprimés</Label>
                <Input id="suffragesExprimes" type="number" value={formData.suffragesExprimes} readOnly />
              </div>

            </div>

            {validationErrors.total && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{validationErrors.total}</span>
              </div>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                <Calculator className="w-4 h-4" />
                <span>Vérification Automatique</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Bulletins nuls + Suffrages exprimés:</span>
                  <span className="font-semibold">
                    {(parseInt(formData.bulletinsNuls) || 0) + (parseInt(formData.suffragesExprimes) || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Nombre de votants:</span>
                  <span className="font-semibold">{parseInt(formData.votants) || 0}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 3: {
        const isPro = isProfessionalElection(electionInfo?.type);
        // Pour une élection pro, le collège est connu directement depuis formData.college
        const effectiveCollegeType: string | null = isPro ? (formData.college || null) : null;
        const selectedCenterName = (votingCenters.find(c => c.id === formData.centre)?.name || '').toLowerCase();

        // ── Sièges à pourvoir par collège pour CET établissement ────────────
        const establishmentSeatsMap = new Map<string, number>();
        if (isPro && formData.centre) {
          const collegePseudos = centerCollegesMap.get(formData.centre) || [];
          if (collegePseudos.length > 0) {
            collegePseudos.forEach((cp: any) => {
              const ct = toRawCollegeKey(cp.college_type || cp.college);
              if (ct) establishmentSeatsMap.set(ct, cp.seats_to_fill ?? 0);
            });
          } else {
            electoralColleges.forEach(ec => {
              if (ec.college_type) establishmentSeatsMap.set(ec.college_type, ec.seats_to_fill ?? 0);
            });
          }
        }

        // ── Candidats visibles : collège sélectionné + établissement ────────
        const rawVisibleCandidates = isPro
          ? candidatesData.filter(c => {
              const collegeMatch = !effectiveCollegeType || c.college_type === effectiveCollegeType;
              const etabMatch = !c.etablissement || c.etablissement.toLowerCase() === selectedCenterName;
              return collegeMatch && etabMatch;
            })
          : candidatesData;

        // Déduplication par syndicat (clé = party avant " — ") pour éviter les doublons
        // quand plusieurs titulaires existent pour le même syndicat+collège (cas multi-sièges).
        // On conserve le premier id (vote reference) et on agrège les noms des titulaires.
        const visibleCandidates = isPro ? (() => {
          const syndicatMap = new Map<string, any>();
          rawVisibleCandidates.forEach(c => {
            const key = (c.party?.split(' — ')[0] || c.name || '').trim();
            if (!syndicatMap.has(key)) {
              syndicatMap.set(key, { ...c, allNames: [c.name], allSuppleants: [c.suppleant || null] });
            } else {
              const existing = syndicatMap.get(key);
              existing.allNames.push(c.name);
              existing.allSuppleants.push(c.suppleant || null);
            }
          });
          return Array.from(syndicatMap.values());
        })() : rawVisibleCandidates;

        // Grouper par collège (uniquement les collèges présents dans les candidats visibles)
        const collegeGroups = isPro
          ? Array.from(new Set(visibleCandidates.map(c => c.college_type || 'general')))
          : null;

        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isPro ? 'Résultats par liste syndicale' : 'Saisie des Résultats par Candidat'}
            </h3>

            <div className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-3 border border-gray-100 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-10 w-28 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : visibleCandidates.length > 0 ? (
                collegeGroups ? (
                  // Élection professionnelle — groupé par collège
                  collegeGroups.map(ct => {
                    const groupLabel = ct === 'cadres' ? 'Collège Cadres' : ct === 'employes' ? 'Collège Maîtrise' : ct === 'ouvriers' ? 'Collège Exécution' : 'Collège Encadrement';
                    const groupCandidates = visibleCandidates.filter(c => (c.college_type || 'general') === ct);
                    return (
                      <div key={ct} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{groupLabel}</h4>
                          {(() => {
                            const seatsFromDb = establishmentSeatsMap.get(ct)
                              ?? electoralColleges.find(col => col.college_type === ct)?.seats_to_fill
                              ?? 0;
                            // Dériver depuis le nombre réel de titulaires si la DB sous-estime
                            const seatsFromCandidates = groupCandidates.length > 0
                              ? Math.max(...groupCandidates.map(c => Array.isArray(c.allNames) ? c.allNames.length : 1))
                              : 0;
                            const seats = Math.max(seatsFromDb, seatsFromCandidates);
                            return seats > 0 ? (
                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                {seats} siège{seats > 1 ? 's' : ''} à pourvoir
                              </span>
                            ) : null;
                          })()}
                        </div>
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
                                    <Input type="number" placeholder="Voix"
                                      value={formData.candidateVotes[candidate.id] || ''}
                                      onChange={(e) => setFormData({ ...formData, candidateVotes: { ...formData.candidateVotes, [candidate.id]: e.target.value } })}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Élection standard
                  visibleCandidates.map((candidate) => (
                    <div key={candidate.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{candidate.name}</h4>
                          {candidate.suppleant && (
                            <p className="text-xs text-gray-700 mt-0.5">Suppléant : {candidate.suppleant}</p>
                          )}
                          <p className="text-sm font-medium text-blue-600 mt-0.5">{candidate.party}</p>
                        </div>
                        <div className="w-32">
                          <Input type="number" placeholder="Voix"
                            value={formData.candidateVotes[candidate.id] || ''}
                            onChange={(e) => setFormData({ ...formData, candidateVotes: { ...formData.candidateVotes, [candidate.id]: e.target.value } })}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>Aucun candidat trouvé pour cette élection</p>
                </div>
              )}
            </div>

            {validationErrors.candidateTotal && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{validationErrors.candidateTotal}</span>
              </div>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                <Calculator className="w-4 h-4" />
                <span>Vérification des Résultats</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Total voix candidats:</span>
                  <span className="font-semibold">
                    {Object.values(formData.candidateVotes).reduce((sum, votes) => sum + (parseInt(votes) || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Suffrages exprimés:</span>
                  <span className="font-semibold">{parseInt(formData.suffragesExprimes) || 0}</span>
                </div>
              </div>
            </div>
          </div>
        );
      } // fin case 3

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import du PV Scanné</h3>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Joindre le PV physique</h4>
              <p className="text-sm text-gray-600 mb-4">Formats acceptés : PDF, JPG, PNG (max. 10 Mo)</p>

              {!formData.uploadedFile && !selectedExistingPvUrl && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                  ℹ️ L'ajout d'un document physique (PV scanné) est optionnel. Vous pouvez poursuivre et enregistrer les chiffres directement.
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Boutons d'action */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedExistingPvUrl(null);
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importer un PV
                </Button>

                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  onClick={handleOpenExistingPvPicker}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Sélectionner un PV existant
                </Button>
              </div>

              {/* Fichier importé */}
              {formData.uploadedFile && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{formData.uploadedFile.name}</span>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Prévisualiser le fichier local via URL.createObjectURL */}
                      <button
                        onClick={() => {
                          const localUrl = URL.createObjectURL(formData.uploadedFile!);
                          setPreviewTitle(formData.uploadedFile!.name);
                          setPreviewUrl(localUrl);
                        }}
                        className="text-xs font-medium text-green-700 hover:text-green-900 underline-offset-2 hover:underline transition-colors"
                      >
                        Voir
                      </button>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, uploadedFile: null }))}
                        className="text-green-600 hover:text-green-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PV existant sélectionné */}
              {selectedExistingPvUrl && !formData.uploadedFile && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">PV sélectionné</span>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPreviewTitle('PV sélectionné');
                          setPreviewUrl(selectedExistingPvUrl);
                        }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline transition-colors"
                      >
                        Voir
                      </button>
                      <button
                        onClick={() => setSelectedExistingPvUrl(null)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dialog picker de PV existants */}
            <Dialog open={showExistingPvPicker} onOpenChange={setShowExistingPvPicker}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-blue-600" />
                    Sélectionner un PV existant
                  </DialogTitle>
                </DialogHeader>

                {loadingExistingPvs ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Chargement des PV validés…</p>
                  </div>
                ) : existingValidatedPvs.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-700">Aucun PV validé disponible</p>
                    <p className="text-sm mt-1 text-gray-400">
                      Aucun PV validé avec document n'a été trouvé pour cet établissement.
                      Importez un nouveau fichier.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-3">
                      {existingValidatedPvs.length} PV validé{existingValidatedPvs.length > 1 ? 's' : ''} trouvé{existingValidatedPvs.length > 1 ? 's' : ''} pour cet établissement
                    </p>
                    {existingValidatedPvs.map(pv => (
                      <button
                        key={pv.id}
                        onClick={() => {
                          setSelectedExistingPvUrl(pv.pv_photo_url);
                          setFormData(prev => ({ ...prev, uploadedFile: null }));
                          setShowExistingPvPicker(false);
                          toast.success('PV sélectionné.');
                        }}
                        className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{pv.bureau_name}</p>
                          <p className="text-xs text-gray-400 truncate">{pv.pv_photo_url.split('/').pop()}</p>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vérification et Soumission</h3>
            
            <div className="space-y-6">
              {/* Résumé des données */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Résumé des Données Saisies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Bureau de Vote</h4>
                    <p className="text-sm text-gray-600">
                      {(() => {
                        const centerName = votingCenters.find(c => c.id === formData.centre)?.name || 'Centre inconnu';
                        const bureauName = votingBureaux.find(b => b.id === formData.bureau)?.name || 'Bureau inconnu';
                        return `${centerName} → ${bureauName}`;
                      })()}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Participation</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Votants:</span>
                        <span className="font-semibold ml-2">{formData.votants}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Bulletins nuls:</span>
                        <span className="font-semibold ml-2">{formData.bulletinsNuls}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Suffrages exprimés:</span>
                        <span className="font-semibold ml-2">{formData.suffragesExprimes}</span>
                      </div>
                    </div>
                    {/* Quorum */}
                    {(() => {
                      const inscrits = parseInt(formData.inscrits) || 0;
                      const exprimes = parseInt(formData.suffragesExprimes) || 0;
                      if (inscrits === 0) return null;
                      const quorum = inscrits / 2;
                      const atteint = exprimes >= quorum;
                      return (
                        <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${atteint ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calculator className={`w-4 h-4 ${atteint ? 'text-green-600' : 'text-red-600'}`} />
                            <span className={atteint ? 'text-green-800' : 'text-red-800'}>
                              Quorum ({inscrits} ÷ 2 = <strong>{quorum % 1 === 0 ? quorum : quorum.toFixed(1)}</strong>)
                            </span>
                          </div>
                          <span className={`text-sm font-bold ${atteint ? 'text-green-700' : 'text-red-700'}`}>
                            {atteint ? '✓ Atteint' : '✗ Non atteint'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Résultats par Candidat</h4>
                    <div className="space-y-2">
                      {(() => {
                        const isPro5 = isProfessionalElection(electionInfo?.type);
                        const sumCenterName = (votingCenters.find(c => c.id === formData.centre)?.name || '').toLowerCase();
                        const summaryCandidates = candidatesData.filter(c => {
                          const collegeMatch = !formData.college || c.college_type === formData.college;
                          const etabMatch = !c.etablissement || c.etablissement.toLowerCase() === sumCenterName;
                          const hasVotes = parseInt(formData.candidateVotes[c.id] || '0') > 0;
                          return collegeMatch && etabMatch && hasVotes;
                        });
                        if (summaryCandidates.length === 0) {
                          return <p className="text-sm text-gray-500">Aucun résultat saisi</p>;
                        }
                        if (isPro5) {
                          return summaryCandidates.map(candidate => {
                            const syndicat = candidate.party?.split(' — ')[0] || '';
                            return (
                              <div key={candidate.id} className="p-3 border border-gray-200 rounded-xl bg-white flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-blue-700 text-sm truncate">{syndicat}</p>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    <span className="text-xs text-gray-500 font-medium">Titulaire : </span>
                                    <span className="font-semibold">{candidate.name}</span>
                                  </p>
                                  {candidate.suppleant && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      <span className="font-medium">Suppléant : </span>{candidate.suppleant}
                                    </p>
                                  )}
                                </div>
                                <span className="font-bold text-gray-900 flex-shrink-0">
                                  {formData.candidateVotes[candidate.id] || 0} <span className="text-xs font-normal text-gray-500">voix</span>
                                </span>
                              </div>
                            );
                          });
                        }
                        return summaryCandidates.map(candidate => (
                          <div key={candidate.id} className="p-3 border border-gray-200 rounded-xl bg-white flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm">{candidate.name}</p>
                              {candidate.party && <p className="text-xs text-blue-600 mt-0.5">{candidate.party}</p>}
                              {candidate.suppleant && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="font-medium">Suppléant : </span>{candidate.suppleant}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-gray-900 flex-shrink-0">
                              {formData.candidateVotes[candidate.id] || 0} <span className="text-xs font-normal text-gray-500">voix</span>
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Document Attaché</h4>
                    {formData.uploadedFile ? (
                      <div className="flex items-center space-x-2 text-green-700">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{formData.uploadedFile.name}</span>
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    ) : selectedExistingPvUrl ? (
                      <div className="flex items-center gap-2 text-blue-700">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">PV existant sélectionné</span>
                        <CheckCircle className="w-4 h-4" />
                        <a
                          href={selectedExistingPvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline hover:text-blue-900 ml-1"
                          onClick={e => e.stopPropagation()}
                        >
                          Voir
                        </a>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm italic">Aucun document attaché (optionnel)</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const quorumInscrits = parseInt(formData.inscrits) || 0;
  const quorumExprimes = parseInt(formData.suffragesExprimes) || 0;
  const quorumSeuil = quorumInscrits / 2;

  return (
    <>
    {/* Modal confirmation quorum non atteint */}
    <Dialog open={showQuorumWarning} onOpenChange={setShowQuorumWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Quorum non atteint
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1">
            <p><strong>Quorum requis :</strong> {quorumSeuil % 1 === 0 ? quorumSeuil : quorumSeuil.toFixed(1)} suffrages exprimés</p>
            <p><strong>Suffrages exprimés :</strong> {quorumExprimes}</p>
          </div>
          <p className="text-sm text-gray-700">
            Ce PV <strong>ne sera pas pris en compte</strong> dans les résultats de l'élection faute de quorum.
            Voulez-vous quand même le soumettre ?
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowQuorumWarning(false)}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSubmitPVConfirmed}
              disabled={submitting}
            >
              {submitting ? 'Soumission...' : 'Soumettre quand même'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <div className="space-y-6">
      {/* Alerte de restauration de brouillon */}
      {hasDraft && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
          <div className="flex items-start space-x-3 text-yellow-800 text-sm">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Brouillon de saisie détecté</span>
              Vous avez un enregistrement en cours pour cette élection. Souhaitez-vous restaurer votre travail précédent ?
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-auto">
            <Button size="sm" variant="ghost" onClick={discardDraft} className="text-yellow-700 hover:text-red-700">
              Supprimer
            </Button>
            <Button size="sm" onClick={restoreDraft} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
              Restaurer le travail
            </Button>
          </div>
        </div>
      )}

      {/* En-tête avec bouton retour */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </Button>
        <h2 className="text-xl font-bold text-gray-900">Assistant de Saisie PV</h2>
      </div>

      {/* Informations de l'élection */}
      {electionInfo && (
        <Card className="gov-card border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{electionInfo.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(electionInfo.election_date).toLocaleDateString('fr-FR', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                    <Badge variant={electionInfo.status === 'En cours' ? 'default' : 'secondary'}>
                      {electionInfo.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="flex items-center space-x-1 text-sm text-gray-600 sm:justify-end">
                  <Users className="w-4 h-4" />
                  <span>{candidatesData.length} candidats</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Type: {electionInfo.type || 'Élection'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      <Card className="gov-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                {getStepIcon(step)}
                {step < 5 && <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />}
              </div>
            ))}
          </div>
          
          <Progress value={(currentStep / 5) * 100} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Étape {currentStep} sur 5</span>
            <span>{Math.round((currentStep / 5) * 100)}% complété</span>
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      <Card className="gov-card">
        <CardContent className="p-6">
          {(() => {
            const centerName = votingCenters.find(c => c.id === formData.centre)?.name || '—';
            const bureauName = votingBureaux.find(b => b.id === formData.bureau)?.name || '—';
            const isPro = isProfessionalElection(electionInfo?.type);
            const hasContext = !!formData.centre || !!formData.bureau || !!formData.college;
            return hasContext ? (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex items-center justify-between text-sm text-blue-900">
                <div>
                  <span>
                    {isPro ? 'Établissement' : 'Centre'} :{' '}
                    <span className="font-semibold">{centerName}</span>
                  </span>
                  <span className="mx-2">•</span>
                  {isPro ? (
                    <span>Collège : <span className="font-semibold">{toCollegeLabel(formData.college) || '—'}</span></span>
                  ) : (
                    <span>Bureau : <span className="font-semibold">{bureauName}</span></span>
                  )}
                </div>
                {formData.inscrits && (
                  <div className="text-blue-800">{getRegisteredVotersLabel(electionInfo?.type)}: <span className="font-semibold">{formData.inscrits}</span></div>
                )}
              </div>
            ) : null;
          })()}

          {renderWizardStep()}
          
          <div className="flex justify-between mt-8">
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Précédent
            </Button>
            
            {currentStep < 5 ? (
              <Button
                onClick={nextStep}
                className="bg-gov-blue hover:bg-gov-blue-dark"
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitPV}
                disabled={!canSubmit() || submitting || readOnly}
                className="bg-green-600 hover:bg-green-700"
                title={readOnly ? 'Accès en lecture seule' : undefined}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {submitting ? 'Soumission...' : 'Soumettre le PV'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Modal de prévisualisation partagé */}
    <DocumentPreviewModal
      url={previewUrl}
      title={previewTitle}
      onClose={() => {
        if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }}
    />
    </>
  );
};

export default PVEntrySection;
