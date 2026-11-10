import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUpload, FileUploadDropzone, FileUploadTrigger, FileUploadList, FileUploadItem, FileUploadItemPreview, FileUploadItemMetadata, FileUploadItemDelete, FileUploadClear, FileUploadItemProgress } from "@/components/ui/file-upload";
import { Image as ImageIcon, Upload, Trash2 as TrashIcon, Loader2, X, FileText, File, FileImage, FileSpreadsheet, FileVideo, FileAudio, FileArchive } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";

interface ImagePickerProps {
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  onUpload?: (files: File[]) => Promise<void>;
  onDelete?: (imageId: string) => Promise<void>;
  existingImages?: Array<{
    uuid: string;
    url: string;
    filename: string;
    size: number;
    mimetype: string;
  }>;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  uploadText?: string;
  uploadSubtext?: string;
  fileTypeText?: string;
  showExistingImages?: boolean;
  existingImagesTitle?: string;
  dropzoneClassName?: string;
  showClearAll?: boolean;
  chooseText?: string;
  chooseSubtext?: string;
  chooseButtonText?: string;
  uploadingText?: string;
  uploadingSubtext?: string;
  uploadingButtonText?: string;
  variant?: "default" | "compact";
}

const ImagePicker = ({
  files = [],
  onFilesChange,
  onUpload,
  onDelete,
  existingImages = [],
  accept = "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png",
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  multiple = true,
  disabled = false,
  isUploading = false,
  isDeleting = false,
  uploadText = "Upload images",
  uploadSubtext = "Drag and drop images here, or click to browse",
  fileTypeText = "Supports JPG, PNG, JPEG up to 10MB each",
  showExistingImages = true,
  existingImagesTitle = "Existing Images",
  dropzoneClassName = "min-h-[200px]",
  showClearAll = true,
  variant = "default",
  chooseButtonText = "Choose Images",
  uploadingText = "Uploading images",
  uploadingSubtext = "Please wait while your images are being uploaded",
  uploadingButtonText = "Uploading...",
}: ImagePickerProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith("image/")) {
      return <FileImage className="h-8 w-8 text-blue-500" />;
    } else if (mimetype === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />;
    } else if (mimetype.includes("word") || mimetype.includes("document") || mimetype === "application/msword" || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return <FileText className="h-8 w-8 text-blue-600" />;
    } else if (mimetype.includes("excel") || mimetype.includes("spreadsheet") || mimetype === "application/vnd.ms-excel" || mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
    } else if (mimetype.startsWith("video/")) {
      return <FileVideo className="h-8 w-8 text-purple-500" />;
    } else if (mimetype.startsWith("audio/")) {
      return <FileAudio className="h-8 w-8 text-orange-500" />;
    } else if (mimetype.includes("zip") || mimetype.includes("rar") || mimetype.includes("archive")) {
      return <FileArchive className="h-8 w-8 text-yellow-600" />;
    } else {
      return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const isImageFile = (mimetype: string) => {
    return mimetype.startsWith("image/");
  };

  const handleFilesChange = (newFiles: File[]) => {
    onFilesChange?.(newFiles);
  };

  const handleFileUpload = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0 || !onUpload) return;

    try {
      await onUpload(filesToUpload);
    } catch (error) {
      console.error("Failed to upload images:", error);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!onDelete) return;

    try {
      await onDelete(imageId);
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
  };

  const handleDeleteClick = (imageId: string) => {
    setImageToDelete(imageId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (imageToDelete) {
      await handleDeleteImage(imageToDelete);
      setImageToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setImageToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleFileReject = (file: File, message: string) => {
    toast({
      title: "File rejected",
      description: `${file.name}: ${message}`,
      variant: "destructive",
    });
  };

  if (variant === "compact") {
    return (
      <>
        <FileUpload value={files} onValueChange={handleFilesChange} accept={accept} maxFiles={maxFiles} maxSize={maxSize} multiple={multiple} onUpload={handleFileUpload} disabled={disabled || isUploading} onFileReject={handleFileReject}>
          <FileUploadDropzone className={dropzoneClassName}>
            <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
              {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImageIcon className="w-8 h-8" />}
              <div className="text-sm text-center">
                <p className="font-medium">{isUploading ? uploadingText : uploadText}</p>
                <p className="text-xs">{isUploading ? uploadingSubtext : fileTypeText}</p>
              </div>
            </div>
          </FileUploadDropzone>
          {files.length > 0 && (
            <FileUploadList>
              {files.map((file) => (
                <FileUploadItem key={file.name} value={file}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              ))}
            </FileUploadList>
          )}
        </FileUpload>

        {existingImages.length > 0 && showExistingImages && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{existingImagesTitle}</h3>
              <span className="text-sm text-muted-foreground">
                {existingImages.length} image{existingImages.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingImages.map((image) => (
                <div key={image.uuid} className="relative group">
                  <div className="aspect-square overflow-hidden rounded-lg border bg-gray-50 dark:bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onClick={() => window.open(image.url, "_blank")}>
                    {!isImageFile(image.mimetype) ? (
                      <div className="flex flex-col items-center justify-center p-4">
                        {getFileIcon(image.mimetype)}
                        <span className="text-xs text-muted-foreground mt-2 text-center">{image.mimetype.split("/")[1]?.toUpperCase() || "FILE"}</span>
                      </div>
                    ) : (
                      <img src={image.url} alt={image.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    )}
                  </div>
                  {onDelete && (
                    <Button type="button" variant="destructive" size="sm" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteClick(image.uuid)} disabled={isDeleting}>
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground truncate">{image.filename}</p>
                    <p className="text-xs text-muted-foreground">{(image.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ConfirmationDialog isOpen={isDeleteDialogOpen} onClose={handleCancelDelete} onConfirm={handleConfirmDelete} title="Delete Image" description="Are you sure you want to delete this image? This action cannot be undone." confirmText="Delete" cancelText="Cancel" variant="destructive" icon={<TrashIcon className="h-5 w-5" />} isLoading={isDeleting} />
      </>
    );
  }

  return (
    <div className="relative">
      <FileUpload value={files} onValueChange={handleFilesChange} accept={accept} maxFiles={maxFiles} maxSize={maxSize} multiple={multiple} onUpload={handleFileUpload} disabled={disabled || isUploading} onFileReject={handleFileReject}>
        <FileUploadDropzone className={dropzoneClassName}>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">{isUploading ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-primary" />}</div>
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium">{isUploading ? uploadingText : uploadText}</p>
              <p className="text-xs text-muted-foreground">{isUploading ? uploadingSubtext : uploadSubtext}</p>
              <p className="text-xs text-muted-foreground">{fileTypeText}</p>
            </div>
            <FileUploadTrigger asChild>
              <Button type="button" variant="outline" disabled={disabled || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingButtonText}
                  </>
                ) : (
                  chooseButtonText
                )}
              </Button>
            </FileUploadTrigger>
          </div>
        </FileUploadDropzone>

        <FileUploadList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <FileUploadItem key={file.name} value={file} className="flex-col p-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                <FileUploadItemPreview className="h-full w-full">
                  <FileUploadItemProgress circular size={60} />
                </FileUploadItemPreview>
                <FileUploadItemDelete className="absolute right-2 top-2 rounded-full bg-destructive/80 p-1.5 text-destructive-foreground opacity-0 transition-opacity hover:opacity-100">
                  <TrashIcon className="h-3 w-3" />
                </FileUploadItemDelete>
              </div>
              <FileUploadItemMetadata className="mt-2 text-center">
                <span className="text-xs text-muted-foreground">{file.type.startsWith("image/") ? "Image" : file.type}</span>
              </FileUploadItemMetadata>
            </FileUploadItem>
          ))}
        </FileUploadList>

        {files.length > 0 && showClearAll && (
          <div className="flex justify-end">
            <FileUploadClear asChild>
              <Button type="button" variant="outline" size="sm" disabled={disabled || isUploading}>
                Clear All
              </Button>
            </FileUploadClear>
          </div>
        )}
      </FileUpload>

      {isUploading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{uploadingText}</p>
            <p className="text-xs text-muted-foreground">{uploadingSubtext}</p>
          </div>
        </div>
      )}

      {existingImages.length > 0 && showExistingImages && (
        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">{existingImagesTitle}</h3>
            <span className="text-sm text-muted-foreground">
              {existingImages.length} image{existingImages.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingImages.map((image) => (
              <div key={image.uuid} className="relative group">
                <div className="aspect-square overflow-hidden rounded-lg border bg-gray-50 dark:bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onClick={() => window.open(image.url, "_blank")}>
                  {!isImageFile(image.mimetype) ? (
                    <div className="flex flex-col items-center justify-center p-4">
                      {getFileIcon(image.mimetype)}
                      <span className="text-xs text-muted-foreground mt-2 text-center">{image.mimetype.split("/")[1]?.toUpperCase() || "FILE"}</span>
                    </div>
                  ) : (
                    <img src={image.url} alt={image.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                {onDelete && (
                  <Button type="button" variant="destructive" size="sm" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteClick(image.uuid)} disabled={isDeleting}>
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                )}
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground truncate">{image.filename}</p>
                  <p className="text-xs text-muted-foreground">{(image.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmationDialog isOpen={isDeleteDialogOpen} onClose={handleCancelDelete} onConfirm={handleConfirmDelete} title="Delete Image" description="Are you sure you want to delete this image? This action cannot be undone." confirmText="Delete" cancelText="Cancel" variant="destructive" icon={<TrashIcon className="h-5 w-5" />} isLoading={isDeleting} />
    </div>
  );
};

export default ImagePicker;
