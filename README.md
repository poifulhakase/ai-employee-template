# AI社員テンプレート ＋ AI社員ポータル

新しい会社で使う「AI社員」のデフォルトテンプレートと、それを複製・管理するローカルのWebアプリ。
**最終的な目的は、このテンプレートを外へ持ち運べるようにすること。**

## 動かし方

```bash
npm install
npm run seed      # サンプルのAI社員4人を入れる（初回だけ。上書きは npm run seed -- --force）
npm start         # http://localhost:4100
npm test          # 区分・任せられる度・レベルの計算のテスト
```

- Node.js 20.12 以上。依存は `@anthropic-ai/sdk` だけ。
- AIにつなぐときは、`.env.example` を `.env` にコピーして `ANTHROPIC_API_KEY=` に鍵を書く。
  入れていないと、テスト用の下書きを返す（画面の流れは確かめられる）。
- ポートを変えるときは `.env` の `PORT=` を書き換える（Windows でもそのまま効く）。

## 会社のPCで立ち上げる

```bash
git clone https://github.com/poifulhakase/ai-employee-template.git
cd ai-employee-template
npm install
npm run seed      # サンプルが要らなければ飛ばして npm run agent -- add で入れる
copy .env.example .env   # Mac は cp .env.example .env → 鍵を書く
npm start
```

- 先に Node.js（https://nodejs.org の LTS）と Git を入れておく。
- 鍵は会社のものを使う（個人の鍵を持ち込まない）。`.env` と `data/` は git に入らない。
- 持ってきたテンプレートを使うときは、`npm run template -- import <パック.json>`。

## 画面（使う人向け）

| メニュー | できること |
|---|---|
| AI社員一覧 | カード一覧と絞り込み。レベルと経験値は依頼の記録から毎回計算。❔に用語の説明 |
| カレンダー | 運用カレンダー（時計・案が届いています・レイヤー＝AI社員・月／週・祝日）。日付や時間帯を押してAI社員の予定を登録。時刻が来るとAIが実行し、結果を「受け取る」か「使わない」を人が決める（区分は自動）。止まっていた間の回は、起動時に一番新しい1回だけ |
| 稼働ログ | 依頼ごとの区分・一致率・その時の固定層の版 |

## 管理（システム側・コマンドで行う）

AI社員の追加・変更・削除と、テンプレートの管理は画面からは行わない。

```bash
npm run agent -- list                          # AI社員の一覧
npm run agent -- add scripts/agent.example.json  # 追加（1人分・配列・テンプレートパックのどれでも）
npm run agent -- update <設定ファイル.json>       # 同じ名前のAI社員の個別層を置き換える
npm run agent -- remove <名前>                  # 削除（予定も消す。依頼の記録は残す）

npm run template -- show                       # 今の版と項目
npm run template -- release "<変更の理由>"       # template/fixed.md 等を直した後に版を上げる（全AI社員に反映）
npm run template -- export [出力先] [--with-agents]  # 持ち出し：テンプレートパック（1ファイル）
npm run template -- import <パック.json>         # 持ち込み：テンプレートを置き換える
```

## 持ち運ぶもの・持ち運ばないもの

| 置き場所 | 中身 | 持ち運ぶか |
|---|---|---|
| `template/template.json` | 版・AIの設定・区分のしきい値・レベルの条件・個別層の項目 | **持ち運ぶ** |
| `template/fixed.md` | 固定層（全AI社員に共通の指示文） | **持ち運ぶ** |
| `data/` | AI社員・依頼の記録・予定・版の履歴 | 持ち運ばない（会社ごと・git にも入れない） |

別のPCでは、このアプリを置いて `npm run template -- import <パック>` → `npm run agent -- add <パック>` で同じ状態になる（依頼の記録は入らない）。

## ファイル

| ファイル | 中身 |
|---|---|
| [docs/default_template.md](docs/default_template.md) | テンプレートの考え方（固定層・個別層・任せられる度とレベル） |
| [docs/decisions.md](docs/decisions.md) | 決めたことと理由 |
| `server.js` | ローカルサーバーとAPI（使う人の操作だけ。管理は scripts/） |
| `scripts/` | 管理のコマンド（agent.js・template.js）とサンプル（seed.js） |
| `src/core/` | AI社員の追加（agents）・区分（classify）・経験値とレベル（stats）・指示文（prompt）・パック（pack）・予定の繰り返し（schedule） |
| `src/ai.js` | Claude の呼び出し（モデルと深さは template.json の ai） |
| `public/` | 画面 |
| `design/ai-portal-list-desktop/` | 元の画面イメージ（`python -m http.server` で開く） |
