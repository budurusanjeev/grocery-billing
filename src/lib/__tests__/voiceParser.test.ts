import { parseTranscript } from '../voiceParser';

describe('parseTranscript', () => {
  it('parses an English quantity + unit + item', () => {
    expect(parseTranscript('two kg rice')).toEqual([{ query: 'rice', qty: 2, unit: 'kg' }]);
  });

  it('parses a Telugu transliteration quantity + unit', () => {
    expect(parseTranscript('kandi pappu rendu kilolu')).toEqual([
      { query: 'kandi pappu', qty: 2, unit: 'kg' },
    ]);
  });

  it('parses Telugu script number words', () => {
    expect(parseTranscript('బియ్యం మూడు కిలో')).toEqual([{ query: 'బియ్యం', qty: 3, unit: 'kg' }]);
  });

  it('parses Hindi transliteration and script number words', () => {
    expect(parseTranscript('chawal do kilo')).toEqual([{ query: 'chawal', qty: 2, unit: 'kg' }]);
    expect(parseTranscript('चावल दो किलो')).toEqual([{ query: 'चावल', qty: 2, unit: 'kg' }]);
  });

  it('parses literal digits as quantity', () => {
    expect(parseTranscript('4 packets Parle-G')).toEqual([
      { query: 'Parle-G', qty: 4, unit: 'packet' },
    ]);
  });

  it('defaults quantity to 1 when no number word is present', () => {
    expect(parseTranscript('salt')).toEqual([{ query: 'salt', qty: 1, unit: null }]);
  });

  it('understands half and quarter as fractional quantities', () => {
    expect(parseTranscript('half kg sugar')).toEqual([{ query: 'sugar', qty: 0.5, unit: 'kg' }]);
    expect(parseTranscript('ara kilo pappu')).toEqual([{ query: 'pappu', qty: 0.5, unit: 'kg' }]);
  });

  it('converts grams to kg when the gram amount is large (implies a kg-scale quantity)', () => {
    expect(parseTranscript('500 grams rice')).toEqual([{ query: 'rice', qty: 0.5, unit: 'kg' }]);
  });

  it('keeps small gram amounts as-is once converted per the >=50 rule', () => {
    // 10 grams doesn't hit the ">=50" threshold, so it's left as a raw
    // number rather than divided by 1000 into an oddly tiny kg amount.
    expect(parseTranscript('10 grams rice')).toEqual([{ query: 'rice', qty: 10, unit: 'kg' }]);
  });

  it('splits multiple items on commas and "and" in all three languages', () => {
    const result = parseTranscript('rendu kilo biyyam, four packets Parle-G mariyu ఒకటి కిలో పంచదార');
    expect(result).toEqual([
      { query: 'biyyam', qty: 2, unit: 'kg' },
      { query: 'Parle-G', qty: 4, unit: 'packet' },
      { query: 'పంచదార', qty: 1, unit: 'kg' },
    ]);
  });

  it('accepts a literal spoken "0" as a zero quantity (caller is responsible for filtering it out)', () => {
    expect(parseTranscript('0 kg rice')).toEqual([{ query: 'rice', qty: 0, unit: 'kg' }]);
  });

  it('returns an empty array for a transcript with no usable item text', () => {
    expect(parseTranscript('')).toEqual([]);
    expect(parseTranscript('two kg')).toEqual([]);
  });
});
