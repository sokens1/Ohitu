import React from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerFooter, 
  DrawerClose,
  DrawerTitle,
  DrawerDescription
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Users, Calendar, Award, Star, ChevronDown } from 'lucide-react';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
  bio?: string;
  experience?: string;
  education?: string;
  achievements?: string[];
  campaign_promises?: string[];
  titulaires?: Array<{ name: string; photo?: string; role: string }>;
  suppleants?: Array<{ name: string; photo?: string; role: string }>;
}

interface CandidateProfileModalProps {
  candidate: Candidate;
  isOpen: boolean;
  onClose: () => void;
}

const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  candidate,
  isOpen,
  onClose
}) => {
  if (!candidate) return null;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[95vh] bg-white border-0 rounded-t-[40px] shadow-2xl overflow-hidden focus:outline-none">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4" />
        
        <div className="overflow-y-auto px-6 sm:px-10 pb-10">
          {/* Header avec Design Épuré et Puissant */}
          <div className="relative mb-8 pt-4">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                {candidate.titulaires?.[0]?.photo ? (
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl transition-all duration-500 group-hover:scale-105 group-hover:rotate-2">
                    <img src={candidate.titulaires[0].photo} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="relative">
                    <InitialsAvatar 
                      name={candidate.titulaires?.[0]?.name || candidate.name} 
                      size="xl" 
                      className="w-28 h-28 sm:w-36 sm:h-36 shadow-xl border-4 border-white text-3xl font-black bg-gradient-to-br from-blue-600 to-purple-700"
                    />
                  </div>
                )}
                {candidate.isOurCandidate && (
                  <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-blue-900 p-2.5 rounded-2xl shadow-xl border-2 border-white animate-pulse">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                )}
              </div>
              
              <div className="text-center sm:text-left space-y-3">
                <div className="space-y-1">
                  <p className="text-blue-600 font-black uppercase text-[10px] tracking-[0.3em]">Candidat Titulaire</p>
                  <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight leading-none">
                    {candidate.titulaires?.[0]?.name || candidate.name}
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge className="bg-gray-900 text-white border-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    {candidate.titulaires ? `Liste ${candidate.name}` : candidate.party}
                  </Badge>
                  {candidate.party && candidate.titulaires && (
                    <Badge variant="outline" className="border-2 border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                      {candidate.party}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Colonne Gauche - Suppléant & Bio */}
            <div className="lg:col-span-7 space-y-8">
              {/* Suppléant - Card Moderne */}
              {candidate.suppleants?.[0] && (
                <div className="group relative overflow-hidden rounded-[2.5rem] bg-gray-50 hover:bg-blue-50 transition-all duration-500 p-6 sm:p-8">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                    <Users className="w-32 h-32 text-blue-600" />
                  </div>
                  <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden bg-white shadow-lg border-2 border-white transition-transform duration-500 group-hover:-rotate-3">
                      {candidate.suppleants[0].photo ? (
                        <img src={candidate.suppleants[0].photo} alt="Suppleant" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-xl">S</div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Suppléant de la liste</p>
                      <p className="text-2xl font-black text-gray-900 tracking-tight">{candidate.suppleants[0].name}</p>
                    </div>
                  </div>
                </div>
              )}

              {candidate.bio && (
                <div className="space-y-4 px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">Vision & Biographie</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-lg font-medium italic">
                    "{candidate.bio}"
                  </p>
                </div>
              )}
            </div>

            {/* Colonne Droite - Réalisations & Engagements */}
            <div className="lg:col-span-5 space-y-8">
              {candidate.campaign_promises && candidate.campaign_promises.length > 0 && (
                <div className="rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                    <Star className="w-6 h-6 text-yellow-400 fill-current" />
                    Engagements Forts
                  </h3>
                  <div className="space-y-4">
                    {candidate.campaign_promises.map((promise, index) => (
                      <div key={index} className="flex items-start gap-4 group">
                        <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-2xl flex items-center justify-center text-sm font-black group-hover:bg-white group-hover:text-blue-600 transition-colors">
                          {index + 1}
                        </div>
                        <p className="font-bold text-blue-50 leading-snug">{promise}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {candidate.achievements && candidate.achievements.length > 0 && (
                <div className="space-y-6 px-2">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-600" />
                    Réalisations
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {candidate.achievements.map((achievement, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-200 transition-all duration-300">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="text-gray-700 font-bold text-sm">{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-8">
          <DrawerClose asChild>
            <Button variant="ghost" className="w-full h-14 rounded-3xl text-gray-400 font-bold hover:text-gray-900 transition-colors">
              <ChevronDown className="w-5 h-5 mr-2" />
              Fermer le profil
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CandidateProfileModal;

