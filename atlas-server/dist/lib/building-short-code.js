/**
 * Deterministic building short-code generator.
 *
 * Rules:
 *  1. Strip filler words ("and", "the", "of") unless the name is only one real word.
 *  2. Take the uppercase first letter of each remaining word.
 *  3. Append any trailing numeric tokens as-is.
 *
 * Examples:
 *   "Main Building 1"                → "MB1"
 *   "Science and Technology Building" → "STB"
 *   "New Academic Block 2"           → "NAB2"
 *   "Gymnasium"                      → "G"
 *   "Old Library"                    → "OL"
 */
const FILLER_WORDS = new Set(['and', 'the', 'of']);
export function generateBuildingShortCode(name) {
    const tokens = name.trim().split(/\s+/);
    if (tokens.length === 0)
        return '';
    // Separate trailing numeric tokens
    const trailingNumbers = [];
    while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) {
        trailingNumbers.unshift(tokens.pop());
    }
    // Filter filler words (only if there would still be at least one word left)
    const meaningful = tokens.filter((t) => !FILLER_WORDS.has(t.toLowerCase()));
    const words = meaningful.length > 0 ? meaningful : tokens;
    // Build initials from remaining words (skip pure-numeric words already removed)
    const initials = words
        .map((w) => w.charAt(0).toUpperCase())
        .join('');
    return initials + trailingNumbers.join('');
}
//# sourceMappingURL=building-short-code.js.map