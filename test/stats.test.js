import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentStats, levelOf, nextLevelGap } from '../src/core/stats.js';

const LEVELS = [
  { level: 2, minCount: 30, minTrust: 40 },
  { level: 3, minCount: 100, minTrust: 60 },
  { level: 4, minCount: 300, minTrust: 75 },
  { level: 5, minCount: 1000, minTrust: 90 },
];
const TEMPLATE = { levels: LEVELS, classify: { trustWindowDays: 30, unusedDays: 7 } };

test('件数と経験値の両方を満たした段になる', () => {
  assert.equal(levelOf(1250, 22, LEVELS), 1); // 件数は多いが直されてばかり
  assert.equal(levelOf(20, 100, LEVELS), 1); // 全部うまくいったが件数が少ない
  assert.equal(levelOf(180, 68, LEVELS), 3);
  assert.equal(levelOf(420, 91, LEVELS), 4); // 経験値は5の条件を満たすが件数が足りない
  assert.equal(levelOf(1000, 90, LEVELS), 5);
});

test('次のレベルに足りないものを返す', () => {
  assert.deepEqual(nextLevelGap(80, 78, LEVELS), { level: 3, lack: ['件数あと20件'] });
  assert.deepEqual(nextLevelGap(1250, 22, LEVELS), { level: 2, lack: ['経験値40%以上'] });
  assert.equal(nextLevelGap(1000, 95, LEVELS), null);
});

test('日数を決めたときは、その期間の区分が決まった件数で割る。区分待ちは分母に入れない', () => {
  const now = Date.parse('2026-10-01T12:00:00');
  const day = (n) => new Date(now - n * 86_400_000).toISOString();
  const tasks = [
    { createdAt: day(1), outcome: 'same', draft: 'x' },
    { createdAt: day(2), outcome: 'same', draft: 'x' },
    { createdAt: day(3), outcome: 'edited', draft: 'x' },
    { createdAt: day(10), draft: 'x' }, // 7日過ぎて未使用 → 使われなかった
    { createdAt: day(2), draft: 'x' }, // まだ待ち → 分母に入れない
    { createdAt: day(40), outcome: 'unused', draft: 'x' }, // 30日より前 → 入れない
  ];
  const s = agentStats(tasks, TEMPLATE, now);
  assert.equal(s.decided, 4);
  assert.equal(s.trust, 50);
  assert.equal(s.count, 6);
});

test('今日の依頼があれば作業中', () => {
  const now = Date.parse('2026-10-01T12:00:00');
  const s = agentStats([{ createdAt: new Date(now - 3600_000).toISOString(), draft: 'x' }], TEMPLATE, now);
  assert.equal(s.active, true);
  assert.equal(s.todayTotal, 1);
  assert.equal(agentStats([], TEMPLATE, now).active, false);
});

test('日数を決めないとき（初期値）は累計で数える', () => {
  const now = Date.parse('2026-10-01T12:00:00');
  const day = (n) => new Date(now - n * 86_400_000).toISOString();
  const tasks = [
    { createdAt: day(1), outcome: 'same', draft: 'x' },
    { createdAt: day(400), outcome: 'same', draft: 'x' }, // 1年以上前も数える
    { createdAt: day(200), outcome: 'edited', draft: 'x' },
    { createdAt: day(100), outcome: 'unused', draft: 'x' },
  ];
  const s = agentStats(tasks, { levels: LEVELS, classify: { trustWindowDays: null, unusedDays: 7 } }, now);
  assert.equal(s.decided, 4);
  assert.equal(s.trust, 50);
});
