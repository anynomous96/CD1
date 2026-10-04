import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";

type Mode = "morse" | "text";
type Theme = "simple" | "cyber";

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....",
  "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.",
  "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-",
  "+": ".-.-.", "-": "-....-", "_": "..--.-", '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([key, value]) => [value, key]));

const Icons = {
  swap: <path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  save: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  play: <path d="m8 5 11 7-11 7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7z" />,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></>,
  share: <><circle cx="18" cy="5" r="2.3" /><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="19" r="2.3" /><path d="m8 11 7.8-4.7M8 13l7.8 4.7" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0 2 5.5" /><path d="M20 4v7h-7" /></>,
  vibrate: <><path d="M8 5a5 5 0 0 0 0 14M5 2a9 9 0 0 0 0 20M16 5a5 5 0 0 1 0 14M19 2a9 9 0 0 1 0 20" /><rect x="10" y="8" width="4" height="8" rx="1" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

function Icon({ name, size = 18 }: { name: keyof typeof Icons; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Icons[name]}</svg>;
}

function textToMorse(value: string) {
  if (!value.trim()) return { output: "", error: "" };
  const unknown = new Set<string>();
  const output = value.trim().split(/\s+/).map((word) => [...word].map((char) => {
    const code = MORSE[char.toUpperCase()];
    if (!code) unknown.add(char);
    return code || "";
  }).filter(Boolean).join(" ")).join(" / ");
  return unknown.size
    ? { output: `Error: Unsupported character ${[...unknown].join(" ")}`, error: "Some characters cannot be converted." }
    : { output, error: "" };
}

function morseToText(value: string) {
  if (!value.trim()) return { output: "", error: "" };
  if (/[^.\-\/\s]/.test(value)) return { output: "Error: Morse input can only contain dots, dashes, spaces, and slashes", error: "Invalid Morse input." };
  const invalid: string[] = [];
  const output = value.trim().split(/\s*\/\s*|\s{2,}/).map((word) => word.trim().split(/\s+/).map((code) => {
    const letter = REVERSE[code];
    if (!letter) invalid.push(code);
    return letter || "";
  }).join("")).join(" ");
  return invalid.length
    ? { output: `Error: Invalid Morse sequence ${[...new Set(invalid)].join(" ")}`, error: "Check the output and spacing." }
    : { output, error: "" };
}

function convert(mode: Mode, value: string) { return mode === "morse" ? morseToText(value) : textToMorse(value); }

interface TranslationState { input: string; output: string; error: string; translatedInput: string }
interface SavedItem { id: string; mode: Mode; input: string; output: string; createdAt: number }
const emptyTranslation = (): TranslationState => ({ input: "", output: "", error: "", translatedInput: "" });

function loadSaved(): SavedItem[] {
  try { return JSON.parse(localStorage.getItem("signal-saved-v2") || "[]"); } catch { return []; }
}

const DRAFT_KEY = "signal-draft-v1";
const INSTALL_DISMISS_KEY = "signal-install-dismissed-at";
const INSTALL_RETRY_DELAY = 1000 * 60 * 60 * 24 * 3;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function normaliseTranslation(value: unknown): TranslationState {
  if (!value || typeof value !== "object") return emptyTranslation();
  const candidate = value as Partial<TranslationState>;
  return {
    input: typeof candidate.input === "string" ? candidate.input : "",
    output: typeof candidate.output === "string" ? candidate.output : "",
    error: typeof candidate.error === "string" ? candidate.error : "",
    translatedInput: typeof candidate.translatedInput === "string" ? candidate.translatedInput : "",
  };
}

function loadDraft(): Record<Mode, TranslationState> {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Partial<Record<Mode, unknown>>;
    return { morse: normaliseTranslation(stored.morse), text: normaliseTranslation(stored.text) };
  } catch {
    return { morse: emptyTranslation(), text: emptyTranslation() };
  }
}

function canSuggestInstall() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || "0");
    return !dismissedAt || Date.now() - dismissedAt > INSTALL_RETRY_DELAY;
  } catch {
    return true;
  }
}

export default function App() {
  const [mode, setMode] = useState<Mode>("morse");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("signal-theme") as Theme) || "simple");
  const [states, setStates] = useState<Record<Mode, TranslationState>>(loadDraft);
  const [saved, setSaved] = useState<SavedItem[]>(loadSaved);
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [transmissionType, setTransmissionType] = useState<"audio" | "haptic">("audio");
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [activeLetter, setActiveLetter] = useState(-1);
  const clearTimer = useRef<number | null>(null);
  const clearTriggered = useRef(false);
  const playbackId = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const current = states[mode];

  const runTranslation = useCallback((targetMode: Mode) => {
    setStates((previous) => {
      const target = previous[targetMode];
      const result = convert(targetMode, target.input);
      return { ...previous, [targetMode]: { ...target, ...result, translatedInput: target.input } };
    });
  }, []);

  useEffect(() => {
    if (!current.input.trim() || current.input === current.translatedInput) return;
    const timer = window.setTimeout(() => runTranslation(mode), 2000);
    return () => window.clearTimeout(timer);
  }, [current.input, current.translatedInput, mode, runTranslation]);

  useEffect(() => { localStorage.setItem("signal-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("signal-saved-v2", JSON.stringify(saved)); }, [saved]);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(states)); }, [states]);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const updateDisplayMode = () => setIsStandalone(displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
      if (canSuggestInstall()) setShowInstallPrompt(true);
    };
    const appInstalled = () => {
      setIsStandalone(true);
      setShowInstallPrompt(false);
      setDeferredInstallPrompt(null);
      setNotice("Signal is installed and ready offline");
    };

    setIsIOS(iosDevice);
    setIsStandalone(standalone);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", appInstalled);
    displayMode.addEventListener("change", updateDisplayMode);
    const iosTimer = iosDevice && !standalone && canSuggestInstall()
      ? window.setTimeout(() => setShowInstallPrompt(true), 1200)
      : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", appInstalled);
      displayMode.removeEventListener("change", updateDisplayMode);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  useEffect(() => {
    const online = () => { setIsOnline(true); setNotice("Back online — Signal is ready"); };
    const offline = () => { setIsOnline(false); setNotice("You are offline — Signal remains available"); };
    const update = () => setUpdateAvailable(true);
    const offlineReady = () => setNotice("Signal is ready for offline use");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("signal:pwa-update", update);
    window.addEventListener("signal:pwa-offline-ready", offlineReady);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("signal:pwa-update", update);
      window.removeEventListener("signal:pwa-offline-ready", offlineReady);
    };
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedMode = query.get("mode");
    const sharedParts = [query.get("title"), query.get("text"), query.get("url")].filter((part): part is string => Boolean(part?.trim()));
    if (requestedMode === "morse" || requestedMode === "text") setMode(requestedMode);
    if (sharedParts.length) {
      const input = sharedParts.join("\n").trim();
      const result = convert("text", input);
      setStates((previous) => ({ ...previous, text: { input, ...result, translatedInput: input } }));
      setMode("text");
      setNotice("Shared message is ready to transmit");
    }
    if (requestedMode || sharedParts.length) window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const translateShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runTranslation(mode);
      }
    };
    window.addEventListener("keydown", translateShortcut);
    return () => window.removeEventListener("keydown", translateShortcut);
  }, [mode, runTranslation]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateInput = (value: string) => {
    setStates((previous) => ({ ...previous, [mode]: { ...previous[mode], input: value, error: "", ...(value ? {} : { output: "", translatedInput: "" }) } }));
  };

  function stopAudio() {
    playbackId.current += 1;
    setPlaying(false);
    navigator.vibrate?.(0);
    setActiveWord(-1);
    setActiveLetter(-1);
  }

  const clearCurrent = () => {
    if (clearTriggered.current) { clearTriggered.current = false; return; }
    setStates((previous) => ({ ...previous, [mode]: emptyTranslation() }));
    stopAudio();
  };

  const beginClear = () => {
    clearTriggered.current = false;
    clearTimer.current = window.setTimeout(() => {
      clearTriggered.current = true;
      setStates({ morse: emptyTranslation(), text: emptyTranslation() });
      stopAudio();
    }, 2000);
  };

  const cancelClear = () => {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    clearTimer.current = null;
  };

  const remember = () => {
    if (!current.input.trim() || !current.output || current.error) return;
    if (saved.some((item) => item.mode === mode && item.input === current.input && item.output === current.output)) { setNotice("Already remembered"); return; }
    setSaved((items) => [{ id: crypto.randomUUID(), mode, input: current.input, output: current.output, createdAt: Date.now() }, ...items]);
    setNotice("Translation remembered");
  };

  const copyOutput = async () => {
    if (!current.output) return;
    try {
      await navigator.clipboard.writeText(current.output);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard access was blocked — select and copy the message");
    }
  };

  const shareOutput = async () => {
    if (!current.output || current.error) return;
    if (!navigator.share) {
      await copyOutput();
      return;
    }
    try {
      await navigator.share({ title: "Signal translation", text: current.output });
      setNotice("Translation shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice("Could not open the share sheet");
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch { /* Private browsing can block storage. */ }
  };

  const requestInstall = async () => {
    if (isIOS) return;
    if (!deferredInstallPrompt) {
      setNotice("Use your browser menu to install Signal");
      return;
    }
    try {
      await deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      setShowInstallPrompt(false);
      if (outcome === "accepted") setNotice("Installing Signal…");
      else dismissInstallPrompt();
    } catch {
      setNotice("The install prompt is no longer available — use your browser menu");
    }
  };

  const applyUpdate = () => {
    setUpdateAvailable(false);
    setNotice("Updating Signal…");
    window.dispatchEvent(new Event("signal:apply-update"));
  };

  const sendToOther = () => {
    if (!current.output || current.error) return;
    const nextMode: Mode = mode === "morse" ? "text" : "morse";
    setStates((previous) => ({ ...previous, [nextMode]: { ...previous[nextMode], input: current.output, output: "", error: "", translatedInput: "" } }));
    setMode(nextMode);
  };

  const transmissionWords = useMemo(() => {
    const text = mode === "text" ? current.input : (current.error ? "" : current.output);
    return text.trim().split(/\s+/).filter(Boolean).map((word) => [...word].map((letter) => ({ letter: letter.toUpperCase(), morse: MORSE[letter.toUpperCase()] || "" })).filter((unit) => unit.morse));
  }, [mode, current.input, current.output, current.error]);

  const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function tone(duration: number, id: number) {
    if (id !== playbackId.current) return;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext.current ||= new AudioCtor();
    await audioContext.current.resume();
    const oscillator = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    oscillator.frequency.value = 640;
    gain.gain.setValueAtTime(0.12, audioContext.current.currentTime);
    oscillator.connect(gain).connect(audioContext.current.destination);
    oscillator.start();
    oscillator.stop(audioContext.current.currentTime + duration / 1000);
    await delay(duration);
  }

  async function playUnits(words = transmissionWords, type: "audio" | "haptic" = "audio") {
    if (!words.length) return;
    stopAudio();
    const id = playbackId.current;
    setTransmissionType(type);
    setPlaying(true);
    for (let wi = 0; wi < words.length && id === playbackId.current; wi++) {
      setActiveWord(wi);
      for (let li = 0; li < words[wi].length && id === playbackId.current; li++) {
        setActiveLetter(li);
        const symbols = words[wi][li].morse;
        for (let si = 0; si < symbols.length && id === playbackId.current; si++) {
          const duration = symbols[si] === "." ? 90 : 270;
          if (type === "haptic") { navigator.vibrate?.(duration); await delay(duration); }
          else await tone(duration, id);
          if (si < symbols.length - 1) await delay(90);
        }
        if (li < words[wi].length - 1) await delay(270);
      }
      if (wi < words.length - 1) await delay(630);
    }
    if (id === playbackId.current) stopAudio();
  }

  const playCharacter = (letter: string) => playUnits([[{ letter, morse: MORSE[letter] }]], "audio");
  const savedForMode = saved.filter((item) => item.mode === mode);

    /* ---------- theme ---------- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'cyber' ? '#08120F' : '#F3F1E9');
  }, [theme]);

  const navRef = useRef<HTMLElement>(null);

 useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (!navRef.current) return;

      if (currentScrollY > lastScrollY && currentScrollY > 75) {
        // Scroll Down → Hide Navbar
        gsap.to(navRef.current, {
          yPercent: -100,
          duration: 0.3,
          ease: "ease-in-out",
        });
      } else {
        // Scroll Up → Show Navbar
        gsap.to(navRef.current, {
          yPercent: 0,
          duration: 0.3,
          ease: "eaes-in-out",
        });
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);


  return (
    <div className={`app theme-${theme}`}>
      <header ref={navRef} className="site-header">
        <a className="brand" href="#top" aria-label="Signal home"><img className="brand-logo" src={`${import.meta.env.BASE_URL}signal-logo.svg`} alt="" /><span>SIGNAL</span></a>
        <div className="header-actions">
          <span className={`status ${isOnline ? "" : "offline"}`}><i /> {isOnline ? "Online" : "Offline"}</span>
          {!isStandalone && (deferredInstallPrompt || isIOS) && <button className="install-header-button" onClick={() => setShowInstallPrompt(true)}><Icon name="download" size={16} /> Install</button>}
          <button className="icon-button" onClick={() => setTheme(theme === "simple" ? "cyber" : "simple")} aria-label="Change color theme"><Icon name={theme === "simple" ? "bolt" : "sun"} /></button>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <p className="eyebrow">Morse translator</p>
          <h1>Words across<br /><em>any distance.</em></h1>
          <p>Translate, listen, and keep the messages that matter.</p>
        </section>

        <section className="workspace" aria-label="Morse translator">
          <div className="mode-tabs" role="tablist">
            <button className={mode === "morse" ? "active" : ""} onClick={() => setMode("morse")} role="tab" aria-selected={mode === "morse"}>Morse to text</button>
            <button className="swap-tab" onClick={() => setMode(mode === "morse" ? "text" : "morse")} aria-label="Switch translator"><Icon name="swap" size={16} /></button>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} role="tab" aria-selected={mode === "text"}>Text to Morse</button>
          </div>

          <div className="translator">
            <div className="editor input-editor">
              <div className="editor-label"><span>{mode === "morse" ? "Morse input" : "Text input"}</span><span>{current.input.length.toLocaleString()} chars</span></div>
              <textarea value={current.input} onChange={(event) => updateInput(event.target.value)} placeholder={mode === "morse" ? "Enter dots and dashes" : "Enter your message"} spellCheck={false} autoComplete="off" aria-label={mode === "morse" ? "Morse input" : "Text input"} />
              <div className="editor-footer">
                <button className="clear-button" onMouseDown={beginClear} onMouseUp={cancelClear} onMouseLeave={cancelClear} onTouchStart={beginClear} onTouchEnd={cancelClear} onClick={clearCurrent}>Clear</button>
                <span className="shortcut-hint">Ctrl / ⌘ + Enter</span>
                <button className="translate-button" onClick={() => runTranslation(mode)}><Icon name="bolt" size={16} /> Translate</button>
              </div>
            </div>

            <div className={`editor output-editor ${current.error ? "has-error" : ""}`} onClick={() => runTranslation(mode)}>
              <div className="editor-label"><span>{mode === "morse" ? "Plain text" : "Morse output"}</span><span>{current.output.length.toLocaleString()} chars</span></div>
              <div className={`output-value ${!current.output ? "empty" : ""}`} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && runTranslation(mode)}>{current.output || "Translation appears here"}</div>
              {current.error && <p className="error-line">{current.error}</p>}
              <div className="output-actions">
                <button onClick={(event) => { event.stopPropagation(); void copyOutput(); }} disabled={!current.output || !!current.error}><Icon name="copy" /> Copy</button>
                <button onClick={(event) => { event.stopPropagation(); void shareOutput(); }} disabled={!current.output || !!current.error}><Icon name="share" /> Share</button>
                <button onClick={(event) => { event.stopPropagation(); remember(); }} disabled={!current.output || !!current.error}><Icon name="save" /> Remember</button>
                <button onClick={(event) => { event.stopPropagation(); sendToOther(); }} disabled={!current.output || !!current.error}><Icon name="arrow" /> Send</button>
              </div>
            </div>
          </div>
        </section>

        <section className="saved-section section-rule">
          <div className="section-heading">
            <div><p className="eyebrow">Remembered messages</p><h2>Your signal log.</h2></div>
            {savedForMode.length > 0 && <button className="clear-log" onClick={() => { setSaved((items) => items.filter((item) => item.mode !== mode)); setNotice("Saved log cleared"); }}><Icon name="trash" /> Clear saved</button>}
          </div>
          {savedForMode.length ? <div className="saved-list">{savedForMode.map((item) => (
            <article key={item.id}>
              <div className="saved-meta"><span><Icon name="clock" size={14} /> {new Date(item.createdAt).toLocaleString()}</span><button onClick={() => setSaved((items) => items.filter((entry) => entry.id !== item.id))} aria-label="Delete saved translation"><Icon name="trash" size={16} /></button></div>
              <p className="saved-input">{item.input}</p><div className="saved-divider"><Icon name="arrow" size={14} /></div><p className="saved-output">{item.output}</p>
            </article>
          ))}</div> : <p className="empty-log">Messages remembered in this translator will appear here.</p>}
        </section>

        <section className="transmitter section-rule">
          <div className="section-heading"><div><p className="eyebrow">Pocket transmitter</p><h2>Hear or feel every signal.</h2></div><div className="transmit-actions"><button className="play-button" onClick={() => playing && transmissionType === "audio" ? stopAudio() : playUnits(transmissionWords, "audio")} disabled={!transmissionWords.length}><Icon name={playing && transmissionType === "audio" ? "stop" : "play"} /> {playing && transmissionType === "audio" ? "Stop" : "Sound"}</button><button className="play-button haptic-button" onClick={() => playing && transmissionType === "haptic" ? stopAudio() : playUnits(transmissionWords, "haptic")} disabled={!transmissionWords.length || !("vibrate" in navigator)} title={("vibrate" in navigator) ? "Transmit Morse through phone vibration" : "Vibration is not supported by this device"}><Icon name="vibrate" /> {playing && transmissionType === "haptic" ? "Stop" : "Vibrate"}</button></div></div>
          <div className="signal-reader" aria-live="polite">
            {transmissionWords.length ? transmissionWords.map((word, wi) => (
              <span className={`signal-word ${activeWord === wi ? "active" : ""}`} key={`${wi}-${word.map((x) => x.letter).join("")}`}>
                {word.map((unit, li) => <span className={`signal-letter ${activeWord === wi && activeLetter === li ? "active" : ""}`} key={`${li}-${unit.letter}`}><b>{unit.letter}</b><small>{unit.morse}</small></span>)}
              </span>
            )) : <p className="reader-empty">A translated message will be shown letter by letter.</p>}
          </div>
        </section>
        
        <section id="reference" className="reference section-rule">
          <div className="section-heading"><div><p className="eyebrow">Character sheet</p><h2>Tap to listen.</h2></div></div>
          <div className="character-grid">
            {Object.entries(MORSE).filter(([letter]) => /^[A-Z0-9]$/.test(letter)).map(([letter, code]) => <button key={letter} onClick={() => playCharacter(letter)} aria-label={`Play ${letter}, ${code}`}><b>{letter}</b><span>{code}</span></button>)}
          </div>
        </section>
      </main>

      <footer><span>SIGNAL / MORSE UTILITY</span><span>Built for clear communication</span></footer>

      {showInstallPrompt && !isStandalone && (
        <aside className="install-prompt" role="dialog" aria-modal="false" aria-label="Install Signal">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="52" height="52" />
          <div className="install-copy">
            <p>Install Signal</p>
            <span>Keep this Morse utility one tap away and available offline.</span>
            {isIOS && <small>On iPhone or iPad, tap <b>Share</b> in Safari, then choose <b>Add to Home Screen</b>.</small>}
          </div>
          <div className="install-actions">
            {!isIOS && <button className="install-now" onClick={() => void requestInstall()}><Icon name="download" size={16} /> Install</button>}
            <button className="dismiss-install" onClick={dismissInstallPrompt} aria-label="Dismiss install prompt"><Icon name="close" size={18} /></button>
          </div>
        </aside>
      )}

      {updateAvailable && (
        <aside className="pwa-update" role="status">
          <div><b>An update is ready.</b><span>Refresh Signal to get the latest offline tools.</span></div>
          <button onClick={applyUpdate}><Icon name="refresh" size={16} /> Update</button>
          <button className="dismiss-update" onClick={() => setUpdateAvailable(false)} aria-label="Update later"><Icon name="close" size={17} /></button>
        </aside>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
