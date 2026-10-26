# Menkai — 面会予約管理システム

## 1. プロジェクト概要

Menkai は、施設の面会予約を管理する Web アプリケーションです。ASP.NET Core と SQLite を使用し、ブラウザーから面会予約の登録・取得・更新を行います。

本書は、開発者が以下の作業を行うための技術資料です。

- 不具合の調査・修正
- 画面レイアウトやデザインの変更
- 予約管理機能の追加・変更
- SQLite データベースの調査
- IIS への再配置
- GitHub を利用したソースコードの管理

## 2. 技術構成

| 項目 | 内容 |
|---|---|
| アプリケーション | MenkaiApp |
| フレームワーク | ASP.NET Core / .NET 10 |
| 言語 | C# |
| Web サーバー | IIS |
| データベース | SQLite |
| データアクセス | Microsoft.Data.Sqlite 10.0.14 |
| ソース管理 | Git / GitHub |
| 公開先 | Windows Server 2019 |
| Web サイト名 | Menkai |
| IIS アプリケーションプール | MenkaiPool |
| ポート | TCP 8085 |

## 3. 開発環境と配置先

### 開発用 PC

ソースコードの開発ディレクトリ：

`C:\Users\sr01\Desktop\MACRO\C\Menkai\MenkaiApp`

GitHub リポジトリ：

https://github.com/peguevra/Menkai

### サーバー

| 用途 | パス |
|---|---|
| ソースコード | `C:\Apps\Menkai\source` |
| 公開用ファイル | `C:\Apps\Menkai\publish` |
| SQLite データ | `C:\Apps\Menkai\data\visits.db` |

**重要：ソースコード、公開用ファイル、運用データは別々に管理する。**

`publish` フォルダーはビルドによって更新されます。予約データは `data` フォルダーに保存し、ソースコードの更新や公開用ファイルの再生成によって消失しない構成とします。

運用中の SQLite データベースを Git に登録したり、開発用 PC のデータベースで上書きしたりしないでください。

## 4. アプリケーションの構造

プロジェクトの主な構成要素は次のとおりです。

- `Program.cs`
  - ASP.NET Core アプリケーションの起動
  - SQLite の接続設定
  - データベースとテーブルの初期化
  - API エンドポイントの定義
  - 静的ファイルの配信設定
- `MenkaiApp.csproj`
  - .NET のターゲットフレームワークや NuGet パッケージの設定
- `appsettings.json`
  - アプリケーション設定
- `wwwroot/`
  - HTML、CSS、JavaScript、画像などの静的ファイル

実際のファイル名やディレクトリ構成は、作業開始時にソースコードを確認してください。本書に記載のないファイルが存在する場合は、既存の設計を優先します。

## 5. データベース

### 保存先

`C:\Apps\Menkai\data\visits.db`

サーバー上では、`Program.cs` でデータ保存先を指定しています。

```csharp
var dataDirectory = Path.Combine(
    @"C:\Apps\Menkai", "data");

Directory.CreateDirectory(dataDirectory);

var dbPath = Path.Combine(
    dataDirectory, "visits.db");
```

この絶対パスを変更すると、別のデータベースが新規作成され、既存予約が表示されなくなる可能性があります。保存先を変更する場合は、データ移行も含めて検討してください。

### Reservations テーブル

現在の初期化処理では、次のテーブルを使用しています。

| 列 | 型 | 内容 |
|---|---|---|
| `Id` | INTEGER | 主キー、自動採番 |
| `VisitDate` | TEXT | 面会日 |
| `VisitTime` | TEXT | 面会時刻 |
| `ResidentName` | TEXT | 入所者名 |
| `BookerName` | TEXT | 予約者名 |
| `VisitorCount` | INTEGER | 面会人数 |
| `Facility` | TEXT | 施設名 |
| `Detail` | TEXT | 詳細、既定値は空文字 |
| `IsDone` | INTEGER | 対応済み状態、既定値は 0 |
| `CreatedAt` | TEXT | 作成日時、既定値は `CURRENT_TIMESTAMP` |

テーブルは `CREATE TABLE IF NOT EXISTS` で初期化されます。この処理は既存テーブルを自動的に新しい構造へ変更するものではありません。

列の追加や型の変更を行う場合は、既存データとの互換性、移行処理、バックアップを検討してください。

### 施設名

現在のコードで定義されている施設名：

- 信愛苑
- わかば
- clinicSHIRO

施設名を変更する場合は、画面の選択肢、API の入力検証、既存予約の表示や集計への影響を確認してください。

## 6. API と静的ファイル

`Program.cs` では、予約管理用の API と静的ファイル配信を設定しています。

確認できている API のメソッドは以下のとおりです。

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/reservations` | 予約情報の取得 |
| POST | `/api/reservations` | 予約の登録 |
| PUT | `/api/reservations` | 予約の更新 |

正確なリクエスト形式、クエリパラメーター、レスポンス形式、エラー処理については、作業時に `Program.cs` の実装を確認してください。

静的ファイルは `wwwroot` から配信されます。

```csharp
app.UseDefaultFiles();
app.UseStaticFiles();
```

画面が表示されない場合は、HTML の読み込みだけでなく、JavaScript の実行エラー、CSS・画像の読み込み失敗、API の応答も確認します。

## 7. 画面レイアウトの変更

### 基本方針

画面の見た目だけを変更する場合は、原則として `wwwroot` 内の HTML、CSS、JavaScript を調査し、必要なファイルだけを変更します。

次の項目を分けて考えてください。

1. HTML：画面要素、入力欄、ボタン、表示領域
2. CSS：幅、高さ、余白、色、文字サイズ、配置、スマートフォン表示
3. JavaScript：イベント処理、API 呼び出し、入力検証、画面更新
4. C#：API、データ処理、データベース処理

レイアウト変更だけであれば、データベースのテーブル構造や API を不用意に変更しないでください。

### スマートフォン表示

iPhone などのスマートフォンから利用するため、次の点を確認してください。

- ビューポート設定
- 横幅が狭い場合のレイアウト
- 入力欄やボタンの操作性
- 表や予約一覧の横スクロール
- 長い施設名・入所者名の表示
- 登録・更新時の成功表示とエラー表示

デザイン変更後は、PC とスマートフォンの両方で確認します。

### JavaScript の不具合

画面が真っ白な場合は、次の順で確認します。

1. HTML ファイルがサーバーから返されているか。
2. JavaScript ファイルが正常に読み込まれているか。
3. ブラウザーの開発者ツールにエラーがないか。
4. API が期待した形式のデータを返しているか。
5. JavaScript が API のエラーや空データを正しく処理しているか。

サーバーから HTML が `200 OK` で返ることと、画面全体が正常に動作することは別です。

## 8. トラブルシューティング

### IIS サイトの状態

管理者 PowerShell で実行します。

```powershell
Import-Module WebAdministration

Get-Website -Name "Menkai" |
    Select-Object Name, State, PhysicalPath
```

期待する状態：

- `Name`：Menkai
- `State`：Started
- `PhysicalPath`：`C:\Apps\Menkai\publish`

### HTTP 応答の確認

サーバー内部から確認します。

```powershell
Invoke-WebRequest `
    "http://localhost:8085/" `
    -UseBasicParsing
```

LAN 側 IP アドレスからも確認します。

```powershell
Invoke-WebRequest `
    "http://192.168.130.10:8085/" `
    -UseBasicParsing
```

正常時は `StatusCode : 200` が期待されます。

### API の確認

```powershell
Invoke-WebRequest `
    "http://localhost:8085/api/reservations" `
    -UseBasicParsing
```

API の仕様によっては、クエリパラメーターや別の入力が必要な場合があります。エンドポイントの実装を確認してから判断してください。

### データベースの確認

```powershell
Get-Item "C:\Apps\Menkai\data\visits.db" |
    Select-Object FullName, Length, LastWriteTime
```

ファイルの存在や更新日時だけでは、予約データの正しさまでは確認できません。登録・取得・更新の結果も確認してください。

### アクセスできない場合の切り分け

| 症状 | 確認事項 |
|---|---|
| サーバーでもアクセスできない | IIS サイト、アプリケーションプール、アプリの起動エラー |
| サーバーでは成功、iPhone ではタイムアウト | ファイアウォール、LAN、Wi-Fi の端末間通信制限 |
| HTML は表示されるが画面が真っ白 | JavaScript、CSS、ブラウザーのコンソール |
| 予約取得に失敗する | API の応答、DB 接続、アプリのログ |
| 予約登録に失敗する | 入力形式、API の検証、DB 書き込み権限 |
| 更新後に古い画面が残る | ブラウザーキャッシュ、静的ファイルの配置 |

## 9. IIS の運用設定

現在のサーバー設定は次のとおりです。

| 項目 | 設定 |
|---|---|
| IIS サイト | Menkai |
| バインド | `http *:8085:` |
| 物理パス | `C:\Apps\Menkai\publish` |
| アプリケーションプール | MenkaiPool |
| .NET CLR | No Managed Code |
| Start Mode | AlwaysRunning |
| Idle Timeout | 00:00:00 |
| PreloadEnabled | True |
| Application Initialization | インストール済み |
| SQLite 保存先 | `C:\Apps\Menkai\data\visits.db` |

サーバーの LAN 内 IP アドレスは、確認時点で `192.168.130.10` です。アドレスは変更される可能性があるため、必要に応じて実機で再確認してください。

現在のアクセス先：

`http://192.168.130.10:8085/`

サーバー再起動後に、サーバー端末からのアクセスが成功することを確認済みです。

### ファイアウォール

Menkai 用に、TCP 8085 の受信を許可する規則を追加済みです。

- `Menkai TCP 8085 (Private LAN)`
- `Menkai TCP 8085 (LAN on Public)`

サーバーのネットワークプロファイルは確認時点で `Public` でした。Public 用の規則はローカルサブネットに限定しています。

ファイアウォールを全体的に無効化しないでください。ルールの変更は、社内ネットワークの管理方針を確認したうえで、必要最小限にします。

### HTTPS

現在の構成は HTTP です。HTTP では通信が暗号化されません。氏名や面会予約情報を扱うため、実運用にあたっては HTTPS 化を検討してください。

HTTPS 化する場合は、証明書、IIS バインド、iPhone などの端末での証明書信頼、社内 DNS や名前解決を含めて設計します。

## 10. ビルドと公開

サーバーのソースコードディレクトリで実行します。

```powershell
Set-Location "C:\Apps\Menkai\source"

dotnet restore
dotnet build -c Release
```

ビルドが成功したことを確認してから公開します。

```powershell
dotnet publish -c Release -o "C:\Apps\Menkai\publish"
```

公開後は、IIS 経由で HTML と API の動作を確認してください。

### 公開時の注意

- `C:\Apps\Menkai\data` は公開先とは別のディレクトリです。
- 公開処理で運用中の DB を削除・上書きしないでください。
- ソースコードの変更が原因で起動できなくなった場合は、直前の正常な公開物や Git の変更履歴を確認してください。
- 公開前に必要なバックアップを取得してください。
- 稼働中の既存サイトや Windows サービスの設定を変更しないでください。

## 11. GitHub による変更管理

リポジトリの状態を確認します。

```powershell
git status
git branch --show-current
git remote -v
```

変更内容を確認します。

```powershell
git diff
git diff --stat
```

サーバー上で変更した `Program.cs` の DB 保存先設定は、GitHub の `main` にまだ反映されていない可能性があります。コミット・プッシュ前に、変更内容と現在のブランチを必ず確認してください。

意図した変更だけをコミットします。

```powershell
git add Program.cs
git diff --cached
git commit -m "Configure external SQLite data directory"
```

プッシュする前に、リモートとの履歴の違いを確認してください。

```powershell
git fetch origin
git status
```

リモートに別の変更がある場合は、無理に上書きせず、履歴を確認して統合します。

開発用 PC では、未コミットの作業を確認してから GitHub の変更を取得してください。

```powershell
git status
git pull
```

運用データベース、個人情報、秘密情報をリポジトリに含めないでください。`.gitignore` の内容も確認してください。

## 12. 予約データの保護

開発・公開・障害調査では、次の原則を守ります。

1. 運用データベースのバックアップを取得する。
2. DB の保存先が変わっていないか確認する。
3. テーブル構造を変更する場合は移行方法を用意する。
4. テストには架空の氏名や予約データを使用する。
5. ログや画面キャプチャを外部共有する場合は個人情報を除去する。
6. 運用 DB を開発環境の DB で上書きしない。
7. Git の変更と公開先の変更を分けて記録する。

SQLite のバックアップは、アプリケーションが書き込み中の場合の整合性も考慮してください。可能であれば SQLite のバックアップ機能などを利用し、単純なファイルコピーだけに依存しない方法を検討します。

## 13. 開発作業の推奨手順

1. 現在の Git ブランチと変更状態を確認する。
2. 変更対象のファイルと既存実装を調べる。
3. 修正範囲を限定する。
4. ビルドと必要なテストを行う。
5. 画面変更は PC とスマートフォンで確認する。
6. API と DB に影響する変更は、登録・取得・更新を確認する。
7. 変更内容を Git で記録する。
8. 公開前にバックアップを確認する。
9. IIS に公開し、HTTP・API・DB の動作を確認する。
10. 必要に応じて再起動後の動作も確認する。

## 14. 今後の改善候補

- HTTPS 化
- アプリケーションログと障害時の調査手順の整備
- SQLite の定期バックアップと復旧手順の整備
- API の入力検証とエラー応答の整理
- スマートフォン向け画面の操作性改善
- 開発・テスト・本番の設定分離
- GitHub 上のソースとサーバーの稼働ソースの同期確認
- 更新・公開の手順書作成

---

**本書の更新方針：** ソースコード、API、DB スキーマ、IIS 設定を変更した場合は、README も更新します。記載内容と実際のコードが異なる場合は、現行のコードとサーバー設定を確認してから本書を修正してください。
