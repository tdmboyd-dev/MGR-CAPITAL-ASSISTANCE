"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Loader2, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentUploaderProps {
  caseId: string;
  onUploadSuccess?: () => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

interface UploadedFile {
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
}

export function DocumentUploader({
  caseId,
  onUploadSuccess,
  maxFiles = 10,
  maxSizeMB = 50,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      const formData = new FormData();
      filesToUpload.forEach((file) => formData.append("files", file));
      formData.append("caseId", caseId);

      return api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Documents uploaded successfully", {
        description: `${files.length} file(s) uploaded`,
      });
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "success" as const }))
      );
      onUploadSuccess?.();
      // Clear after delay
      setTimeout(() => setFiles([]), 2000);
    },
    onError: (error: any) => {
      toast.error("Upload failed", {
        description: error.message || "Please try again",
      });
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter(
        (file) => file.size <= maxSizeMB * 1024 * 1024
      );

      if (validFiles.length < acceptedFiles.length) {
        toast.warning("Some files were too large", {
          description: `Max file size is ${maxSizeMB}MB`,
        });
      }

      if (validFiles.length === 0) return;

      setFiles(
        validFiles.map((file) => ({
          name: file.name,
          size: file.size,
          status: "uploading" as const,
        }))
      );

      setUploading(true);
      mutation.mutate(validFiles);
    },
    [maxSizeMB, mutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    maxFiles,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-[1.02]"
            : "border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-900/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {uploading ? (
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          ) : (
            <Upload
              className={`mx-auto h-12 w-12 ${
                isDragActive ? "text-blue-500" : "text-gray-400"
              }`}
            />
          )}
        </motion.div>
        <p className="mt-4 text-lg font-medium">
          {isDragActive
            ? "Drop files here"
            : uploading
            ? "Uploading..."
            : "Drag & drop files or click to upload"}
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          PDF, DOCX, JPG, PNG up to {maxSizeMB}MB each (max {maxFiles} files)
        </p>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div>
                  {file.status === "uploading" && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                  {file.status === "success" && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {file.status === "error" && (
                    <X className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DocumentUploader;
