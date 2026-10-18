import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPack, bumpVersion, parsePack } from '../src/core/pack.js';
import { buildSystemPrompt, missingFields } from '../src/core/prompt.js';

const TEMPLATE = {
  name: 'デフォルトテンプレート', version: '1.0', fixed: '共通の原則',
  fields: [{ key: 'name', label: '名前', required: true }, { key: 'duties', label: '担当する仕事', required: true }, { key: 'notDuties', label: '担当しない仕事' }],
  levels: [], classify: { same: 0.95, unused: 0.3, unusedDays: 7, trustWindowDays: 30 },
};

test('パックはテンプレートとAI社員の設定だけを持ち、依頼の記録は持たない', () => {
  const agents = [{ id: 'a', fields: { name: '議事録係', duties: '議事録' }, look: { palette: 1 }, secret: '依頼の中身' }];
  const pack = buildPack(TEMPLATE, agents);
  assert.equal(pack.format, 'ai-employee-template-pack');
  assert.deepEqual(Object.keys(pack.agents[0]).sort(), ['fields', 'id', 'look']);
  const back = parsePack(JSON.stringify(pack));
  assert.equal(back.template.fixed, '共通の原則');
  assert.equal(back.agents.length, 1);
});

test('壊れたパックは理由をまとめて返す', () => {
  assert.throws(() => parsePack({ format: 'x' }), /形式が違います.*固定層が空です/);
  assert.throws(() => parsePack({ ...buildPack(TEMPLATE), packVersion: 99 }), /新しい版のパック/);
});

test('版の番号を1つ上げる', () => {
  assert.equal(bumpVersion('1.0'), '1.1');
  assert.equal(bumpVersion('1.9'), '1.10');
  assert.equal(bumpVersion('2'), '2.1');
});

test('指示文は固定層＋個別層。空の項目は入れない', () => {
  const p = buildSystemPrompt(TEMPLATE, { fields: { name: '議事録係', duties: '議事録を作る', notDuties: '' } });
  assert.ok(p.startsWith('共通の原則'));
  assert.match(p, /### 担当する仕事\n議事録を作る/);
  assert.doesNotMatch(p, /担当しない仕事/);
  assert.deepEqual(missingFields(TEMPLATE, { name: '議事録係' }), ['担当する仕事']);
});
