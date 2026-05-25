# O'Hitu — Gestion des Rôles & Profils Utilisateurs

> Document de référence — généré le 25/05/2026  
> Source : `AuthContext.tsx`, `useRBAC.ts`, `Results.tsx`, `UserManagement.tsx`, `Layout.tsx`

---

## 1. Vue d'ensemble

O'Hitu implémente un système **RBAC (Role-Based Access Control)** à 6 niveaux.  
Chaque utilisateur possède un `role` unique stocké en base (table `users`), et peut être **assigné à une ou plusieurs élections**.

```
super-admin  ──►  accès total, cross-élections
admin        ──►  accès total sur ses élections
───────────────────────────────── (rôles opérationnels)
validateur   ──►  valider les PV de son élection
agent-saisie ──►  saisir les PV de son élection
observateur  ──►  consulter (lecture seule)
president-bureau ──►  voir la saisie + valider (sans soumettre)
```

---

## 2. Matrice des permissions

| Permission | super-admin | admin | validateur | agent-saisie | observateur | president-bureau |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `view:dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `view:elections` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `view:centers` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view:voters` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `view:users` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view:audit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `view:results` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `elections:manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `results:entry` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `results:submit` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `results:validate` | ✅ | ✅ | ✅ | ❌ | ✅¹ | ✅ |
| `results:publish` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `results:observe` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `manage:users:all` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `manage:users:own` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

> ¹ L'observateur a `results:validate` pour **voir** l'onglet Validation, mais le composant lui passe `readOnly=true` — il ne peut pas agir.

---

## 3. Profils détaillés

### 🔴 Super Administrateur (`super-admin`)

**Profil** : Équipe CNX4.0 / administrateur technique de la plateforme.

**Périmètre** : Accès **cross-élections** — voit et gère toutes les élections sans restriction d'assignation.

**Menu visible** : Tableau de Bord · Élections · Résultats · Gestion Utilisateurs · Piste d'Audit

**Actions autorisées** :
- Créer, modifier, supprimer des élections (pro ou standards)
- Créer tous les types de comptes (y compris `admin`, `super-admin`)
- Assigner des élections à n'importe quel utilisateur
- Saisir, valider et **publier** les PV
- Consulter la piste d'audit complète
- Gérer les centres de vote et listes électorales
- Choisir entre toutes les élections dans la page Résultats (menu déroulant libre)

**Restrictions** : Aucune.

---

### 🔵 Administrateur (`admin`)

**Profil** : Chef de mission électorale / coordinateur de campagne.

**Périmètre** : Limité aux **élections qui lui sont assignées** (`assigned_election_ids`).

**Menu visible** : Tableau de Bord · Élections · Résultats · Gestion Utilisateurs

**Actions autorisées** :
- Créer et modifier des élections
- Créer des comptes pour les rôles opérationnels : `validateur`, `agent-saisie`, `observateur` (pas `super-admin`, pas `admin`)
- Assigner ses utilisateurs à ses élections
- Saisir, valider et **publier** les PV
- Voir la liste des élections (filtrée à ses élections)

**Restrictions** :
- Ne peut pas voir la piste d'audit
- Ne peut pas accéder aux listes électorales (`view:voters`)
- Ne peut pas créer de `super-admin` ni d'autre `admin`
- Ses utilisateurs créés (`created_by`) lui sont rattachés

---

### 🟢 Validateur (`validateur`)

**Profil** : Responsable de contrôle qualité des résultats.

**Périmètre** : **Élection(s) assignée(s) uniquement.** Sans assignation → page verrouillée.

**Menu visible** : Tableau de Bord · Élections · Résultats

**Onglets Résultats accessibles** : Valider les résultats uniquement

**Actions autorisées** :
- Consulter les PV saisis (status `entered`)
- Valider ou rejeter des PV (passer en `validated` ou `anomaly`)
- Modifier les données d'un PV avant validation

**Restrictions** :
- Ne peut **pas** saisir de PV (pas de bouton "Saisir un PV")
- Ne peut **pas** publier
- Ne peut **pas** gérer des utilisateurs
- Route de démarrage : `/results` (onglet Validation)

---

### 🟡 Agent de Saisie (`agent-saisie`)

**Profil** : Opérateur terrain / délégué de bureau de vote.

**Périmètre** : **Élection(s) assignée(s) uniquement.** Sans assignation → page verrouillée.

**Menu visible** : Tableau de Bord · Élections · Résultats

**Onglets Résultats accessibles** : Saisir les résultats uniquement

**Actions autorisées** :
- Saisir un PV complet via le wizard 5 étapes :
  1. Identification établissement / bureau / collège
  2. Données de participation (inscrits, votants, nuls, exprimés)
  3. Résultats par candidat / liste syndicale
  4. Joindre une photo du PV
  5. Récapitulatif et soumission
- Sauvegarder un brouillon (stockage local)
- Restaurer un brouillon

**Restrictions** :
- Ne peut **pas** valider ni publier
- Ne peut **pas** modifier un PV déjà soumis (status `entered`) — il faut passer par la validation
- Accès `readOnly=false` sur la saisie uniquement
- Route de démarrage : `/results` (onglet Saisir)

---

### ⚪ Observateur (`observateur`)

**Profil** : Représentant syndical, délégué externe, journaliste accrédité.

**Périmètre** : **Élection(s) assignée(s) uniquement.** Sans assignation → page verrouillée.

**Menu visible** : Tableau de Bord · Élections · Résultats

**Onglets Résultats accessibles** : Valider les résultats (lecture seule)

**Actions autorisées** :
- Consulter l'avancement de la saisie
- Lire les PV et leurs résultats dans l'onglet Validation
- Consulter les statistiques et graphiques du tableau de bord

**Restrictions** :
- Accès `readOnly=true` sur l'onglet Validation → **ne peut rien modifier**
- Ne voit **pas** le bouton "Valider" ni "Rejeter"
- Ne peut **pas** saisir de PV
- Ne peut **pas** publier
- Route de démarrage : `/results`

---

### 🟠 Président de Bureau (`president-bureau`)

**Profil** : Président d'un bureau de vote, responsable légal du PV papier.

**Périmètre** : **Élection(s) assignée(s) uniquement.** Sans assignation → page verrouillée.

**Menu visible** : Tableau de Bord · Élections · Résultats

**Onglets Résultats accessibles** : Saisir les résultats (lecture seule) · Valider les résultats

**Actions autorisées** :
- Consulter l'onglet saisie et l'état d'avancement des bureaux
- Valider ou rejeter des PV (onglet Validation)

**Restrictions** :
- `results:entry` sans `results:submit` → **voit** l'onglet saisie mais **ne peut pas soumettre** (`readOnly=true`)
- Ne peut **pas** publier les résultats
- Route de démarrage : `/results`

---

## 4. Règles de gestion des élections assignées

| Rôle | Élections visibles dans Résultats | Comportement sans assignation |
|---|---|---|
| `super-admin` | **Toutes** les élections (menu libre) | N/A — pas de restriction |
| `admin` | Élections assignées uniquement | Accès résultats vide |
| Rôles opérationnels | Élection(s) assignée(s) uniquement | Page verrouillée (icône 🔒) |

**Champs d'assignation en base (`table users`)** :
- `assigned_election_id` : UUID unique (compatibilité rétrograde)
- `assigned_election_ids` : `UUID[]` — permet l'assignation à **plusieurs élections**

**Logique de résolution** :
```
assignedElectionIds =
  user.assigned_election_ids (si non vide)
  ?? [user.assigned_election_id] (sinon)
  ?? []
```

---

## 5. Qui peut créer quels rôles ?

| Créateur | Rôles qu'il peut attribuer |
|---|---|
| `super-admin` | Tous : `super-admin`, `admin`, `validateur`, `agent-saisie`, `observateur`, `president-bureau` |
| `admin` | Uniquement : `validateur`, `agent-saisie`, `observateur` |

> Les comptes sont créés via l'API Supabase Admin (`/api/admin/create-user`) avec confirmation email automatique.

---

## 6. Navigation — Route de démarrage par rôle

| Rôle | Route par défaut |
|---|---|
| `super-admin` | `/dashboard` |
| `admin` | `/dashboard` |
| `validateur` | `/results` |
| `agent-saisie` | `/results` |
| `observateur` | `/results` |
| `president-bureau` | `/results` |

Les rôles opérationnels atterrissent directement sur la page Résultats car c'est leur unique espace de travail.

---

## 7. Comportement readOnly par section

| Section | Condition readOnly | Effet |
|---|---|---|
| **Saisie PV** | `!can('results:submit')` | Bouton "Saisir un PV" masqué, wizard en lecture seule |
| **Validation PV** | `role === 'observateur'` | Boutons Valider/Rejeter masqués |
| **Publication** | `!can('results:publish')` | Bouton "Publier" désactivé |

---

## 8. Piste d'audit

Chaque action critique est tracée dans la table `audit_logs` :

| Événement tracé | Qui |
|---|---|
| Connexion / Déconnexion | Tous les rôles |
| Création d'un utilisateur | `super-admin`, `admin` |
| Suppression d'un utilisateur | `super-admin`, `admin` |
| Création / modification d'une élection | `super-admin`, `admin` |
| Soumission d'un PV | `super-admin`, `admin`, `agent-saisie` |
| Validation d'un PV | `super-admin`, `admin`, `validateur`, `president-bureau` |
| Publication des résultats | `super-admin`, `admin` |

> Seul le **super-admin** peut consulter la piste d'audit via le menu "Piste d'Audit".

---

*Fichier généré automatiquement — à mettre à jour lors de toute modification de `useRBAC.ts` ou `AuthContext.tsx`.*
