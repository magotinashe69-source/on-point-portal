import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, FileText, File, Image, FileArchive } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { Lightbox } from "@/components/Lightbox";

export interface AttachmentFile {
  name: string;
  url: string;
  type: string;
}

interface FileAttachmentZoneProps {
  attachments: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
  accept?: string;
  maxFiles?: number;
  label?: string;
  hint?: string;
}

function getFileIcon(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <Image className="h-8 w-8 text-blue-500" />;
  }
  if (type === "application/pdf" || ext === "pdf") {
    return <FileText className="h-8 w-8 text-red-500" />;
  }
  if (["doc", "docx"].includes(ext)) {
    return <FileText className="h-8 w-8 text-blue-700" />;
  }
  if (["txt"].includes(ext)) {
    return <FileText className="h-8 w-8 text-gray-500" />;
  }
  return <File className="h-8 w-8 text-gray-400" />;
}

function isImage(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

export function FileAttachmentZone({
  attachments,
  onChange,
  accept = "image/*,.pdf,.doc,.docx,.txt",
  maxFiles = 10,
  label = "Attach Files",
  hint = "Images, PDFs, Word documents, text files",
}: FileAttachmentZoneProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { uploadFile } = useUpload();

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = maxFiles - attachments.length;
      if (remaining <= 0) {
        toast({ title: `Maximum ${maxFiles} files allowed`, variant: "destructive" });
        return;
      }
      const toUpload = fileArray.slice(0, remaining);
      setUploading(true);
      const newAttachments: AttachmentFile[] = [];
      for (const file of toUpload) {
        const result = await uploadFile(file);
        if (result) {
          newAttachments.push({
            name: file.name,
            url: result.objectPath,
            type: file.type || "application/octet-stream",
          });
        }
      }
      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
      }
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [attachments, maxFiles, onChange, toast, uploadFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const removeAttachment = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
          ${uploading ? "opacity-60 cursor-not-allowed" : ""}
        `}
        data-testid="file-drop-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-file-attachment"
        />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {uploading ? "Uploading..." : isDragging ? "Drop files here" : label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
            {!uploading && (
              <p className="text-xs text-muted-foreground">
                Drag & drop or click to browse
              </p>
            )}
          </div>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="relative group border rounded-lg overflow-hidden bg-muted/20"
              data-testid={`attachment-preview-${idx}`}
            >
              {isImage(att.type, att.name) ? (
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-full h-24 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center h-24 gap-1 hover:bg-muted/50 transition-colors"
                >
                  {getFileIcon(att.type, att.name)}
                  <span className="text-xs text-muted-foreground truncate w-full px-2 text-center">
                    {att.name}
                  </span>
                </a>
              )}
              <div className="absolute top-1 right-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.preventDefault(); removeAttachment(idx); }}
                  data-testid={`button-remove-attachment-${idx}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {isImage(att.type, att.name) && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{att.name}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentDisplayProps {
  attachments: AttachmentFile[];
  title?: string;
}

export function AttachmentDisplay({ attachments, title = "Attachments" }: AttachmentDisplayProps) {
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!attachments || attachments.length === 0) return null;

  const imageUrls = attachments.filter(a => isImage(a.type, a.name)).map(a => a.url);

  const openLightbox = (url: string) => {
    const idx = imageUrls.indexOf(url);
    setLightboxImages(imageUrls);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-3">
      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onChange={setLightboxIndex}
        />
      )}
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {attachments.map((att, idx) => (
          isImage(att.type, att.name) ? (
            <div
              key={idx}
              onClick={() => openLightbox(att.url)}
              className="group border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              data-testid={`attachment-display-${idx}`}
            >
              <div className="relative">
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-full h-24 object-cover group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5">
                  <p className="text-white text-xs truncate">{att.name}</p>
                </div>
              </div>
            </div>
          ) : (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors"
              data-testid={`attachment-display-${idx}`}
            >
              <div className="flex flex-col items-center justify-center h-24 gap-1 px-2">
                {getFileIcon(att.type, att.name)}
                <span className="text-xs text-muted-foreground truncate w-full text-center">
                  {att.name}
                </span>
              </div>
            </a>
          )
        ))}
      </div>
    </div>
  );
}
