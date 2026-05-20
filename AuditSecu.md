# Audit & Guide de Sécurité Applicative — o'Hitu (ResElec)

Ce document rassemble les principes fondamentaux de sécurité, de gestion des accès et de résilience réseau appliqués au sein du projet **o'Hitu**. Il définit la **conduite à tenir pour tous les développeurs** lors de l'ajout de nouvelles fonctionnalités, de la mise à jour des pages ou de la modification de la base de données.

---

## 1. Cartographie de la Sécurité Globale

La sécurité de l'application repose sur un principe de **double-barrière** :
1. **Front-End (Contrôle Applicatif)** : Filtrage dynamique des routes, des boutons d'actions et des onglets de résultats en fonction des rôles utilisateur.
2. **Back-End (Sécurité au niveau de la base de données)** : Politiques RLS (Row Level Security) sur Supabase restreignant les requêtes SQL (SELECT, INSERT, UPDATE, DELETE) en fonction du jeton JWT de l'utilisateur connecté.

> [!CAUTION]
> **Règle d'Or** : Un filtre ou masquage visuel dans l'interface utilisateur n'est JAMAIS une sécurité suffisante. Chaque table créée sur Supabase DOIT posséder une politique RLS active correspondante.

---

## 2. Matrice d'Habilitation par Rôle

L'application gère strictement quatre profils d'utilisateurs. Aucun accès anonyme n'est autorisé en dehors de l'écran de connexion (`/login`) et de la consultation des résultats définitifs par l'élection (`/election/:id/results`).

| Fonctionnalité / Route | `super-admin` | `agent-saisie` | `validateur` | `observateur` |
| :--- | :---: | :---: | :---: | :---: |
| **Tableau de bord** (`/dashboard`) | ✅ Oui | ✅ Oui | ✅ Oui | ✅ Oui |
| **Gestion des Élections** (`/elections`) | ✅ Oui | ❌ Non | ❌ Non | ❌ Non |
| **Gestion des Centres** (`/centers`) | ✅ Oui | ✅ Oui | ✅ Oui | ✅ Oui |
| **Liste des Électeurs** (`/voters`) | ✅ Oui | ✅ Oui | ✅ Oui | ✅ Oui |
| **Gestion Utilisateurs** (`/users`) | ✅ Oui | ❌ Non | ❌ Non | ❌ Non |
| **Piste d'Audit** (`/audit`) | ✅ Oui | ❌ Non | ❌ Non | ❌ Non |
| **Saisie de Résultats (Onglet Saisie)** | ✅ Oui | ✅ Oui | ❌ Non | ❌ Non |
| **Validation de Résultats (Onglet Validation)** | ✅ Oui | ❌ Non | ✅ Oui | ❌ Non |
| **Publication Finale (Onglet Publication)** | ✅ Oui | ❌ Non | ❌ Non | ❌ Non |

---

## 3. Conduite à tenir par les Développeurs (Guidelines)

### A. Création d'une Nouvelle Route Sécurisée
Chaque nouvelle route ajoutée dans `src/App.tsx` doit impérativement être enveloppée dans le composant `ProtectedRoute`.

* **Pour une route accessible à tous les utilisateurs connectés :**
  ```tsx
  <Route path="/ma-nouvelle-page" element={
    <ProtectedRoute>
      <MaNouvellePage />
    </ProtectedRoute>
  } />
  ```

* **Pour une route restreinte à des rôles spécifiques (ex: Administrateur uniquement) :**
  ```tsx
  <Route path="/panneau-admin" element={
    <ProtectedRoute allowedRoles={['super-admin']}>
      <PanneauAdmin />
    </ProtectedRoute>
  } />
  ```

### B. Contrôle d'Accès Interne (Composants et Boutons)
Pour masquer ou modifier le comportement d'un élément visuel (bouton de suppression, onglet, action) selon le rôle de l'utilisateur connecté :

1. Importez le hook d'authentification :
   ```typescript
   import { useAuth } from '@/contexts/AuthContext';
   ```
2. Récupérez le profil de l'utilisateur actif :
   ```typescript
   const { user } = useAuth();
   ```
3. Appliquez une condition de rendu robuste :
   ```tsx
   {user?.role === 'super-admin' && (
     <Button variant="destructive">Supprimer définitivement</Button>
   )}
   ```

---

## 4. Résilience & Connectivité Réseau (Offline-First)

Pour répondre aux contraintes des zones gabonaises à connectivité hétérogène (comme Moanda), deux mécanismes d'excellence technique ont été intégrés. Tout développeur modifiant les formulaires de saisie ou de téléversement doit s'y conformer.

### A. Suivi Réseau avec `useNetworkQuality`
Le hook personnalisé `useNetworkQuality` fournit l'état réel et l'estimation de bande passante/latence de l'utilisateur.

```typescript
import { useNetworkQuality } from '@/hooks/useNetworkQuality';

const { isOnline, quality, type, downlink, rtt } = useNetworkQuality();
// quality retourne : 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
```

### B. Sauvegarde Automatique Locale (Autosave)
Pour éviter la perte des données de PV en cas de coupure de courant ou de micro-déconnexion cellulaire :
1. Enregistrez les modifications du formulaire dans le `localStorage` sous une clé unique contenant l'identifiant de l'élection : `ohitu_pv_draft_${electionId}`.
2. Au chargement du formulaire, détectez la clé et proposez un bandeau d'importation de brouillon à l'utilisateur.
3. **Important** : Nettoyez impérativement la clé avec `localStorage.removeItem()` dès que la soumission vers Supabase est validée avec succès.

### C. Compression d'Images Intelligente (Client-side)
Le téléversement de photos de PV physiques (pouvant dépasser 6 Mo) échoue fréquemment sur réseau mobile faible. 
* Si le hook `useNetworkQuality` retourne une qualité `fair`, `poor` ou `offline`, le fichier d'image téléversé doit être intercepté et passé dans un canvas HTML5.
* **Norme de compression** : Redimensionnement à une largeur maximale de **1600px** et encodage au format JPEG avec une qualité de **0.7**. 
* Cela réduit la taille de l'image de 95% (~300 Ko) tout en maintenant une lisibilité totale des signatures et des procès-verbaux d'élections pour les validateurs.

---

## 5. Piste d'Audit & Logs d'Activité

Toutes les actions sensibles (connexion, déconnexion, création d'élection, saisie de PV, validation, publication) doivent faire l'objet d'un enregistrement dans la table `audit_logs` de Supabase.
* Utilisez la fonction d'audit déjà configurée dans le client Supabase ou le contexte Auth.
* Ne stockez jamais d'informations confidentielles ou de mots de passe en clair dans la table des logs.

---

## 6. Liste de Contrôle avant Mise en Prod (Checklist)

Avant chaque fusion (Merge) sur la branche principale ou déploiement :
- [ ] Le build de production passe-t-il sans erreur ? (`npm run build`)
- [ ] Les nouvelles tables Supabase ont-elles la sécurité RLS activée ?
- [ ] Les nouvelles routes ont-elles été enveloppées dans `ProtectedRoute` ?
- [ ] La sauvegarde automatique locale a-t-elle été nettoyée en cas de succès ?
- [ ] Les imports et dépendances inutilisés ont-ils été supprimés pour optimiser le bundle ?
