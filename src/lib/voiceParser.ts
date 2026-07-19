// Turns a speech transcript ("kandi pappu rendu kilolu mariyu parle g nalugu
// packets") into structured entries: [{ query, qty, unit }]. Handles Telugu,
// English, and Hindi number words in both native script and transliteration.

export interface ParsedEntry {
  query: string;
  qty: number;
  unit: string | null;
}

const NUMBER_WORDS: Record<string, number> = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, quarter: 0.25,
  // Telugu transliteration
  okati: 1, rendu: 2, moodu: 3, mudu: 3, nalugu: 4, aidu: 5, ayidu: 5,
  aaru: 6, edu: 7, yedu: 7, enimidi: 8, tommidi: 9, padi: 10,
  ara: 0.5, paavu: 0.25, pavu: 0.25,
  // Telugu script
  'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'అర': 0.5, 'పావు': 0.25,
  // Hindi transliteration + script
  ek: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5,
  chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, aadha: 0.5,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'आधा': 0.5,
};

const UNIT_WORDS: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilolu: 'kg',
  'కిలో': 'kg', 'కిలోలు': 'kg', 'किलो': 'kg',
  gram: 'g', grams: 'g', 'గ్రాములు': 'g', 'ग्राम': 'g',
  packet: 'packet', packets: 'packet', pack: 'packet', packs: 'packet',
  packetlu: 'packet', 'ప్యాకెట్': 'packet', 'ప్యాకెట్లు': 'packet', 'पैकेट': 'packet',
  litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre',
  'లీటర్': 'litre', 'లీటర్లు': 'litre', 'लीटर': 'litre',
  dozen: 'dozen', 'డజను': 'dozen', 'दर्जन': 'dozen',
  piece: 'piece', pieces: 'piece', 'ముక్క': 'piece',
};

// Segment separators: commas, "and" in the three languages.
const SEPARATORS = /,|\band\b|\bmariyu\b|\bమరియు\b|\baur\b|\bऔर\b/gi;

function parseSegment(segment: string): ParsedEntry | null {
  const tokens = segment.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let qty: number | null = null;
  let unit: string | null = null;
  const queryTokens: string[] = [];

  for (const rawToken of tokens) {
    const token = rawToken.toLowerCase();

    const numeric = token.match(/^(\d+(?:\.\d+)?)$/);
    if (numeric && qty === null) {
      qty = parseFloat(numeric[1]);
      continue;
    }
    if (qty === null && NUMBER_WORDS[token] !== undefined) {
      qty = NUMBER_WORDS[token];
      continue;
    }
    if (UNIT_WORDS[token] !== undefined && unit === null) {
      unit = UNIT_WORDS[token];
      continue;
    }
    queryTokens.push(rawToken);
  }

  if (queryTokens.length === 0) return null;

  let finalQty = qty ?? 1;
  // "500 grams" means half a kg on a kg-priced item.
  if (unit === 'g') {
    finalQty = finalQty >= 50 ? finalQty / 1000 : finalQty;
    unit = 'kg';
  }

  return { query: queryTokens.join(' '), qty: finalQty, unit };
}

export function parseTranscript(transcript: string): ParsedEntry[] {
  return transcript
    .split(SEPARATORS)
    .map(parseSegment)
    .filter((e): e is ParsedEntry => e !== null);
}
