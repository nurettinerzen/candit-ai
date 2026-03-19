import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from "@nestjs/common";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, extname, join, resolve } from "path";
import {
  CV_ALLOWED_EXTENSIONS,
  CV_ALLOWED_MIME_TYPES,
  DEFAULT_CV_MAX_SIZE_BYTES
} from "./storage.constants";

type UploadValidationInput = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type StoreDocumentInput = {
  tenantId: string;
  candidateId: string;
  documentId: string;
  originalName: string;
  mimeType: string;
  content: Buffer;
};

type StoreDocumentResult = {
  storageKey: string;
  absolutePath: string;
  checksumSha256: string;
  sizeBytes: number;
};

function resolveWorkspaceRoot() {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = resolve(current, "..");

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return process.cwd();
}

function normalizeName(input: string) {
  const trimmed = input.trim().replace(/\s+/g, "_");
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "");
  const fallback = safe.length > 0 ? safe : "cv_dosyasi";

  return fallback.slice(0, 120);
}

function normalizeMime(input: string) {
  return input.trim().toLowerCase();
}

function asSet<T extends string>(items: readonly T[]) {
  return new Set<string>(Array.from(items, (item) => String(item)));
}

@Injectable()
export class FileStorageService {
  private readonly allowedExtensions = asSet(CV_ALLOWED_EXTENSIONS);
  private readonly allowedMimeTypes = asSet(CV_ALLOWED_MIME_TYPES);
  private readonly maxCvSizeBytes = Number(
    process.env.CV_UPLOAD_MAX_SIZE_BYTES ?? DEFAULT_CV_MAX_SIZE_BYTES
  );
  private readonly storageRoot = this.resolveStorageRoot();

  getCvUploadPolicy() {
    return {
      maxSizeBytes: this.maxCvSizeBytes,
      allowedExtensions: CV_ALLOWED_EXTENSIONS,
      allowedMimeTypes: CV_ALLOWED_MIME_TYPES
    };
  }

  validateCvUpload(input: UploadValidationInput) {
    if (!input.originalName || input.originalName.trim().length === 0) {
      throw new BadRequestException("CV dosya adi zorunludur.");
    }

    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BadRequestException("Bos dosya yuklenemez.");
    }

    if (input.sizeBytes > this.maxCvSizeBytes) {
      throw new BadRequestException(
        `CV dosyasi cok buyuk. Maksimum ${(this.maxCvSizeBytes / 1024 / 1024).toFixed(1)} MB.`
      );
    }

    const extension = extname(input.originalName).toLowerCase();
    const mimeType = normalizeMime(input.mimeType || "application/octet-stream");

    if (!this.allowedExtensions.has(extension)) {
      throw new BadRequestException(
        "Desteklenmeyen CV uzantisi. Desteklenen formatlar: PDF, DOC, DOCX, TXT."
      );
    }

    if (!this.allowedMimeTypes.has(mimeType)) {
      throw new BadRequestException(
        "Desteklenmeyen CV dosya tipi. PDF, DOC, DOCX veya TXT yukleyin."
      );
    }

    return {
      extension,
      mimeType
    };
  }

  async storeCandidateCv(input: StoreDocumentInput): Promise<StoreDocumentResult> {
    const normalizedName = normalizeName(input.originalName);
    const extension = extname(normalizedName).toLowerCase();
    const storageKey = join(
      input.tenantId,
      "candidates",
      input.candidateId,
      input.documentId,
      `${input.documentId}${extension || ".bin"}`
    );
    const absolutePath = this.resolveStoragePath(storageKey);
    const checksumSha256 = createHash("sha256").update(input.content).digest("hex");

    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, input.content);
    } catch (error) {
      throw new InternalServerErrorException(
        `CV dosyasi saklanamadi: ${(error as Error).message}`
      );
    }

    return {
      storageKey,
      absolutePath,
      checksumSha256,
      sizeBytes: input.content.byteLength
    };
  }

  async read(storageKey: string) {
    const absolutePath = this.resolveStoragePath(storageKey);
    return readFile(absolutePath);
  }

  async remove(storageKey: string) {
    try {
      await unlink(this.resolveStoragePath(storageKey));
    } catch {
      // orphan cleanup is best-effort
    }
  }

  resolveAbsolutePath(storageKey: string) {
    return this.resolveStoragePath(storageKey);
  }

  private resolveStorageRoot() {
    const workspaceRoot = resolveWorkspaceRoot();
    const configured = process.env.FILE_STORAGE_ROOT?.trim();
    const raw = configured && configured.length > 0 ? configured : "data/storage";
    const absolute = raw.startsWith("/") ? raw : resolve(workspaceRoot, raw);

    return absolute;
  }

  private resolveStoragePath(storageKey: string) {
    const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const absolute = resolve(this.storageRoot, normalized);

    if (!absolute.startsWith(this.storageRoot)) {
      throw new BadRequestException("Gecersiz storage key.");
    }

    return absolute;
  }
}
