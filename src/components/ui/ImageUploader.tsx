import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  defaultValue?: string;
  label?: string;
  bucket?: string;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onUploadSuccess, 
  defaultValue, 
  label = "Image de couverture", 
  bucket = 'avatars',
  className
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation simple
    if (!file.type.startsWith('image/')) {
      toast.error("Le fichier doit être une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    // Prévisualisation locale
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload vers Supabase
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `elections/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onUploadSuccess(publicUrl);
      toast.success("Image téléchargée avec succès");
    } catch (error: any) {
      console.error('Erreur upload:', error);
      toast.error("Erreur lors du téléchargement de l'image");
      setPreview(defaultValue || null); // Reset preview on error
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setPreview(null);
    onUploadSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Image className="w-4 h-4 text-gov-blue" />
        {label}
      </label>

      <div 
        className={cn(
          "relative border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center min-h-[160px] overflow-hidden group",
          preview ? "border-gov-blue/50 bg-gov-blue/5" : "border-gray-300 hover:border-gov-blue/50 hover:bg-gray-50",
          uploading && "opacity-60 cursor-not-allowed"
        )}
      >
        {preview ? (
          <>
            <img 
              src={preview} 
              alt="Preview" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Changer
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                size="sm" 
                onClick={removeImage}
                disabled={uploading}
              >
                Supprimer
              </Button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-gov-blue animate-spin" />
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center p-6 text-gray-500"
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 mb-2 animate-spin text-gov-blue" />
            ) : (
              <Upload className="w-10 h-10 mb-2 group-hover:scale-110 group-hover:text-gov-blue transition-all" />
            )}
            <span className="text-sm font-medium">Cliquez pour ajouter une image</span>
            <span className="text-xs mt-1">PNG, JPG jusqu'à 5 Mo</span>
          </button>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept="image/*" 
        />
      </div>
      
      {preview && !uploading && (
        <p className="text-[10px] text-green-600 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Image prête pour l'enregistrement
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
