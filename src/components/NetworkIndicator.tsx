import React from 'react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  HelpCircle,
  Activity
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const NetworkIndicator: React.FC = () => {
  const { isOnline, quality, type, downlink, rtt, effectiveType } = useNetworkQuality();

  const getConnectionTypeLabel = () => {
    if (!isOnline) return 'Déconnecté';
    if (type === 'wifi') return 'Wi-Fi';
    if (type === 'ethernet') return 'Ethernet';
    if (type === 'cellular') {
      return effectiveType ? `Cellulaire (${effectiveType.toUpperCase()})` : 'Cellulaire';
    }
    if (effectiveType) {
      return `Réseau (${effectiveType.toUpperCase()})`;
    }
    return 'Réseau connecté';
  };

  const getStatusDetails = () => {
    switch (quality) {
      case 'offline':
        return {
          color: 'text-red-500 bg-red-50 border-red-200 hover:bg-red-100',
          dotColor: 'bg-red-500 animate-pulse',
          label: 'Hors-ligne',
          desc: 'Aucune connexion internet détectée. Mode résilience local activé.',
          bars: 0,
        };
      case 'poor':
        return {
          color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100',
          dotColor: 'bg-orange-500 animate-ping',
          label: 'Connexion très faible',
          desc: 'La connexion est extrêmement lente. Compression automatique des photos de PV activée.',
          bars: 1,
        };
      case 'fair':
        return {
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
          dotColor: 'bg-yellow-500',
          label: 'Connexion moyenne',
          desc: 'Le réseau est instable ou limité. Compression automatique des photos de PV activée pour garantir l\'envoi.',
          bars: 2,
        };
      case 'good':
        return {
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
          dotColor: 'bg-emerald-500',
          label: 'Connexion stable',
          desc: 'Le réseau est stable et opérationnel.',
          bars: 3,
        };
      case 'excellent':
      default:
        return {
          color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100',
          dotColor: 'bg-green-500',
          label: 'Connexion excellente',
          desc: 'Le réseau est optimal. Tous les services en ligne fonctionnent à plein régime.',
          bars: 4,
        };
    }
  };

  const status = getStatusDetails();

  const renderBars = (count: number) => {
    return (
      <div className="flex items-end gap-0.5 h-3.5 w-5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-0.75 rounded-t-sm transition-all duration-300 ${
              bar <= count
                ? quality === 'poor'
                  ? 'bg-orange-500 h-' + bar * 25 + '%'
                  : quality === 'fair'
                  ? 'bg-yellow-500 h-' + bar * 25 + '%'
                  : 'bg-green-600 h-' + bar * 25 + '%'
                : 'bg-gray-200 h-' + bar * 25 + '%'
            }`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-300 ${status.color}`}
          >
            {/* Icône principale ou barres */}
            {isOnline ? (
              type === 'wifi' || type === 'ethernet' ? (
                <Wifi className="h-4 w-4 flex-shrink-0" />
              ) : (
                renderBars(status.bars)
              )
            ) : (
              <WifiOff className="h-4 w-4 flex-shrink-0 animate-bounce" />
            )}

            {/* Pastille de statut avec micro-animation */}
            <span className="relative flex h-2 w-2">
              {quality === 'poor' || !isOnline ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              ) : null}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dotColor}`}></span>
            </span>

            {/* Libellé textuel intelligent */}
            <span className="hidden md:inline truncate uppercase tracking-wider text-[10px]">
              {getConnectionTypeLabel()}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="w-80 p-4 bg-white border border-gray-200 rounded-xl shadow-lg z-50 text-gray-800">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="font-bold text-sm text-gray-900">{status.label}</span>
              <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                <Activity className="h-3.5 w-3.5 text-gray-400" />
                <span>{getConnectionTypeLabel()}</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {status.desc}
            </p>

            {isOnline && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="block text-[10px] text-gray-400 uppercase font-medium">Débit Estimé</span>
                  <span className="font-semibold text-gray-900">{downlink ? `${downlink} Mb/s` : 'Inconnu'}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="block text-[10px] text-gray-400 uppercase font-medium">Latence (RTT)</span>
                  <span className="font-semibold text-gray-900">{rtt ? `${rtt} ms` : 'Inconnu'}</span>
                </div>
              </div>
            )}

            {(quality === 'poor' || quality === 'fair') && (
              <div className="flex items-start space-x-2 p-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-800 text-[11px]">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500 mt-0.5 animate-pulse" />
                <span>
                  <strong>Mode Éco Réseau Actif</strong> : Les justificatifs de PV seront compressés à la volée avant téléversement.
                </span>
              </div>
            )}
            
            {!isOnline && (
              <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-100 rounded-lg text-red-800 text-[11px]">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5 animate-bounce" />
                <span>
                  <strong>Mode Résilience Actif</strong> : Les PV saisis sont sauvegardés en local. Ils seront synchronisés dès le retour de votre connexion.
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NetworkIndicator;
