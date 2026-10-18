import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, normalize, numbersOf, outcomeOf, similarity } from '../src/core/classify.js';

const TH = { same: 0.95, unused: 0.3 };

test('句読点・空白・改行・全角半角の違いだけなら、そのまま使われた', () => {
  const draft = 'お問い合わせありがとうございます。\n明日発送いたします。';
  const used = 'お問い合わせありがとうございます 明日発送いたします';
  assert.equal(classify(draft, used, TH).outcome, 'same');
  assert.equal(normalize('ＡＢＣ　１２３'), 'abc123');
});

test('数字が1つでも変われば、一致率が高くても直された', () => {
  const draft = '合計金額は1,000円です。お支払いは月末までにお願いいたします。ご不明点はお知らせください。';
  const used = '合計金額は10,000円です。お支払いは月末までにお願いいたします。ご不明点はお知らせください。';
  const r = classify(draft, used, TH);
  assert.ok(r.similarity >= 0.95);
  assert.equal(r.numbersChanged, true);
  assert.equal(r.outcome, 'edited');
});

test('カンマの有無は同じ数字として扱う', () => {
  assert.deepEqual(numbersOf('1,000円と2026年'), numbersOf('1000円と２０２６年'));
});

test('文を書き足したら直された', () => {
  const draft = '本日の定例会議の決定事項は、来週から新しい手順で進めることです。';
  const used = draft + '担当は営業部、期限は今月末とします。詳細は別途共有します。';
  assert.equal(classify(draft, used, TH).outcome, 'edited');
});

test('まったく別の文が使われたら、使われなかった', () => {
  assert.equal(classify('来週の会議は火曜日に行います。', 'ご連絡ありがとうございました。よろしくお願いします。', TH).outcome, 'unused');
});

test('長文は近似で比べても、同じ文なら一致率1', () => {
  const long = 'あいうえおかきくけこ'.repeat(500);
  assert.equal(similarity(long, long + '。'), 1);
  assert.ok(similarity(long, long.replace('か', 'が')) > 0.95);
});

test('区分が決まっていない依頼は、7日たったら使われなかった', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  assert.equal(outcomeOf({ createdAt: '2026-10-02T00:00:00Z' }, now, 7), 'unused');
  assert.equal(outcomeOf({ createdAt: '2026-10-05T00:00:00Z' }, now, 7), null);
  assert.equal(outcomeOf({ createdAt: '2026-10-01T00:00:00Z', outcome: 'same' }, now, 7), 'same');
});
