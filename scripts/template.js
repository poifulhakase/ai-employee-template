// テンプレートの管理（管理者用）。画面からは行わない
//   npm run template -- show                       今の版と項目
//   npm run template -- release "<変更の理由>"        template/fixed.md などを直した後に版を上げる（全AI社員に反映）
//   npm run template -- export [出力先] [--with-agents]   持ち出し：テンプレートパック（1ファイル）に書き出す
//   npm run template -- import <パック.json>          持ち込み：テンプレートを置き換える（AI社員は agent add で）
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPack, bumpVersion, parsePack } from '../src/core/pack.js';
import { loadAgents, loadChangelog, loadTemplate, saveChangelog, saveTemplate } from '../src/store.js';

const args = process.argv.slice(2);
const cmd = args[0];
const fail = (msg) => { console.error(msg); process.exit(1); };
const template = loadTemplate();

switch (cmd) {
  case 'show':
    console.log(`${template.name} v${template.version}（更新 ${template.updatedAt}）`);
    console.log(`AI：${template.ai.model}・考える深さ ${template.ai.effort}`);
    console.log(`個別層の項目：${template.fields.map((f) => f.label + (f.required ? '*' : '')).join('・')}`);
    console.log(`固定層：${template.fixed.length}文字（template/fixed.md）`);
    break;
  case 'release': {
    const note = args.slice(1).join(' ').trim();
    if (!note) fail('変更の理由を書いてください（例：npm run template -- release "報告の型を直した"）');
    const version = bumpVersion(template.version);
    saveTemplate({ ...template, version, updatedAt: new Date().toISOString().slice(0, 10) });
    saveChangelog([{ version, at: new Date().toISOString(), note }, ...loadChangelog()]);
    console.log(`v${template.version} → v${version}。全AI社員に反映されます。変えた後は経験値の動きを見てください。`);
    break;
  }
  case 'export': {
    const withAgents = args.includes('--with-agents');
    const out = args.slice(1).find((a) => !a.startsWith('--'))
      ?? `ai-employee-template_v${template.version}${withAgents ? '_with-agents' : ''}.json`;
    writeFileSync(out, JSON.stringify(buildPack(template, withAgents ? loadAgents() : []), null, 2) + '\n', 'utf8');
    console.log(`書き出しました：${out}（依頼の記録は入っていません）`);
    break;
  }
  case 'import': {
    if (!args[1]) fail('パックのファイルを指定してください');
    let parsed;
    try { parsed = parsePack(readFileSync(args[1], 'utf8')); } catch (e) { fail(`読み込めませんでした：${e.message}`); }
    saveTemplate(parsed.template);
    saveChangelog([{ version: parsed.template.version, at: new Date().toISOString(), note: `パックから読み込み（前の版 v${template.version}）` }, ...loadChangelog()]);
    console.log(`v${parsed.template.version} を読み込みました。${parsed.agents.length ? `パック内のAI社員 ${parsed.agents.length}人は npm run agent -- add ${args[1]} で追加します。` : ''}`);
    break;
  }
  default:
    fail('使い方：npm run template -- show | release "<理由>" | export [出力先] [--with-agents] | import <パック>');
}
