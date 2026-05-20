// Types unifiés pour la gestion des élections
export type ElectionType = 'Législatives' | 'Locales' | 'Élection Professionnelle';
export type ElectionStatus = 'À venir' | 'En cours' | 'Terminée' | 'Annulée';
export type UserRole = 'super-admin' | 'election-manager' | 'data-entry' | 'observer';

// ============================================================================
// Types spécifiques aux Élections Professionnelles (Délégués du Personnel)
// ============================================================================

export type EnterpriseSector = 'public' | 'parapublic' | 'prive';
export type CnepStatus = 'pending' | 'accepted' | 'mise_en_demeure' | 'rejected' | 'ras';
export type CollegeType = 'cadres' | 'employes' | 'ouvriers' | 'general';

// Entreprise / Établissement
export interface Enterprise {
  id?: string;
  name: string;
  sector: EnterpriseSector;
  administrativeUnit: string; // Ministère de rattachement
  totalEmployees: number;
  employeesByCategory: {
    cadres: number;
    employes: number;
    ouvriers: number;
  };
  hrContact: {
    name: string;
    phone: string;
    email: string;
  };
  province: string;
  commune: string;
  provinceId?: string;
  communeId?: string;
}

// Syndicat
export interface Union {
  id?: string;
  name: string;
  acronym: string;
  registrationNumber: string; // N° récépissé
  registrationDate?: string;
  federation?: string;
  confederation?: string;
}

// Membre d'une liste syndicale (Titulaire ou Suppléant)
export interface UnionListMember {
  name: string;
  position?: string; // Poste dans l'entreprise
  order: number; // Ordre sur la liste
}

// Liste syndicale pour une élection
export interface UnionList {
  id?: string;
  electionId?: string;
  union: Union;
  college: CollegeType;
  isIndependent: boolean; // Liste libre (2nd tour si carence)
  cnepStatus: CnepStatus;
  cnepObservation?: string;
  titulaires: UnionListMember[];
  suppleants: UnionListMember[];
}

// Collège électoral
export interface ElectoralCollege {
  id?: string;
  name: string;
  type: CollegeType;
  totalVoters: number;
  seatsToFill: number; // Délégués à élire dans ce collège
}

// Configuration spécifique Élection Professionnelle
export interface ProfessionalElectionConfig {
  enterprise: Enterprise;
  unionLists: UnionList[];
  colleges: ElectoralCollege[];
  chronogram: {
    listDisplayDate: string; // Affichage listes (scrutin - 5 jours)
    campaignStart: string;
    campaignEnd: string;
    firstRoundDate: string;
    secondRoundDate?: string; // 1er tour + 7 jours
    recoursStart?: string;
    recoursEnd?: string;
  };
  hasSecondRound: boolean;
  carence: boolean; // Aucune liste valide au 1er tour
  participationRate?: number;
  legalFramework: string; // Ex: 'LOI-022-2021 + Arrêté 000147'
}

// Interface géographique unifiée
export interface GeographicLocation {
  province: string;
  commune: string;
  arrondissement: string;
  fullAddress: string;
}

// Configuration d'élection
export interface ElectionConfig {
  seatsAvailable: number;
  budget?: number;
  voteGoal?: number;
  allowMultipleCandidates: boolean;
  requirePhotoValidation: boolean;
  autoCloseTime?: string; // HH:MM format
}

// Statistiques d'élection
export interface ElectionStats {
  totalVoters: number;
  totalCandidates: number;
  totalCenters: number;
  totalBureaux: number;
  completedSteps: number;
  totalSteps: number;
  progressPercentage: number;
}

// Timeline d'élection
export interface ElectionTimeline {
  created: Date;
  configured: Date | null;
  started: Date | null;
  ended: Date | null;
  published: Date | null;
}

// Interface unifiée pour les élections
export interface Election {
  id: string;
  title: string;
  type: ElectionType;
  status: ElectionStatus;
  date: Date;
  description?: string;
  location: GeographicLocation;
  configuration: ElectionConfig;
  statistics: ElectionStats;
  timeline: ElectionTimeline;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  cover_image?: string;
  has_second_round?: boolean;
  second_round_date?: string | null;
  enterpriseId?: string | null;
  // Champs spécifiques Élection Professionnelle
  professionalConfig?: ProfessionalElectionConfig;
}

// Interface pour les candidats
export interface Candidate {
  id: string;
  name: string;
  party: string;
  photo?: string;
  isOurCandidate: boolean;
  votes?: number;
  percentage?: number;
  biography?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Interface pour les centres de vote
export interface VotingCenter {
  id: string;
  name: string;
  address: string;
  contactInfo: {
    responsible: string;
    phone: string;
    email?: string;
  };
  location: {
    latitude?: number;
    longitude?: number;
    province: string;
    commune: string;
    arrondissement: string;
  };
  bureaux: VotingBureau[];
  totalVoters: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Interface pour les bureaux de vote
export interface VotingBureau {
  id: string;
  name: string;
  centerId: string;
  registeredVoters: number;
  president?: string;
  assessors?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les formulaires
export interface CreateElectionData {
  title: string;
  type: ElectionType;
  date: string; // ISO string
  description?: string;
  location: Omit<GeographicLocation, 'fullAddress'>;
  configuration: Omit<ElectionConfig, 'allowMultipleCandidates' | 'requirePhotoValidation'>;
  // Optionnel: utilisé lors de la création pour renseigner nb_electeurs
  statistics?: Pick<ElectionStats, 'totalVoters'>;
  // Liens optionnels à créer lors de la création
  candidates?: Array<{ id: string; isOurCandidate?: boolean }>;
  centers?: Array<{ id: string }>;
  cover_image?: string;
}

export interface UpdateElectionData extends Partial<CreateElectionData> {
  status?: ElectionStatus;
}

// Types pour les filtres et recherche
export interface ElectionFilters {
  status?: ElectionStatus[];
  type?: ElectionType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  location?: {
    province?: string;
    commune?: string;
  };
  search?: string;
}

// Types pour les actions utilisateur
export interface ElectionAction {
  type: 'SET_ELECTIONS' | 'ADD_ELECTION' | 'UPDATE_ELECTION' | 'DELETE_ELECTION' | 'SET_LOADING' | 'SET_ERROR' | 'SET_SELECTED_ELECTION';
  payload?: any;
}

// État de l'application
export interface ElectionState {
  elections: Election[];
  selectedElection: Election | null;
  loading: boolean;
  error: string | null;
  filters: ElectionFilters;
  searchQuery: string;
}

// Types pour les permissions
export interface UserPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canView: boolean;
  canExport: boolean;
  canManageCandidates: boolean;
  canManageCenters: boolean;
}

// Types pour les notifications
export interface NotificationData {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Types pour l'export
export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeCharts: boolean;
  includeDetails: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Types pour l'audit
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
