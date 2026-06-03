import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Upload, Download, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, Loader2, Users, RefreshCw,
} from 'lucide-react';
import {
  downloadUserTemplate,
  parseImportFile,
  resolveRowIds,
  validateRow,
  VALID_ROLES,
  type ImportRow,
  type ImportResult,
  type ParseContext,
} from '@/lib/userImportService';

interface Props {
  open: boolean;
  onClose: () => void;
  elections: { id: string; title: string }[];
  currentUserId: string | null;
  onImported: (count: number) => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const ImportUsersModal: React.FC<Props> = ({ open, onClose, elections, currentUserId, onImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<Step>('upload');
  const [rows, setRows]         = useState<ImportRow[]>([]);
  const [results, setResults]   = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);

  // Élection sélectionnée pour la génération du template
  const [selectedElectionId, setSelectedElectionId] = useState<string>(
    elections[0]?.id ?? ''
  );

  // Données de contexte filtrées par élection sélectionnée
  const [ctx, setCtx]               = useState<ParseContext>({ elections, centers: [], bureaux: [] });
  const [electionType, setElectionType] = useState<string | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  // Charger centres/bureaux/type pour l'élection sélectionnée
  const loadCtxForElection = async (electionId: string) => {
    if (!electionId) return;
    setCtxLoading(true);
    try {
      // Récupérer le type de l'élection + centres liés
      const [{ data: elecData }, { data: ecRows }] = await Promise.all([
        supabase.from('elections').select('type').eq('id', electionId).single(),
        supabase.from('election_centers').select('center_id').eq('election_id', electionId),
      ]);

      setElectionType(elecData?.type ?? null);

      const centerIds = (ecRows ?? []).map((r: any) => r.center_id).filter(Boolean);

      if (centerIds.length === 0) {
        const [{ data: centersData }, { data: bureauxData }] = await Promise.all([
          supabase.from('voting_centers').select('id, name').order('name'),
          supabase.from('voting_bureaux').select('id, name, center_id').order('name'),
        ]);
        setCtx({
          elections,
          centers: centersData ?? [],
          bureaux: (bureauxData ?? []).filter((b: any) => !/^college/i.test(b.name.trim())),
        });
        return;
      }

      const [{ data: centersData }, { data: bureauxData }] = await Promise.all([
        supabase.from('voting_centers').select('id, name').in('id', centerIds).order('name'),
        supabase.from('voting_bureaux').select('id, name, center_id').in('center_id', centerIds).order('name'),
      ]);

      setCtx({
        elections,
        centers: centersData ?? [],
        bureaux: (bureauxData ?? []).filter((b: any) => !/^college/i.test(b.name.trim())),
      });
    } finally {
      setCtxLoading(false);
    }
  };

  // Charger au premier affichage et quand l'élection change
  useEffect(() => {
    if (!open) return;
    const id = selectedElectionId || elections[0]?.id || '';
    if (id) loadCtxForElection(id);
  }, [open, selectedElectionId]);

  // Quand les élections changent, sélectionner la première par défaut
  useEffect(() => {
    if (elections.length > 0 && !selectedElectionId) {
      setSelectedElectionId(elections[0].id);
    }
  }, [elections]);

  const reset = () => {
    setStep('upload');
    setRows([]);
    setResults([]);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const selectedElection = elections.find(e => e.id === selectedElectionId);

  const handleDownloadTemplate = () => {
    const orderedElections = selectedElectionId
      ? [
          ...elections.filter(e => e.id === selectedElectionId),
          ...elections.filter(e => e.id !== selectedElectionId),
        ]
      : elections;
    downloadUserTemplate({
      ...ctx,
      elections:     orderedElections,
      electionType,
      electionTitle: selectedElection?.title,
    });
    toast.success(`Template téléchargé pour "${selectedElection?.title ?? 'élection sélectionnée'}"`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseImportFile(file, ctx);
      if (parsed.length === 0) { toast.error('Le fichier ne contient aucune ligne de données.'); return; }
      setRows(parsed);
      setStep('preview');
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur de lecture du fichier.');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Session expirée'); reset(); return; }

    const validRows = rows.filter(r => validateRow(r).valid);
    const localResults: ImportResult[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const { electionIds, centerIds, bureauId, centerColleges } = resolveRowIds(row, ctx);

      try {
        const body: Record<string, any> = {
          name:                  row.nom,
          email:                 row.email,
          password:              row.password,
          role:                  row.role,
          is_active:             true,
          assigned_election_ids: electionIds.length > 0 ? electionIds : null,
          assigned_election_id:  electionIds[0] ?? null,
          assigned_center_ids:   centerIds.length > 0 ? centerIds : null,
          created_by:            currentUserId,
        };

        // Assignations spécifiques au rôle
        if (row.role === 'president-etablissement') {
          const centerBureaux: Record<string, string[]> = {};
          if (bureauId && centerIds.length > 0) {
            // Trouver le centre du bureau
            const bur = ctx.bureaux.find(b => b.id === bureauId);
            if (bur) centerBureaux[bur.center_id] = [bureauId];
          } else {
            centerIds.forEach(cid => { centerBureaux[cid] = []; });
          }
          body.assigned_center_bureaux  = Object.keys(centerBureaux).length > 0 ? centerBureaux : null;
          body.assigned_center_colleges = Object.keys(centerColleges).length > 0 ? centerColleges : null;
        } else {
          body.assigned_center_colleges = Object.keys(centerColleges).length > 0 ? centerColleges : null;
          body.assigned_center_bureaux  = null;
        }

        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });

        const result = await response.json();
        localResults.push(
          response.ok
            ? { row, status: 'success' }
            : { row, status: 'error', error: result.error ?? response.statusText }
        );
      } catch (err: any) {
        localResults.push({ row, status: 'error', error: err.message ?? 'Erreur réseau' });
      }

      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    // Lignes invalides → erreurs directes
    rows.filter(r => !validateRow(r).valid).forEach(row => {
      const v = validateRow(row);
      localResults.unshift({ row, status: 'error', error: v.errors.join(', ') });
    });

    setResults(localResults);
    setStep('done');

    const successCount = localResults.filter(r => r.status === 'success').length;
    if (successCount > 0) onImported(successCount);
  };

  const validCount   = rows.filter(r => validateRow(r).valid).length;
  const invalidCount = rows.length - validCount;
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount   = results.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#1B2E5A]" />
            Import d'utilisateurs via Excel
          </DialogTitle>
          <DialogDescription className="sr-only">Importer des utilisateurs depuis un fichier Excel</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* ── Étape 1 : upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Sélecteur d'élection */}
              <div className="rounded-xl border bg-white p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-700">
                  Élection cible du template
                </p>
                <Select
                  value={selectedElectionId}
                  onValueChange={v => setSelectedElectionId(v)}
                  disabled={ctxLoading}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une élection…" />
                  </SelectTrigger>
                  <SelectContent>
                    {elections.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedElection && !ctxLoading && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-gray-500">
                      {ctx.centers.length} établissement{ctx.centers.length > 1 ? 's' : ''} ·{' '}
                      {ctx.bureaux.length} bureau{ctx.bureaux.length > 1 ? 'x' : ''}
                    </p>
                    {electionType && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        electionType === 'Élection Professionnelle'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {electionType === 'Élection Professionnelle'
                          ? '🏭 Professionnelle — avec collèges'
                          : `🗳️ ${electionType} — sans collèges`}
                      </span>
                    )}
                  </div>
                )}
                {ctxLoading && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Chargement des établissements…
                  </p>
                )}
              </div>

              <div className="rounded-xl border-2 border-dashed border-[#1B2E5A]/30 bg-blue-50/30 p-5 text-center space-y-3">
                <FileSpreadsheet className="w-10 h-10 text-[#1B2E5A] mx-auto" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Étape 1 — Téléchargez le template</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Généré avec les établissements et bureaux de l'élection sélectionnée.
                    L'élection est pré-remplie dans les exemples.
                  </p>
                </div>
                <Button variant="outline" className="border-[#1B2E5A] text-[#1B2E5A] hover:bg-blue-50"
                  onClick={handleDownloadTemplate} disabled={ctxLoading || !selectedElectionId}>
                  {ctxLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Chargement…</>
                    : <><Download className="w-4 h-4 mr-2" /> Télécharger modele_comptes.xlsx</>}
                </Button>
              </div>

              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center space-y-3">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <div>
                  <p className="font-semibold text-gray-700 text-sm">Étape 2 — Importez le fichier rempli</p>
                  <p className="text-xs text-gray-500 mt-1">Formats acceptés : .xlsx, .xls</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Button onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1B2E5A] hover:bg-[#142347] text-white" disabled={ctxLoading}>
                  <Upload className="w-4 h-4 mr-2" /> Sélectionner le fichier
                </Button>
              </div>

              {/* Structure des colonnes */}
              <div className="rounded-xl border bg-white p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-600 mb-2">Colonnes de la feuille "saisie" :</p>
                {[
                  ['role',        'Obligatoire — ex: validateur, agent-saisie, observateur, president-etablissement'],
                  ['nom',         'Obligatoire — prénom et nom'],
                  ['email',       'Obligatoire — adresse email unique'],
                  ['password',    'Obligatoire — minimum 6 caractères'],
                  ['election',    'Titre exact de l\'élection (feuille "parametres")'],
                  ['[Établissements]', '"Oui" dans la colonne de l\'établissement pour l\'assigner'],
                  ['bureau',      'Nom exact du bureau (feuille "Bureaux")'],
                  ['encadrement / cadre / maitrise / execution', '"Oui" pour activer le collège'],
                ].map(([col, desc]) => (
                  <div key={col} className="flex items-start gap-2 text-xs">
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[#1B2E5A] font-semibold flex-shrink-0 whitespace-nowrap">{col}</span>
                    <span className="text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Étape 2 : prévisualisation ── */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                  <Users className="w-3.5 h-3.5" /> {rows.length} ligne{rows.length > 1 ? 's' : ''}
                </div>
                {validCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5" /> {validCount} valide{validCount > 1 ? 's' : ''}
                  </div>
                )}
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                    <XCircle className="w-3.5 h-3.5" /> {invalidCount} avec erreur{invalidCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Avertissement si centres_ids vides */}
              {rows.some(r => r.centerIds.length === 0) && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    <strong>Établissements non renseignés</strong> pour certaines lignes.
                    Remplissez la colonne <code className="bg-amber-100 px-1 rounded">centres_ids</code> avec les IDs de la feuille "Etablissements" (séparés par virgule).
                    Téléchargez le nouveau template pour voir des exemples concrets.
                  </span>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        {['#','Rôle','Nom','Email','Élection','Étab.','Collèges','Statut'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map(row => {
                        const v = validateRow(row);
                        const { electionIds, centerIds } = resolveRowIds(row, ctx);
                        return (
                          <tr key={row._rowIndex} className={v.valid ? 'bg-white hover:bg-gray-50' : 'bg-red-50'}>
                            <td className="px-3 py-2 text-gray-400">{row._rowIndex}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${VALID_ROLES[row.role] ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                {row.role || <span className="italic">vide</span>}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                              {row.nom || <span className="text-red-400 italic">vide</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {row.email || <span className="text-red-400 italic">vide</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={row.election}>
                              {electionIds.length > 0
                                ? <span className="text-emerald-600 font-medium">{ctx.elections.find(e => e.id === electionIds[0])?.title?.slice(0, 28) ?? row.election}</span>
                                : <span className="text-amber-500 italic">{row.election || '—'}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {centerIds.length > 0
                                ? <span className="text-emerald-600 font-semibold">{centerIds.length} étab. ✓</span>
                                : <span className="text-amber-500 italic">non assigné</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {row.colleges.length > 0
                                ? <span className="text-blue-600">{row.colleges.join(', ')}</span>
                                : <span className="text-gray-400 italic">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {v.valid
                                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                : <span title={v.errors.join(' · ')} className="flex items-center gap-1 text-red-500 cursor-help">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="text-[10px] truncate max-w-[90px]">{v.errors[0]}</span>
                                  </span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {validCount === 0 && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Aucune ligne valide. Corrigez le fichier et réessayez.
                </p>
              )}
            </div>
          )}

          {/* ── Import en cours ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="w-10 h-10 text-[#1B2E5A] animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Import en cours…</p>
                <p className="text-sm text-gray-500 mt-1">{progress}% — ne fermez pas cette fenêtre</p>
              </div>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-[#1B2E5A] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* ── Résultats ── */}
          {step === 'done' && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Créés</p>
                    <p className="text-xl font-bold text-emerald-700">{successCount}</p>
                  </div>
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-xs text-red-500 font-medium">Échecs</p>
                      <p className="text-xl font-bold text-red-600">{errorCount}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-y-auto max-h-64 divide-y">
                  {results.map((r, i) => (
                    <div key={i} className={`flex items-start gap-3 px-3 py-2 text-xs ${r.status === 'success' ? 'bg-white' : 'bg-red-50'}`}>
                      {r.status === 'success'
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <XCircle    className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800">{r.row.nom}</span>
                        <span className="text-gray-400 ml-2">{r.row.email}</span>
                        {r.error && <p className="text-red-500 mt-0.5">{r.error}</p>}
                      </div>
                      <span className="text-gray-400 flex-shrink-0">L.{r.row._rowIndex}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-between items-center pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            {step === 'done' ? 'Fermer' : 'Annuler'}
          </Button>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={reset}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Changer de fichier
                </Button>
                <Button disabled={validCount === 0}
                  className="bg-[#1B2E5A] hover:bg-[#142347] text-white" onClick={handleImport}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Importer {validCount} utilisateur{validCount > 1 ? 's' : ''}
                </Button>
              </>
            )}
            {step === 'done' && errorCount > 0 && (
              <Button variant="outline" onClick={reset}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Réessayer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportUsersModal;
