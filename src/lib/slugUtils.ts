/**
 * Génère un slug URL-safe depuis un titre d'élection.
 * Miroir JS de la fonction SQL generate_election_slug().
 * "Élection Municipale 2026" → "election-municipale-2026"
 */
export function generateElectionSlug(title: string): string {
  return title
    .normalize('NFD')                       // décompose les caractères accentués
    .replace(/[̀-ͯ]/g, '')        // supprime les diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')          // supprime les caractères spéciaux
    .trim()
    .replace(/\s+/g, '-')                   // espaces → tirets
    .replace(/-+/g, '-')                    // tirets multiples → un seul
    .replace(/^-|-$/g, '');                 // supprime tirets de début/fin
}

/** Construit l'URL publique d'une élection. */
export function electionResultsPath(slug: string): string {
  return `/election/${slug}/results`;
}
