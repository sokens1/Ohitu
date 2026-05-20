/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const NetworkStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<'online-good' | 'online-poor' | 'offline'>('online-good');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const checkConnection = () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      // Check using Network Information API if available
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        const rtt = conn.rtt || 0;
        const effectiveType = conn.effectiveType || '4g';
        
        if (rtt > 300 || effectiveType === '2g' || effectiveType === '3g') {
          setStatus('online-poor');
        } else {
          setStatus('online-good');
        }
        setLatency(rtt);
        return;
      }

      setStatus('online-good');
    };

    // Initial check
    checkConnection();

    // Listen to changes
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      conn.addEventListener('change', checkConnection);
    }

    // Periodically ping to get real latency
    const interval = setInterval(async () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      try {
        const startTime = Date.now();
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
        const endTime = Date.now();
        const rtt = endTime - startTime;
        setLatency(rtt);
        if (rtt > 300) {
          setStatus('online-poor');
        } else {
          setStatus('online-good');
        }
      } catch (err) {
        // If ping fails but navigator says online, it might be a poor connection or CORS
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
      if (conn) {
        conn.removeEventListener('change', checkConnection);
      }
      clearInterval(interval);
    };
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 cursor-help transition-all duration-300 hover:bg-gray-100 select-none">
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                status === 'online-good' && "bg-green-400",
                status === 'online-poor' && "bg-amber-400",
                status === 'offline' && "bg-red-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                status === 'online-good' && "bg-green-500",
                status === 'online-poor' && "bg-amber-500",
                status === 'offline' && "bg-red-500"
              )}></span>
            </span>
            {status === 'offline' ? (
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Wifi className={cn(
                "h-3.5 w-3.5",
                status === 'online-good' && "text-green-500",
                status === 'online-poor' && "text-amber-500"
              )} />
            )}
            <span className={cn(
              "text-[10px] font-bold hidden xs:inline-block",
              status === 'online-good' && "text-green-600",
              status === 'online-poor' && "text-amber-600",
              status === 'offline' && "text-red-600"
            )}>
              {status === 'online-good' && "En Ligne"}
              {status === 'online-poor' && "Connexion Lente"}
              {status === 'offline' && "Hors Ligne"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3 space-y-1 bg-white border border-gray-200 shadow-xl rounded-lg text-xs text-gray-700 z-50">
          <p className="font-bold flex items-center gap-1.5">
            Statut: 
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase",
              status === 'online-good' && "bg-green-100 text-green-800",
              status === 'online-poor' && "bg-amber-100 text-amber-800",
              status === 'offline' && "bg-red-100 text-red-800"
            )}>
              {status === 'online-good' && "Excellent"}
              {status === 'online-poor' && "Faible / Instable"}
              {status === 'offline' && "Déconnecté"}
            </span>
          </p>
          {latency !== null && status !== 'offline' && (
            <p className="text-gray-500">Temps de réponse: <strong>{latency} ms</strong></p>
          )}
          <p className="text-[10px] text-gray-400 mt-1 max-w-[200px]">
            {status === 'online-good' && "La connexion réseau est optimale. Les données sont synchronisées en temps réel."}
            {status === 'online-poor' && "La latence réseau est élevée. Certaines actions peuvent être ralenties."}
            {status === 'offline' && "Vous êtes actuellement déconnecté d'internet. Les modifications locales seront synchronisées à la reconnexion."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
