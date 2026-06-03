/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import {
  notifyDocumentUploaded,
  notifyDocumentReviewed,
} from '@/lib/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Upload, Download, FileText, FileImage, Building2, BookOpen,
  CheckCircle, XCircle, AlertTriangle, Clock, Eye, ChevronDown, ChevronUp,
  ZoomIn, ZoomOut, RotateCw, ExternalLink, Trash2, Search, Filter,
  FileCheck, FileClock, LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EstablishmentDocument {
  id: string;
  election_id: string;
  center_id: string;
  college_type: string | null;
  document_type: 'pv' | 'participation_list';
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
  status: 'pending' | 'validated' | 'reserved' | 'rejected';
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // enrichi
  center_name?: string;
  uploader_name?: string;
}

interface Center {
  id: string;
  name: string;
  assignedColleges: string[]; // [] = tous
}

interface ReviewState {
  docId: string;
  comment: string;
  submitting: boolean;
}

interface Props {
  selectedElection: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DOC_TYPE_LABEL: Record<string, string> = {
  pv: 'Procès-verbal',
  participation_list: 'Liste de participation',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending:   { label: 'En attente',          color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  validated: { label: 'Validé',              color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  reserved:  { label: 'Validé avec réserve', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  rejected:  { label: 'Rejeté',              color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function FileIcon({ name }: { name: string | null }) {
  const ext = (name ?? '').split('.').pop()?.toLowerCase();
  return ext === 'pdf'
    ? <FileText className="w-4 h-4 text-red-500" />
    : <FileImage className="w-4 h-4 text-blue-500" />;
}

// ─── Composant principal ───────────────────────────────────────────────────────
const DocumentsSection: React.FC<Props> = ({ selectedElection }) => {
  const { user } = useAuth();
  const { can } = useRBAC();

  const canUpload   = can('documents:upload');
  const canReview   = can('documents:review');
  const canDownload = can('documents:download');
  const canDelete   = user?.role === 'super-admin';

  const [docs, setDocs]           = useState<EstablishmentDocument[]>([]);
  const [centers, setCenters]     = useState<Center[]>([]);
  const [allCollegeTypes, setAllCollegeTypes] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // "centerId|college|docType"
  const [review, setReview]       = useState<ReviewState | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [electionStatus, setElectionStatus] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState<'pv' | 'participation_list' | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  // Filtres vue admin
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('all');
  const [adminSearch, setAdminSearch]             = useState('');

  // Peut supprimer un document quand l'élection est "À venir"
  const electionUpcoming = electionStatus === 'À venir';
  // Admin et président peuvent supprimer leurs propres docs uniquement si l'élection est à venir
  const canDeleteWhenUpcoming = electionUpcoming &&
    (user?.role === 'admin' || user?.role === 'president-etablissement');

  // ── Prévisualisation document ─────────────────────────────────────────────
  const [previewDoc, setPreviewDoc] = useState<EstablishmentDocument | null>(null);
  const [imgZoom, setImgZoom]       = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const openPreview = (doc: EstablishmentDocument) => {
    setPreviewDoc(doc);
    setImgZoom(1);
    setImgRotation(0);
  };
  const closePreview = () => setPreviewDoc(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadContext = useRef<{ centerId: string; collegeType: string | null; docType: 'pv' | 'participation_list' } | null>(null);

  // Clés stables pour éviter les re-renders infinis sur les dépendances objets
  const centerBureauxKey = JSON.stringify(user?.assigned_center_bureaux ?? null);
  const centerCollegesKey = JSON.stringify(user?.assigned_center_colleges ?? null);

  // ── Chargement des centres & documents ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Statut de l'élection (pour les droits de suppression)
      const { data: elecData } = await supabase
        .from('elections').select('status').eq('id', selectedElection).single();
      setElectionStatus(elecData?.status ?? null);

      // 1. Déterminer les centres accessibles
      let centerIds: string[] = [];

      if (canUpload) {
        // Président : UNIQUEMENT ses centres assignés via assigned_center_bureaux
        // Si null → aucun centre → l'écran affiche "Aucun établissement assigné"
        centerIds = Object.keys(user?.assigned_center_bureaux ?? {});
      } else {
        // Admin / agent-saisie / validateur : tous les centres de l'élection
        const { data: ecRows } = await supabase
          .from('election_centers')
          .select('center_id')
          .eq('election_id', selectedElection);
        centerIds = (ecRows ?? []).map((r: any) => r.center_id);
      }

      if (centerIds.length === 0) { setDocs([]); setCenters([]); setAllCollegeTypes([]); return; }

      // 2. Noms des centres
      const { data: vcRows } = await supabase
        .from('voting_centers')
        .select('id, name')
        .in('id', centerIds);
      const centerMap = new Map((vcRows ?? []).map((v: any) => [v.id, v.name]));

      // 3. Collèges disponibles pour cette élection (référence)
      const { data: ecColleges } = await supabase
        .from('electoral_colleges')
        .select('college_type')
        .eq('election_id', selectedElection);
      const distinctColleges: string[] = Array.from(
        new Set((ecColleges ?? []).map((r: any) => r.college_type).filter(Boolean))
      );
      const electionColleges = distinctColleges.length > 0
        ? distinctColleges
        : ['cadres', 'employes', 'ouvriers', 'general'];
      setAllCollegeTypes(electionColleges);

      const builtCenters: Center[] = centerIds.map(cid => {
        if (canUpload) {
          // Président : UNIQUEMENT les collèges assignés pour ce centre
          // Si liste vide → "vide = tous" → tous les collèges de l'élection
          const assigned = user?.assigned_center_colleges?.[cid] ?? [];
          return {
            id: cid,
            name: (centerMap.get(cid) ?? cid) as string,
            assignedColleges: assigned.length > 0 ? assigned : electionColleges,
          };
        }
        return {
          id: cid,
          name: (centerMap.get(cid) ?? cid) as string,
          assignedColleges: user?.assigned_center_colleges?.[cid] ?? [],
        };
      });
      setCenters(builtCenters);

      // 3. Documents
      // Collèges autorisés pour le président : union de tous ses colleges par centre
      let docQuery = supabase
        .from('establishment_documents')
        .select('*')
        .eq('election_id', selectedElection)
        .in('center_id', centerIds);

      if (canUpload) {
        // Restreindre aux collèges explicitement assignés (tous centres confondus)
        const allAssignedColleges = Array.from(new Set(
          Object.values(user?.assigned_center_colleges ?? {}).flat()
        ));
        if (allAssignedColleges.length > 0) {
          docQuery = docQuery.in('college_type', allAssignedColleges);
        }
        // Si aucun collège assigné (vide = tous) → pas de filtre college_type
      }

      const { data: docRows, error } = await docQuery.order('uploaded_at', { ascending: false });

      if (error) { toast.error('Erreur chargement documents'); return; }

      // 4. Enrichir avec noms uploader
      const uploaderIds = [...new Set((docRows ?? []).map((d: any) => d.uploaded_by))];
      const { data: uploaderRows } = uploaderIds.length
        ? await supabase.from('users').select('id, name').in('id', uploaderIds)
        : { data: [] };
      const uploaderMap = new Map((uploaderRows ?? []).map((u: any) => [u.id, u.name]));

      const enriched: EstablishmentDocument[] = (docRows ?? []).map((d: any) => ({
        ...d,
        center_name: centerMap.get(d.center_id) ?? d.center_id,
        uploader_name: uploaderMap.get(d.uploaded_by) ?? 'Inconnu',
      }));
      setDocs(enriched);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElection, user?.id, canUpload, centerBureauxKey, centerCollegesKey]);

  useEffect(() => {
    if (!selectedElection) return;
    load();
  }, [load]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const triggerUpload = (centerId: string, collegeType: string | null, docType: 'pv' | 'participation_list') => {
    uploadContext.current = { centerId, collegeType, docType };
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadContext.current || !user) return;
    e.target.value = '';

    const { centerId, collegeType, docType } = uploadContext.current;
    const key = `${centerId}|${collegeType ?? ''}|${docType}`;
    setUploading(key);

    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      // Stocké dans pv-uploads (bucket existant) sous establishment-docs/
      const path = `establishment-docs/${selectedElection}/${centerId}/${docType}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('pv-uploads')
        .upload(path, file, { upsert: false });

      if (upErr) {
        const msg = (upErr as any)?.message ?? '';
        toast.error(`Échec upload : ${msg || 'erreur inconnue'}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('pv-uploads')
        .getPublicUrl(path);

      // Upsert en base (1 document par centre+collège+type)
      const existing = docs.find(
        d => d.center_id === centerId
          && d.college_type === collegeType
          && d.document_type === docType
      );

      if (existing) {
        const { error: updErr } = await supabase
          .from('establishment_documents')
          .update({
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
            uploaded_at: new Date().toISOString(),
            status: 'pending',
            review_comment: null,
            reviewed_by: null,
            reviewed_at: null,
          })
          .eq('id', existing.id);
        if (updErr) { toast.error('Erreur mise à jour document'); return; }
      } else {
        const { error: insErr } = await supabase
          .from('establishment_documents')
          .insert({
            election_id: selectedElection,
            center_id: centerId,
            college_type: collegeType,
            document_type: docType,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
            uploaded_by: user.id,
          });
        if (insErr) { toast.error('Erreur enregistrement document'); return; }
      }

      toast.success('Document joint avec succès');
      // Notifier les agents + admins concernés
      const centerObj = centers.find(c => c.id === centerId);
      if (centerObj) {
        notifyDocumentUploaded({
          electionId:   selectedElection,
          centerId,
          centerName:   centerObj.name,
          collegeType,
          documentType: docType,
          actorName:    user.name,
        }).catch(() => {/* silencieux */});
      }
      await load();
    } finally {
      setUploading(null);
      uploadContext.current = null;
    }
  };

  // ── Téléchargement ──────────────────────────────────────────────────────────
  const handleDownload = async (doc: EstablishmentDocument) => {
    try {
      // Extraire le path depuis l'URL publique (bucket pv-uploads)
      const url = new URL(doc.file_url);
      const parts = url.pathname.split('/pv-uploads/');
      const filePath = parts[1];
      if (!filePath) { window.open(doc.file_url, '_blank'); return; }

      const { data, error } = await supabase.storage
        .from('pv-uploads')
        .download(filePath);

      if (error || !data) { window.open(doc.file_url, '_blank'); return; }

      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.file_name ?? 'document';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(doc.file_url, '_blank');
    }
  };

  // ── Avis admin ──────────────────────────────────────────────────────────────
  const submitReview = async (docId: string, status: 'validated' | 'reserved' | 'rejected') => {
    const commentRequired = status === 'reserved' || status === 'rejected';
    const comment = review?.docId === docId ? review.comment.trim() : '';

    if (commentRequired && !comment) {
      toast.error('Un commentaire est obligatoire pour ce statut.');
      return;
    }

    setReview(prev => prev ? { ...prev, submitting: true } : null);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('establishment_documents')
        .update({
          status,
          review_comment: comment || null,
          reviewed_by: authUser.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) { toast.error('Erreur lors de la mise à jour'); return; }
      toast.success('Avis enregistré');
      // Notifier le président qui a uploadé
      const doc = docs.find(d => d.id === docId);
      if (doc && user) {
        const center = centers.find(c => c.id === doc.center_id);
        notifyDocumentReviewed({
          recipientId:  doc.uploaded_by,
          centerName:   center?.name ?? doc.center_id,
          documentType: doc.document_type,
          status:       status as 'validated' | 'reserved' | 'rejected',
          comment:      comment || null,
          actorName:    user.name,
          electionId:   doc.election_id,
        }).catch(() => {/* silencieux */});
      }
      setReview(null);
      await load();
    } finally {
      setReview(prev => prev ? { ...prev, submitting: false } : null);
    }
  };

  // ── Modal de prévisualisation ────────────────────────────────────────────────
  const COLLEGE_LABELS: Record<string, string> = {
    cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution', general: 'Encadrement',
  };
  const isPDF = (url: string) => url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf');

  const previewModal = previewDoc && (
    <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) closePreview(); }}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* En-tête */}
        <DialogHeader className="px-5 py-3.5 border-b bg-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 truncate">
                {previewDoc.document_type === 'pv' ? '📄 Procès-verbal' : '📋 Liste de participation'}
                {previewDoc.center_name && <span className="text-gray-500 font-normal"> — {previewDoc.center_name}</span>}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                {previewDoc.college_type && (
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {COLLEGE_LABELS[previewDoc.college_type] ?? previewDoc.college_type}
                  </span>
                )}
                {previewDoc.file_name && <span className="italic truncate max-w-xs">{previewDoc.file_name}</span>}
                {previewDoc.file_size && (
                  <span>{(previewDoc.file_size / 1024).toFixed(0)} Ko</span>
                )}
                <span>Déposé par <strong>{previewDoc.uploader_name ?? '—'}</strong></span>
                <span>{new Date(previewDoc.uploaded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                  previewDoc.status === 'validated' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  previewDoc.status === 'reserved'  ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  previewDoc.status === 'rejected'  ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}>
                  {previewDoc.status === 'validated' ? '✅ Validé' :
                   previewDoc.status === 'reserved'  ? '⚠️ Réserve' :
                   previewDoc.status === 'rejected'  ? '❌ Rejeté' : '⏳ En attente'}
                </span>
              </div>
            </div>
            {/* Actions barre haute — mr-8 pour ne pas chevaucher la croix native du DialogContent */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mr-8">
              {!isPDF(previewDoc.file_url) && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Zoom +" onClick={() => setImgZoom(z => Math.min(z + 0.25, 3))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Zoom −" onClick={() => setImgZoom(z => Math.max(z - 0.25, 0.25))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Rotation" onClick={() => setImgRotation(r => (r + 90) % 360)}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </>
              )}
              {canDownload && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                  title="Télécharger" onClick={() => handleDownload(previewDoc)}>
                  <Download className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                title="Ouvrir dans un nouvel onglet" onClick={() => window.open(previewDoc.file_url, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {previewDoc.review_comment && (
            <p className="mt-1.5 text-xs text-gray-600 italic border-t pt-1.5">
              💬 Commentaire admin : "{previewDoc.review_comment}"
            </p>
          )}
        </DialogHeader>

        {/* Corps : document */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative" style={{ minHeight: '60vh' }}>
          {isPDF(previewDoc.file_url) ? (
            <iframe
              src={previewDoc.file_url}
              className="w-full h-full border-0"
              style={{ minHeight: '65vh' }}
              title="Prévisualisation document"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4"
              style={{ minHeight: '65vh' }}>
              <img
                src={previewDoc.file_url}
                alt="Document"
                style={{
                  transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  transition: 'transform 0.2s ease',
                  maxWidth: imgZoom <= 1 ? '100%' : 'none',
                  maxHeight: imgZoom <= 1 ? '65vh' : 'none',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Suppression (super-admin uniquement) ────────────────────────────────────
  const handleDeleteDoc = async (docId: string) => {
    setDeleting(docId);
    try {
      const { error } = await supabase.from('establishment_documents').delete().eq('id', docId);
      if (error) { toast.error('Erreur lors de la suppression'); return; }
      setDocs(prev => prev.filter(d => d.id !== docId));
      toast.success('Document supprimé');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllByType = async (docType: 'pv' | 'participation_list') => {
    setDeletingAll(true);
    try {
      const { error } = await supabase
        .from('establishment_documents')
        .delete()
        .eq('election_id', selectedElection)
        .eq('document_type', docType);
      if (error) { toast.error('Erreur lors de la suppression'); return; }
      setDocs(prev => prev.filter(d => d.document_type !== docType));
      setDeleteAllConfirm(null);
      toast.success(`Tous les ${docType === 'pv' ? 'procès-verbaux' : 'listes de participation'} ont été supprimés`);
    } finally {
      setDeletingAll(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent" />
        <p className="text-sm text-gray-400">Chargement des documents…</p>
      </div>
    );
  }

  if (!selectedElection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <LayoutGrid className="w-10 h-10" />
        <p className="text-sm">Sélectionnez une élection pour voir les documents.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VUE PRÉSIDENT D'ÉTABLISSEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (canUpload) {
    const totalSlots  = centers.reduce((s, c) => s + c.assignedColleges.length * 2, 0);
    const filledSlots = docs.length;
    const pct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    return (
      <div className="space-y-5">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelected} />

        {/* Bandeau progression global */}
        {totalSlots > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-teal-800">Progression des dépôts</span>
                <span className="text-sm font-bold text-teal-700">{filledSlots}/{totalSlots} documents</span>
              </div>
              <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? 'linear-gradient(90deg,#059669,#10b981)'
                      : 'linear-gradient(90deg,#0d9488,#14b8a6)',
                  }}
                />
              </div>
            </div>
            <div className={`text-2xl font-black flex-shrink-0 ${pct === 100 ? 'text-emerald-600' : 'text-teal-600'}`}>
              {pct}%
            </div>
          </div>
        )}

        {centers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Building2 className="w-10 h-10" />
            <p className="text-sm font-medium">Aucun établissement assigné</p>
            <p className="text-xs">Contactez votre administrateur.</p>
          </div>
        ) : centers.map(center => {
          const centerDocs    = docs.filter(d => d.center_id === center.id);
          const centerFilled  = centerDocs.length;
          const centerTotal   = center.assignedColleges.length * 2;
          const allDone       = centerFilled === centerTotal && centerTotal > 0;

          return (
            <div key={center.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {/* En-tête établissement */}
              <div className={`flex items-center gap-3 px-4 py-3 ${allDone ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-gray-50 border-b border-gray-200'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${allDone ? 'bg-emerald-100' : 'bg-teal-100'}`}>
                  <Building2 className={`w-4 h-4 ${allDone ? 'text-emerald-600' : 'text-teal-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{center.name}</p>
                  <p className={`text-[11px] ${allDone ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {allDone ? '✓ Tous les documents déposés' : `${centerFilled}/${centerTotal} document${centerTotal > 1 ? 's' : ''}`}
                  </p>
                </div>
                {allDone && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
              </div>

              {/* Collèges */}
              <div className="divide-y divide-gray-100 bg-white">
                {center.assignedColleges.map(college => {
                  const colLabel = COLLEGE_LABELS[college] ?? college;
                  return (
                    <div key={college} className="p-3 space-y-2">
                      {/* Tag collège */}
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-teal-500" />
                        <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">{colLabel}</span>
                      </div>

                      {/* Slots documents */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(['pv', 'participation_list'] as const).map(docType => {
                          const existing  = docs.find(d => d.center_id === center.id && d.college_type === college && d.document_type === docType);
                          const uploadKey = `${center.id}|${college}|${docType}`;
                          const isUp      = uploading === uploadKey;
                          const statusCfg = existing ? STATUS_CONFIG[existing.status] : null;

                          return (
                            <div key={docType}
                              className={`relative rounded-xl border-2 transition-all ${
                                existing
                                  ? existing.status === 'validated' ? 'border-emerald-200 bg-emerald-50/50'
                                  : existing.status === 'rejected'  ? 'border-red-200 bg-red-50/50'
                                  : existing.status === 'reserved'  ? 'border-orange-200 bg-orange-50/50'
                                  : 'border-gray-200 bg-white'
                                  : 'border-dashed border-gray-300 bg-gray-50/50 hover:border-teal-300 hover:bg-teal-50/30'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 p-2.5">
                                {/* Icône état */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  existing ? 'bg-white shadow-sm' : 'bg-gray-100'
                                }`}>
                                  {existing
                                    ? <FileIcon name={existing.file_name} />
                                    : <FileText className="w-4 h-4 text-gray-300" />}
                                </div>

                                {/* Infos */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-700 leading-none mb-1">
                                    {DOC_TYPE_LABEL[docType]}
                                  </p>
                                  {existing ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {statusCfg && (
                                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusCfg.color}`}>
                                          <statusCfg.icon className="w-2.5 h-2.5" /> {statusCfg.label}
                                        </span>
                                      )}
                                      {existing.review_comment && (
                                        <span className="text-[10px] text-gray-500 italic truncate max-w-[100px]" title={existing.review_comment}>
                                          "{existing.review_comment}"
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-gray-400">Non déposé</p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {existing && (
                                    <button onClick={() => openPreview(existing)}
                                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Voir">
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    disabled={isUp}
                                    onClick={() => triggerUpload(center.id, college, docType)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isUp ? 'opacity-50 cursor-not-allowed' : 'text-teal-600 hover:bg-teal-50'
                                    }`}
                                    title={existing ? 'Remplacer' : 'Joindre'}
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                  </button>
                                  {existing && (canDelete || canDeleteWhenUpcoming) && (
                                    <button
                                      disabled={deleting === existing.id}
                                      onClick={() => handleDeleteDoc(existing.id)}
                                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {previewModal}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VUE ADMIN / VALIDATEUR / AGENT
  // ═══════════════════════════════════════════════════════════════════════════

  // Statistiques globales
  const statValidated = docs.filter(d => d.status === 'validated').length;
  const statPending   = docs.filter(d => d.status === 'pending').length;
  const statReserved  = docs.filter(d => d.status === 'reserved').length;
  const statRejected  = docs.filter(d => d.status === 'rejected').length;

  // Documents filtrés
  const filteredDocs = docs.filter(d => {
    if (adminStatusFilter !== 'all' && d.status !== adminStatusFilter) return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      return (
        (d.center_name  ?? '').toLowerCase().includes(q) ||
        (d.uploader_name ?? '').toLowerCase().includes(q) ||
        DOC_TYPE_LABEL[d.document_type].toLowerCase().includes(q) ||
        (d.college_type ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const docsByCenter = centers
    .map(center => ({
      center,
      docs: filteredDocs.filter(d => d.center_id === center.id),
    }))
    .filter(({ docs: cd }) => cd.length > 0 || (canReview && adminStatusFilter === 'all' && !adminSearch));

  const STAT_ITEMS = [
    { label: 'Total',    count: docs.length,    color: 'bg-gray-100 text-gray-700',       border: 'border-gray-200',    key: 'all'       },
    { label: 'En attente', count: statPending,  color: 'bg-amber-50 text-amber-700',      border: 'border-amber-200',   key: 'pending'   },
    { label: 'Validés',  count: statValidated,  color: 'bg-emerald-50 text-emerald-700',  border: 'border-emerald-200', key: 'validated' },
    { label: 'Réserve',  count: statReserved,   color: 'bg-orange-50 text-orange-700',    border: 'border-orange-200',  key: 'reserved'  },
    { label: 'Rejetés',  count: statRejected,   color: 'bg-red-50 text-red-700',          border: 'border-red-200',     key: 'rejected'  },
  ];

  const STATUS_LEFT_BORDER: Record<string, string> = {
    pending:   'border-l-amber-400',
    validated: 'border-l-emerald-400',
    reserved:  'border-l-orange-400',
    rejected:  'border-l-red-400',
  };

  return (
    <div className="space-y-4">

      {/* ── Stats bar ── */}
      {docs.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {STAT_ITEMS.map(s => (
            <button
              key={s.key}
              onClick={() => setAdminStatusFilter(s.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border-2 transition-all text-center ${
                adminStatusFilter === s.key
                  ? `${s.color} ${s.border} shadow-sm scale-[1.03]`
                  : 'bg-white border-gray-100 hover:border-gray-200 text-gray-600'
              }`}
            >
              <span className="text-lg font-black leading-none">{s.count}</span>
              <span className="text-[10px] font-medium whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Barre de recherche + suppression masse ── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par établissement, uploader, type…"
            value={adminSearch}
            onChange={e => setAdminSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400 transition-all"
          />
        </div>

        {canDelete && docs.length > 0 && (
          deleteAllConfirm ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200">
              <span className="text-xs text-red-700 font-medium whitespace-nowrap">
                Supprimer tous les {deleteAllConfirm === 'pv' ? 'PV' : 'listes'} ?
              </span>
              <Button size="sm" disabled={deletingAll}
                className="bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs"
                onClick={() => handleDeleteAllByType(deleteAllConfirm)}>
                {deletingAll ? '…' : 'Confirmer'}
              </Button>
              <Button size="sm" variant="ghost" disabled={deletingAll}
                className="h-7 px-2 text-xs text-gray-500"
                onClick={() => setDeleteAllConfirm(null)}>
                Annuler
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" variant="outline"
                className="border-red-200 text-red-500 hover:bg-red-50 h-9 px-3 text-xs"
                onClick={() => setDeleteAllConfirm('pv')}
                disabled={!docs.some(d => d.document_type === 'pv')}>
                <Trash2 className="w-3 h-3 mr-1" /> PV
              </Button>
              <Button size="sm" variant="outline"
                className="border-red-200 text-red-500 hover:bg-red-50 h-9 px-3 text-xs"
                onClick={() => setDeleteAllConfirm('participation_list')}
                disabled={!docs.some(d => d.document_type === 'participation_list')}>
                <Trash2 className="w-3 h-3 mr-1" /> Listes
              </Button>
            </div>
          )
        )}
      </div>

      {/* ── Empty state ── */}
      {docsByCenter.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <FileText className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {adminSearch || adminStatusFilter !== 'all' ? 'Aucun document ne correspond à la recherche.' : 'Aucun document déposé pour le moment.'}
          </p>
          {(adminSearch || adminStatusFilter !== 'all') && (
            <button onClick={() => { setAdminSearch(''); setAdminStatusFilter('all'); }}
              className="text-xs text-teal-600 hover:underline">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* ── Cartes par établissement ── */}
      {docsByCenter.map(({ center, docs: centerDocs }) => {
        const isExpanded = expanded.has(center.id);
        const toggle = () => setExpanded(prev => {
          const next = new Set(prev);
          next.has(center.id) ? next.delete(center.id) : next.add(center.id);
          return next;
        });
        const vCount = centerDocs.filter(d => d.status === 'validated').length;
        const pCount = centerDocs.filter(d => d.status === 'pending').length;

        return (
          <div key={center.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* En-tête cliquable */}
            <button type="button" onClick={toggle}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{center.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400">{centerDocs.length} doc{centerDocs.length > 1 ? 's' : ''}</span>
                  {vCount > 0 && <span className="text-[11px] text-emerald-600 font-medium">{vCount} validé{vCount > 1 ? 's' : ''}</span>}
                  {pCount > 0 && <span className="text-[11px] text-amber-600 font-medium">{pCount} en attente</span>}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Liste des documents */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {centerDocs.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-4 py-3">Aucun document pour cet établissement.</p>
                ) : centerDocs.map(doc => {
                  const isReviewing    = review?.docId === doc.id;
                  const commentRequired= isReviewing && (review?.comment ?? '').trim().length === 0;
                  const leftBorder     = STATUS_LEFT_BORDER[doc.status] ?? 'border-l-gray-200';

                  return (
                    <div key={doc.id} className={`border-l-4 ${leftBorder} bg-white hover:bg-gray-50/50 transition-colors`}>
                      <div className="flex flex-wrap items-center gap-2 px-4 py-3 justify-between">
                        {/* Infos document */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <FileIcon name={doc.file_name} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">
                                {DOC_TYPE_LABEL[doc.document_type]}
                              </span>
                              {doc.college_type && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-100">
                                  {doc.college_type}
                                </span>
                              )}
                              <StatusBadge status={doc.status} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {doc.uploader_name} ·{' '}
                              {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {doc.file_name && <> · <span className="italic">{doc.file_name}</span></>}
                            </p>
                            {!isReviewing && doc.review_comment && (
                              <p className="text-[11px] text-gray-500 italic mt-0.5">
                                💬 "{doc.review_comment}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => openPreview(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> Voir
                          </button>
                          {canDownload && (
                            <button onClick={() => handleDownload(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canReview && (
                            <button
                              onClick={() => setReview(isReviewing ? null : { docId: doc.id, comment: doc.review_comment ?? '', submitting: false })}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isReviewing
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-[#1B2E5A] text-white hover:bg-[#142347]'
                              }`}>
                              <FileCheck className="w-3.5 h-3.5" />
                              {isReviewing ? 'Annuler' : 'Valider'}
                            </button>
                          )}
                          {(canDelete || (canDeleteWhenUpcoming && (user?.role === 'admin' || doc.uploaded_by === user?.id))) && (
                            <button
                              disabled={deleting === doc.id}
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Formulaire validation inline */}
                      {isReviewing && canReview && (
                        <div className="px-4 pb-3 pt-0 space-y-2 bg-gray-50 border-t border-gray-100">
                          <Textarea
                            rows={2}
                            placeholder="Commentaire (obligatoire pour Réserve et Rejet)…"
                            value={review?.comment ?? ''}
                            onChange={e => setReview(prev => prev ? { ...prev, comment: e.target.value } : null)}
                            className="text-sm resize-none bg-white border-gray-200 focus:border-teal-400 rounded-xl"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" disabled={review?.submitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-4 text-xs rounded-lg"
                              onClick={() => submitReview(doc.id, 'validated')}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Valider
                            </Button>
                            <Button size="sm" variant="outline" disabled={review?.submitting || commentRequired}
                              className="border-orange-300 text-orange-600 hover:bg-orange-50 h-8 px-4 text-xs rounded-lg disabled:opacity-50"
                              onClick={() => submitReview(doc.id, 'reserved')}>
                              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Réserve
                            </Button>
                            <Button size="sm" variant="outline" disabled={review?.submitting || commentRequired}
                              className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-4 text-xs rounded-lg disabled:opacity-50"
                              onClick={() => submitReview(doc.id, 'rejected')}>
                              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Rejeter
                            </Button>
                            {commentRequired && (
                              <p className="text-[11px] text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Commentaire requis
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {previewModal}
    </div>
  );
};

export default DocumentsSection;
