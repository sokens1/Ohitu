/** Entité élection minimale pour les règles de visibilité publique. */
export type ElectionVisibilityFields = {
  is_public_visible?: boolean | null;
  is_published?: boolean | null;
  status?: string | null;
};

/** Élection affichée sur login, accueil public, sélecteur de résultats. */
export function isElectionVisibleOnPublic(election: ElectionVisibilityFields): boolean {
  if (election.is_public_visible === false) return false;
  const status = String(election.status || '').trim().toLowerCase();
  if (status === 'annulée' || status === 'annulee') return false;
  return true;
}

/** Élection avec résultats accessibles sur la vue publique. */
export function isElectionPublishedForPublic(election: ElectionVisibilityFields): boolean {
  return election.is_published === true && isElectionVisibleOnPublic(election);
}
