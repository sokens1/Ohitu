/**
 * notificationService — couche métier des notifications persistantes.
 *
 * Chaque événement métier appelle une méthode `notify*` qui :
 *   1. Appelle find_notification_recipients() (SECURITY DEFINER) pour cibler les destinataires
 *   2. Insère une ligne par destinataire dans la table `notifications`
 *
 * Le NotificationContext s'abonne en temps réel via Supabase Realtime.
 */

import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface DBNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  election_id: string | null;
  center_id: string | null;
  pv_id: string | null;
  document_id: string | null;
  created_at: string;
}

interface NotifyPayload {
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  election_id?: string | null;
  center_id?: string | null;
  pv_id?: string | null;
  document_id?: string | null;
}

// ── Constantes partagées ─────────────────────────────────────────────────────

const COLLEGE_FR: Record<string, string> = {
  cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution', general: 'Encadrement',
};

function collegeLabel(collegeType: string | null | undefined): string {
  if (!collegeType) return '';
  return ` · Collège ${COLLEGE_FR[collegeType] ?? collegeType}`;
}

// ── Helpers internes ──────────────────────────────────────────────────────────

async function getActorId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function findRecipients(
  roles: string[],
  electionId?: string | null,
  centerId?: string | null,
  collegeType?: string | null,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('find_notification_recipients', {
    p_roles:        roles,
    p_election_id:  electionId  ?? null,
    p_center_id:    centerId    ?? null,
    p_college_type: collegeType ?? null,
  });
  if (error) { console.warn('find_notification_recipients error:', error.message); return []; }
  return (data as string[]) ?? [];
}

async function insertNotifications(
  recipientIds: string[],
  actorId: string,
  payload: NotifyPayload,
): Promise<void> {
  if (recipientIds.length === 0) return;
  const rows = recipientIds.map(rid => ({
    recipient_id: rid,
    actor_id:     actorId,
    type:         payload.type,
    title:        payload.title,
    message:      payload.message,
    severity:     payload.severity ?? 'info',
    election_id:  payload.election_id  ?? null,
    center_id:    payload.center_id    ?? null,
    pv_id:        payload.pv_id        ?? null,
    document_id:  payload.document_id  ?? null,
  }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.warn('insertNotifications error:', error.message);
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Récupère toutes les notifications du user courant (les 100 plus récentes).
 */
export async function fetchMyNotifications(): Promise<DBNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { console.warn('fetchMyNotifications:', error.message); return []; }
  return (data as DBNotification[]) ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('read', false);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

// ── Événements métier ─────────────────────────────────────────────────────────

/**
 * Président uploade un document (PV ou liste de participation).
 * → Notifie : agents-saisie du centre+collège + admins
 */
export async function notifyDocumentUploaded(opts: {
  electionId: string;
  centerId: string;
  centerName: string;
  collegeType: string | null;
  documentType: 'pv' | 'participation_list';
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const docLabel = opts.documentType === 'pv' ? 'Procès-verbal' : 'Liste de participation';
  const cLabel   = collegeLabel(opts.collegeType);

  const recipients = await findRecipients(
    ['super-admin', 'admin', 'agent-saisie'],
    opts.electionId, opts.centerId, opts.collegeType,
  );

  await insertNotifications(recipients, actorId, {
    type:       'document_uploaded',
    title:      `${docLabel} joint — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a déposé un ${docLabel.toLowerCase()} pour ${opts.centerName}${cLabel}.`,
    severity:   'info',
    election_id: opts.electionId,
    center_id:   opts.centerId,
  });
}

/**
 * Admin/super-admin donne un avis sur un document.
 * → Notifie : le président qui a uploadé
 */
export async function notifyDocumentReviewed(opts: {
  recipientId:  string;
  centerName:   string;
  collegeType?: string | null;
  documentType: 'pv' | 'participation_list';
  status:       'validated' | 'reserved' | 'rejected';
  comment:      string | null;
  actorName:    string;
  electionId?:  string | null;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const docLabel  = opts.documentType === 'pv' ? 'PV' : 'Liste de participation';
  const cLabel    = collegeLabel(opts.collegeType);
  const statusMap = { validated: 'validé', reserved: 'validé avec réserves', rejected: 'rejeté' };
  const severity  = opts.status === 'validated' ? 'success' : opts.status === 'reserved' ? 'warning' : 'error';

  await insertNotifications([opts.recipientId], actorId, {
    type:       'document_reviewed',
    title:      `${docLabel} ${statusMap[opts.status]} — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a ${statusMap[opts.status]} votre ${docLabel.toLowerCase()} pour ${opts.centerName}${cLabel}${opts.comment ? ` : "${opts.comment}"` : ''}.`,
    severity,
    election_id: opts.electionId ?? null,
  });
}

/**
 * Agent-saisie soumet un PV.
 * → Notifie : validateurs du centre+collège + admins
 */
export async function notifyPVSubmitted(opts: {
  pvId: string;
  electionId: string;
  centerId: string;
  centerName: string;
  bureauName: string;
  collegeType: string | null;
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const collegeLabel = opts.collegeType ? ` (${opts.collegeType})` : '';
  // L'employeur ne reçoit de notification qu'à la publication des résultats
  // (voir notifyResultsPublished) — pas à la soumission d'un PV
  const recipients = await findRecipients(
    ['super-admin', 'admin', 'validateur'],
    opts.electionId, opts.centerId, opts.collegeType,
  );

  await insertNotifications(recipients, actorId, {
    type:       'pv_submitted',
    title:      '📋 Nouveau PV à valider',
    message:    `${opts.actorName} a soumis le PV de ${opts.bureauName}${collegeLabel} — ${opts.centerName}.`,
    severity:   'info',
    election_id: opts.electionId,
    center_id:   opts.centerId,
    pv_id:       opts.pvId,
  });
}

/**
 * Validateur valide un PV.
 * → Notifie : l'agent qui a saisi + admins
 */
export async function notifyPVValidated(opts: {
  pvId: string;
  electionId: string;
  centerId: string;
  centerName: string;
  bureauName: string;
  collegeType: string | null;
  submittedById: string | null;
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const cLabel = collegeLabel(opts.collegeType);
  const adminRecipients = await findRecipients(['super-admin', 'admin']);
  // Rôles à notifier dès la validation d'un PV (l'employeur ne reçoit de notification
  // qu'à la publication des résultats — voir notifyResultsPublished), dans la limite
  // de leurs établissements/bureaux/collèges assignés
  const scopedRecipients = await findRecipients(
    ['observateur', 'president-etablissement', 'president-bureau', 'suppleant-president'],
    opts.electionId, opts.centerId, opts.collegeType,
  );
  const recipients = [...new Set([
    ...adminRecipients,
    ...scopedRecipients,
    ...(opts.submittedById ? [opts.submittedById] : []),
  ])].filter(id => id !== actorId);

  await insertNotifications(recipients, actorId, {
    type:       'pv_validated',
    title:      `PV validé — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a validé le PV de ${opts.bureauName}${cLabel} — ${opts.centerName}.`,
    severity:   'success',
    election_id: opts.electionId,
    center_id:   opts.centerId,
    pv_id:       opts.pvId,
  });
}

/**
 * Validateur rejette un PV (anomalie).
 * → Notifie : l'agent qui a saisi + admins
 */
export async function notifyPVRejected(opts: {
  pvId: string;
  electionId: string;
  centerId: string;
  centerName: string;
  bureauName: string;
  collegeType: string | null;
  submittedById: string | null;
  comment: string;
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const cLabel = collegeLabel(opts.collegeType);
  const adminRecipients = await findRecipients(['super-admin', 'admin']);
  const recipients = [...new Set([
    ...adminRecipients,
    ...(opts.submittedById ? [opts.submittedById] : []),
  ])].filter(id => id !== actorId);

  await insertNotifications(recipients, actorId, {
    type:       'pv_rejected',
    title:      `PV rejeté — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a rejeté le PV de ${opts.bureauName}${cLabel} — ${opts.centerName}${opts.comment ? ` : "${opts.comment}"` : ''}.`,
    severity:   'error',
    election_id: opts.electionId,
    center_id:   opts.centerId,
    pv_id:       opts.pvId,
  });
}

/**
 * Observateur émet un avis (réserves ou conforme).
 * → Notifie : admins + président du centre
 */
export async function notifyObserverOpinion(opts: {
  pvId: string;
  electionId: string;
  centerId: string;
  centerName: string;
  bureauName: string;
  collegeType: string | null;
  conformity: 'conforme' | 'non_conforme';
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const isReserve = opts.conformity === 'non_conforme';
  const cLabel    = collegeLabel(opts.collegeType);
  const recipients = await findRecipients(
    ['super-admin', 'admin', 'president-etablissement', 'suppleant-president'],
    opts.electionId, opts.centerId,
  );

  await insertNotifications(recipients, actorId, {
    type:       'observer_opinion',
    title:      `${isReserve ? 'Réserves émise' : 'Avis conforme'} — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a émis un avis ${isReserve ? 'de réserves' : 'conforme'} sur le PV de ${opts.bureauName}${cLabel} — ${opts.centerName}.`,
    severity:   isReserve ? 'warning' : 'success',
    election_id: opts.electionId,
    center_id:   opts.centerId,
    pv_id:       opts.pvId,
  });
}

/**
 * Admin/président réagit à un avis observateur (approuve ou annule réserves).
 * → Notifie : l'observateur concerné
 */
export async function notifyOpinionReaction(opts: {
  recipientId: string;
  pvId: string;
  electionId: string;
  centerId: string;
  centerName: string;
  bureauName: string;
  collegeType: string | null;
  reactionType: 'approved' | 'overridden';
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const isApproved = opts.reactionType === 'approved';
  const cLabel     = collegeLabel(opts.collegeType);
  await insertNotifications([opts.recipientId], actorId, {
    type:       'opinion_reaction',
    title:      `${isApproved ? 'Réserves approuvée' : 'Réserves annulée'} — ${opts.centerName}${cLabel}`,
    message:    `${opts.actorName} a ${isApproved ? 'approuvé' : 'annulé (marqué conforme)'} votre réserves sur le PV de ${opts.bureauName}${cLabel} — ${opts.centerName}.`,
    severity:   isApproved ? 'success' : 'info',
    election_id: opts.electionId,
    center_id:   opts.centerId,
    pv_id:       opts.pvId,
  });
}

/**
 * Changement de statut d'une élection.
 * → Notifie : tous les utilisateurs assignés à cette élection
 */
export async function notifyElectionStatusChanged(opts: {
  electionId: string;
  electionName: string;
  newStatus: string;
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const statusLabels: Record<string, string> = {
    upcoming:   'À venir',
    active:     'En cours',
    completed:  'Terminée',
    cancelled:  'Annulée',
    published:  'Publiée',
  };
  const label = statusLabels[opts.newStatus] ?? opts.newStatus;
  const severity: NotificationSeverity =
    opts.newStatus === 'active'    ? 'success' :
    opts.newStatus === 'cancelled' ? 'error'   :
    opts.newStatus === 'published' ? 'success' : 'info';

  const recipients = await findRecipients(
    ['validateur', 'agent-saisie', 'observateur', 'president-etablissement', 'president-bureau', 'suppleant-president', 'employeur'],
    opts.electionId,
  );

  await insertNotifications(recipients, actorId, {
    type:        'election_status_changed',
    title:       `🗳️ Élection : ${label}`,
    message:     `${opts.actorName} a changé le statut de "${opts.electionName}" → ${label}.`,
    severity,
    election_id:  opts.electionId,
  });
}

/**
 * Résultats publiés.
 * → Notifie : tous les utilisateurs assignés à cette élection
 */
export async function notifyResultsPublished(opts: {
  electionId: string;
  electionName: string;
  actorName: string;
}): Promise<void> {
  const actorId = await getActorId();
  if (!actorId) return;

  const recipients = await findRecipients(
    ['validateur', 'agent-saisie', 'observateur', 'president-etablissement', 'president-bureau', 'suppleant-president', 'employeur'],
    opts.electionId,
  );

  await insertNotifications(recipients, actorId, {
    type:        'results_published',
    title:       '🏆 Résultats publiés',
    message:     `${opts.actorName} a publié les résultats de "${opts.electionName}".`,
    severity:    'success',
    election_id:  opts.electionId,
  });
}
