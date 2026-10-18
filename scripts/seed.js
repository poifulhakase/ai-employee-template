// サンプルのAI社員を入れる（npm run seed）。依頼の記録は件数と任せられる度を再現するための作り物
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, saveAgents, saveChangelog, saveSchedules, saveTasks } from '../src/store.js';
import { occurrenceTime, occurrencesBetween, ymd } from '../src/core/schedule.js';
import { PALETTES } from '../src/core/looks.js';

if (existsSync(join(DATA_DIR, 'agents.json')) && !process.argv.includes('--force')) {
  console.error('data/agents.json がすでにあります。上書きするなら npm run seed -- --force');
  process.exit(1);
}

const ALL_SAMPLES = [
  { acc: 'headset', palette: 0, count: 180, trust: 68, today: 14, done: 2, todayTotal: 5, task: 'A社向け提案書の構成案を作成',
    fields: { name: '営業サポート', dept: '営業部', role: '商談メモの要約と提案書の下書き', duties: '- 商談メモを要約する\n- 提案書の構成案と下書きを作る', notDuties: '- 見積金額は決めない（営業担当が決める）', entry: '営業部の部屋・ポータル', tools: '社内の提案書テンプレート', materials: '過去の提案書・商品資料', outputFormat: '提案書：課題／解決策／導入の流れ／費用の考え方', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '変わる' } },
  { acc: 'glasses', palette: 1, count: 80, trust: 78, today: 6, done: 4, todayTotal: 6, task: '定例会議の議事録を整理中',
    fields: { name: '議事録係', dept: '全社', role: '会議録音から議事録と決定事項を整理', duties: '- 文字起こしから議事録を作る\n- 決定事項と担当・期限を抜き出す', notDuties: '- 会議の日程調整はしない（採用アシスタントの担当）', entry: '全社の部屋・ポータル', tools: '文字起こし', materials: '過去の議事録・社内用語集', outputFormat: '日時・参加者・議題・決定事項・宿題', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '固い' } },
  { acc: 'sprout', palette: 2, count: 20, trust: 55, today: 3, done: 1, todayTotal: 3, task: '今週の日報を集計して下書き',
    fields: { name: '週報まとめ', dept: '開発部', role: '各メンバーの日報を集めて週報の下書き', duties: '- 日報を集めて週報の下書きを作る', notDuties: '- 個人の評価は書かない', entry: '開発部の部屋', tools: '日報の読み取り', materials: '今週の日報', outputFormat: '今週やったこと／来週やること／困っていること', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '固い' } },
  { acc: 'cap', palette: 3, count: 420, trust: 91, today: 21, done: 21, todayTotal: 21, task: '9月分の経費申請 21件を照合完了！',
    fields: { name: '経費チェック', dept: '経理部', role: '経費申請の記入漏れと規程との照合', duties: '- 経費申請の記入漏れを見つける\n- 経費規程と照らして外れているものを挙げる', notDuties: '- 承認・差し戻しの操作はしない（経理担当がする）', entry: '経理部の部屋', tools: '経費申請の読み取り', materials: '経費規程', outputFormat: '申請番号ごとに：問題なし／要確認（理由と規程の条番号）', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '固い' } },
  { acc: 'bow', palette: 4, count: 3, trust: 5, today: 0, done: 0, todayTotal: 0, task: null,
    fields: { name: '採用アシスタント', dept: '人事部', role: '応募書類の整理と面接日程の調整案', duties: '- 応募書類を整理する\n- 面接日程の調整案を作る', notDuties: '- 合否は判断しない', entry: '人事部の部屋', tools: '社内カレンダーの読み取り', materials: '募集要項', outputFormat: '応募者ごとの要点（経歴・希望条件）', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '変わる' } },
  { acc: 'glasses', palette: 5, count: 45, trust: 40, today: 4, done: 3, todayTotal: 4, task: '業務委託契約の確認ポイントを列挙',
    fields: { name: '契約書レビュー補助', dept: '法務部', role: '契約書の条項を整理し確認ポイントを列挙', duties: '- 契約書の条項を整理する\n- 確認したほうがよい点を挙げる', notDuties: '- 法的な結論は出さない（法務担当が判断する）', entry: '法務部の部屋', tools: '', materials: '過去の契約書・社内の契約ガイド', outputFormat: '条項ごとに：内容の要約／確認ポイント', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '変わる' } },
  { acc: 'headset', palette: 6, count: 1250, trust: 22, today: 32, done: 24, todayTotal: 32, task: '返信案 32件を作成、確認待ち 8件',
    fields: { name: 'お客様対応ドラフト', dept: 'CS部', role: '問い合わせへの返信案を作成', duties: '- 問い合わせへの返信案を作る', notDuties: '- 返金・交換の可否は決めない\n- 送信はしない', entry: 'CS部の部屋', tools: '注文情報の読み取り', materials: '過去の返信・よくある質問', outputFormat: 'お客様にそのまま送れる返信文', exit: 'カレンダーの「受け取る」ボタン', ruleFirmness: '変わる' } },
  { acc: 'halo', palette: 7, count: 640, trust: 12, today: 18, done: 18, todayTotal: 18, task: '今日の質問 18件に回答済み！',
    fields: { name: '社内Q&A', dept: '総務部', role: '規程・制度・社内用語の質問に回答', duties: '- 規程・制度・社内用語の質問に答える', notDuties: '- 規程にないことは答えを作らない', entry: '全社の質問部屋', tools: '', materials: '就業規則・社内規程・社内用語集', outputFormat: '答え＋根拠（規程名と条番号）', exit: '回答そのもの（聞き直し・「違う」で数える）', ruleFirmness: '固い' } },
];

// 一覧が1画面に収まるよう4人にする（違いが分かる組み合わせ）
const SAMPLES = ALL_SAMPLES.filter((x) => ['営業サポート', '経費チェック', 'お客様対応ドラフト', '採用アシスタント'].includes(x.fields.name));

const DAY = 86_400_000;
const now = Date.now();
const iso = (t) => new Date(t).toISOString();
const startOfToday = new Date(new Date().setHours(9, 0, 0, 0)).getTime();

const agents = [];
const tasks = [];
for (const s of SAMPLES) {
  const id = randomUUID();
  agents.push({ id, createdAt: iso(now - 200 * DAY), fields: s.fields, look: { palette: s.palette % PALETTES.length, acc: s.acc }, sample: true });

  // 今日の依頼：done 件は案ができている（うち区分付きは半分）、残りは作業中
  for (let i = 0; i < s.todayTotal; i++) {
    const t = Math.min(startOfToday + i * 60_000, now - (s.todayTotal - i) * 1_000); // 古い順に並べ、最後の依頼が「いま」になる
    const hasDraft = i < s.done;
    tasks.push({ id: randomUUID(), agentId: id, createdAt: iso(t), sample: true, request: i === s.todayTotal - 1 && s.task ? s.task : `（サンプル）今日の依頼 ${i + 1}`, draft: hasDraft ? '（サンプルの案）' : null, outcome: null });
  }

  // これまでの依頼：経験値（累計）どおりに「そのまま使われた」を混ぜる
  const rest = s.count - s.todayTotal;
  const same = Math.round((rest * s.trust) / 100);
  for (let i = 0; i < rest; i++) {
    const outcome = i < same ? 'same' : i % 2 ? 'edited' : 'unused';
    tasks.push({ id: randomUUID(), agentId: id, createdAt: iso(now - (8 + (i % 180)) * DAY), sample: true, request: '（サンプル）', draft: '（サンプルの案）', outcome });
  }
}


// カレンダーの予定。過去の回には結果（区分）を付け、今日より後は「予定」のまま
const idOf = (name) => agents.find((a) => a.fields.name === name).id;
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
const SCHEDULES = [
  { agent: 'お客様対応ドラフト', title: '未返信の問い合わせの返信案', time: '09:30', repeat: 'weekdays', request: '昨日の営業時間外に届いた未返信の問い合わせに、返信案を作ってください。' },
  { agent: '営業サポート', title: '週次の商談メモ要約', time: '18:00', repeat: 'weekly', weekday: 1, request: '今週の商談メモを要約し、来週の提案につながる点を挙げてください。' },
  { agent: '経費チェック', title: '月末の経費申請の照合', time: '10:00', repeat: 'monthly', day: 25, request: '今月分の経費申請を経費規程と照合し、記入漏れと規程から外れているものを挙げてください。' },
  { agent: '採用アシスタント', title: '面接日程の調整案', time: '14:00', repeat: 'none', offsetDays: 6, request: '来週の一次面接（3名）の日程の調整案を作ってください。' },
];
const schedules = SCHEDULES.map((x) => {
  let date;
  if (x.repeat === 'weekly') { const d = new Date(monthStart); while (d.getDay() !== x.weekday) d.setDate(d.getDate() + 1); date = ymd(d); }
  else if (x.repeat === 'monthly') date = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth(), x.day));
  else if (x.offsetDays != null) date = ymd(new Date(now + x.offsetDays * DAY));
  else date = ymd(monthStart);
  return { id: randomUUID(), createdAt: iso(monthStart.getTime() - DAY), agentId: idOf(x.agent), title: x.title, request: x.request, date, time: x.time, repeat: x.repeat, until: null, runs: [], sample: true };
});
const OUTCOMES = ['same', 'edited', 'same', 'unused', 'same', 'edited'];
for (const sc of schedules) {
  const past = occurrencesBetween(sc, sc.date, ymd(new Date(now))).filter((d) => occurrenceTime(sc, d).getTime() <= now);
  past.forEach((d, i) => {
    const latest = i === past.length - 1;
    const t = { id: randomUUID(), agentId: sc.agentId, createdAt: iso(occurrenceTime(sc, d).getTime()), sample: true, request: sc.request, draft: '（サンプルの案）', scheduleId: sc.id, scheduleDate: d, outcome: latest ? null : OUTCOMES[i % OUTCOMES.length] };
    tasks.push(t);
    sc.runs.push({ date: d, taskId: t.id, at: t.createdAt });
  });
}
saveSchedules(schedules);
saveAgents(agents);
saveTasks(tasks);
saveChangelog([{ version: '1.0', at: iso(now), note: '初版' }]);
console.log(`サンプルを入れました：AI社員 ${agents.length}人・依頼 ${tasks.length}件・予定 ${schedules.length}件 → ${DATA_DIR}`);
