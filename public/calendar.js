// カレンダー：運用カレンダー（CalendarPage / MonthGrid / TimeGrid / CalendarSidebar / EventPopup / EventEditModal）を
// このポータル用に素のJSへ移したもの。レイヤー＝AI社員、予定＝AI社員に頼む仕事（時刻が来たらAIが実行し、結果を人が受け取る）。
import { getHolidayName } from './holidays.js';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const MAX_PILLS = 4;
const HOUR_H = 56; // calendar.css の --hour-h と一致
const TOTAL_MIN = 24 * 60;
const GRID_H = HOUR_H * 24;
const LS_VISIBLE = 'aip.calendar.visible';

export const STATUS = {
  planned: { label: '予定', mark: '○', note: '時刻が来るとAIが実行します。' },
  pending: { label: '結果あり', mark: '●', note: 'AIの結果が届いています。受け取るかどうかを決めてください。' },
  same: { label: 'そのまま受け取った', mark: '✓', note: 'AIの結果をそのまま受け取りました。' },
  edited: { label: '直して受け取った', mark: '✎', note: '人が直してから受け取りました。' },
  unused: { label: '使わなかった', mark: '×', note: 'この回の結果は使いませんでした。' },
  error: { label: '失敗', mark: '!', note: 'AIへの依頼に失敗しました。' },
};

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const monthGrid = (y, m) => { const first = new Date(y, m, 1); const s = addDays(first, -first.getDay()); return Array.from({ length: 42 }, (_, i) => addDays(s, i)); };
const weekGrid = (base) => { const s = addDays(base, -base.getDay()); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const dayLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日（${DOW[d.getDay()]}）`;
const isMobile = () => window.matchMedia('(max-width: 560px)').matches;

const st = {
  cursor: new Date(),
  view: 'month',
  items: [],
  repeat: {},
  visible: (() => { try { return JSON.parse(localStorage.getItem(LS_VISIBLE) ?? '{}'); } catch { return {}; } })(),
  clock: null,
};

let ctx = null; // { api, S, colorsOf, esc, toast, openOccurrence, reload }

const esc = (v) => ctx.esc(v);
const visibleOf = (agentId) => st.visible[agentId] !== false;
function saveVisible() {
  try { localStorage.setItem(LS_VISIBLE, JSON.stringify(st.visible)); } catch { /* 保存できなくても表示は続ける */ }
}

function layerOf(agentId) {
  const a = ctx.S.agents.find((x) => x.id === agentId);
  if (!a) return { name: '（いないAI社員）', color: '#7a8699', bg: 'rgba(122,134,153,.18)' };
  const c = ctx.colorsOf(a);
  return { name: a.fields.name, color: c.shirtDark, bg: c.tint };
}

function days() {
  if (st.view === 'month') return monthGrid(st.cursor.getFullYear(), st.cursor.getMonth());
  if (st.view === 'day') return [new Date(st.cursor)];
  return weekGrid(st.cursor);
}

function byDate(items) {
  const m = new Map();
  for (const it of items) {
    if (!visibleOf(it.agentId)) continue;
    if (!m.has(it.date)) m.set(it.date, []);
    m.get(it.date).push(it);
  }
  for (const list of m.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return m;
}

const pillAttrs = (it) => {
  const l = layerOf(it.agentId);
  return `data-cal="ev" data-sid="${it.scheduleId}" data-date="${it.date}" style="--pill-color:${l.color};--pill-bg:${l.bg}" title="${esc(`${it.time} ${it.title}（${l.name}・${STATUS[it.status].label}）`)}"`;
};

// ---------- 左サイドバー（CalendarSidebar） ----------

function clockParts(now) {
  return { time: `${now.getHours()}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`, date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${DOW[now.getDay()]}）` };
}

function sidebarHtml() {
  const now = new Date();
  const c = clockParts(now);
  const holiday = getHolidayName(now);
  const counts = new Map();
  for (const it of st.items) counts.set(it.agentId, (counts.get(it.agentId) ?? 0) + 1);
  return `
<aside class="sidebar">
  <div class="clockCard">
    <div class="clock" id="cal-clock">${c.time}</div>
    <div class="clockDate" id="cal-clock-date">${c.date}</div>
    ${holiday ? `<div class="clockHoliday">${esc(holiday)}</div>` : ''}
  </div>
  <div class="filterCard">
    <p class="filterHeading">表示レイヤー（AI社員）</p>
    ${ctx.S.agents.map((a) => {
      const l = layerOf(a.id);
      return `<label class="filterRow ${visibleOf(a.id) ? '' : 'filterRowOff'}">
        <input type="checkbox" class="hiddenCheck" data-cal="layer" data-agent="${a.id}" ${visibleOf(a.id) ? 'checked' : ''}>
        <span class="dot" style="background:${l.color}"></span><span class="filterLabel">${esc(a.fields.name)}</span><span class="layerCount">${counts.get(a.id) ?? 0}</span>
      </label>`;
    }).join('')}
  </div>
</aside>`;
}

// ---------- 月ビュー（MonthGrid） ----------

function monthHtml(ds, map) {
  const today = ymd(new Date());
  const month = st.cursor.getMonth();
  return `
<div class="monthWrap">
  <div class="dowRow">${DOW.map((d, i) => `<div class="dowCell ${i === 0 ? 'dowSun' : ''} ${i === 6 ? 'dowSat' : ''}">${d}</div>`).join('')}</div>
  <div class="grid">
    ${ds.map((d) => {
      const key = ymd(d);
      const holiday = getHolidayName(d);
      const isSun = d.getDay() === 0;
      const isSat = d.getDay() === 6;
      const list = map.get(key) ?? [];
      const shown = list.slice(0, MAX_PILLS);
      const rest = list.length - shown.length;
      return `<div class="cell ${d.getMonth() !== month ? 'cellDim' : ''} ${key === today ? 'cellToday' : ''} ${holiday ? 'cellHoliday' : ''}" data-cal="add" data-date="${key}">
        <div class="dateNumWrap">
          <button type="button" class="dateNum ${key === today ? 'dateToday' : ''} ${isSun || holiday ? 'dateSun' : ''} ${isSat && !holiday ? 'dateSat' : ''}" data-cal="add" data-date="${key}" aria-label="${dayLabel(d)}${holiday ? `・${holiday}` : ''}の予定を追加">${d.getDate()}</button>
          ${holiday ? `<span class="holidayTag">${esc(holiday)}</span>` : ''}
        </div>
        <div class="events">
          ${shown.map((it) => `<button type="button" class="pill ${it.status === 'planned' ? 'pillInactive' : ''}" ${pillAttrs(it)}>
            <span class="pillTime">${it.time}</span><span class="pillTitle">${esc(it.title)}</span><span class="pillMark">${STATUS[it.status].mark}</span></button>`).join('')}
          ${rest > 0 ? `<button type="button" class="moreTag" data-cal="drill" data-date="${key}" aria-label="${dayLabel(d)}の残り${rest}件を週表示で見る">＋${rest}件</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>
</div>`;
}

// ---------- 週／日ビュー（TimeGrid） ----------

// 同じ時間帯に重なる予定を左右のレーンに分ける（貪欲法）
function layoutDayEvents(list) {
  const items = list.map((it) => { const s = toMinutes(it.time); return { it, start: s, end: s + 60 }; }).sort((a, b) => a.start - b.start);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds = [];
    for (const c of cluster) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > c.start) lane++;
      laneEnds[lane] = c.end;
      c.col = lane;
    }
    for (const c of cluster) out.push({ it: c.it, start: c.start, col: c.col, cols: Math.max(1, laneEnds.length) });
    cluster = [];
    clusterEnd = -1;
  };
  for (const x of items) {
    if (cluster.length && x.start >= clusterEnd) flush();
    cluster.push({ ...x, col: 0 });
    clusterEnd = Math.max(clusterEnd, x.end);
  }
  if (cluster.length) flush();
  return out;
}

function timeGridHtml(ds, map) {
  const now = new Date();
  const today = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return `
<div class="tgWrap">
  <div class="tgHeader">
    <div class="tgGutter"></div>
    ${ds.map((d) => {
      const key = ymd(d);
      const holiday = getHolidayName(d);
      const isSun = d.getDay() === 0;
      const isSat = d.getDay() === 6;
      return `<div class="tgDayHead" data-cal="add" data-date="${key}">
        <span class="tgDow ${isSun || holiday ? 'dowSun' : ''} ${isSat && !holiday ? 'dowSat' : ''}">${DOW[d.getDay()]}</span>
        <button type="button" class="tgDateNum ${key === today ? 'dateToday' : ''} ${isSun || holiday ? 'dateSun' : ''} ${isSat && !holiday ? 'dateSat' : ''}" data-cal="add" data-date="${key}" aria-label="${dayLabel(d)}の予定を追加">${d.getDate()}</button>
        ${holiday ? `<span class="holidayTag">${esc(holiday)}</span>` : ''}
      </div>`;
    }).join('')}
  </div>
  <div class="tgScroll" id="cal-scroll">
    <div class="tgGrid">
      <div class="tgGutter" style="position:relative">${Array.from({ length: 24 }, (_, h) => `<div class="tgHourLabel">${h > 0 ? `<span>${pad(h)}:00</span>` : ''}</div>`).join('')}</div>
      ${ds.map((d) => {
        const key = ymd(d);
        const holiday = getHolidayName(d);
        return `<div class="tgCol ${holiday && key !== today ? 'tgColClosed' : ''}">
          ${Array.from({ length: 24 }, (_, h) => `<div class="tgHourCell" data-cal="add" data-date="${key}" data-time="${pad(h)}:00"></div>`).join('')}
          ${layoutDayEvents(map.get(key) ?? []).map(({ it, start, col, cols }) => {
            const w = 100 / cols;
            const l = layerOf(it.agentId);
            return `<button type="button" class="tgEvent ${it.status === 'planned' ? 'pillInactive' : ''}" data-cal="ev" data-sid="${it.scheduleId}" data-date="${it.date}"
              style="top:${(start / TOTAL_MIN) * GRID_H}px;height:${(60 / TOTAL_MIN) * GRID_H}px;left:calc(${col * w}% + 2px);width:calc(${w}% - 4px);right:auto;--pill-color:${l.color};--pill-bg:${l.bg}"
              title="${esc(`${it.title}（${l.name}・${STATUS[it.status].label}）`)}">
              <div class="tgEventTitle">${STATUS[it.status].mark} ${esc(it.title)}</div>
              <div class="tgEventTime">${it.time}・${esc(l.name)}</div>
            </button>`;
          }).join('')}
          ${key === today ? `<div class="nowLine" style="top:${(nowMin / TOTAL_MIN) * 100}%"><div class="nowDot"></div><div class="nowBar"></div></div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>
</div>`;
}

// ---------- 全体（CalendarPage） ----------

function title(ds) {
  if (st.view === 'month') return `${st.cursor.getFullYear()}年 ${st.cursor.getMonth() + 1}月`;
  const s = ds[0];
  if (st.view === 'day') return `${s.getFullYear()}年 ${s.getMonth() + 1}月${s.getDate()}日（${DOW[s.getDay()]}）`;
  return `${s.getFullYear()}年 ${s.getMonth() + 1}月${s.getDate()}日 週`;
}

export async function calendarHtml(context) {
  ctx = context;
  if (isMobile() && st.view === 'week') st.view = 'day';
  if (!isMobile() && st.view === 'day') st.view = 'week';
  const ds = days();
  const { items, repeat } = await ctx.api(`/api/schedules?from=${ymd(ds[0])}&to=${ymd(ds[ds.length - 1])}`);
  st.items = items;
  st.repeat = repeat;
  const map = byDate(items);
  const tabs = isMobile() ? [['month', '月'], ['day', '日']] : [['month', '月'], ['week', '週']];
  return `
<div class="calroot" id="calroot">
  ${sidebarHtml()}
  <section class="main">
    <div class="toolbar">
      <span class="monthTitle">${title(ds)}</span>
      <button type="button" class="navBtn" data-cal="step" data-step="-1" aria-label="前へ">‹</button>
      <button type="button" class="navBtn" data-cal="step" data-step="1" aria-label="次へ">›</button>
      <button type="button" class="todayBtn" data-cal="today">今日</button>
      <span class="spacer"></span>
    </div>
    ${st.view === 'month' ? monthHtml(ds, map) : timeGridHtml(ds, map)}
    <div class="floatToggle">${tabs.map(([k, l]) => `<button type="button" class="floatTab ${st.view === k ? 'floatTabActive' : ''}" data-cal="view" data-view="${k}">${l}</button>`).join('')}</div>
  </section>
  <div id="cal-layer"></div>
</div>`;
}

/** 画面に出した後の仕上げ：時計を動かし、週表示は今の時刻（なければ9時）までスクロール */
export function afterRender() {
  clearInterval(st.clock);
  st.clock = setInterval(() => {
    const el = document.getElementById('cal-clock');
    if (!el) return clearInterval(st.clock);
    const c = clockParts(new Date());
    el.textContent = c.time;
    document.getElementById('cal-clock-date').textContent = c.date;
  }, 1000);
  const sc = document.getElementById('cal-scroll');
  if (sc) {
    const ds = days();
    const hasToday = ds.some((d) => ymd(d) === ymd(new Date()));
    const n = new Date();
    const minutes = hasToday ? n.getHours() * 60 + n.getMinutes() : 9 * 60;
    sc.scrollTop = (minutes / TOTAL_MIN) * GRID_H - sc.clientHeight / 2;
  }
}

// ---------- 小窓（EventPopup） ----------

function closeLayer() {
  const el = document.getElementById('cal-layer');
  if (el) el.innerHTML = '';
}

async function openPopup(sid, date, x, y) {
  const it = st.items.find((v) => v.scheduleId === sid && v.date === date);
  const s = await ctx.api(`/api/schedules/${sid}`);
  const l = layerOf(s.agentId);
  const status = STATUS[it?.status ?? 'planned'];
  const popW = 300;
  const left = Math.min(x, window.innerWidth - popW - 12);
  const top = y + 280 > window.innerHeight ? Math.max(12, y - 290) : y;
  const actions = it?.status === 'planned' || it?.status === 'error'
    ? `<button type="button" class="popupDelete" data-cal="del" data-sid="${sid}">削除</button>
       <button type="button" class="btnCancel" data-cal="edit" data-sid="${sid}">直す</button>
       <button type="button" class="btnSave" data-cal="run" data-sid="${sid}" data-date="${date}">今すぐ頼む</button>`
    : `<button type="button" class="popupDelete" data-cal="del" data-sid="${sid}">削除</button>
       <button type="button" class="btnCancel" data-cal="edit" data-sid="${sid}">直す</button>
       <button type="button" class="btnSave" data-cal="open" data-sid="${sid}" data-date="${date}">結果を見る</button>`;
  document.getElementById('cal-layer').innerHTML = `
<div class="popup" id="cal-popup" style="top:${top}px;left:${left}px;width:${popW}px;--pop-color:${l.color}">
  <span class="popupLayer">${esc(l.name)}</span>
  <div class="popupTitle">${esc(s.title)}</div>
  <div class="popupMeta">${date}・${esc(s.time)}（${esc(st.repeat[s.repeat] ?? s.repeat)}${s.until ? `・${esc(s.until)}まで` : ''}）</div>
  <div class="popupStatus">${status.mark} ${status.label}：${it?.error ? esc(it.error) : status.note}</div>
  <div class="popupRequest">${esc(s.request)}</div>
  <div class="popupActions">${actions}</div>
</div>`;
}

// ---------- 登録・編集モーダル（EventEditModal） ----------

function openModal(s, id = null) {
  if (!ctx.S.agents.length) return ctx.toast('AI社員がいません。管理者が npm run agent -- add で追加します', true);
  const [y, m, d] = s.date.split('-').map(Number);
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  document.getElementById('cal-layer').innerHTML = `
<div class="modalOverlay" data-cal="overlay">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modalHeader"><span class="modalTitle">${id ? '予定を直す' : `${y}年${m}月${d}日 に予定を追加`}</span><button type="button" class="modalClose" data-cal="close" aria-label="閉じる">×</button></div>
    <div class="field"><label class="fieldLabel">AI社員（レイヤー）</label><select class="selectInput" name="agentId">${ctx.S.agents.map((a) => opt(a.id, a.fields.name, s.agentId)).join('')}</select></div>
    <div class="field"><label class="fieldLabel">予定の名前</label><input class="input" name="title" value="${esc(s.title ?? '')}" placeholder="例：週報の下書き"></div>
    <div class="field"><label class="fieldLabel">依頼（毎回この文でAIに頼みます。資料・引用は切らずにそのまま）</label><textarea class="input" name="request">${esc(s.request ?? '')}</textarea></div>
    <div class="fieldRow">
      <div class="field"><label class="fieldLabel">日付</label><input class="timeInput" type="date" name="date" value="${esc(s.date)}"></div>
      <div class="field"><label class="fieldLabel">時刻（この時刻にAIが実行）</label><input class="timeInput" type="time" name="time" value="${esc(s.time ?? '09:00')}"></div>
      <div class="field"><label class="fieldLabel">繰り返し</label><select class="selectInput" name="repeat">${Object.entries(st.repeat).map(([k, v]) => opt(k, v, s.repeat ?? 'none')).join('')}</select></div>
      <div class="field"><label class="fieldLabel">終わりの日（繰り返すとき）</label><input class="timeInput" type="date" name="until" value="${esc(s.until ?? '')}"></div>
    </div>
    <p class="hint">AIは時刻を決めて動かします（終日は選べません）。サーバーが止まっていた間の回は、次の起動時に一番新しい1回だけ作ります。</p>
    <div class="modalActions"><button type="button" class="btnCancel" data-cal="close">キャンセル</button><button type="button" class="btnSave" data-cal="save" ${id ? `data-sid="${id}"` : ''}>保存</button></div>
  </div>
</div>`;
  document.querySelector('#cal-layer [name=title]').focus();
}

function readModal() {
  const v = (n) => document.querySelector(`#cal-layer [name="${n}"]`).value;
  return { agentId: v('agentId'), title: v('title'), request: v('request'), date: v('date'), time: v('time'), repeat: v('repeat'), until: v('until') };
}

// ---------- 操作 ----------

/** クリックを受け持ったら true を返す */
export async function handleCalendarClick(e) {
  const root = document.getElementById('calroot');
  if (!root || !root.contains(e.target)) return false;
  const el = e.target.closest('[data-cal]');
  // 小窓の外を押したら閉じる
  const popup = document.getElementById('cal-popup');
  if (popup && !popup.contains(e.target)) closeLayer();
  if (!el) return true;
  const { cal, sid, date } = el.dataset;
  const rerender = () => ctx.reload();
  try {
    switch (cal) {
      case 'step': {
        const n = Number(el.dataset.step);
        if (st.view === 'month') st.cursor = new Date(st.cursor.getFullYear(), st.cursor.getMonth() + n, 1);
        else st.cursor = addDays(st.cursor, st.view === 'day' ? n : n * 7);
        return rerender(), true;
      }
      case 'today': st.cursor = new Date(); return rerender(), true;
      case 'view': st.view = el.dataset.view; return rerender(), true;
      case 'drill': st.view = isMobile() ? 'day' : 'week'; st.cursor = new Date(date); return rerender(), true;
      case 'layer': st.visible[el.dataset.agent] = el.checked; saveVisible(); return rerender(), true;
      case 'add': if (!popup) openModal({ date, time: el.dataset.time ?? '09:00', repeat: 'none', agentId: ctx.S.agents[0]?.id }); return true;
      case 'ev': await openPopup(sid, date, e.clientX, e.clientY); return true;
      case 'overlay': if (e.target === el) closeLayer(); return true;
      case 'close': closeLayer(); return true;
      case 'edit': openModal(await ctx.api(`/api/schedules/${sid}`), sid); return true;
      case 'open': closeLayer(); await ctx.openOccurrence(sid, date, st.items); return true;
      case 'run': {
        el.disabled = true;
        el.textContent = 'AIが作成中…';
        await ctx.api(`/api/schedules/${sid}/run`, { method: 'POST', body: { date } });
        closeLayer();
        ctx.toast('実行しました。結果が届いています');
        await rerender();
        st.items = st.items.length ? st.items : [];
        return true;
      }
      case 'del':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'もう一度押すと削除（繰り返しの全回）'; return true; }
        await ctx.api(`/api/schedules/${sid}`, { method: 'DELETE' });
        closeLayer(); ctx.toast('予定を削除しました'); await rerender(); return true;
      case 'save': {
        await ctx.api(sid ? `/api/schedules/${sid}` : '/api/schedules', { method: sid ? 'PUT' : 'POST', body: readModal() });
        closeLayer(); ctx.toast(sid ? '予定を直しました' : '予定を登録しました'); await rerender(); return true;
      }
      default: return true;
    }
  } catch (err) {
    ctx.toast(err.message, true);
    if (cal === 'run') { el.disabled = false; el.textContent = '今すぐ頼む'; }
    return true;
  }
}

export function handleCalendarKey(e) {
  if (e.key === 'Escape' && document.getElementById('cal-layer')?.innerHTML) { closeLayer(); return true; }
  return false;
}
