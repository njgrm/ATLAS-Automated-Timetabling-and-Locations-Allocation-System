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
export declare function generateBuildingShortCode(name: string): string;
