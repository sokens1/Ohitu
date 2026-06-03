/**
 * userImportService — génération du template + parsing.
 *
 * Colonnes de la feuille "saisie" :
 *  A  role
 *  B  nom
 *  C  email
 *  D  password
 *  E  election          (titre exact)
 *  F  centres_ids       ← UUIDs séparés par virgule — SOURCE PRINCIPALE pour l'assignation
 *  G  bureau            (nom exact du bureau)
 *  H  encadrement       [pro uniquement] Oui/Non
 *  I  cadre             [pro uniquement] Oui/Non
 *  J  maitrise          [pro uniquement] Oui/Non
 *  K  execution         [pro uniquement] Oui/Non
 *  L+ [Colonnes visuelles] — noms des établissements, "Oui" coché
 *                        → utilisé UNIQUEMENT si centres_ids est vide
 *
 * Stratégie de parsing :
 *  1. Lire centres_ids (UUID directs)
 *  2. Si vide, parcourir les colonnes visuelles et utiliser les IDs de la ligne 2
 *  3. Si toujours vide, matching flou par nom
 */

import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportRow {
  role:         string;
  nom:          string;
  email:        string;
  password:     string;
  election:     string;
  centerIds:    string[];   // UUIDs résolus (toutes méthodes confondues)
  bureau:       string;
  colleges:     string[];   // 'general' | 'cadres' | 'employes' | 'ouvriers'
  _rowIndex:    number;
}

export type ImportRowStatus = 'pending' | 'success' | 'error';
export interface ImportResult { row: ImportRow; status: ImportRowStatus; error?: string; }

// ── Correspondances ───────────────────────────────────────────────────────────

export const VALID_ROLES: Record<string, string> = {
  'super-admin':             'Super Administrateur',
  'admin':                   'Administrateur',
  'validateur':              'Validateur',
  'agent-saisie':            'Agent de Saisie',
  'observateur':             'Observateur',
  'president-etablissement': 'Président de Bureau',
};

const ROLE_ALIASES: Record<string, string> = {
  'super administrateur':    'super-admin',
  'administrateur':          'admin',
  'employeur':               'admin',
  'validateur':              'validateur',
  'agent de saisie':         'agent-saisie',
  'observateur':             'observateur',
  'président de bureau':     'president-etablissement',
  'president de bureau':     'president-etablissement',
  'remplaçant':              'observateur',
};

export function normalizeRole(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (VALID_ROLES[s]) return s;
  return ROLE_ALIASES[s] ?? null;
}

const COLLEGE_COL_MAP: Record<string, string> = {
  encadrement: 'general',
  cadre:       'cadres',
  maitrise:    'employes',
  execution:   'ouvriers',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTruthy(v: any): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'oui' || s === 'yes' || s === '1' || s === 'x' || s === 'true';
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ')
    .replace(/^etablissement\s+/i, '');
}

// ── Données contextuelles ─────────────────────────────────────────────────────

export interface ParseContext {
  elections: { id: string; title: string }[];
  centers:   { id: string; name: string }[];
  bureaux:   { id: string; name: string; center_id: string }[];
}

export interface TemplateData extends ParseContext {
  electionType?:  string | null;
  electionTitle?: string;
}

// ── Helpers type d'élection ───────────────────────────────────────────────────

function isProElection(type?: string | null): boolean {
  return (type ?? '').trim() === 'Élection Professionnelle';
}

function rolesForType(type?: string | null): Record<string, string> {
  return isProElection(type)
    ? {
        'validateur':              'Validateur',
        'agent-saisie':            'Agent de Saisie',
        'observateur':             'Observateur',
        'president-etablissement': 'Président de Bureau',
      }
    : {
        'validateur':  'Validateur',
        'agent-saisie':'Agent de Saisie',
        'observateur': 'Observateur',
      };
}

// ── Génération du template ────────────────────────────────────────────────────

export function downloadUserTemplate({
  elections, centers, bureaux, electionType, electionTitle,
}: TemplateData): void {
  const wb    = XLSX.utils.book_new();
  const isPro = isProElection(electionType);
  const roles = rolesForType(electionType);
  const elec  = electionTitle ?? elections[0]?.title ?? '';

  // Colonnes principales (toujours présentes)
  const MAIN_COLS    = ['role', 'nom', 'email', 'password', 'election', 'centres_ids', 'bureau'];
  // Colonnes collèges (pro uniquement)
  const COLLEGE_COLS = isPro ? ['encadrement', 'cadre', 'maitrise', 'execution'] : [];
  // Colonnes visuelles établissements (pour référence / case à cocher)
  const centerNames  = centers.map(c => c.name);

  const headers = [...MAIN_COLS, ...COLLEGE_COLS, ...centerNames];

  // Ligne 2 (IDs techniques) — grisée, pour le parser en fallback
  const idRow = [
    'IDs',          // marqueur
    '', '', '', '', // nom email pwd election
    '',             // centres_ids (direct)
    '',             // bureau
    ...COLLEGE_COLS.map(() => ''),
    ...centers.map(c => c.id),  // ← UUIDs des établissements visuels
  ];

  // Correspondance rapide centres
  const c0 = centers[0];
  const c1 = centers[1] ?? centers[0];
  const b0 = bureaux.find(b => b.center_id === c0?.id);

  // ── Exemples concrets ─────────────────────────────────────────────────────
  // Exemple 1 : Validateur — 2 établissements assignés, tous les collèges pro
  const ex1Role  = 'validateur';
  const ex1Ctrs  = [c0, c1].filter(Boolean).map(c => c.id).join(',');
  const ex1CtrsDisplay = [c0, c1].filter(Boolean).map(c => c.name).join(', ');
  const ex1 = [
    ex1Role, 'Prenom Nom', 'prenom.nom@exemple.com', 'MotDePasse1',
    elec,
    ex1Ctrs,           // centres_ids ← rempli avec UUIDs réels
    '',                // bureau
    ...(isPro ? ['Oui', 'Oui', '', ''] : []),  // colleges: encadrement + cadre
    ...centers.map(c => (c.id === c0?.id || c.id === c1?.id) ? 'Oui' : ''), // colonnes visuelles
  ];

  // Exemple 2 : Président de bureau (pro) ou Agent de saisie (public) — 1 établissement + bureau + collège
  const ex2Role  = isPro ? 'president-etablissement' : 'agent-saisie';
  const ex2Ctrs  = c0?.id ?? '';
  const ex2Bureau= b0?.name ?? '';
  const ex2 = [
    ex2Role, 'Autre Prenom', 'autre.prenom@exemple.com', 'MotDePasse2',
    elec,
    ex2Ctrs,           // centres_ids ← UN seul centre
    ex2Bureau,         // bureau
    ...(isPro ? ['Oui', '', '', 'Oui'] : []),  // encadrement + execution
    ...centers.map(c => c.id === c0?.id ? 'Oui' : ''), // colonnes visuelles
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, idRow, ex1, ex2]);

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 28 },  // role
    { wch: 22 },  // nom
    { wch: 32 },  // email
    { wch: 16 },  // password
    { wch: 52 },  // election
    { wch: 42 },  // centres_ids ← colonne clé
    { wch: 32 },  // bureau
    ...COLLEGE_COLS.map(() => ({ wch: 14 })),
    ...centers.map(() => ({ wch: 20 })),
  ];

  // Ligne 2 (IDs) en gris très clair — l'utilisateur ne doit pas la modifier
  const grayStyle = { font: { color: { rgb: 'CCCCCC' }, sz: 8 }, fill: { fgColor: { rgb: 'F8F8F8' } } };
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[ref]) ws[ref].s = grayStyle;
  }

  XLSX.utils.book_append_sheet(wb, ws, 'saisie');

  // ── Feuille renseignements ────────────────────────────────────────────────
  const lines: string[][] = [
    ['INSTRUCTIONS'],
    [''],
    ['⚠️ Ne JAMAIS modifier la ligne 2 (IDs).'],
    ['⚠️ Saisissez vos données à partir de la ligne 3.'],
    [''],
    [`Type d'élection : ${electionType ?? 'Non spécifié'}`],
    [''],
    ['COLONNES PRINCIPALES'],
    ['role', `Valeurs acceptées : ${Object.keys(roles).join(', ')}`],
    ['nom', 'Prénom et Nom complet'],
    ['email', 'Email unique — le compte sera créé avec cet email'],
    ['password', 'Mot de passe initial (min 6 caractères)'],
    ['election', `Valeur exacte : ${elec}`],
    ['centres_ids', `[PRINCIPAL] Coller les IDs des établissements séparés par virgule. Ex: ${ex2Ctrs}`],
    ['', `Voir la feuille "Etablissements" pour les IDs disponibles.`],
    ['', `Si vide, les colonnes visuelles (à droite) seront utilisées.`],
    ['bureau', `Nom exact du bureau. Ex: ${ex2Bureau || '(voir feuille Bureaux)'}. Laisser vide = tous les bureaux.`],
  ];
  if (isPro) {
    lines.push(
      [''],
      ['COLONNES COLLÈGES (Oui / Non) [PRO]'],
      ['encadrement', 'Collège Encadrement'],
      ['cadre',       'Collège Cadres'],
      ['maitrise',    'Collège Maîtrise'],
      ['execution',   'Collège Exécution'],
      ['', 'Laisser vide = tous les collèges de l\'établissement.'],
    );
  }
  lines.push(
    [''],
    ['COLONNES VISUELLES (facultatif)'],
    ['[Nom Établissement]', 'Cocher "Oui" si utilisé en complément de centres_ids.'],
  );
  const ws2 = XLSX.utils.aoa_to_sheet(lines);
  ws2['!cols'] = [{ wch: 22 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'renseignements');

  // ── Feuille parametres ────────────────────────────────────────────────────
  const roleKeys = Object.keys(roles);
  const pRows: string[][] = [['Roles disponibles', 'Elections disponibles']];
  const maxR = Math.max(roleKeys.length, elections.length);
  for (let i = 0; i < maxR; i++) {
    pRows.push([
      roleKeys[i] ? `${roleKeys[i]} → ${roles[roleKeys[i]]}` : '',
      elections[i]?.title ?? '',
    ]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(pRows);
  ws3['!cols'] = [{ wch: 42 }, { wch: 62 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'parametres');

  // ── Feuille Etablissements (IDs à copier-coller) ──────────────────────────
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['NOM ÉTABLISSEMENT', 'ID À COPIER dans "centres_ids"'],
    ...centers.map(c => [c.name, c.id]),
  ]);
  ws4['!cols'] = [{ wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Etablissements');

  // ── Feuille Bureaux ───────────────────────────────────────────────────────
  const ws5 = XLSX.utils.aoa_to_sheet([
    ['ÉTABLISSEMENT', 'NOM BUREAU (valeur exacte colonne "bureau")', 'ID Bureau'],
    ...bureaux.map(b => {
      const center = centers.find(c => c.id === b.center_id);
      return [center?.name ?? '', b.name, b.id];
    }),
  ]);
  ws5['!cols'] = [{ wch: 55 }, { wch: 42 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Bureaux');

  // ── Feuille Colleges (pro uniquement) ────────────────────────────────────
  if (isPro) {
    const ws6 = XLSX.utils.aoa_to_sheet([
      ['Colonne Excel', 'college_type (DB)', 'Libellé'],
      ['encadrement', 'general',   'Encadrement'],
      ['cadre',       'cadres',    'Cadres'],
      ['maitrise',    'employes',  'Maîtrise'],
      ['execution',   'ouvriers',  'Exécution'],
      [''],
      ['Laisser toutes vides = tous les collèges de l\'établissement'],
    ]);
    ws6['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws6, 'Colleges');
  }

  XLSX.writeFile(wb, 'modele_comptes.xlsx');
}

// ── Parsing ───────────────────────────────────────────────────────────────────

export function parseImportFile(file: File, ctx: ParseContext): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target?.result, { type: 'binary' });
        const name = wb.SheetNames.includes('saisie') ? 'saisie' : wb.SheetNames[0];
        const ws   = wb.Sheets[name];
        const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (allRows.length < 2) { resolve([]); return; }

        const hdrs: string[] = allRows[0].map((h: any) => String(h).trim().toLowerCase());

        // Ligne 2 (IDs) — présente si la 1ère cellule = "ids" (template nouveau)
        let idRow: string[] | null = null;
        if (allRows.length > 1) {
          const r2 = allRows[1].map((v: any) => String(v ?? '').trim());
          if (r2[0]?.toLowerCase() === 'ids') idRow = r2;
        }

        // Colonnes fixes
        const iRole      = hdrs.indexOf('role');
        const iNom       = hdrs.indexOf('nom');
        const iEmail     = hdrs.indexOf('email');
        const iPwd       = hdrs.indexOf('password');
        const iElec      = hdrs.indexOf('election');
        const iCentresIds= hdrs.indexOf('centres_ids');   // ← colonne principale (nouveau format)
        const iBureau    = hdrs.indexOf('bureau');

        // Colonnes collèges
        const collegeColIdx: Record<string, number> = {};
        Object.keys(COLLEGE_COL_MAP).forEach(col => {
          const idx = hdrs.indexOf(col);
          if (idx >= 0) collegeColIdx[col] = idx;
        });

        // Colonnes visuelles établissements (tout ce qui n'est pas une colonne connue)
        const fixedSet = new Set([
          'role','nom','email','password','election','centres_ids','bureau',
          'encadrement','cadre','maitrise','execution','ids',''
        ]);
        const centerVisualCols: Array<{ ci: number; uuid: string }> = [];
        hdrs.forEach((h, ci) => {
          if (!fixedSet.has(h)) {
            // UUID depuis ligne 2 si disponible, sinon matching par nom
            const uuid = idRow?.[ci] ?? '';
            centerVisualCols.push({ ci, uuid });
          }
        });

        // Data start — sauter la ligne IDs si présente
        const dataStart = idRow ? 2 : 1;

        const parsed: ImportRow[] = allRows
          .slice(dataStart)
          .filter(row => row.some((c: any) => String(c).trim() !== ''))
          .map((row, i) => {
            const rawRole = String(row[iRole] ?? '').trim();

            // ── Méthode 1 : colonne centres_ids (directe, la plus fiable) ──
            let centerIds: string[] = [];
            if (iCentresIds >= 0) {
              const raw = String(row[iCentresIds] ?? '').trim();
              if (raw) {
                centerIds = raw.split(',')
                  .map(s => s.trim())
                  .filter(s => UUID_RE.test(s));
              }
            }

            // ── Méthode 2 : colonnes visuelles avec UUIDs de la ligne 2 ──
            if (centerIds.length === 0) {
              centerVisualCols.forEach(({ ci, uuid }) => {
                if (!isTruthy(row[ci])) return;
                if (uuid && UUID_RE.test(uuid)) {
                  centerIds.push(uuid);
                } else {
                  // Méthode 3 : matching flou par nom de colonne → nom centre en DB
                  const colName = hdrs[ci];
                  const norm = normalizeName(colName);
                  const found = ctx.centers.find(c => {
                    const cn = normalizeName(c.name);
                    return cn === norm || cn.includes(norm) || norm.includes(cn);
                  });
                  if (found && !centerIds.includes(found.id)) centerIds.push(found.id);
                }
              });
            }

            // Collèges
            const colleges: string[] = [];
            Object.entries(collegeColIdx).forEach(([col, ci]) => {
              if (isTruthy(row[ci])) colleges.push(COLLEGE_COL_MAP[col]);
            });

            return {
              role:      normalizeRole(rawRole) ?? rawRole,
              nom:       String(row[iNom]   ?? '').trim(),
              email:     iEmail >= 0 ? String(row[iEmail] ?? '').trim().toLowerCase() : '',
              password:  String(row[iPwd]   ?? '').trim(),
              election:  String(row[iElec]  ?? '').trim(),
              centerIds,
              bureau:    iBureau >= 0 ? String(row[iBureau] ?? '').trim() : '',
              colleges,
              _rowIndex: i + dataStart + 1,
            };
          });

        resolve(parsed);
      } catch (err: any) {
        reject(new Error('Impossible de lire le fichier Excel. Vérifiez le format.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsBinaryString(file);
  });
}

// ── Résolution des IDs ────────────────────────────────────────────────────────

export function resolveRowIds(row: ImportRow, ctx: ParseContext): {
  electionIds:    string[];
  centerIds:      string[];
  bureauId:       string | null;
  centerColleges: Record<string, string[]>;
} {
  // Élection
  const electionIds = ctx.elections
    .filter(e =>
      e.title.trim().toLowerCase() === row.election.trim().toLowerCase() ||
      e.id === row.election
    )
    .map(e => e.id);

  // Centres — déjà résolus dans parseImportFile (centerIds contient les UUIDs)
  const centerIds = [...row.centerIds];

  // Bureau
  let bureauId: string | null = null;
  if (row.bureau) {
    if (UUID_RE.test(row.bureau)) {
      bureauId = row.bureau;
    } else {
      const norm = row.bureau.trim().toLowerCase();
      const found = ctx.bureaux.find(b => b.name.trim().toLowerCase() === norm);
      bureauId = found?.id ?? null;
    }
  }

  // assigned_center_colleges
  const centerColleges: Record<string, string[]> = {};
  if (row.colleges.length > 0) {
    centerIds.forEach(cid => { centerColleges[cid] = row.colleges; });
  }

  return { electionIds, centerIds, bureauId, centerColleges };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface RowValidation { valid: boolean; errors: string[]; }

export function validateRow(row: ImportRow): RowValidation {
  const errors: string[] = [];
  if (!row.nom)      errors.push('Nom manquant');
  if (!row.email)    errors.push('Email manquant');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email invalide');
  if (!row.password) errors.push('Mot de passe manquant');
  else if (row.password.length < 6) errors.push('Mot de passe trop court (min 6)');
  if (!row.role)     errors.push('Rôle manquant');
  else if (!VALID_ROLES[row.role]) errors.push(`Rôle invalide : "${row.role}"`);
  return { valid: errors.length === 0, errors };
}
