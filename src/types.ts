export interface RawFileStateEntry {
  hash: string;
  mtime: number;
  size: number;
}

export type RawFileState = Record<string, RawFileStateEntry>;

export interface LLMWikiPluginData {
  rawFileState?: Record<string, string | RawFileStateEntry>;
}

export interface LLMWikiSettings {
  rawFolder: string;
  wikiFolder: string;
  assetsFolder: string;
  indexPath: string;
  logPath: string;
  openAIApiUrl: string;
  openAIApiKey: string;
  openAIModel: string;
  autoIngestEnabled: boolean;
  autoIngestDebounceMs: number;
  autoIngestPollSeconds: number;
  requestTimeoutMs: number;
  // OCR-specific overrides. When a string/number is empty (or 0 for timeout), the corresponding
  // main OpenAI setting is used so existing users do not have to reconfigure anything to keep
  // OCR working; the dedicated fields exist so vision-heavy ingest can be billed/scaled separately.
  ocrApiUrl: string;
  ocrApiKey: string;
  ocrModel: string;
  ocrTimeoutMs: number;
  ocrConcurrency: number;
}

export type FileOperationKind = "create" | "update" | "append" | "prepend" | "delete";

export interface FileOperation {
  kind: FileOperationKind;
  path: string;
  content: string;
  rationale: string;
}

export interface ChangePlan {
  summary: string;
  operations: FileOperation[];
}

export interface WikiContext {
  index: string;
  log: string;
  sourcePath?: string;
  sourceContent?: string;
  sources?: Array<{ path: string; content: string }>;
  question?: string;
  /** A finished answer to persist verbatim (Save-to-wiki), instead of re-deriving one. */
  answer?: string;
  wikiPages?: Array<{ path: string; content: string }>;
  /** Paths of raw sources that still exist, so lint can detect orphaned wiki pages. */
  rawPaths?: string[];
}
