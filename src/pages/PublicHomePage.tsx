
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, TrendingUp, RefreshCw, Flag, Landmark, Megaphone, Facebook, Link as LinkIcon, Menu, X, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchPublicElections, fetchRunningElection, fetchPublishedElection, fetchLatestElection } from '../api/elections';
import { isElectionVisibleOnPublic } from '@/utils/electionVisibility';
import { fetchGlobalMetrics } from '../api/metrics';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';
import FloatingChatbot from '@/components/FloatingChatbot';

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
  cover_image_url?: string;
}

interface CandidateResult {
  id: string;
  name: string;
  party: string;
  votes: number;
  percentage: number;
  color: string;
}

interface PublicResults {
  election: ElectionData | null;
  participation: number;
  resultsProgress: number;
  candidates: CandidateResult[];
  totalVoters: number;
  totalCenters: number;
}

const HERO_IMAGE = 'https://www.vaticannews.va/content/dam/vaticannews/agenzie/images/afp/2024/08/30/17/1725030898403.jpg/_jcr_content/renditions/cq5dam.thumbnail.cropped.1500.844.jpeg';

const fallbackImages = [
  HERO_IMAGE,
  '/placeholder.svg',
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1200&auto=format&fit=crop', // urne
  'https://images.unsplash.com/photo-1570498839593-e565b39455fc?q=80&w=1200&auto=format&fit=crop', // foule
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1200&auto=format&fit=crop'  // mains
];

const PublicHomePage = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const navigate = useNavigate();
  const [results, setResults] = useState<PublicResults>({
    election: null,
    participation: 0,
    resultsProgress: 0,
    candidates: [],
    totalVoters: 0,
    totalCenters: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalBureaux, setTotalBureaux] = useState<number>(0);
  const [totalCandidats, setTotalCandidats] = useState<number>(0);
  const [distinctParties, setDistinctParties] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Prochaine élection pour le compte à rebours
  const [nextElection, setNextElection] = useState<ElectionData | null>(null);
  // Toutes les élections (pour la bibliothèque)
  const [allElections, setAllElections] = useState<ElectionData[]>([]);

  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const [heroOk, setHeroOk] = useState<boolean>(true);
  const [resultsMenuOpen, setResultsMenuOpen] = useState(false);
  const [footerResultsOpen, setFooterResultsOpen] = useState(false);

  const isCountdownZero = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  const candidateColors = [
    "#1e40af",
    "#dc2626",
    "#16a34a",
    "#7c3aed",
    "#ea580c",
    "#0891b2",
    "#be123c",
    "#65a30d",
  ];

  useEffect(() => {
    fetchPublicResults();
  }, []);

  // Tick basé sur la prochaine élection
  useEffect(() => {
    const targetDate = nextElection ? new Date(nextElection.election_date).getTime() : null;
    if (!targetDate) return;
    const tick = () => {
      const now = Date.now();
      const delta = Math.max(targetDate - now, 0);
      const days = Math.floor(delta / (1000 * 60 * 60 * 24));
      const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((delta % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextElection]);

  useEffect(() => {
    const img = new Image();
    img.src = HERO_IMAGE;
    img.onload = () => setHeroOk(true);
    img.onerror = () => setHeroOk(false);
  }, []);

  const fetchPublicResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prochaine élection (client: plus proche >= aujourd'hui, sinon plus récente passée)
      try {
        const all = await fetchPublicElections();
        setAllElections(all as any);
        if (all && all.length > 0) {
          const now = new Date();
          const filtered = all.filter((e: any) => {
            if (!isElectionVisibleOnPublic(e)) return false;
            const s = String(e.status || '').toLowerCase();
            return !(s === 'terminée' || s === 'terminee' || s === 'terminé' || s === 'termine' || s === 'terminer' || s === 'fini');
          });
          const withDates = filtered.map((e: any) => ({ ...e, _date: new Date(e.election_date) }));
          const next = withDates.find((e: any) => e._date.getTime() >= new Date(now.setHours(0, 0, 0, 0)).getTime()) || withDates[withDates.length - 1];
          setNextElection(next as any);
          setAllElections(filtered as any);

        } else {
          setNextElection(null);
        }
      } catch (e) { }

      // 1) Priorité: élection "En cours"
      let currentElection: any = null;
      try {
        currentElection = await fetchRunningElection();
      } catch { }

      // 2) Fallback: dernière publiée
      if (!currentElection) {
        try {
          currentElection = await fetchPublishedElection();
        } catch { }
      }

      // 3) Fallback ultime: dernière par date
      if (!currentElection) {
        try {
          currentElection = await fetchLatestElection();
        } catch { }
      }

      if (!currentElection) {
        setResults(prev => ({ ...prev, election: null }));
        setLoading(false);
        return;
      }

      const metrics = await fetchGlobalMetrics();
      const totalVoters = metrics.totalVoters;
      const totalCenters = metrics.totalCenters;
      const totalPVs = metrics.totalPVs;
      setTotalBureaux(metrics.totalBureaux);
      setTotalCandidats(metrics.totalCandidats);
      setDistinctParties(metrics.distinctParties);

      const { data: notificationsList } = await supabase
        .from('notifications')
        .select('title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      const ticker = (notificationsList || []).map((n: any) => n.title || n.message).filter(Boolean);

      setAnnouncements(ticker.length > 0 ? ticker : ['Aucune annonce disponible pour le moment']);

      const participation = totalCenters > 0 ? Math.min((totalPVs / totalCenters) * 100, 100) : 0;
      const resultsProgress = totalCenters > 0 ? Math.min((totalPVs / totalCenters) * 100, 100) : 0;

      const { data: candidatesAgg } = await supabase
          .from('election_candidates')
          .select(`
            candidates(id, name, party),
            candidate_results(votes)
          `)
        .eq('election_id', currentElection.id);

        let processed: CandidateResult[] = [];
      if (candidatesAgg) {
        let totalVotes = 0;
        candidatesAgg.forEach((item: any) => {
          if (item.candidate_results && item.candidate_results.length > 0) {
            totalVotes += item.candidate_results.reduce((sum: number, r: any) => sum + (r.votes || 0), 0);
          }
        });
        candidatesAgg.forEach((item: any, index: number) => {
          if (item.candidates) {
            const candidateVotes = item.candidate_results 
              ? item.candidate_results.reduce((sum: number, r: any) => sum + (r.votes || 0), 0)
              : 0;
            processed.push({
              id: item.candidates.id,
              name: item.candidates.name,
              party: item.candidates.party || 'Indépendant',
              votes: candidateVotes,
              percentage: totalVotes > 0 ? (candidateVotes / totalVotes) * 100 : 0,
              color: candidateColors[index % candidateColors.length]
            });
          }
        });
        processed.sort((a, b) => b.votes - a.votes);
      }

      setResults({
        election: currentElection,
        participation: Math.round(participation * 10) / 10,
        resultsProgress: Math.round(resultsProgress * 10) / 10,
        candidates: processed,
        totalVoters,
        totalCenters
      });

    } catch (err) {
      setError('Impossible de charger les résultats. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const electionTitle = 'Élections - Transparence et Sécurité';
  const dynamicTitle = electionTitle;
  const canSeeResults = results.election ? Date.now() >= new Date(results.election.election_date).getTime() : false;

  // Helpers pour la bibliothèque
  const getBgForIndex = (i: number) => ({
    backgroundImage: `url(https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(String(i))}&backgroundType=gradientLinear&randomizeIds=true)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  });

  const nowDate = new Date();
  const electionsWithDates = allElections.map((e) => ({ ...e, _date: new Date(e.election_date) }));
  const statusOf = (e: any) => String(e.status || '').toLowerCase();
  const isFinishedStatus = (s: string) => s === 'terminée' || s === 'terminee' || s === 'terminé' || s === 'termine' || s === 'terminer' || s === 'fini';
  const pastElections = electionsWithDates.filter(e => {
    const s = statusOf(e);
    return s === 'passé' || s === 'passe' || s === 'passée' || s === 'passer' || isFinishedStatus(s);
  });
  const upcomingElections = electionsWithDates.filter(e => {
    const s = statusOf(e);
    return s === 'a venir' || s === 'à venir' || s === 'avenir' || s === 'a-venir';
  });
  const currentElections = electionsWithDates.filter(e => statusOf(e) === 'en cours');
  const finishedElections = electionsWithDates.filter(e => isFinishedStatus(statusOf(e)));
  const latestFinishedTitle = finishedElections.length > 0 ? finishedElections[finishedElections.length - 1].title : 'Résultats';

  // Tabs bibliothèque
  const [libraryTab, setLibraryTab] = useState<'past' | 'current' | 'upcoming'>('current');

  const selectedLibrary = libraryTab === 'past' ? pastElections : libraryTab === 'current' ? currentElections : upcomingElections;

  // SEO Data structuré pour la page d'accueil
  const homePageStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "o'Hitu",
    "description": "o'Hitu - République Gabonaise",
    "url": "https://www.ohitu.com/",
    "publisher": {
      "@type": "GovernmentOrganization",
      "name": "République Gabonaise",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "GA",
        "addressLocality": "Libreville"
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.ohitu.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <SEOHead
        title={dynamicTitle}
        description={`Suivez ${dynamicTitle} en temps réel avec o'Hitu. Transparence et sécurité du processus démocratique gabonais.`}
        keywords={`${dynamicTitle}, élections Gabon, résultats électoraux, ${results.election?.election_date ? new Date(results.election.election_date).getFullYear() : '2024'}, démocratie, transparence`}
        structuredData={homePageStructuredData}
      />
    <div className="min-h-screen bg-white">
      {/* Header bleu plateforme avec texte blanc */}
        <header className="border-b bg-gov-blue text-white" role="banner">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden" aria-label="Aller à l'accueil">
                <img src="/favicon.ico" alt="Logo iKADI" className="w-8 h-8 object-contain" />
              </Link>
              <div>
                <h1 className="text-white font-bold text-2xl">o'Hitu</h1>
              </div>
            </div>
              <nav className="hidden md:flex items-center space-x-6" role="navigation" aria-label="Menu principal">
                <Link to="/" className="hover:text-blue-200 transition-colors" aria-label="Accueil">Accueil</Link>
                {/* <a href="#about" className="hover:text-blue-200 transition-colors" aria-label="En savoir plus sur o'Hitu">A propos</a>
                <a href="#infos" className="hover:text-blue-200 transition-colors" aria-label="Informations électorales">Infos électorales</a>
                <a href="#candidats" className="hover:text-blue-200 transition-colors" aria-label="Voir les candidats">Candidats</a> */}
                <div className="relative" onMouseEnter={() => setResultsMenuOpen(true)} onMouseLeave={() => setResultsMenuOpen(false)}>
                  <button className="hover:text-blue-200 transition-colors" aria-haspopup="true" aria-expanded={resultsMenuOpen} onClick={() => setResultsMenuOpen(v=>!v)}>Résultats</button>
                  {resultsMenuOpen && (loading || finishedElections.length > 0) && (
                  <div className="absolute left-0 right-auto mt-2 bg-white rounded shadow-lg border min-w-[260px] z-50 py-2 text-left">
                    <div className="px-3 pb-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Élections terminées</div>
                    {loading && (
                      <div className="px-3 py-2 text-sm text-gray-700">Chargement…</div>
                    )}
                    {!loading && finishedElections.length > 0 && (
                      <div className="max-h-40 overflow-y-auto">
                        {finishedElections.map(e => (
                          <button
                            key={e.id}
                            className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm text-gray-800"
                            onClick={() => navigate(`/election/${(e as any).slug ?? e.id}/results`)}
                          >
                            {e.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
                {/* <a href="#circonscriptions" className="hover:underline" aria-label="Circonscriptions et bureaux de vote">Circonscriptions / Bureaux</a>
                <a href="#contact" className="hover:underline" aria-label="Nous contacter">Contact</a> */}
            </nav>
              <button className="md:hidden p-2 rounded hover:bg-white/10" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(v => !v)}>
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
            {mobileOpen && (
              <div className="mt-3 md:hidden border-t border-white/10 pt-3 space-y-2">
                {[
                  { href: '/', label: 'Accueil' },
                  { href: '#about', label: 'A propos' },
                  { href: '#infos', label: 'Infos électorales' },
                  { href: '#candidats', label: 'Candidats' },
                  { href: '#resultats', label: 'Résultats' },
                  { href: '#circonscriptions', label: 'Circonscriptions / Bureaux' },
                  { href: '#contact', label: 'Contact' },
                ].map(link => (
                  link.href === '/' ? (
                    <Link key={link.label} to="/" className="block px-2 py-2 rounded hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </Link>
                  ) : (
                    <a key={link.label} href={link.href} className="block px-2 py-2 rounded hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </a>
                  )
                ))}
          </div>
            )}
        </div>
      </header>

      {/* Hero Section (sans animation) */}
      <section
          className="relative min-h-[380px] md:min-h-[460px] pb-10"
        style={{
          backgroundImage: results.election?.cover_image_url 
            ? `url(${results.election.cover_image_url})`
            : (nextElection?.cover_image_url 
                ? `url(${nextElection.cover_image_url})`
                : (heroOk ? `url(${HERO_IMAGE})` : `linear-gradient(135deg, hsl(var(--gov-blue)) 0%, hsl(var(--gov-blue-light)) 100%)`)),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: (results.election?.cover_image_url || nextElection?.cover_image_url || heroOk) ? 'fixed' : 'scroll'
        }}


          aria-label="Section principale"
      >
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.45)]" aria-hidden="true" />
        <div className="container mx-auto px-4 py-16 mb-20 md:py-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="text-white animate-[fadeIn_0.6s_ease-out]">
              <p className="font-semibold tracking-wide text-blue-100">Commission Locale</p>
              <h2 className="text-4xl md:text-5xl font-bold mt-3">
                {dynamicTitle}
              </h2>
              <p className="mt-5 max-w-2xl text-blue-100 text-lg">
                Suivez les résultats des élections en direct avec transparence et sécurité. Inspiré par les meilleures pratiques de communication électorale.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                  <Link to="/login" aria-label="Accéder à l'interface d'administration">
                  <Button className="bg-gov-blue text-white hover:bg-gov-blue/90">
                    Accès admin
              </Button>
            </Link>
          </div>
        </div>
          </div>
        </div>
      </section>

      {/* Bande statique style Ghana: stations, partis, électeurs — déplacée hors de la hero */}
      <section className="w-full bg-slate-200 text-gov-dark">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-around gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-lg"><Landmark className="w-8 h-8 text-gov-blue" /></div>
              <div>
                <div className="text-2xl md:text-3xl font-bold">{totalBureaux.toLocaleString()}</div>
                <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Bureaux de vote</div>
              </div>
          </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-lg"><Flag className="w-8 h-8 text-gov-blue" /></div>
              <div>
                <div className="text-2xl md:text-3xl font-bold">{distinctParties.toLocaleString()}</div>
                <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Partis politiques</div>
          </div>
                </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-lg"><Users className="w-8 h-8 text-gov-blue" /></div>
              <div>
                <div className="text-2xl md:text-3xl font-bold">{results.totalVoters.toLocaleString()}</div>
                <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Électeurs inscrits</div>
                </div>
                </div>
                </div>
          </div>
      </section>

      {/* Ticker d'annonces (rouge) */}
        {/* <section className="bg-slate-300">
        <div className="container mx-auto px-4 py-3">
          <div className="bg-white rounded-sm shadow-sm border">
            <div className="flex items-stretch">
              <div className="px-4 py-2 bg-red-600 text-white text-[11px] md:text-xs lg:text-sm font-semibold uppercase tracking-wide flex items-center gap-2"><Megaphone className="w-4 h-4" /> Dernière annonce</div>
              <div className="overflow-hidden whitespace-nowrap flex-1">
                <div className="inline-block py-2 text-xs md:text-sm text-gov-dark" style={{ animation: 'marquee 30s linear infinite' }}>
                  {announcements.map((a, idx) => (
                    <span key={idx} className="mx-6 opacity-95">
                      {idx > 0 && <span className="mx-4 align-middle text-gray-400">•</span>}
                      {a}
                    </span>
                  ))}
                        </div>
                        </div>
                      </div>
                      </div>
        </div>
        <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </section> */}

      {/* Section compte à rebours type bannière verte */}
        <section className="bg-gov-blue text-white mt-20">
        <div className="container mx-auto px-4 py-16">
          <h3 className="text-center text-2xl md:text-3xl font-semibold tracking-wide">Résultats en temps réel</h3>
          <p className="text-center text-white/90 mt-2 max-w-3xl mx-auto">Suivez les résultats des élections en direct avec transparence et sécurité.</p>
          {nextElection && (
              <>
            <p className="text-center text-white/90 mt-1">Publication à venir: <span className="font-bold">{nextElection.title}</span></p>
                <p className="text-center text-white/80 mt-1">Date prévue: <strong>{new Date(nextElection.election_date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>
              </>
          )}
          {!nextElection && (
            <p className="text-center text-white/80 mt-1">Aucune élection programmée</p>
          )}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              {[{ label: 'Jours', value: timeLeft.days }, { label: 'Heures', value: timeLeft.hours }, { label: 'Minutes', value: timeLeft.minutes }, { label: 'Secondes', value: timeLeft.seconds }].map((t) => (
                <div key={t.label} className="text-center min-w-[64px] md:min-w-[80px]">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold leading-none">{String(t.value).padStart(2, '0')}</div>
                  <div className="mt-1 text-[10px] sm:text-[11px] md:text-xs uppercase tracking-wide border-t border-white/40 pt-1 opacity-90">{t.label}</div>
                    </div>
                  ))}
                </div>
            {isCountdownZero && (
          <div className="mt-8 text-center">
                {/* <Button
                  className="bg-white text-gov-blue hover:bg-blue-50"
                  aria-label="Voir les résultats"
                  onClick={() => nextElection && navigate(`/election/${(nextElection as any).slug ?? nextElection.id}/results`)}
                >
              Voir les résultats
                </Button> */}
                </div>
              )}
        </div>
      </section>

        {/* Section “Bibliothèque des élections” (avec Tabs + scroll) */}
        <section className="bg-slate-200 mt-20">
          <div className="container mx-auto px-4 py-16">
            <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 flex-wrap">
              <button
                className={`px-3 sm:px-4 py-2 rounded text-sm md:text-base ${libraryTab === 'past' ? 'bg-gov-blue text-white' : 'bg-white text-gov-dark'}`}
                onClick={() => setLibraryTab('past')}
                aria-pressed={libraryTab === 'past'}
              >
                Élections passées
              </button>
              <button
                className={`px-3 sm:px-4 py-2 rounded text-sm md:text-base ${libraryTab === 'current' ? 'bg-gov-blue text-white' : 'bg-white text-gov-dark'}`}
                onClick={() => setLibraryTab('current')}
                aria-pressed={libraryTab === 'current'}
              >
                En cours
              </button>
              <button
                className={`px-3 sm:px-4 py-2 rounded text-sm md:text-base ${libraryTab === 'upcoming' ? 'bg-gov-blue text-white' : 'bg-white text-gov-dark'}`}
                onClick={() => setLibraryTab('upcoming')}
                aria-pressed={libraryTab === 'upcoming'}
              >
                Élections à venir
              </button>
                </div>
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedLibrary.map((e, idx) => (
                  <div
                    key={e.id}
                    className="relative rounded-lg overflow-hidden border shadow-sm min-h-[140px] md:min-h-[160px] transform transition-transform duration-200 motion-safe:md:hover:scale-[1.03] cursor-pointer"
                    style={{
                      backgroundImage: (e as any).cover_image_url ? `url(${(e as any).cover_image_url})` : getBgForIndex(idx).backgroundImage,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}


                    onClick={() => navigate(`/election/${(e as any).slug ?? e.id}/results`)}
                  >
                    <div className="absolute inset-0 bg-black/35 hover:bg-black/25 transition-colors" />
                    <div className="relative p-4 text-white">
                      <div className="text-xs sm:text-sm opacity-90">{new Date(e.election_date).getFullYear()}</div>
                      <div className="font-semibold line-clamp-2 text-sm sm:text-base">{e.title}</div>
                </div>
              </div>
                )).slice(0, 100)}
                {selectedLibrary.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <div className="text-6xl mb-4">🗳️</div>
                    <h3 className="text-xl font-semibold text-gov-dark mb-2">Aucune élection disponible</h3>
                    <p className="text-gov-gray">Aucune élection {libraryTab === 'past' ? 'passée' : libraryTab === 'current' ? 'en cours' : 'à venir'} à afficher pour le moment.</p>
                </div>
                )}
                </div>
              </div>
        </div>
      </section>

      {/* Footer bleu plateforme avec texte blanc */}
        <footer id="contact" className="border-t bg-gov-blue mt-20 text-white">
        <div className="container mx-auto px-4 pt-10 pb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-around gap-8">
            {/* Colonne gauche: logo + description */}
            <div className="order-1 max-w-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center overflow-hidden">
                  <img src="/favicon.ico" alt="Logo iKADI" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">o'Hitu</h3>
                </div>
              </div>
              <p className="text-white/80 text-sm">Plateforme de gestion du processus électoral alliant accessibilité, sécurité et transparence.</p>
            </div>
            
            {/* Ressources au milieu (non centré) */}
                <div className="order-3 md:order-2 text-sm text-white/90 max-w-sm w-full text-left">
              <h4 className="font-semibold text-white mb-2">Ressources</h4>
              <ul className="space-y-1">
                  {/* <li><a href="#candidats" className="hover:opacity-80">Candidats</a></li>
                  <li><a href="#circonscriptions" className="hover:opacity-80">Circonscriptions / Bureaux</a></li> */}
                  <li>
                    <div className="relative" onMouseEnter={() => setFooterResultsOpen(true)} onMouseLeave={() => setFooterResultsOpen(false)}>
                      <button className="hover:opacity-80">{latestFinishedTitle}</button>
                      {footerResultsOpen && finishedElections.length > 0 && (
                        <div className="absolute left-0 right-auto mt-2 bg-white text-gov-dark rounded shadow-lg border min-w-[260px] z-50 py-2 max-h-[96px] overflow-y-auto text-left">
                          {finishedElections.map(e => (
                            <button key={e.id} className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm" onClick={() => navigate(`/election/${(e as any).slug ?? e.id}/results`)}>
                              {e.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
              </ul>
            </div>
            
            {/* Partage à droite (ligne) */}
            <div className="order-2 md:order-3 text-sm text-white/90 md:justify-self-end max-w-sm">
              <h4 className="font-semibold text-white mb-2">Partager</h4>
              <div className="flex flex-row flex-wrap gap-4 items-center">
                <a
                  aria-label="Partager sur WhatsApp"
                  href={`https://wa.me/?text=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white/10 rounded hover:bg-white/20"
                  title="WhatsApp"
                >
                  <WhatsAppIcon width={28} height={28} />
                </a>
                <a
                  aria-label="Partager sur Facebook"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white/10 rounded hover:bg-white/20"
                  title="Facebook"
                >
                  <Facebook className="w-7 h-7" />
                </a>
                <button
                  aria-label="Copier le lien"
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    navigator.clipboard?.writeText(url).then(() => {
                      toast.success('Lien copié dans le presse-papiers');
                    });
                  }}
                  className="p-2 bg-white/10 rounded hover:bg-white/20"
                  title="Copier le lien"
                >
                  <LinkIcon className="w-7 h-7" />
                </button>
            </div>
          </div>
          </div>

          {/* Copyright + liens légaux */}
          <div className="mt-12 text-center space-y-1.5">
            <div className="font-semibold text-sm">© {new Date().getFullYear()} o'Hitu. Tous droits réservés.</div>
            <div className="flex items-center justify-center gap-3 text-xs text-white/70">
              <button
                onClick={() => setPrivacyOpen(true)}
                className="hover:text-white underline underline-offset-2 transition-colors"
              >
                Politique de confidentialité
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>

    {/* Modal Politique de confidentialité */}
    <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gov-blue" />
            Politique de confidentialité
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 text-center text-gray-500 text-sm">
          <div className="w-12 h-12 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-gov-blue" />
          </div>
          <p className="font-medium text-gray-700 mb-2">Contenu à venir</p>
          <p className="text-xs text-gray-400">
            La politique de confidentialité de la plateforme o'Hitu sera publiée prochainement.
          </p>
        </div>
      </DialogContent>
    </Dialog>

    {/* Chatbot flottant */}
    <FloatingChatbot />
    </>
  );
};

export default PublicHomePage;
