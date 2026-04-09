import { spawn } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { extname, join, resolve } from "path";
import { TaskProcessingError } from "../task-processing-error.js";

export type CvDocumentInput = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  contentBytes?: Buffer | Uint8Array | null;
};

export type CvExtractionStatus = "extracted" | "partial" | "unsupported" | "failed";
export type CvExtractionMethod =
  | "utf8_plain_text"
  | "pdf_parse"
  | "docx_mammoth"
  | "doc_legacy"
  | "doc_os_conversion"
  | "metadata_only";

export type CvExtractionResult = {
  status: CvExtractionStatus;
  method: CvExtractionMethod;
  providerKey: string;
  text: string | null;
  charCount: number;
  qualityScore: number | null;
  notes: string[];
  errorMessage?: string;
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

export class CvDocumentContentService {
  private readonly storageRoot = this.resolveStorageRoot();
  private readonly moduleRequire = createRequire(import.meta.url);

  async extract(input: CvDocumentInput): Promise<CvExtractionResult> {
    let content: Buffer;
    let filePath: string | null = null;

    if (input.contentBytes && input.contentBytes.byteLength > 0) {
      content = Buffer.from(input.contentBytes);
    } else {
      filePath = this.resolveStoragePath(input.storageKey);

      try {
        content = await readFile(filePath);
      } catch (error) {
        throw new TaskProcessingError(
          "CV_FILE_READ_ERROR",
          "CV dosyasi storage alanindan okunamadi.",
          true,
          {
            storageKey: input.storageKey,
            message: (error as Error).message
          }
        );
      }
    }

    const extension = extname(input.originalName).toLowerCase();
    const normalizedMime = (input.mimeType || "").toLowerCase();

    if (
      extension === ".txt" ||
      normalizedMime === "text/plain" ||
      normalizedMime === "text/markdown"
    ) {
      const decoded = this.normalizeText(content.toString("utf8"));
      return this.toResultFromText({
        method: "utf8_plain_text",
        providerKey: "node_utf8_decoder",
        text: decoded,
        notes: decoded ? [] : ["Dosya okunabildi ancak metin icerigi bos."]
      });
    }

    if (extension === ".pdf" || normalizedMime === "application/pdf") {
      return this.extractPdf(content, filePath);
    }

    if (
      extension === ".docx" ||
      normalizedMime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return this.extractDocx(content, filePath);
    }

    if (extension === ".doc" || normalizedMime === "application/msword") {
      if (!filePath) {
        return {
          status: "unsupported",
          method: "metadata_only",
          providerKey: "doc_requires_filesystem",
          text: null,
          charCount: 0,
          qualityScore: null,
          notes: [
            "Legacy DOC extraction icin worker tarafinda yerel dosya erisimi gerekir.",
            "Bu dosya DB blob fallback ile tasindigi icin parse edilemedi."
          ],
          errorMessage: "doc_file_requires_filesystem"
        };
      }

      return this.extractLegacyDoc(filePath);
    }

    return {
      status: "unsupported",
      method: "metadata_only",
      providerKey: "unsupported_format",
      text: null,
      charCount: 0,
      qualityScore: null,
      notes: [
        "Bu format icin extraction strategy tanimli degil.",
        "Desteklenen formatlar: TXT, PDF, DOCX, DOC."
      ]
    };
  }

  private resolveStorageRoot() {
    const workspaceRoot = resolveWorkspaceRoot();
    const configured = process.env.FILE_STORAGE_ROOT?.trim();
    const raw = configured && configured.length > 0 ? configured : "data/storage";
    return raw.startsWith("/") ? raw : resolve(workspaceRoot, raw);
  }

  private resolveStoragePath(storageKey: string) {
    const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const absolute = resolve(this.storageRoot, normalized);

    if (!absolute.startsWith(this.storageRoot)) {
      throw new TaskProcessingError(
        "CV_STORAGE_KEY_INVALID",
        "CV storage key guvenli degil.",
        false,
        {
          storageKey
        }
      );
    }

    return absolute;
  }

  private normalizeText(input: string) {
    return input
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private toResultFromText(input: {
    method: CvExtractionMethod;
    providerKey: string;
    text: string;
    notes: string[];
    errorMessage?: string;
  }): CvExtractionResult {
    const normalized = this.normalizeText(input.text);
    const charCount = normalized.length;

    if (charCount === 0) {
      return {
        status: input.errorMessage ? "failed" : "partial",
        method: input.method,
        providerKey: input.providerKey,
        text: null,
        charCount: 0,
        qualityScore: 0,
        notes: [...input.notes, "Metin cikarimi bos dondu."],
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
      };
    }

    const qualityScore = this.computeQualityScore(normalized);
    const status = qualityScore >= 0.55 ? "extracted" : "partial";

    return {
      status,
      method: input.method,
      providerKey: input.providerKey,
      text: normalized,
      charCount,
      qualityScore,
      notes: input.notes
    };
  }

  private computeQualityScore(text: string) {
    const chars = text.length;
    const words = text.split(/\s+/g).filter(Boolean).length;

    if (chars === 0) {
      return 0;
    }

    let score = 0.25;
    if (chars > 80) {
      score += 0.2;
    }
    if (chars > 220) {
      score += 0.2;
    }
    if (chars > 500) {
      score += 0.2;
    }
    if (words > 80) {
      score += 0.1;
    }
    if (words > 180) {
      score += 0.05;
    }

    return Math.min(1, Number(score.toFixed(3)));
  }

  private async extractPdf(content: Buffer, absolutePath: string | null): Promise<CvExtractionResult> {
    const notes: string[] = [];

    const pdfParseModule = await this.loadOptionalModule<unknown>("pdf-parse");
    if (pdfParseModule) {
      try {
        const parser = this.resolveCallableExport(pdfParseModule);
        if (parser) {
          const parsed = await parser(content);
          const parsedText =
            parsed && typeof parsed === "object" && "text" in parsed
              ? this.normalizeText(String((parsed as { text?: unknown }).text ?? ""))
              : "";

          if (parsedText.length > 0) {
            return this.toResultFromText({
              method: "pdf_parse",
              providerKey: "pdf-parse",
              text: parsedText,
              notes
            });
          }

          notes.push("pdf-parse ciktisi bos dondu; CLI fallback denendi.");
        } else {
          notes.push("pdf-parse modulu bulundu ancak cagirilabilir export yok.");
        }
      } catch (error) {
        notes.push(`pdf-parse hatasi: ${(error as Error).message}`);
      }
    } else {
      notes.push("pdf-parse modulu kurulu degil.");
    }

    if (!absolutePath) {
      return {
        status: "failed",
        method: "pdf_parse",
        providerKey: "pdf-extract-chain",
        text: null,
        charCount: 0,
        qualityScore: 0,
        notes: [...notes, "PDF icin CLI fallback kullanilamadi; worker tarafinda dosya yolu mevcut degil."],
        errorMessage: "pdf_cli_requires_filesystem"
      };
    }

    const cliResult = await this.runCommandForText("pdftotext", [
      "-layout",
      "-enc",
      "UTF-8",
      absolutePath,
      "-"
    ]);

    if (cliResult.text) {
      return this.toResultFromText({
        method: "pdf_parse",
        providerKey: "pdftotext_cli",
        text: cliResult.text,
        notes
      });
    }

    return {
      status: "failed",
      method: "pdf_parse",
      providerKey: "pdf-extract-chain",
      text: null,
      charCount: 0,
      qualityScore: 0,
      notes: [...notes, "PDF extraction zinciri basarisiz oldu."],
      errorMessage: cliResult.errorMessage ?? "pdf_extraction_failed"
    };
  }

  private async extractDocx(content: Buffer, absolutePath: string | null): Promise<CvExtractionResult> {
    const notes: string[] = [];
    const mammothModule = await this.loadOptionalModule<unknown>("mammoth");

    if (mammothModule) {
      try {
        const mammoth = this.resolveObjectExport(mammothModule);
        const extractor = mammoth?.extractRawText;

        if (typeof extractor === "function") {
          const raw = (await extractor({ buffer: content })) as
            | { value?: unknown; messages?: Array<{ message?: string }> }
            | undefined;
          const text = this.normalizeText(String(raw?.value ?? ""));

          if (text.length > 0) {
            const extractionNotes = [...notes];
            if (Array.isArray(raw?.messages) && raw.messages.length > 0) {
              extractionNotes.push(
                ...raw.messages
                  .map((item) => item?.message?.trim() ?? "")
                  .filter((message) => message.length > 0)
              );
            }

            return this.toResultFromText({
              method: "docx_mammoth",
              providerKey: "mammoth",
              text,
              notes: extractionNotes
            });
          }
        } else {
          notes.push("mammoth modulu bulundu ancak extractRawText fonksiyonu yok.");
        }
      } catch (error) {
        notes.push(`mammoth hatasi: ${(error as Error).message}`);
      }
    } else {
      notes.push("mammoth modulu kurulu degil.");
    }

    if (!absolutePath) {
      return {
        status: "failed",
        method: "docx_mammoth",
        providerKey: "docx-extract-chain",
        text: null,
        charCount: 0,
        qualityScore: 0,
        notes: [...notes, "DOCX icin CLI fallback kullanilamadi; worker tarafinda dosya yolu mevcut degil."],
        errorMessage: "docx_cli_requires_filesystem"
      };
    }

    const cliResult = await this.runCommandForText("textutil", [
      "-convert",
      "txt",
      "-stdout",
      absolutePath
    ]);

    if (cliResult.text) {
      return this.toResultFromText({
        method: "doc_os_conversion",
        providerKey: "textutil",
        text: cliResult.text,
        notes
      });
    }

    return {
      status: "failed",
      method: "docx_mammoth",
      providerKey: "docx-extract-chain",
      text: null,
      charCount: 0,
      qualityScore: 0,
      notes: [...notes, "DOCX extraction zinciri basarisiz oldu."],
      errorMessage: cliResult.errorMessage ?? "docx_extraction_failed"
    };
  }

  private async extractLegacyDoc(absolutePath: string): Promise<CvExtractionResult> {
    const notes: string[] = [];
    const extractorModule = await this.loadOptionalModule<unknown>("word-extractor");

    if (extractorModule) {
      try {
        const Exported = this.resolveConstructorExport(extractorModule);
        if (Exported) {
          const instance = new Exported();
          if (typeof instance.extract === "function") {
            const document = (await instance.extract(absolutePath)) as {
              getBody?: () => string;
            };
            const bodyText =
              typeof document?.getBody === "function"
                ? this.normalizeText(document.getBody())
                : "";

            if (bodyText.length > 0) {
              return this.toResultFromText({
                method: "doc_legacy",
                providerKey: "word-extractor",
                text: bodyText,
                notes
              });
            }
          } else {
            notes.push("word-extractor exportu extract fonksiyonu icermiyor.");
          }
        } else {
          notes.push("word-extractor constructor exportu bulunamadi.");
        }
      } catch (error) {
        notes.push(`word-extractor hatasi: ${(error as Error).message}`);
      }
    } else {
      notes.push("word-extractor modulu kurulu degil.");
    }

    const cliResult = await this.runCommandForText("textutil", [
      "-convert",
      "txt",
      "-stdout",
      absolutePath
    ]);

    if (cliResult.text) {
      return this.toResultFromText({
        method: "doc_os_conversion",
        providerKey: "textutil",
        text: cliResult.text,
        notes: [...notes, "DOC extraction textutil fallback ile tamamlandi."]
      });
    }

    return {
      status: "unsupported",
      method: "metadata_only",
      providerKey: "doc_legacy_fallback",
      text: null,
      charCount: 0,
      qualityScore: 0,
      notes: [
        ...notes,
        "Legacy DOC extraction icin uygun parser/OS araci bulunamadi.",
        "Kurulum sonrasi word-extractor veya textutil ile extraction yeniden denenebilir."
      ],
      errorMessage: cliResult.errorMessage ?? "doc_extraction_not_available"
    };
  }

  private async loadOptionalModule<T>(moduleName: string): Promise<T | null> {
    try {
      const resolved = this.moduleRequire.resolve(moduleName);
      return (await import(resolved)) as T;
    } catch {
      return null;
    }
  }

  private resolveCallableExport(
    moduleValue: unknown
  ): ((input: Buffer) => Promise<unknown>) | null {
    if (typeof moduleValue === "function") {
      return moduleValue as (input: Buffer) => Promise<unknown>;
    }

    if (
      moduleValue &&
      typeof moduleValue === "object" &&
      "default" in moduleValue &&
      typeof (moduleValue as { default?: unknown }).default === "function"
    ) {
      return (moduleValue as { default: (input: Buffer) => Promise<unknown> }).default;
    }

    return null;
  }

  private resolveObjectExport(moduleValue: unknown) {
    if (moduleValue && typeof moduleValue === "object") {
      if (
        "default" in moduleValue &&
        (moduleValue as { default?: unknown }).default &&
        typeof (moduleValue as { default?: unknown }).default === "object"
      ) {
        return (moduleValue as { default: Record<string, unknown> }).default;
      }

      return moduleValue as Record<string, unknown>;
    }

    return null;
  }

  private resolveConstructorExport(
    moduleValue: unknown
  ): (new () => { extract?: (filePath: string) => Promise<unknown> }) | null {
    if (typeof moduleValue === "function") {
      return moduleValue as new () => { extract?: (filePath: string) => Promise<unknown> };
    }

    if (
      moduleValue &&
      typeof moduleValue === "object" &&
      "default" in moduleValue &&
      typeof (moduleValue as { default?: unknown }).default === "function"
    ) {
      return (moduleValue as { default: new () => { extract?: (filePath: string) => Promise<unknown> } })
        .default;
    }

    return null;
  }

  private async runCommandForText(command: string, args: string[]) {
    const timeoutMs = 10_000;

    return new Promise<{ text: string | null; errorMessage?: string }>((resolvePromise) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      const settle = (result: { text: string | null; errorMessage?: string }) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolvePromise(result);
      };

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        settle({
          text: null,
          errorMessage:
            error.code === "ENOENT"
              ? `${command} komutu bulunamadi`
              : `${command} komutu calistirilamadi: ${error.message}`
        });
      });

      child.on("close", (code) => {
        if (timedOut) {
          settle({
            text: null,
            errorMessage: `${command} komutu zaman asimina ugradi (${timeoutMs}ms)`
          });
          return;
        }

        if (code !== 0) {
          settle({
            text: null,
            errorMessage: `${command} exit code ${code ?? -1}: ${stderr.trim().slice(0, 280)}`
          });
          return;
        }

        const text = this.normalizeText(stdout);
        settle({
          text: text.length > 0 ? text : null
        });
      });
    });
  }
}
