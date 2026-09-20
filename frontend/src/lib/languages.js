// Language support for gpt-realtime-translate.
// The model AUTO-DETECTS the source (input) language and only accepts a
// target OUTPUT language via audio.output.language. Source selection here is
// used for the transcript label/hint only; "auto" lets the model detect it.

export const TARGET_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
];

// 70+ input languages the model can auto-detect (label-only in the UI).
const INPUT_LANGUAGE_NAMES = [
  "Arabic", "Afrikaans", "Azerbaijani", "Belarusian", "Bengali", "Bosnian",
  "Bulgarian", "Catalan", "Chinese", "Croatian", "Czech", "Danish", "Dutch",
  "Dzongkha", "English", "Esperanto", "Estonian", "Basque", "Persian / Farsi",
  "Finnish", "Filipino", "French", "Galician", "German", "Greek", "Gujarati",
  "Haitian Creole", "Hawaiian", "Hebrew", "Hindi", "Hungarian", "Armenian",
  "Indonesian", "Italian", "Japanese", "Javanese", "Georgian", "Kazakh",
  "Korean", "Kurdish", "Latin", "Latvian", "Lithuanian", "Macedonian", "Malay",
  "Malayalam", "Maori", "Mongolian", "Burmese / Myanmar", "Nepali", "Norwegian",
  "Nynorsk", "Polish", "Portuguese", "Punjabi", "Romanian", "Russian", "Serbian",
  "Shona", "Slovak", "Slovenian", "Albanian", "Spanish", "Swahili", "Swedish",
  "Tagalog", "Telugu", "Thai", "Turkish", "Ukrainian", "Uzbek", "Vietnamese",
  "Welsh", "Yoruba",
];

export const SOURCE_LANGUAGES = [
  { code: "auto", name: "Auto-detect", flag: "🌐" },
  ...INPUT_LANGUAGE_NAMES.sort((a, b) => a.localeCompare(b)).map((name) => ({
    code: name,
    name,
    flag: "",
  })),
];

export const getTarget = (code) => TARGET_LANGUAGES.find((l) => l.code === code) || TARGET_LANGUAGES[0];
export const getSource = (code) => SOURCE_LANGUAGES.find((l) => l.code === code) || SOURCE_LANGUAGES[0];
export const sourceLabel = (code) => (code === "auto" ? "Detected" : getSource(code).name);
