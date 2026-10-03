export function levenshteinDistance(left: string, right: string): number {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  if (leftChars.length === 0) return rightChars.length;
  if (rightChars.length === 0) return leftChars.length;

  let previous = Array.from({ length: rightChars.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < leftChars.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < rightChars.length; rightIndex += 1) {
      const substitution = previous[rightIndex]! + (leftChars[leftIndex] === rightChars[rightIndex] ? 0 : 1);
      current.push(Math.min(
        current[rightIndex]! + 1,
        previous[rightIndex + 1]! + 1,
        substitution,
      ));
    }
    previous = current;
  }
  return previous[rightChars.length]!;
}

export function levenshteinSimilarity(left: string, right: string): number {
  const length = Math.max(Array.from(left).length, Array.from(right).length);
  if (length === 0) return 1;
  return 1 - levenshteinDistance(left, right) / length;
}
