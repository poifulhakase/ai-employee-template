// AI社員の管理（管理者用）。画面からは行わない
//   npm run agent -- list                          一覧（名前・部門・レベルに使う件数）
//   npm run agent -- add <設定ファイル.json>          追加（1人分・配列・テンプレートパックのどれでも）
//   npm run agent -- update <設定ファイル.json>       同じ名前のAI社員の個別層を置き換える
//   npm run agent -- remove <名前>                  削除（そのAI社員の予定も消す。依頼の記録は残す）
import { readFileSync } from 'node:fs';
import { addAgents } from '../src/core/agents.js';
import { PACK_FORMAT } from '../src/core/pack.js';
import { missingFields } from '../src/core/prompt.js';
import { loadAgents, loadSchedules, loadTasks, loadTemplate, saveAgents, saveSchedules } from '../src/store.js';

const [cmd, arg] = process.argv.slice(2);
const fail = (msg) => { console.error(msg); process.exit(1); };

function readAgents(file) {
  if (!file) fail('設定ファイルを指定してください（例：scripts/agent.example.json）');
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`読めませんでした：${file}（${e.message}）`); }
  return json?.format === PACK_FORMAT ? json.agents ?? [] : Array.isArray(json) ? json : [json];
}

const template = loadTemplate();

switch (cmd) {
  case 'list': {
    const counts = new Map();
    for (const t of loadTasks()) counts.set(t.agentId, (counts.get(t.agentId) ?? 0) + 1);
    const agents = loadAgents();
    for (const a of agents) console.log(`${a.fields.name}\t${a.fields.dept}\t依頼${counts.get(a.id) ?? 0}件`);
    console.log(`${agents.length}人（${template.name} v${template.version}）`);
    break;
  }
  case 'add': {
    const { agents, added, skipped } = addAgents(template, loadAgents(), readAgents(arg));
    if (added.length) saveAgents(agents);
    for (const a of added) console.log(`追加：${a.fields.name}（${a.fields.dept}）`);
    for (const s of skipped) console.log(`追加しなかった：${s}`);
    if (!added.length) fail('追加したAI社員はいません。');
    console.log(`${added.length}人を追加しました。画面を再読み込みすると出ます。`);
    break;
  }
  case 'update': {
    const agents = loadAgents();
    let n = 0;
    for (const x of readAgents(arg)) {
      const a = agents.find((v) => v.fields?.name === x.fields?.name);
      if (!a) { console.log(`見つからない：${x.fields?.name}（追加は add で）`); continue; }
      const missing = missingFields(template, x.fields);
      if (missing.length) { console.log(`直さなかった：${a.fields.name}（未入力：${missing.join('・')}）`); continue; }
      Object.assign(a, { fields: x.fields, updatedAt: new Date().toISOString() }, x.look ? { look: x.look } : {});
      console.log(`直した：${a.fields.name}`);
      n += 1;
    }
    if (!n) fail('直したAI社員はいません。');
    saveAgents(agents);
    break;
  }
  case 'remove': {
    const agents = loadAgents();
    const a = agents.find((v) => v.fields?.name === arg);
    if (!a) fail(`いません：${arg ?? '（名前なし）'}`);
    saveAgents(agents.filter((v) => v.id !== a.id));
    const schedules = loadSchedules();
    const rest = schedules.filter((s) => s.agentId !== a.id);
    saveSchedules(rest);
    console.log(`削除：${a.fields.name}（予定 ${schedules.length - rest.length}件も削除。依頼の記録は残しています）`);
    break;
  }
  default:
    fail('使い方：npm run agent -- list | add <ファイル> | update <ファイル> | remove <名前>');
}
