"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, FileText, Loader2 } from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "CLIENT_SERVICE_AGREEMENT", label: "Client Service Agreement" },
  { value: "LIMITED_POA", label: "Limited Power of Attorney" },
  { value: "AFFIDAVIT", label: "Affidavit" },
  { value: "MOTION", label: "Motion" },
  { value: "COVER_LETTER", label: "Cover Letter" },
  { value: "FILING_PACKET", label: "Filing Packet" },
  { value: "EVIDENCE_PACKET", label: "Evidence Packet" },
  { value: "CLIENT_ID", label: "Client ID" },
  { value: "PROPERTY_DEED", label: "Property Deed" },
  { value: "TAX_RECORD", label: "Tax Record" },
  { value: "OTHER", label: "Other" },
];

interface DocumentUploaderProps {
  caseId: string;
  onSuccess?: () => void;
}

export function DocumentUploader({ caseId, onSuccess }: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("");
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !docType) throw new Error("File and type required");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", docType);

      const { data } = await api.post(`/documents/${caseId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      setFile(null);
      setDocType("");
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to upload document");
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!docType) {
      toast.error("Please select a document type");
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : file
            ? "border-green-500 bg-green-500/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-green-500" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary">Drop the file here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop a file here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (PDF, images, Word docs up to 50MB)
                </p>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleUpload}
          disabled={!file || !docType || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
