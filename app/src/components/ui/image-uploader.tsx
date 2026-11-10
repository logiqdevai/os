import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUpload, FileUploadDropzone, FileUploadTrigger, FileUploadList, FileUploadItem, FileUploadItemPreview, FileUploadItemMetadata, FileUploadItemDelete } from "@/components/ui/file-upload";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { X, Image as ImageIcon, Camera, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  label: string;
  currentImageUrl?: string;
  currentImageAlt: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isUploading: boolean;
  isRemoving: boolean;
  uploadButtonText: string;
  uploadingText: string;
  removeButtonText: string;
  removingText: string;
  removeDialogTitle: string;
  removeDialogDescription: string;
  removeDialogConfirmText: string;
  imageObjectFit?: "contain" | "cover";
}

const ImageUploader = ({ label, currentImageUrl, currentImageAlt, onUpload, onRemove, isUploading, isRemoving, uploadButtonText, uploadingText, removeButtonText, removingText, removeDialogTitle, removeDialogDescription, removeDialogConfirmText, imageObjectFit = "contain" }: ImageUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const handleUpload = async (files: File[]) => {
    if (files.length > 0) {
      onUpload(files[0]);
      setFile(null);
    }
  };

  const handleRemove = () => {
    onRemove();
    setIsRemoveDialogOpen(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {currentImageUrl ? (
        <div className="relative group">
          <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
            <img src={currentImageUrl} alt={currentImageAlt} className={`max-w-full max-h-full object-${imageObjectFit} ${imageObjectFit === "cover" ? "rounded-lg" : ""}`} />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <FileUpload value={file ? [file] : []} onValueChange={(files) => setFile(files[0] || null)} onUpload={handleUpload} accept="image/*" maxFiles={1} maxSize={5 * 1024 * 1024}>
              <FileUploadTrigger asChild>
                <Button type="button" size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-slate-900" disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  {isUploading ? uploadingText : uploadButtonText}
                </Button>
              </FileUploadTrigger>
            </FileUpload>
            <Button type="button" size="sm" variant="destructive" className="bg-red-500/90 hover:bg-red-500 text-white" disabled={isRemoving} onClick={() => setIsRemoveDialogOpen(true)}>
              {isRemoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              {isRemoving ? removingText : removeButtonText}
            </Button>
          </div>
        </div>
      ) : (
        <FileUpload value={file ? [file] : []} onValueChange={(files) => setFile(files[0] || null)} onUpload={handleUpload} accept="image/*" maxFiles={1} maxSize={5 * 1024 * 1024} disabled={isUploading}>
          <FileUploadDropzone className="h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
            <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
              {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImageIcon className="w-8 h-8" />}
              <div className="text-sm text-center">
                <p className="font-medium">{isUploading ? uploadingText : `Upload ${label}`}</p>
                <p className="text-xs">{isUploading ? "Please wait..." : "PNG, JPG up to 5MB"}</p>
              </div>
            </div>
          </FileUploadDropzone>
          {file && (
            <FileUploadList>
              <FileUploadItem value={file}>
                <FileUploadItemPreview />
                <FileUploadItemMetadata />
                <FileUploadItemDelete asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <X className="w-4 h-4" />
                  </Button>
                </FileUploadItemDelete>
              </FileUploadItem>
            </FileUploadList>
          )}
        </FileUpload>
      )}

      <ConfirmationDialog isOpen={isRemoveDialogOpen} onClose={() => setIsRemoveDialogOpen(false)} onConfirm={handleRemove} title={removeDialogTitle} description={removeDialogDescription} confirmText={removeDialogConfirmText} cancelText="Cancel" variant="destructive" isLoading={isRemoving} />
    </div>
  );
};

export default ImageUploader;
