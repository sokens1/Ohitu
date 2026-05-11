import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Building, Users, Phone, Mail, MapPin, Calendar, Award, Star } from 'lucide-react';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface Candidate {
  id: string;
  name: string;
  party: string;
  isOurCandidate: boolean;
  photo?: string;
  // Informations supplémentaires pour le profil
  bio?: string;
  experience?: string;
  education?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  achievements?: string[];
  campaign_promises?: string[];
  // Pro fields
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 overflow-hidden rounded-3xl shadow-2xl">
        {/* Header avec Gradient Premium */}
        <div className="relative bg-gradient-to-br from-[#1e40af] via-[#3b82f6] to-purple-600 p-8 sm:p-12 text-white overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Award className="w-32 h-32 rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group">
              {candidate.titulaires?.[0]?.photo ? (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2.5rem] overflow-hidden border-4 border-white/30 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                  <img src={candidate.titulaires[0].photo} alt="Profile" className="w-full h-full object-cover" />
                </div>
              ) : (
                <InitialsAvatar 
                  name={candidate.titulaires?.[0]?.name || candidate.name} 
                  size="xl" 
                  className="w-24 h-24 sm:w-32 sm:h-32 shadow-2xl border-4 border-white/30 text-2xl"
                />
              )}
              {candidate.isOurCandidate && (
                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-blue-900 p-2 rounded-2xl shadow-xl animate-bounce">
                  <Star className="w-5 h-5 fill-current" />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                {candidate.titulaires?.[0]?.name || candidate.name}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
                  {candidate.titulaires ? `Liste ${candidate.name}` : candidate.party}
                </Badge>
                {candidate.party && candidate.titulaires && (
                  <Badge className="bg-purple-500/30 text-white border-0 backdrop-blur-md px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
                    {candidate.party}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-8 bg-white">
          {/* Informations Pro (Suppléant) - Style Moderne */}
          {candidate.suppleants?.[0] && (
            <div className="relative group overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 p-6 sm:p-8 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Users className="w-24 h-24 text-blue-600" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em]">Détails de la Liste</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden bg-white shadow-lg border-2 border-blue-200 transition-transform duration-300 group-hover:rotate-3">
                      {candidate.suppleants[0].photo ? (
                        <img src={candidate.suppleants[0].photo} alt="Suppleant" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-xl">S</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">{candidate.suppleants[0].name}</p>
                    <p className="text-blue-600 font-bold uppercase text-[10px] tracking-widest mt-1">Candidat Suppléant</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Biographie & Expérience */}
            <div className="space-y-8">
              {candidate.bio && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Biographie</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-lg">{candidate.bio}</p>
                </div>
              )}

              {candidate.experience && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Parcours</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{candidate.experience}</p>
                </div>
              )}
            </div>

            {/* Réalisations & Promesses */}
            <div className="space-y-8">
              {candidate.achievements && candidate.achievements.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-xl">
                      <Award className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Réalisations</h3>
                  </div>
                  <div className="space-y-3">
                    {candidate.achievements.map((achievement, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl hover:bg-green-50 transition-colors duration-300">
                        <div className="h-2 w-2 bg-green-500 rounded-full" />
                        <span className="text-gray-700 font-medium">{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {candidate.campaign_promises && candidate.campaign_promises.length > 0 && (
                <div className="space-y-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-[2rem] border border-purple-100">
                  <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    Engagements
                  </h3>
                  <div className="space-y-4">
                    {candidate.campaign_promises.map((promise, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-black">
                          {index + 1}
                        </span>
                        <p className="text-purple-900/80 font-medium">{promise}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Minimaliste */}
        <div className="p-6 bg-gray-50 flex justify-end">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="rounded-2xl px-8 font-bold hover:bg-gray-200 transition-colors"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateProfileModal;
