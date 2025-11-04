
# 📋 CAHIER DES CHARGES COMPLET - PROJET IKADI / o'Hitu-ResElec

## Version 1.0 - Document Officiel
**Date de création**: Octobre 2025
**Statut**: Finalisé
**Dernière mise à jour**: Octobre 2025

---

## TABLE DES MATIÈRES

1. [Résumé Exécutif](#résumé-exécutif)
2. [Contexte et Enjeux](#contexte-et-enjeux)
3. [Objectifs du Projet](#objectifs-du-projet)
4. [Périmètre Fonctionnel](#périmètre-fonctionnel)
5. [Architecture Technique](#architecture-technique)
6. [Spécifications Détaillées](#spécifications-détaillées)
7. [Modèle de Données](#modèle-de-données)
8. [Rôles et Permissions](#rôles-et-permissions)
9. [Flux Métiers](#flux-métiers)
10. [Interface Utilisateur](#interface-utilisateur)
11. [Qualité et Sécurité](#qualité-et-sécurité)
12. [Plan de Déploiement](#plan-de-déploiement)
13. [Annexes](#annexes)

---

## 1. RÉSUMÉ EXÉCUTIF

### 1.1 Description générale
L'application **IKADI / o'Hitu-ResElec** est une plateforme centralisée de gestion des élections destinée aux autorités électorales (exemple: Gabon). Elle permet de:
- Centraliser et administrer les données électorales
- Automatiser la saisie et validation des procès-verbaux (PV)
- Piloter les résultats en temps réel
- Gérer les utilisateurs et les structures de vote
- Assurer la traçabilité complète (audit trail)

### 1.2 Valeur ajoutée
- **Automatisation**: Réduction des erreurs manuelles et accélération du traitement
- **Centralisation**: Vue d'ensemble en temps réel de tous les scrutins
- **Transparence**: Audit trail complet et rapports détaillés
- **Accessibilité**: Interface web moderne et responsive
- **Sécurité**: Authentification robuste, contrôle d'accès granulaire (RBAC)

### 1.3 Public cible
- Super-administrateurs (gestion système, configuration)
- Responsables électoraux (création/supervision d'élections)
- Agents de saisie (collecte des données de vote)
- Validateurs (contrôle qualité des PV)
- Observateurs (consultation des résultats)

### 1.4 Environnement de déploiement
- **Cloud**: Supabase (Backend-as-a-Service)
- **Frontend**: React 18 + TypeScript via Vite
- **Hébergement**: Statique (Vercel, Netlify, AWS S3, etc.)
- **Navigateurs supportés**: Chrome, Firefox, Safari, Edge (versions récentes)
- **Résolution minimale**: 1024x768px (responsive pour mobile)

---

## 2. CONTEXTE ET ENJEUX

### 2.1 Problématique
Les élections nationales impliquent:
- Collecte de millions de données depuis des milliers de bureaux de vote
- Risques élevés d'erreurs de saisie manuelles
- Délais longs de centralisation et de publication des résultats
- Manque de visibilité en temps réel sur l'avancement du scrutin
- Difficulté à assurer la qualité et la cohérence des données
- Absence de traçabilité complète des modifications

### 2.2 Opportunités
- Dématérialisation progressive de la chaîne électorale
- Amélioration drastique de la vitesse de traitement
- Réduction des coûts opérationnels
- Augmentation de la confiance et de la transparence électorale
- Réutilisabilité pour plusieurs scrutins

### 2.3 Enjeux critiques
- **Intégrité des données**: Aucune perte/corruption de données, versioning complet
- **Sécurité**: Authentification forte, encryption, RLS (Row Level Security)
- **Performance**: Capacité à traiter 100 000+ bureaux simultanément
- **Conformité**: Respect de la réglementation électorale nationale

---

## 3. OBJECTIFS DU PROJET

### 3.1 Objectifs généraux
1. **Centraliser la gestion électorale**: Un point d'accès unique pour tous les scrutins
2. **Automatiser les processus**: Saisie, validation, publication des résultats
3. **Fournir du reporting en temps réel**: KPI, graphiques, alertes
4. **Assurer la gouvernance**: Gestion des utilisateurs, rôles, permissions
5. **Garantir la qualité**: Validation, détection d'anomalies, reconciliation

### 3.2 Objectifs spécifiques par rôle

#### Super-Administrateur
- Créer/éditer/supprimer des élections
- Gérer les utilisateurs (création, modification, suppression, activation/désactivation)
- Configurer les droits d'accès par rôle
- Consulter les audit logs complets
- Publier les résultats définitifs

#### Responsable Électoral
- Créer une élection et ses paramètres (type, date, localisation, candidats)
- Ajouter/éditer les centres et bureaux de vote
- Superviser l'avancement du scrutin
- Valider les PV avant publication
- Exporter les rapports

#### Agent de Saisie
- Saisir les résultats depuis les PV papier
- Signaler des anomalies
- Consulter les résultats provisoires

#### Validateur
- Consulter tous les PV saisis
- Effectuer des contrôles de cohérence
- Valider ou rejeter les PV (avec motif)
- Consulter les anomalies

#### Observateur
- Consulter les résultats en temps réel
- Télécharger les rapports
- Exporter les statistiques
- Pas de droit de modification

### 3.3 KPI de succès
- Taux de disponibilité: ≥ 99.5%
- Temps de réponse moyen: < 2s (au 95e percentile)
- Taux d'adoption utilisateur: ≥ 80% après 3 mois
- Zéro incident de sécurité critique
- 100% de traçabilité des modifications

---

## 4. PÉRIMÈTRE FONCTIONNEL

### 4.1 Modules principaux

#### A. AUTHENTIFICATION ET GESTION D'ACCÈS
**Fonctionnalités**:
- Connexion/déconnexion par email et mot de passe
- Session persistante avec refresh tokens
- Récupération de mot de passe
- Authentification multi-facteurs (MFA) - *Optionnel Phase 2*
- Gestion des sessions actives

**Non inclus dans Phase 1**:
- SSO/OAuth (Google, Microsoft)
- Biométrie

#### B. DASHBOARD (TABLEAU DE BORD)
**Éléments clés**:
- Compte à rebours vers la prochaine élection
- Compteurs clés:
  - Électeurs inscrits
  - Centres de vote
  - Bureaux de vote
  - PV en attente de validation
  - Anomalies détectées
- Activités récentes (ajouts, modifications, validations)
- Actions rapides (créer élection, saisir PV, etc.)
- Statut de la synchronisation en temps réel
- Alertes et notifications

#### C. GESTION DES ÉLECTIONS
**Fonctionnalités de création**:
- Assistant de création (wizard) 5-7 étapes:
  1. Informations générales (titre, type, date/heure)
  2. Localisation (province, commune, arrondissement)
  3. Configuration (sièges, budget, paramètres)
  4. Candidats (ajout manuel ou import)
  5. Centres/Bureaux (association)
  6. Révision et confirmation
  7. Création de la campagne associée (optionnel)

**Fonctionnalités de gestion**:
- Liste/grille des élections avec filtrage:
  - Par statut (À venir, En cours, Terminée, Annulée)
  - Par type (Législatives, Locales)
  - Par période (date range)
  - Recherche par titre
- Vue détaillée de chaque élection:
  - Paramètres généraux
  - Candidats associés
  - Centres/bureaux associés
  - Statistiques (électeurs, bureaux, PV saisis, taux progression)
  - Timeline (création, configuration, lancement, fin, publication)
  - Historique des modifications
- Édition des élections (avant publication)
- Duplication d'une élection (réutiliser config)
- Suppression (archive si commencée)
- Export (PDF, Excel, CSV)

#### D. GESTION DES CANDIDATS
**Fonctionnalités**:
- Ajouter candidat à une élection:
  - Informations: nom, parti, photo, biographie
  - Marqueur "notre candidat" (suivi prioritaire)
  - Contactabilité: email, téléphone, adresse
- Consulter profil candidat:
  - Détails personnels
  - Résultats en temps réel (voix par bureau, %)
  - Évolution des scores
- Éditer candidat (avant publication)
- Supprimer candidat (avant publication)
- Import en masse (CSV/Excel)

#### E. INFRASTRUCTURE DE VOTE
**Gestion des Centres**:
- Ajouter/éditer/supprimer centres de vote:
  - Nom, adresse complète
  - Responsable (nom, téléphone, email)
  - Localisation (province, commune, arrondissement)
  - Coordonnées GPS (optionnel)
  - Nombre d'électeurs
- Consulter détails centre:
  - Bureaux associés
  - Total électeurs
  - État de saisie (% PV reçus)
  - Anomalies détectées

**Gestion des Bureaux**:
- Ajouter/éditer/supprimer bureaux de vote:
  - Nom/numéro du bureau
  - Centre parent
  - Nombre d'électeurs inscrits
  - Président + assesseurs
  - Statut (actif/inactif)
- Consulter détails bureau:
  - Électeurs inscrits
  - Résultats par candidat
  - État du PV (en attente, saisi, validé, publié)
  - Anomalies (écarts, signatures manquantes)

#### F. GESTION DES ÉLECTEURS (Voters)
**Fonctionnalités**:
- Consulter registre électoraux:
  - Liste par centre/bureau
  - Filtres: nom, numéro ID, province, statut
  - Recherche complète
- Importer en masse depuis fichier:
  - Format: CSV, Excel
  - Colonnes attendues: nom, prenom, numero_id, bureau_id, centre_id
  - Validation des doublons
  - Rapport d'import (succès/erreurs)
- Exporter registre (CSV/Excel)
- Gestion des anomalies:
  - Détection automatique des doublons
  - Alertes de malformations
  - Interface de correction

#### G. SAISIE DES RÉSULTATS (DATA ENTRY)
**Workflow de saisie**:
1. **Sélection du bureau**: Choix parmi les bureaux assignés à l'agent
2. **Saisie des données**:
   - Nombre de votants (déduit des listes)
   - Voix par candidat (ajoutées une par une)
   - Votes blancs/nuls
   - Justificatifs (signatures des présidents)
   - Photos du PV original (optionnel)
3. **Validation côté client**:
   - Vérification que total voix ≤ votants
   - Détection d'anomalies
   - Message d'alerte si écart > seuil configurable
4. **Soumission**: Envoi à la base avec statut "saisi"

**Écran de saisie**:
- Formulaire structuré avec:
  - Bureau/centre identifiant (lecture seule)
  - Nombre votants (champ numérique)
  - Table des candidats avec votes (input numérique)
  - Calculs automatiques (total, écart, pourcentages)
  - Zone commentaires/anomalies
  - Boutons: Enregistrer Brouillon, Soumettre, Annuler
- Historique local (dans le navigateur) pour éviter perte

#### H. VALIDATION DES PV
**Workflow de validation**:
1. **Liste des PV en attente**: Table filtrable par:
   - Statut (en attente, validé, rejeté)
   - Bureau/centre
   - Date de saisie
2. **Consultation détaillée**:
   - Affichage du PV saisi
   - Comparaison avec données historiques
   - Détails de l'agent qui a saisi
   - Photos du PV original (si disponibles)
3. **Contrôles effectués**:
   - Cohérence arithmétique (total voix vs votants)
   - Comparaison avec scrutins précédents (taux de participation)
   - Détection d'anomalies (zéro vote, résultats suspects)
   - Vérification des signatures
4. **Actions du validateur**:
   - ✅ Valider (status → "validé")
   - ❌ Rejeter avec motif (status → "rejeté", raison stockée)
   - 🔧 Corriger et valider (édition mineure avant validation)
   - 💬 Ajouter commentaire
5. **Notification** de l'agent (si rejeté) pour correction

#### I. PUBLICATION DES RÉSULTATS
**Workflow de publication**:
1. **Consolidation**: Agrégation des PV validés par:
   - Candidat (total voix, %)
   - Bureau/centre/province (taux participation, turnout)
   - Élection (résumé global)
2. **Génération de rapports**: PDF, Excel avec:
   - Résultats par candidat
   - Classement final
   - Graphiques (barres, camemberts)
   - Statistiques de saisie/validation
   - Déclaration de résultats
3. **Vérifications pré-publication**:
   - 100% des PV validés
   - Aucune anomalie critique non expliquée
   - Cohérence globale
4. **Publication finale**:
   - Verouillage des données (read-only)
   - Génération des certificats/signatures
   - Export et archivage
   - Notification publique

#### J. GESTION DES UTILISATEURS
**Fonctionnalités**:
- Créer utilisateur:
  - Nom, email, mot de passe initial
  - Rôle (super-admin, manager, data-entry, validateur, observateur)
  - Assignation aux centres (optionnel, selon rôle)
  - Activation/statut
- Consulter liste utilisateurs:
  - Filtres: rôle, statut, centre, date création
  - Recherche par nom/email
  - Affichage: nombre d'actions, dernière connexion
- Éditer utilisateur:
  - Modification données personnelles
  - Changement de rôle
  - Réassignation centres
  - Activation/désactivation
- Suppression (archive, non physique)
- Reset de mot de passe
- Historique des actions par utilisateur

#### K. NOTIFICATIONS
**Types de notifications**:
- **Système**: Erreurs, mises à jour serveur
- **Métier**: PV validé, anomalie détectée, saisie complète pour bureau
- **Administratives**: Nouvel utilisateur, changement de rôle
- **Alertes**: Taux de saisie bas, fin de délai, publication prête

**Canal de notification**:
- In-app (toast/snackbar)
- Email (pour événements critiques)
- Persistence locale (compteur non lus)

#### L. RAPPORTS ET EXPORTS
**Types de rapports disponibles**:
1. **Rapport de synthèse**: Résumé élection, candidats, résultats
2. **Rapport détaillé**: Tous résultats par bureau, anomalies, signataires
3. **Rapport de progression**: Taux saisie/validation, courbes temporelles
4. **Rapport d'anomalies**: Liste complète avec motifs, agents responsables
5. **Audit trail**: Historique complet modifications, utilisateur, timestamp

**Formats d'export**: PDF, Excel (.xlsx), CSV
**Permissions**: Selon rôle (observateur: vue seule, admin: tous)

#### M. CAMPAGNE (OPTIONNEL PHASE 1)
*Note: Actuellement squelette, à affiner*

**Modules identifiés**:
- Opérations de campagne: Meeting, porte-à-porte, distribution
- Calendrier et timeline
- Participants et responsables
- Discussions/commentaires
- Analyse de rapports

### 4.2 Non inclus (ou Phase 2+)

**Fonctionnalités futures**:
- Système de consultation/sondages en ligne
- Streaming vidéo des centres
- Paiement/facturation de services
- Intégration avec systèmes gouvernementaux (SSO, API)
- Machine learning pour détection d'anomalies avancée
- Statistiques géospatiales interactives
- Support offline et synchronisation

---

## 5. ARCHITECTURE TECHNIQUE

### 5.1 Stack technologique

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (Client Web)                      │
├─────────────────────────────────────────────────────────────┤
│ Framework:     React 18 (TypeScript)                         │
│ Build tool:    Vite 5.4.20                                  │
│ Router:        React Router v6.26.2                         │
│ State Mgmt:    TanStack Query (React Query) v5.56.2          │
│ Forms:         React Hook Form v7.53.0 + Zod v3.25.76      │
│ UI Component:  shadcn-ui + Radix UI v1.x                   │
│ Styling:       Tailwind CSS v3.4.11 + PostCSS              │
│ Icons:         lucide-react v0.462.0                        │
│ Charts:        Recharts v2.12.7                             │
│ Notifications: sonner v1.5.0                                │
│ Misc:          date-fns, clsx, class-variance-authority    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (BaaS - Supabase)                  │
├─────────────────────────────────────────────────────────────┤
│ Database:      PostgreSQL 15+ (via Supabase)               │
│ Auth:          Supabase Auth (JWT, custom claims)          │
│ API:           RESTful via Supabase SDK                    │
│ Realtime:      WebSocket (Supabase Realtime)              │
│ File Storage:  Storage buckets (PV photos, exports)       │
│ Row Level Sec: PostgreSQL RLS policies (RBAC)             │
│ Functions:     PostgreSQL functions (reports, aggregates) │
│ Logging:       Supabase Logs                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                 HOSTING & INFRASTRUCTURE                     │
├─────────────────────────────────────────────────────────────┤
│ Frontend Host: Vercel / Netlify / AWS S3 + CloudFront     │
│ Backend Host:  Supabase Cloud                              │
│ Domain:        Custom domain (https)                       │
│ CDN:           Built-in (Vercel/Netlify) or CloudFront    │
│ Monitoring:    Sentry, Supabase Logs, CloudWatch          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Architecture applicative

**Pattern architectural**: Clean Architecture avec séparation des responsabilités

```
src/
├── pages/                          # Pages routées (12+ pages)
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── ElectionManagementUnified.tsx
│   ├── Results.tsx
│   ├── CampaignManagement.tsx
│   └── ...
├── components/                     # Composants réutilisables
│   ├── ui/                        # Composants UI primitifs (60+)
│   ├── elections/                 # Elections: modals, wizards, détails
│   ├── results/                   # Saisie, validation, publication
│   ├── campaign/                  # Gestion campagne
│   ├── charts/                    # Graphiques métier
│   ├── dashboard/                 # Widgets dashboard
│   └── Layout.tsx
├── api/                           # Couche API (appels Supabase)
│   ├── elections.ts
│   ├── results.ts
│   └── metrics.ts
├── lib/                           # Utilitaires et services
│   ├── supabase.ts               # Client Supabase + types
│   ├── utils.ts                  # Helpers (formatting, math)
│   ├── services/                 # Services métier
│   └── validation/               # Schémas Zod
├── hooks/                         # Custom React hooks
│   ├── useElectionState.ts       # Gestion état élections
│   ├── useElectionVotersSync.ts  # Sync votants
│   └── ...
├── contexts/                      # React contexts
│   ├── AuthContext.tsx           # Authentication
│   └── NotificationContext.tsx   # Notifications
├── types/                         # Types TypeScript
│   ├── elections.ts              # Domain types
│   └── ...
├── styles/                        # CSS custom
│   ├── design-system.css         # Design tokens
│   └── ...
├── utils/                         # Utilitaires globaux
│   ├── electionCalculations.ts
│   └── sitemap.ts
├── main.tsx                       # Bootstrap
├── App.tsx                        # Routes + providers
└── index.css                      # Styles globaux
```

### 5.3 Flux de données

```
User Interaction (UI)
         ↓
React Component (useState, useContext)
         ↓
Custom Hook (useElectionState, etc.)
         ↓
API Call (TanStack Query)
         ↓
Supabase Client (JS SDK)
         ↓
PostgreSQL + RLS Policies
         ↓
Response (normalized)
         ↓
Cache Management (TanStack Query)
         ↓
React Re-render (UI update)
```

### 5.4 Sécurité et authentification

**Authentification**:
- Supabase Auth (JWT tokens, refresh tokens)
- Session stockée en `localStorage` (ohitu-user)
- Logout: suppression session + localStorage
- Protected routes via composant `ProtectedRoute.tsx`

**Autorisation (RBAC)**:
- 4 rôles: `super-admin`, `agent-saisie`, `validateur`, `observateur`
- Row Level Security (RLS) PostgreSQL pour filtrer données
- Policies par table (users, elections, results, etc.)
- Vérification côté UI (masquage actions) + côté DB (enforcement)

**Protection des données**:
- HTTPS obligatoire
- Variables d'env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Jamais exposer service role key côté client
- Encryption Supabase par défaut (TLS in transit, at rest)
- Storage buckets privés pour PV/documents sensibles

### 5.5 Scalabilité et performance

**Performance**:
- **Frontend**:
  - Code splitting automatique (Vite)
  - Tree-shaking (suppression code non utilisé)
  - Lazy loading routes (React.lazy)
  - Memoization composants (React.memo)
  - Cache agressif (TanStack Query: staleTime, cacheTime)
  - Images optimisées (format webp, lazy loading)
  
- **Backend**:
  - Indexes PostgreSQL sur colonnes clés (election_id, status, etc.)
  - Vues materializées pour rapports lourds
  - Connection pooling (Supabase)
  - Réplication lecture (read replicas si needed)

**Scalabilité**:
- Support 100 000+ bureaux de vote simultanés
- Partitioning des tables géantes (procès_verbaux, candidate_results)
- Caching CDN pour assets statiques
- Réplication base de données

---

## 6. SPÉCIFICATIONS DÉTAILLÉES

### 6.1 Authentification et Session

**Cas d'usage: Connexion**
```
1. Utilisateur accède /login
2. Remplit email + password
3. Appelle supabase.auth.signInWithPassword()
4. Si succès → récupère user depuis table users
5. Stocke session en localStorage
6. Redirige vers /dashboard
7. Si erreur → affiche message erreur, reste sur /login

Données stockées:
{
  id: string (UUID)
  name: string
  email: string
  role: UserRole ('super-admin' | 'agent-saisie' | 'validateur' | 'observateur')
  isActive: boolean
}
```

**Cas d'usage: Session persistante**
```
1. App démarre (App.tsx)
2. useAuth() hook vérifie localStorage
3. Si session existe → restaure utilisateur
4. Sinon → requête supabase.auth.getSession()
5. Si valid → continue, sinon redirige /login
```

**Cas d'usage: Déconnexion**
```
1. Utilisateur clique "Déconnexion"
2. supabase.auth.signOut()
3. Nettoie localStorage
4. Redirige /login
```

### 6.2 Gestion des Élections

**Cas d'usage: Créer une élection (Wizard 7 étapes)**

```
Étape 1: Infos générales
  - Inputs: titre, type (Législatives/Locales), date/heure, description
  - Validation: titre non vide, date ≥ aujourd'hui
  - Nextable si ✓

Étape 2: Localisation
  - Select: province → commune → arrondissement
  - Extraction optionnelle depuis description
  - API: fetch depuis tables provinces/communes/arrondissements

Étape 3: Configuration
  - Nombre de sièges (entier > 0)
  - Budget optionnel
  - Vote goal (objectif voix, optionnel)
  - Allow multiple candidates (toggle)
  - Auto-close time (HH:MM, optionnel)

Étape 4: Candidats
  - Option 1: Ajouter manuellement (form)
  - Option 2: Import CSV/Excel
  - Champs: nom, parti, photo, biographie, "notre candidat" (flag)

Étape 5: Centres/Bureaux
  - Sélectionner centres existants
  - Ou créer nouveaux (address, responsable, etc.)
  - Calcul automatique total électeurs

Étape 6: Révision
  - Affichage résumé complet
  - Édition possible (retour aux étapes)

Étape 7: Confirmation
  - Insertion DB:
    * Table elections
    * election_candidates (liens)
    * election_centers (liens)
  - Notification succes
  - Redirection vers vue détaillée de l'élection
```

**Structure DB - Table elections**
```sql
CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Législatives', 'Locales')),
  status TEXT NOT NULL DEFAULT 'À venir' CHECK (status IN ('À venir', 'En cours', 'Terminée', 'Annulée')),
  election_date TIMESTAMP WITH TIME ZONE NOT NULL,
  election_end_time TIME DEFAULT NULL,
  description TEXT,
  province TEXT,
  commune TEXT,
  arrondissement TEXT,
  nb_electeurs INTEGER DEFAULT 0,
  nb_bureaux INTEGER DEFAULT 0,
  seats_available INTEGER,
  budget DECIMAL(15,2),
  vote_goal INTEGER,
  allow_multiple_candidates BOOLEAN DEFAULT FALSE,
  require_photo_validation BOOLEAN DEFAULT FALSE,
  auto_close_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  CONSTRAINT positive_electeurs CHECK (nb_electeurs >= 0),
  CONSTRAINT positive_bureaux CHECK (nb_bureaux >= 0)
);
```

**Cas d'usage: Lister et Filtrer**
```
1. Récupère toutes élections via supabase.from('elections').select()
2. Applique filtres côté client:
   - Status (À venir, En cours, Terminée, Annulée)
   - Type (Législatives, Locales)
   - Period (date range)
   - Search (titre contient)
3. Affiche grid ou list view
4. Chaque card montre: titre, type, date, status, badge progression
5. Click → vue détaillée
```

**Cas d'usage: Éditer une élection**
```
Restrictions:
- Avant publication uniquement
- Super-admin et créateur peuvent éditer
- Les champs éditables: titre, description, candidats, centres (limité)

Actions:
- Charge formulaire préfill
- Valide et MAJ base
- Notification succès
- Historique édition stocké
```

**Cas d'usage: Supprimer une élection**
```
Restrictions:
- Avant lancement uniquement
- Super-admin only

Actions:
- Demande confirmation
- Archive (soft delete) si PV déjà saisis
- Ou suppression physique si vierge
- Notification
```

### 6.3 Saisie des Résultats

**Workflow détaillé - Saisie d'un PV**

```
1. Agent accède /results → select élection
2. Écran affiche bureaux assignés à cet agent
3. Click sur un bureau → formulaire saisie
4. Préchargement données (nb votants estimé, candidats)
5. Saisie:
   - Nombre de votants (ajustable)
   - Voix par candidat (table avec inputs)
   - Votes blancs/nuls (séparé)
   - Commentaires
   - Upload photo PV (optionnel)
6. Validations côté client:
   - Total voix ≤ votants
   - Aucun champ vide critique
   - Alerte si écart > 5% (configurable)
7. Sauvegarde en brouillon (localStorage)
8. Soumission → DB avec status "saisi"
9. Redirection liste PV + notification
```

**Structure DB - Table procès_verbaux**
```sql
CREATE TABLE procès_verbaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id),
  bureau_id UUID NOT NULL REFERENCES voting_bureaux(id),
  center_id UUID REFERENCES voting_centers(id),
  status TEXT NOT NULL DEFAULT 'en_attente' 
    CHECK (status IN ('en_attente', 'saisi', 'validé', 'rejeté', 'publié')),
  num_voters INTEGER NOT NULL,
  blank_votes INTEGER DEFAULT 0,
  null_votes INTEGER DEFAULT 0,
  comments TEXT,
  photo_url TEXT,
  entered_by UUID REFERENCES users(id),
  validated_by UUID REFERENCES users(id),
  validation_notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT positive_voters CHECK (num_voters > 0)
);

CREATE TABLE candidate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES procès_verbaux(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  election_id UUID NOT NULL REFERENCES elections(id),
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT non_negative_votes CHECK (votes >= 0)
);
```

### 6.4 Validation des PV

**Workflow - Validation**

```
1. Validateur accède /results → onglet "Validation"
2. Liste PV en attente (status = 'saisi', triage par date)
3. Click sur un PV → vue détaillée
4. Affichage:
   - Données saisies
   - Photo PV original (side-by-side)
   - Données historiques (scrutins précédents même bureau)
   - Flagging anomalies détectées
5. Contrôles automatiques:
   - Cohérence arithmétique (total = votants + blancs + nuls + voix candidats)
   - Outlier detection vs historique (écart > 20% → flag)
   - Signature validité (optionnel si photo)
   - Comparaison taux participation national
6. Actions validateur:
   a) ✅ VALIDER → status = 'validé', validated_by = user.id, validated_at = NOW()
   b) ❌ REJETER → status = 'rejeté', validation_notes = "Motif", notify agent
   c) 🔧 CORRIGER → édition mineure + validation auto
   d) 💬 COMMENTER → ajoute comment sans changer status
7. Post-action → notification agent (si rejeté), feed activité MAJ
```

**Logique de détection d'anomalies**

```typescript
interface Anomaly {
  type: 'arithmetic' | 'outlier' | 'missing_signature' | 'low_participation';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

function detectAnomalies(pv: ProtocoVerbaux, historique: ProtocoVerbaux[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  // 1. Incohérence arithmétique
  const totalVoix = pv.candidate_results.sum(r => r.votes) + pv.blank_votes + pv.null_votes;
  if (totalVoix !== pv.num_voters) {
    anomalies.push({
      type: 'arithmetic',
      severity: 'high',
      description: `Total voix (${totalVoix}) ≠ votants (${pv.num_voters}), écart: ${Math.abs(totalVoix - pv.num_voters)}`
    });
  }
  
  // 2. Outlier vs historique
  if (historique.length > 0) {
    const avgParticipation = historique.reduce((sum, h) => sum + (h.num_voters / h.bureau.registered_voters), 0) / historique.length;
    const currentParticipation = pv.num_voters / pv.bureau.registered_voters;
    if (Math.abs(currentParticipation - avgParticipation) > 0.2) { // 20% écart
      anomalies.push({
        type: 'outlier',
        severity: 'medium',
        description: `Taux participation anormal: ${(currentParticipation*100).toFixed(1)}% vs historique ${(avgParticipation*100).toFixed(1)}%`
      });
    }
  }
  
  // 3. Signature manquante (si photo fournie)
  if (!pv.photo_url) {
    anomalies.push({
      type: 'missing_signature',
      severity: 'low',
      description: 'Photo du PV non fournie'
    });
  }
  
  return anomalies;
}
```

### 6.5 Publication des Résultats

**Workflow - Publication**

```
1. Super-admin accède /results → onglet "Publication"
2. Conditions préalables vérifiées:
   - 100% PV validés (status = 'validé')
   - Aucune anomalie critique non résolue
   - Election status = 'En cours'
3. Écran affiche:
   - Résumé résultats consolidés
   - Candidats classés par voix
   - Taux participation
   - Graphiques (barres, camemberts)
   - Rapport détaillé (PDF preview)
4. Click "Publier" → Confirmation
5. Actions:
   - Status all PV → 'publié'
   - Status election → 'Terminée'
   - Lock données (read-only)
   - Generate + sign rapports (PDF, Excel, CSV)
   - Archivage (immutable storage)
   - Notification publique (webhook/email)
6. Redirection vers "Résultats Publiés" (read-only view)
```

**Rapports générés**

```
1. Rapport synthèse (PDF)
   - En-tête officiel
   - Titre élection, date, localisation
   - Résultats candidats (tableau + graphiques)
   - Classement final
   - Signatures numériques
   - Timestamp publication

2. Rapport détaillé (Excel, 3 feuilles)
   - Sheet 1: Résumé global
   - Sheet 2: Résultats par bureau (tous les détails)
   - Sheet 3: Anomalies détectées + motifs

3. Données brutes (CSV)
   - Format: candidate_id, candidate_name, votes, votes_%
   - Téléchargeable pour réutilisation
```

### 6.6 Gestion des Utilisateurs

**Structure DB - Table users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,  -- Linked to Supabase Auth
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'observateur'
    CHECK (role IN ('super-admin', 'agent-saisie', 'validateur', 'observateur')),
  is_active BOOLEAN DEFAULT TRUE,
  assigned_centers TEXT[], -- Array of center IDs (for role-based access)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Cas d'usage: Créer utilisateur**
```
1. Super-admin accède Gestion Utilisateurs → "Créer"
2. Formulaire:
   - Nom (text, non vide)
   - Email (email unique)
   - Mot de passe temporaire (généré)
   - Rôle (select 4 options)
   - Centres assignés (multiselect, optionnel)
   - Actif/Inactif (toggle, default=true)
3. Validation côté client
4. Appel API → création dans users + supabase.auth
5. Email envoyé au nouvel user (mot de passe temp)
6. Notification succès, utilisateur peut se connecter
```

**Cas d'usage: Éditer/Désactiver**
```
- Super-admin peut:
  * Éditer nom, email, centres assignés
  * Changer rôle (avec confirmation)
  * Désactiver user (reste DB, mais is_active=false)
  * Réinitialiser mot de passe
- Utilisateur peut:
  * Changer son propre mot de passe
  * Voir ses informations
```

---

## 7. MODÈLE DE DONNÉES

### 7.1 Schéma relationnel complet

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE TABLES                             │
└─────────────────────────────────────────────────────────────┘

users
├── id (PK, UUID)
├── email (unique)
├── name
├── role (super-admin, agent-saisie, validateur, observateur)
├── is_active
├── created_at
└── assigned_centers (array)

elections
├── id (PK, UUID)
├── title
├── type (Législatives, Locales)
├── status (À venir, En cours, Terminée, Annulée)
├── election_date (timestamp)
├── province, commune, arrondissement
├── nb_electeurs, nb_bureaux
├── created_by (FK users)
└── created_at

┌─────────────────────────────────────────────────────────────┐
│                   LOCATION HIERARCHY                         │
└─────────────────────────────────────────────────────────────┘

provinces
├── id (PK)
├── name
└── region (optionnel)

communes
├── id (PK)
├── province_id (FK)
└── name

arrondissements
├── id (PK)
├── commune_id (FK)
└── name

┌─────────────────────────────────────────────────────────────┐
│                  VOTING INFRASTRUCTURE                       │
└─────────────────────────────────────────────────────────────┘

voting_centers
├── id (PK, UUID)
├── name
├── address
├── province_id, commune_id, arrondissement_id (FKs)
├── responsible_name, responsible_phone, responsible_email
├── latitude, longitude (optionnel, pour cartographie)
├── created_at

voting_bureaux
├── id (PK, UUID)
├── center_id (FK voting_centers)
├── name (bureau #1, #2, etc.)
├── registered_voters (nombre inscrits)
├── president_name, assessors (array)
├── status (actif/inactif)
├── created_at

┌─────────────────────────────────────────────────────────────┐
│                    ELECTORAL DATA                            │
└─────────────────────────────────────────────────────────────┘

candidates
├── id (PK, UUID)
├── name
├── party
├── photo_url
├── biography
├── email, phone, address (contact)
├── created_at

election_candidates (junction table)
├── id (PK)
├── election_id (FK elections)
├── candidate_id (FK candidates)
├── is_our_candidate (boolean, flag prioritaire)
├── position (ordre affichage)

voters
├── id (PK, UUID)
├── full_name
├── id_number
├── bureau_id (FK voting_bureaux)
├── center_id (FK voting_centers)
├── enrollment_date
├── status (actif/révoqué/décédé)

┌─────────────────────────────────────────────────────────────┐
│                   RESULTS & VALIDATION                       │
└─────────────────────────────────────────────────────────────┘

procès_verbaux
├── id (PK, UUID)
├── election_id (FK elections)
├── bureau_id (FK voting_bureaux)
├── status (en_attente, saisi, validé, rejeté, publié)
├── num_voters, blank_votes, null_votes
├── entered_by (FK users)
├── validated_by (FK users)
├── validation_notes
├── photo_url (PV paper original)
├── submitted_at, validated_at, created_at

candidate_results (PV breakdown by candidate)
├── id (PK)
├── pv_id (FK procès_verbaux)
├── candidate_id (FK candidates)
├── election_id (FK elections)
├── votes (count)

┌─────────────────────────────────────────────────────────────┐
│                  AUDIT & NOTIFICATIONS                       │
└─────────────────────────────────────────────────────────────┘

activity_logs
├── id (PK, UUID)
├── user_id (FK users)
├── action (CREATE, UPDATE, DELETE, PUBLISH)
├── resource_type (election, pv, user, candidate)
├── resource_id (UUID de la ressource affectée)
├── changes (JSONB, old values → new values)
├── timestamp

notifications
├── id (PK, UUID)
├── user_id (FK users)
├── type (system, electoral, admin, alert)
├── title, message
├── is_read
├── action_url (optionnel)
├── created_at
```

### 7.2 Vues SQL (consolidation données)

```sql
-- Résumé élection (KPI dashboard)
CREATE OR REPLACE VIEW election_summary AS
SELECT 
  e.id,
  e.title,
  e.status,
  COUNT(DISTINCT vc.id) as total_centers,
  COUNT(DISTINCT vb.id) as total_bureaux,
  COALESCE(SUM(vb.registered_voters), 0) as total_voters,
  COUNT(DISTINCT c.id) as total_candidates,
  COUNT(DISTINCT pv.id) FILTER (WHERE pv.status IN ('validé', 'publié')) as completed_pvs,
  COUNT(DISTINCT pv.id) FILTER (WHERE pv.status = 'saisi') as pending_pvs,
  COUNT(DISTINCT pv.id) FILTER (WHERE pv.status = 'rejeté') as rejected_pvs
FROM elections e
LEFT JOIN voting_centers vc ON e.id = vc.election_id
LEFT JOIN voting_bureaux vb ON vc.id = vb.center_id
LEFT JOIN election_candidates ec ON e.id = ec.election_id
LEFT JOIN candidates c ON ec.candidate_id = c.id
LEFT JOIN procès_verbaux pv ON e.id = pv.election_id
GROUP BY e.id;

-- Résultats candidats consolidés
CREATE OR REPLACE VIEW candidate_election_results AS
SELECT 
  ec.election_id,
  ec.candidate_id,
  c.name,
  c.party,
  ec.is_our_candidate,
  COALESCE(SUM(cr.votes), 0) as total_votes,
  ROUND(100.0 * SUM(cr.votes) / NULLIF((SELECT SUM(votes) FROM candidate_results WHERE election_id = ec.election_id), 0), 2) as vote_percentage,
  ROW_NUMBER() OVER (PARTITION BY ec.election_id ORDER BY SUM(cr.votes) DESC) as rank
FROM election_candidates ec
JOIN candidates c ON ec.candidate_id = c.id
LEFT JOIN candidate_results cr ON ec.candidate_id = cr.candidate_id AND ec.election_id = cr.election_id
GROUP BY ec.election_id, ec.candidate_id, c.name, c.party, ec.is_our_candidate;

-- Taux de saisie par bureau
CREATE OR REPLACE VIEW bureau_completion_rate AS
SELECT 
  e.id as election_id,
  vb.id as bureau_id,
  vb.name,
  vc.name as center_name,
  CASE 
    WHEN pv.id IS NOT NULL THEN 'Complété'
    ELSE 'En attente'
  END as status,
  vb.registered_voters
FROM voting_bureaux vb
JOIN voting_centers vc ON vb.center_id = vc.id
LEFT JOIN elections e ON TRUE  -- Cross join pour avoir toutes les élections
LEFT JOIN procès_verbaux pv ON e.id = pv.election_id AND vb.id = pv.bureau_id AND pv.status IN ('validé', 'publié');
```

### 7.3 Row Level Security (RLS) - Exemple

```sql
-- Elections: Observateurs voient toutes, autres peuvent modifier leurs propres
CREATE POLICY "elections_observer_view" ON elections
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'observateur'
    OR current_user_role() IN ('super-admin', 'agent-saisie', 'validateur')
  );

-- Procès-verbaux: Chacun voit ses données
CREATE POLICY "pv_data_entry_view" ON procès_verbaux
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'observateur'
    OR entered_by = auth.uid()
    OR validated_by = auth.uid()
    OR current_user_role() = 'super-admin'
  );

-- Résultats candidats: Masqués jusqu'à publication
CREATE POLICY "candidate_results_protection" ON candidate_results
  FOR SELECT TO authenticated
  USING (
    (SELECT status FROM procès_verbaux WHERE id = pv_id) = 'publié'
    OR current_user_role() IN ('super-admin', 'validateur')
  );

-- Utilisateurs: Chacun voit son profil + super-admin voit tous
CREATE POLICY "users_self_view" ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR current_user_role() = 'super-admin'
  );
```

---

## 8. RÔLES ET PERMISSIONS

### 8.1 Matrice RBAC détaillée

```
┌────────────────────┬──────────┬────────────────┬──────────────┬─────────────┬────────────────┐
│ Fonctionnalité     │ Super    │ Election       │ Data Entry   │ Validateur  │ Observateur    │
│                    │ Admin    │ Manager        │ Agent        │             │                │
├────────────────────┼──────────┼────────────────┼──────────────┼─────────────┼────────────────┤
│ Créer élection     │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Éditer élection    │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Supprimer élection │    ✅    │      ❌        │      ❌      │     ❌      │      ❌        │
│ Consulter élection │    ✅    │      ✅        │      ✅      │     ✅      │      ✅        │
│                    │          │                │              │             │                │
│ Créer utilisateur  │    ✅    │      ❌        │      ❌      │     ❌      │      ❌        │
│ Éditer utilisateur │    ✅    │      ❌        │      ❌      │     ❌      │      ❌        │
│ Supprimer user     │    ✅    │      ❌        │      ❌      │     ❌      │      ❌        │
│ Lister utilisateurs│    ✅    │      ❌        │      ❌      │     ❌      │      ❌        │
│                    │          │                │              │             │                │
│ Ajouter candidat   │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Éditer candidat    │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Supprimer candidat │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│                    │          │                │              │             │                │
│ Gérer centres      │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Consulter centres  │    ✅    │      ✅        │      ✅      │     ✅      │      ✅        │
│                    │          │                │              │             │                │
│ Saisir PV          │    ✅    │      ❌        │      ✅*     │     ❌      │      ❌        │
│ Voir PV en attente │    ✅    │      ✅        │      ✅*     │     ✅      │      ❌        │
│                    │          │                │              │             │                │
│ Valider PV        │    ✅    │      ✅        │      ❌      │     ✅      │      ❌        │
│ Rejeter PV        │    ✅    │      ✅        │      ❌      │     ✅      │      ❌        │
│                    │          │                │              │             │                │
│ Publier résultats │    ✅    │      ✅        │      ❌      │     ❌      │      ❌        │
│ Voir résultats    │    ✅    │      ✅        │      ✅      │     ✅      │      ✅        │
│                    │          │                │              │             │                │
│ Export rapports   │    ✅    │      ✅        │      ❌      │     ✅      │      ✅        │
│ Audit logs        │    ✅    │      ✅*       │      ❌      │     ✅*     │      ❌        │
│                    │          │                │              │             │                │
│ Gestion campagne  │    ✅    │      ✅        │      ❌      │     ❌      │      ✅ (vue)  │
│ Conversations     │    ✅    │      ✅        │      ✅      │     ✅      │      ❌        │

* Limité à leurs données (centres assignés, PV qu'ils ont saisis, etc.)
```

### 8.2 Descriptions des rôles

**1. Super-Administrateur** (`super-admin`)
- Accès complet à l'application
- Gestion des utilisateurs (création, modification, suppression)
- Configuration système
- Publication des résultats
- Consultation de tous les audit logs
- Gestion de la sécurité (rôles, permissions, clés)

**2. Manager d'Élection / Responsable Électoral** (`election-manager`)
- Créer et configurer les élections
- Gérer les candidats et centres de vote
- Superviser l'avancement du scrutin
- Valider les PV (collaboration avec validateurs)
- Exporter les rapports
- Voir l'historique des actions (limité)

**3. Agent de Saisie / Collecteur de Données** (`agent-saisie`)
- Accès en lecture des élections assignées
- Saisir les résultats des PV (uniquement ses bureaux assignés)
- Consulter les résultats provisoires
- Accès à ses propres PV saisis
- Signaler des anomalies par commentaire

**4. Validateur** (`validateur`)
- Consultation en lecture de tous les PV saisis
- Validation/rejet des PV avec motifs
- Correction de données mineures
- Consultation des anomalies détectées
- Export des rapports de validation
- Voir l'historique de validation

**5. Observateur** (`observateur`)
- Consultation en lecture seule
- Voir résultats finaux publiés
- Télécharger/exporter rapports
- Consulter statistiques et graphiques
- Pas d'action de modification

### 8.3 Contrôles d'accès détaillés (code)

```typescript
// Exemple: ProtectedRoute avec vérification rôle
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RequireRoleProps {
  children: React.ReactNode;
  requiredRoles: UserRole[];
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children, requiredRoles }) => {
  const { user, authLoading } = useAuth();

  if (authLoading) return <div>Chargement...</div>;
  
  if (!user || !requiredRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

// Usage:
// <RequireRole requiredRoles={['super-admin', 'election-manager']}>
//   <ElectionManagement />
// </RequireRole>

// Exemple: Hook utilitaire pour vérifier permission
export const usePermission = () => {
  const { user } = useAuth();

  return {
    canCreateElection: () => ['super-admin', 'election-manager'].includes(user?.role || ''),
    canSaisirPV: () => ['super-admin', 'agent-saisie'].includes(user?.role || ''),
    canValidatePV: () => ['super-admin', 'validateur', 'election-manager'].includes(user?.role || ''),
    canPublish: () => ['super-admin', 'election-manager'].includes(user?.role || ''),
    canManageUsers: () => ['super-admin'].includes(user?.role || ''),
  };
};
```

---

## 9. FLUX MÉTIERS

### 9.1 Flux de création d'élection

```
┌─────────────┐
│   Accueil   │ Manager ou Super-admin clique "Nouvelle élection"
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Wizard Étape 1      │ Infos générales (titre, type, date)
│ Infos générales     │ Validations: titre non vide, date ≥ J
└──────┬──────────────┘
       │ Next
       ▼
┌─────────────────────┐
│ Wizard Étape 2      │ Select: province → commune → arrondissement
│ Localisation        │ Optionnel: auto-extraction de description
└──────┬──────────────┘
       │ Next
       ▼
┌─────────────────────┐
│ Wizard Étape 3      │ Sièges, budget, vote goal, paramètres
│ Configuration       │
└──────┬──────────────┘
       │ Next
       ▼
┌─────────────────────┐
│ Wizard Étape 4      │ Ajouter candidats (manuel ou import CSV)
│ Candidats           │
└──────┬──────────────┘
       │ Next
       ▼
┌─────────────────────┐
│ Wizard Étape 5      │ Sélectionner centres existants
│ Centres/Bureaux     │ Calcul auto total électeurs
└──────┬──────────────┘
       │ Next
       ▼
┌─────────────────────┐
│ Wizard Étape 6      │ Révision complète de tous les paramètres
│ Révision            │ Possibilité de retour à chaque étape
└──────┬──────────────┘
       │ Next / Finish
       ▼
┌─────────────────────┐
│ Wizard Étape 7      │ Confirmation finale
│ Confirmation        │
└──────┬──────────────┘
       │ Confirm
       ▼
┌─────────────────────┐
│  DB Insert          │ Insertion:
│  - elections        │ - election (table)
│  - links            │ - election_candidates (links)
│  - activity_log     │ - election_centers (links)
│                     │ - activity_log (audit)
└──────┬──────────────┘
       │ Success
       ▼
┌─────────────────────────────┐
│ Notification + Redirection  │ Toast succès
│ Vers vue détaillée élection │ Redirection /elections/:id
└─────────────────────────────┘
```

### 9.2 Flux de saisie et validation d'un PV

```
JOUR DU SCRUTIN
└─────────────────────────────────────────────────────────────

T0: Bureau de vote physique clôt (18:00)
│
├─► PV papier rempli = données brutes (votants, voix par candidat, signatures)
│
└─► Agent de saisie reçoit PV physique

└─────────────────────────────────────────────────────────────

PHASE 1: SAISIE (Agent de saisie)
│
T0+1h: Agent se connecte à l'appli → /results
│
├─► Localise le bureau dans sa liste
│
├─► Click → Formulaire saisie
│
├─► Remplit:
│  ├─ Nb votants (depuis PV)
│  ├─ Voix par candidat (+ votes blancs/nuls)
│  └─ Commentaires (anomalies visibles)
│
├─► Sauvegarde brouillon (localStorage)
│
├─► Valide et Soumet
│   ├─ Vérifications client (total voix ≤ votants)
│   ├─ Alerte si écart > 5%
│   ├─ Upload photo PV (optionnel)
│
├─► DB: status = 'saisi', entered_by = user.id
│
└─► Notification succès

└─────────────────────────────────────────────────────────────

PHASE 2: VALIDATION (Validateur)
│
T0+2h: Validateur accède /results → onglet Validation
│
├─► Voir liste PV en attente (filter par élection, bureau, date)
│
├─► Click sur un PV → Vue détaillée
│
├─► Affichage:
│  ├─ Données saisies
│  ├─ Photo PV original (side-by-side)
│  ├─ Données historiques (scrutins précédents même bureau)
│  └─ Anomalies détectées (auto-flags)
│
├─► Validateur effectue contrôles manuels:
│  ├─ Cohérence arithmétique
│  ├─ Outlier detection vs historique
│  ├─ Signature validity
│  └─ Comparaison taux participation
│
├─► Décision:
│  ├─ ✅ VALIDER
│  │   ├─ status = 'validé'
│  │   ├─ validated_by = user.id
│  │   ├─ activity_log = VALIDATED
│  │   └─ Notification agent (succès)
│  │
│  ├─ ❌ REJETER
│  │   ├─ status = 'rejeté'
│  │   ├─ validation_notes = "Motif: écart arithmétique 5v, vérifier"
│  │   ├─ activity_log = REJECTED
│  │   └─ Notification agent (correction nécessaire)
│  │
│  ├─ 🔧 CORRIGER (si modif mineure)
│  │   ├─ Form éditable
│  │   ├─ Correction appliquée
│  │   └─ Validation auto post-correction
│  │
│  └─ 💬 COMMENTER
│      └─ Ajoute note sans changer status
│
└─► Next PV

└─────────────────────────────────────────────────────────────

BOUCLE CORRECTION (si rejeté)
│
├─► Agent notifié via notification in-app
│
├─► Agent retourne au formulaire du bureau (brouillon restauré)
│
├─► Correction des données
│
├─► Re-soumission
│
└─► Retour à Phase 2 Validation

└─────────────────────────────────────────────────────────────

PHASE 3: CONSOLIDATION & PUBLICATION
│
T0+24h: 100% PV validés
│
├─► Super-admin / Manager accède /results → onglet Publication
│
├─► Écran affiche:
│  ├─ Résumé résultats consolidés
│  ├─ Candidats classés par voix
│  ├─ Taux participation national
│  ├─ Rapport détaillé (PDF preview)
│  └─ Vérifications pré-pub (✅ 100% validé, ✅ Aucune anomalie critique)
│
├─► Click "Publier" → Confirmation avec signature numérique
│
├─► DB Actions:
│  ├─ Tous PV: status = 'publié'
│  ├─ Election: status = 'Terminée'
│  ├─ Lock données (read-only)
│  ├─ Generate rapports (PDF, Excel, CSV)
│  ├─ Sign rapports avec certificat
│  ├─ Archive données (immutable storage)
│  └─ activity_log = PUBLISHED
│
├─► Notification publique (webhook, email, SMS optionnel)
│
└─► Redirection vers "Résultats Publiés" (read-only view)

└─────────────────────────────────────────────────────────────

POST-PUBLICATION
│
├─► Tous utilisateurs: accès lecture résultats
│
├─► Observateurs: peuvent télécharger/exporter rapports
│
├─► Audit trail complet traçable
│
└─► Données archivées pour conformité légale
```

### 9.3 Flux de gestion utilisateurs

```
Super-admin → /users

1. CRÉER UTILISATEUR
   ├─ Click "Créer utilisateur"
   ├─ Form: nom, email, rôle, centres assignés
   ├─ Mot de passe généré automatiquement
   ├─ Insertion DB + Supabase Auth
   ├─ Email invitation envoyé (mot de passe temp)
   └─ Notification succès

2. MODIFIER UTILISATEUR
   ├─ Click user → Click "Éditer"
   ├─ Form éditable
   ├─ Possibilité de changer rôle (confirmation requise)
   ├─ Réassignment centres
   ├─ Update DB
   └─ Notification changement

3. DÉSACTIVER UTILISATEUR
   ├─ Click user → "Désactiver"
   ├─ is_active = false
   ├─ User ne peut plus se connecter
   ├─ Données restent en DB (soft delete)
   └─ Logs toujours traçables

4. RESET MOT DE PASSE
   ├─ Click user → "Réinitialiser MdP"
   ├─ Nouveau mot de passe généré
   ├─ Email sent
   └─ User forcé changement prochaine connexion

5. CONSULTER AUDIT UTILISATEUR
   ├─ Click user → "Actions"
   ├─ Timeline: création, modifications, actions métier
   └─ Traçabilité complète
```

---

## 10. INTERFACE UTILISATEUR

### 10.1 Design System

**Palette couleurs o'Hitu-ResElec**:
- **Vert (#006400)**: En-tête, navigation, branding
- **Bleu (#1E90FF)**: Boutons primaires, CTA
- **Jaune (#FDB913)**: Hover, accents, warnings
- **Gris clair (#F5F7FA)**: Arrière-plan général
- **Blanc (#FFFFFF)**: Cartes, modales

**Typographie**:
- **Headings**: Roboto Bold (24px, 20px, 16px)
- **Body**: Inter Regular (14px, 16px)
- **Code**: Monaco/Courier mono (12px)

**Composants UI** (shadcn-ui):
- Button (4 variantes: primary, secondary, ghost, destructive)
- Card, Modal, Tabs, Select, Input, Checkbox, Radio
- Table, DataTable (avec tri, pagination, filtres)
- Chart (Bar, Line, Pie, Donut)
- Alert, Toast, Badge, Tooltip

### 10.2 Pages principales

**1. Login (/login)**
- Logo o'Hitu en haut
- Formulaire email + password
- Lien "Mot de passe oublié"
- Responsive (mobile: layout vertical, desktop: côte à côte)

**2. Dashboard (/dashboard)**
- Header: logo, user profile, notifications
- Sections principales:
  - Prochaine élection (countdown)
  - KPI cards (électeurs, centres, bureaux, PV attente)
  - Activités récentes (feed)
  - Actions rapides (grid boutons)
- Responsive grid layout (1-2-3 colonnes selon écran)

**3. Elections (/elections)**
- Filtres: statut, type, période, recherche
- Vue grid/list (toggle)
- Chaque carte: titre, type, date, status badge, progress bar
- Modales: détails, créer, éditer, supprimer

**4. Centres de Vote (/centers)**
- Liste/table centres
- Détails centre: nom, adresse, bureaux, électeurs, state saisie
- Modales: ajouter, éditer, détails bureaux

**5. Électeurs (/voters)**
- Vue table voters
- Filtres: centre, bureau, nom, numéro ID
- Import CSV/Excel
- Export registre

**6. Résultats (/results)**
- Tab 1: Saisie (formulaire bureau par bureau)
- Tab 2: Validation (liste PV, détails, validation UI)
- Tab 3: Publication (résumé, rapports, bouton publier)

**7. Gestion Utilisateurs (/users)**
- Table utilisateurs
- Filtres: rôle, statut, centre
- Actions: créer, éditer, désactiver, reset mdp

**8. Campagne (/campaign)**
- 3 vues: Calendrier, Liste, Paramètres
- Opérations: meeting, porte-à-porte, distribution
- Wizard création opération

### 10.3 Patterns d'interaction

**Modales**:
- Backdrop avec opacity
- Close button (X)
- Titre clair
- Footer: Cancel, OK/Submit
- Keyboard: Escape ferme
- Focus trap (a11y)

**Confirmations destructives**:
- Modale avec avertissement rouge
- Texte explicite: "Êtes-vous sûr ?"
- Bouton Submit rouge avec label clair (ex: "Supprimer définitivement")

**Notifications**:
- Toast sonner (top-right, 5s auto-close)
- Types: success (vert), error (rouge), info (bleu), warning (jaune)
- Icon + message + close button

**Formulaires**:
- Labels clairs
- Validation in-real-time (Zod)
- Error messages sous champs
- Disabled submit si erreurs
- Enter pour submit (sauf textarea)

**Tables**:
- Header sticky (scroll vertical)
- Tri colonnes (click icon)
- Pagination (10, 25, 50 rows par page)
- Row hover highlight
- Checkbox select all / individual
- Bulk actions (delete, export, etc.)

### 10.4 Responsive Design

**Breakpoints**:
- Mobile: < 640px (Tailwind sm)
- Tablet: 640px - 1024px (md)
- Desktop: ≥ 1024px (lg)

**Adaptations**:
- Mobile: single column, stacked modales
- Tablet: 2 colonnes, toggles au lieu de tabs si espace manque
- Desktop: 3+ colonnes, pleins écran layouts

---

## 11. QUALITÉ ET SÉCURITÉ

### 11.1 Qualité du code

**Normes respectées**:
- ESLint + Prettier (formatage automatique)
- TypeScript strict (tsconfig.json)
- Pas d'`any` implicite; typage exhaustif
- React best practices:
  - Hooks correctement dépendance (exhaustive-deps ESLint)
  - Pas de side effects dans render
  - Keys correctes pour listes
- Performance:
  - Memoization pour composants coûteux (React.memo)
  - useCallback pour fonctions stables
  - useMemo pour calculs lourds

**Tests** (Phase 2+):
- Unit tests: Jest + React Testing Library
- Coverage minimum: 80%
- Integration tests: Cypress pour workflows critiques
- Load testing: k6 ou JMeter

**Documentation**:
- README.md complet
- JSDoc pour fonctions critiques
- Swagger/OpenAPI pour API (si applicable)
- Architecture Decision Records (ADRs)

### 11.2 Sécurité

**Authentification**:
- Supabase Auth (gestion tokens, refresh)
- Session JWT stockée en localStorage
- HTTPS obligatoire en prod
- CORS restrictif

**Autorisation**:
- RLS (Row Level Security) PostgreSQL enforces access
- Vérification côté UI (UX) + côté DB (security)
- Pas de trust du client pour permissions

**Data Protection**:
- Encryption in transit (TLS 1.3)
- Encryption at rest (Supabase défaut)
- Storage buckets privés pour documents sensibles
- Pas d'exposition d'IDs internes en URL publique
- Input validation (Zod schemas)
- SQL injection prevention (Supabase parameterized queries)

**Audit & Logging**:
- Activity logs complets (user, action, timestamp, changes)
- Immuabilité des logs (append-only)
- Retention: 7 ans (conformité électorale)
- No PII exposure dans logs (sauf uuid)

**Secret Management**:
- `.env.local` non committé (.gitignore)
- Variables d'env pour tous secrets (URLs, keys)
- Supabase vault pour secrets sensibles (Phase 2)

### 11.3 Conformité

**RGPD**:
- Privacy policy publique
- Data minimization: récolter que ce qui est nécessaire
- Right to be forgotten: suppression de compte + données associées
- Data portability: export en format ouvert

**Réglementation électorale**:
- Intégrité données: versioning complet, audit trail
- Non-repudiation: signatures numériques sur rapports (optionnel Phase 2)
- Confidentialité: PV secrets jusqu'à publication
- Transparence: rapports publics post-publication

---

## 12. PLAN DE DÉPLOIEMENT

### 12.1 Environnements

**Développement** (`dev`)
- Branche: `develop`
- Déployé: auto sur push vers develop
- Audience: Dev team, QA
- DB: Supabase dev

**Staging** (`staging`)
- Branche: `release/*` ou manual trigger
- Déployé: sur demande avant release
- Audience: Stakeholders, clients, UAT
- DB: Supabase staging (copy prod anonymized)

**Production** (`prod`)
- Branche: `main` (releases tags)
- Déployé: manual approvals via CI/CD
- Audience: Publique
- DB: Supabase prod (backups journaliers)

### 12.2 CI/CD Pipeline (GitHub Actions / Vercel)

```yaml
# Déploiement dev (auto)
on: push [develop]
  → npm run lint
  → npm run build
  → npm run test (si ajoutés)
  → Deploy Vercel dev

# Déploiement staging (manual)
on: workflow_dispatch [release/*]
  → All checks + security scan
  → Deploy Vercel staging
  → Notify stakeholders

# Déploiement prod (manual approvals)
on: workflow_dispatch [main]
  → All checks + security scan + load test
  → Draft release notes
  → Await approval
  → Deploy Vercel prod
  → Health check
  → Notify ops + users
```

### 12.3 Checklist pré-déploiement

- [ ] Code review approuvé
- [ ] Tests passent (lint, unit, integration)
- [ ] Performance budget respecté (< 2s TTI)
- [ ] Security scan clean (OWASP, SCA)
- [ ] DB migrations testées et validées
- [ ] Feature flags configurés (rollback prêt)
- [ ] Monitoring/alertes setup
- [ ] Documentation à jour
- [ ] Changelog rédigé
- [ ] Stakeholders notifiés

### 12.4 Post-déploiement

- [ ] Health checks OK (endpoints, DB, Auth)
- [ ] Smoke tests passent
- [ ] Monitoring metrics observables
- [ ] Alertes configurées
- [ ] Runbooks disponibles pour ops
- [ ] On-call team notifié

### 12.5 Rollback plan

En cas d'incident critique:
1. Trigger automatic rollback si health checks fail
2. Manual rollback command: `vercel --prod --alias <previous-version>`
3. DB rollback: restore de backup (transaction log replay)
4. Notification clients + status page update

---

## 13. ANNEXES

### A. Glossaire et Abréviations

| Terme | Definition |
|-------|------------|
| **PV** | Procès-Verbal: document récapitulatif résultats scrutin bureau |
| **Bureau de vote** | Local où se déroule le scrutin (ex: école) |
| **Centre de vote** | Ensemble de bureaux (ex: commune = 1 centre + N bureaux) |
| **Électeur** | Personne habilitée à voter |
| **Candidat** | Personne se présentant à l'élection |
| **Scrutin** | Acte de voter (élection + moment) |
| **Taux participation** | (Votants / Électeurs inscrits) × 100% |
| **RLS** | Row Level Security: contrôle accès au niveau ligne BD |
| **RBAC** | Role-Based Access Control: gestion droits par rôle |
| **JWT** | JSON Web Token: token auth stateless |
| **OWASP** | Open Web Application Security Project: bonnes pratiques sécurité |
| **a11y** | Accessibilité (11 lettres entre a et y) |
| **UAT** | User Acceptance Testing: phase test utilisateur |

### B. Questions fréquentes (FAQ)

**Q: Quels navigateurs sont supportés?**
A: Chrome, Firefox, Safari, Edge (versions N-1 et N). IE non supporté.

**Q: Comment se passe la migration depuis l'ancien système?**
A: Phase 1 = créer élection neuve. Phase 2 = import données historiques avec validation.

**Q: Peut-on travailler offline?**
A: Non en Phase 1. Phase 2+ : service worker + sync queue possible.

**Q: Combien d'utilisateurs simultanés supportés?**
A: Supabase scaling auto: 1000+ concurrent users sans dégradation.

**Q: Données conservées combien de temps?**
A: 7 ans minimum (conformité électorale). Backups archivés 10 ans.

**Q: Can I export all results?**
A: Oui, PDF/Excel/CSV disponibles post-publication.

### C. Contact et Support

**Points de contact**:
- **Tech Lead**: Pour issues architecture, performance
- **Product Owner**: Pour demandes features, prioritization
- **DevOps**: Pour déploiements, infrastructure
- **Security**: Pour incidents, vulnérabilités

**Escalade**:
1. Issue tracker (GitHub Issues)
2. Slack #ikadi-alerts
3. Status page: status.ikadi.app

---

## 14. HISTORIQUE DES VERSIONS

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| 1.0 | Oct 2025 | Tech Team | Cahier des charges initial complet |
| 1.1 | TBD | TBD | Intégrations Phase 2 (SSO, offline) |
| 2.0 | TBD | TBD | ML anomaly detection, géospatial |

---

**Fin du Cahier des Charges**

*Ce document est confidentiel et destiné au projet IKADI / o'Hitu-ResElec.*
*Date d'émission: Octobre 2025*
*Prochaine révision: Q1 2026*
