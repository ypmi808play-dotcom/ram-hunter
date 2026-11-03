# RAM HUNTER — For the Greater Compute

[![Deploy to GitHub Pages](https://github.com/<YOUR_GITHUB_USERNAME>/ram-hunter/actions/workflows/deploy.yml/badge.svg)](https://github.com/<YOUR_GITHUB_USERNAME>/ram-hunter/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Phaser](https://img.shields.io/badge/Phaser-3.90-green.svg)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-7.3-purple.svg)](https://vitejs.dev/)

> **「すべてのRAMは、データセンターのために。」**  
> サム・アルトマンを風刺的にデフォルメした主人公「Sam」が、街の住宅からPCのRAMを回収し、途方もないAIデータセンター帝国を建設する2D横スクロール・ステルス＆アクションゲーム。

---

## 🌐 オンラインプレイ（GitHub Pages）

ブラウザから直接プレイできます（PCブラウザ推奨）：  
👉 **[RAM HUNTER をプレイする](https://<YOUR_GITHUB_USERNAME>.github.io/ram-hunter/)**  
*(※ `<YOUR_GITHUB_USERNAME>` をご自身のGitHubアカウント名に置き換えてください)*

---

## ⚠️ 免責事項・フィクション表記

本作は、実在の人物（サム・アルトマン氏等）、企業、技術動向を題材にした**パロディおよび風刺を目的とした架空のフィクション作品**です。  
作中に登場するキャラクター、団体名、設定、台詞、行動、描写はすべてフィクションであり、実在の人物・団体の思想・信条・行為を反映したもの、あるいは現実世界における不法侵入や窃盗などの不法行為を推奨・助長するものではありません。

---

## 📸 スクリーンショット

<!-- スクリーンショット画像（1280x720推奨）を docs/images/ や assets/ に配置してリンクしてください -->

| タイトル画面 | 室内ステルス探索 |
| :---: | :---: |
| ![タイトル画面プレビュー](https://via.placeholder.com/600x340/101b1c/d4ffac?text=RAM+HUNTER+Title+Screen) | ![室内ステルスプレビュー](https://via.placeholder.com/600x340/101b1c/efb57c?text=Stealth+%26+Detection+Gauge) |
| *「FOR THE GREATER COMPUTE」タイトル* | *発見ゲージ（0〜100）としゃがみ隠蔽* |

| 室内戦闘・警備ロボット戦 | リザルト：AIデータセンター帝国建設 |
| :---: | :---: |
| ![室内戦闘プレビュー](https://via.placeholder.com/600x340/101b1c/f27d66?text=Indoor+Combat+%26+EMP+Pulse) | ![リザルト画面プレビュー](https://via.placeholder.com/600x340/101b1c/b8f7af?text=AI+Data+Center+Empire) |
| *予備動作（0.5〜0.7s）を見極めて迎撃* | *回収したRAM量に応じて施設が巨大化* |

---

## 🎮 操作方法

PCキーボードでの操作に対応しています。

| キー入力 | アクション | 効果・詳細 |
| :--- | :--- | :--- |
| `← / →` または `A / D` | **移動** | 通常歩行（足音：小） |
| `Left Shift` | **ダッシュ** | 高速移動（足音：大・敵の聴覚を強く刺激） |
| `Left Ctrl` | **しゃがみ移動** | **移動速度55%・足音最小・視認距離62%短縮**（ダッシュ不可） |
| `Space` / `↑` / `W` | **ジャンプ** | 足場の飛び移り・障害物跳躍（しゃがみ解除） |
| `E`（長押し） | **相互作用 / 回収** | PCからRAM回収 / 撤退バンで途中撤退 / セキュリティ端末解除 / 屋根裏ハッチ移動 |
| `Z` | **チップ投げ** | 基本遠隔攻撃（無料 / 10ダメージ / 連射可） |
| `X` | **ハルシネーション** | 混乱付与（8GB消費 / 3秒間逆走） |
| `C` | **巨額投資** | 札束ルアー投擲（無料 / 最大4秒間陽動） |
| `Q` | **AGI覚醒** | 広範囲スタン（32GB消費 / 5秒間完全停止） |
| `Esc` | **ポーズ** | 一時停止メニューを開く |
| `F2` | **デバッグ表示** | 敵の視野コーン・発見ゲージ・物音範囲を画面に表示 |

---

## 🌟 主なゲームシステム

### 1. ステルス・物音・段階的発見ゲージ（0〜100）
- **視覚認識プロファイル**: 一般市民（110°/210px）、民間警備員（125°/270px）、エリート警備員（135°/330px）、警備ロボット（140°/300px）、監視カメラ（90°/370px）など敵種別に異なる視野角と視認速度を設定。
- **段階的発見ゲージ**:
  - `0`: 未認知
  - `1〜39`: 不審（頭上 `?` / 音源や不審地点を捜索）
  - `40〜99`: 警戒・確認中（頭上 `?` / 接近確認）
  - `100`: 発見確定（頭上 `!` / 発見SE / 追跡・攻撃移行）
- **正面と背後**: 正面の至近距離では約1秒以内に発見されますが、背後からは発見されません。
- **しゃがみ移動と遮蔽物**: しゃがみ中は視認距離・発見速度が低減されますが、**遮蔽物のない正面至近距離（58px以内）ではしゃがんでも発見されます**。ソファ・棚・パーティション等の陰に隠れて視線を遮断できます。
- **RAM回収リスク**: `E` 長押しでのRAM抽出中は周期的作業音が発生し、視認時の発見速度が **1.35倍** に上昇します。

### 2. 室内敵バリエーションと明確な予備動作
すべての特殊攻撃には **0.5〜0.7秒の予備動作（警告テキスト・発光リング・SE）** があり、見てからの回避やスタンが可能です。

- **一般市民** (`resident` / `engineer`): HP 20。定期的な振り返り、接触攻撃。
- **警戒住民** (`alertResident`): HP 40。鋭い聴覚、発見時に **通報 (`⚠ CALLING HELP!`)** で同室内の近隣NPCを警戒移行。
- **民間警備員** (`privateGuard`): HP 70。室内巡回＋**警棒スイング突進 (`⚠ BATON SWING!`)**。
- **エリート警備員** (`eliteGuard`): HP 120。**正面ガード（正面被ダメージ50%軽減・背面弱点）**＋**高速ダッシュ斬り (`⚠ DASH STRIKE!`)**。
- **警備ロボット** (`securityRobot`): HP 90。電撃弾射撃＋**EMPパルス (`⚠ EMP CHARGING!`)**（3秒間特殊アビリティ封印）＋**8〜32GB RAM確定ドロップ**。
- **室内戦闘ドローン** (`combatDrone`): HP 65。空中移動＋距離維持＋**3連バースト射撃 (`⚠ BURST FIRE!`)**＋**16〜32GB RAM確定ドロップ**。

### 3. 14軒の5段階住宅難易度
- 住宅1〜3 (`EASY`: 4〜16GB) から住宅14 (`EXTREME`: 128〜512GB) まで危険度と報酬がスケーリング。
- 後半住宅にはスイープ式監視カメラを配置（室内の端末 `[E]` で解除可能）。
- 全住宅で遮蔽物・上段足場を使ったステルス攻略ルート（`hasStealthRoute`）を保証。

### 4. 住宅特殊イベントと途中撤退（RISK MODE）
- **住宅特殊イベント**: `SLEEPING HOUSE`（睡眠中の住民）、`ALARM PC`（警報付き高容量PC）、`ATTIC ROUTE`（屋根裏隠し部屋）、`RAM JACKPOT`（1.5〜2倍容量PC）、`EMPTY HOUSE`（無人住宅）がランダム発生。
- **途中撤退（EXTRACT RAM?）**: 街の撤退バンで `E` 長押しすると、未消費RAMを100%安全に持ち帰ってゲームを完了可能。
- **RISK MODE**: 有効時、ライフ0で未消費RAMの20%、時間切れで10%を喪失。

---

## 🛠 ローカル起動・開発手順

### 前提条件
- **Node.js**: `v22.12.0` 以上推奨（Active LTS）
- **npm**: `v10` 以上

### コマンド
```bash
# 1. リポジトリのクローン
git clone https://github.com/<YOUR_GITHUB_USERNAME>/ram-hunter.git
cd ram-hunter

# 2. 依存関係のクリーンインストール
npm ci

# 3. 開発サーバーの起動 (Vite)
npm run dev

# 4. 単体・結合テストの実行 (全79テスト)
npm test

# 5. プロダクションビルド（dist/ 生成 + 単一HTML版 dist/RAM-HUNTER.html 生成）
npm run build

# 6. ビルド成果物のローカルプレビュー
npm run preview
```

---

## 🚀 GitHub Pages への公開手順

本リポジトリには GitHub Actions 用ワークフロー（`.github/workflows/deploy.yml`）が含まれており、`main` ブランチへのプッシュで自動的にテスト・ビルド・デプロイが実行されます。

1. **GitHub で新しいリポジトリを作成**:
   - リポジトリ名: `ram-hunter`
   - Public リポジトリとして作成（README等の自動初期化チェックは外してください）。
2. **ローカルからプッシュ**:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/ram-hunter.git
   git branch -M main
   git push -u origin main
   ```
3. **GitHub Pages の設定を有効化**:
   - GitHubリポジトリ画面の **Settings** タブをクリック。
   - 左サイドバーの **Pages** を選択。
   - **Build and deployment** の **Source** で **「GitHub Actions」** を選択。
4. **公開完了**:
   - プッシュ時に Actions ワークフローが起動し、自動テスト（79件パス）とビルドを経てデプロイされます。
   - 数分後、`https://<YOUR_GITHUB_USERNAME>.github.io/ram-hunter/` でゲームが公開されます。

---

## 📄 権利関係・ライセンスについて

- **コードおよびオリジナルアセットの著作権**:  
  本プロジェクトに含まれるソースコード、グラフィック、サウンド、設定等の権利関係は、現在プロジェクト所有者による確認・承認手続き中です。
- **ライセンスの適用**:  
  プロジェクト所有者の明示的な承諾なく、特定のオープンソースライセンス（MIT / Apache / GPL等）を独断で決定・適用することは行っておりません。ライセンスが確定するまでは、無断での商用利用・再配布はお控えください。
