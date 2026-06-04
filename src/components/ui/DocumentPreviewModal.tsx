/**
 * DocumentPreviewModal — modal de prévisualisation partagé.
 * Utilisé par DocumentsSection et PVEntrySection.
 *
 * Pour les PDF : iframe natif du navigateur.
 * Pour les images : affichage avec zoom et rotation.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, FileText } from 'lucide-react';

interface Props {
  url:       string | null;
  title?:    string;           // titre affiché dans l'en-tête
  subtitle?: string;           // sous-titre (établissement, collège, etc.)
  fileName?: string | null;
  onClose:   () => void;
  onDownload?: () => void;
}

function isPdf(url: string): boolean {
  return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf');
}

const DocumentPreviewModal: React.FC<Props> = ({
  url, title, subtitle, fileName, onClose, onDownload,
}) => {
  const [imgZoom,     setImgZoom]     = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  const open = !!url;

  const handleOpenChange = (o: boolean) => { if (!o) onClose(); };

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── En-tête ── */}
        <DialogHeader className="px-5 py-3.5 border-b bg-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mr-8">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 truncate">
                {title ?? (fileName ?? 'Document')}
              </DialogTitle>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
              )}
              {fileName && title && (
                <p className="text-xs text-gray-400 italic truncate">{fileName}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0 mr-2">
              {!isPdf(url) && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Zoom +" onClick={() => setImgZoom(z => Math.min(z + 0.25, 3))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Zoom −" onClick={() => setImgZoom(z => Math.max(z - 0.25, 0.25))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                    title="Rotation" onClick={() => setImgRotation(r => (r + 90) % 360)}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </>
              )}
              {onDownload && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                  title="Télécharger" onClick={onDownload}>
                  <Download className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-800"
                title="Ouvrir dans un nouvel onglet" onClick={() => window.open(url, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Corps ── */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative" style={{ minHeight: '60vh' }}>
          {isPdf(url) ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              style={{ minHeight: '65vh' }}
              title="Prévisualisation document"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4"
              style={{ minHeight: '65vh' }}>
              <img
                src={url}
                alt="Document"
                style={{
                  transform:   `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  transition:  'transform 0.2s ease',
                  maxWidth:    imgZoom <= 1 ? '100%' : 'none',
                  maxHeight:   imgZoom <= 1 ? '65vh' : 'none',
                  objectFit:   'contain',
                  display:     'block',
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewModal;
