// ==UserScript==
// @name         Liko - TTS
// @namespace    https://github.com/awdrrawd
// @version      0.6.0
// @description  Free multilingual text-to-speech for Bondage Club
// @author       Liko
// @match        https://bondageprojects.elementfx.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://www.bondage-europe.com/*
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-start
// ==/UserScript==

(() => {
    "use strict";

    const W = window;
    const MOD_NAME = "Liko - TTS";
    const MOD_VERSION = "0.6.0";
    const SETTINGS_ID = "Liko_TTS_Settings";
    const STORAGE_KEY = "LikoTTS";
    const BUTTON_ID = "lk-tts-trigger-btn";
    const MENU_ID = "lk-tts-quick-menu";
    const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" fill-rule="evenodd" d="M52 3.4c18 .9 31 15 31 34.6v12l3.3 1c14 4 14 25 1.4 30-1.5.7-3.6 1.3-4.7 1.3-1.3 5-3.2 5-6 7v7H49v-4h21c0-2-1-4-6-8V47l3-2.5c6-5 3-19-9-23.5-15-6-28 4-28 17 0 4 .4 5 6 10v18.5c0 18-.1 18.5-2.5 21-5 5-12 2-14-4.5C5 80 2 68 6 59c2-4 6-7 13-9V38C19 18 34 2.5 52 3.4ZM23 65c0 18 .4 20 4.5 20 4.3 0 4.5-2 4.5-20 0-17-1-19-4.7-19-4 0-4.4 3-4.3 19Zm45 0c0 18 .4 20 4.5 20 4.3 0 4.5-2 4.5-20 0-17-1-19-4.7-19-4 0-4.4 3-4.3 19Z"/></svg>`;
    const ICON_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ICON_SVG.replace("currentColor", "#111111"))}`;

    // Duplicate-load guard following the repository plugin convention. An identical
    // version is ignored; a newer injected version cleanly replaces the old instance.
    if (W.LikoTTS?.version === MOD_VERSION) {
        console.warn(`🐈‍⬛ [TTS] v${MOD_VERSION} is already loaded; duplicate import skipped.`);
        return;
    }
    try { W.LikoTTS?.unload?.("version-replace"); } catch (error) { console.warn("🐈‍⬛ [TTS] old instance unload failed", error); }

    const defaults = {
        enabled: false,
        ownMessages: false,
        speakSender: true,
        messageTypes: { Chat: true, Whisper: true, Emote: true },
        multilingual: true,
        unsupported: "skip", // skip | base
        maxLength: 350,
        longMessage: "truncate", // truncate | skip
        rate: 1,
        pitch: 1,
        volume: 1,
        baseLang: "zh-TW",
        voiceByLang: {},
        playerVoices: {},
        randomPlayerVoices: true,
        voiceGender: "female", // female | male | mixed
        chatButton: true,
        filteredPrefixesEnabled: true,
        filteredPrefixes: "[🌐];🔊;📞",
        kokoro: { enabled: false, device: "auto", dtype: "auto", workerUrl: "" },
    };
    let config = structuredClone(defaults);
    let modApi = null;
    let disposed = false;
    let initialized = false;
    let queue = [];
    let speaking = false;
    let generation = 0;
    let voices = [];
    let voiceTimer = null;
    let messageHookTimer = null;
    let messageHookInstalled = false;
    let loginReadyTimer = null;
    let removeLoginHook = null;
    let kokoroWorker = null;
    let kokoroWorkerUrl = "";
    let kokoroReady = false;
    let kokoroLoading = false;
    let kokoroInstalledVoices = new Set();
    const kokoroPending = new Map();
    const cleanups = [];
    const sessionPlayerVoices = new Map();

    // All user-facing copy goes through keys from the start. A later locale file can
    // replace this table without searching through rendering and speech logic.
    const T_ZH = {
        title: "Liko TTS v{version}", back: "返回", tabBasic: "基本設定", tabVoices: "語言與語音", tabPacks: "擴充語音包", tabPersonal: "個人語音設定", tabAdvanced: "進階設定",
        masterOn: "TTS：已啟用", masterOff: "TTS：已停用",
        helpBasic: "設定要朗讀的訊息種類。所有選項都只影響自己的瀏覽器，不會把語音或設定傳給其他玩家。",
        helpVoices: "從下拉選單選擇語系，再指定系統已安裝的語音。若清單為空，請先到作業系統安裝語音，再重新掃描。",
        helpPacks: "Kokoro 使用一個共用模型，各語系聲音包則分開下載。自架網址必須提供與內建 Kokoro 相同的 Worker 訊息協定並允許跨來源讀取；留空即使用內建來源。實際選聲統一由「語言與語音」管理。",
        helpPersonal: "可依用戶 ID 覆寫語系、聲線、語速、語調與音量。自己的 ID 固定置頂；沒有保存覆寫的玩家會繼續使用一般設定。",
        helpAdvanced: "混合語句會依書寫系統分段，再切換到對應語音。不支援的片段建議跳過，以避免錯誤朗讀與雜訊。",
        ownMessages: "朗讀自己的訊息", ownMessagesDesc: "關閉時只朗讀其他玩家的訊息。",
        speakSender: "朗讀發言者名稱", speakSenderDesc: "名稱與主要語系正文會沿用同一位玩家的聲線。",
        speakVerbZh: "說", speakVerbEn: " says ", speakVerbJa: "は", speakVerbKo: "이 말합니다. ", speakVerbRu: " говорит: ", speakVerbAr: " يقول: ", speakVerbHi: " कहता है: ", speakVerbTh: "พูดว่า ", speakVerbEl: " λέει: ", speakVerbHe: " אומר: ",
        readChat: "朗讀聊天訊息", readChatDesc: "朗讀一般 Chat 訊息。", readWhisper: "朗讀悄悄話", readWhisperDesc: "朗讀收到的 Whisper 訊息。",
        readEmote: "朗讀動作訊息", readEmoteDesc: "朗讀 Emote 類型的角色動作。", chatButton: "顯示聊天室快捷按鈕", chatButtonDesc: "在 CRB 加入 TTS 快捷按鈕。",
        voiceTest: "This is a voice test", playTest: "試聽", playTestDesc: "使用目前畫面選擇的聲線與參數播放測試句。", testText: "測試句",
        primaryLanguage: "自己的主要語系", primaryLanguageDesc: "玩家名稱、英文與這個主要語系會優先沿用同一位玩家的聲線。",
        language: "設定語系", followPrimaryLanguage: "↪ 跟隨主語系", selectVoice: "選擇語音", systemDefaultVoice: "系統預設語音", noVoice: "此語系尚未安裝可用語音", noVoiceHelp: "請到作業系統的語言或語音設定下載，再重新掃描。",
        rescan: "重新掃描系統語音", voicesFound: "已找到 {count} 個系統語音",
        multilingual: "自動切換語系語音", multilingualDesc: "依 Unicode 書寫系統切分混合語句。",
        randomVoices: "為玩家分配固定聲線", randomVoicesDesc: "依用戶編號穩定分配聲線；名稱、英文與主要語系正文會保持一致。可用語音清單不變時，重新載入仍會得到同一聲線。",
        voiceGender: "玩家聲線性別", voiceGenderFemale: "女聲（預設）", voiceGenderMale: "男聲", voiceGenderMixed: "混合", voiceGenderDesc: "女聲模式會排除已知男聲；只有明確選擇男聲或混合時，才會為其他玩家分配男聲。手動選取的語音不受此項限制。",
        unsupported: "沒有可用語音的片段", unsupportedSkip: "跳過（建議）", unsupportedBase: "使用主要語音", unsupportedDesc: "只影響找不到相符語系語音的片段；已安裝對應語音的語言屬於支援語言。跳過可避免錯誤朗讀與雜訊。",
        longMessage: "過長訊息", truncate: "截斷", skipAll: "整段跳過", longMessageDesc: "決定超過最大字數時的行為。",
        maxLength: "最大字數", maxLengthDesc: "每格 25 字，範圍 25–1000 字。", rate: "語速", pitch: "語調", volume: "音量",
        filteredPrefixesEnabled: "過濾帶特定開頭句子", filteredPrefixesEnabledDesc: "開啟時，符合下一列任一開頭的訊息不會朗讀。關閉時保留已輸入的內容。", filteredPrefixes: "設定過濾開頭", filteredPrefixesDesc: "使用分號分隔多個開頭，例如：[🌐];🔊;📞。",
        kokoroEnabled: "啟用 Kokoro", kokoroCompute: "Kokoro 運算", kokoroWorkerUrl: "自架 Worker 網址",
        kokoroAuto: "運算-AUTO", kokoroWebGPU: "運算-WebGPU", kokoroWasm: "運算-WASM", kokoroDtypeAuto: "精度-AUTO", kokoroFp32: "精度-FP32（高）", kokoroQ8: "精度-Q8（普通）",
        kokoroRemove: "移除語音包", kokoroRemoveDone: "完成移除", kokoroVoicePrefix: "Kokoro", kokoroModelLoading: "正在下載並載入 Kokoro 共用模型", kokoroModelReady: "Kokoro 共用模型已就緒", kokoroDownloading: "正在下載 {name}（{done}/{total}）", kokoroDownloaded: "{name} 語音包下載完成", kokoroRemoved: "已移除 {name} 語音包", kokoroDownloadFailed: "Kokoro 處理失敗：{message}",
        personalTarget: "用戶ID", personalLanguage: "個人語系", personalVoice: "個人語音", personalRate: "個人語速", personalPitch: "個人語調", personalVolume: "個人音量", personalSave: "保存覆寫", personalClear: "使用預設",
        enabledNotice: "TTS 已啟用", disabledNotice: "TTS 已停用", enabled: "啟用", disabled: "停用", clearVoice: "清除語音", settings: "前往設定",
        stateOn: "開", stateOff: "關",
        langZh: "🇹🇼 中文", langJa: "🇯🇵 日本語", langKo: "🇰🇷 한국어", langRu: "🇷🇺 Русский", langAr: "🇸🇦 العربية", langHi: "🇮🇳 हिन्दी", langTh: "🇹🇭 ไทย", langEl: "🇬🇷 Ελληνικά", langHe: "🇮🇱 עברית", langEn: "🇺🇸 English / Latin",
        testZh: "這是一段中文語音測試。", testJa: "これは日本語の音声テストです。", testKo: "한국어 음성 테스트입니다.", testRu: "Это проверка русского голоса.", testAr: "هذا اختبار للصوت العربي.", testHi: "यह हिन्दी आवाज़ का परीक्षण है।", testTh: "นี่คือการทดสอบเสียงภาษาไทย", testEl: "Αυτή είναι μια δοκιμή ελληνικής φωνής.", testHe: "זהו מבחן קול בעברית.", testEn: "This is an English voice test.",
    };
    const T_EN = {
        ...T_ZH,
        back: "Back", tabBasic: "Basic", tabVoices: "Languages & Voices", tabPacks: "Extended Voice Packs", tabPersonal: "Personal Voices", tabAdvanced: "Advanced",
        masterOn: "TTS: Enabled", masterOff: "TTS: Disabled",
        helpBasic: "Choose which message types are spoken. These settings only affect your browser and are never sent to other players.",
        helpVoices: "Choose a language, then select an installed system or Kokoro voice. Rescan after installing new system voices.",
        helpPacks: "Kokoro uses one shared model with separately downloaded language voice packs. A custom URL must implement the same Worker message protocol and allow cross-origin access. Leave it blank to use the built-in source.",
        helpPersonal: "Override language, voice, rate, pitch, and volume for a member ID. Your ID is always first; players without an override use the normal settings.",
        helpAdvanced: "Mixed-language text is split by writing system and spoken with matching voices. Skipping unsupported segments prevents incorrect speech and noise.",
        ownMessages: "Read my messages", ownMessagesDesc: "When off, only messages from other players are read.", speakSender: "Read speaker names", speakSenderDesc: "The name and main-language text use the same player voice.",
        readChat: "Read chat messages", readChatDesc: "Read normal Chat messages.", readWhisper: "Read whispers", readWhisperDesc: "Read received Whisper messages.", readEmote: "Read emotes", readEmoteDesc: "Read character Emote messages.", chatButton: "Show chat shortcut", chatButtonDesc: "Add a TTS shortcut button to CRB.",
        voiceTest: "This is a voice test", playTest: "Test", playTestDesc: "Play the test sentence using the voice and parameters currently shown.", testText: "Test sentence",
        primaryLanguage: "My primary language", primaryLanguageDesc: "Player names, English, and this primary language prefer the same player voice.", language: "Configure language", followPrimaryLanguage: "↪ Follow primary language", selectVoice: "Select voice", systemDefaultVoice: "System default", noVoice: "No installed voice for this language", noVoiceHelp: "Install a voice in your operating system, then rescan.",
        rescan: "Rescan system voices", voicesFound: "Found {count} system voices",
        multilingual: "Automatic language switching", multilingualDesc: "Split mixed text by Unicode writing system.", randomVoices: "Assign stable player voices", randomVoicesDesc: "Assign a stable voice from the member number. Names, English, and primary-language text remain consistent.",
        voiceGender: "Player voice gender", voiceGenderFemale: "Female (default)", voiceGenderMale: "Male", voiceGenderMixed: "Mixed", voiceGenderDesc: "Female mode excludes known male voices. Manually selected voices are unaffected.",
        unsupported: "Unsupported segments", unsupportedSkip: "Skip (recommended)", unsupportedBase: "Use primary voice", unsupportedDesc: "Controls segments with no matching installed voice. Skipping avoids incorrect speech and noise.", longMessage: "Long messages", truncate: "Truncate", skipAll: "Skip entire message", longMessageDesc: "Choose what happens when a message exceeds the character limit.",
        maxLength: "Maximum characters", maxLengthDesc: "25 characters per step, from 25 to 1000.", rate: "Rate", pitch: "Pitch", volume: "Volume",
        filteredPrefixesEnabled: "Filter messages by prefix", filteredPrefixesEnabledDesc: "When enabled, messages matching any prefix on the next row are not spoken. Disabling preserves the entered list.", filteredPrefixes: "Prefix list", filteredPrefixesDesc: "Separate prefixes with semicolons, for example: [🌐];🔊;📞.",
        kokoroEnabled: "Enable Kokoro", kokoroCompute: "Kokoro compute", kokoroWorkerUrl: "Custom Worker URL", kokoroAuto: "Compute-AUTO", kokoroWebGPU: "Compute-WebGPU", kokoroWasm: "Compute-WASM", kokoroDtypeAuto: "Precision-AUTO", kokoroFp32: "Precision-FP32 (High)", kokoroQ8: "Precision-Q8 (Normal)",
        kokoroRemove: "Remove voice packs", kokoroRemoveDone: "Finish removing", kokoroModelLoading: "Downloading and loading the shared Kokoro model", kokoroModelReady: "Kokoro shared model is ready", kokoroDownloading: "Downloading {name} ({done}/{total})", kokoroDownloaded: "Downloaded {name} voice pack", kokoroRemoved: "Removed {name} voice pack", kokoroDownloadFailed: "Kokoro failed: {message}",
        personalTarget: "Member ID", personalLanguage: "Personal language", personalVoice: "Personal voice", personalRate: "Personal rate", personalPitch: "Personal pitch", personalVolume: "Personal volume", personalSave: "Save override", personalClear: "Use defaults",
        enabledNotice: "TTS enabled", disabledNotice: "TTS disabled", enabled: "Enable", disabled: "Disable", clearVoice: "Clear speech", settings: "Open settings", stateOn: "On", stateOff: "Off",
        langZh: "🇹🇼 Chinese", langJa: "🇯🇵 Japanese", langKo: "🇰🇷 Korean", langRu: "🇷🇺 Russian", langAr: "🇸🇦 Arabic", langHi: "🇮🇳 Hindi", langTh: "🇹🇭 Thai", langEl: "🇬🇷 Greek", langHe: "🇮🇱 Hebrew", langEn: "🇺🇸 English / Latin",
    };
    const chineseUI = () => /^(?:CN|TW|ZH[-_](?:CN|TW))$/i.test(String(W.TranslationLanguage || navigator.language || ""));
    const ui = (key, vars = {}) => {
        const table = chineseUI() ? T_ZH : T_EN;
        return String(table[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
    };

    const LANGS = [
        ["zh", "langZh", /\p{Script=Han}/u], ["ja", "langJa", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
        ["ko", "langKo", /\p{Script=Hangul}/u], ["ru", "langRu", /\p{Script=Cyrillic}/u],
        ["ar", "langAr", /\p{Script=Arabic}/u], ["hi", "langHi", /\p{Script=Devanagari}/u],
        ["th", "langTh", /\p{Script=Thai}/u], ["el", "langEl", /\p{Script=Greek}/u],
        ["he", "langHe", /\p{Script=Hebrew}/u], ["en", "langEn", /\p{Script=Latin}/u],
    ];
    const KOKORO_VOICE_BASE = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/";
    const KOKORO_WORKER_URL = "https://katkammand.gitlab.io/tts/kokoro-tts/workerEsm.js";
    const KOKORO_PACKS = Object.freeze({
        zh: { label: "🇨🇳 中文", voices: ["zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang"] },
        ja: { label: "🇯🇵 日本語", voices: ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"] },
        en_us: { label: "🇺🇸 English (US)", voices: ["af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa"] },
        en_gb: { label: "🇬🇧 English (UK)", voices: ["bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis"] },
        es: { label: "🇪🇸 Español", voices: ["ef_dora", "em_alex", "em_santa"] },
        fr: { label: "🇫🇷 Français", voices: ["ff_siwis"] },
        hi: { label: "🇮🇳 हिन्दी", voices: ["hf_alpha", "hf_beta", "hm_omega", "hm_psi"] },
        it: { label: "🇮🇹 Italiano", voices: ["if_sara", "im_nicola"] },
        pt: { label: "🇧🇷 Português", voices: ["pf_dora", "pm_alex", "pm_santa"] },
    });
    const kokoroLang = packId => packId.startsWith("en_") ? "en" : packId;
    function kokoroVoiceOptions(lang) {
        const wanted = primaryLang(lang);
        return Object.entries(KOKORO_PACKS).flatMap(([packId, pack]) => pack.voices
            .filter(id => kokoroInstalledVoices.has(id) && primaryLang(kokoroLang(packId)) === wanted)
            .map(id => ({ name: `${ui("kokoroVoicePrefix")} · ${id}`, lang: kokoroLang(packId), voiceURI: `kokoro:${id}`, localService: true, default: false })));
    }
    async function downloadKokoroPack(packId) {
        const pack = KOKORO_PACKS[packId];
        if (!pack) return;
        const cache = await caches.open("kokoro-voices");
        for (let index = 0; index < pack.voices.length; index++) {
            const url = `${KOKORO_VOICE_BASE}${pack.voices[index]}.bin`;
            if (!await cache.match(url)) {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${pack.voices[index]}`);
                await cache.put(url, response);
            }
            if (index === 0) notify(ui("kokoroDownloading", { name: pack.label, done: 0, total: pack.voices.length }));
        }
        notify(ui("kokoroDownloaded", { name: pack.label }));
    }
    async function removeKokoroPack(packId) {
        const pack = KOKORO_PACKS[packId];
        if (!pack) return;
        const cache = await caches.open("kokoro-voices");
        await Promise.all(pack.voices.map(voice => cache.delete(`${KOKORO_VOICE_BASE}${voice}.bin`)));
        notify(ui("kokoroRemoved", { name: pack.label }));
    }
    async function installedKokoroPacks() {
        const cache = await caches.open("kokoro-voices");
        const installed = new Set();
        const installedVoices = new Set();
        for (const [packId, pack] of Object.entries(KOKORO_PACKS)) {
            const states = await Promise.all(pack.voices.map(voice => cache.match(`${KOKORO_VOICE_BASE}${voice}.bin`)));
            states.forEach((state, index) => { if (state) installedVoices.add(pack.voices[index]); });
            if (states.every(Boolean)) installed.add(packId);
        }
        kokoroInstalledVoices = installedVoices;
        settingsScreen?._populateVoiceSelect?.();
        return installed;
    }
    function stopKokoroWorker() {
        kokoroWorker?.terminate(); kokoroWorker = null; kokoroReady = false; kokoroLoading = false;
        for (const pending of kokoroPending.values()) pending.reject(new Error("Kokoro stopped"));
        kokoroPending.clear();
        if (kokoroWorkerUrl) URL.revokeObjectURL(kokoroWorkerUrl);
        kokoroWorkerUrl = "";
    }
    async function startKokoroWorker() {
        if (kokoroReady || kokoroLoading) return;
        kokoroLoading = true; notify(ui("kokoroModelLoading"));
        try {
            const workerUrl = String(config.kokoro.workerUrl || KOKORO_WORKER_URL).trim();
            const parsedUrl = new URL(workerUrl, location.href);
            if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("Worker URL must use HTTP or HTTPS");
            const response = await fetch(parsedUrl.href, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const workerSource = await response.text();
            if (disposed || !config.kokoro.enabled) { kokoroLoading = false; return; }
            kokoroWorkerUrl = URL.createObjectURL(new Blob([workerSource], { type: "application/javascript" }));
            kokoroWorker = new Worker(kokoroWorkerUrl, { type: "module" });
            await new Promise((resolve, reject) => {
                kokoroWorker.addEventListener("message", event => {
                    if (event.data?.type === "ready") resolve();
                    else if (event.data?.type === "error") reject(new Error(String(event.data?.data || "worker error")));
                    else if (event.data?.type === "complete") {
                        const pending = kokoroPending.get(event.data.requestId);
                        if (pending) { kokoroPending.delete(event.data.requestId); pending.resolve(event.data.audio); }
                    }
                });
                kokoroWorker.addEventListener("error", event => reject(new Error(event.message || "worker error")), { once: true });
            });
            kokoroReady = true; notify(ui("kokoroModelReady"));
        } catch (error) {
            stopKokoroWorker(); config.kokoro.enabled = false; saveConfig();
            notify(ui("kokoroDownloadFailed", { message: error?.message || error }));
        } finally { kokoroLoading = false; }
    }
    async function kokoroAudio(text, voiceURI, params = {}) {
        if (!config.kokoro.enabled) throw new Error("Kokoro is disabled");
        if (!kokoroReady && kokoroLoading) await waitFor(() => kokoroReady || !kokoroLoading, 600000);
        if (!kokoroReady) await startKokoroWorker();
        if (!kokoroReady || !kokoroWorker) throw new Error("Kokoro is not ready");
        const requestId = crypto.randomUUID();
        const audioUrl = await new Promise((resolve, reject) => {
            kokoroPending.set(requestId, { resolve, reject });
            kokoroWorker.postMessage({ type: "generate", requestId, text: text.trim(), voiceId: voiceURI.slice(7) });
        });
        await new Promise(resolve => {
            const audio = new Audio(audioUrl); audio.volume = params.volume ?? config.volume; audio.playbackRate = params.rate ?? config.rate;
            audio.onended = resolve; audio.onerror = resolve;
            void audio.play().catch(resolve);
        });
        URL.revokeObjectURL(audioUrl);
    }
    const primaryLang = lang => String(lang || "").toLowerCase().split(/[-_]/)[0];
    const speakVerb = () => ui({ zh: "speakVerbZh", en: "speakVerbEn", ja: "speakVerbJa", ko: "speakVerbKo", ru: "speakVerbRu", ar: "speakVerbAr", hi: "speakVerbHi", th: "speakVerbTh", el: "speakVerbEl", he: "speakVerbHe" }[primaryLang(config.baseLang)] || "speakVerbEn");

    function mergeConfig(raw) {
        if (!raw || typeof raw !== "object") return structuredClone(defaults);
        const merged = {
            ...structuredClone(defaults), ...raw,
            messageTypes: { ...defaults.messageTypes, ...(raw.messageTypes || {}) },
            voiceByLang: { ...(raw.voiceByLang || {}) },
            playerVoices: { ...(raw.playerVoices || {}) },
            kokoro: { ...defaults.kokoro, ...(raw.kokoro || {}) },
        };
        merged.maxLength = Math.min(1000, Math.max(25, Math.round(merged.maxLength / 25) * 25));
        if (!["female", "male", "mixed"].includes(merged.voiceGender)) merged.voiceGender = "female";
        return merged;
    }
    function loadConfig() {
        try {
            const raw = W.Player?.ExtensionSettings?.[STORAGE_KEY];
            config = mergeConfig(typeof raw === "string" ? JSON.parse(raw) : raw);
        } catch (error) { console.warn("🐈‍⬛ [TTS] settings could not be read", error); }
    }
    function saveConfig() {
        try {
            W.Player.ExtensionSettings ??= {};
            W.Player.ExtensionSettings[STORAGE_KEY] = JSON.stringify(config);
            if (typeof W.ServerPlayerExtensionSettingsSync === "function") W.ServerPlayerExtensionSettingsSync(STORAGE_KEY);
        } catch (error) { console.warn("🐈‍⬛ [TTS] settings could not be saved", error); }
    }
    function refreshVoices() {
        voices = [...(W.speechSynthesis?.getVoices?.() || [])].sort((a, b) =>
            a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
        settingsScreen._populateVoiceSelect?.();
        return voices;
    }
    function voiceFor(lang) {
        const wanted = primaryLang(lang);
        const uri = config.voiceByLang[wanted] || (wanted === primaryLang(config.baseLang) ? config.voiceByLang.default : "");
        return [...voices, ...(config.kokoro.enabled ? kokoroVoiceOptions(wanted) : [])].find(v => v.voiceURI === uri)
            || preferredVoices(wanted)[0]
            || null;
    }
    const FEMALE_VOICE = /female|woman|hanhan|yating|huihui|yaoyao|xiaoxiao|xiaoyi|aria|jenny|zira|hazel|samantha|victoria|kyoko|haruka|heami/i;
    const MALE_VOICE = /\bmale\b|\bman\b|zhiwei|yunxi|yunyang|david|mark|george|daniel|ichiro/i;
    function preferredVoices(lang) {
        const matching = [...voices.filter(voice => primaryLang(voice.lang) === primaryLang(lang)), ...(config.kokoro.enabled ? kokoroVoiceOptions(lang) : [])];
        return matching.sort((a, b) => {
            const score = voice => FEMALE_VOICE.test(voice.name) ? 0 : MALE_VOICE.test(voice.name) ? 2 : 1;
            return score(a) - score(b) || Number(b.default) - Number(a.default) || a.name.localeCompare(b.name);
        });
    }
    function playerVoiceFor(speakerId) {
        const base = primaryLang(config.baseLang);
        const personal = speakerId != null ? config.playerVoices[String(speakerId)] : null;
        if (personal?.voiceURI) {
            const lang = personal.lang || base;
            const selected = [...voices, ...kokoroVoiceOptions(lang)].find(voice => voice.voiceURI === personal.voiceURI);
            if (selected) return selected;
        }
        // TTS-MAIN uses the configured/default voice unless a different player voice
        // was assigned. Always let the local player hear exactly the voice selected in UI.
        if (speakerId === W.Player?.MemberNumber) return voiceFor(base);
        if (!config.randomPlayerVoices || speakerId == null) return voiceFor(base);
        const key = `${speakerId}:${base}`;
        const cachedUri = sessionPlayerVoices.get(key);
        const cached = [...voices, ...(config.kokoro.enabled ? kokoroVoiceOptions(base) : [])].find(voice => voice.voiceURI === cachedUri);
        if (cached) return cached;
        const candidates = preferredVoices(base);
        if (!candidates.length) return voiceFor(base);
        // Stable pseudo-random assignment: the same member keeps the same voice across
        // reloads as long as the available voice set is unchanged (closer to TTS-MAIN's
        // familiar per-player voice behaviour than choosing again on every injection).
        const seed = [...key].reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0, 2166136261);
        const female = candidates.filter(voice => FEMALE_VOICE.test(voice.name));
        const male = candidates.filter(voice => MALE_VOICE.test(voice.name));
        const neutral = candidates.filter(voice => !FEMALE_VOICE.test(voice.name) && !MALE_VOICE.test(voice.name));
        let pool;
        if (config.voiceGender === "male") pool = male.length ? male : neutral.length ? neutral : candidates;
        else if (config.voiceGender === "mixed") pool = seed % 10 < 8 && female.length ? female : male.length ? male : female.length ? female : neutral.length ? neutral : candidates;
        else pool = female.length ? female : neutral.length ? neutral : candidates.filter(voice => !MALE_VOICE.test(voice.name));
        if (!pool.length) pool = candidates;
        const chosen = pool[Math.floor(seed / 10) % pool.length];
        sessionPlayerVoices.set(key, chosen.voiceURI);
        return chosen;
    }

    function scriptOf(char) {
        if (/\s|[\p{P}\p{S}\p{N}\p{M}]/u.test(char)) return "neutral";
        for (const [lang, , regex] of LANGS) if (regex.test(char)) return lang;
        return "unsupported";
    }
    function segmentText(input, speakerId = null) {
        const text = String(input || "").normalize("NFKC").replace(/https?:\/\/\S+/gi, " link ").replace(/\s+/g, " ").trim();
        if (!config.multilingual) {
            const voice = playerVoiceFor(speakerId);
            return text ? [{ lang: primaryLang(config.baseLang), text, voiceURI: voice?.voiceURI }] : [];
        }
        const chars = [...text];
        // Han is shared by Chinese and Japanese. Within a punctuation/space-delimited token,
        // the presence of kana is strong enough evidence to keep its kanji in the Japanese chunk.
        const japaneseHan = new Set();
        let tokenStart = 0;
        for (let i = 0; i <= chars.length; i++) {
            if (i < chars.length && !/[\s\p{P}]/u.test(chars[i])) continue;
            const token = chars.slice(tokenStart, i);
            if (token.some(char => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char))) {
                token.forEach((char, offset) => { if (/\p{Script=Han}/u.test(char)) japaneseHan.add(tokenStart + offset); });
            }
            tokenStart = i + 1;
        }
        const chunks = [];
        let pending = "";
        chars.forEach((char, index) => {
            const kind = japaneseHan.has(index) ? "ja" : scriptOf(char);
            if (kind === "neutral") { pending += char; return; }
            const last = chunks.at(-1);
            if (last?.lang === kind) last.text += pending + char;
            else chunks.push({ lang: kind, text: pending + char });
            pending = "";
        });
        if (pending) {
            if (chunks.length) chunks.at(-1).text += pending;
            else chunks.push({ lang: primaryLang(config.baseLang), text: pending });
        }
        const base = primaryLang(config.baseLang);
        const playerVoice = playerVoiceFor(speakerId);
        const resolved = chunks.flatMap(chunk => {
            // The speaker name is normally Latin. Keep Latin and the user's main language
            // on the same assigned player voice; truly foreign scripts still switch voice.
            if ((chunk.lang === "en" || chunk.lang === base) && playerVoice) return { ...chunk, voiceURI: playerVoice.voiceURI };
            const matchingVoice = chunk.lang !== "unsupported" ? voiceFor(chunk.lang) : null;
            if (matchingVoice) return { ...chunk, voiceURI: matchingVoice.voiceURI };
            if (config.unsupported === "base") {
                const baseVoice = voiceFor(base);
                return { ...chunk, lang: base, voiceURI: baseVoice?.voiceURI };
            }
            return [];
        }).filter(chunk => chunk.text.trim());
        // Script detection may split "Liko Bot說你好" into Latin and Han chunks. If both
        // resolve to the same voice, keep them in one utterance so no synthetic pause is added.
        const merged = resolved.reduce((merged, chunk) => {
            const previous = merged.at(-1);
            if (previous && previous.voiceURI && previous.voiceURI === chunk.voiceURI) previous.text += chunk.text;
            else merged.push({ ...chunk });
            return merged;
        }, []);
        const personal = speakerId != null ? config.playerVoices[String(speakerId)] : null;
        return merged.map(chunk => ({ ...chunk, rate: personal?.rate, pitch: personal?.pitch, volume: personal?.volume }));
    }

    function clearSpeech() {
        generation++;
        queue = [];
        speaking = false;
        W.speechSynthesis?.cancel?.();
    }
    function speakChunk(item, token) {
        if (item.voiceURI?.startsWith("kokoro:")) {
            return kokoroAudio(item.text, item.voiceURI, item).catch(error => console.warn("🐈‍⬛ [TTS] Kokoro speech failed", error));
        }
        return new Promise(resolve => {
            if (disposed || token !== generation || !config.enabled) return resolve();
            const voice = voices.find(candidate => candidate.voiceURI === item.voiceURI) || voiceFor(item.lang);
            if (!voice && config.unsupported === "skip") return resolve();
            const utterance = new SpeechSynthesisUtterance(item.text);
            if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
            else utterance.lang = config.baseLang;
            utterance.rate = item.rate ?? config.rate;
            utterance.pitch = item.pitch ?? config.pitch;
            utterance.volume = item.volume ?? config.volume;
            utterance.onend = resolve;
            utterance.onerror = resolve;
            W.speechSynthesis.speak(utterance);
        });
    }
    async function drainQueue() {
        if (speaking || disposed) return;
        speaking = true;
        const token = generation;
        while (queue.length && token === generation && config.enabled) {
            const chunks = queue.shift();
            for (const chunk of chunks) await speakChunk(chunk, token);
        }
        speaking = false;
    }
    function enqueue(text, speakerId = null) {
        if (!config.enabled || !text) return;
        const visibleLength = [...text].length;
        if (visibleLength > config.maxLength) {
            if (config.longMessage === "skip") return;
            text = [...text].slice(0, config.maxLength).join("") + "…";
        }
        const chunks = segmentText(text, speakerId);
        if (chunks.length) { queue.push(chunks); void drainQueue(); }
    }
    async function testConfiguredVoice(text) {
        if (!text?.trim()) return;
        clearSpeech();
        const token = generation;
        const chunks = segmentText(text.trim(), null);
        for (const chunk of chunks) {
            if (token !== generation || disposed) return;
            if (chunk.voiceURI?.startsWith("kokoro:")) {
                await kokoroAudio(chunk.text, chunk.voiceURI).catch(error => notify(ui("kokoroDownloadFailed", { message: error?.message || error })));
                continue;
            }
            const voice = voices.find(candidate => candidate.voiceURI === chunk.voiceURI) || voiceFor(chunk.lang);
            if (!voice && config.unsupported === "skip") continue;
            await new Promise(resolve => {
                const utterance = new SpeechSynthesisUtterance(chunk.text);
                if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
                else utterance.lang = config.baseLang;
                utterance.rate = config.rate; utterance.pitch = config.pitch; utterance.volume = config.volume;
                utterance.onend = resolve; utterance.onerror = resolve;
                W.speechSynthesis.speak(utterance);
            });
        }
    }
    async function testOwnVoice(text) {
        if (!text?.trim()) return;
        clearSpeech();
        const selfId = W.Player?.MemberNumber, lang = primaryLang(config.baseLang), voice = playerVoiceFor(selfId);
        const personal = config.playerVoices[String(selfId)] || {};
        if (voice?.voiceURI?.startsWith("kokoro:")) {
            await kokoroAudio(text.trim(), voice.voiceURI, personal).catch(error => notify(ui("kokoroDownloadFailed", { message: error?.message || error })));
            return;
        }
        await new Promise(resolve => {
            const utterance = new SpeechSynthesisUtterance(text.trim());
            if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = config.baseLang;
            utterance.rate = personal.rate ?? config.rate; utterance.pitch = personal.pitch ?? config.pitch; utterance.volume = personal.volume ?? config.volume;
            utterance.onend = resolve; utterance.onerror = resolve;
            W.speechSynthesis.speak(utterance);
        });
    }
    async function testPersonalDraft(text, voiceURI, params) {
        if (!text?.trim()) return;
        clearSpeech();
        if (voiceURI?.startsWith("kokoro:")) {
            config.kokoro.enabled = true; saveConfig();
            await kokoroAudio(text.trim(), voiceURI, params).catch(error => notify(ui("kokoroDownloadFailed", { message: error?.message || error })));
            return;
        }
        const voice = voices.find(item => item.voiceURI === voiceURI);
        await new Promise(resolve => {
            const utterance = new SpeechSynthesisUtterance(text.trim());
            if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
            else utterance.lang = params.lang || config.baseLang;
            utterance.rate = params.rate; utterance.pitch = params.pitch; utterance.volume = params.volume;
            utterance.onend = resolve; utterance.onerror = resolve;
            W.speechSynthesis.speak(utterance);
        });
    }
    function senderName(sender, metadata) {
        return metadata?.senderName || sender?.Nickname || sender?.Name || "";
    }
    function handleMessage(data, message, sender, metadata) {
        if (!config.enabled || !data || !config.messageTypes[data.Type]) return;
        if (!config.ownMessages && data.Sender === W.Player?.MemberNumber) return;
        let text = String(message || "").trim();
        if (!text) return;
        const name = senderName(sender, metadata);
        if (name && data.Type !== "Emote") {
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            text = text.replace(new RegExp(`^\\s*${escapedName}\\s*[:：]\\s*`, "i"), "").trim();
        }
        if (data.Type === "Emote") {
            if (name && text.toLowerCase().startsWith(name.toLowerCase())) text = text.slice(name.length).trim();
        }
        if (config.filteredPrefixesEnabled) {
            const filteredPrefixes = String(config.filteredPrefixes || "").split(";").map(prefix => prefix.trim()).filter(Boolean);
            if (filteredPrefixes.some(prefix => text.trimStart().startsWith(prefix))) return;
        }
        if (config.speakSender) {
            if (name) text = `${name}${speakVerb()}${text}`;
        }
        enqueue(text, data.Sender);
    }

    function setEnabled(value) {
        config.enabled = Boolean(value);
        if (!config.enabled) clearSpeech();
        saveConfig();
        refreshQuickMenu();
        applyChatButton();
    }
    function notify(text) {
        if (typeof W.ChatRoomSendLocal === "function" && W.CurrentScreen === "ChatRoom") W.ChatRoomSendLocal(text);
        else console.info("🐈‍⬛ [TTS]", text);
    }
    function openSettings() { W.PreferenceSubscreenExtensionsOpen?.(SETTINGS_ID); }

    function buildQuickMenu() {
        let menu = document.getElementById(MENU_ID);
        if (menu) return menu;
        menu = document.createElement("div");
        menu.id = MENU_ID;
        menu.style.cssText = "position:fixed;z-index:100000;display:none;flex-direction:column;gap:4px;padding:6px;min-width:145px;background:#171a24;border:1px solid #6f9fd8;border-radius:8px;box-shadow:0 5px 18px #0009;font:14px sans-serif";
        const add = (cls, text, action) => {
            const button = document.createElement("button");
            button.className = cls;
            button.textContent = text;
            button.style.cssText = "padding:7px 10px;color:white;background:#333b4d;border:0;border-radius:5px;cursor:pointer";
            button.onclick = event => { event.stopPropagation(); action(); };
            menu.appendChild(button);
        };
        add("lk-tts-toggle", "", () => { setEnabled(!config.enabled); notify(config.enabled ? ui("enabledNotice") : ui("disabledNotice")); });
        add("lk-tts-clear", ui("clearVoice"), () => { clearSpeech(); hideQuickMenu(); });
        add("lk-tts-settings", ui("settings"), () => { hideQuickMenu(); openSettings(); });
        document.body.appendChild(menu);
        cleanups.push(() => menu.remove());
        return menu;
    }
    function refreshQuickMenu() {
        const menu = document.getElementById(MENU_ID);
        const toggle = menu?.querySelector(".lk-tts-toggle");
        if (toggle) {
            // This is a status label, not an action label: it always mirrors current state.
            toggle.textContent = config.enabled ? ui("enabled") : ui("disabled");
            toggle.style.background = config.enabled ? "#367b48" : "#333b4d";
        }
    }
    function hideQuickMenu() { const menu = document.getElementById(MENU_ID); if (menu) menu.style.display = "none"; }
    function toggleQuickMenu() {
        const menu = buildQuickMenu();
        refreshQuickMenu();
        if (menu.style.display === "flex") return hideQuickMenu();
        const rect = document.getElementById(BUTTON_ID)?.getBoundingClientRect() || { left: 10, top: 100, width: 40 };
        menu.style.display = "flex";
        const x = Math.max(5, Math.min(innerWidth - menu.offsetWidth - 5, rect.left + rect.width / 2 - menu.offsetWidth / 2));
        menu.style.left = `${x}px`;
        menu.style.top = `${Math.max(5, rect.top - menu.offsetHeight - 7)}px`;
    }
    const outsideClick = event => {
        if (!event.target.closest?.(`#${MENU_ID}`) && !event.target.closest?.(`#${BUTTON_ID}`)) hideQuickMenu();
    };

    function removePendingButton() {
        const list = W.Liko?.__CRB_pending__;
        if (!Array.isArray(list)) return;
        for (let i = list.length - 1; i >= 0; i--) if (list[i]?.id === "tts") list.splice(i, 1);
    }
    function applyChatButton() {
        W.Liko ??= {};
        const crb = W.Liko.__Sys_ChatRoomButtons__;
        removePendingButton();
        crb?.remove?.("tts");
        if (!config.chatButton || disposed) return;
        const spec = {
            id: "tts", buttonId: BUTTON_ID, order: 9,
            icon: ICON_SVG, tooltip: config.enabled ? ui("enabled") : ui("disabled"),
            background: config.enabled ? "rgba(54,123,72,.92)" : "rgba(55,65,81,.92)", color: "#fff", onClick: toggleQuickMenu,
        };
        if (crb?.add) crb.add(spec);
        else (W.Liko.__CRB_pending__ ??= []).push(spec);
    }
    async function ensureCRB() {
        if (W.Liko?.__Sys_ChatRoomButtons__?.add) return applyChatButton();
        const bases = W.LikoDevBase ? [W.LikoDevBase] : [
            "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/",
            "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/",
            "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/",
        ];
        for (const base of bases) {
            try {
                const response = await fetch(base + "expand/BC_ChatRoomButtons.js", { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const script = document.createElement("script");
                script.textContent = `${await response.text()}\n//# sourceURL=BC_ChatRoomButtons.js`;
                document.head.appendChild(script);
                applyChatButton();
                return;
            } catch (error) { console.warn("🐈‍⬛ [TTS] CRB load failed", base, error); }
        }
    }

    // MAT-style preference screen: fixed left navigation, aligned content rows,
    // a right-hand help panel, and one hit map rebuilt together with each frame.
    const settingsScreen = {
        tab: 0, lang: "follow", hoverDesc: "", removePackMode: false, installedPacks: new Set(), _hits: [],
        C: {
            TAB_X: 90, TAB_Y0: 210, TAB_W: 250, TAB_H: 58, TAB_GAP: 68,
            CBX: 490, CB_SZ: 64, LBL_X: 400, LBL_W: 420,
            CTRL_X: 850, CTRL_W: 450, ROW_Y0: 225, ROW_H: 80,
            HELP_X: 1350, HELP_Y: 200, HELP_W: 560, HELP_H: 700,
        },
        domIds: ["lk-tts-lang-select", "lk-tts-rate-range", "lk-tts-pitch-range", "lk-tts-volume-range", "lk-tts-base-lang-select", "lk-tts-voice-select", "lk-tts-test-text", "lk-tts-max-range", "lk-tts-kokoro-device", "lk-tts-kokoro-dtype", "lk-tts-kokoro-worker-url", "lk-tts-person-id", "lk-tts-person-lang", "lk-tts-person-voice", "lk-tts-person-rate", "lk-tts-person-pitch", "lk-tts-person-volume", "lk-tts-person-list", "lk-tts-person-test", "lk-tts-filter-prefixes"],
        load() { refreshVoices(); this._createDom(); void this._refreshPackStatus(); },
        async _refreshPackStatus() { this.installedPacks = await installedKokoroPacks(); },
        _createDom() {
            if (document.getElementById(this.domIds[0])) return;
            const select = document.createElement("select");
            select.id = this.domIds[0];
            select.add(new Option(ui("followPrimaryLanguage"), "follow"));
            LANGS.forEach(([key, nameKey]) => select.add(new Option(ui(nameKey), key)));
            select.value = this.lang;
            select.onchange = () => { this.lang = select.value; this._populateVoiceSelect(); this._setDefaultTestText(); };
            document.body.appendChild(select);
            const baseSelect = document.createElement("select");
            baseSelect.id = this.domIds[4];
            LANGS.forEach(([key, nameKey]) => baseSelect.add(new Option(ui(nameKey), key)));
            baseSelect.value = primaryLang(config.baseLang);
            baseSelect.onchange = () => { config.baseLang = baseSelect.value; sessionPlayerVoices.clear(); if (this.lang === "follow") { this._populateVoiceSelect(); this._setDefaultTestText(); } saveConfig(); };
            document.body.appendChild(baseSelect);
            const makeRange = (id, min, max, step, key) => {
                const input = document.createElement("input");
                input.id = id; input.type = "range"; input.min = min; input.max = max; input.step = step; input.value = config[key];
                input.oninput = () => { config[key] = Number(input.value); };
                input.onchange = saveConfig;
                document.body.appendChild(input);
            };
            makeRange(this.domIds[1], .5, 2, .1, "rate");
            makeRange(this.domIds[2], 0, 2, .1, "pitch");
            makeRange(this.domIds[3], 0, 1, .05, "volume");
            const voiceSelect = document.createElement("select");
            voiceSelect.id = this.domIds[5];
            voiceSelect.onchange = () => {
                const lang = this.activeLang(); config.voiceByLang[lang] = voiceSelect.value;
                if (voiceSelect.value.startsWith("kokoro:")) { config.kokoro.enabled = true; void startKokoroWorker(); }
                sessionPlayerVoices.clear(); saveConfig();
            };
            document.body.appendChild(voiceSelect);
            const testInput = document.createElement("input");
            testInput.id = this.domIds[6]; testInput.type = "text";
            document.body.appendChild(testInput);
            makeRange(this.domIds[7], 25, 1000, 25, "maxLength");
            const makeSelect = (id, options, value, onChange) => {
                const element = document.createElement("select");
                element.id = id;
                options.forEach(([optionValue, label]) => element.add(new Option(label, optionValue)));
                element.value = value; element.onchange = () => onChange(element.value);
                document.body.appendChild(element);
            };
            makeSelect(this.domIds[8], [["auto", ui("kokoroAuto")], ["webgpu", ui("kokoroWebGPU")], ["wasm", ui("kokoroWasm")]], config.kokoro.device, value => { config.kokoro.device = value; saveConfig(); });
            makeSelect(this.domIds[9], [["auto", ui("kokoroDtypeAuto")], ["fp32", ui("kokoroFp32")], ["q8", ui("kokoroQ8")]], config.kokoro.dtype, value => { config.kokoro.dtype = value; saveConfig(); });
            const workerUrlInput = document.createElement("input");
            workerUrlInput.id = this.domIds[10]; workerUrlInput.type = "url"; workerUrlInput.placeholder = KOKORO_WORKER_URL;
            workerUrlInput.value = config.kokoro.workerUrl;
            workerUrlInput.onchange = () => {
                config.kokoro.workerUrl = workerUrlInput.value.trim(); saveConfig();
                if (config.kokoro.enabled) { stopKokoroWorker(); void startKokoroWorker(); }
            };
            document.body.appendChild(workerUrlInput);
            const personId = document.createElement("input"); personId.id = this.domIds[11]; personId.type = "number"; personId.value = W.Player?.MemberNumber || ""; document.body.appendChild(personId);
            makeSelect(this.domIds[12], LANGS.map(([key, nameKey]) => [key, ui(nameKey)]), primaryLang(config.baseLang), () => this._populatePersonalVoice());
            const personVoice = document.createElement("select"); personVoice.id = this.domIds[13]; document.body.appendChild(personVoice);
            [[14,.5,2,.1,1],[15,0,2,.1,1],[16,0,1,.05,1]].forEach(([i,min,max,step,value]) => { const el=document.createElement("input"); el.id=this.domIds[i]; el.type="range"; el.min=min; el.max=max; el.step=step; el.value=value; document.body.appendChild(el); });
            const personList = document.createElement("select"); personList.id=this.domIds[17]; personList.size=8; personList.onchange=()=>{ personId.value=personList.value; this._loadPersonal(); }; document.body.appendChild(personList);
            const personTest = document.createElement("input"); personTest.id=this.domIds[18]; personTest.type="text"; personTest.value=ui("voiceTest"); personTest.placeholder=ui("voiceTest"); document.body.appendChild(personTest);
            const filterPrefixes = document.createElement("input"); filterPrefixes.id=this.domIds[19]; filterPrefixes.type="text"; filterPrefixes.value=config.filteredPrefixes;
            filterPrefixes.onchange=()=>{config.filteredPrefixes=filterPrefixes.value;saveConfig();}; document.body.appendChild(filterPrefixes);
            personId.onchange=()=>this._loadPersonal();
            this.domIds.forEach(id => {
                const element = document.getElementById(id);
                element.style.cssText = "position:fixed;z-index:10000;box-sizing:border-box;font-size:18px;display:none;font-family:'Twemoji Country Flags','Segoe UI',sans-serif";
            });
            cleanups.push(() => this.domIds.forEach(id => document.getElementById(id)?.remove()));
            this._populateVoiceSelect(); this._setDefaultTestText();
            this._refreshPersonalList(); this._loadPersonal();
        },
        _populateVoiceSelect() {
            const select = document.getElementById(this.domIds[5]);
            if (!select) return;
            const lang = this.activeLang();
            const current = config.voiceByLang[lang] || "";
            select.replaceChildren(new Option(ui("systemDefaultVoice"), ""));
            [...this.filteredVoices(), ...kokoroVoiceOptions(lang)].filter((voice, index, list) => list.findIndex(item => item.voiceURI === voice.voiceURI) === index)
                .forEach(voice => select.add(new Option(`${voice.name} [${voice.lang}]`, voice.voiceURI)));
            select.value = [...select.options].some(option => option.value === current) ? current : "";
        },
        _setDefaultTestText() {
            const input = document.getElementById(this.domIds[6]);
            if (!input) return;
            const lang = this.activeLang();
            const key = `test${lang[0].toUpperCase()}${lang.slice(1)}`;
            input.value = T_ZH[key] ? ui(key) : ui("testEn");
        },
        _positionDom(id, x, y, w, h) {
            const element = document.getElementById(id), canvas = document.querySelector("canvas");
            if (!element || !canvas) return;
            const rect = canvas.getBoundingClientRect();
            const geometry = {
                left: `${rect.left + x * rect.width / 2000}px`, top: `${rect.top + y * rect.height / 1000}px`,
                width: `${w * rect.width / 2000}px`, height: `${h * rect.height / 1000}px`,
            };
            for (const [property, value] of Object.entries(geometry)) if (element.style[property] !== value) element.style[property] = value;
            if (element.style.display === "none") element.style.display = "";
        },
        _hideDom() { this.domIds.forEach(id => { const element = document.getElementById(id); if (element) element.style.display = "none"; }); },
        _showOnlyDom(ids) {
            const visible = new Set(ids);
            this.domIds.forEach(id => {
                const element = document.getElementById(id);
                if (element && !visible.has(id) && element.style.display !== "none") element.style.display = "none";
            });
        },
        unload() { this._hits = []; this.hoverDesc = ""; this._hideDom(); },
        exit() { this.unload(); },
        _hit(x, y, w, h, onClick) { this._hits.push({ x, y, w, h, onClick }); },
        _left(fn) { const align = W.MainCanvas.textAlign; W.MainCanvas.textAlign = "left"; try { fn(); } finally { W.MainCanvas.textAlign = align; } },
        _text(text, x, y, maxWidth = 340, color = "#f2f2f2", size = 36) {
            const canvas = W.MainCanvas;
            const ctx = typeof canvas?.getContext === "function" ? canvas.getContext("2d") : null;
            if (!ctx || typeof ctx.save !== "function") {
                // Never break the whole Preference screen if BC changes its canvas surface.
                W.DrawTextFit?.(String(text), x + maxWidth / 2, y, maxWidth, color, "Gray");
                return;
            }
            ctx.save();
            try {
                ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = color;
                let fontSize = size;
                do { ctx.font = `${fontSize}px Arial, sans-serif`; fontSize -= 2; }
                while (fontSize >= 24 && ctx.measureText(String(text)).width > maxWidth);
                ctx.fillText(String(text), x, y, maxWidth);
            } finally { ctx.restore(); }
        },
        _mid(y) { return y + this.C.CB_SZ / 2 + 9; },
        _cb(y, label, value, desc, onClick) {
            const { LBL_X, CB_SZ } = this.C;
            const buttonX = 1150;
            this._text(label, LBL_X, this._mid(y), this.C.LBL_W);
            W.DrawButton(buttonX, y, 150, CB_SZ, value ? ui("stateOn") : ui("stateOff"), value ? "#2e7d32" : "#555");
            this._hit(buttonX, y, 150, CB_SZ, onClick);
            if (W.MouseIn(LBL_X, y, buttonX - LBL_X + 150, CB_SZ)) this.hoverDesc = desc;
        },
        _choice(y, label, value, desc, onClick, width = this.C.CTRL_W, controlX = this.C.CTRL_X) {
            const { LBL_X, CB_SZ } = this.C;
            this._text(label, LBL_X, this._mid(y), this.C.LBL_W);
            W.DrawButton(controlX, y, width, CB_SZ, value, "White");
            this._hit(controlX, y, width, CB_SZ, onClick);
            if (W.MouseIn(LBL_X, y, controlX - LBL_X + width, CB_SZ)) this.hoverDesc = desc;
        },
        activeLang() { return this.lang === "follow" ? primaryLang(config.baseLang) : this.lang; },
        filteredVoices() { return preferredVoices(this.activeLang()); },
        _refreshPersonalList() {
            const list=document.getElementById(this.domIds[17]); if(!list)return;
            const all=[W.Player,...(W.ChatRoomCharacter||[])].filter(Boolean); const seen=new Set();
            Object.keys(config.playerVoices).forEach(id=>{ if(!all.some(c=>String(c.MemberNumber)===id)) all.push({MemberNumber:Number(id),Name:`#${id}`}); });
            const self=String(W.Player?.MemberNumber||""); all.sort((a,b)=>String(a.MemberNumber)===self?-1:String(b.MemberNumber)===self?1:0);
            list.replaceChildren(...all.filter(c=>c.MemberNumber!=null&&!seen.has(String(c.MemberNumber))&&seen.add(String(c.MemberNumber))).map(c=>new Option(`${c===W.Player?"★ ":""}${c.Nickname||c.Name||"Player"} (#${c.MemberNumber})`,c.MemberNumber)));
        },
        _populatePersonalVoice() { const lang=document.getElementById(this.domIds[12])?.value||primaryLang(config.baseLang), el=document.getElementById(this.domIds[13]); if(!el)return; el.replaceChildren(new Option(ui("systemDefaultVoice"),"")); [...preferredVoices(lang),...kokoroVoiceOptions(lang)].filter((v,i,a)=>a.findIndex(x=>x.voiceURI===v.voiceURI)===i).forEach(v=>el.add(new Option(`${v.name} [${v.lang}]`,v.voiceURI))); },
        _loadPersonal() { const id=document.getElementById(this.domIds[11])?.value, p=config.playerVoices[String(id)]||{}; const lang=document.getElementById(this.domIds[12]); if(lang)lang.value=p.lang||primaryLang(config.baseLang); this._populatePersonalVoice(); const voice=document.getElementById(this.domIds[13]); if(voice)voice.value=p.voiceURI||""; [[14,"rate"],[15,"pitch"],[16,"volume"]].forEach(([i,k])=>{const e=document.getElementById(this.domIds[i]);if(e)e.value=p[k]??config[k];}); },
        run() {
            this.hoverDesc = ""; this._hits = [];
            this._createDom();
            this._showOnlyDom(this.tab === 1
                ? [this.domIds[0], this.domIds[1], this.domIds[2], this.domIds[3], this.domIds[4], this.domIds[5], this.domIds[6]]
                : this.tab === 2 ? [this.domIds[8], this.domIds[9], this.domIds[10]]
                    : this.tab === 3 ? this.domIds.slice(11,19)
                        : this.tab === 4 ? [this.domIds[7], this.domIds[19]] : []);
            const C = this.C;
            const previousAlign = W.MainCanvas.textAlign;
            W.MainCanvas.textAlign = "left";
            W.DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", ui("back"));
            W.MainCanvas.textAlign = "center";
            W.DrawText(ui("title", { version: MOD_VERSION }), 1000, 110, "Black", "Gray");
            W.MainCanvas.textAlign = "left";
            W.DrawButton(C.TAB_X, C.TAB_Y0, C.TAB_W, C.TAB_H,
                config.enabled ? ui("masterOn") : ui("masterOff"), config.enabled ? "#2e7d32" : "#c62828");
            this._hit(C.TAB_X, C.TAB_Y0, C.TAB_W, C.TAB_H, () => setEnabled(!config.enabled));
            const tabs = [ui("tabBasic"), ui("tabVoices"), ui("tabPacks"), ui("tabPersonal"), ui("tabAdvanced")];
            tabs.forEach((label, index) => {
                const y = C.TAB_Y0 + (index + 1) * C.TAB_GAP;
                W.DrawButton(C.TAB_X, y, C.TAB_W, C.TAB_H, label, this.tab === index ? "#4CAF50" : "White");
                this._hit(C.TAB_X, y, C.TAB_W, C.TAB_H, () => { this.tab = index; });
            });
            W.DrawEmptyRect(C.HELP_X, C.HELP_Y, C.HELP_W, C.HELP_H, "#888");
            [this._runBasic, this._runVoices, this._runPacks, this._runPersonal, this._runAdvanced][this.tab].call(this);
            const fallback = [
                ui("helpBasic"), ui("helpVoices"), ui("helpPacks"), ui("helpPersonal"), ui("helpAdvanced"),
            ][this.tab];
            W.DrawTextWrap(this.hoverDesc || fallback, C.HELP_X + 25, C.HELP_Y + 25, C.HELP_W - 50, C.HELP_H - 50, "White", undefined, 8);
            W.MainCanvas.textAlign = previousAlign;
        },
        _runBasic() {
            let y = this.C.ROW_Y0, H = this.C.ROW_H;
            this._text(ui("tabBasic"), this.C.LBL_X, 200, this.C.LBL_W, "#4CAF50");
            this._cb(y, ui("ownMessages"), config.ownMessages, ui("ownMessagesDesc"), () => { config.ownMessages = !config.ownMessages; saveConfig(); }); y += H;
            this._cb(y, ui("speakSender"), config.speakSender, ui("speakSenderDesc"), () => { config.speakSender = !config.speakSender; saveConfig(); }); y += H;
            this._cb(y, ui("readChat"), config.messageTypes.Chat, ui("readChatDesc"), () => { config.messageTypes.Chat = !config.messageTypes.Chat; saveConfig(); }); y += H;
            this._cb(y, ui("readWhisper"), config.messageTypes.Whisper, ui("readWhisperDesc"), () => { config.messageTypes.Whisper = !config.messageTypes.Whisper; saveConfig(); }); y += H;
            this._cb(y, ui("readEmote"), config.messageTypes.Emote, ui("readEmoteDesc"), () => { config.messageTypes.Emote = !config.messageTypes.Emote; saveConfig(); }); y += H;
            this._cb(y, ui("chatButton"), config.chatButton, ui("chatButtonDesc"), () => { config.chatButton = !config.chatButton; saveConfig(); applyChatButton(); });
        },
        _runVoices() {
            const C = this.C; let y = C.ROW_Y0, H = C.ROW_H;
            this._text(ui("tabVoices"), C.LBL_X, 200, C.LBL_W, "#4CAF50");
            this._text(ui("primaryLanguage"), C.LBL_X, this._mid(y), C.LBL_W);
            const baseSelect = document.getElementById(this.domIds[4]); if (baseSelect) baseSelect.value = primaryLang(config.baseLang);
            this._positionDom(this.domIds[4], C.CTRL_X, y, C.CTRL_W, C.CB_SZ); y += H;
            this._text(ui("language"), C.LBL_X, this._mid(y), C.LBL_W);
            const languageSelect = document.getElementById(this.domIds[0]); if (languageSelect) languageSelect.value = this.lang;
            this._positionDom(this.domIds[0], C.CTRL_X, y, C.CTRL_W, C.CB_SZ); y += H;
            this._text(ui("selectVoice"), C.LBL_X, this._mid(y), C.LBL_W);
            this._positionDom(this.domIds[5], C.CTRL_X, y, C.CTRL_W, C.CB_SZ); y += H;
            [[ui("rate"), this.domIds[1], config.rate, config.rate.toFixed(1)], [ui("pitch"), this.domIds[2], config.pitch, config.pitch.toFixed(1)], [ui("volume"), this.domIds[3], config.volume, `${Math.round(config.volume * 100)}%`]].forEach(([label, id, raw, display]) => {
                const range = document.getElementById(id); if (range && document.activeElement !== range) range.value = raw;
                this._text(label, C.LBL_X, this._mid(y), C.LBL_W);
                this._positionDom(id, C.CTRL_X, y + 8, 300, 48);
                this._text(display, 1235, this._mid(y), 100); y += H;
            });
            this._text(ui("testText"), C.LBL_X, this._mid(y), C.LBL_W);
            this._positionDom(this.domIds[6], C.CTRL_X, y, C.CTRL_W, C.CB_SZ); y += H;
            W.DrawButton(C.CTRL_X, y, 215, C.CB_SZ, ui("playTest"), "White");
            this._hit(C.CTRL_X, y, 215, C.CB_SZ, () => testConfiguredVoice(document.getElementById(this.domIds[6])?.value || ""));
            W.DrawButton(C.CTRL_X + 235, y, 215, C.CB_SZ, ui("rescan"), "White");
            this._hit(C.CTRL_X + 235, y, 215, C.CB_SZ, () => { refreshVoices(); notify(ui("voicesFound", { count: voices.length })); });
        },
        _runPacks() {
            const C = this.C; let y = C.ROW_Y0, H = C.ROW_H;
            this._text(ui("tabPacks"), C.LBL_X, 200, C.LBL_W, "#4CAF50");
            this._text(ui("kokoroWorkerUrl"), C.LBL_X, this._mid(y), C.LBL_W);
            this._positionDom(this.domIds[10], C.CTRL_X, y, C.CTRL_W, C.CB_SZ); y += H;
            this._cb(y, ui("kokoroEnabled"), config.kokoro.enabled, "", () => {
                config.kokoro.enabled = !config.kokoro.enabled; saveConfig();
                if (config.kokoro.enabled) void startKokoroWorker(); else stopKokoroWorker();
            }); y += H;
            this._text(ui("kokoroCompute"), C.LBL_X, this._mid(y), 280);
            this._positionDom(this.domIds[8], 700, y, 290, C.CB_SZ);
            this._positionDom(this.domIds[9], 1010, y, 290, C.CB_SZ); y += H;
            W.DrawButton(1000, 465, 300, C.CB_SZ, this.removePackMode ? ui("kokoroRemoveDone") : ui("kokoroRemove"), this.removePackMode ? "#c62828" : "White");
            this._hit(1000, 465, 300, C.CB_SZ, () => {
                this.removePackMode = !this.removePackMode;
            });
            W.DrawEmptyRect(400, 545, 900, 355, "#888");
            Object.entries(KOKORO_PACKS).forEach(([packId, pack], index) => {
                const column = index % 3, row = Math.floor(index / 3);
                const x = 430 + column * 285, itemY = 575 + row * 95;
                const installed = this.installedPacks.has(packId);
                if (this.removePackMode) {
                    W.DrawButton(x, itemY, 55, 55, installed ? "🗑" : "", installed ? "#c62828" : "#333");
                } else W.DrawCheckbox(x, itemY, 55, 55, "", installed);
                this._text(pack.label, x + 70, itemY + 37, 200, "#f2f2f2", 30);
                if (!this.removePackMode || installed) this._hit(x, itemY, 260, 60, () => {
                    const action = this.removePackMode ? removeKokoroPack(packId) : downloadKokoroPack(packId);
                    void action.then(() => this._refreshPackStatus()).catch(error => notify(ui("kokoroDownloadFailed", { message: error?.message || error })));
                });
            });
        },
        _runPersonal() {
            const C=this.C; this._text(ui("tabPersonal"),C.LBL_X,200,C.LBL_W,"#4CAF50");
            this._positionDom(this.domIds[17],400,235,390,570);
            const rows=[["personalTarget",11],["personalLanguage",12],["personalVoice",13],["personalRate",14],["personalPitch",15],["personalVolume",16]];
            rows.forEach(([key,id],index)=>{const y=235+index*80;this._text(ui(key),820,this._mid(y),250,"#f2f2f2",30);this._positionDom(this.domIds[id],1080,y,220,C.CB_SZ);});
            this._positionDom(this.domIds[18],820,735,300,C.CB_SZ);
            W.DrawButton(1140,735,160,C.CB_SZ,ui("playTest"),"White"); this._hit(1140,735,160,C.CB_SZ,()=>{const params={lang:document.getElementById(this.domIds[12])?.value,rate:Number(document.getElementById(this.domIds[14])?.value),pitch:Number(document.getElementById(this.domIds[15])?.value),volume:Number(document.getElementById(this.domIds[16])?.value)};void testPersonalDraft(document.getElementById(this.domIds[18])?.value||"",document.getElementById(this.domIds[13])?.value||"",params);});
            W.DrawButton(820,815,230,C.CB_SZ,ui("personalClear"),"White"); this._hit(820,815,230,C.CB_SZ,()=>{const id=document.getElementById(this.domIds[11])?.value;delete config.playerVoices[String(id)];saveConfig();sessionPlayerVoices.clear();this._loadPersonal();this._refreshPersonalList();});
            W.DrawButton(1070,815,230,C.CB_SZ,ui("personalSave"),"#4CAF50"); this._hit(1070,815,230,C.CB_SZ,()=>{const id=document.getElementById(this.domIds[11])?.value;if(!id)return;const voiceURI=document.getElementById(this.domIds[13])?.value||"";config.playerVoices[String(id)]={lang:document.getElementById(this.domIds[12])?.value,voiceURI,rate:Number(document.getElementById(this.domIds[14])?.value),pitch:Number(document.getElementById(this.domIds[15])?.value),volume:Number(document.getElementById(this.domIds[16])?.value)};if(voiceURI.startsWith("kokoro:")){config.kokoro.enabled=true;void startKokoroWorker();}saveConfig();sessionPlayerVoices.clear();this._refreshPersonalList();});
        },
        _runAdvanced() {
            let y = this.C.ROW_Y0, H = this.C.ROW_H;
            this._text(ui("tabAdvanced"), this.C.LBL_X, 200, this.C.LBL_W, "#4CAF50");
            this._cb(y, ui("multilingual"), config.multilingual, ui("multilingualDesc"), () => { config.multilingual = !config.multilingual; saveConfig(); }); y += H;
            this._cb(y, ui("randomVoices"), config.randomPlayerVoices, ui("randomVoicesDesc"), () => { config.randomPlayerVoices = !config.randomPlayerVoices; sessionPlayerVoices.clear(); saveConfig(); }); y += H;
            const genderLabel = config.voiceGender === "male" ? ui("voiceGenderMale") : config.voiceGender === "mixed" ? ui("voiceGenderMixed") : ui("voiceGenderFemale");
            this._choice(y, ui("voiceGender"), genderLabel, ui("voiceGenderDesc"), () => {
                config.voiceGender = config.voiceGender === "female" ? "male" : config.voiceGender === "male" ? "mixed" : "female";
                sessionPlayerVoices.clear(); saveConfig();
            }, 300, 1000); y += H;
            this._choice(y, ui("unsupported"), config.unsupported === "skip" ? ui("unsupportedSkip") : ui("unsupportedBase"), ui("unsupportedDesc"), () => { config.unsupported = config.unsupported === "skip" ? "base" : "skip"; saveConfig(); }, 300, 1000); y += H;
            this._choice(y, ui("longMessage"), config.longMessage === "truncate" ? ui("truncate") : ui("skipAll"), ui("longMessageDesc"), () => { config.longMessage = config.longMessage === "truncate" ? "skip" : "truncate"; saveConfig(); }, 300, 1000); y += H;
            this._text(ui("maxLength"), this.C.LBL_X, this._mid(y), this.C.LBL_W);
            const maxRange = document.getElementById(this.domIds[7]); if (maxRange && document.activeElement !== maxRange) maxRange.value = config.maxLength;
            this._positionDom(this.domIds[7], this.C.CTRL_X, y + 8, 300, 48);
            this._text(String(config.maxLength), 1235, this._mid(y), 100);
            if (W.MouseIn(this.C.LBL_X, y, this.C.CTRL_X - this.C.LBL_X + this.C.CTRL_W, this.C.CB_SZ)) this.hoverDesc = ui("maxLengthDesc");
            y += H;
            this._cb(y, ui("filteredPrefixesEnabled"), config.filteredPrefixesEnabled, ui("filteredPrefixesEnabledDesc"), () => { config.filteredPrefixesEnabled = !config.filteredPrefixesEnabled; saveConfig(); });
            y += H;
            const filterPrefixes = document.getElementById(this.domIds[19]);
            if (filterPrefixes && document.activeElement !== filterPrefixes) filterPrefixes.value = config.filteredPrefixes;
            this._positionDom(this.domIds[19], 400, y, 900, this.C.CB_SZ);
            if (W.MouseIn(400, y, 900, this.C.CB_SZ)) this.hoverDesc = ui("filteredPrefixesDesc");
        },
        click() {
            if (W.MouseIn(1815, 75, 90, 90)) { W.PreferenceExit?.(); return; }
            for (const hit of this._hits) if (W.MouseIn(hit.x, hit.y, hit.w, hit.h)) { hit.onClick(); return; }
        },
    };

    function registerSettings() {
        // PreferenceRegisterExtensionSetting has no public unregister API. Keep one stable
        // registration across hot injections and forward its callbacks to the newest instance.
        if (W.__LikoTTSPreferenceRegistered) return;
        W.PreferenceRegisterExtensionSetting({
            Identifier: SETTINGS_ID, ButtonText: "Liko TTS", Image: ICON_URI,
            load: () => W.LikoTTS?._settings?.load(), run: () => W.LikoTTS?._settings?.run(),
            click: () => W.LikoTTS?._settings?.click(), unload: () => W.LikoTTS?._settings?.unload(),
            exit: () => W.LikoTTS?._settings?.exit(),
        });
        W.__LikoTTSPreferenceRegistered = true;
    }
    function installHooks() {
        if (disposed || messageHookInstalled) return true;
        if (typeof W.ChatRoomMessageDisplay !== "function") return false;
        modApi.hookFunction("ChatRoomMessageDisplay", 4, (args, next) => {
            try { handleMessage(args[0], args[1], args[2], args[3]); } catch (error) { console.error("🐈‍⬛ [TTS] message handling failed", error); }
            return next(args);
        });
        messageHookInstalled = true;
        return true;
    }
    function installHooksWhenReady() {
        if (installHooks()) return;
        // ChatRoomMessageDisplay is defined by BC's lazily loaded ChatRoom module.
        // BC exposes no reliable module-ready event, so only this API is checked at
        // low frequency without blocking settings or the rest of initialization.
        messageHookTimer = setInterval(() => {
            if (disposed || installHooks()) {
                clearInterval(messageHookTimer);
                messageHookTimer = null;
            }
        }, 500);
    }
    function waitForLogin() {
        if (W.Player?.MemberNumber !== undefined) return Promise.resolve(true);
        return new Promise(resolve => {
            let done = false;
            const finish = value => {
                if (done) return;
                done = true;
                if (loginReadyTimer) clearInterval(loginReadyTimer);
                loginReadyTimer = null;
                try { removeLoginHook?.(); } catch {}
                removeLoginHook = null;
                resolve(value);
            };
            const check = () => {
                if (disposed) return finish(false);
                if (W.Player?.MemberNumber !== undefined) return finish(true);
                // LoginResponse is also lazily defined. Hook it only after it exists;
                // the MemberNumber check above covers login that completed beforehand.
                if (!removeLoginHook && typeof W.LoginResponse === "function") {
                    removeLoginHook = modApi.hookFunction("LoginResponse", 0, (args, next) => {
                        const result = next(args);
                        queueMicrotask(() => { if (W.Player?.MemberNumber !== undefined) finish(true); });
                        return result;
                    });
                }
            };
            check();
            if (!done) loginReadyTimer = setInterval(check, 500);
        });
    }
    function waitFor(check, timeout = 60000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const poll = () => {
                if (disposed) return reject(new Error("disposed"));
                if (check()) return resolve();
                if (Date.now() - started > timeout) return reject(new Error("timeout"));
                setTimeout(poll, 100);
            };
            poll();
        });
    }
    async function init() {
        await waitFor(() => W.bcModSdk?.registerMod);
        modApi = W.bcModSdk.registerMod({ name: MOD_NAME, fullName: "Liko's Text-to-Speech", version: MOD_VERSION, repository: "https://github.com/awdrrawd/BC-TTS" }, { allowReplace: true });
        installHooksWhenReady();
        if (!await waitForLogin()) return;
        await waitFor(() => typeof W.PreferenceRegisterExtensionSetting === "function" && W.Player?.ExtensionSettings !== undefined);
        if (disposed || initialized) return;
        initialized = true;
        loadConfig();
        refreshVoices();
        await installedKokoroPacks();
        if (config.kokoro.enabled) void startKokoroWorker();
        const changed = () => refreshVoices();
        W.speechSynthesis?.addEventListener?.("voiceschanged", changed);
        cleanups.push(() => W.speechSynthesis?.removeEventListener?.("voiceschanged", changed));
        // Chromium sometimes publishes the voice list after the event; retry briefly without permanent polling.
        let retries = 0;
        voiceTimer = setInterval(() => { refreshVoices(); if (voices.length || ++retries >= 10) { clearInterval(voiceTimer); voiceTimer = null; } }, 1000);
        registerSettings();
        document.addEventListener("mousedown", outsideClick);
        cleanups.push(() => document.removeEventListener("mousedown", outsideClick));
        applyChatButton();
        void ensureCRB();
        console.log(`🐈‍⬛ [TTS] v${MOD_VERSION} loaded (${voices.length} voices)`);
    }
    function unload(reason = "manual") {
        if (disposed) return;
        disposed = true;
        clearSpeech();
        stopKokoroWorker();
        if (voiceTimer) clearInterval(voiceTimer);
        if (messageHookTimer) clearInterval(messageHookTimer);
        if (loginReadyTimer) clearInterval(loginReadyTimer);
        try { removeLoginHook?.(); } catch {}
        removeLoginHook = null;
        hideQuickMenu();
        W.Liko?.__Sys_ChatRoomButtons__?.remove?.("tts");
        removePendingButton();
        for (const cleanup of cleanups.splice(0)) try { cleanup(); } catch {}
        try { modApi?.unload?.(); } catch (error) { console.warn("🐈‍⬛ [TTS] SDK unload failed", error); }
        if (W.LikoTTS?.unload === unload) delete W.LikoTTS;
        console.log(`🐈‍⬛ [TTS] unloaded (${reason})`);
    }

    W.LikoTTS = Object.freeze({ version: MOD_VERSION, unload, clear: clearSpeech, speak: enqueue, segment: segmentText, voices: () => [...voices], openSettings, _settings: settingsScreen });
    init().catch(error => { if (!disposed) console.error("🐈‍⬛ [TTS] initialization failed", error); });
})();
