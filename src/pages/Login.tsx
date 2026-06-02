
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import type { UserRole } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Vote, ArrowRight, Shield, CheckCircle, Users, AlertCircle, Clock, Lock } from 'lucide-react';
import { fetchPublicElections } from '../api/elections';
import NetworkIndicator from '@/components/NetworkIndicator';
import { isProfessionalElection } from '@/utils/electionCalculations';
import FloatingChatbot from '@/components/FloatingChatbot';

interface Election {
  id: string;
  title: string;
  election_date: string;
  status: string;
  type?: string;
  description?: string;
  localisation?: string;
  nb_electeurs?: number;
  is_published?: boolean;
}

function getElectionCardStyle(election: Election) {
  const title = election.title?.toLowerCase() || '';
  const description = election.description?.toLowerCase() || '';
  const localisation = election.localisation?.toLowerCase() || '';

  const isLocal = ['locale', 'locales', 'local', 'municipale', 'municipales'].some(
    (keyword) =>
      title.includes(keyword) || description.includes(keyword) || localisation.includes(keyword)
  );

  const isLegislative = ['législative', 'législatives', 'legislative'].some(
    (keyword) =>
      title.includes(keyword) || description.includes(keyword) || localisation.includes(keyword)
  );

  const isProfessional =
    isProfessionalElection(election.type) ||
    ['professionnelle', 'professionnel', 'syndicat', 'seeg'].some(
      (keyword) =>
        title.includes(keyword) || description.includes(keyword) || localisation.includes(keyword)
    );

  if (isLocal) {
    return {
      bg: 'bg-[#116917]',
      border: 'border-[#116917]',
      hoverBg: 'hover:bg-[#116917]',
      hoverBorder: 'hover:border-[#116917]',
    };
  }
  if (isLegislative) {
    return {
      bg: 'bg-[#A51C30]',
      border: 'border-[#A51C30]',
      hoverBg: 'hover:bg-[#A51C30]',
      hoverBorder: 'hover:border-[#A51C30]',
    };
  }
  if (isProfessional) {
    return {
      bg: 'bg-emerald-600',
      border: 'border-emerald-500',
      hoverBg: 'hover:bg-emerald-500',
      hoverBorder: 'hover:border-emerald-400',
    };
  }
  return {
    bg: 'bg-blue-600',
    border: 'border-blue-600',
    hoverBg: 'hover:bg-blue-600',
    hoverBorder: 'hover:border-blue-600',
  };
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<{ type: 'credentials' | 'disabled' | 'pending' | 'generic'; message: string } | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const OPERATIONAL_ROLES: UserRole[] = ['agent-saisie', 'validateur', 'observateur', 'president-bureau'];

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Si déjà connecté, rediriger
  React.useEffect(() => {
    if (user) {
      navigate(OPERATIONAL_ROLES.includes(user.role) ? '/results' : '/dashboard', { replace: true });
    }
  }, [user]);

  // Charger les élections depuis la base de données
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setElectionsLoading(true);
        const electionsData = await fetchPublicElections();
        setElections(electionsData || []);
        console.log('Élections chargées:', electionsData); // Debug pour voir les élections disponibles
      } catch (error) {
        console.error('Erreur lors du chargement des élections:', error);
      } finally {
        setElectionsLoading(false);
      }
    };

    fetchElections();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setLoginError({ type: 'credentials', message: 'Email ou mot de passe incorrect.' });
      }
      // Si success : la redirection est gérée par le useEffect qui surveille `user`
    } catch (error: any) {
      if (error?.message === 'EMAIL_NOT_CONFIRMED') {
        setLoginError({
          type: 'pending',
          message: 'Votre compte est en attente de confirmation. Veuillez patienter l\'activation par votre administrateur.',
        });
      } else if (error?.message === 'ACCOUNT_DISABLED') {
        setLoginError({
          type: 'disabled',
          message: 'Votre compte a été désactivé. Veuillez contacter votre administrateur pour le réactiver.',
        });
      } else {
        setLoginError({ type: 'generic', message: 'Une erreur s\'est produite. Vérifiez votre connexion et réessayez.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">
      {/* Indicateur de réseau flottant en haut à droite */}
      <div className="absolute top-4 right-4 z-50">
        <NetworkIndicator />
      </div>
      
      {/* Section gauche - Fond bleu avec sélection d'élection */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gov-blue via-blue-700 to-gov-blue-dark flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Logo */}
        <div className="absolute top-6 lg:top-8 left-6 lg:left-8">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
              <img src="/favicon.ico" alt="Logo iKADI" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl lg:text-2xl">o'Hitu</h1>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col items-center justify-center text-center text-white max-w-lg px-4 pt-16">
          {/* Titre principal */}
          <div className="mb-6 lg:mb-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 lg:mb-4 text-white whitespace-nowrap">
              Expérimentez autrement une{' '}
              <span className="text-green-400">élection</span>
            </h2>
            <p className="text-blue-100 text-base lg:text-lg leading-relaxed">
              Sélectionnez une élection pour accéder aux résultats publiés.
            </p>
          </div>

           {/* Boutons de sélection d'élection - Dynamiques */}
           <div className="w-full max-w-md">
             {electionsLoading ? (
               <div className="space-y-3 lg:space-y-4">
                 <div className="w-full p-4 lg:p-6 rounded-xl border-2 bg-gray-600 animate-pulse">
                   <div className="flex items-center justify-between">
                     <div className="text-left">
                       <div className="h-5 bg-gray-500 rounded mb-2 w-32"></div>
                       <div className="h-4 bg-gray-500 rounded w-24"></div>
                     </div>
                   </div>
                 </div>
                 <div className="w-full p-4 lg:p-6 rounded-xl border-2 bg-gray-600 animate-pulse">
                   <div className="flex items-center justify-between">
                     <div className="text-left">
                       <div className="h-5 bg-gray-500 rounded mb-2 w-32"></div>
                       <div className="h-4 bg-gray-500 rounded w-24"></div>
                     </div>
                   </div>
                 </div>
               </div>
             ) : elections.length === 0 ? (
               <div className="text-center py-8">
                 <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                   <Vote className="w-8 h-8 text-white/60" />
                 </div>
                 <h3 className="text-white font-semibold mb-2">Aucune élection disponible</h3>
                 <p className="text-blue-100 text-sm">Les élections seront bientôt disponibles.</p>
               </div>
             ) : (
               <div className="max-h-96 overflow-y-auto overflow-x-hidden space-y-3 lg:space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                 {elections
                   .sort((a, b) => new Date(b.election_date).getTime() - new Date(a.election_date).getTime())
                   .map((election) => {
                     const style = getElectionCardStyle(election);
                     return (
                       <button
                         key={election.id}
                         onClick={() => navigate(`/election/${election.slug ?? election.id}/results`)}
                         className={`w-full p-4 lg:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-xl text-white ${style.bg} ${style.border} ${style.hoverBg} ${style.hoverBorder}`}
                       >
                         <div className="flex items-center justify-between">
                           <div className="text-left flex-1">
                             <h3 className="font-bold text-sm lg:text-base leading-snug">{election.title}</h3>
                             {election.localisation && (
                               <p className="text-xs opacity-60 mt-1 leading-snug">{election.localisation}</p>
                             )}
                           </div>
                           <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 transition-transform text-white/60" />
                         </div>
                       </button>
                     );
                   })}
               </div>
             )}
           </div>

          {/* Avantages de la plateforme */}
          <div className="mt-6 lg:mt-8 flex items-center justify-between gap-3 lg:gap-4 w-full max-w-md">
            <div className="flex items-center space-x-1 lg:space-x-2 text-blue-100">
              <Shield className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />
              <span className="text-xs">Sécurisé</span>
            </div>
            <div className="flex items-center space-x-1 lg:space-x-2 text-blue-100">
              <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />
              <span className="text-xs">Transparent</span>
            </div>
            <div className="flex items-center space-x-1 lg:space-x-2 text-blue-100">
              <Users className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />
              <span className="text-xs">Accessible</span>
            </div>
          </div>
          {/* Copyright desktop */}
          <div className="hidden lg:block w-full mt-8">
            <div className="max-w-md mx-auto text-center space-y-1">
              <div className="text-blue-100 text-[10px] lg:text-xs opacity-80">
                © 2026 o'Hitu - Tous droits réservés
              </div>
              <button
                onClick={() => setPrivacyOpen(true)}
                className="text-blue-200 text-[10px] lg:text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity"
              >
                Politique de confidentialité
              </button>
            </div>
          </div>
          {/* Copyright déplacé plus bas (voir footer absolu ci-dessous) */}
        </div>

      </div>

      {/* Section mobile - Boutons d'élection (visible uniquement sur mobile/tablette) */}
      <div className="lg:hidden bg-gradient-to-br from-gov-blue via-blue-700 to-gov-blue-dark text-white pt-8 pb-6 px-6">
        <div className="max-w-md mx-auto">
          {/* Logo mobile */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
                <img src="/favicon.ico" alt="Logo iKADI" className="w-8 h-8 object-contain" />
              </div>
              <div className="text-left">
                <h1 className="text-white font-bold text-2xl">o'Hitu</h1>
              </div>
            </div>
            
            <h2 className="text-lg xs:text-xl sm:text-2xl font-bold mb-4 text-white tracking-tight leading-tight whitespace-nowrap">
              Expérimentez autrement {' '}
              <span className="text-green-400"> une élection</span>
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed whitespace-normal break-words">
            Sélectionnez une élection pour accéder aux résultats publiés.
            </p>
          </div>

          {/* Boutons de sélection d'élection mobile - Dynamiques */}
          <div>
            {electionsLoading ? (
              <div className="space-y-3">
                <div className="w-full p-4 rounded-lg border-2 bg-gray-600 animate-pulse">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left flex-1">
                      <div className="h-5 bg-gray-500 rounded mb-2 w-32"></div>
                      <div className="h-4 bg-gray-500 rounded w-24"></div>
                    </div>
                  </div>
                </div>
                <div className="w-full p-4 rounded-lg border-2 bg-gray-600 animate-pulse">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left flex-1">
                      <div className="h-5 bg-gray-500 rounded mb-2 w-32"></div>
                      <div className="h-4 bg-gray-500 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : elections.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center">
                  <Vote className="w-6 h-6 text-white/60" />
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">Aucune élection disponible</h3>
                <p className="text-blue-100 text-xs">Les élections seront bientôt disponibles.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto overflow-x-hidden space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {elections
                  .sort((a, b) => new Date(b.election_date).getTime() - new Date(a.election_date).getTime())
                  .map((election) => {
                    const style = getElectionCardStyle(election);
                    return (
                      <button
                        key={election.id}
                        onClick={() => navigate(`/election/${election.slug ?? election.id}/results`)}
                        className={`w-full p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 text-white ${style.bg} ${style.border} ${style.hoverBg} ${style.hoverBorder}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-left flex-1">
                            <h3 className="font-bold text-sm leading-snug">{election.title}</h3>
                            {election.localisation && (
                              <p className="text-xs opacity-60 mt-1 leading-snug">{election.localisation}</p>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-white/60 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Avantages de la plateforme mobile */}
          <div className="mt-4 flex flex-row flex-wrap justify-center gap-3 px-2">
            <div className="flex items-center space-x-1 text-blue-100">
              <Shield className="w-3 h-3 text-green-400" />
              <span className="text-xs">Sécurisé</span>
            </div>
            <div className="flex items-center space-x-1 text-blue-100">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="text-xs">Transparent</span>
            </div>
            <div className="flex items-center space-x-1 text-blue-100">
              <Users className="w-3 h-3 text-green-400" />
              <span className="text-xs">Accessible</span>
            </div>
              </div>
              <div className="mt-12 text-center space-y-1">
                <div className="text-blue-100 text-[10px] opacity-80 leading-snug">
                  © 2026 o'Hitu - Tous droits réservés
                </div>
                <button
                  onClick={() => setPrivacyOpen(true)}
                  className="text-blue-200 text-[10px] opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity"
                >
                  Politique de confidentialité
                </button>
              </div>
            </div>
        </div>
        {/* Footer desktop absolu supprimé pour garder l'alignement avec la colonne centralisée */}

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

      {/* Section droite - Formulaire */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">

          <Card className="bg-white shadow-2xl border-0">
            <CardHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
               <CardTitle className="text-center text-xl sm:text-2xl text-gray-800">
                 Connexion
            </CardTitle>
               <p className="text-center text-gray-600 text-xs sm:text-sm">
              Accédez à votre tableau de bord sécurisé
            </p>
          </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@gabon.ga"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
                  required
                    className="h-10 sm:h-12 border-gray-200 focus:ring-gov-blue focus:border-gov-blue transition-colors text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                    required
                      className="h-10 sm:h-12 border-gray-200 focus:ring-gov-blue focus:border-gov-blue pr-10 sm:pr-12 transition-colors text-sm sm:text-base"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                      className="absolute right-0 top-0 h-full px-2 sm:px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* ── Message d'erreur inline ── */}
              {loginError && (() => {
                const cfg = {
                  credentials: {
                    icon:    <AlertCircle className="w-4 h-4 flex-shrink-0" />,
                    bg:      'bg-red-50 border-red-200',
                    text:    'text-red-800',
                    iconCls: 'text-red-500',
                  },
                  pending: {
                    icon:    <Clock className="w-4 h-4 flex-shrink-0" />,
                    bg:      'bg-amber-50 border-amber-200',
                    text:    'text-amber-800',
                    iconCls: 'text-amber-500',
                  },
                  disabled: {
                    icon:    <Lock className="w-4 h-4 flex-shrink-0" />,
                    bg:      'bg-orange-50 border-orange-200',
                    text:    'text-orange-800',
                    iconCls: 'text-orange-500',
                  },
                  generic: {
                    icon:    <AlertCircle className="w-4 h-4 flex-shrink-0" />,
                    bg:      'bg-red-50 border-red-200',
                    text:    'text-red-800',
                    iconCls: 'text-red-500',
                  },
                }[loginError.type];
                return (
                  <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200 ${cfg.bg}`}>
                    <span className={`mt-0.5 ${cfg.iconCls}`}>{cfg.icon}</span>
                    <p className={`text-sm leading-snug ${cfg.text}`}>{loginError.message}</p>
                  </div>
                );
              })()}

              <Button
                type="submit"
                   className="w-full h-10 sm:h-12 bg-gov-blue hover:bg-gov-blue-dark text-white font-medium transition-colors text-sm sm:text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       <span className="hidden sm:inline">Connexion...</span>
                       <span className="sm:hidden">Connexion...</span>
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>

              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs text-gray-500">
                  o'Hitu - une solution de CNX 4.0
                </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
