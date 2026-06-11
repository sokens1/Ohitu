/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Users, TrendingUp, Calendar, MapPin, Menu, X, Facebook, Link as LinkIcon, Trophy, Medal, Crown, Share2, Heart, Star, Vote, BarChart3, Building, Target, AlertCircle, CheckCircle, Clock, Eye, Filter, Globe, Home, Info, Layers, PieChart, Search, Settings, Shield, TrendingDown, User, Users2, Zap, RotateCcw, ArrowRightLeft, LayoutGrid, Table as TableIcon, ChevronDown, Download, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { fetchElectionById, fetchElectionBySlug, fetchPublicElections } from '../api/elections';
import { fetchElectionSummary, fetchCenterSummary, fetchBureauSummary, fetchCenterSummaryByCandidate, fetchBureauSummaryByCandidate } from '../api/results';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';
// import CrossAnalysisSection from '@/components/results/CrossAnalysisSection'; // Vue publique : section masquée pour l'instant
import NetworkIndicator from '@/components/NetworkIndicator';
import {
  getElectionElectorsTotal,
  getRegisteredVotersLabel,
  isProfessionalElection,
} from '@/utils/electionCalculations';
import { isElectionPublishedForPublic } from '@/utils/electionVisibility';
import SimulationResultsSection from '@/components/results/SimulationResultsSection';
import FloatingChatbot from '@/components/FloatingChatbot';

type CollegeDetailRow = {
  collegeName: string;
  syndicatName: string;
  votes: number;
  seats: number;
  tiebreakType: 'anciennete' | 'age' | null;
};

const getNormalizedCollegeLabel = (val: string | null | undefined): string => {
  if (!val) return 'Général';
  const v = val.toLowerCase().trim();
  if (v === 'general' || v === 'encadrement') return 'Encadrement';
  if (v === 'cadres' || v === 'cadre') return 'Cadre';
  if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'Maîtrise';
  if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'Exécution';
  return val.charAt(0).toUpperCase() + val.slice(1);
};



// Icone WhatsApp (SVG minimal)
const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M27.5 16c0 6.352-5.148 11.5-11.5 11.5-2.012 0-3.904-.516-5.548-1.42L4.5 27.5l1.47-5.8A11.42 11.42 0 0 1 4.5 16C4.5 9.648 9.648 4.5 16 4.5S27.5 9.648 27.5 16Z" fill="#25D366" />
    <path d="M13.9 10.7c-.2-.45-.41-.46-.6-.47-.16-.01-.34-.01-.52-.01s-.48.07-.73.35c-.25.28-.96.94-.96 2.3 0 1.36.98 2.67 1.12 2.86.14.19 1.9 3.04 4.73 4.14 2.34.92 2.82.74 3.33.69.51-.05 1.64-.67 1.87-1.32.23-.65.23-1.21.16-1.32-.07-.11-.25-.18-.52-.32-.27-.14-1.64-.81-1.9-.91-.25-.09-.44-.14-.63.14-.19.28-.73.91-.9 1.09-.16.19-.33.21-.61.07-.27-.14-1.14-.42-2.18-1.34-.8-.71-1.34-1.58-1.5-1.86-.16-.28-.02-.43.12-.57.12-.12.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.53-.86-2.08Z" fill="#fff" />
  </svg>
);

interface ElectionData {
  id: string;
  title: string;
  election_date: string;
  status: string;
  type?: string;
  description?: string;
  localisation?: string;
  is_published?: boolean;
  is_public_visible?: boolean;
  nb_electeurs?: number;
  cover_image_url?: string;
  slug?: string;
  show_quorum_failed_public?: boolean;
}

interface CandidateResult {
  candidate_id: string;
  candidate_name: string;
  party_name: string;
  total_votes: number;
  percentage: number;
  rank: number;
  seats?: number;
  tiebreak?: boolean;
  colleges?: string[];
  logo?: string;
}

interface ElectionResults {
  election: ElectionData | null;
  total_voters: number;
  total_voters_election?: number; // Nombre total d'inscrits de l'élection
  total_registered_published?: number; // Inscrits dans les bureaux publiés uniquement
  total_votes_cast: number;
  participation_rate: number;
  candidates: CandidateResult[];
  last_updated: string;
}

// Composant MetricCard moderne
const MetricCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  animated?: boolean;
  showDecimals?: boolean;
}> = ({ title, value, icon, color, subtitle, animated = true, showDecimals = false }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animated) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const duration = 2000;
            const start = Date.now();
            const animate = () => {
              const elapsed = Date.now() - start;
              const progress = Math.min(elapsed / duration, 1);
              const currentValue = progress * value;
              setDisplayValue(showDecimals ? currentValue : Math.floor(currentValue));
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            animate();
          }
        },
        { threshold: 0.1 }
      );

      if (countRef.current) {
        observer.observe(countRef.current);
      }

      return () => observer.disconnect();
    } else {
      setDisplayValue(value);
    }
  }, [value, animated, showDecimals]);

  const formatValue = (val: number) => {
    if (showDecimals) {
      return val.toFixed(2);
    }
    return val.toLocaleString();
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 border-0 bg-gradient-to-br from-white to-gray-50">
      <CardContent className="p-4 sm:p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center text-white ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <div className="scale-75 sm:scale-100">{icon}</div>
          </div>
          <div ref={countRef} className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
            {formatValue(displayValue)}
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-500">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant CandidateCard moderne
const CandidateCard: React.FC<{
  candidate: CandidateResult;
  rank: number;
  isWinner: boolean;
  onClick: () => void;
  totalVotes: number;
}> = ({ candidate, rank, isWinner, onClick, totalVotes }) => {
  const getRankIcon = () => {
    if (rank === 1) return <Crown className="w-5 h-5" />;
    if (rank === 2) return <Trophy className="w-5 h-5" />;
    if (rank === 3) return <Medal className="w-5 h-5" />;
    if (rank > 3) return <span className="font-bold text-sm">{rank}</span>;
    // Si pas de rang (rank === 0), afficher juste un cercle neutre
    return <span className="font-bold text-sm">•</span>;
  };

  const getRankColor = () => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-300';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 border-gray-200';
    if (rank === 3) return 'bg-gradient-to-br from-amber-500 to-amber-700 border-amber-300';
    if (rank > 3) return 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300';
    // Si pas de rang, couleur neutre
    return 'bg-gradient-to-br from-gray-400 to-gray-600 border-gray-300';
  };

  const percentage = candidate.percentage ?? (totalVotes > 0 ? (candidate.total_votes / totalVotes) * 100 : 0);

  return (
    <Card
      className={`group cursor-pointer transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 sm:hover:-translate-y-2 lg:hover:-translate-y-3 border-2 ${isWinner ? 'border-yellow-400 shadow-yellow-100' : 'border-gray-200 hover:border-blue-300'
        } bg-white overflow-hidden`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6 relative">
        {/* Fond dégradé pour le gagnant */}
        {isWinner && (
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-transparent to-blue-50 opacity-50" />
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            {/* Logo syndicat si disponible, sinon badge de rang */}
            {candidate.logo ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 shadow-md bg-white flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <img src={candidate.logo} alt={candidate.candidate_name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white ${getRankColor()} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <div className="scale-75 sm:scale-100">{getRankIcon()}</div>
              </div>
            )}
            {isWinner && (
              <div className="flex items-center text-yellow-600">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                <span className="text-xs sm:text-sm font-semibold">Gagnant</span>
              </div>
            )}
          </div>

          <div className="mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors leading-tight">
              {candidate.candidate_name}
            </h3>
            {candidate.colleges && candidate.colleges.length > 0 ? (
               <div className="flex flex-wrap gap-1 mt-2">
                 {candidate.colleges.map(c => <span key={c} className="px-2 py-1 bg-blue-100 text-blue-800 font-medium text-xs rounded-full border border-blue-200">{c}</span>)}
               </div>
            ) : (
               <p className="text-gray-600 text-xs sm:text-sm font-medium">
                 {candidate.party_name || 'Candidat indépendant'}
               </p>
            )}
          </div>

          {/* Barre de progression moderne */}
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1 mb-2">
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 whitespace-nowrap inline-flex items-center gap-1.5">
                {candidate.seats !== undefined ? `${candidate.seats} siège${candidate.seats !== 1 ? 's' : ''}` : candidate.total_votes.toLocaleString()}
                {candidate.tiebreak && (
                  <Scale className="w-4 h-4 text-amber-500" title="Siège attribué par départage (ancienneté/âge)" />
                )}
              </span>
              <span className="text-sm sm:text-base font-semibold text-blue-600 whitespace-nowrap">
                {candidate.seats !== undefined ? `(${candidate.total_votes.toLocaleString()} voix · ${percentage.toFixed(2)}%)` : `${percentage.toFixed(2)}%`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-out ${rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                  rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                    rank === 3 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="text-center">
            <span className="text-xs sm:text-sm text-gray-500">
              {candidate.seats !== undefined ? "voix exprimées (répartition calculée)" : "voix exprimées"}
            </span>
          </div>

          {/* Indication d'interaction */}
          <div className="mt-3 flex justify-end">
            <span className="flex items-center gap-1 text-blue-600 text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Voir le détail du candidat">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              Voir le détail
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface ElectionResultsProps {
  isAdminPreview?: boolean;
  electionIdOverride?: string;
}

const ElectionResults: React.FC<ElectionResultsProps> = ({ isAdminPreview = false, electionIdOverride }) => {
  const { slug } = useParams<{ slug: string }>();
  // electionId est résolu à partir du slug, ou directement depuis electionIdOverride (mode admin preview)
  const [electionId, setElectionId] = useState<string | undefined>(electionIdOverride);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGlobalAdmin, assignedElectionIds } = useRBAC();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'center' | 'bureau' | 'college'>('center');
  const [centerRows, setCenterRows] = useState<any[]>([]);
  const [bureauRows, setBureauRows] = useState<any[]>([]);
  const [collegeDetailRows, setCollegeDetailRows] = useState<CollegeDetailRow[]>([]);
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);
  const [candidateCenters, setCandidateCenters] = useState<any[]>([]);
  const [candidateBureaux, setCandidateBureaux] = useState<any[]>([]);
  const [candidateViewMode, setCandidateViewMode] = useState<'grid' | 'table'>('grid');
  const [centerNameById, setCenterNameById] = useState<Record<string, string>>({});
  const [candidateCenterNameById, setCandidateCenterNameById] = useState<Record<string, string>>({});
  const [resultsMenuOpen, setResultsMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'center' | 'participation' | 'score' | 'votes'>('center');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string>('');
  const [titulairesMap, setTitulairesMap] = useState<Map<string, string[]>>(new Map());
  const [orderNumMap, setOrderNumMap] = useState<Map<string, number>>(new Map());
  const [modalEtabId, setModalEtabId] = useState<string>('');

  // États de tri pour les modales des candidats
  const [candidateModalSortBy, setCandidateModalSortBy] = useState<'center' | 'participation' | 'score' | 'votes'>('center');
  const [candidateModalSortOrder, setCandidateModalSortOrder] = useState<'asc' | 'desc'>('asc');

  // États pour le switch entre élections
  const [availableElections, setAvailableElections] = useState<any[]>([]);
  const [electionsLoading, setElectionsLoading] = useState(false);

  // États pour le taux de couverture des bureaux
  const [totalBureaux, setTotalBureaux] = useState<number>(0);
  const [bureauxAvecResultats, setBureauxAvecResultats] = useState<number>(0);
  const [mobileRetryCount, setMobileRetryCount] = useState<number>(0);
  const [isDataEstimated, setIsDataEstimated] = useState<boolean>(false);
  // Couverture des sièges (élections professionnelles)
  const [totalSeats, setTotalSeats] = useState<number>(0);
  const [publishedSeats, setPublishedSeats] = useState<number>(0);
  // Avancement du dépouillement : groupes (centre × collège) dépouillés
  const [publishedGroupCount, setPublishedGroupCount] = useState<number>(0);
  const [totalGroupCount, setTotalGroupCount] = useState<number>(0);
  // Sièges par groupe (centerId_collegeType → seats_to_fill)
  const [bureauSeatsMap, setBureauSeatsMap] = useState<Map<string, number>>(new Map());
  // État pour stocker les IDs des bureaux avec PV publiés
  const [publishedBureauIds, setPublishedBureauIds] = useState<Set<string>>(new Set());

  // Fonctions pour vérifier la présence de données
  const hasCenterData = () => {
    return centerRows && centerRows.length > 0;
  };

  const hasBureauData = () => {
    return bureauRows && bureauRows.length > 0;
  };

  const hasCollegeData = () => collegeDetailRows.length > 0;

  const hasAnyDetailedData = () => {
    return hasCenterData() || hasBureauData() || hasCollegeData();
  };

  // Fonction pour calculer le taux de couverture des bureaux
  const calculateBureauCoverage = async () => {
    const isMobile = window.innerWidth < 640;
    console.log('🔍 Mobile calculateBureauCoverage - isMobile:', isMobile, 'electionId:', electionId);

    if (!electionId) {
      console.log('🔍 Mobile calculateBureauCoverage - Pas d\'electionId');
      return;
    }

    try {
      console.log('🔍 Mobile calculateBureauCoverage - electionId:', electionId);

      // Récupérer le nombre total de bureaux pour cette élection depuis la base de données
      console.log('🔍 Requête Supabase pour voting_bureaux avec election_id...');
      console.log('🔍 electionId type:', typeof electionId, 'value:', electionId);

      // Récupérer le nombre total de bureaux depuis la base de données
      let totalBureauxCount = 0;
      let isEstimated = false;

      // Méthode 1: Essayer de récupérer depuis la table elections
      try {
        console.log('🔍 Méthode 1: Récupération depuis elections...');
        const { data: electionData, error: electionError } = await supabase
          .from('elections')
          .select('*')
          .eq('id', electionId)
          .single();

        console.log('🔍 Données élection:', electionData, 'erreur:', electionError);

        if (!electionError && electionData) {
          // Essayer différents champs possibles pour le nombre de bureaux
          const nbBureaux = electionData.nb_bureaux || electionData.total_bureaux || electionData.num_bureaux || electionData.bureaux_count;
          if (nbBureaux) {
            totalBureauxCount = nbBureaux;
            isEstimated = false;
            console.log('🔍 ✅ Nombre total récupéré depuis elections:', totalBureauxCount, 'champ utilisé:', Object.keys(electionData).find(key => electionData[key] === nbBureaux));
          } else {
            console.log('🔍 ❌ Aucun champ nb_bureaux trouvé dans elections. Champs disponibles:', Object.keys(electionData));
            // Au lieu d'estimer, utiliser la méthode directe
            console.log('🔍 Passage directement à la méthode 2 (base de données réelle)');
          }
        } else {
          console.log('🔍 ❌ Erreur lors de la récupération de l\'élection:', electionError);
        }
      } catch (error) {
        console.log('🔍 Erreur méthode 1:', error);
      }

      // Méthode 2: Récupération directe depuis la base via election_centers (MÉTHODE PRINCIPALE)
      if (totalBureauxCount === 0) {
        try {
          console.log('🔍 Méthode 2: Récupération via election_centers + voting_bureaux...');

          const { data: electionCenters, error: ecError } = await supabase
            .from('election_centers')
            .select('center_id')
            .eq('election_id', electionId);

          if (!ecError && electionCenters && electionCenters.length > 0) {
            const centerIds = electionCenters.map((ec: any) => ec.center_id).filter(Boolean);
            console.log('🔍 centerIds trouvés:', centerIds);

            // Récupérer les bureaux de ces centres
            const { data: bureauxData, error: bureauxError } = await supabase
              .from('voting_bureaux')
              .select('id, center_id')
              .in('center_id', centerIds);

            if (!bureauxError && bureauxData) {
              totalBureauxCount = bureauxData.length;
              isEstimated = false;
              console.log('🔍 ✅ Nombre total récupéré via election_centers:', totalBureauxCount, 'bureaux');
            } else {
              console.log('🔍 ❌ Erreur méthode 2:', bureauxError);
            }
          } else {
            console.log('🔍 ❌ Aucun centre trouvé pour cette élection:', ecError);
          }
        } catch (error) {
          console.log('🔍 Erreur méthode 2:', error);
        }
      }

      // Méthode 3: Dernière tentative avec requête directe (si les autres méthodes échouent)
      if (totalBureauxCount === 0) {
        try {
          console.log('🔍 Méthode 3: Récupération directe depuis voting_bureaux...');
          const response = await supabase
            .from('voting_bureaux')
            .select('id, election_id, center_id')
            .eq('election_id', electionId);

          if (!response.error && response.data) {
            totalBureauxCount = response.data.length;
            isEstimated = false;
            console.log('🔍 ✅ Nombre total récupéré depuis voting_bureaux:', totalBureauxCount);
          } else {
            console.log('🔍 ❌ Erreur méthode 3:', response.error);
          }
        } catch (error) {
          console.log('🔍 Erreur méthode 3:', error);
        }
      }

      // Méthode 4: Estimation seulement si vraiment nécessaire (supprimer l'estimation automatique)
      if (totalBureauxCount === 0) {
        console.log('🔍 Aucune donnée trouvée dans la base. Utilisation d\'une estimation par défaut.');
        // Ne plus utiliser d'estimation automatique - laisser à 0
        totalBureauxCount = 0;
        isEstimated = false;
      }

      // Vérifier le résultat final
      if (totalBureauxCount === 0) {
        console.log('🔍 ❌ Aucune donnée de bureau trouvée dans la base pour cette élection');
        isEstimated = false;
      } else {
        console.log('🔍 ✅ Données réelles récupérées de la base:', totalBureauxCount, 'bureaux');
      }

      // Compter les bureaux avec des résultats depuis bureauRows
      const avecResultats = bureauRows.filter(bureau =>
        bureau.total_voters > 0 || bureau.total_registered > 0 || bureau.total_expressed_votes > 0
      ).length;

      console.log('🔍 avecResultats:', avecResultats);
      console.log('🔍 bureauRows.length:', bureauRows.length);
      console.log('🔍 Élection ID:', electionId);
      console.log('🔍 Bureaux avec données:', bureauRows.filter(b => b.total_voters > 0).map(b => ({ id: b.id, name: b.name, voters: b.total_voters })));

      setTotalBureaux(totalBureauxCount);
      setBureauxAvecResultats(avecResultats);
      setIsDataEstimated(isEstimated);

      console.log('🔍 État final - electionId:', electionId, 'totalBureaux:', totalBureauxCount, 'bureauxAvecResultats:', avecResultats);
      console.log('🔍 setTotalBureaux appelé avec:', totalBureauxCount, 'pour electionId:', electionId);
      console.log('🔍 setBureauxAvecResultats appelé avec:', avecResultats, 'pour electionId:', electionId);

      // Vérification que les données ont bien été mises à jour
      if (totalBureauxCount > 0) {
        console.log('🔍 ✅ Données de couverture mises à jour avec succès');
      } else {
        console.log('🔍 ❌ Aucune donnée de bureau trouvée pour cette élection');
      }

      // Vérification mobile : forcer la mise à jour si on est sur mobile
      const isMobile = window.innerWidth < 640;
      if (isMobile && totalBureauxCount > 0) {
        console.log('🔍 Mobile Force update - totalBureauxCount:', totalBureauxCount);
        // Forcer un re-render immédiat sur mobile
        setTotalBureaux(totalBureauxCount);
        setBureauxAvecResultats(avecResultats);

        // Forcer un re-render supplémentaire après un court délai sur mobile
        setTimeout(() => {
          console.log('🔍 Mobile Force re-render après 50ms');
          setTotalBureaux(totalBureauxCount);
          setBureauxAvecResultats(avecResultats);
        }, 50);
      }
    } catch (error) {
      console.error('Erreur calcul couverture bureaux:', error);
      console.log('🔍 Erreur - reset des valeurs à 0');
      setTotalBureaux(0);
      setBureauxAvecResultats(0);
    }
  };

  // Fonctions pour vérifier les données des candidats dans la modale
  const hasCandidateCenterData = () => {
    return candidateCenters && candidateCenters.length > 0;
  };

  const hasCandidateBureauData = () => {
    return candidateBureaux && candidateBureaux.length > 0;
  };

  const hasAnyCandidateData = () => {
    return hasCandidateCenterData() || hasCandidateBureauData();
  };

  // Build center name map for global views (must be declared before any early returns)
  React.useEffect(() => {
    const m: Record<string, string> = {};
    centerRows.forEach((c: any) => { if (c.center_id && c.center_name) m[c.center_id] = c.center_name; });
    setCenterNameById(m);
  }, [centerRows]);

  // Résolution slug → UUID de l'élection (ignoré en mode admin preview avec electionIdOverride)
  useEffect(() => {
    if (electionIdOverride) { setElectionId(electionIdOverride); return; }
    if (!slug) return;
    fetchElectionBySlug(slug).then(election => {
      if (election?.id) {
        setElectionId(election.id);
      } else {
        setError('Élection introuvable');
        setLoading(false);
      }
    }).catch(() => {
      setError('Élection introuvable');
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (electionId) {
      fetchElectionResults(electionId);
    }
  }, [electionId]);

  // Charger les élections disponibles pour le switch
  useEffect(() => {
    const fetchAvailableElections = async () => {
      try {
        setElectionsLoading(true);
        const elections = await fetchPublicElections();
        const all = elections || [];

        // Utilisateur connecté, rôle restreint (non global-admin) avec élections assignées
        // → ne montrer que ses élections assignées
        if (user && !isGlobalAdmin && assignedElectionIds.length > 0) {
          const assignedSet = new Set(assignedElectionIds.map(String));
          setAvailableElections(all.filter((e: any) => assignedSet.has(String(e.id))));
        } else {
          setAvailableElections(all);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des élections:', error);
      } finally {
        setElectionsLoading(false);
      }
    };

    fetchAvailableElections();
  // Dépendances primitives stables — évite la boucle infinie due au tableau assignedElectionIds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isGlobalAdmin, assignedElectionIds.join(',')]);

  // Reset couverture quand l'élection change (totalBureaux est désormais défini dans fetchElectionResults)
  useEffect(() => {
    if (!electionId) {
      setTotalBureaux(0);
      setBureauxAvecResultats(0);
    }
  }, [electionId]);

  const fetchElectionResults = async (id: string) => {
    try {
      setLoading(true);

      // ROUND 1 : données de l'élection (nécessaire pour connaître le type)
      const election = await fetchElectionById(id);
      if (!election) throw new Error('Élection non trouvée');

      const isProElection = isProfessionalElection(election.type);
      const pvStatuses = isAdminPreview
        ? ['published', 'validated', 'validé']
        : ['published'];

      // ROUND 2 : en parallèle — liste PV, centres, collèges électoraux, listes syndicales
      const [
        { data: publishedPVs, error: pvError },
        { data: electionCentersRaw },
        { data: electoralCollegesRaw },
        { data: unionListsRaw },
      ] = await Promise.all([
        supabase.from('procès_verbaux').select('bureau_id, id, status').eq('election_id', id).in('status', pvStatuses),
        supabase.from('election_centers').select('center_id').eq('election_id', id),
        isProElection
          ? supabase.from('electoral_colleges').select('name, college_type, seats_to_fill, total_voters').eq('election_id', id)
          : Promise.resolve({ data: [] as any[], error: null }),
        isProElection
          ? supabase.from('union_lists').select('id, college, order_num, titulaires, suppleants, unions(id, name, acronym, logo)').eq('election_id', id).order('order_num', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (pvError) console.error('❌ Erreur PV:', pvError);

      // Données pro disponibles dès le round 2
      const electoralCollegesForPro: any[] = electoralCollegesRaw || [];
      let unionLists: any[] = unionListsRaw || [];
      const collegesElectorsTotal = electoralCollegesForPro.reduce((s: number, c: any) => s + (Number(c.total_voters) || 0), 0);

      const publishedBureauIdsSet = new Set<string>((publishedPVs || []).map(pv => String(pv.bureau_id)));
      setPublishedBureauIds(publishedBureauIdsSet);

      const allCenterIds = (electionCentersRaw || []).map((ec: any) => ec.center_id).filter(Boolean);
      const publishedPVIds = (publishedPVs || []).map(pv => pv.id);

      // Vérifier visibilité publique
      if (!isAdminPreview && !isElectionPublishedForPublic(election)) {
        const totalElectorsElection = collegesElectorsTotal > 0 ? collegesElectorsTotal : (Number(election.nb_electeurs) || 0);
        setResults({
          election,
          total_voters: 0,
          total_voters_election: totalElectorsElection,
          total_registered_published: 0,
          total_votes_cast: 0,
          participation_rate: 0,
          candidates: [],
          last_updated: new Date().toISOString()
        });
        setCenterRows([]);
        setBureauRows([]);
        setLoading(false);
        return;
      }

      // ROUND 3 : en parallèle — tous les bureaux + données complètes des PV publiés
      const [
        { data: allBureauxData },
        { data: pvsData, error: pvsDataError },
      ] = await Promise.all([
        allCenterIds.length > 0
          ? supabase.from('voting_bureaux').select('id, name, center_id, college, seats_to_fill, registered_voters').in('center_id', allCenterIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        publishedPVIds.length > 0
          ? supabase.from('procès_verbaux').select(`id, bureau_id, college_type, total_registered, total_voters, votes_expressed, null_votes, voting_bureaux!inner(id, name, center_id, registered_voters, college_type)`).in('id', publishedPVIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (pvsDataError) console.error('❌ Erreur chargement PV:', pvsDataError);

      const allBureauxList: any[] = allBureauxData || [];
      const allBureauxRegistered = allBureauxList.reduce((sum: number, b: any) => sum + (Number(b.registered_voters) || 0), 0);

      // Définir totalBureaux directement — évite les requêtes redondantes de calculateBureauCoverage
      setTotalBureaux(allBureauxList.length);

      const totalElectorsElection = collegesElectorsTotal > 0
        ? collegesElectorsTotal
        : (allBureauxRegistered > 0 ? allBureauxRegistered : (Number(election.nb_electeurs) || 0));

      // Aucun PV publié → résultats vides
      if (publishedBureauIdsSet.size === 0) {
        setResults({
          election,
          total_voters: 0,
          total_voters_election: totalElectorsElection,
          total_registered_published: 0,
          total_votes_cast: 0,
          participation_rate: 0,
          candidates: [],
          last_updated: new Date().toISOString()
        });
        setCenterRows([]);
        setBureauRows([]);
        setBureauxAvecResultats(0);
        setLoading(false);
        return;
      }

      // Mapping pv_id → college_type (fallback sur le bureau si PV sans college_type)
      const pvToCollegeType = new Map<string, string>(
        (pvsData || []).map((pv: any) => [
          String(pv.id),
          pv.college_type || (pv.voting_bureaux as any)?.college_type || ''
        ])
      );

      // ROUND 4 : en parallèle — noms des centres + résultats candidats
      const pvCenterIds = [...new Set((pvsData || []).map((pv: any) => pv.voting_bureaux?.center_id).filter(Boolean))];

      const [
        { data: centersNamesData },
        { data: candidateResultsData, error: crError },
      ] = await Promise.all([
        pvCenterIds.length > 0
          ? supabase.from('voting_centers').select('id, name').in('id', pvCenterIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        publishedPVIds.length > 0
          ? supabase.from('candidate_results').select(`pv_id, candidate_id, votes, candidates!inner(id, name, party)`).in('pv_id', publishedPVIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (crError) console.error('❌ Erreur chargement résultats candidats:', crError);

      const centerNamesMap = new Map((centersNamesData || []).map((c: any) => [c.id, c.name]));

      // Paramètre admin : afficher ou non les lignes rouges quorum sur la page publique
      // election may not have show_quorum_failed_public on its typed interface
      const showQuorumFailedPublic = (election as any)?.show_quorum_failed_public !== false;

      // Mapper tous les PV publiés (sans filtre quorum) — utilisé pour les cartes stats
      const allPublishedBureaux = (pvsData || []).map((pv: any) => {
        const reg = Number(pv.total_registered) || Number(pv.voting_bureaux?.registered_voters) || 0;
        const exp = Number(pv.votes_expressed) || 0;
        const isActuallyQuorumFailed = reg > 0 && exp < reg / 2;
        const quorum_failed = showQuorumFailedPublic && isActuallyQuorumFailed;
        return {
          pv_id: pv.id,
          college_type: pv.college_type || (pv.voting_bureaux as any)?.college_type || '',
          bureau_id: pv.bureau_id,
          bureau_name: pv.voting_bureaux?.name || '',
          center_id: pv.voting_bureaux?.center_id || '',
          total_registered: reg,
          total_voters: Number(pv.total_voters) || 0,
          total_expressed_votes: exp,
          total_null_votes: Number(pv.null_votes) || 0,
          participation_pct: reg > 0 ? (Number(pv.total_voters) / reg) * 100 : 0,
          quorum_failed,
          isActuallyQuorumFailed,
        };
      });

      // Vue détaillée : quand show_quorum_failed_public = false, les PV à quorum non atteint
      // sont invisibles dans la vue par collège/bureau (mais leurs données restent dans les cartes)
      const filteredBureaux = showQuorumFailedPublic
        ? allPublishedBureaux
        : allPublishedBureaux.filter((b: any) => !b.isActuallyQuorumFailed);

      // IDs des PV dont le quorum est atteint → seuls ceux-ci alimentent les résultats globaux
      const quorumOkPvIds = new Set<string>(
        filteredBureaux.filter((b: any) => !b.quorum_failed).map((b: any) => b.pv_id)
      );

      // Construire les données des centres (agrégées par center_id)
      // Bureaux avec quorum atteint → utilisés pour tous les calculs officiels
      const filteredBureauxForResults = filteredBureaux.filter((b: any) => !b.quorum_failed);

      // centersMap construit depuis TOUS les bureaux publiés (y compris quorum non atteint)
      // pour que la vue détaillée les affiche (en rouge si quorum non atteint)
      const centersMap = new Map();
      filteredBureaux.forEach((b: any) => {
        if (!centersMap.has(b.center_id)) {
          centersMap.set(b.center_id, {
            center_id: b.center_id,
            center_name: centerNamesMap.get(b.center_id) || '',
            total_registered: 0,
            total_voters: 0,
            total_expressed_votes: 0,
            total_null_votes: 0,
            participation_pct: 0
          });
        }
        const center = centersMap.get(b.center_id);
        center.total_registered += b.total_registered;
        center.total_voters += b.total_voters;
        center.total_expressed_votes += b.total_expressed_votes;
        center.total_null_votes += b.total_null_votes;
      });

      centersMap.forEach((center: any) => {
        center.participation_pct = center.total_registered > 0 ? (center.total_voters / center.total_registered) * 100 : 0;
      });

      const filteredCenters = Array.from(centersMap.values());

      // Totaux d'affichage (cartes stats) = TOUS les PVs publiés y compris quorum non atteint
      // On utilise allPublishedBureaux pour que la désactivation de l'affichage quorum
      // n'affecte que la vue détaillée, pas les chiffres globaux
      const votersSum = allPublishedBureaux.reduce((sum: number, b: any) => sum + (Number(b.total_voters) || 0), 0);
      const registeredInBureauxWithResults = allPublishedBureaux.reduce((sum: number, b: any) => sum + (Number(b.total_registered) || 0), 0);
      // Suffrages exprimés affichage (tous PVs, y compris quorum non atteint)
      const expressedSumAll = allPublishedBureaux.reduce((sum: number, b: any) => sum + (Number(b.total_expressed_votes) || 0), 0);
      // Suffrages exprimés pour les pourcentages candidats = quorum OK uniquement
      const expressedSum = filteredBureauxForResults.reduce((sum: number, b: any) => sum + (Number(b.total_expressed_votes) || 0), 0);

      const totalVotesCast = expressedSumAll; // pour les cartes stats (affichage complet)
      let totalRegistered = registeredInBureauxWithResults;
      const totalRegisteredElection = totalElectorsElection > 0
        ? totalElectorsElection
        : (allBureauxRegistered > 0 ? allBureauxRegistered : (election.nb_electeurs || 0));

      // Pro : le total élection est la référence canonique ; on prend le max pour couvrir
      // les PVs dont total_registered est null ou sous-renseigné
      if (isProElection && totalRegisteredElection > totalRegistered) {
        totalRegistered = totalRegisteredElection;
      }

      const participationRate = registeredInBureauxWithResults > 0
        ? Math.min(Math.max((votersSum / registeredInBureauxWithResults) * 100, 0), 100)
        : 0;

      // Agréger les votes par candidat ou syndicat
      const isProfessional = isProElection;
      const candidateVotesMap = new Map<string, { candidate_id: string; candidate_name: string; party: string; total_votes: number; colleges: Set<string>; seats: number; remainder: number; tiebreak: boolean }>();
      
      (candidateResultsData || []).forEach((cr: any) => {
        if (!quorumOkPvIds.has(cr.pv_id)) return; // PV sans quorum → exclu des totaux
        let groupKey = cr.candidate_id;
        let candidateName = cr.candidates?.name || '';
        let partyName = cr.candidates?.party || '';
        let collegeName = 'Général';

        if (isProfessional) {
           const parts = (cr.candidates?.party || '').split(' — ');
           groupKey = parts[0] || cr.candidate_id; // Syndicat
           partyName = groupKey;
           candidateName = groupKey;
           if (parts.length > 1) {
             collegeName = parts[1];
           }
        }

        const existing = candidateVotesMap.get(groupKey) || {
          candidate_id: groupKey,
          candidate_name: candidateName,
          party: partyName,
          total_votes: 0,
          colleges: new Set<string>(),
          seats: 0,
          remainder: 0,
          tiebreak: false,
        };
        existing.total_votes += Number(cr.votes) || 0;
        if (isProfessional) {
          existing.colleges.add(collegeName);
        }
        candidateVotesMap.set(groupKey, existing);
      });

      const filteredSummaryData = Array.from(candidateVotesMap.values());

      // Calculer les sièges — par collège (total élection) avec quotient + plus forte moyenne
      // unionLists et electoralCollegesForPro sont déjà chargés au round 2
      let collegeSyndicatSeats = new Map<string, number>();
      // Sièges attribués par départage ancienneté/âge (pour étiquette UI) — clé "collegeLabel_syndicat"
      let collegeSyndicatTiebreak = new Map<string, 'anciennete' | 'age'>();

      if (isProfessional) {

        // seats_to_fill = total de l'élection pour ce collège
        // Les clés sont NORMALISÉES pour correspondre aux college_type des PV
        // (electoral_colleges peut avoir "Encadrement"→"general", "execution"→"ouvriers", etc.)
        const normalizeCollegeKey = (val: string | null | undefined): string | null => {
          if (!val) return null;
          const v = val.toLowerCase().trim();
          if (v === 'general' || v === 'encadrement') return 'general';
          if (v === 'cadres' || v === 'cadre') return 'cadres';
          if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
          if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
          return v;
        };

        // 1) Construire la map bureauSeats: "centerId_collegeType" -> seats_to_fill
        const bureauSeats = new Map<string, number>();
        allBureauxList.forEach((b: any) => {
          const colKey = normalizeCollegeKey(b.college || b.college_type);
          if (b.seats_to_fill && colKey && b.center_id) {
            const key = `${String(b.center_id)}_${colKey}`;
            bureauSeats.set(key, Number(b.seats_to_fill) || 0);
          }
        });
        setBureauSeatsMap(new Map(bureauSeats));

        // 2) Construire une Map des attributs des candidats : "syndicat_college" -> { age, seniority, age2?, seniority2? }
        // unionLists est trié par order_num ASC → order_num=1 traité avant order_num=2.
        // Pour un collège 2 sièges, un syndicat peut avoir deux listes (order_num=1 et order_num=2).
        // seniority/age  = 1er titulaire (liste order_num=1)
        // seniority2/age2 = 2ème titulaire (liste order_num=2) — cas particulier départage 2 sièges
        const candidateInfoMap = new Map<string, { age: number; seniority: number; age2?: number; seniority2?: number }>();
        unionLists.forEach((ul: any) => {
          const acronym = ul.unions?.acronym?.trim();
          const name = ul.unions?.name?.trim();
          const collegeKey = normalizeCollegeKey(ul.college);
          if (!collegeKey) return;

          const tArr = Array.isArray(ul.titulaires)
            ? ul.titulaires
            : (typeof ul.titulaires === 'string' ? (JSON.parse(ul.titulaires || '[]') as any[]) : []);
          const t = tArr[0] ?? null;
          if (!t) return;

          const orderNum = Number(ul.order_num) || 1;
          const thisAge = Number(t.age) || 0;
          const thisSeniority = Number(t.anciennete) || 0;

          [acronym, name].filter(Boolean).forEach(k => {
            const mapKey = `${k!}_${collegeKey}`;
            const existing = candidateInfoMap.get(mapKey);
            if (!existing) {
              candidateInfoMap.set(mapKey, { age: thisAge, seniority: thisSeniority });
            } else if (orderNum >= 2) {
              // Données du 2ème titulaire — ne pas écraser le 1er
              candidateInfoMap.set(mapKey, { ...existing, age2: thisAge, seniority2: thisSeniority });
            }
          });
        });

        // 3) Algorithme de répartition légal CSE
        const allocateSeatsForCollege = (
          syndicats: { partyKey: string; votes: number; age: number; anciennete: number; anciennete2?: number; age2?: number }[],
          seatsToFill: number
        ) => {
          const empty: Record<string, number> = {};
          syndicats.forEach(s => { empty[s.partyKey] = 0; });
          if (!syndicats.length || seatsToFill === 0) return { seats: empty };
          const suffrages = syndicats.reduce((sum, s) => sum + s.votes, 0);
          if (suffrages === 0) return { seats: empty };

          // Départage ancienneté → âge (1er titulaire — Cas 1 et Cas 2 sans siège attribué)
          // Renvoie le gagnant ET le critère qui a tranché, pour l'étiquette UI
          const ancAgeTie = (tied: typeof syndicats): { winner: typeof syndicats[0]; type: 'anciennete' | 'age' } | null => {
            const maxAnc = Math.max(...tied.map(t => t.anciennete));
            const byAnc = tied.filter(t => t.anciennete === maxAnc);
            if (byAnc.length === 1) return { winner: byAnc[0], type: 'anciennete' };
            const maxAge = Math.max(...byAnc.map(t => t.age));
            const byAge = byAnc.filter(t => t.age === maxAge);
            return byAge.length === 1 ? { winner: byAge[0], type: 'age' } : null;
          };

          // Cas particulier (PDF p.3) : si un syndicat a déjà 1 siège, utiliser le 2ème titulaire
          const ancAgeTieDynamic = (tied: typeof syndicats, allocState: Record<string, number>): { winner: typeof syndicats[0]; type: 'anciennete' | 'age' } | null => {
            const getAnc = (t: typeof syndicats[0]) =>
              (t.anciennete2 !== undefined && (allocState[t.partyKey] || 0) >= 1) ? t.anciennete2 : t.anciennete;
            const getAge = (t: typeof syndicats[0]) =>
              (t.age2 !== undefined && (allocState[t.partyKey] || 0) >= 1) ? t.age2 : t.age;
            const maxAnc = Math.max(...tied.map(getAnc));
            const byAnc = tied.filter(t => getAnc(t) === maxAnc);
            if (byAnc.length === 1) return { winner: byAnc[0], type: 'anciennete' };
            const maxAge = Math.max(...byAnc.map(getAge));
            const byAge = byAnc.filter(t => getAge(t) === maxAge);
            return byAge.length === 1 ? { winner: byAge[0], type: 'age' } : null;
          };

          // Cas 1 : 1 siège
          if (seatsToFill === 1) {
            const maxV = Math.max(...syndicats.map(s => s.votes));
            const tied = syndicats.filter(s => s.votes === maxV);
            if (tied.length === 1) return { seats: { ...empty, [tied[0].partyKey]: 1 } };
            const result = ancAgeTie(tied);
            if (!result) return { seats: empty, manualTie: tied.map(s => s.partyKey) };
            return { seats: { ...empty, [result.winner.partyKey]: 1 }, tiebreakKeys: [{ partyKey: result.winner.partyKey, type: result.type }] };
          }

          // Cas 2 : 2 sièges
          if (seatsToFill === 2) {
            const quotient = suffrages / 2;
            const allocated: Record<string, number> = { ...empty };
            syndicats.forEach(s => { allocated[s.partyKey] = Math.floor(s.votes / quotient); });
            let remaining = 2 - Object.values(allocated).reduce((a, b) => a + b, 0);
            if (remaining === 0) return { seats: allocated };

            const tiebreakKeys: { partyKey: string; type: 'anciennete' | 'age' }[] = [];
            while (remaining > 0) {
              const withMoy = syndicats.map(s => ({ ...s, moy: s.votes / (allocated[s.partyKey] + 1) }));
              const maxMoy = Math.max(...withMoy.map(m => m.moy));
              const tied = withMoy.filter(m => m.moy === maxMoy);
              if (tied.length === 1) { allocated[tied[0].partyKey]++; remaining--; continue; }

              // Égalité de moyenne → voix totales → ancienneté/âge (avec 2ème titulaire si déjà 1 siège) → manuel
              const maxV = Math.max(...tied.map(t => t.votes));
              const byVotes = tied.filter(t => t.votes === maxV);
              if (byVotes.length === 1) { allocated[byVotes[0].partyKey]++; remaining--; continue; }
              const result = ancAgeTieDynamic(byVotes, allocated);
              if (!result) return { seats: allocated, manualTie: byVotes.map(s => s.partyKey) };
              allocated[result.winner.partyKey]++;
              tiebreakKeys.push({ partyKey: result.winner.partyKey, type: result.type });
              remaining--;
            }
            return { seats: allocated, tiebreakKeys };
          }

          return { seats: empty };
        };

        // 4) Regrouper les résultats des candidats par PV (quorum OK uniquement)
        const pvCandidateResults = new Map<string, any[]>();
        (candidateResultsData || []).forEach((cr: any) => {
          if (!quorumOkPvIds.has(cr.pv_id)) return; // PV sans quorum → exclu
          if (!pvCandidateResults.has(cr.pv_id)) pvCandidateResults.set(cr.pv_id, []);
          pvCandidateResults.get(cr.pv_id)!.push(cr);
        });

        // Réinitialiser les sièges dans filteredSummaryData
        filteredSummaryData.forEach(c => { c.seats = 0; c.tiebreak = false; });

        // Map pour stocker les sièges cumulés par collège et par syndicat
        collegeSyndicatSeats = new Map<string, number>();
        collegeSyndicatTiebreak = new Map<string, 'anciennete' | 'age'>();

        // 5) Calcul des sièges par groupe (centerId_colKey) — UN SEUL calcul par collège×établissement.
        //    Plusieurs PVs publiés pour le même collège (ex : bureau physique + pseudo-bureau créés
        //    lors d'imports successifs) NE produisent qu'une seule répartition sur les voix agrégées.

        // Phase A : associer chaque PV à son groupe et agréger les voix
        const pvGroupKey    = new Map<string, string>();  // pvId → "centerId_colKey"
        const groupColType  = new Map<string, string>();  // "centerId_colKey" → colType brut
        const groupAggVotes = new Map<string, Map<string, number>>(); // groupe → syndicatKey → voix cumulées
        const groupHasPseudo = new Set<string>(); // groupes qui ont au moins un PV sur pseudo-bureau

        pvCandidateResults.forEach((results, pvId) => {
          const colType = pvToCollegeType.get(String(pvId)) || '';
          if (!colType) return;
          const pvObject = (pvsData || []).find((pv: any) => String(pv.id) === String(pvId));
          const centerId = pvObject?.voting_bureaux?.center_id;
          if (!centerId) return;
          const colKey = normalizeCollegeKey(colType);
          if (!colKey) return;
          const gk = `${centerId}_${colKey}`;
          if (!(bureauSeats.get(gk) || 0)) return; // collège sans sièges définis → ignorer

          pvGroupKey.set(pvId, gk);
          groupColType.set(gk, colType);

          // Détecter les pseudo-bureaux ("College - xxx")
          const bureauName = pvObject?.voting_bureaux?.name || '';
          if (bureauName.startsWith('College -')) groupHasPseudo.add(gk);

          // Agréger les voix au niveau du groupe
          if (!groupAggVotes.has(gk)) groupAggVotes.set(gk, new Map());
          const gv = groupAggVotes.get(gk)!;
          results.forEach((r: any) => {
            const syndicat = ((r.candidates?.party || '').split(' — ')[0] || '').trim() || String(r.candidate_id);
            gv.set(syndicat, (gv.get(syndicat) || 0) + (Number(r.votes) || 0));
          });
        });

        // Phase B : une seule allocation par groupe sur les voix agrégées
        const groupAllocations = new Map<string, Record<string, number>>();
        const groupTiebreakKeys = new Map<string, Map<string, 'anciennete' | 'age'>>(); // gk → partyKey → critère de départage
        groupAggVotes.forEach((aggVotes, gk) => {
          const seatsToFill = bureauSeats.get(gk) || 0;
          const colType = groupColType.get(gk) || '';
          const colKey  = normalizeCollegeKey(colType) || '';
          const syndicats = Array.from(aggVotes.entries()).map(([pk, v]) => {
            const info = candidateInfoMap.get(`${pk}_${colKey}`) || { age: 0, seniority: 0 };
            return { partyKey: pk, votes: v, anciennete: info.seniority, age: info.age, anciennete2: info.seniority2, age2: info.age2 };
          });
          const alloc = allocateSeatsForCollege(syndicats, seatsToFill);
          groupAllocations.set(gk, alloc.seats);
          const tiebreakMap = new Map<string, 'anciennete' | 'age'>();
          (alloc.tiebreakKeys ?? []).forEach(tb => tiebreakMap.set(tb.partyKey, tb.type));
          groupTiebreakKeys.set(gk, tiebreakMap);

          // Répercuter dans filteredSummaryData et collegeSyndicatSeats (une fois par groupe)
          Object.entries(alloc.seats).forEach(([pk, s]) => {
            const entry = filteredSummaryData.find(c => c.candidate_id === pk);
            if (entry) entry.seats = (entry.seats || 0) + s;
            const collegeLabel = getNormalizedCollegeLabel(colType);
            const seatKey = `${collegeLabel}_${pk}`;
            collegeSyndicatSeats.set(seatKey, (collegeSyndicatSeats.get(seatKey) || 0) + s);
            const tbType = tiebreakMap.get(pk);
            if (tbType) {
              if (entry) entry.tiebreak = true;
              collegeSyndicatTiebreak.set(seatKey, tbType);
            }
          });
        });

        // Phase C : attacher les résultats syndicaux à chaque bRow
        // Les sièges du groupe sont affectés uniquement au PV "primaire" du groupe :
        //   • le pseudo-bureau (si existant) → seul à recevoir les sièges
        //   • sinon le premier PV physique rencontré
        const processedGroupKeys = new Set<string>();
        pvCandidateResults.forEach((results, pvId) => {
          const gk = pvGroupKey.get(pvId);
          const groupAlloc = gk ? (groupAllocations.get(gk) || {}) : {};
          const groupTiebreaks = gk ? (groupTiebreakKeys.get(gk) || new Map<string, 'anciennete' | 'age'>()) : new Map<string, 'anciennete' | 'age'>();
          const pvObject = (pvsData || []).find((pv: any) => String(pv.id) === String(pvId));
          const bureauName = pvObject?.voting_bureaux?.name || '';
          const isPseudo = bureauName.startsWith('College -');
          const hasPseudo = gk ? groupHasPseudo.has(gk) : false;

          // "primaire" = pseudo quand il en existe un ; sinon premier PV du groupe
          const isPrimary = hasPseudo
            ? (isPseudo && gk !== undefined && !processedGroupKeys.has(gk))
            : (gk !== undefined && !processedGroupKeys.has(gk));
          if (isPrimary && gk) processedGroupKeys.add(gk);

          // Voix de CE PV pour l'affichage (chaque bureau garde ses propres voix)
          const partyVotes = new Map<string, number>();
          results.forEach((r: any) => {
            const syndicat = ((r.candidates?.party || '').split(' — ')[0] || '').trim() || String(r.candidate_id);
            partyVotes.set(syndicat, (partyVotes.get(syndicat) || 0) + (Number(r.votes) || 0));
          });

          const bureauSyndicats = Array.from(partyVotes.entries())
            .map(([syndicatName, votes]) => ({
              syndicatName,
              votes,
              seats: isPrimary ? (groupAlloc[syndicatName] || 0) : 0,
              tiebreakType: isPrimary ? (groupTiebreaks.get(syndicatName) ?? null) : null
            }))
            .sort((a, b) => b.votes - a.votes);

          const bRow = filteredBureaux.find(b => String((b as any).pv_id) === String(pvId));
          if (bRow) (bRow as any).syndicats = bureauSyndicats;
        });

        // Attacher les données syndicales aux bureaux quorum-failed (affichage, sièges = 0)
        const pvCandidateResultsAll = new Map<string, any[]>();
        (candidateResultsData || []).forEach((cr: any) => {
          if (!pvCandidateResultsAll.has(cr.pv_id)) pvCandidateResultsAll.set(cr.pv_id, []);
          pvCandidateResultsAll.get(cr.pv_id)!.push(cr);
        });
        filteredBureaux.filter((b: any) => b.quorum_failed).forEach((bRow: any) => {
          const results = pvCandidateResultsAll.get(bRow.pv_id) || [];
          if (results.length === 0) return;
          const partyVotes = new Map<string, number>();
          results.forEach((r: any) => {
            const syndicat = ((r.candidates?.party || '').split(' — ')[0] || '').trim() || String(r.candidate_id);
            partyVotes.set(syndicat, (partyVotes.get(syndicat) || 0) + (Number(r.votes) || 0));
          });
          bRow.syndicats = Array.from(partyVotes.entries())
            .map(([syndicatName, votes]) => ({ syndicatName, votes, seats: 0, tiebreakType: null as 'anciennete' | 'age' | null }))
            .sort((a: any, b: any) => b.votes - a.votes);
        });

        // Total des sièges de l'élection
        const tSeats = allBureauxList
          .filter(b => b.college)
          .reduce((sum, b) => sum + (Number(b.seats_to_fill) || 0), 0);
        setTotalSeats(tSeats);

        // Avancement du dépouillement en SIÈGES
        // Numérateur : tous les PV publiés comptent comme dépouillés, quorum ou non
        const publishedGroupKeys = new Set<string>(
          (pvsData || [])
            .map((pv: any) => {
              const centerId = String(pv.voting_bureaux?.center_id || '');
              const ct = normalizeCollegeKey(pv.college_type || (pv.voting_bureaux as any)?.college_type || '') || '';
              return centerId && ct ? `${centerId}_${ct}` : '';
            })
            .filter((k): k is string => k !== '')
        );
        let depuilledSeatsCount = 0;
        publishedGroupKeys.forEach(gk => {
          depuilledSeatsCount += bureauSeats.get(gk) || 0;
        });
        setPublishedGroupCount(depuilledSeatsCount); // sièges dépouillés
        setTotalGroupCount(tSeats);                   // total sièges de l'élection
      }

      // Charger les logos syndicats pour les élections pro
      const logosMap = new Map<string, string>();
      if (isProfessional) {
        (unionLists ?? []).forEach((ul: any) => {
          if (ul.unions?.acronym && ul.unions?.logo) {
            logosMap.set(ul.unions.acronym, ul.unions.logo);
          }
        });
      }

      // Format final des candidats
      const totalCandidateVotesForPct = filteredSummaryData.reduce((sum, c) => sum + (c.total_votes || 0), 0);
      const finalCandidates: CandidateResult[] = filteredSummaryData
          .map(c => ({
            candidate_id: c.candidate_id,
            candidate_name: c.candidate_name,
            party_name: c.party || '',
            total_votes: c.total_votes || 0,
            percentage: totalCandidateVotesForPct > 0 ? (100 * (c.total_votes || 0)) / totalCandidateVotesForPct : 0,
            rank: 0,
            seats: c.seats,
            tiebreak: c.tiebreak,
            colleges: Array.from(c.colleges),
            logo: logosMap.get(c.candidate_id) || undefined
          }))
          .sort((a, b) => {
            // Pour les élections pro : sièges desc, puis votes desc (identique au tri admin)
            if (isProfessional) {
              if ((b.seats || 0) !== (a.seats || 0)) return (b.seats || 0) - (a.seats || 0);
            }
            return b.total_votes - a.total_votes;
          })
          .map((c, idx) => ({
            ...c,
            rank: (c.total_votes > 0 && (election.status === 'Terminée' || election.status === 'En cours')) ? idx + 1 : 0
          }));

      console.log('📊 [ElectionResults] Election data:', election);
      console.log('📊 [ElectionResults] election.nb_electeurs (BDD):', election.nb_electeurs);
      console.log('📊 [ElectionResults] Total inscrits TOUS bureaux (calculé):', allBureauxRegistered);
      console.log('📊 [ElectionResults] Inscrits bureaux avec résultats (totalRegistered):', totalRegistered);
      console.log('📊 [ElectionResults] Inscrits total élection (totalRegisteredElection):', totalRegisteredElection);
      console.log('📊 [ElectionResults] Votants:', votersSum);
      console.log('📊 [ElectionResults] Taux participation:', participationRate.toFixed(2) + '%');
      console.log('📊 [ElectionResults] Taux abstention:', (100 - participationRate).toFixed(2) + '%');

      let collegeRowsBuilt: CollegeDetailRow[] = [];
      if (isProfessional) {
        const votesByCollegeSyndicat: Record<string, Record<string, number>> = {};
        (candidateResultsData || []).forEach((cr: any) => {
          if (!quorumOkPvIds.has(cr.pv_id)) return; // PV sans quorum → exclu
          const parts = String(cr.candidates?.party || '').split(' — ');
          const syndicat = parts[0]?.trim() || 'Autre';
          const college = parts[1]?.trim() || 'Général';
          if (!votesByCollegeSyndicat[college]) votesByCollegeSyndicat[college] = {};
          votesByCollegeSyndicat[college][syndicat] =
            (votesByCollegeSyndicat[college][syndicat] || 0) + (Number(cr.votes) || 0);
        });

        // Réutiliser les données déjà chargées lors du calcul des sièges
        const electoralColleges = electoralCollegesForPro;

        const collegeLabels = new Set<string>();
        (electoralColleges || []).forEach((ec: { name?: string }) => {
          if (ec.name) collegeLabels.add(ec.name);
        });
        Object.keys(votesByCollegeSyndicat).forEach((c) => collegeLabels.add(c));

        for (const collegeName of collegeLabels) {
          const syndicatVotes = votesByCollegeSyndicat[collegeName] || {};
          Object.entries(syndicatVotes)
            .sort((a, b) => b[1] - a[1])
            .forEach(([syndicatName, votes]) => {
              const collegeLabel = getNormalizedCollegeLabel(collegeName);
              const seatKey = `${collegeLabel}_${syndicatName}`;
              const seats = collegeSyndicatSeats.get(seatKey) || 0;
              collegeRowsBuilt.push({
                collegeName: collegeLabel,
                syndicatName,
                votes,
                seats: seats,
                tiebreakType: collegeSyndicatTiebreak.get(seatKey) ?? null,
              });
            });
        }
      }

      // Sièges attribués (depuis finalCandidates après l'algo)
      if (isProfessional) {
        const pSeats = finalCandidates.reduce((s, c) => s + (c.seats || 0), 0);
        setPublishedSeats(pSeats);
      } else {
        setTotalSeats(0);
        setPublishedSeats(0);
      }

      // Utiliser les données filtrées (uniquement bureaux publiés)
      setCenterRows(filteredCenters);
      setBureauRows(filteredBureaux);
      setCollegeDetailRows(collegeRowsBuilt);

      // Map syndicatKey_collegeKey[_etablissement] → titulaires pour la vue détaillée
      // Clé avec établissement : lookup précis par établissement (multi-établissements)
      // Clé sans établissement  : fallback global (élection mono-établissement ou données sans étab.)
      const tMap = new Map<string, string[]>();
      (unionLists || []).forEach((ul: any) => {
        const acronym = ul.unions?.acronym?.trim() || '';
        const uName = ul.unions?.name?.trim() || '';
        const collegeLabel = getNormalizedCollegeLabel(ul.college).toLowerCase();
        const tits: any[] = Array.isArray(ul.titulaires) ? ul.titulaires
          : (typeof ul.titulaires === 'string' ? JSON.parse(ul.titulaires || '[]') : []);
        for (const tit of tits) {
          const tName: string = tit?.name || '';
          if (!tName) continue;
          const etabl = (tit.etablissement || '').toLowerCase().trim();
          [acronym, uName].filter(Boolean).forEach(key => {
            const keyLc = key.toLowerCase();
            // Clé spécifique à l'établissement
            if (etabl) {
              const mkEtab = `${keyLc}_${collegeLabel}_${etabl}`;
              const prevE = tMap.get(mkEtab) || [];
              if (!prevE.includes(tName)) tMap.set(mkEtab, [...prevE, tName]);
            }
            // Clé globale (fallback)
            const mk = `${keyLc}_${collegeLabel}`;
            const prev = tMap.get(mk) || [];
            if (!prev.includes(tName)) tMap.set(mk, [...prev, tName]);
          });
        }
      });
      setTitulairesMap(tMap);

      // Map syndicatKey_collegeKey → order_num pour affichage #N dans le tableau
      const oMap = new Map<string, number>();
      (unionLists || []).forEach((ul: any) => {
        if (ul.order_num == null) return;
        const acronym = ul.unions?.acronym?.trim() || '';
        const uName = ul.unions?.name?.trim() || '';
        const collegeLabel = getNormalizedCollegeLabel(ul.college).toLowerCase();
        [acronym, uName].filter(Boolean).forEach(key => {
          oMap.set(`${key.toLowerCase()}_${collegeLabel}`, ul.order_num);
        });
      });
      setOrderNumMap(oMap);

      setResults({
        election,
        total_voters: totalRegistered,
        total_voters_election: totalRegisteredElection,
        total_registered_published: registeredInBureauxWithResults,
        total_votes_cast: totalVotesCast,
        participation_rate: participationRate,
        candidates: finalCandidates,
        last_updated: new Date().toISOString()
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (platform: string) => {
    // Toujours partager uniquement l'URL courte du site
    const url = `https://www.ohitu.com/election/${slug}/results`;
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        toast.success('Lien copié dans le presse-papiers');
        break;
    }
  };

  // Fonction pour switcher vers une autre élection
  const handleElectionSwitch = (targetElectionId: string) => {
    if (targetElectionId !== electionId) {
      const targetElection = availableElections.find(e => e.id === targetElectionId);
      const targetSlug = targetElection?.slug;
      if (!targetSlug) return;
      setTotalBureaux(0);
      setBureauxAvecResultats(0);
      setMobileRetryCount(0);
      navigate(`/election/${targetSlug}/results`);
    }
  };

  // Trouver l'élection alternative (législative <-> locale)
  const getAlternativeElection = () => {
    if (!results?.election || availableElections.length === 0) return null;

    const currentTitle = results.election.title.toLowerCase();
    const currentDescription = results.election.description?.toLowerCase() || '';
    const currentLocation = results.election.localisation?.toLowerCase() || '';

    // Déterminer le type de l'élection actuelle
    const isLocal = ['locale', 'locales', 'local', 'municipale', 'municipales'].some(keyword =>
      currentTitle.includes(keyword) || currentDescription.includes(keyword) || currentLocation.includes(keyword)
    );

    const isLegislative = ['législative', 'législatives', 'legislative'].some(keyword =>
      currentTitle.includes(keyword) || currentDescription.includes(keyword) || currentLocation.includes(keyword)
    );

    // Debug pour voir la détection
    console.log('Élection actuelle:', results.election.title);
    console.log('Est locale:', isLocal);
    console.log('Est législative:', isLegislative);

    // Trouver l'élection alternative
    if (isLocal) {
      const alternative = availableElections.find(election => {
        const title = election.title?.toLowerCase() || '';
        const description = election.description?.toLowerCase() || '';
        const location = election.localisation?.toLowerCase() || '';
        return ['législative', 'législatives', 'legislative'].some(keyword =>
          title.includes(keyword) || description.includes(keyword) || location.includes(keyword)
        );
      });
      console.log('Élection alternative trouvée (locale -> législative):', alternative?.title);
      return alternative;
    } else if (isLegislative) {
      const alternative = availableElections.find(election => {
        const title = election.title?.toLowerCase() || '';
        const description = election.description?.toLowerCase() || '';
        const location = election.localisation?.toLowerCase() || '';
        return ['locale', 'locales', 'local', 'municipale', 'municipales'].some(keyword =>
          title.includes(keyword) || description.includes(keyword) || location.includes(keyword)
        );
      });
      console.log('Élection alternative trouvée (législative -> locale):', alternative?.title);
      return alternative;
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gov-gray">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gov-dark mb-2">Aucun résultat disponible</h1>
          <p className="text-gov-gray mb-6">
            {error || 'Les résultats de cette élection ne sont pas encore disponibles.'}
          </p>
          <Button onClick={() => navigate('/')} className="bg-gov-blue text-white hover:bg-blue-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const winner = results.candidates.find(c => c.rank === 1);

  // Types pour le tri et regroupement
  type CenterGroup = {
    center: any;
    bureaux: any[];
  };

  type BureauData = any;

  // Agrège les données par collège pour la vue Pro (table fixe par établissement)
  const abbreviateName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    // Format stocké : NOM Prénom (nom de famille en majuscules en premier)
    // Les mots entièrement en majuscules = nom de famille → affichés en entier
    // Les mots en casse mixte = prénom → réduits à l'initiale
    const isAllUpper = (s: string) => s.length > 1 && s === s.toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ]/.test(s);
    let i = 0;
    while (i < parts.length - 1 && isAllUpper(parts[i])) i++;
    if (i === 0) {
      // Aucun mot en majuscules : premier mot = nom, reste = prénom
      return `${parts[0]} ${parts.slice(1).map(p => p.charAt(0).toUpperCase() + '.').join(' ')}`;
    }
    const lastName = parts.slice(0, i).join(' ');
    const firstInitials = parts.slice(i).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
    return `${lastName} ${firstInitials}`;
  };

  // Libellé de l'étiquette de départage selon le critère ayant tranché
  const tiebreakLabel = (type: 'anciennete' | 'age' | null | undefined): string | null => {
    if (type === 'anciennete') return 'Victoire par ancienneté';
    if (type === 'age') return 'Victoire par âge';
    return null;
  };

  const getProCollegeTableRows = (bureaux: any[], centerId?: string) => {
    const collegeMap = new Map<string, {
      collegeName: string;
      college_type_key: string;
      total_registered: number;
      total_voters: number;
      total_expressed_votes: number;
      quorum_failed: boolean;
      syndicats: Map<string, { syndicat: string; seats: number; votes: number; tiebreakType: 'anciennete' | 'age' | null }>;
    }>();

    bureaux.forEach((b: any) => {
      const collegeName = getNormalizedCollegeLabel(b.college_type || b.bureau_name);
      const collegeTypeKey = b.college_type || '';
      if (!collegeMap.has(collegeName)) {
        collegeMap.set(collegeName, {
          collegeName,
          college_type_key: collegeTypeKey,
          total_registered: 0,
          total_voters: 0,
          total_expressed_votes: 0,
          quorum_failed: false,
          syndicats: new Map()
        });
      }
      const entry = collegeMap.get(collegeName)!;
      // Stats affichage : tous les bureaux (y compris quorum non atteint)
      entry.total_registered += Number(b.total_registered) || 0;
      entry.total_voters += Number(b.total_voters) || 0;
      entry.total_expressed_votes += Number(b.total_expressed_votes) || 0;
      if (b.quorum_failed) entry.quorum_failed = true;

      // Syndicats : tous les bureaux (sièges = 0 pour quorum non atteint, déjà géré à la source)
      if (b.syndicats) {
        b.syndicats.forEach((s: any) => {
          if (!entry.syndicats.has(s.syndicatName)) {
            entry.syndicats.set(s.syndicatName, { syndicat: s.syndicatName, seats: 0, votes: 0, tiebreakType: null });
          }
          const sEntry = entry.syndicats.get(s.syndicatName)!;
          sEntry.seats += Number(s.seats) || 0;
          sEntry.votes += Number(s.votes) || 0;
          if (s.tiebreakType) sEntry.tiebreakType = s.tiebreakType;
        });
      }
    });

    return Array.from(collegeMap.values()).map(c => ({
      ...c,
      seatsInLice: centerId && c.college_type_key
        ? bureauSeatsMap.get(`${centerId}_${c.college_type_key}`) || 0
        : 0,
      syndicats: Array.from(c.syndicats.values()).sort((a, b) => b.votes - a.votes)
    })).sort((a, b) => a.collegeName.localeCompare(b.collegeName));
  };

  // Fonction pour trier et regrouper les données
  const getSortedAndGroupedData = (): CenterGroup[] | BureauData[] => {
    if (viewMode === 'college') {
      return [];
    }
    if (viewMode === 'center') {
      // Pour la vue par centre, regrouper par centre et trier les bureaux
      const groupedCenters = centerRows.reduce((acc, center) => {
        const centerId = center.center_id;
        if (!acc[centerId]) {
          acc[centerId] = {
            center,
            bureaux: bureauRows.filter(b => b.center_id === centerId)
          };
        }
        return acc;
      }, {} as Record<string, CenterGroup>);

      // Trier les centres
      const sortedCenters = Object.values(groupedCenters).sort((a: CenterGroup, b: CenterGroup) => {
        let comparison = 0;
        switch (sortBy) {
          case 'center':
            comparison = (a.center.center_name || '').localeCompare(b.center.center_name || '');
            break;
          case 'participation':
            comparison = (a.center.participation_pct || 0) - (b.center.participation_pct || 0);
            break;
          case 'score':
            comparison = (a.center.score_pct || 0) - (b.center.score_pct || 0);
            break;
          case 'votes':
            comparison = (a.center.total_expressed_votes || 0) - (b.center.total_expressed_votes || 0);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      return sortedCenters;
    } else {
      // Pour la vue par bureau, trier directement les bureaux
      const sortedBureaux = [...bureauRows].sort((a, b) => {
        let comparison = 0;

        // Si le tri est par centre, trier d'abord par centre puis par numéro de bureau
        if (sortBy === 'center') {
          const centerA = a.center_name || centerNameById[a.center_id] || '';
          const centerB = b.center_name || centerNameById[b.center_id] || '';
          comparison = centerA.localeCompare(centerB);

          // Si les centres sont identiques, trier par numéro de bureau
          if (comparison === 0) {
            const numA = parseInt(a.bureau_name?.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.bureau_name?.match(/\d+/)?.[0] || '0');
            comparison = numA - numB;
          }
        } else {
          // Pour les autres critères, trier selon le critère sélectionné
          switch (sortBy) {
            case 'participation':
              comparison = (a.participation_pct || 0) - (b.participation_pct || 0);
              break;
            case 'score':
              comparison = (a.score_pct || 0) - (b.score_pct || 0);
              break;
            case 'votes':
              comparison = (a.total_expressed_votes || 0) - (b.total_expressed_votes || 0);
              break;
          }

          // Si les valeurs sont identiques, trier par centre puis par bureau
          if (comparison === 0) {
            const centerA = a.center_name || centerNameById[a.center_id] || '';
            const centerB = b.center_name || centerNameById[b.center_id] || '';
            comparison = centerA.localeCompare(centerB);

            if (comparison === 0) {
              const numA = parseInt(a.bureau_name?.match(/\d+/)?.[0] || '0');
              const numB = parseInt(b.bureau_name?.match(/\d+/)?.[0] || '0');
              comparison = numA - numB;
            }
          }
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

      return sortedBureaux;
    }
  };

  // Fonctions de tri pour les modales des candidats
  const getSortedCandidateCenters = () => {
    return [...candidateCenters].sort((a, b) => {
      let comparison = 0;
      switch (candidateModalSortBy) {
        case 'center':
          comparison = (a.center_name || '').localeCompare(b.center_name || '');
          break;
        case 'participation':
          comparison = (a.candidate_participation_pct || 0) - (b.candidate_participation_pct || 0);
          break;
        case 'score':
          comparison = (a.candidate_percentage || 0) - (b.candidate_percentage || 0);
          break;
        case 'votes':
          comparison = (a.candidate_votes || 0) - (b.candidate_votes || 0);
          break;
      }
      return candidateModalSortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const getSortedCandidateBureaux = () => {
    return [...candidateBureaux].sort((a, b) => {
      let comparison = 0;

      // Si le tri est par centre, trier d'abord par centre puis par numéro de bureau
      if (candidateModalSortBy === 'center') {
        const centerA = a.center_name || candidateCenterNameById[a.center_id] || '';
        const centerB = b.center_name || candidateCenterNameById[b.center_id] || '';
        comparison = centerA.localeCompare(centerB);

        // Si les centres sont identiques, trier par numéro de bureau
        if (comparison === 0) {
          const numA = parseInt(a.bureau_name?.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.bureau_name?.match(/\d+/)?.[0] || '0');
          comparison = numA - numB;
        }
      } else {
        // Pour les autres critères, trier selon le critère sélectionné
        switch (candidateModalSortBy) {
          case 'participation':
            comparison = (a.candidate_participation_pct || 0) - (b.candidate_participation_pct || 0);
            break;
          case 'score':
            comparison = (a.candidate_percentage || 0) - (b.candidate_percentage || 0);
            break;
          case 'votes':
            comparison = (a.candidate_votes || 0) - (b.candidate_votes || 0);
            break;
        }

        // Si les valeurs sont identiques, trier par centre puis par bureau
        if (comparison === 0) {
          const centerA = a.center_name || candidateCenterNameById[a.center_id] || '';
          const centerB = b.center_name || candidateCenterNameById[b.center_id] || '';
          comparison = centerA.localeCompare(centerB);

          if (comparison === 0) {
            const numA = parseInt(a.bureau_name?.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.bureau_name?.match(/\d+/)?.[0] || '0');
            comparison = numA - numB;
          }
        }
      }

      return candidateModalSortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const handleOpenCandidate = async (candidateId: string) => {
    setOpenCandidateId(candidateId);
    if (results?.election) {
      // Récupérer les PV publiés
      const { data: publishedPVs } = await supabase
        .from('procès_verbaux')
        .select('id, bureau_id')
        .eq('election_id', results.election.id)
        .eq('status', 'published');

      const publishedPVIds = (publishedPVs || []).map(pv => pv.id);
      const publishedBureauIdsForModal = new Set((publishedPVs || []).map(pv => pv.bureau_id));

      if (publishedPVIds.length === 0) {
        setCandidateCenters([]);
        setCandidateBureaux([]);
        return;
      }

      // Récupérer les résultats du candidat pour les PV publiés
      let candidateResults;
      const isProfessional = results.election.type === 'Élection Professionnelle';

      if (isProfessional) {
        const { data: allCandidateResults } = await supabase
          .from('candidate_results')
          .select(`
            pv_id,
            votes,
            candidate_id,
            candidates!inner(id, name, party),
            procès_verbaux!inner(
              id,
              bureau_id,
              total_registered,
              total_voters,
              votes_expressed,
              voting_bureaux!inner(id, name, center_id, registered_voters)
            )
          `)
          .in('pv_id', publishedPVIds);
          
         // filtrer par syndicat (candidateId contient le nom du syndicat dans ce cas)
         candidateResults = (allCandidateResults || []).filter((cr: any) => {
            const parts = (cr.candidates?.party || '').split(' — ');
            const syndicat = parts[0] || cr.candidate_id;
            return syndicat === candidateId;
         });
      } else {
        const { data } = await supabase
          .from('candidate_results')
          .select(`
            pv_id,
            votes,
            candidate_id,
            procès_verbaux!inner(
              id,
              bureau_id,
              total_registered,
              total_voters,
              votes_expressed,
              voting_bureaux!inner(id, name, center_id, registered_voters)
            )
          `)
          .in('pv_id', publishedPVIds)
          .eq('candidate_id', candidateId);
        candidateResults = data;
      }

      console.log('📊 Modal candidat - Résultats bruts:', candidateResults);

      // Agréger les résultats par bureau (important pour les syndicats avec multiples candidats dans le même bureau)
      const bureauResultsMap = new Map();
      (candidateResults || []).forEach((cr: any) => {
        const pv = cr.procès_verbaux;
        const bureauId = pv?.bureau_id;
        if (!bureauId) return;
        
        let collegeName = 'Général';
        if (isProfessional) {
            const parts = (cr.candidates?.party || '').split(' — ');
            if (parts.length > 1) {
              collegeName = parts[1];
            }
        }
        
        if (!bureauResultsMap.has(bureauId)) {
          bureauResultsMap.set(bureauId, {
             pv,
             bureau: pv?.voting_bureaux,
             candidate_votes: 0,
             colleges: new Set<string>(),
             college_votes: {} as Record<string, number>
          });
        }
        const b = bureauResultsMap.get(bureauId);
        b.candidate_votes += Number(cr.votes) || 0;
        b.colleges.add(collegeName);
        b.college_votes[collegeName] = (b.college_votes[collegeName] || 0) + (Number(cr.votes) || 0);
      });

      // Construire les données des bureaux
      const filteredBureaux = Array.from(bureauResultsMap.values()).map((b: any) => {
        return {
          bureau_id: b.pv?.bureau_id,
          bureau_name: b.bureau?.name || '',
          center_id: b.bureau?.center_id || '',
          candidate_votes: b.candidate_votes,
          candidate_percentage: Number(b.pv?.votes_expressed) > 0 ? (b.candidate_votes / Number(b.pv.votes_expressed)) * 100 : 0,
          candidate_participation_pct: Number(b.pv?.total_registered) > 0 ? (Number(b.pv?.total_voters) / Number(b.pv?.total_registered)) * 100 : 0,
          colleges: Array.from(b.colleges),
          college_votes: b.college_votes
        };
      });

      // Récupérer les noms des centres
      const centerIdsForModal = [...new Set(filteredBureaux.map(b => b.center_id).filter(Boolean))];
      const { data: centersNamesForModal } = await supabase
        .from('voting_centers')
        .select('id, name')
        .in('id', centerIdsForModal);
      
      const centerNamesMapForModal = new Map((centersNamesForModal || []).map((c: any) => [c.id, c.name]));

      // Récupérer tous les PV des centres pour calculer les totaux corrects
      const { data: allPVsForCenters } = await supabase
        .from('procès_verbaux')
        .select(`
          bureau_id,
          total_registered,
          total_voters,
          votes_expressed,
          voting_bureaux!inner(id, center_id, registered_voters)
        `)
        .in('id', publishedPVIds);

      // Créer un map des bureaux vers leurs données PV
      const bureauToPVMap = new Map();
      (allPVsForCenters || []).forEach((pv: any) => {
        bureauToPVMap.set(pv.bureau_id, {
          total_registered: Number(pv.total_registered) || 0,
          total_voters: Number(pv.total_voters) || 0,
          votes_expressed: Number(pv.votes_expressed) || 0,
          center_id: pv.voting_bureaux?.center_id
        });
      });

      // Agréger par centre
      const centersMap = new Map();
      filteredBureaux.forEach((b: any) => {
        const pvData = bureauToPVMap.get(b.bureau_id);
        if (!pvData) return;

        if (!centersMap.has(b.center_id)) {
          centersMap.set(b.center_id, {
            center_id: b.center_id,
            center_name: centerNamesMapForModal.get(b.center_id) || '',
            candidate_votes: 0,
            total_registered: 0,
            total_voters: 0,
            total_expressed: 0,
            candidate_percentage: 0,
            candidate_participation_pct: 0
          });
        }
        const center = centersMap.get(b.center_id);
        center.candidate_votes += b.candidate_votes;
        center.total_registered += pvData.total_registered;
        center.total_voters += pvData.total_voters;
        center.total_expressed += pvData.votes_expressed;
      });

      // Calculer les pourcentages après agrégation
      centersMap.forEach((center: any) => {
        // Score du candidat = ses voix / total des voix exprimées dans le centre
        center.candidate_percentage = center.total_expressed > 0 
          ? (center.candidate_votes / center.total_expressed) * 100 
          : 0;
        
        // Taux de participation = votants / inscrits
        center.candidate_participation_pct = center.total_registered > 0 
          ? (center.total_voters / center.total_registered) * 100 
          : 0;
      });

      const filteredCenters = Array.from(centersMap.values());
      
      console.log('📊 Modal candidat - Bureaux filtrés:', filteredBureaux.length);
      console.log('📊 Modal candidat - Centres filtrés:', filteredCenters.length);
      console.log('📊 Modal candidat - Exemple centre:', filteredCenters[0]);
      
      setCandidateCenters(filteredCenters);
      setCandidateBureaux(filteredBureaux);
      const nameMap: Record<string, string> = {};
      filteredCenters.forEach((c: any) => { if (c.center_id && c.center_name) nameMap[c.center_id] = c.center_name; });
      setCandidateCenterNameById(nameMap);
    }
  };


  // Générer les meta tags dynamiques pour le partage
  const generateSEOData = () => {
    if (!results?.election) {
      return {
        title: "Résultats d'élection | o'Hitu",
        description: "Consultez les résultats électoraux en temps réel sur o'Hitu.",
        image: 'https://www.ohitu.com/images/resultat_election.jpg?v=3'
      };
    }

    const election = results.election;
    const winner = results.candidates.find(c => c.rank === 1);
    const abstentionVal = typeof results.participation_rate === 'number' ? (100 - results.participation_rate) : undefined;
    const participation = abstentionVal !== undefined ? `${abstentionVal.toFixed(1)}%` : 'En cours';

    const title = winner
      ? `${winner.candidate_name} en tête | ${election.title}`
      : `Résultats — ${election.title}`;

    let description = `🗳️ ${election.title}\n\n`;
    if (winner) {
      description += `🏆 ${winner.candidate_name} en tête\n`;
      description += `📊 ${winner.total_votes.toLocaleString()} voix (${winner.percentage.toFixed(1)}%)\n`;
    }
    description += `📉 Abstention : ${participation}\n`;
    description += `📱 Suivez les résultats en temps réel sur o'Hitu`;

    return {
      title,
      description,
      image: election.cover_image_url || 'https://www.ohitu.com/images/resultat_election.jpg?v=3',
      url: `https://www.ohitu.com/election/${slug}/results`
    };
  };

  const seoData = generateSEOData();
  const electorsLabel = getRegisteredVotersLabel(results?.election?.type);
  const isProResults = isProfessionalElection(results?.election?.type);
  const showPublicResults =
    !!results?.election && (isAdminPreview || isElectionPublishedForPublic(results.election));

  // ── Export résultats (admin) ───────────────────────────────────────────────

  const buildExportFilename = () => {
    const slug = (results?.election?.title || 'election')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return `resultats_${slug}_${new Date().toISOString().split('T')[0]}`;
  };

  const handleExportPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const election = results?.election;
      const PAGE_W = 297;
      const MARGIN = 14;

      // toLocaleString('fr-FR') sépare les milliers par une espace insécable fine (U+202F),
      // que la police Helvetica de jsPDF affiche comme "/" — on la remplace par une espace normale
      const fmtNum = (n: number) => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');

      const fmtPct = (n: number | null) => (n === null ? '-' : `${n.toFixed(2)} %`);

      const drawHeader = (subtitle: string) => {
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, PAGE_W, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Résultats officiels — ${election?.title || 'Élection'}`, MARGIN, 10);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, PAGE_W - MARGIN, 10, { align: 'right' });
      };

      const drawSectionTitle = (title: string, y: number) => {
        doc.setFillColor(219, 234, 254);
        doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 7, 'F');
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, MARGIN + 2, y + 5);
        return y + 10;
      };

      const tableTheme = {
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        margin: { left: MARGIN, right: MARGIN, top: 18 },
      };

      // ── Page 1 : en-tête + statistiques + résultats globaux ──
      drawHeader("Vue d'ensemble");

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const metaLine = [
        election?.type,
        election?.status,
        election?.election_date ? new Date(election.election_date).toLocaleDateString('fr-FR') : '',
        election?.localisation,
        `Exporté le ${new Date().toLocaleDateString('fr-FR')}`,
      ].filter(Boolean).join('  •  ');
      doc.text(metaLine, MARGIN, 22);

      const totalRegistered = results?.total_voters_election || 0;
      const totalVoters = centerRows.reduce((s, c) => s + (Number(c.total_voters) || 0), 0);
      const totalNull = centerRows.reduce((s, c) => s + (Number(c.total_null_votes) || 0), 0);
      const totalExpressed = results?.total_votes_cast || 0;
      const participation = results?.participation_rate || 0;
      const abstention = 100 - participation;

      const statBoxes = [
        { label: electorsLabel || 'Inscrits', value: fmtNum(totalRegistered) },
        { label: 'Votants', value: fmtNum(totalVoters) },
        { label: 'Suffrages exprimés', value: fmtNum(totalExpressed) },
        { label: 'Bulletins nuls', value: fmtNum(totalNull) },
        { label: 'Participation', value: `${participation.toFixed(2)} %` },
        { label: 'Abstention', value: `${abstention.toFixed(2)} %` },
      ];

      const boxGap = 3;
      const boxW = (PAGE_W - MARGIN * 2 - boxGap * (statBoxes.length - 1)) / statBoxes.length;
      const boxY = 27;
      statBoxes.forEach((s, i) => {
        const bx = MARGIN + i * (boxW + boxGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, boxY, boxW, 14, 1.5, 1.5, 'FD');
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(s.value, bx + boxW / 2, boxY + 6.5, { align: 'center' });
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(s.label, bx + boxW / 2, boxY + 11.5, { align: 'center' });
      });

      const globalSectionY = drawSectionTitle(
        isProResults ? 'Résultats globaux par syndicat' : 'Résultats globaux par candidat',
        boxY + 18
      );

      const globalHeaders = isProResults
        ? ['Rang', 'Syndicat', 'Voix', '% des voix', 'Sièges']
        : ['Rang', 'Candidat', 'Parti / Liste', 'Voix', '% des voix'];

      const globalBody = (results?.candidates || []).map(c =>
        isProResults
          ? [c.rank > 0 ? `#${c.rank}` : '—', c.party_name, fmtNum(c.total_votes), `${c.percentage.toFixed(2)} %`, c.seats ?? '—']
          : [c.rank > 0 ? `#${c.rank}` : '—', c.candidate_name, c.party_name, fmtNum(c.total_votes), `${c.percentage.toFixed(2)} %`]
      );

      const globalTotalVotes = (results?.candidates || []).reduce((s, c) => s + (c.total_votes || 0), 0);
      const globalTotalSeats = (results?.candidates || []).reduce((s, c) => s + (c.seats || 0), 0);
      const globalFootRow = isProResults
        ? ['', 'TOTAL', fmtNum(globalTotalVotes), globalTotalVotes > 0 ? '100 %' : '-', globalTotalSeats]
        : ['', 'TOTAL', '', fmtNum(globalTotalVotes), globalTotalVotes > 0 ? '100 %' : '-'];

      // @ts-ignore
      autoTable(doc, {
        ...tableTheme,
        head: [globalHeaders],
        body: globalBody,
        foot: [globalFootRow],
        footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
        startY: globalSectionY,
        columnStyles: { 0: { halign: 'center', cellWidth: 14 } },
        didDrawPage: () => drawHeader("Vue d'ensemble"),
      });

      // ── Résultats par collège (élections professionnelles) ──
      if (isProResults && collegeDetailRows.length > 0) {
        doc.addPage();
        drawHeader('Résultats par collège');
        const collegeY = drawSectionTitle('Résultats par collège', 22);

        const byCollege = new Map<string, CollegeDetailRow[]>();
        collegeDetailRows.forEach(row => {
          if (!byCollege.has(row.collegeName)) byCollege.set(row.collegeName, []);
          byCollege.get(row.collegeName)!.push(row);
        });

        // Le collège est isolé dans sa propre colonne (fusionnée sur ses lignes via rowSpan)
        // pour qu'il ne soit jamais confondu avec un nom de syndicat.
        const collegeBody: any[] = [];
        const collegeSeparatorRows = new Set<number>();
        byCollege.forEach((rows, collegeName) => {
          rows.forEach((r, idx) => {
            const row: any[] = [];
            if (idx === 0) {
              row.push({
                content: collegeName,
                rowSpan: rows.length + 1,
                styles: { valign: 'middle', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 64, 175] },
              });
            }
            row.push(r.syndicatName, fmtNum(r.votes), r.seats);
            collegeBody.push(row);
          });
          const totalVotes = rows.reduce((s, r) => s + (r.votes || 0), 0);
          const totalSeats = rows.reduce((s, r) => s + (r.seats || 0), 0);
          collegeBody.push([
            { content: 'TOTAL', styles: { fontStyle: 'bold' } },
            { content: fmtNum(totalVotes), styles: { fontStyle: 'bold' } },
            { content: totalSeats, styles: { fontStyle: 'bold' } },
          ]);
          collegeSeparatorRows.add(collegeBody.length - 1);
        });

        // Largeurs fixes pour les 4 colonnes : la colonne Syndicat n'absorbe plus
        // tout l'espace restant, ce qui garde Voix/Sièges bien alignés sous leur en-tête.
        const collegeColWidths = { college: 38, syndicat: 60, voix: 38, sieges: 28 };
        const collegeTableWidth = collegeColWidths.college + collegeColWidths.syndicat + collegeColWidths.voix + collegeColWidths.sieges;
        const collegeMargin = (PAGE_W - collegeTableWidth) / 2;

        // @ts-ignore
        autoTable(doc, {
          ...tableTheme,
          margin: { ...tableTheme.margin, left: collegeMargin, right: collegeMargin },
          head: [['Collège', 'Syndicat', 'Voix', 'Sièges']],
          body: collegeBody,
          startY: collegeY,
          columnStyles: {
            0: { cellWidth: collegeColWidths.college },
            1: { cellWidth: collegeColWidths.syndicat },
            2: { halign: 'right', cellWidth: collegeColWidths.voix },
            3: { halign: 'center', cellWidth: collegeColWidths.sieges },
          },
          // Ligne de séparation pleine largeur après le TOTAL de chaque collège,
          // pour bien distinguer les collèges entre eux.
          didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3 && collegeSeparatorRows.has(data.row.index)) {
              const y = data.cell.y + data.cell.height;
              doc.setDrawColor(30, 64, 175);
              doc.setLineWidth(0.4);
              doc.line(collegeMargin, y, collegeMargin + collegeTableWidth, y);
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.2);
            }
          },
          didDrawPage: () => drawHeader('Résultats par collège'),
        });
      }

      // ── Résultats par établissement ──
      if (centerRows.length > 0) {
        const sortedCenters = [...centerRows].sort((a, b) => (a.center_name || '').localeCompare(b.center_name || ''));

        if (isProResults && collegeDetailRows.length > 0) {
          // Tableau croisé par établissement : syndicats en lignes, collèges (Voix | Sièges | % Abst.) en colonnes
          const CANONICAL_COLLEGES = ['Encadrement', 'Cadre', 'Maîtrise', 'Exécution'];
          const presentColleges = new Set<string>();
          collegeDetailRows.forEach(r => presentColleges.add(r.collegeName));
          const collegeOrder = [
            ...CANONICAL_COLLEGES.filter(c => presentColleges.has(c)),
            ...Array.from(presentColleges).filter(c => !CANONICAL_COLLEGES.includes(c)),
          ];

          const allSyndicats = (results?.candidates || [])
            .map(c => c.party_name || c.candidate_name)
            .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);

          const subHeaders = ['Voix', 'Sièges', '% Abst.'];
          const head = [
            [
              { content: 'Syndicat', rowSpan: 2, styles: { valign: 'middle' } },
              ...collegeOrder.map(c => ({ content: c, colSpan: 3, styles: { halign: 'center' as const } })),
              { content: 'Global établissement', colSpan: 3, styles: { halign: 'center' as const, fillColor: [22, 101, 52] as [number, number, number] } },
            ],
            [
              ...collegeOrder.flatMap(() => subHeaders),
              ...subHeaders,
            ],
          ];

          // Plusieurs tableaux établissement par page (économie de pages) :
          // une nouvelle page n'est ajoutée que si le bloc suivant ne tient plus.
          const CONTENT_BOTTOM = 195;
          doc.addPage();
          drawHeader('Résultats par établissement');
          let currentY = 22;

          sortedCenters.forEach(center => {
            const centerBureaux = bureauRows.filter((b: any) => b.center_id === center.center_id);
            const collegeRows = getProCollegeTableRows(centerBureaux, String(center.center_id || ''));
            const collegeRowByName = new Map(collegeRows.map((r: any) => [r.collegeName, r]));

            const etabAbst = (center.total_registered || 0) > 0
              ? 100 - ((center.total_voters || 0) / center.total_registered * 100)
              : null;
            const etabTotalSeats = collegeRows.reduce((s: number, r: any) => s + (r.seatsInLice || 0), 0);

            const body = allSyndicats.map(syndicatName => {
              const row: any[] = [syndicatName];
              let globalVotes = 0;
              let globalSeats = 0;
              collegeRows.forEach((cRow: any) => {
                const s = cRow.syndicats.find((x: any) => x.syndicat === syndicatName);
                globalVotes += s?.votes || 0;
                globalSeats += s?.seats || 0;
              });
              collegeOrder.forEach(collegeName => {
                const cRow: any = collegeRowByName.get(collegeName);
                if (!cRow) {
                  row.push('-', '-', '-');
                  return;
                }
                const s = cRow.syndicats.find((x: any) => x.syndicat === syndicatName);
                const votes = s?.votes || 0;
                const seats = s?.seats || 0;
                const abst = (cRow.total_registered || 0) > 0
                  ? 100 - ((cRow.total_voters || 0) / cRow.total_registered * 100)
                  : null;
                row.push(fmtNum(votes), seats || '-', fmtPct(abst));
              });
              row.push(fmtNum(globalVotes), globalSeats || '-', fmtPct(etabAbst));
              return row;
            });

            const totalRow: any[] = ['TOTAL'];
            collegeOrder.forEach(collegeName => {
              const cRow: any = collegeRowByName.get(collegeName);
              if (!cRow) { totalRow.push('-', '-', '-'); return; }
              const abst = (cRow.total_registered || 0) > 0
                ? 100 - ((cRow.total_voters || 0) / cRow.total_registered * 100)
                : null;
              totalRow.push(fmtNum(cRow.total_expressed_votes || 0), cRow.seatsInLice || '-', fmtPct(abst));
            });
            totalRow.push(fmtNum(center.total_expressed_votes || 0), etabTotalSeats || '-', fmtPct(etabAbst));

            // Estimation de la hauteur du bloc (titre + entêtes + lignes + total) pour décider
            // s'il faut passer à la page suivante avant de dessiner ce tableau.
            const estimatedRows = 2 + body.length + 1;
            const estimatedHeight = 10 + estimatedRows * 5 + 4;
            if (currentY + estimatedHeight > CONTENT_BOTTOM) {
              doc.addPage();
              drawHeader('Résultats par établissement');
              currentY = 22;
            }

            const y = drawSectionTitle(center.center_name || 'Établissement', currentY);

            // @ts-ignore
            autoTable(doc, {
              ...tableTheme,
              styles: { ...tableTheme.styles, fontSize: 7, cellPadding: 1.5 },
              head,
              body,
              foot: [totalRow],
              footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
              startY: y,
              columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' } },
              didDrawPage: () => drawHeader('Résultats par établissement'),
            });

            currentY = (doc as any).lastAutoTable.finalY + 6;
          });
        } else {
          doc.addPage();
          drawHeader('Résultats par établissement');
          const centerY = drawSectionTitle('Résultats par établissement', 22);

          const centerHeaders = ['Établissement', electorsLabel || 'Inscrits', 'Votants', 'Exprimés', 'Nuls', 'Participation'];
          const centerBody = sortedCenters.map(c => [
            c.center_name || '',
            fmtNum(c.total_registered || 0),
            fmtNum(c.total_voters || 0),
            fmtNum(c.total_expressed_votes || 0),
            fmtNum(c.total_null_votes || 0),
            `${(c.participation_pct || 0).toFixed(2)} %`,
          ]);

          const totalRegisteredAll = sortedCenters.reduce((s, c) => s + (c.total_registered || 0), 0);
          const totalVotersAll = sortedCenters.reduce((s, c) => s + (c.total_voters || 0), 0);
          const totalExpressedAll = sortedCenters.reduce((s, c) => s + (c.total_expressed_votes || 0), 0);
          const totalNullAll = sortedCenters.reduce((s, c) => s + (c.total_null_votes || 0), 0);
          const participationAll = totalRegisteredAll > 0 ? (totalVotersAll / totalRegisteredAll) * 100 : 0;

          // @ts-ignore
          autoTable(doc, {
            ...tableTheme,
            head: [centerHeaders],
            body: centerBody,
            foot: [[
              'TOTAL',
              fmtNum(totalRegisteredAll),
              fmtNum(totalVotersAll),
              fmtNum(totalExpressedAll),
              fmtNum(totalNullAll),
              `${participationAll.toFixed(2)} %`,
            ]],
            footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
            startY: centerY,
            columnStyles: {
              1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
              4: { halign: 'right' }, 5: { halign: 'right' },
            },
            didDrawPage: () => drawHeader('Résultats par établissement'),
          });
        }
      }

      // Pagination
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} / ${pageCount}`, PAGE_W - MARGIN, 205, { align: 'right' });
        doc.text("o'Hitu — Plateforme de gestion électorale", MARGIN, 205);
      }

      doc.save(`${buildExportFilename()}.pdf`);
    } catch (e) {
      console.error('Export PDF:', e);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const getSortedCollegeRows = (): CollegeDetailRow[] => {
    return [...collegeDetailRows].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'center':
          comparison =
            a.collegeName.localeCompare(b.collegeName) ||
            a.syndicatName.localeCompare(b.syndicatName);
          break;
        case 'votes':
          comparison = a.votes - b.votes;
          break;
        default:
          comparison =
            a.collegeName.localeCompare(b.collegeName) || b.votes - a.votes;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  return (
    <>
      <SEOHead
        title={seoData.title}
        description={seoData.description}
        image={seoData.image}
        url={seoData.url}
        type="article"
        keywords={`${results?.election?.title || 'élection'}, résultats électoraux, Gabon, ${results?.election?.election_date ? new Date(results.election.election_date).getFullYear() : '2024'}, démocratie, transparence, o'Hitu`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Election",
          "name": results?.election?.title || "Élection",
          "description": seoData.description,
          "datePublished": results?.election?.election_date,
          "url": seoData.url,
          "image": seoData.image,
          "publisher": {
            "@type": "GovernmentOrganization",
            "name": "o'Hitu",
            "url": "https://www.ohitu.com"
          },
          "mainEntity": {
            "@type": "Election",
            "name": results?.election?.title,
            "datePublished": results?.election?.election_date,
            "description": results?.election?.description
          }
        }}
      />
      <div className="min-h-screen bg-white">
        {/* Header identique à la Home */}
        <header className="border-b bg-gov-blue text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button onClick={() => navigate('/')} className="flex items-center space-x-2 sm:space-x-3 group" aria-label="Aller à l'accueil">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                    <img src="/favicon.ico" alt="Logo iKADI" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-white font-bold text-lg sm:text-xl lg:text-2xl">o'Hitu</h1>
                  </div>
                </button>
              </div>
              
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Indicateur de qualité de connexion réseau */}
                <NetworkIndicator />

                <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
                  <Link to="/" className="hover:text-blue-200 transition-colors flex items-center gap-1 lg:gap-2 text-sm lg:text-base">
                    <Home className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span className="hidden lg:inline">Accueil</span>
                  </Link>
                  {/* <a href="#about" className="hover:text-blue-200 transition-colors">A propos</a>
                <a href="#infos" className="hover:text-blue-200 transition-colors">Infos électorales</a>
                <a href="#candidats" className="hover:text-blue-200 transition-colors">Candidats</a> */}
                  {/* Résultats - temporairement masqué */}
                  {false && (
                    <div className="relative text-left" onMouseEnter={() => setResultsMenuOpen(true)} onMouseLeave={() => setResultsMenuOpen(false)}>
                      <button className="hover:text-blue-200 transition-colors flex items-center gap-2" onClick={() => setResultsMenuOpen(v => !v)}>
                        <BarChart3 className="w-4 h-4" />
                        Résultats
                      </button>
                      {resultsMenuOpen && (
                        <div className="absolute right-0 left-auto mt-2 bg-white rounded shadow-lg border min-w-[260px] z-50 py-2">
                          <div className="px-3 pb-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                            <Zap className="w-3 h-3" />
                            Accès rapide
                          </div>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm text-gray-800 flex items-center gap-2"
                            onClick={() => navigate('/')}
                          >
                            <Home className="w-3 h-3" />
                            Tous les résultats (accueil)
                          </button>
                          {results?.election && (
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm text-gray-800 flex items-center gap-2"
                              onClick={() => navigate(`/election/${results.election.slug ?? slug}/results`)}
                            >
                              <BarChart3 className="w-3 h-3" />
                              Résultats courants
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* <a href="#circonscriptions" className="hover:text-blue-200 transition-colors">Circonscriptions / Bureaux</a>
                <a href="#contact" className="hover:text-blue-200 transition-colors">Contact</a> */}
                </nav>
                <button className="md:hidden p-1.5 sm:p-2 rounded hover:bg-white/10" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(v => !v)}>
                  {mobileOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="mt-3 md:hidden border-t border-white/10 pt-3 space-y-1 sm:space-y-2">
                {[
                  { href: '/', label: 'Accueil', icon: Home },
                  // { href: '#resultats', label: 'Résultats', icon: BarChart3 }, // masqué pour l'instant
                ].map(link => (
                  <Link key={link.label} to={link.href} className="px-2 sm:px-3 py-2 sm:py-2.5 rounded hover:bg-white/10 flex items-center gap-2 text-sm sm:text-base" onClick={() => setMobileOpen(false)}>
                    <link.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Hero Section inspirée (gauche: texte, droite: illustration) */}
        <section className="relative overflow-hidden">
          {/* Overlay bleu léger */}
          <div className="absolute inset-0 bg-blue-800/20" />


          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 xl:py-14 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 xl:gap-16 items-center">
              {/* Colonne gauche: contenu */}
              <div className="order-2 lg:order-1">

                {/* Badge dynamique statut + type */}
                {(() => {
                  const t = (results.election?.title || '').toLowerCase();
                  const isLocal = ['locale', 'locales', 'local', 'municipale', 'municipales'].some(k => t.includes(k));
                  const electionColor = isLocal ? '#116917' : '#A51C30';
                  const bgColor = isLocal ? 'bg-[#116917]/10' : 'bg-[#A51C30]/10';
                  const textColor = isLocal ? 'text-[#116917]' : 'text-[#A51C30]';
                  const borderColor = isLocal ? 'border-[#116917]/30' : 'border-[#A51C30]/30';

                  const isHidden = results.election?.is_public_visible === false;
                  return (
                    <div className="mb-3 sm:mb-4">
                      {/* Étiquette de statut de l'élection */}
                      {isHidden ? (
                        <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-violet-100 text-violet-800 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 border border-violet-300">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-violet-400" />
                          <span className="text-xs sm:text-sm font-medium">Masqué au public</span>
                        </div>
                      ) : (
                        <div className={`inline-flex items-center gap-1.5 sm:gap-2 ${bgColor} ${textColor} rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 border ${borderColor}`}>
                          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${results.election?.status === 'Terminée' ? 'bg-green-500' :
                            results.election?.status === 'En cours' ? 'bg-yellow-500 animate-pulse' :
                              'bg-blue-500'
                            }`} style={{ backgroundColor: results.election?.status === 'Terminée' ? electionColor : undefined }} />
                          <span className="text-xs sm:text-sm font-medium">
                            {results.election?.status} • {(() => {
                              if (results.election?.type === 'Élection Professionnelle') return 'Élection Professionnelle';
                              return isLocal ? 'Élections Locales' : 'Élections Législatives';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-gray-900 mb-3 sm:mb-4 leading-tight">
                  {results.election?.title}
                </h1>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mb-4 sm:mb-6">
                  Consultez les résultats, mis à jour pour {results.election?.localisation || 'cette élection'}.
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      const el = document.getElementById('candidats');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gov-blue hover:bg-gov-blue-dark text-white shadow transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    Voir les résultats
                  </button>
                  <span className="flex items-center gap-1.5 sm:gap-2 text-gray-700 bg-white rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 border text-xs sm:text-sm w-full sm:w-auto justify-center">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gov-blue" />
                    {new Date(results.election?.election_date || '').toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>

                  {/* Bouton téléchargement — admin uniquement */}
                  {isGlobalAdmin && showPublicResults && (
                    <button
                      onClick={handleExportPDF}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Télécharger les résultats (PDF)</span>
                    </button>
                  )}

                  {/* Texte d'information sur les résultats provisoires */}
                  <div className="w-full mt-2">
                    <p className="text-xs text-gray-500">
                      * {results.election?.type === 'Élection Professionnelle'
                        ? "Résultat provisoire avant validation par l'Inspecteur du Travail."
                        : "Résultats provisoires (à confirmer par le Ministère de l'Intérieur)."}
                    </p>
                  </div>

                  {results.election?.localisation && (
                    <span className="flex items-center gap-1.5 sm:gap-2 text-gray-700 bg-white rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 border text-xs sm:text-sm w-full sm:w-auto justify-center">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gov-blue" />
                      {results.election.localisation}
                    </span>
                  )}
                </div>
              </div>

              {/* Colonne droite: illustration */}
              <div className="relative order-1 lg:order-2">
                {/* Image */}
                <div className="relative rounded-xl sm:rounded-2xl shadow-2xl border bg-white overflow-hidden aspect-video lg:aspect-auto">
                  <img 
                    src={results.election?.cover_image_url || '/images/resultat_election.jpg'} 
                    alt="Aperçu des résultats" 
                    className="w-full h-full object-cover" 
                  />
                </div>

              </div>
            </div>
            {/* Copyright aligné à gauche, léger décalage à droite et police légèrement agrandie */}
            <div className="mt-3 sm:mt-2 lg:mt-2 pl-1 sm:pl-2 text-gray-600 text-[11px] leading-none text-left">
              © 2026 solution o'Hitu - Tous droits réservés
            </div>
            {/* Supprimé: copyright dupliqué en desktop */}
          </div>
        </section>

        {/* Statistiques principales modernisées */}
        {showPublicResults && (
        <section id="statistiques" className="bg-gradient-to-br from-gray-50 to-gray-100 py-6 sm:py-8 lg:py-12 xl:py-16 -mt-2 sm:-mt-4 lg:-mt-6 xl:-mt-8 relative z-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <MetricCard
                title={getRegisteredVotersLabel(results.election?.type)}
                value={results.total_voters_election || 0}
                icon={<Users className="w-8 h-8" />}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
                subtitle={
                  isProfessionalElection(results.election?.type)
                    ? `Bureaux dépouillés : ${(results.total_registered_published || 0).toLocaleString()} électeurs`
                    : `Bureaux dépouillés : ${(results.total_voters || 0).toLocaleString()} inscrits`
                }
                animated={true}
              />
              <MetricCard
                title="Suffrages exprimés"
                value={results.total_votes_cast}
                icon={<TrendingUp className="w-8 h-8" />}
                color="bg-gradient-to-br from-green-500 to-green-600"
                subtitle="Votes comptabilisés"
                animated={true}
              />
              {results.total_voters > 0 ? (
              <MetricCard
                title="Taux d'abstention"
                value={typeof results.participation_rate === 'number' ? 100 - results.participation_rate : 0}
                icon={<div className="w-8 h-8 bg-white rounded-full flex items-center justify-center"><span className="text-blue-600 font-bold text-lg">%</span></div>}
                color="bg-gradient-to-br from-red-500 to-red-600"
                subtitle="Pourcentage d'abstention"
                animated={true}
                showDecimals={true}
              />
              ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">Taux d'abstention</h3>
                  <p className="text-sm text-gray-500 text-center">Sera calculé après publication des premiers résultats</p>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Message si élection non publiée */}
        {results?.election && !showPublicResults && (
          <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {results.election?.status === 'Annulée' || results.election?.is_public_visible === false
                    ? 'Élection non disponible'
                    : 'Résultats en cours de traitement'}
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  {results.election?.status === 'Annulée' || results.election?.is_public_visible === false
                    ? 'Cette élection a été retirée de la consultation publique.'
                    : 'Les résultats de cette élection ne sont pas encore publiés publiquement.'}
                </p>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <p className="text-sm text-gray-700">
                    {results.election?.status === 'Annulée' || results.election?.is_public_visible === false
                      ? 'Contactez l\'organisateur si vous pensez qu\'il s\'agit d\'une erreur.'
                      : 'Les opérations de dépouillement et de validation sont en cours. Les résultats seront publiés dès que le processus de validation sera terminé.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section Couverture */}
        {showPublicResults && (
        <section className="py-6 sm:py-8 lg:py-12 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center">
              {/* Carte dépouillement pour élections pro */}
              {isProResults && totalGroupCount > 0 ? (
                (() => {
                  const depPct = Math.round((publishedGroupCount / totalGroupCount) * 100);
                  const isComplete = publishedGroupCount >= totalGroupCount;
                  const bgColor = isComplete ? 'bg-green-100' : depPct >= 50 ? 'bg-blue-50' : 'bg-orange-100';
                  const textColor = isComplete ? 'text-green-800' : depPct >= 50 ? 'text-blue-800' : 'text-orange-800';
                  return (
                    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200 max-w-sm w-full">
                      <div className="text-center">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">
                          Avancement du dépouillement
                        </h3>
                        <p className="text-xs text-gray-500 mb-3">Sièges dépouillés / Total sièges élection</p>
                        <div className={`${bgColor} rounded-lg p-3 sm:p-4 mb-3`}>
                          <div className={`text-2xl sm:text-3xl font-bold ${textColor} mb-1`}>
                            {depPct}%
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">
                            {publishedGroupCount} sur {totalGroupCount} sièges dépouillés
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {isComplete ? "Dépouillement terminé" : "En cours de dépouillement"}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (() => {
                const bureauxPubCount = publishedBureauIds.size;
                const coveragePercentage = totalBureaux > 0 ? Math.round((bureauxPubCount / totalBureaux) * 100) : 0;
                const isComplete = totalBureaux > 0 && bureauxPubCount >= totalBureaux;
                const bgColor = isComplete ? "bg-green-100" : "bg-orange-100";
                const textColor = isComplete ? "text-green-800" : "text-orange-800";
                return (
                  <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200 max-w-sm w-full">
                    <div className="text-center">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">
                        Couverture des bureaux
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Taux de couverture des bureaux de vote
                      </p>
                      <div className={`${bgColor} rounded-lg p-3 sm:p-4 mb-3`}>
                        <div className={`text-xl sm:text-2xl font-bold ${textColor} mb-1`}>
                          {totalBureaux > 0 ? `${coveragePercentage}%` : '0%'}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                          {bureauxPubCount} sur {totalBureaux} bureaux
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {isComplete ? "Tous les bureaux ont été publiés" : "PV publiés / Total bureaux"}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
        )}

        {/* Résultats des candidats modernisés */}
        {showPublicResults && (
        <section id="candidats" className="py-6 sm:py-8 lg:py-12 xl:py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6 sm:mb-8 lg:mb-12">
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-black" />
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">
                  {isProResults ? 'Résultats par syndicat' : 'Résultats par candidat'}
                </h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto px-2 sm:px-4">
                {isProResults
                  ? 'Découvrez les performances de chaque syndicat suite au vote'
                  : 'Découvrez les performances de chaque candidat suite au vote'}
              </p>
            </div>
            {/* Sélecteur de vue */}
            <div className="flex items-center justify-center sm:justify-end mb-3 sm:mb-4 lg:mb-6">
              <div className="inline-flex rounded-lg border bg-white overflow-hidden">
                <button
                  onClick={() => setCandidateViewMode('grid')}
                  className={`px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 ${candidateViewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <LayoutGrid className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Grille</span>
                  <span className="sm:hidden">Grid</span>
                </button>
                <button
                  onClick={() => setCandidateViewMode('table')}
                  className={`px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border-l flex items-center gap-1.5 sm:gap-2 ${candidateViewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <TableIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Liste</span>
                  <span className="sm:hidden">List</span>
                </button>
              </div>
            </div>
            {/* Aide d'interaction */}
            <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <span className="text-center sm:text-left">
                {isProResults
                  ? 'Cliquez sur un syndicat pour voir les détails'
                  : 'Cliquez sur un candidat pour voir les détails'}
              </span>
            </div>

            {results.candidates.length === 0 ? (
              <div className="text-center py-8 sm:py-12 lg:py-16">
                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-3 sm:mb-4 lg:mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <Vote className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-gray-400" />
                </div>
                <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 mb-2 sm:mb-3">Aucun résultat disponible</h3>
                <p className="text-gray-600 max-w-md mx-auto px-2 sm:px-4 text-sm sm:text-base">
                  Les résultats de cette élection sont publiés au fur et à mesure du vote.
                </p>
              </div>
            ) : (
              candidateViewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 xl:gap-8">
                  {results.candidates.map((candidate, index) => {
                    const hasVotes = candidate.total_votes > 0;
                    const electionFinished = results.election?.status === 'Terminée' || results.election?.status === 'En cours';
                    const isWinner = hasVotes && electionFinished && index === 0;
                    return (
                      <CandidateCard
                        key={candidate.candidate_id}
                        candidate={candidate}
                        rank={candidate.rank}
                        isWinner={isWinner}
                        onClick={() => handleOpenCandidate(candidate.candidate_id)}
                        totalVotes={results.total_votes_cast}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[380px] w-full bg-white border rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">
                          {isProResults ? 'Syndicat' : 'Candidat'}
                        </th>
                        {!isProResults && (
                          <th className="text-left px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">Parti</th>
                        )}
                        {isProResults && (
                          <th className="text-right px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">Sièges</th>
                        )}
                        <th className="text-right px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">Voix</th>
                        <th className="text-right px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">%</th>
                        <th className="text-center px-2 sm:px-4 py-2 sm:py-3 border text-xs sm:text-sm">Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.candidates.map((c, index) => {
                        const hasVotes = c.total_votes > 0;
                        const electionFinished = results.election?.status === 'Terminée' || results.election?.status === 'En cours';
                        const isWinner = hasVotes && electionFinished && index === 0;
                        return (
                          <tr key={c.candidate_id} className="odd:bg-white even:bg-gray-50 cursor-pointer hover:bg-blue-50/60 transition-colors" onClick={() => handleOpenCandidate(c.candidate_id)}>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 border font-medium text-gray-800 text-xs sm:text-sm">{c.candidate_name}</td>
                            {!isProResults && (
                              <td className="px-2 sm:px-4 py-2 sm:py-3 border text-gray-600 text-xs sm:text-sm">{c.party_name}</td>
                            )}
                            {isProResults && (
                              <td className="px-2 sm:px-4 py-2 sm:py-3 border text-right font-semibold text-xs sm:text-sm">
                                <span className="inline-flex items-center justify-end gap-1">
                                  {c.seats ?? 0}
                                  {c.tiebreak && (
                                    <Scale className="w-3 h-3 text-amber-500" aria-label="Siège attribué par départage (ancienneté/âge)" />
                                  )}
                                </span>
                              </td>
                            )}
                            <td className="px-2 sm:px-4 py-2 sm:py-3 border text-right text-xs sm:text-sm">{typeof c.total_votes === 'number' ? c.total_votes.toLocaleString('fr-FR') : (c.total_votes ?? '-')}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 border text-right text-xs sm:text-sm">{typeof c.percentage === 'number' ? `${Math.min(Math.max(c.percentage, 0), 100).toFixed(2)}%` : '0.00%'}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 border text-center">
                              <button className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-blue-700 hover:text-blue-900 hover:underline text-xs sm:text-sm" onClick={(e) => { e.stopPropagation(); handleOpenCandidate(c.candidate_id); }}>
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Voir</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </section>
        )}

        {/* Modal détail candidat */}
        {showPublicResults && (
        <Dialog open={!!openCandidateId} onOpenChange={(o) => !o && setOpenCandidateId(null)}>
          <DialogContent
            className="w-[calc(100vw-1rem)] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-3 sm:p-6"
          >
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {isProResults ? 'Détails du syndicat' : 'Détails du candidat'}
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const c = results.candidates.find(x => x.candidate_id === openCandidateId);
              if (!c) return <div className="text-gov-gray">Aucune donnée</div>;
              return (
                <div>
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gov-dark">{c.candidate_name}</h3>
                    <p className="text-gov-gray text-sm sm:text-base">{c.party_name}</p>
                    {/* <div className="mt-2 text-sm text-gov-gray">Voix: {c.total_votes.toLocaleString()} • Part: {c.percentage.toFixed(1)}%</div> */}
                  </div>
                  {isProResults ? (
                    /* Vue pro : tableau par établissement → collèges → même format que Vue détaillée */
                    (() => {
                      const allGroups = getSortedAndGroupedData() as CenterGroup[];
                      const activeEtabId = modalEtabId || allGroups[0]?.center.center_id || '';
                      const visibleGroups = activeEtabId
                        ? allGroups.filter(g => String(g.center.center_id) === String(activeEtabId))
                        : allGroups;
                      return (
                    <div className="mt-4 space-y-4">
                      {/* Select établissement */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Établissement :</label>
                        <select
                          value={activeEtabId}
                          onChange={e => setModalEtabId(e.target.value)}
                          className="flex-1 px-2 sm:px-3 py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {allGroups.map(g => (
                            <option key={g.center.center_id} value={g.center.center_id}>
                              {g.center.center_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {visibleGroups.map((group, gIdx) => {
                        const collegeRows = getProCollegeTableRows(group.bureaux);
                        const filteredRows = collegeRows
                          .map(row => {
                            const syndicatEntry = row.syndicats.find(s => s.syndicat === c.candidate_id);
                            if (!syndicatEntry) return null;
                            return { collegeName: row.collegeName, syndicat: syndicatEntry, total_expressed_votes: row.total_expressed_votes };
                          })
                          .filter((r): r is NonNullable<typeof r> => r !== null);
                        if (filteredRows.length === 0) return null;
                        return (
                          <div key={gIdx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                              <h4 className="font-semibold text-gray-800 text-sm">{group.center.center_name}</h4>
                            </div>
                            <div className="px-3 py-3">
                              <div className="overflow-x-auto">
                              <table className="w-full min-w-[280px] text-xs sm:text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 pr-2 font-semibold text-gray-600">Collège</th>
                                    <th className="text-center py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap">Sièges</th>
                                    <th className="text-right py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap">Voix</th>
                                    <th className="text-right py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap">Score</th>
                                    <th className="text-left py-1.5 pl-2 font-semibold text-gray-600 hidden sm:table-cell">Délégué</th>
                                    <th className="text-left py-1.5 pl-2 font-semibold text-gray-600 hidden sm:table-cell"> </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {filteredRows.map((r, i) => {
                                    const centerKey = (group.center.center_name || '').toLowerCase().trim();
                                    const mapKeyEtab = `${c.candidate_id.toLowerCase()}_${r.collegeName.toLowerCase()}_${centerKey}`;
                                    const mapKeyBase = `${c.candidate_id.toLowerCase()}_${r.collegeName.toLowerCase()}`;
                                    const titulaires = titulairesMap.get(mapKeyEtab) || titulairesMap.get(mapKeyBase) || [];
                                    const count = r.syndicat.seats > 0 ? r.syndicat.seats : 1;
                                    const delegueDisplay = titulaires.length > 0
                                      ? titulaires.slice(0, count).map(abbreviateName).join(', ')
                                      : '—';
                                    const score = r.total_expressed_votes > 0
                                      ? `${(r.syndicat.votes / r.total_expressed_votes * 100).toFixed(1)} %`
                                      : '—';
                                    return (
                                      <React.Fragment key={i}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                          <td className="py-2 pr-2 font-medium text-gray-800">{r.collegeName}</td>
                                          <td className="py-2 px-2 text-center font-bold text-blue-600">
                                            {r.syndicat.seats}
                                          </td>
                                          <td className="py-2 px-2 text-right text-gray-600 whitespace-nowrap">{r.syndicat.votes?.toLocaleString() || '0'}</td>
                                          <td className="py-2 px-2 text-right text-gray-500 whitespace-nowrap">{score}</td>
                                          <td className="py-2 pl-2 text-gray-600 hidden sm:table-cell">{delegueDisplay}</td>
                                          <td className="py-2 pl-2 hidden sm:table-cell">
                                            {tiebreakLabel(r.syndicat.tiebreakType) && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                                {tiebreakLabel(r.syndicat.tiebreakType)}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                        {delegueDisplay && delegueDisplay !== '—' && (
                                          <tr className="sm:hidden bg-slate-50">
                                            <td colSpan={4} className="pb-2 pt-0 pl-2 text-[10px] text-gray-500 italic">
                                              Délégué : {delegueDisplay}
                                              {tiebreakLabel(r.syndicat.tiebreakType) && (
                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap not-italic">
                                                  {tiebreakLabel(r.syndicat.tiebreakType)}
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                      );
                    })()
                  ) : (
                    /* Vue non-pro : tabs par centre */
                    <Tabs defaultValue="center">
                      <TabsList className="grid w-full grid-cols-1">
                        <TabsTrigger value="center" className="text-xs sm:text-sm">Par centre</TabsTrigger>
                      </TabsList>
                      {hasAnyCandidateData() && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-medium text-gray-700">Trier par :</span>
                            <select
                              value={candidateModalSortBy}
                              onChange={(e) => setCandidateModalSortBy(e.target.value as any)}
                              className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="center">Centre</option>
                              <option value="participation">Abstention</option>
                              <option value="score">Score</option>
                              <option value="votes">Voix</option>
                            </select>
                          </div>
                          <button
                            onClick={() => setCandidateModalSortOrder(candidateModalSortOrder === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs sm:text-sm hover:bg-blue-700 transition-colors"
                          >
                            {candidateModalSortOrder === 'asc' ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                            {candidateModalSortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
                          </button>
                        </div>
                      )}
                      <TabsContent value="center">
                        {hasCandidateCenterData() ? (
                          <div className="space-y-3 mt-3">
                            {getSortedCandidateCenters().map((row, idx) => (
                              <details key={idx} className="bg-white rounded border">
                                <summary className="cursor-pointer px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-100">
                                  <span className="font-semibold text-sm sm:text-base">{row.center_name}</span>
                                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm">
                                    <div className="bg-white rounded px-2 sm:px-3 py-2 border text-center"><div className="text-[10px] sm:text-[11px] uppercase text-gov-gray">{electorsLabel}</div><div className="font-semibold text-xs sm:text-sm">{row.total_registered?.toLocaleString() || '-'}</div></div>
                                    <div className="bg-white rounded px-2 sm:px-3 py-2 border text-center"><div className="text-[10px] sm:text-[11px] uppercase text-gov-gray">Votants</div><div className="font-semibold text-xs sm:text-sm">{row.total_voters?.toLocaleString() || '-'}</div></div>
                                    <div className="bg-white rounded px-2 sm:px-3 py-2 border text-center"><div className="text-[10px] sm:text-[11px] uppercase text-gov-gray">Voix</div><div className="font-semibold text-xs sm:text-sm">{row.candidate_votes}</div></div>
                                    <div className="bg-white rounded px-2 sm:px-3 py-2 border text-center"><div className="text-[10px] sm:text-[11px] uppercase text-gov-gray">Score</div><div className="font-semibold text-xs sm:text-sm">{typeof row.candidate_percentage === 'number' ? `${Math.min(Math.max(row.candidate_percentage, 0), 100).toFixed(2)}%` : '-'}</div></div>
                                    <div className="bg-white rounded px-2 sm:px-3 py-2 border text-center"><div className="text-[10px] sm:text-[11px] uppercase text-gov-gray">Abstention</div><div className="font-semibold text-xs sm:text-sm">{typeof row.candidate_participation_pct === 'number' ? `${(100 - Math.min(Math.max(row.candidate_participation_pct, 0), 100)).toFixed(2)}%` : '-'}</div></div>
                                  </div>
                                </summary>
                                <div className="px-0 sm:px-2 py-3">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full bg-white">
                                      <thead className="bg-slate-100">
                                        <tr>
                                          <th className="text-left px-2 sm:px-3 py-2 border text-xs sm:text-sm">Bureau</th>
                                          <th className="text-right px-2 sm:px-3 py-2 border text-xs sm:text-sm">Voix</th>
                                          <th className="text-right px-2 sm:px-3 py-2 border text-xs sm:text-sm">Score</th>
                                          <th className="text-right px-2 sm:px-3 py-2 border text-xs sm:text-sm">Abstention</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-xs sm:text-sm">
                                        {getSortedCandidateBureaux().filter(b => b.center_id === row.center_id).map((b, i2) => (
                                          <tr key={i2} className="odd:bg-white even:bg-slate-50">
                                            <td className="px-2 sm:px-3 py-2 border">{b.bureau_name}</td>
                                            <td className="px-2 sm:px-3 py-2 border text-right">{b.candidate_votes ?? '-'}</td>
                                            <td className="px-2 sm:px-3 py-2 border text-right">{typeof b.candidate_percentage === 'number' ? `${Math.min(Math.max(b.candidate_percentage, 0), 100).toFixed(2)}%` : '-'}</td>
                                            <td className="px-2 sm:px-3 py-2 border text-right">{typeof b.candidate_participation_pct === 'number' ? `${(100 - Math.min(Math.max(b.candidate_participation_pct, 0), 100)).toFixed(2)}%` : '-'}</td>
                                          </tr>
                                        ))}
                                        {getSortedCandidateBureaux().filter(b => b.center_id === row.center_id).length === 0 && (
                                          <tr><td className="px-3 py-4 text-center text-gov-gray text-xs sm:text-sm" colSpan={4}>Aucun bureau</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-6 p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                              <Building className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Aucune donnée par centre</h3>
                            <p className="text-gray-600 text-sm">Les résultats détaillés par centre ne sont pas encore disponibles.</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
        )}

        {/* Vue détaillée par centre / par bureau modernisée */}
        {showPublicResults && (
        <section id="analyse" className="py-6 sm:py-8 lg:py-12 xl:py-16 bg-gradient-to-br from-gray-50 to-gray-100">
          {hasAnyDetailedData() ? (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-6 sm:mb-8 lg:mb-12">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-blue-500" />
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">
                    Vue détaillée
                  </h2>
                </div>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-4 sm:mb-6 lg:mb-8 px-2 sm:px-4">
                  {isProResults
                    ? 'Explorez les résultats par établissement pour une analyse approfondie'
                    : 'Explorez les résultats par centre de vote ou par bureau pour une analyse approfondie'}
                </p>

                {/* Boutons de navigation modernisés */}
                {!isProResults && (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-4 bg-white rounded-full p-0.5 sm:p-1 lg:p-2 shadow-lg border border-gray-200 mx-auto max-w-xs sm:max-w-sm lg:max-w-md">
                    <button
                      onClick={() => setViewMode('center')}
                      className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-1 sm:gap-1.5 lg:gap-2 text-xs sm:text-sm ${viewMode === 'center'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Par centre</span>
                      <span className="sm:hidden">Centres</span>
                    </button>
                    <button
                      onClick={() => setViewMode('bureau')}
                      className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-1 sm:gap-1.5 lg:gap-2 text-xs sm:text-sm ${viewMode === 'bureau'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Par bureau</span>
                      <span className="sm:hidden">Bureaux</span>
                    </button>
                  </div>
                )}

                {/* Filtre par établissement (PRO) ou contrôles de tri (non-PRO) */}
                {(hasCenterData() || hasBureauData() || hasCollegeData()) && (
                  isProResults ? (
                    /* Filtre par établissement pour élections professionnelles */
                    <div className="mt-4 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-gray-200 max-w-xs sm:max-w-lg lg:max-w-2xl mx-auto">
                      <span className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                        <span>Établissement :</span>
                      </span>
                      <select
                        value={selectedEstablishmentId || (getSortedAndGroupedData() as CenterGroup[])[0]?.center.center_id || ''}
                        onChange={(e) => setSelectedEstablishmentId(e.target.value)}
                        className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto bg-white"
                      >
                        {(getSortedAndGroupedData() as CenterGroup[]).map((group) => (
                          <option key={group.center.center_id} value={group.center.center_id}>
                            {group.center.center_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* Contrôles de tri pour élections non-pro */
                    <div className="mt-4 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 lg:gap-4 bg-white rounded-xl p-2 sm:p-3 lg:p-4 shadow-lg border border-gray-200 max-w-xs sm:max-w-lg lg:max-w-4xl mx-auto">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Trier par:</span>
                          <span className="sm:hidden">Tri:</span>
                        </span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="px-1.5 sm:px-2 lg:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
                        >
                          <option value="center">Centre</option>
                          <option value="participation">Abstention</option>
                          <option value="votes">Votes</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className={`px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 sm:gap-2 ${sortOrder === 'asc'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                        >
                          {sortOrder === 'asc' ? (
                            <>
                              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Croissant</span>
                              <span className="sm:hidden">↑</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Décroissant</span>
                              <span className="sm:hidden">↓</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Vue PRO : table fixe par établissement sélectionné */}
              {isProResults ? (() => {
                const proGroups = getSortedAndGroupedData() as CenterGroup[];
                const selectedGroup = proGroups.find(g => String(g.center.center_id) === String(selectedEstablishmentId)) || proGroups[0];
                if (!selectedGroup) {
                  return (
                    <div className="text-center text-gray-500 py-8">Aucun établissement à afficher.</div>
                  );
                }
                const c = selectedGroup.center;
                const collegeRows = getProCollegeTableRows(selectedGroup.bureaux, String(c.center_id || ''));
                const centerTotalSeats = collegeRows.reduce((sum, row) => sum + ((row as any).seatsInLice || 0), 0);
                // Largeur des colonnes du tableau syndicats alignée sur la grille de la ligne collège (6 ou 5 colonnes)
                const innerColWidth = centerTotalSeats > 0 ? 'sm:w-1/6' : 'sm:w-1/5';
                return (
                  <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* En-tête établissement avec stats globales */}
                    <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0">
                          {c.center_name?.charAt(0) || 'E'}
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800">{c.center_name}</h3>
                          <p className="text-gray-500 text-xs sm:text-sm">Établissement</p>
                        </div>
                      </div>
                      <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${centerTotalSeats > 0 ? 'sm:[grid-template-columns:0.4fr_repeat(5,1fr)]' : 'sm:[grid-template-columns:0.4fr_repeat(4,1fr)]'}`}>
                        {/* Spacer réduit pour décaler légèrement les cartes vers la gauche */}
                        <div className="hidden sm:block" />
                        {centerTotalSeats > 0 && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm text-left">
                            <div className="text-[10px] sm:text-xs uppercase text-gray-500 font-medium mb-0.5">Sièges en lice</div>
                            <div className="font-bold text-gray-800 text-sm sm:text-base">{centerTotalSeats}</div>
                          </div>
                        )}
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm text-left">
                          <div className="text-[10px] sm:text-xs uppercase text-gray-500 font-medium mb-0.5">{electorsLabel}</div>
                          <div className="font-bold text-gray-800 text-sm sm:text-base">{typeof c.total_registered === 'number' ? c.total_registered.toLocaleString('fr-FR') : (c.total_registered || '-')}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm text-left">
                          <div className="text-[10px] sm:text-xs uppercase text-gray-500 font-medium mb-0.5">Votants</div>
                          <div className="font-bold text-gray-800 text-sm sm:text-base">{typeof c.total_voters === 'number' ? c.total_voters.toLocaleString('fr-FR') : (c.total_voters || '-')}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm text-left">
                          <div className="text-[10px] sm:text-xs uppercase text-gray-500 font-medium mb-0.5">Exprimés</div>
                          <div className="font-bold text-gray-800 text-sm sm:text-base">{typeof c.total_expressed_votes === 'number' ? c.total_expressed_votes.toLocaleString('fr-FR') : (c.total_expressed_votes || '-')}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm text-left">
                          <div className="text-[10px] sm:text-xs uppercase text-gray-500 font-medium mb-0.5">Abstention</div>
                          <div className={`font-bold text-sm sm:text-base ${typeof c.participation_pct === 'number'
                            ? ((100 - c.participation_pct) >= 49.51 ? 'text-red-600' : ((100 - c.participation_pct) > 20.5 ? 'text-yellow-600' : 'text-green-600'))
                            : 'text-gray-400'}`}>
                            {typeof c.participation_pct === 'number' ? `${(100 - Math.min(Math.max(c.participation_pct, 0), 100)).toFixed(2)}%` : '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* En-tête de tableau (desktop) */}
                    <div className={`hidden sm:grid ${centerTotalSeats > 0 ? 'grid-cols-6' : 'grid-cols-5'} px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide`}>
                      <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-400" />Collège</div>
                      {centerTotalSeats > 0 && <div className="text-left">Sièges en lice</div>}
                      <div className="text-left">{electorsLabel}</div>
                      <div className="text-left">Votants</div>
                      <div className="text-left">Exprimés</div>
                      <div className="text-left">Abstention</div>
                    </div>

                    {/* Lignes par collège avec accordéon syndicats */}
                    <div className="divide-y divide-gray-100">
                      {collegeRows.length > 0 ? collegeRows.map((row, rIdx) => {
                        const qFailed = (row as any).quorum_failed === true;
                        const abstPct = row.total_registered > 0
                          ? (100 - (row.total_voters / row.total_registered * 100))
                          : null;
                        const abstColor = qFailed ? 'text-red-600'
                          : abstPct === null ? 'text-gray-400'
                          : abstPct >= 49.51 ? 'text-red-600'
                          : abstPct > 20.5 ? 'text-yellow-600'
                          : 'text-green-600';
                        const abstBadge = qFailed ? 'bg-red-100 text-red-700'
                          : abstPct === null ? 'bg-gray-100 text-gray-400'
                          : abstPct >= 49.51 ? 'bg-red-100 text-red-700'
                          : abstPct > 20.5 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700';
                        const rowSeats = (row as any).seatsInLice || 0;
                        return (
                          <details key={rIdx} className={`group/col ${qFailed ? 'bg-red-50' : ''}`}>
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                              {/* Ligne desktop */}
                              <div className={`hidden sm:grid ${centerTotalSeats > 0 ? 'grid-cols-6' : 'grid-cols-5'} px-4 sm:px-6 py-3 transition-colors items-center ${qFailed ? 'hover:bg-red-100' : 'hover:bg-blue-50'}`}>
                                <div className={`flex items-center gap-2 font-semibold text-sm ${qFailed ? 'text-red-800' : 'text-gray-800'}`}>
                                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 group-open/col:rotate-180 shrink-0 ${qFailed ? 'text-red-400' : 'text-blue-400'}`} />
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    {row.collegeName}
                                    {qFailed && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 whitespace-nowrap">⚠ Quorum non atteint</span>
                                    )}
                                  </span>
                                </div>
                                {centerTotalSeats > 0 && (
                                  <div className={`text-left font-semibold text-sm ${qFailed ? 'text-red-700' : 'text-gray-700'}`}>{rowSeats > 0 ? rowSeats : '-'}</div>
                                )}
                                <div className={`text-left text-sm ${qFailed ? 'text-red-700' : 'text-gray-700'}`}>{row.total_registered?.toLocaleString() || '-'}</div>
                                <div className={`text-left text-sm ${qFailed ? 'text-red-700' : 'text-gray-700'}`}>{row.total_voters?.toLocaleString() || '-'}</div>
                                <div className={`text-left text-sm ${qFailed ? 'text-red-700' : 'text-gray-700'}`}>{row.total_expressed_votes?.toLocaleString() || '-'}</div>
                                <div className="text-left">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${abstBadge}`}>{abstPct !== null ? `${abstPct.toFixed(2)}%` : '-'}</span>
                                </div>
                              </div>
                              {/* Ligne mobile : card */}
                              <div className={`sm:hidden px-4 py-3 transition-colors ${qFailed ? 'hover:bg-red-100' : 'hover:bg-blue-50'}`}>
                                <div className="flex items-center justify-between">
                                  <div className={`flex items-center gap-2 font-semibold text-sm ${qFailed ? 'text-red-800' : 'text-gray-800'}`}>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 group-open/col:rotate-180 shrink-0 ${qFailed ? 'text-red-400' : 'text-blue-400'}`} />
                                    <span className="flex flex-col gap-0.5">
                                      {row.collegeName}
                                      {qFailed && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 w-fit">⚠ Quorum non atteint</span>
                                      )}
                                    </span>
                                  </div>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${abstBadge}`}>Abs. {abstPct !== null ? `${abstPct.toFixed(2)}%` : '-'}</span>
                                </div>
                                <div className={`mt-2 grid ${centerTotalSeats > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 text-center ml-4 sm:ml-6`}>
                                  {centerTotalSeats > 0 && (
                                    <div className="bg-white rounded px-1 py-1 border border-gray-100">
                                      <div className="text-[10px] text-gray-500 uppercase leading-tight">Sièges</div>
                                      <div className="text-xs font-semibold text-gray-800">{rowSeats > 0 ? rowSeats : '-'}</div>
                                    </div>
                                  )}
                                  <div className="bg-white rounded px-1 py-1 border border-gray-100">
                                    <div className="text-[10px] text-gray-500 uppercase leading-tight truncate">{electorsLabel}</div>
                                    <div className="text-xs font-semibold text-gray-800">{row.total_registered?.toLocaleString() || '-'}</div>
                                  </div>
                                  <div className="bg-white rounded px-1 py-1 border border-gray-100">
                                    <div className="text-[10px] text-gray-500 uppercase leading-tight">Votants</div>
                                    <div className="text-xs font-semibold text-gray-800">{row.total_voters?.toLocaleString() || '-'}</div>
                                  </div>
                                  <div className="bg-white rounded px-1 py-1 border border-gray-100">
                                    <div className="text-[10px] text-gray-500 uppercase leading-tight">Exprimés</div>
                                    <div className="text-xs font-semibold text-gray-800">{row.total_expressed_votes?.toLocaleString() || '-'}</div>
                                  </div>
                                </div>
                              </div>
                            </summary>
                            {/* Accordéon syndicats */}
                            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-gray-100">
                              <div className="overflow-x-auto">
                              <table className="w-full min-w-[280px] text-xs sm:text-sm sm:table-fixed">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className={`text-left py-1.5 pr-2 font-semibold text-gray-600 ${innerColWidth}`}>Syndicat</th>
                                    <th className={`text-center py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap ${centerTotalSeats > 0 ? innerColWidth : 'sm:hidden'}`}>Sièges</th>
                                    <th className={`text-right py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap ${innerColWidth}`}>Voix</th>
                                    <th className={`text-right py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap ${innerColWidth}`}>Score</th>
                                    <th className={`text-left py-1.5 pl-6 font-semibold text-gray-600 hidden sm:table-cell ${innerColWidth}`}>Délégué</th>
                                    <th className={`text-left py-1.5 pl-2 font-semibold text-gray-600 hidden sm:table-cell ${innerColWidth}`}> </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {row.syndicats.length > 0 ? row.syndicats.map((s, si) => {
                                    const centerKey = (c.center_name || '').toLowerCase().trim();
                                    const mapKeyEtab = `${s.syndicat.toLowerCase()}_${row.collegeName.toLowerCase()}_${centerKey}`;
                                    const mapKeyBase = `${s.syndicat.toLowerCase()}_${row.collegeName.toLowerCase()}`;
                                    const titulaires = titulairesMap.get(mapKeyEtab) || titulairesMap.get(mapKeyBase) || [];
                                    const count = s.seats > 0 ? s.seats : 1;
                                    const delegueDisplay = titulaires.length > 0
                                      ? titulaires.slice(0, count).map(abbreviateName).join(', ')
                                      : '—';
                                    const score = row.total_expressed_votes > 0
                                      ? `${(s.votes / row.total_expressed_votes * 100).toFixed(1)} %`
                                      : '—';
                                    return (
                                      <React.Fragment key={si}>
                                        <tr className="hover:bg-white transition-colors">
                                          <td className="py-2 pr-2 font-medium text-gray-800 break-words max-w-[120px] sm:max-w-none">
                                            {s.syndicat}
                                          </td>
                                          <td className={`py-2 px-2 text-center font-bold text-blue-600 ${centerTotalSeats > 0 ? '' : 'sm:hidden'}`}>
                                            {s.seats}
                                          </td>
                                          <td className="py-2 px-2 text-right text-gray-600 whitespace-nowrap">{s.votes?.toLocaleString() || '0'}</td>
                                          <td className="py-2 px-2 text-right text-gray-500 whitespace-nowrap">{score}</td>
                                          <td className="py-2 pl-6 text-gray-600 hidden sm:table-cell">{delegueDisplay}</td>
                                          <td className="py-2 pl-2 hidden sm:table-cell">
                                            {tiebreakLabel(s.tiebreakType) && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                                {tiebreakLabel(s.tiebreakType)}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                        {delegueDisplay && delegueDisplay !== '—' && (
                                          <tr className="sm:hidden bg-white">
                                            <td colSpan={4} className="pb-2 pt-0 pl-2 text-[10px] text-gray-500 italic">
                                              Délégué : {delegueDisplay}
                                              {tiebreakLabel(s.tiebreakType) && (
                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap not-italic">
                                                  {tiebreakLabel(s.tiebreakType)}
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  }) : (
                                    <tr>
                                      <td colSpan={6} className="py-3 text-center text-gray-400 text-xs">
                                        Aucune donnée syndicale disponible
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </details>
                        );
                      }) : (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          Aucun collège disponible pour cet établissement.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                /* Vue non-PRO : accordions par centre */
                <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                  {(getSortedAndGroupedData() as CenterGroup[]).map((group, idx) => {
                    const c = group.center;
                    return (
                      <details key={`${c.center_id}-${idx}`} className="group bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <summary className="cursor-pointer px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 lg:gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300">
                          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm lg:text-lg">
                              {c.center_name?.charAt(0) || 'C'}
                            </div>
                            <div>
                              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800">{c.center_name}</h3>
                              <p className="text-gray-600 text-xs sm:text-sm">Centre de vote</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                            <div className="bg-white rounded-md sm:rounded-lg lg:rounded-xl px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 border border-gray-200 shadow-sm text-center group-hover:shadow-md transition-shadow">
                              <div className="text-[8px] sm:text-[9px] lg:text-[11px] uppercase text-gray-500 font-medium mb-0.5 sm:mb-1">{electorsLabel}</div>
                              <div className="font-bold text-gray-800 text-xs sm:text-sm lg:text-lg">{typeof c.total_registered === 'number' ? c.total_registered.toLocaleString('fr-FR') : (c.total_registered || '-')}</div>
                            </div>
                            <div className="bg-white rounded-md sm:rounded-lg lg:rounded-xl px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 border border-gray-200 shadow-sm text-center group-hover:shadow-md transition-shadow">
                              <div className="text-[8px] sm:text-[9px] lg:text-[11px] uppercase text-gray-500 font-medium mb-0.5 sm:mb-1">Votants</div>
                              <div className="font-bold text-gray-800 text-xs sm:text-sm lg:text-lg">{typeof c.total_voters === 'number' ? c.total_voters.toLocaleString('fr-FR') : (c.total_voters || '-')}</div>
                            </div>
                            <div className="bg-white rounded-md sm:rounded-lg lg:rounded-xl px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 border border-gray-200 shadow-sm text-center group-hover:shadow-md transition-shadow">
                              <div className="text-[8px] sm:text-[9px] lg:text-[11px] uppercase text-gray-500 font-medium mb-0.5 sm:mb-1">Exprimés</div>
                              <div className="font-bold text-gray-800 text-xs sm:text-sm lg:text-lg">{typeof c.total_expressed_votes === 'number' ? c.total_expressed_votes.toLocaleString('fr-FR') : (c.total_expressed_votes || '-')}</div>
                            </div>
                            <div className="bg-white rounded-md sm:rounded-lg lg:rounded-xl px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 border border-gray-200 shadow-sm text-center group-hover:shadow-md transition-shadow">
                              <div className="text-[8px] sm:text-[9px] lg:text-[11px] uppercase text-gray-500 font-medium mb-0.5 sm:mb-1">Abstention</div>
                              <div className={`font-bold text-xs sm:text-sm lg:text-lg ${typeof c.participation_pct === 'number'
                                ? ((100 - c.participation_pct) >= 49.51
                                  ? 'text-red-600'
                                  : (((100 - c.participation_pct) > 20.5 && (100 - c.participation_pct) <= 49.5) ? 'text-yellow-600' : 'text-green-600'))
                                : 'text-green-600'}`}>
                                {typeof c.participation_pct === 'number' ? `${(100 - Math.min(Math.max(c.participation_pct, 0), 100)).toFixed(2)}%` : '-'}
                              </div>
                            </div>
                          </div>
                        </summary>
                        <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gray-50">
                          <div className="relative overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 -mx-4 sm:-mx-6 lg:-mx-8">
                            <table className="min-w-full min-w-[500px]">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 font-semibold text-gray-700 text-[10px] sm:text-xs lg:text-sm whitespace-nowrap">
                                    <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                                      <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                                      <span>Bureau</span>
                                    </div>
                                  </th>
                                  <th className="text-right px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 font-semibold text-gray-700 text-[10px] sm:text-xs lg:text-sm">
                                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
                                      <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                                      <span className="hidden sm:inline">{electorsLabel}</span>
                                      <span className="sm:hidden">Insc.</span>
                                    </div>
                                  </th>
                                  <th className="text-right px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 font-semibold text-gray-700 text-[10px] sm:text-xs lg:text-sm">
                                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
                                      <Vote className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                                      <span className="hidden sm:inline">Votants</span>
                                      <span className="sm:hidden">Vot.</span>
                                    </div>
                                  </th>
                                  <th className="text-right px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 font-semibold text-gray-700 text-[10px] sm:text-xs lg:text-sm">
                                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
                                      <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                                      <span className="hidden sm:inline">Exprimés</span>
                                      <span className="sm:hidden">Expr.</span>
                                    </div>
                                  </th>
                                  <th className="text-right px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 font-semibold text-gray-700 text-[10px] sm:text-xs lg:text-sm">
                                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
                                      <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                                      <span className="hidden sm:inline">Abstention</span>
                                      <span className="sm:hidden">Part.</span>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {group.bureaux.sort((a, b) => {
                                  const numA = parseInt(a.bureau_name?.match(/\d+/)?.[0] || '0');
                                  const numB = parseInt(b.bureau_name?.match(/\d+/)?.[0] || '0');
                                  return numA - numB;
                                }).map((b, i2) => (
                                  <tr key={i2} className={`transition-colors duration-200 ${(b as any).quorum_failed ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50'}`}>
                                    <td className="px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 text-[10px] sm:text-xs lg:text-sm whitespace-nowrap">
                                      <span className={`font-medium ${(b as any).quorum_failed ? 'text-red-700' : 'text-gray-800'}`}>{b.bureau_name}</span>
                                      {(b as any).quorum_failed && (
                                        <span className="ml-1.5 text-[9px] text-red-500 font-normal italic">quorum non atteint</span>
                                      )}
                                    </td>
                                    <td className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 text-right font-semibold text-[10px] sm:text-xs lg:text-sm ${(b as any).quorum_failed ? 'text-red-600' : 'text-gray-700'}`}>{typeof b.total_registered === 'number' ? b.total_registered.toLocaleString('fr-FR') : (b.total_registered ?? '-')}</td>
                                    <td className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 text-right font-semibold text-[10px] sm:text-xs lg:text-sm ${(b as any).quorum_failed ? 'text-red-600' : 'text-gray-700'}`}>{typeof b.total_voters === 'number' ? b.total_voters.toLocaleString('fr-FR') : (b.total_voters ?? '-')}</td>
                                    <td className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 text-right font-semibold text-[10px] sm:text-xs lg:text-sm ${(b as any).quorum_failed ? 'text-red-600' : 'text-gray-700'}`}>{typeof b.total_expressed_votes === 'number' ? b.total_expressed_votes.toLocaleString('fr-FR') : (b.total_expressed_votes ?? '-')}</td>
                                    <td className="px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 text-right">
                                      <span className={`px-1 sm:px-1.5 lg:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${(b as any).quorum_failed ? 'bg-red-100 text-red-700' :
                                        typeof b.participation_pct === 'number' && (100 - b.participation_pct) >= 49.51 ? 'bg-red-100 text-red-800' :
                                        typeof b.participation_pct === 'number' && ((100 - b.participation_pct) > 20.5 && (100 - b.participation_pct) <= 49.5) ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-green-100 text-green-800'
                                        }`}>
                                        {typeof b.participation_pct === 'number' ? `${(100 - Math.min(Math.max(b.participation_pct, 0), 100)).toFixed(2)}%` : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                                {group.bureaux.length === 0 && (
                                  <tr>
                                    <td className="px-2 sm:px-4 py-4 sm:py-6 lg:py-8 text-center text-gray-500 text-[10px] sm:text-xs lg:text-sm" colSpan={5}>
                                      <div className="flex flex-col items-center gap-1 sm:gap-2">
                                        <Target className="w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-gray-400" />
                                        <span>Aucun bureau disponible</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                  {(getSortedAndGroupedData() as CenterGroup[]).length === 0 && (
                    <div className="text-center text-gov-gray">Aucun centre à afficher.</div>
                  )}
                </div>
              )}
              </div>
            ) : (
            /* Message d'état vide quand pas de données */
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-blue-500" />
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">
                    Vue détaillée
                  </h2>
                </div>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-4 sm:mb-6 lg:mb-8 px-2 sm:px-4">
                  {isProResults
                    ? 'Explorez les résultats par établissement et par collège électoral'
                    : 'Explorez les résultats par centre de vote ou par bureau de vote'}
                </p>

                {/* Boutons de navigation - uniquement pour les élections non-pro */}
                {!isProResults && (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-4 bg-white rounded-full p-0.5 sm:p-1 lg:p-2 shadow-lg border border-gray-200 max-w-xs sm:max-w-sm lg:max-w-md mx-auto mb-6 sm:mb-8">
                    <button
                      onClick={() => setViewMode('center')}
                      className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-1 sm:gap-1.5 lg:gap-2 text-xs sm:text-sm ${viewMode === 'center'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Par centre</span>
                      <span className="sm:hidden">Centres</span>
                    </button>
                    <button
                      onClick={() => setViewMode('bureau')}
                      className={`px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-1 sm:gap-1.5 lg:gap-2 text-xs sm:text-sm ${viewMode === 'bureau'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Par bureau</span>
                      <span className="sm:hidden">Bureaux</span>
                    </button>
                  </div>
                )}

                {/* Message d'état vide */}
                <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 lg:p-12 max-w-xl sm:max-w-2xl mx-auto">
                  <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 mx-auto mb-3 sm:mb-4 lg:mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800 mb-2 sm:mb-3">
                      Données en cours de préparation
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm lg:text-base max-w-md mx-auto">
                      {isProResults
                        ? 'Les résultats par établissement et collège électoral seront affichés dès que les premiers procès-verbaux seront publiés.'
                        : 'Les données détaillées des centres et bureaux de vote ne sont pas encore disponibles. Elles seront affichées dès que les résultats seront publiés.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Section simulation — visible uniquement si activée ET non masquée pour la vue publique */}
        {showPublicResults && electionId && (() => {
          const simVisible  = localStorage.getItem(`sim_visible_${electionId}`) === 'true';
          const simHidden   = localStorage.getItem(`sim_public_hidden_${electionId}`) !== 'false';
          if (!simVisible || simHidden) return null;
          return (
            <section className="py-6 sm:py-8 bg-white">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <SimulationResultsSection electionId={electionId} />
              </div>
            </section>
          );
        })()}

        {/* Section de navigation vers autre élection */}
        {showPublicResults && getAlternativeElection() && (
          <section className="py-6 sm:py-8 lg:py-12 bg-gray-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                    Autres élections disponibles
                  </h2>
                </div>
                <p className="text-gray-600 text-sm sm:text-base">
                  Consultez les résultats des autres élections
                </p>
              </div>
              
              <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
                <div className="flex gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 w-full justify-center">
                  {availableElections
                    .filter(election => election.id !== electionId)
                    .sort((a, b) => new Date(b.election_date).getTime() - new Date(a.election_date).getTime())
                    .map((election) => {
                    const title = election.title?.toLowerCase() || '';
                    const description = election.description?.toLowerCase() || '';
                    const localisation = election.localisation?.toLowerCase() || '';
                    
                    const isLocal = ['locale', 'locales', 'local', 'municipale', 'municipales'].some(keyword =>
                      title.includes(keyword) || description.includes(keyword) || localisation.includes(keyword)
                    );
                    
                    const isLegislative = ['législative', 'législatives', 'legislative'].some(keyword =>
                      title.includes(keyword) || description.includes(keyword) || localisation.includes(keyword)
                    );
                    
                    const bgColor = isLocal ? 'bg-[#116917]' : isLegislative ? 'bg-[#A51C30]' : 'bg-blue-600';
                    const borderColor = isLocal ? 'border-[#116917]' : isLegislative ? 'border-[#A51C30]' : 'border-blue-600';
                    const hoverBgColor = isLocal ? 'hover:bg-[#116917]' : isLegislative ? 'hover:bg-[#A51C30]' : 'hover:bg-blue-600';
                    const hoverBorderColor = isLocal ? 'hover:border-[#116917]' : isLegislative ? 'hover:border-[#A51C30]' : 'hover:border-blue-600';
                    
                    const typeLabel = isLocal ? 'Élections Locales' : isLegislative ? 'Élections Législatives' : 'Élection';
                    const typeDescription = isLocal ? 'Élection des conseils municipaux' : isLegislative ? 'Élection des députés' : 'Élection générale';
                    
                    return (
                      <div
                        key={election.id}
                        className={`bg-white rounded-lg border-2 ${borderColor} ${hoverBorderColor} p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 flex-shrink-0 w-64 sm:w-72`}
                        onClick={() => handleElectionSwitch(election.id)}
                      >
                        <div className="text-center">
                          <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${bgColor}`}>
                            <Vote className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1 sm:mb-2 leading-tight">
                            {election.title}
                          </h3>
                          {election.localisation && (
                            <p className="text-xs text-gray-500 mb-3 sm:mb-4">
                              {election.localisation}
                            </p>
                          )}
                          <Button
                            className={`w-full text-white font-semibold py-2 sm:py-3 px-3 sm:px-4 rounded-lg transition-all duration-300 ${bgColor} ${hoverBgColor}`}
                            size="sm"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs sm:text-sm">Voir les résultats</span>
                              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                            </div>
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                </div>
              </div>
              
              {availableElections.filter(election => election.id !== electionId).length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Vote className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Aucune autre élection disponible</h3>
                  <p className="text-gray-600 text-sm">Cette élection est la seule disponible pour le moment.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer modernisé */}
        <footer id="contact" className="border-t bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 mt-8 sm:mt-12 lg:mt-16 xl:mt-20 text-white relative overflow-hidden">
          {/* Fond décoratif */}
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-10 pb-3 sm:pb-4 lg:pb-6 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-around gap-4 sm:gap-6 lg:gap-8">
              {/* Colonne gauche: logo + description */}
              <div className="order-1 max-w-xs sm:max-w-sm">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                  <Link to="/" className="w-6 h-6 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-white rounded-full flex items-center justify-center overflow-hidden">
                    <img src="/favicon.ico" alt="Logo iKADI" className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 object-contain" />
                  </Link>
                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base lg:text-lg">o'Hitu</h3>
                  </div>
                </div >
                <p className="text-white/80 text-[10px] sm:text-xs lg:text-sm leading-relaxed">Plateforme de gestion du processus électoral alliant accessibilité, sécurité et transparence.</p>
              </div >

              {/* Ressources */}
              < div className="order-3 lg:order-2 text-[10px] sm:text-xs lg:text-sm text-white/90 max-w-xs sm:max-w-sm w-full" >
                <h4 className="font-semibold text-white mb-1.5 sm:mb-2 lg:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                  Ressources
                </h4>
                <ul className="space-y-0.5 sm:space-y-1 lg:space-y-2">
                  <li><a href="#candidats" className="hover:opacity-80 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Candidats</a></li>
                  <li><a href="#analyse" className="hover:opacity-80 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs"><Building className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Centres / Bureaux</a></li>
                  <li><a href="#statistiques" className="hover:opacity-80 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs"><BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Résultats globaux</a></li>
                </ul>
              </div >

              {/* Partage */}
              < div className="order-2 lg:order-3 text-[10px] sm:text-xs lg:text-sm text-white/90 lg:justify-self-end max-w-xs sm:max-w-sm" >
                <h4 className="font-semibold text-white mb-1.5 sm:mb-2 lg:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                  Partager
                </h4>
                <div className="flex flex-row flex-wrap gap-2 sm:gap-3 lg:gap-4 items-center">
                  <button aria-label="Partager sur WhatsApp" onClick={() => handleShare('whatsapp')} className="p-1.5 sm:p-2 bg-white/10 rounded hover:bg-white/20 transition-colors" title="WhatsApp">
                    <WhatsAppIcon width={20} height={20} className="sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
                  </button>
                  <button aria-label="Partager sur Facebook" onClick={() => handleShare('facebook')} className="p-1.5 sm:p-2 bg-white/10 rounded hover:bg-white/20 transition-colors" title="Facebook">
                    <Facebook className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
                  </button>
                  <button aria-label="Copier le lien" onClick={() => handleShare('copy')} className="p-1.5 sm:p-2 bg-white/10 rounded hover:bg-white/20 transition-colors" title="Copier le lien">
                    <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
                  </button>
                </div>
              </div >
            </div >

            {/* Copyright + liens légaux */}
            <div className="mt-6 sm:mt-8 lg:mt-12 text-center space-y-1.5">
              <div className="font-semibold text-[10px] sm:text-xs lg:text-sm">
                © {new Date(results.last_updated).getFullYear()} o'Hitu. Tous droits réservés.
              </div>
              <div className="flex items-center justify-center gap-3 text-[10px] sm:text-xs text-white/70">
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white underline underline-offset-2 transition-colors"
                >
                  Politique de confidentialité
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Chatbot flottant */}
      <FloatingChatbot />
    </>
  );
};

export default ElectionResults;
