// カレンダーの予定：AI社員に頼む仕事を日時と繰り返しで登録する。時刻が来たらAIが案を作る（実行は人）

export const REPEAT = {
  none: '繰り返さない',
  daily: '毎日',
  weekdays: '平日（月〜金）',
  weekly: '毎週',
  monthly: '毎月',
};

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function matches(schedule, day) {
  const start = parseYmd(schedule.date);
  if (day < start) return false;
  if (schedule.until && ymd(day) > schedule.until) return false;
  switch (schedule.repeat) {
    case 'daily': return true;
    case 'weekdays': return day.getDay() >= 1 && day.getDay() <= 5;
    case 'weekly': return day.getDay() === start.getDay();
    // 31日始まりなど、その月に無い日は月末に寄せる
    case 'monthly': {
      const last = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
      return day.getDate() === Math.min(start.getDate(), last);
    }
    default: return ymd(day) === schedule.date;
  }
}

/** from〜to（どちらも 'YYYY-MM-DD'・両端を含む）に入る回の日付 */
export function occurrencesBetween(schedule, from, to) {
  const out = [];
  for (let d = parseYmd(from); ymd(d) <= to; d = addDays(d, 1)) {
    if (matches(schedule, d)) out.push(ymd(d));
  }
  return out;
}

/** その回の日時（ローカル時刻） */
export function occurrenceTime(schedule, date) {
  const [h, m] = (schedule.time || '09:00').split(':').map(Number);
  const d = parseYmd(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * 時刻を過ぎていて、まだ作っていない回のうち「一番新しい1回」だけを返す。
 * サーバーが止まっていた間の回をまとめて作らない（費用が積み上がるのを防ぐ）
 * @param {number} lookbackDays どこまでさかのぼって探すか
 */
export function dueOccurrence(schedule, now = new Date(), lookbackDays = 31) {
  const done = new Set((schedule.runs ?? []).map((r) => r.date));
  const from = ymd(addDays(now, -lookbackDays));
  const dates = occurrencesBetween(schedule, from < schedule.date ? schedule.date : from, ymd(now));
  for (let i = dates.length - 1; i >= 0; i--) {
    if (occurrenceTime(schedule, dates[i]) > now) continue;
    // 登録より前の回は作らない（今日の9時に、10時に登録した予定を作らない）
    if (schedule.createdAt && occurrenceTime(schedule, dates[i]) < new Date(schedule.createdAt) && dates[i] !== schedule.date) return null;
    return done.has(dates[i]) ? null : dates[i];
  }
  return null;
}

export function validateSchedule(s) {
  const errors = [];
  if (!s.agentId) errors.push('AI社員');
  if (!String(s.title ?? '').trim()) errors.push('予定の名前');
  if (!String(s.request ?? '').trim()) errors.push('依頼');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? '')) errors.push('日付');
  if (!/^\d{2}:\d{2}$/.test(s.time ?? '')) errors.push('時刻');
  if (!(s.repeat in REPEAT)) errors.push('繰り返し');
  if (s.until && !/^\d{4}-\d{2}-\d{2}$/.test(s.until)) errors.push('終わりの日');
  return errors;
}
