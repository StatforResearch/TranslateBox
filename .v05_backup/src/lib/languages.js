// Language support for gpt-realtime-translate.
// Source is AUTO-DETECTED by the model (70+ input languages); only the target
// OUTPUT language is sent to the API (audio.output.language). The 13 output
// languages below are the complete set supported by the model.

// Native (endonym) names keyed by English name.
const NATIVE = {
  Arabic: "العربية", Afrikaans: "Afrikaans", Azerbaijani: "Azərbaycan",
  Belarusian: "Беларуская", Bengali: "বাংলা", Bosnian: "Bosanski",
  Bulgarian: "Български", Catalan: "Català", Chinese: "中文", Croatian: "Hrvatski",
  Czech: "Čeština", Danish: "Dansk", Dutch: "Nederlands", Dzongkha: "རྫོང་ཁ",
  English: "English", Esperanto: "Esperanto", Estonian: "Eesti", Basque: "Euskara",
  "Persian / Farsi": "فارسی", Finnish: "Suomi", Filipino: "Filipino",
  French: "Français", Galician: "Galego", German: "Deutsch", Greek: "Ελληνικά",
  Gujarati: "ગુજરાતી", "Haitian Creole": "Kreyòl ayisyen", Hawaiian: "ʻŌlelo Hawaiʻi",
  Hebrew: "עברית", Hindi: "हिन्दी", Hungarian: "Magyar", Armenian: "Հայերեն",
  Indonesian: "Bahasa Indonesia", Italian: "Italiano", Japanese: "日本語",
  Javanese: "Basa Jawa", Georgian: "ქართული", Kazakh: "Қазақ", Korean: "한국어",
  Kurdish: "Kurdî", Latin: "Latina", Latvian: "Latviešu", Lithuanian: "Lietuvių",
  Macedonian: "Македонски", Malay: "Bahasa Melayu", Malayalam: "മലയാളം",
  Maori: "Māori", Mongolian: "Монгол", "Burmese / Myanmar": "မြန်မာ", Nepali: "नेपाली",
  Norwegian: "Norsk", Nynorsk: "Nynorsk", Polish: "Polski", Portuguese: "Português",
  Punjabi: "ਪੰਜਾਬੀ", Romanian: "Română", Russian: "Русский", Serbian: "Српски",
  Shona: "chiShona", Slovak: "Slovenčina", Slovenian: "Slovenščina", Albanian: "Shqip",
  Spanish: "Español", Swahili: "Kiswahili", Swedish: "Svenska", Tagalog: "Tagalog",
  Telugu: "తెలుగు", Thai: "ไทย", Turkish: "Türkçe", Ukrainian: "Українська",
  Uzbek: "Oʻzbek", Vietnamese: "Tiếng Việt", Welsh: "Cymraeg", Yoruba: "Yorùbá",
};

const nat = (name) => NATIVE[name] || name;

// 13 output languages (code = ISO used by the API).
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
].map((l) => ({ ...l, native: nat(l.name) }));

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
  { code: "auto", name: "Auto-detect", native: "Auto-detect", flag: "🌐" },
  ...INPUT_LANGUAGE_NAMES.slice()
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ code: name, name, native: nat(name), flag: "" })),
];

export const getTarget = (code) => TARGET_LANGUAGES.find((l) => l.code === code) || TARGET_LANGUAGES[0];
export const getSource = (code) => SOURCE_LANGUAGES.find((l) => l.code === code) || SOURCE_LANGUAGES[0];
export const sourceLabel = (code) => (code === "auto" ? "Detected" : getSource(code).name);

// Map a source selection to a target ISO code (by matching English name), if it
// is one of the 13 supported output languages. Returns null otherwise.
export const sourceToTargetCode = (sourceCode) => {
  if (sourceCode === "auto") return null;
  return TARGET_LANGUAGES.find((l) => l.name === sourceCode)?.code || null;
};
// Map a target code to its source selection value (the English name).
export const targetToSourceCode = (targetCode) => getTarget(targetCode).name;
