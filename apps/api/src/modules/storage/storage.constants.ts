export const CV_ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"] as const;

export const CV_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/octet-stream"
] as const;

export const DEFAULT_CV_MAX_SIZE_BYTES = 8 * 1024 * 1024;
