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

export default function App() {
  const [mode, setMode] = useState<Mode>("morse");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("signal-theme") as Theme) || "simple");
  const [states, setStates] = useState<Record<Mode, TranslationState>>({ morse: emptyTranslation(), text: emptyTranslation() });
  const [saved, setSaved] = useState<SavedItem[]>(loadSaved);
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false);
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
    await navigator.clipboard.writeText(current.output);
    setNotice("Copied to clipboard");
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

  async function playUnits(words = transmissionWords) {
    if (!words.length) return;
    stopAudio();
    const id = playbackId.current;
    setPlaying(true);
    for (let wi = 0; wi < words.length && id === playbackId.current; wi++) {
      setActiveWord(wi);
      for (let li = 0; li < words[wi].length && id === playbackId.current; li++) {
        setActiveLetter(li);
        const symbols = words[wi][li].morse;
        for (let si = 0; si < symbols.length && id === playbackId.current; si++) {
          await tone(symbols[si] === "." ? 90 : 270, id);
          if (si < symbols.length - 1) await delay(90);
        }
        if (li < words[wi].length - 1) await delay(270);
      }
      if (wi < words.length - 1) await delay(630);
    }
    if (id === playbackId.current) stopAudio();
  }

  const playCharacter = (letter: string) => playUnits([[{ letter, morse: MORSE[letter] }]]);
  const savedForMode = saved.filter((item) => item.mode === mode);

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
        <a className="brand" href="#top" aria-label="Signal home"><span className="brand-mark"><i /><i /><i /></span><span>SIGNAL</span></a>
        <div className="header-actions">
          <span className="status"><i /> Ready</span>
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
                <button className="translate-button" onClick={() => runTranslation(mode)}><Icon name="bolt" size={16} /> Translate</button>
              </div>
            </div>

            <div className={`editor output-editor ${current.error ? "has-error" : ""}`} onClick={() => runTranslation(mode)}>
              <div className="editor-label"><span>{mode === "morse" ? "Plain text" : "Morse output"}</span><span>{current.output.length.toLocaleString()} chars</span></div>
              <div className={`output-value ${!current.output ? "empty" : ""}`} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && runTranslation(mode)}>{current.output || "Translation appears here"}</div>
              {current.error && <p className="error-line">{current.error}</p>}
              <div className="output-actions">
                <button onClick={(event) => { event.stopPropagation(); copyOutput(); }} disabled={!current.output || !!current.error}><Icon name="copy" /> Copy</button>
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
          <div className="section-heading"><div><p className="eyebrow">Audio transmitter</p><h2>Hear every signal.</h2></div><button className="play-button" onClick={() => playing ? stopAudio() : playUnits()} disabled={!transmissionWords.length}><Icon name={playing ? "stop" : "play"} /> {playing ? "Stop" : "Transmit"}</button></div>
          <div className="signal-reader" aria-live="polite">
            {transmissionWords.length ? transmissionWords.map((word, wi) => (
              <span className={`signal-word ${activeWord === wi ? "active" : ""}`} key={`${wi}-${word.map((x) => x.letter).join("")}`}>
                {word.map((unit, li) => <span className={`signal-letter ${activeWord === wi && activeLetter === li ? "active" : ""}`} key={`${li}-${unit.letter}`}><b>{unit.letter}</b><small>{unit.morse}</small></span>)}
              </span>
            )) : <p className="reader-empty">A translated message will be shown letter by letter.</p>}
          </div>
        </section>
        
        <section className="reference section-rule">
          <div className="section-heading"><div><p className="eyebrow">Character sheet</p><h2>Tap to listen.</h2></div></div>
          <div className="character-grid">
            {Object.entries(MORSE).filter(([letter]) => /^[A-Z0-9]$/.test(letter)).map(([letter, code]) => <button key={letter} onClick={() => playCharacter(letter)} aria-label={`Play ${letter}, ${code}`}><b>{letter}</b><span>{code}</span></button>)}
          </div>
        </section>
      </main>

      <footer><span>SIGNAL / MORSE UTILITY</span><span>Built for clear communication</span></footer>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
