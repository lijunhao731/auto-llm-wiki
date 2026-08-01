import * as obsidian from "obsidian";
import LLMWikiPlugin from "../src/main";
import { DEFAULT_SETTINGS, LLMWikiSettingTab } from "../src/settings";

const notices = (obsidian.Notice as unknown as { messages: string[] }).messages;

type Button = { buttonText?: string; disabled?: boolean; onclick?: () => void | Promise<void> };
type Toggle = { value?: boolean; onchange?: (value: boolean) => Promise<void> };

beforeEach(() => {
  notices.length = 0;
  (obsidian as unknown as { __setLanguage(language: string): void }).__setLanguage("en");
  jest.restoreAllMocks();
});

test("settings tab renders Chinese strings when Obsidian language is zh", () => {
  (obsidian as unknown as { __setLanguage(language: string): void }).__setLanguage("zh");
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  expect(texts).toContain("原始文件夹");
  expect(texts).toContain("不可变的源文档。");
});

test("settings tab renders a button for testing the OpenAI connection", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const buttons = (tab.containerEl as unknown as { buttons: Button[] }).buttons;
  expect(buttons.some((button) => button.buttonText === "Test OpenAI connection")).toBe(true);
});

test("auto ingest is disabled by default", () => {
  expect(DEFAULT_SETTINGS.autoIngestEnabled).toBe(false);
});

test("request timeout defaults to 900 seconds", () => {
  expect(DEFAULT_SETTINGS.requestTimeoutMs).toBe(900000);
});

test("auto ingest poll interval defaults to 15 seconds", () => {
  expect(DEFAULT_SETTINGS.autoIngestPollSeconds).toBe(15);
});

test("settings tab renders the auto ingest debounce control", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  expect(texts).toContain("Auto ingest debounce (seconds)");
});

test("settings tab renders the auto ingest poll interval control", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  expect(texts).toContain("Auto ingest poll interval (seconds)");
});

test("settings tab renders the request timeout control in seconds", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  expect(texts).toContain("Request timeout (seconds)");
});

test("settings tab saves the auto ingest toggle", async () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.app = { vault: { on: jest.fn(() => "event") } } as never;
  const saveSettings = jest.spyOn(plugin, "saveSettings").mockResolvedValue();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();
  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  const toggles = (tab.containerEl as unknown as { toggles: Toggle[] }).toggles;
  expect(texts).toContain("Auto ingest raw file changes");
  expect(toggles).toHaveLength(1);
  await toggles[0].onchange!(true);

  expect(plugin.settings.autoIngestEnabled).toBe(true);
  expect(saveSettings).toHaveBeenCalledTimes(1);
});

type TextInput = { value?: string; onchange?: (value: string) => Promise<void> };

function renderTextInputs(): { plugin: LLMWikiPlugin; inputs: TextInput[] } {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  jest.spyOn(plugin, "saveSettings").mockResolvedValue();
  const tab = new LLMWikiSettingTab({} as never, plugin);
  tab.display();
  const inputs = (tab.containerEl as unknown as { textInputs: TextInput[] }).textInputs;
  return { plugin, inputs };
}

test("auto ingest debounce control stores entered seconds as milliseconds", async () => {
  const { plugin, inputs } = renderTextInputs();
  const debounce = inputs.find((input) => input.value === "3")!; // 3000ms / 1000 shown as seconds
  await debounce.onchange!("10");
  expect(plugin.settings.autoIngestDebounceMs).toBe(10000);
});

test("auto ingest poll control stores whole seconds and allows zero", async () => {
  const { plugin, inputs } = renderTextInputs();
  const poll = inputs.find((input) => input.value === "15")!;
  await poll.onchange!("30");
  expect(plugin.settings.autoIngestPollSeconds).toBe(30);
  await poll.onchange!("0");
  expect(plugin.settings.autoIngestPollSeconds).toBe(0);
});

test("request timeout control rejects non-positive input and stores seconds as milliseconds", async () => {
  const { plugin, inputs } = renderTextInputs();
  const timeout = inputs.find((input) => input.value === "900")!; // 900000ms / 1000
  await timeout.onchange!("0");
  expect(plugin.settings.requestTimeoutMs).toBe(900000); // 0 rejected (allowZero=false)
  await timeout.onchange!("-5");
  expect(plugin.settings.requestTimeoutMs).toBe(900000); // negative rejected
  await timeout.onchange!("30");
  expect(plugin.settings.requestTimeoutMs).toBe(30000);
});

test("OpenAI connection test reports success for HTTP 2xx", async () => {
  jest.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 204, text: "" } as never);
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.settings = {
    ...plugin.settings,
    openAIApiUrl: "https://example.test/v1/chat/completions",
    openAIApiKey: "key",
    openAIModel: "model"
  };
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();
  const button = (tab.containerEl as unknown as { buttons: Button[] }).buttons.find((candidate) => candidate.buttonText === "Test OpenAI connection")!;
  await button.onclick!();

  const request = (obsidian.requestUrl as jest.Mock).mock.calls[0][0];
  expect(request.url).toBe("https://example.test/v1/chat/completions");
  expect(request.method).toBe("POST");
  expect(request.headers.Authorization).toBe("Bearer key");
  expect(notices).toContain("OpenAI connection test succeeded.");
  expect(button.disabled).toBe(false);
});

test("OpenAI connection test reports failure for non-2xx without duplicating the English prefix", async () => {
  jest.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 401, text: "bad key" } as never);
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.settings = {
    ...plugin.settings,
    openAIApiUrl: "https://example.test/v1/chat/completions",
    openAIApiKey: "bad",
    openAIModel: "model"
  };
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();
  const button = (tab.containerEl as unknown as { buttons: Button[] }).buttons.find((candidate) => candidate.buttonText === "Test OpenAI connection")!;
  await button.onclick!();

  expect(notices).toContain("OpenAI connection test failed: 401 bad key");
  expect(button.disabled).toBe(false);
});

test("OpenAI connection test reports localized zh failure with raw provider details", async () => {
  (obsidian as unknown as { __setLanguage(language: string): void }).__setLanguage("zh");
  jest.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 401, text: "bad key" } as never);
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.settings = {
    ...plugin.settings,
    openAIApiUrl: "https://example.test/v1/chat/completions",
    openAIApiKey: "bad",
    openAIModel: "model"
  };
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();
  const button = (tab.containerEl as unknown as { buttons: Button[] }).buttons.find((candidate) => candidate.buttonText === "测试 OpenAI 连接")!;
  await button.onclick!();

  expect(notices).toContain("OpenAI 连接测试失败：401 bad key");
  expect(button.disabled).toBe(false);
});

test("OCR settings default to a vision model and inherit-from-main fallback", () => {
  expect(DEFAULT_SETTINGS.ocrApiUrl).toBe("");
  expect(DEFAULT_SETTINGS.ocrApiKey).toBe("");
  expect(DEFAULT_SETTINGS.ocrModel).toBe("");
  expect(DEFAULT_SETTINGS.ocrTimeoutMs).toBe(0);
  expect(DEFAULT_SETTINGS.ocrConcurrency).toBe(2);

  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    openAIApiUrl: "https://api.openai.com/v1/chat/completions",
    openAIApiKey: "main-key",
    openAIModel: "gpt-4.1-mini",
    requestTimeoutMs: 900000
  };
  // Empty OCR overrides must fall back to the main OpenAI settings so legacy users
  // do not have to reconfigure anything for OCR to keep working.
  expect(plugin.getOcrSettings()).toEqual({
    apiKey: "main-key",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    timeoutMs: 900000
  });
});

test("getOcrSettings returns dedicated overrides when set", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    openAIApiKey: "main-key",
    openAIModel: "gpt-4.1-mini",
    requestTimeoutMs: 900000,
    ocrApiKey: "ocr-key",
    ocrModel: "gpt-4o-mini",
    ocrTimeoutMs: 60000
  };
  // URL falls back when empty, the rest overrides the main setting.
  expect(plugin.getOcrSettings()).toEqual({
    apiKey: "ocr-key",
    apiUrl: DEFAULT_SETTINGS.openAIApiUrl,
    model: "gpt-4o-mini",
    timeoutMs: 60000
  });
});

test("settings tab renders OCR controls and the test OCR connection button", () => {
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();

  const texts = (tab.containerEl as unknown as { texts: string[] }).texts;
  const buttons = (tab.containerEl as unknown as { buttons: Button[] }).buttons;
  expect(texts).toContain("OCR");
  expect(texts).toContain("OCR API URL");
  expect(texts).toContain("OCR API key");
  expect(texts).toContain("OCR model");
  expect(texts).toContain("OCR concurrency");
  expect(buttons.some((button) => button.buttonText === "Test OCR connection")).toBe(true);
});

test("OCR concurrency control rejects zero, fractions, and negative input", async () => {
  const { plugin, inputs } = renderTextInputs();
  const concurrency = inputs.find((input) => input.value === "2")!;
  await concurrency.onchange!("0");
  expect(plugin.settings.ocrConcurrency).toBe(2); // 0 rejected
  await concurrency.onchange!("-3");
  expect(plugin.settings.ocrConcurrency).toBe(2); // negative rejected
  await concurrency.onchange!("8");
  expect(plugin.settings.ocrConcurrency).toBe(8);
  await concurrency.onchange!("4.7");
  expect(plugin.settings.ocrConcurrency).toBe(4); // floored
});

test("OCR connection test reports success for the effective OCR endpoint and key", async () => {
  jest.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 204, text: "" } as never);
  const plugin = new (LLMWikiPlugin as unknown as { new(): LLMWikiPlugin })();
  // ocrApiKey is set, openAIApiKey is not — verifies the test targets the OCR fields,
  // not the main ones.
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    openAIApiUrl: "https://example.test/v1/chat/completions",
    openAIApiKey: "main-key",
    openAIModel: "main-model",
    ocrApiKey: "ocr-key",
    ocrModel: "ocr-model"
  };
  const tab = new LLMWikiSettingTab({} as never, plugin);

  tab.display();
  const button = (tab.containerEl as unknown as { buttons: Button[] }).buttons.find((candidate) => candidate.buttonText === "Test OCR connection")!;
  await button.onclick!();

  const request = (obsidian.requestUrl as jest.Mock).mock.calls[0][0];
  expect(request.headers.Authorization).toBe("Bearer ocr-key");
  expect(JSON.parse(request.body).model).toBe("ocr-model");
  expect(notices).toContain("OpenAI connection test succeeded.");
  expect(button.disabled).toBe(false);
});
