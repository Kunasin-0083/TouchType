/**
 * Thai text utilities & Grapheme helpers
 * Handles Thai consonants, vowels, and tone marks accurately.
 */

export interface GraphemeUnit {
  text: string;
  start: number;
  end: number;
  chars: string[];
}

export function parseGraphemes(text: string): GraphemeUnit[] {
  const normalized = (text || '').normalize('NFC');
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
      let currentOffset = 0;
      const units: GraphemeUnit[] = [];
      for (const seg of segmenter.segment(normalized)) {
        const segText = seg.segment;
        const len = segText.length;
        units.push({
          text: segText,
          start: currentOffset,
          end: currentOffset + len,
          chars: Array.from(segText)
        });
        currentOffset += len;
      }
      return units;
    } catch {
      // fallback to character-by-character below
    }
  }

  // Fallback
  let offset = 0;
  return Array.from(normalized).map(char => {
    const start = offset;
    offset += char.length;
    return {
      text: char,
      start,
      end: offset,
      chars: [char]
    };
  });
}

export function splitTextIntoChars(text: string): string[] {
  return parseGraphemes(text).map(g => g.text);
}

/**
 * Standard WPM calculation:
 * - English standard: 5 characters = 1 word
 * - Thai standard: 4-5 characters = 1 word or CPM (Characters Per Minute)
 * Net WPM = (Total characters typed / 5) / timeInMinutes - (errors / timeInMinutes)
 */
export function calculateTypingMetrics(
  targetText: string,
  typedText: string,
  timeTakenSeconds: number,
  language: 'th' | 'en'
) {
  const timeInMinutes = Math.max(timeTakenSeconds / 60, 0.0167); // minimum 1 second

  let correctCount = 0;
  let incorrectCount = 0;

  const minLength = Math.min(targetText.length, typedText.length);
  for (let i = 0; i < minLength; i++) {
    if (targetText[i] === typedText[i]) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  // Any extra typed characters beyond target length count as errors
  if (typedText.length > targetText.length) {
    incorrectCount += (typedText.length - targetText.length);
  }

  const evaluatedChars = Math.max(typedText.length, 1);
  const accuracy = Math.min(100, Math.max(0, Math.round((correctCount / evaluatedChars) * 100)));

  // Gross WPM: all typed characters / 5 / minutes
  const divisor = language === 'th' ? 4 : 5;
  const grossWpm = Math.round((typedText.length / divisor) / timeInMinutes);

  // Net WPM: (correct characters / divisor) / timeInMinutes
  // penalized by errors
  const netWpm = Math.max(0, Math.round(((correctCount - incorrectCount * 0.5) / divisor) / timeInMinutes));

  // Score formula: balance of accuracy, speed, and length
  // Score = NetWpm * 10 + (Accuracy * 5) - (Errors * 15)
  const baseScore = Math.max(0, Math.round((netWpm * 12) + (accuracy * 6) - (incorrectCount * 10)));
  const finalScore = Math.max(0, baseScore);

  return {
    totalCharacters: typedText.length,
    correctCharacters: correctCount,
    incorrectCharacters: incorrectCount,
    accuracy,
    grossWpm,
    netWpm,
    finalScore,
    cpm: Math.round((correctCount / timeInMinutes))
  };
}
