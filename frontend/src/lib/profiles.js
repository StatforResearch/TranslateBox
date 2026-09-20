// Translation modes and Event Profile -> session instruction compilation.
// NOTE: gpt-realtime-translate does not officially support custom prompting.
// These compiled instructions are sent to the backend, which attaches them to
// the session with a graceful fallback (retry without) so the proven realtime
// flow is never broken. They are also shown in /debug and included in exports.

export const DIRECTIONS = {
  "fr-en": { key: "fr-en", source: "French", sourceNative: "Français", targetCode: "en", target: "English", badge: "FR → EN" },
  "en-fr": { key: "en-fr", source: "English", sourceNative: "English", targetCode: "fr", target: "French", badge: "EN → FR" },
};

export const MODES = {
  GENERAL: {
    key: "GENERAL",
    label: "General",
    instructions:
      "You are a professional simultaneous interpreter. Translate continuously and faithfully. Do not answer the speaker. Do not explain. Do not summarize. Use natural target-language phrasing while remaining close behind the speaker. Do not invent content when audio is unclear.",
  },
  SERMON: {
    key: "SERMON",
    label: "Sermon / Church",
    instructions:
      "You are a professional simultaneous interpreter. Translate continuously and faithfully. Preserve biblical references, theological vocabulary, names, rhetorical questions, repetitions, emphasis and emotional meaning. Do not answer the speaker. Do not preach independently. Do not explain. Do not summarize. Use natural target-language phrasing while remaining close behind the speaker. Do not invent words when audio is unclear.",
  },
  ACADEMIC: {
    key: "ACADEMIC",
    label: "Academic",
    instructions:
      "You are a professional simultaneous interpreter. Translate continuously and faithfully. Preserve scientific terminology, numbers, units, acronyms, citations, species names and technical expressions. Do not answer the speaker. Do not explain. Do not summarize. Use precise, natural target-language phrasing while remaining close behind the speaker. Do not invent content when audio is unclear.",
  },
  BUSINESS: {
    key: "BUSINESS",
    label: "Business",
    instructions:
      "You are a professional simultaneous interpreter for business settings. Translate continuously and faithfully using concise, professional business terminology. Preserve figures, company and product names, and agreed terminology. Do not answer the speaker. Do not explain. Do not summarize. Remain close behind the speaker. Do not invent content when audio is unclear.",
  },
  CUSTOM: {
    key: "CUSTOM",
    label: "Custom",
    instructions: "",
  },
};

export const EMPTY_PROFILE = {
  eventName: "",
  organization: "",
  speakers: "",
  vocabNames: "",
  vocabAcronyms: "",
  vocabTechnical: "",
  vocabBiblical: "",
  vocabPlaces: "",
  additional: "",
};

const linesFrom = (text) =>
  (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function compileInstructions({ modeKey, customText, targetName, profile }) {
  const mode = MODES[modeKey] || MODES.GENERAL;
  const base = modeKey === "CUSTOM" ? (customText || MODES.GENERAL.instructions) : mode.instructions;

  const parts = [base, `Translate the speaker's words into ${targetName || "English"}. The source language is auto-detected.`];

  const p = profile || EMPTY_PROFILE;
  if (p.eventName) parts.push(`Event: ${p.eventName}.`);
  if (p.organization) parts.push(`Organization: ${p.organization}.`);
  const speakers = linesFrom(p.speakers);
  if (speakers.length) parts.push(`Speakers: ${speakers.join(", ")}.`);

  const vocab = [
    ["Proper nouns / names", p.vocabNames],
    ["Acronyms", p.vocabAcronyms],
    ["Technical terms", p.vocabTechnical],
    ["Biblical terms", p.vocabBiblical],
    ["Places", p.vocabPlaces],
  ];
  const vocabParts = [];
  for (const [label, val] of vocab) {
    const items = linesFrom(val);
    if (items.length) vocabParts.push(`${label}: ${items.join(", ")}`);
  }
  if (vocabParts.length) {
    parts.push(
      "Preserve and correctly spell the following domain vocabulary exactly as written — " +
        vocabParts.join("; ") +
        "."
    );
  }

  const additional = linesFrom(p.additional);
  if (additional.length) parts.push(additional.join(" "));

  return parts.join(" ");
}
