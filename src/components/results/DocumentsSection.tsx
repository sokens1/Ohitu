/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, Download, FileText, FileImage, Building2, BookOpen,
  CheckCircle, XCircle, AlertTriangle, Clock, Eye, ChevronDown, ChevronUp
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

  const [docs, setDocs]           = useState<EstablishmentDocument[]>([]);
  const [centers, setCenters]     = useState<Center[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // "centerId|docType"
  const [review, setReview]       = useState<ReviewState | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadContext = useRef<{ centerId: string; collegeType: string | null; docType: 'pv' | 'participation_list' } | null>(null);

  // ── Chargement des centres & documents ──────────────────────────────────────
  useEffect(() => {
    if (!selectedElection) return;
    load();
  }, [selectedElection, user?.id]);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Déterminer les centres accessibles
      let centerIds: string[] = [];

      if (canUpload && user?.assigned_center_colleges) {
        // Président d'établissement : ses centres assignés
        centerIds = Object.keys(user.assigned_center_colleges);
      } else {
        // Admin / agent-saisie : tous les centres de l'élection
        const { data: ecRows } = await supabase
          .from('election_centers')
          .select('center_id')
          .eq('election_id', selectedElection);
        centerIds = (ecRows ?? []).map((r: any) => r.center_id);
      }

      if (centerIds.length === 0) { setDocs([]); setCenters([]); return; }

      // 2. Noms des centres
      const { data: vcRows } = await supabase
        .from('voting_centers')
        .select('id, name')
        .in('id', centerIds);
      const centerMap = new Map((vcRows ?? []).map((v: any) => [v.id, v.name]));

      const builtCenters: Center[] = centerIds.map(cid => ({
        id: cid,
        name: (centerMap.get(cid) ?? cid) as string,
        assignedColleges: user?.assigned_center_colleges?.[cid] ?? [],
      }));
      setCenters(builtCenters);

      // 3. Documents
      const { data: docRows, error } = await supabase
        .from('establishment_documents')
        .select('*')
        .eq('election_id', selectedElection)
        .in('center_id', centerIds)
        .order('uploaded_at', { ascending: false });

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
  };

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
    const key = `${centerId}|${docType}`;
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
      setReview(null);
      await load();
    } finally {
      setReview(prev => prev ? { ...prev, submitting: false } : null);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!selectedElection) {
    return (
      <div className="text-center text-gray-500 py-12">Sélectionnez une élection.</div>
    );
  }

  // ── Vue président d'établissement ───────────────────────────────────────────
  if (canUpload) {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileSelected}
        />

        <p className="text-sm text-gray-500">
          Joignez les documents pour vos établissements. Formats acceptés : image (JPG, PNG…) ou PDF.
        </p>

        {centers.length === 0 && (
          <div className="text-center text-gray-400 py-10">Aucun établissement assigné.</div>
        )}

        {centers.map(center => {
          const colleges = center.assignedColleges.length > 0
            ? center.assignedColleges
            : [null]; // null = tous les collèges

          return (
            <Card key={center.id} className="border border-teal-100">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                  <Building2 className="w-4 h-4" />
                  {center.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {colleges.map((college, ci) => (
                  <div key={ci} className="border rounded-lg p-3 bg-gray-50 space-y-3">
                    {college && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <BookOpen className="w-3.5 h-3.5" /> Collège : {college}
                      </div>
                    )}
                    {(['pv', 'participation_list'] as const).map(docType => {
                      const existing = docs.find(
                        d => d.center_id === center.id
                          && d.college_type === college
                          && d.document_type === docType
                      );
                      const isUp = uploading === `${center.id}|${docType}`;

                      return (
                        <div key={docType} className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-sm">
                            {existing ? <FileIcon name={existing.file_name} /> : <FileText className="w-4 h-4 text-gray-300" />}
                            <span className="font-medium text-gray-700">{DOC_TYPE_LABEL[docType]}</span>
                            {existing && <StatusBadge status={existing.status} />}
                            {existing?.review_comment && (
                              <span className="text-xs text-gray-500 italic truncate max-w-xs" title={existing.review_comment}>
                                "{existing.review_comment}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {existing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 h-7 px-2"
                                onClick={() => window.open(existing.file_url, '_blank')}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> 
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUp}
                              className="border-teal-400 text-teal-700 hover:bg-teal-50 h-7 px-3 text-xs"
                              onClick={() => triggerUpload(center.id, college, docType)}
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" />
                              {isUp ? 'Envoi…' : existing ? 'Remplacer' : 'Joindre'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── Vue admin / agent-saisie : liste tous les documents ─────────────────────
  const docsByCenter = centers.map(center => ({
    center,
    docs: docs.filter(d => d.center_id === center.id),
  }));

  return (
    <div className="space-y-4">
      {canReview && (
        <p className="text-sm text-gray-500">
          Donnez votre avis sur les documents joints par les présidents d'établissement.
          Un commentaire est obligatoire pour les statuts <strong>Réserve</strong> et <strong>Rejet</strong>.
        </p>
      )}
      {canDownload && !canReview && (
        <p className="text-sm text-gray-500">
          Consultez et téléchargez les documents joints par les présidents d'établissement.
        </p>
      )}

      {docsByCenter.every(c => c.docs.length === 0) && (
        <div className="text-center text-gray-400 py-12">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          Aucun document joint pour le moment.
        </div>
      )}

      {docsByCenter.map(({ center, docs: centerDocs }) => {
        if (centerDocs.length === 0 && !canReview) return null;
        const isExpanded = expanded.has(center.id);
        const toggle = () => setExpanded(prev => {
          const next = new Set(prev);
          next.has(center.id) ? next.delete(center.id) : next.add(center.id);
          return next;
        });

        return (
          <Card key={center.id} className="border border-gray-200">
            <button
              type="button"
              onClick={toggle}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span className="font-medium text-sm text-gray-800">{center.name}</span>
                <span className="text-xs text-gray-400">({centerDocs.length} document{centerDocs.length > 1 ? 's' : ''})</span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isExpanded && (
              <CardContent className="px-4 pb-4 pt-1 space-y-3 border-t">
                {centerDocs.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">Aucun document pour cet établissement.</p>
                )}

                {centerDocs.map(doc => {
                  const isReviewing = review?.docId === doc.id;
                  const commentRequired = isReviewing &&
                    (review?.comment ?? '').trim().length === 0;

                  return (
                    <div key={doc.id} className="border rounded-xl p-3 bg-white space-y-2">
                      {/* Ligne principale */}
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <FileIcon name={doc.file_name} />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {DOC_TYPE_LABEL[doc.document_type]}
                              {doc.college_type && (
                                <span className="ml-1 text-xs text-gray-500">— {doc.college_type}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              Déposé par <span className="font-medium">{doc.uploader_name}</span>
                              {' '}· {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {doc.file_name && <> · <span className="italic">{doc.file_name}</span></>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={doc.status} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 h-7 px-2"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> 
                          </Button>
                          {canDownload && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-600 hover:text-gray-800 h-7 px-2"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="w-3.5 h-3.5 mr-1" /> Télécharger
                            </Button>
                          )}
                          {canReview && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setReview(isReviewing ? null : { docId: doc.id, comment: doc.review_comment ?? '', submitting: false })}
                            >
                              {isReviewing ? 'Annuler' : 'Donner un avis'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Commentaire existant */}
                      {!isReviewing && doc.review_comment && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 rounded px-2 py-1">
                          Commentaire : "{doc.review_comment}"
                        </p>
                      )}

                      {/* Formulaire d'avis */}
                      {isReviewing && canReview && (
                        <div className="border-t pt-3 space-y-2">
                          <Textarea
                            rows={2}
                            placeholder="Commentaire (obligatoire pour Réserve et Rejet)"
                            value={review?.comment ?? ''}
                            onChange={e => setReview(prev => prev ? { ...prev, comment: e.target.value } : null)}
                            className="text-sm resize-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={review?.submitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs"
                              onClick={() => submitReview(doc.id, 'validated')}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Valider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review?.submitting || commentRequired}
                              className="border-orange-400 text-orange-700 hover:bg-orange-50 h-7 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => submitReview(doc.id, 'reserved')}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Réserve
                              {commentRequired && <span className="ml-1 text-orange-400">*</span>}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review?.submitting || commentRequired}
                              className="border-red-400 text-red-700 hover:bg-red-50 h-7 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => submitReview(doc.id, 'rejected')}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeter
                              {commentRequired && <span className="ml-1 text-red-400">*</span>}
                            </Button>
                            {commentRequired && (
                              <p className="text-xs text-red-500 self-center">
                                * Commentaire requis pour Réserve et Rejet
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default DocumentsSection;
