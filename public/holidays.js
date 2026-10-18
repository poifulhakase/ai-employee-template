// 日本の祝日。2016年以降の現行制度に対応。
// 外部ライブラリを使わず native Date で計算する。春分/秋分は1980〜2099年で有効な近似式。
// 「振替休日」「国民の休日（祝日に挟まれた平日）」も反映する。

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/** その月の第n weekday（0=日〜6=土）の日付 */
function nthWeekday(year, month, weekday, nth) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
}

const vernalEquinox = (year) => Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
const autumnalEquinox = (year) => Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

const yearCache = new Map();

function buildYear(year) {
  const h = new Map();
  const set = (m, d, name) => h.set(dateKey(year, m, d), name);
  set(1, 1, '元日');
  set(1, nthWeekday(year, 1, 1, 2), '成人の日');
  set(2, 11, '建国記念の日');
  set(2, 23, '天皇誕生日');
  set(3, vernalEquinox(year), '春分の日');
  set(4, 29, '昭和の日');
  set(5, 3, '憲法記念日');
  set(5, 4, 'みどりの日');
  set(5, 5, 'こどもの日');
  set(7, nthWeekday(year, 7, 1, 3), '海の日');
  set(8, 11, '山の日');
  set(9, nthWeekday(year, 9, 1, 3), '敬老の日');
  set(9, autumnalEquinox(year), '秋分の日');
  set(10, nthWeekday(year, 10, 1, 2), 'スポーツの日');
  set(11, 3, '文化の日');
  set(11, 23, '勤労感謝の日');

  const addDays = (base, delta) => {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return dt;
  };
  const keyOf = (dt) => dateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());

  // 国民の休日：祝日に挟まれた平日
  for (const k of [...h.keys()]) {
    const mid = addDays(k, 1);
    if (mid.getDay() !== 0 && !h.has(keyOf(mid)) && h.has(keyOf(addDays(k, 2)))) h.set(keyOf(mid), '国民の休日');
  }
  // 振替休日：祝日が日曜なら、翌日以降で最初の「祝日でない日」
  for (const [k] of [...h.entries()]) {
    const [y, m, d] = k.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() === 0) {
      let next = addDays(k, 1);
      while (h.has(keyOf(next))) next = addDays(keyOf(next), 1);
      h.set(keyOf(next), '振替休日');
    }
  }
  return h;
}

/** その日が祝日なら祝日名、そうでなければ null */
export function getHolidayName(date) {
  const y = date.getFullYear();
  if (!yearCache.has(y)) yearCache.set(y, buildYear(y));
  return yearCache.get(y).get(dateKey(y, date.getMonth() + 1, date.getDate())) ?? null;
}
