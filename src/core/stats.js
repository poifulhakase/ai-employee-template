// 経験値とレベル（docs/default_template.md「経験値とレベル」）
import { OUTCOME, outcomeOf } from './classify.js';

const DAY = 86_400_000;

/** 件数と経験値の両方を満たした一番上の段。満たす段がなければレベル1 */
export function levelOf(count, trust, levels) {
  const hit = [...levels]
    .sort((a, b) => b.level - a.level)
    .find((l) => count >= l.minCount && trust >= l.minTrust);
  return hit ? hit.level : 1;
}

/** 次のレベルに足りないもの（カードに一言出す） */
export function nextLevelGap(count, trust, levels) {
  const now = levelOf(count, trust, levels);
  const next = levels.find((l) => l.level === now + 1);
  if (!next) return null;
  const lack = [];
  if (count < next.minCount) lack.push(`件数あと${next.minCount - count}件`);
  if (trust < next.minTrust) lack.push(`経験値${next.minTrust}%以上`);
  return { level: next.level, lack };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * AI社員1人分の数字。
 * 経験値＝「そのまま使われた ÷ 区分が決まった件数」。累計で数える（trustWindowDays に日数を入れると直近◯日だけ）。
 * 区分待ち（期限前）は分母に入れない
 */
export function agentStats(tasks, template, now = Date.now()) {
  const { trustWindowDays, unusedDays } = template.classify;
  const since = trustWindowDays ? now - trustWindowDays * DAY : -Infinity;
  const today = new Date(now);

  let decided = 0;
  let same = 0;
  let todayTotal = 0;
  let todayDone = 0;
  let latest = null;

  for (const t of tasks) {
    const created = new Date(t.createdAt);
    const outcome = outcomeOf(t, now, unusedDays);
    if (created.getTime() >= since && outcome) {
      decided += 1;
      if (outcome === OUTCOME.SAME) same += 1;
    }
    if (isSameDay(created, today)) {
      todayTotal += 1;
      if (t.draft != null) todayDone += 1;
    }
    if (!latest || created > new Date(latest.createdAt)) latest = t;
  }

  const trust = decided ? Math.round((same / decided) * 100) : 0;
  const count = tasks.length;
  return {
    count,
    trust,
    decided,
    level: levelOf(count, trust, template.levels),
    next: nextLevelGap(count, trust, template.levels),
    todayTotal,
    todayDone,
    active: todayTotal > 0,
    latest,
  };
}
