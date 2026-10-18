// 依頼1件の区分：AIの案と、人が実際に使った文を比べて自動で付ける（docs/default_template.md「区分」）

export const OUTCOME = {
  SAME: 'same',     // そのまま使われた
  EDITED: 'edited', // 直された
  UNUSED: 'unused', // 使われなかった
};

export const OUTCOME_LABEL = {
  same: 'そのまま受け取った',
  edited: '直して受け取った',
  unused: '使わなかった',
  pending: '待ち',
};

// 誤字・句読点・空白・改行の違いはならす（AIの実力と関係が薄い）
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[\s\p{P}]/gu, '')
    .toLowerCase();
}

// 数字・日付・金額は一致率と別に比べる（「1,000円」→「10,000円」は一致率99%でも重大）
export function numbersOf(text) {
  const found = String(text ?? '').normalize('NFKC').match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found.map((n) => n.replace(/,/g, '')).sort();
}

function sameNumbers(a, b) {
  const x = numbersOf(a);
  const y = numbersOf(b);
  return x.length === y.length && x.every((n, i) => n === y[i]);
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 長文は編集距離が重いので、2文字ずつの重なり（Dice係数）で近似する
function bigramDice(a, b) {
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let overlap = 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  const total = Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0);
  return total === 0 ? 1 : (2 * overlap) / total;
}

const EDIT_DISTANCE_LIMIT = 4_000_000; // 文字数の積がこれを超えたら近似に切り替える

export function similarity(draft, used) {
  const a = normalize(draft);
  const b = normalize(used);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (a.length * b.length > EDIT_DISTANCE_LIMIT) return bigramDice(a, b);
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * @param {string} draft AIの案
 * @param {string} used 実際に使われた文
 * @param {{same:number, unused:number}} th 一致率のしきい値（template.json の classify）
 */
export function classify(draft, used, th) {
  const sim = similarity(draft, used);
  if (sim < th.unused) return { outcome: OUTCOME.UNUSED, similarity: sim, numbersChanged: false };
  const numbersChanged = !sameNumbers(draft, used);
  const outcome = !numbersChanged && sim >= th.same ? OUTCOME.SAME : OUTCOME.EDITED;
  return { outcome, similarity: sim, numbersChanged };
}

// 区分が決まっていない依頼は、期限を過ぎたら「使われなかった」
export function outcomeOf(task, now, unusedDays) {
  if (task.outcome) return task.outcome;
  const age = (now - new Date(task.createdAt).getTime()) / 86_400_000;
  return age >= unusedDays ? OUTCOME.UNUSED : null;
}
