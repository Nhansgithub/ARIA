// Detect Vietnamese vs English by scanning for Vietnamese-specific Unicode code points.
// Checked ranges:
//   0x0102–0x0103  ĂĂ (Latin Extended-A)
//   0x0110–0x0111  ĐĐ (Latin Extended-A)
//   0x01A0–0x01A1  ƠƠ (Latin Extended-B, only Vietnamese)
//   0x01AF–0x01B0  ƯƯ (Latin Extended-B, only Vietnamese)
//   0x1EA0–0x1EF9  Vietnamese Extended Latin block (all toned vowel variants)
// English text never contains any of these characters.
export function detectLanguage(text: string): 'vi' | 'en' {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i)
    if (
      (cp >= 0x0102 && cp <= 0x0103) ||
      (cp >= 0x0110 && cp <= 0x0111) ||
      (cp >= 0x01a0 && cp <= 0x01a1) ||
      (cp >= 0x01af && cp <= 0x01b0) ||
      (cp >= 0x1ea0 && cp <= 0x1ef9)
    ) {
      return 'vi'
    }
  }
  return 'en'
}
