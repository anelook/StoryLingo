const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡?!.,;:"'“”«»()\-–—…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (s: string) => strip(s).split(" ").filter(Boolean);

/** Word-level longest-common-subsequence ratio (0..1) of target words that were recognised in order. */
export function matchRatio(target: string, heard: string) {
  const a = tokens(target);
  const b = tokens(heard);
  if (!a.length) return { ratio: 0, missing: [] as string[], extra: [] as string[] };
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  // backtrack to find missing / extra words
  const matchedA = new Set<number>();
  const matchedB = new Set<number>();
  let i = a.length, j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { matchedA.add(i - 1); matchedB.add(j - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return {
    ratio: dp[a.length][b.length] / Math.max(a.length, b.length),
    missing: a.filter((_, k) => !matchedA.has(k)),
    extra: b.filter((_, k) => !matchedB.has(k)),
  };
}
