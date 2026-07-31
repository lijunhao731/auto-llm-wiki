# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

Auto LLM Wiki is an Obsidian plugin that maintains a Karpathy-style LLM Wiki. It ingests raw source documents (PDF, Office, HTML, images, text), uses an OpenAI-compatible LLM to create/update wiki markdown pages, supports conversational queries grounded in the wiki, and lints the wiki against current sources. All wiki mutations go through an atomic change-plan pipeline with validation and rollback.

## Commands

- **Build**: `npm run build` (runs `tsc -noEmit -skipLibCheck` then esbuild production bundle)
- **Dev watch**: `npm run dev` (esbuild watch mode with inline sourcemaps)
- **Test all**: `npm test` (Jest with `--runInBand`)
- **Test single file**: `npx jest tests/<filename>.test.ts --runInBand`
- **Test with pattern**: `npx jest -t "test name pattern" --runInBand`
- **Type check only**: `npx tsc -noEmit -skipLibCheck`

## Architecture

### Plugin Lifecycle (`src/main.ts`)

`LLMWikiPlugin` extends Obsidian's `Plugin` and implements `ChatController`. On load it: merges persisted data with `DEFAULT_SETTINGS`, migrates raw file state, normalizes chat state, registers commands/views/listeners, and creates a status bar. Settings, raw file state, and chat state are all persisted together via `saveData`/`loadData`.

### LLM Provider Abstraction (`src/providers/`)

`LLMProvider` interface defines `complete`, `completeVision`, `chat`, and `testConnection`. `OpenAIProvider` is the sole implementation — it uses Obsidian's `requestUrl` with retry logic (exponential backoff for 429/5xx, honors Retry-After), configurable timeout, and `temperature: 0.2`. Errors are typed as `OpenAIProviderError` with kinds: `connection`, `request`, `missing-content`, `invalid-json`, `truncated`, `timeout`. The `complete` method enforces strict JSON (rejects truncation); `completeVision` and `chat` are lenient.

### Document Parsing Pipeline (`src/rawParsers.ts` + `src/rawTracker.ts`)

Parsers are registered as `RawParser` objects and loaded via dynamic `import()` to defer heavy dependencies. Supported formats: HTML, DOCX (mammoth), DOC (word-extractor), XLSX/XLS (@e965/xlsx), RTF (custom parser), PPT (ppt-to-text), PPTX (jszip), PDF (pdf.js with vision OCR fallback), images (vision OCR), and plain text/code.

Change detection uses a three-tier strategy: mtime+size fast-path → binary hash for Office/PDF/images → content hash for text. Scanning runs with concurrency limits (4 for files, 8 for OpenXML entries). Per-file failures are isolated and do not abort the scan.

### Change Plan Pipeline (`src/changePlan.ts` + `src/vaultOps.ts`)

The LLM returns a JSON change plan (`{ summary, operations[] }`). Each operation has `kind` (create/update/append/prepend/delete), `path`, `content`, and `rationale`. Validation enforces: path normalization, write paths inside wiki folder only, raw/assets folders are read-only, index/log cannot be deleted, no conflicting operations on the same path, file existence checks.

`applyChangePlan` snapshots all affected files before writing, and rolls back on any failure. `planHasDestructiveOperation` checks for delete operations — destructive plans always require manual review via `ChangePlanPreviewModal`, even during auto-ingest.

### Chat System (`src/chatView.ts`)

`ChatView` manages multi-conversation state with per-conversation pending tracking (concurrent chats don't block each other). `ChatController` is the narrow interface between view and plugin. Chat history is capped at 12 messages sent to the model; 50 conversations are stored. For wikis with >12 pages, an index-first retrieval step asks the model to select relevant pages before sending context.

### Prompt Construction (`src/prompts.ts`)

All prompts include a JSON contract (`buildJsonContract`) specifying the exact output shape. Delete operations are only offered to the lint prompt. Prompts include a language instruction based on the resolved locale. The `rawFolder` and `assetsFolder` are declared read-only in every prompt.

### Internationalization (`src/i18n.ts`)

Supports 70+ Obsidian language codes with English and Simplified Chinese translations. Locale is resolved from `localStorage` (not `getLanguage()`) for compatibility with `minAppVersion: 1.7.2`. The `t()` function does parameter substitution with `{placeholder}` syntax. When adding new user-facing strings, add both the key to `ENGLISH_TRANSLATIONS` and the translation to `ZH_TRANSLATIONS`.

### Build System (`esbuild.config.mjs`)

Bundles `src/main.ts` → `main.js`. External modules: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, `builtin-modules`. Shims `immediate`/`setImmediate` via `src/shims/` for Obsidian compatibility. Production mode minifies and strips sourcemaps.

## Testing

- Tests use Jest with `ts-jest` preset and a custom Obsidian mock (`tests/obsidianMock.ts`)
- The `obsidian` module is mapped to the mock in `jest.config.cjs` via `moduleNameMapper`
- Tests run with `--runInBand` (sequential execution)
- E2E-style tests exist for ingest, query, and polling flows alongside unit tests

## Key Conventions

- All user-facing strings go through `t()` with translation keys defined in `i18n.ts`
- Path handling uses `normalizePath` from `changePlan.ts` (not Obsidian's `normalizePath`)
- Office/PDF parsers use dynamic imports to avoid loading heavy libraries at startup
- `OpenAIProvider` accepts an injectable `httpClient` and `sleep` for testability
- Status bar messages use localized strings via `t()` and are always reset after operations
