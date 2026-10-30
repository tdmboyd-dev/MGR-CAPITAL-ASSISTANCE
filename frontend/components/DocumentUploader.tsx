"use client";
import { DocumentUploader as CaseDocumentUploader } from "@/components/ui/document-uploader";
interface DocumentUploaderProps {
  caseId: string;
  onUploadSuccess?: () => void;
  /** Compatibility only: the vault accepts one file up to 10 MiB. */
  maxFiles?: number;
  maxSizeMB?: number;
}
/** Client screens share the same saved-byte upload contract as staff screens. */
export function DocumentUploader({caseId,onUploadSuccess}: DocumentUploaderProps) {
  return <CaseDocumentUploader caseId={caseId} onSuccess={onUploadSuccess} clientOnly />;
}
