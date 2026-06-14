# BBO Challenge

以中華職棒歷年真實成績為基礎，產生 BBO 風格球員卡並進行隨機選秀與 120 場球季模擬的純前端小遊戲。

本專案不使用原版全民打棒球完整卡片資料。球員能力值由
[`ldkrsi/cpbl-opendata`](https://github.com/ldkrsi/cpbl-opendata) 的年度成績推算，再依專案規則限制卡色、能力上下限與卡片數量。

## 快速開始

專案不需要安裝套件或執行建置指令。

1. 開啟 `index.html`。
2. 從首頁選擇職業二軍頻道、業餘頻道、自由頻道或球員查詢。
3. 進入頻道後按下 `SPIN` 開始選秀。
4. 選擇球員，再點擊左側對應守位加入陣容。
5. 選滿 9 位打者與 7 位投手後，關閉完成提示框便會自動模擬 120 場。

若瀏覽器限制本機檔案或音樂播放，可使用任意靜態伺服器啟動，例如：

```powershell
python -m http.server 8000
```

接著開啟 `http://localhost:8000`。背景音樂會在使用者第一次按下 `SPIN` 後開始播放，這是瀏覽器自動播放政策的要求。

## 目前資料規模

- 年度：1990–2024，共 35 年
- 年度球隊池：172 組
- 球隊名稱：18 支
- 球員卡：6,065 張
- 打者：3,254 張
- 投手：2,811 張

卡色分布：

| 類型 | 紫卡 | 紅卡 | 黃卡 | 藍卡 |
| --- | ---: | ---: | ---: | ---: |
| 打者 | 175 | 328 | 1,133 | 1,618 |
| 投手 | 175 | 259 | 982 | 1,395 |

## 遊戲規則

### 首頁與模式

- 職業二軍頻道：套用紫卡最多 2 位、紅卡加紫卡最多 10 位的陣容限制。
- 業餘頻道：套用紫卡最多 1 位、紅卡加紫卡最多 6 位的陣容限制。
- 自由頻道：玩法與其他選秀規則相同，但紅卡、紫卡數量不限。
- 對戰模式：兩位玩家共用畫面輪流選秀，完成後進行三戰兩勝。
- 連線對戰：兩位玩家分別完成選秀後，透過 Firebase 匿名配對進行三戰兩勝。
- 球員查詢：位於首頁獨立的資料工具區，可依聯盟、年度及球隊瀏覽完整球員卡數值，並切換全部選手、野手及投手。

頻道切換時會重新開始選秀，避免不同模式的陣容限制互相污染。

### 對戰模式

對戰模式使用獨立的雙玩家選秀流程：

1. 選擇自由頻道、職業二軍頻道或業餘頻道；雙方會分別套用該頻道的卡色限制。
2. 玩家1按下 `SPIN`，從該年度球隊選擇一位球員。
3. 玩家2從相同年度球隊選擇一位球員。
4. 下一輪改由玩家2按下 `SPIN` 並先選，接著由玩家1選擇。
5. 持續交替，直到雙方各完成 9 位打者與 7 位投手。

左側顯示玩家1、中央顯示選秀區、右側顯示玩家2。玩家名稱旁以卡色及數字顯示紫、紅、黃、藍卡數量；職業二軍及業餘頻道另顯示紅紫合計上限。

點選多守位球員後，目前玩家的合法空位會顯示「可放入」，直接點擊守位即可加入。同一位選手不分年度只能被其中一位玩家選取一次。

隊伍名單會顯示卡片顏色，游標移到球員名稱時可查看數值。打者區顯示力量、打擊、速度、守備、傳球平均；投手區顯示體力、控球、球威、變化平均。平均值超過 80 顯示紅色，超過 91 顯示紫色。

雙方打者可長按球員列並拖曳至需要的棒次，棒次越前面的打者在對戰模擬中取得較高打席權重。進入對戰模式時會開始播放背景音樂，中央提供靜音及下一首按鈕。

完成選秀後可模擬三戰兩勝：

- 每場先攻與後攻隨機決定
- 第 1 戰雙方使用 `SP1`
- 第 2 戰雙方使用 `SP2`
- 若進行第 3 戰，雙方使用 `SP3`
- 任一玩家先取得兩勝即結束系列賽
- 每場顯示 1 至 9 局逐局得分、總得分 `R`、安打 `H`、失誤 `E` 與 `WIN / LOSE`
- 每場列出勝投、敗投、救援投手、全壘打球員及單場 MVP；MVP 顯示打數、安打、全壘打與打點

### Firebase 連線對戰

連線對戰沿用單人選秀規則。玩家先選擇頻道並完成 9 位打者、7 位投手，之後按下「尋找對手」。系統只會配對相同頻道的玩家，配對成功後使用對戰模式的左右陣容與三戰兩勝結果畫面。

玩家使用 Firebase 匿名驗證，不需要輸入帳號或密碼。排隊、玩家陣容及比賽資料都設定 `onDisconnect` 清除；任一玩家關閉網頁或中斷連線後，該場暫存資料會從 Realtime Database 移除。

#### Firebase 初次設定

1. 在 [Firebase Console](https://console.firebase.google.com/) 建立專案及 Web App。
2. 在 `Authentication` → `Sign-in method` 啟用 `Anonymous`。
3. 建立 `Realtime Database`。
4. 將 Web App 設定填入 `firebase-config.js`：

```js
window.BBOFirebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  databaseURL: "https://...-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "...",
  appId: "..."
};
```

5. 將 `firebase-database.rules.json` 的內容發布至 Realtime Database Rules。
6. 將 GitHub Pages 網域加入 Firebase Authentication 的 Authorized domains。

目前配對資料只允許已通過 Firebase 匿名驗證的使用者讀寫，且不會永久保存。若未填寫 `firebase-config.js`，按下尋找對手時會顯示設定提示，其他遊戲模式仍可正常使用。

### 選秀陣容

- 打者：9 位
  - `C / 1B / 2B / 3B / SS / LF / CF / RF / DH`
- 投手：7 位
  - `SP1 / SP2 / SP3 / RP1 / RP2 / CP1 / CP2`
- 總人數：16 位

球員只能加入符合其守位或投手角色的欄位。打者皆可放入 `DH`，但模擬時 DH 不計守備與傳球。

同一位選手不論年度、球隊或卡片等級，整場選秀只能加入一次。已選入後，該選手其他年度的卡片會自動反灰。

### 每輪限制

每次正常 `SPIN` 代表新的一輪：

- 每輪最多選擇 2 位打者
- 每輪最多選擇 2 位投手
- 至少成功加入 1 位球員後，才可進行下一次正常 `SPIN`

名單會自動依下列順序排列：

1. 紫卡
2. 紅卡
3. 黃卡
4. 藍卡
5. 同卡色依綜合能力由高至低

名單可切換顯示全部選手、野手或投手。

### 重抽限制

整場選秀中，「換年份」與「換球隊」各有一次重抽機會：

- 換年份：保留球隊，隨機選擇該球隊其他可用年份
- 換球隊：保留年份，隨機選擇該年份其他可用球隊
- 選過球員後仍可使用
- 使用其中一種後，仍可使用另一種
- 每種重抽各自使用後才會停用
- 重新選秀後才會恢復

### 卡色限制

各頻道玩家最終陣容限制：

| 頻道 | 紫卡上限 | 紅卡加紫卡上限 |
| --- | ---: | ---: |
| 職業二軍 | 2 | 10 |
| 業餘 | 1 | 6 |
| 自由 | 無限制 | 無限制 |

達到限制後，其他受限卡片會直接顯示為不可選。

### 年度紫卡限制

球員卡能力與卡色只和相同年度、相同類型的聯盟球員比較。

每個年度所有球隊合計：

- 打者紫卡最多 5 位
- 投手紫卡最多 5 位

### 模擬球季

模擬分數由 9 位打者與 7 位投手的加權能力平均計算，再換算成 120 場勝敗。

打者依實際排入守位套用 `config/權重.xlsx` 的權重：

| 守位 | 力量 | 打擊 | 速度 | 守備 | 傳球 |
| --- | ---: | ---: | ---: | ---: | ---: |
| C | 25% | 25% | 10% | 20% | 20% |
| 1B | 25% | 25% | 15% | 25% | 10% |
| 2B | 25% | 25% | 20% | 20% | 10% |
| 3B | 25% | 25% | 10% | 15% | 25% |
| SS | 25% | 25% | 20% | 20% | 10% |
| OF | 25% | 25% | 20% | 15% | 15% |
| DH | 34% | 34% | 32% | 0% | 0% |

投手依角色套用 `config/權重.xlsx` 的權重：

| 角色 | 體力 | 控球 | 球威 | 變化 |
| --- | ---: | ---: | ---: | ---: |
| SP | 30% | 23% | 25% | 22% |
| RP | 15% | 25% | 30% | 30% |
| CP | 10% | 25% | 35% | 30% |

9 位打者分數平均占隊伍分數 60%，7 位投手分數平均占 40%。各頻道聯盟比較基準：

| 頻道 | 聯盟基準 | 達到 100% 勝率所需分數 |
| --- | ---: | ---: |
| 業餘 | 52 | 72 |
| 職業二軍 | 57 | 77 |
| 自由 | 63 | 83 |

勝場會四捨五入為整數，因此分數約達「聯盟基準 + 19.84」時，也可能顯示為 120 勝。完整換算參數位於 `config.js` 的 `simulation`。

模擬後，右側選秀名單會切換成戰績、評級、隊伍分數及完整陣容數值。結果依守位順序顯示：

- 打者：`C → 1B → 2B → 3B → SS → LF → CF → RF → DH`
- 投手：`SP1 → SP2 → SP3 → RP1 → RP2 → CP1 → CP2`

## 能力值產生規則

完整公式與限制另見 [DATA_METHOD.md](DATA_METHOD.md)。以下是維護時最重要的摘要。

### 同年度比較

產生器逐年讀取資料。所有百分位排名均只比較同年度球員：

- 2005 年打者只與 2005 年打者比較
- 2005 年投手只與 2005 年投手比較

台灣大聯盟（TML）資料依聯盟分組。TML 球員只和同年度 TML 球員比較，不會與
同年度 CPBL 球員共同換算卡色、能力百分位或紫卡名額。

目前已匯入 1997–2002 年台北太陽、台中金剛、嘉南勇士及高屏雷公四隊資料，
共 344 張卡片（209 張野手、135 張投手）。卡色與能力百分位依完整同年度 TML
投手／打者分別排名，每年度投手與打者紫卡各最多 5 張。

TML 資料來源為台灣棒球維基館的球隊歷屆成員與球員職棒生涯成績，透過
Internet Archive Wayback Machine 快照取得。來源未提供逐年野手守備明細，因此
守備與傳球是依守位、同年度打擊貢獻及出賽量估算，不代表實際守備統計。

樣本門檻：

- 打者至少 20 打席
- 投手至少面對 20 打者

小樣本球員的能力會被拉回中間值，降低少量出賽造成的極端能力。

### 打者公式

- 力量：純長打率、全壘打率、長打率
- 打擊：打擊率、上壘率、避免三振
- 速度：盜壘率、三壘安打、得分
- 守備：守備率、助殺
- 傳球：助殺、守備率

力量與打擊：

- 差距至少 7
- 依真實數據較強的方向決定偏力量或偏打擊
- 超過力打總和限制的點數會轉移至守備、傳球，但不突破上限

### 投手公式

- 體力：先發場次與投球局數
- 控球：保送抑制與三振保送比
- 球威：三振率、被安打抑制、被全壘打抑制
- 變化：三振保送比、滾飛比、自責分抑制

`cpbl-opendata` 沒有完整歷年實測球速，因此「球威」代表球路壓制力，不是雷達槍球速。

RP 與 CP：

- 體力最高 70
- 球威與變化上限比同卡色 SP 高 2

### 打者能力限制

| 卡色 | 力量上限 | 打擊上限 | 速度上限 | 守備範圍 | 傳球範圍 | 力打總和上限 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 紫 | 92 | 94 | 95 | 86–92 | 86–92 | 170 |
| 紅 | 86 | 86 | 90 | 79–85 | 79–85 | 160 |
| 黃 | 84 | 83 | 86 | 74–80 | 74–80 | 155 |
| 藍 | 80 | 80 | 80 | 68–75 | 68–75 | 150 |

紫卡額外限制：

- 守備加傳球最高 178

### 投手能力上限

| 卡色 | 體力 | 控球 | 球威 | 變化 |
| --- | ---: | ---: | ---: | ---: |
| 紫 | 97 | 96 | 93 | 93 |
| 紅 | 88 | 93 | 86 | 86 |
| 黃 | 84 | 86 | 82 | 80 |
| 藍 | 80 | 80 | 78 | 75 |

## 專案結構

```text
BBO_challenge/
├─ index.html                  # 頁面結構與全部 CSS
├─ app.js                      # 遊戲狀態、選秀、渲染、音樂、模擬邏輯
├─ config.js                   # 守位、音樂、陣容限制、模擬權重
├─ generate-bbo-data.ps1       # CPBL 成績轉 BBO 風格球員卡
├─ DATA_METHOD.md              # 能力值公式與卡色規則
├─ README.md                   # 本交接文件
├─ BBO_Search/
│  ├─ bbo-data.js              # 前端直接載入的完整產出資料
│  ├─ BBODB.accdb              # 少量真實 BBO 樣本，用於參考校準
│  ├─ BBO_TeamData.exe         # 舊測試工具
│  └─ export-bbo-data.ps1      # 舊樣本資料匯出器
├─ cpbl-opendata/
│  └─ cpbl-opendata-master/    # 下載的原始 CPBL 資料，不納入 Git
├─ image/
│  └─ *.png                    # 球場背景圖片
└─ music/
   └─ *.mp3                    # 背景音樂
```

## 核心檔案維護

### `config.js`

適合調整的設定：

- `musicTracks`：音樂播放清單。新增 MP3 後必須同步加入此陣列。
- `fieldSlots`：球場守位座標與顯示名稱。
- `pitcherSlots`：投手欄位。
- `rosterLimits`：完整陣容人數。
- `roundLimits`：每輪可選投打人數。
- `seasonWeights`：一般打者、DH、投手模擬權重。
- `simulation`：模擬場次、投打占比、聯盟比較基準及勝率換算尺度。

守位座標使用百分比：

```js
{ key: "CF", label: "中外野", x: "50%", y: "27%" }
```

修改球場背景後，通常需要同步調整 `fieldSlots`。

### `app.js`

主要責任：

- 載入與正規化球員資料
- 建立年度球隊池
- 卡色與能力排序
- 選秀狀態與每輪限制
- 守位可用性與不可選反灰
- 卡色陣容限制
- 重抽年份／球隊
- 音樂隨機輪播、靜音、下一首
- 陣容與懸浮數值渲染
- 球季模擬及右側結果畫面

維護注意事項：

- 實際野手陣容欄位是 `LF / CF / RF`，不是 `OF1 / OF2 / OF3`。
- 判斷球員是否可選必須使用 `getAvailableRosterSlotsForPlayer()`。
- 成功加入陣容後必須重新執行 `renderRoster()`、`renderPlayers()` 與 `updateRoundInfo()`。
- DH 評分必須傳入欄位名稱，避免錯誤計入守備與傳球。

### `index.html`

專案 CSS 全部寫在此檔案中。主要介面區域：

- 左側：SPIN 控制、球場陣容、投手欄位、模擬按鈕
- 右側：選秀名單或模擬結果
- 首頁：玩法說明及頻道／球員查詢入口
- 球員查詢：年度、球隊下拉選單與完整球員卡列表

球場背景設定位於 `.team-grid`：

```css
background-image:
  linear-gradient(...),
  url("image/a29d7bf4-1015-4790-82d5-bdae237738d6.png");
```

### `generate-bbo-data.ps1`

產生器會：

1. 逐年讀取打擊、投球、守備 CSV。
2. 建立同年度能力百分位。
3. 計算綜合能力與年度卡色。
4. 套用卡色上下限、力打差距、力打總和及守傳限制。
5. 輸出 `window.BBOImportedDraft = [...]` 至 `BBO_Search/bbo-data.js`。

### 重新產生 TML 卡片

```powershell
powershell -ExecutionPolicy Bypass -File .\import-tml-data.ps1
```

此腳本會：

1. 從 TML 四支球隊頁面取得歷屆投手、野手名單。
2. 從 Wayback Machine 快取每位球員的職棒生涯成績頁。
3. 只保留 1997–2002 年 TML 四隊成績及最低 20 打席／面對打者的球季。
4. 依同年度 TML 全聯盟投手、打者分開排名並套用既有卡色與能力限制。
5. 輸出 `BBO_Search/tml-data.json`，並合併至 `BBO_Search/bbo-data.js`。

下載頁面會快取在不納入 Git 的 `tml-cache/`。使用 `-Refresh` 可重新下載快照。
執行 `generate-bbo-data.ps1` 重建 CPBL 卡片時，也會自動合併現有 TML 資料檔。

重新產生：

```powershell
powershell -ExecutionPolicy Bypass -File .\generate-bbo-data.ps1
```

指定年份範圍：

```powershell
powershell -ExecutionPolicy Bypass -File .\generate-bbo-data.ps1 -MinYear 2000 -MaxYear 2024
```

注意：產生器會覆寫 `BBO_Search/bbo-data.js`。

## 常見維護流程

### 更新 CPBL 原始資料

1. 更新或重新下載 `ldkrsi/cpbl-opendata`。
2. 確認資料位於 `cpbl-opendata/cpbl-opendata-master`。
3. 執行 `generate-bbo-data.ps1`。
4. 執行下方驗證。
5. 手動測試選秀與模擬。
6. 提交 `BBO_Search/bbo-data.js` 與相關規則修改。

### 新增背景音樂

1. 將音檔放入 `music/`。
2. 在 `config.js` 的 `musicTracks` 加入相對路徑。
3. 確認檔名大小寫與空格完全一致。

播放器會：

- 第一次按 SPIN 後開始播放
- 隨機洗牌
- 一輪內不重複
- 播完自動下一首
- 支援靜音與手動下一首

### 更換球場背景

1. 將圖片放入 `image/`。
2. 修改 `index.html` 中 `.team-grid` 的圖片路徑及 `aspect-ratio`。
3. 修改 `config.js` 中 `fieldSlots` 的百分比座標。
4. 測試桌面與窄螢幕顯示。

### 修改能力值規則

1. 修改 `generate-bbo-data.ps1`。
2. 同步更新 `DATA_METHOD.md` 與本 README。
3. 重新產生 `BBO_Search/bbo-data.js`。
4. 驗證所有上下限與卡色數量。

## 驗證指令

### 基本資料統計

```powershell
$d = (Get-Content -Raw -Encoding UTF8 '.\BBO_Search\bbo-data.js') `
  -replace '^window\.BBOImportedDraft\s*=\s*','' `
  -replace ';\s*$','' | ConvertFrom-Json

"players=$($d.Count)"
$d | Group-Object type,cardType | Select-Object Name,Count
```

### 驗證年度紫卡上限

```powershell
$years = @($d.year | Sort-Object -Unique)
foreach ($year in $years) {
  $hitters = @($d | Where-Object {
    $_.year -eq $year -and $_.type -eq 'hitter' -and $_.cardType -eq '紫'
  }).Count
  $pitchers = @($d | Where-Object {
    $_.year -eq $year -and $_.type -eq 'pitcher' -and $_.cardType -eq '紫'
  }).Count
  if ($hitters -gt 5 -or $pitchers -gt 5) {
    "$year hitters=$hitters pitchers=$pitchers"
  }
}
```

### 驗證力打差距

```powershell
@($d | Where-Object {
  $_.type -eq 'hitter' -and [Math]::Abs($_.power - $_.contact) -le 6
}).Count
```

預期結果為 `0`。

### 驗證紫卡守傳總和

```powershell
@($d | Where-Object {
  $_.type -eq 'hitter' -and
  $_.cardType -eq '紫' -and
  ($_.fielding + $_.arm) -gt 178
}).Count
```

預期結果為 `0`。

### 驗證產生器語法

```powershell
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path '.\generate-bbo-data.ps1'),
  [ref]$tokens,
  [ref]$errors
) | Out-Null
$errors
```

預期沒有輸出。

## 手動測試清單

提交前至少測試：

1. 第一次 SPIN 後音樂開始播放。
2. 靜音與下一首按鈕正常。
3. 換年份保留球隊；換球隊保留年份。
4. 重抽在整場只能使用一次，選球後仍可使用。
5. 每輪打者、投手各最多選 2 位。
6. 紫卡最多選 2 位。
7. 紅卡加紫卡最多選 10 位。
8. 已滿的守位或角色球員會正確反灰。
9. 外野及 DH 全滿後，外野手會反灰。
10. 已選球員顯示兩位年份及卡色背景。
11. 滑鼠移到已選球員可看到半透明能力浮層。
12. 模擬結果顯示完整 16 人陣容。
13. 模擬結果依指定守位順序排列。
14. 重新選秀會清除陣容、限制與結果畫面。
15. 職業二軍頻道會限制紫卡及紅紫卡數量。
16. 業餘頻道限制紫卡最多 1 位、紅紫卡最多 6 位。
17. 自由頻道不限制紅卡、紫卡數量。
18. 球員查詢的年度選單只顯示實際資料年度，球隊選單會隨年度更新，並可切換全部選手、野手及投手。
19. 完成選秀後自動模擬，且 `LF / CF / RF` 均套用 `OF` 模擬權重。
20. 對戰模式依玩家1、玩家2、玩家2、玩家1的蛇形順序完成雙方選秀。
21. 對戰模式可調整棒次，並模擬隨機先後攻的三戰兩勝。
22. 對戰模式三種頻道分別套用卡色限制，選秀開始後不可切換頻道。
23. 對戰模式多守位球員可指定守位，隊伍名單可查看卡色與球員數值。
24. 對戰結果顯示九局逐局得分、R/H/E 與每場 WIN／LOSE。
25. 對戰模式進入時播放音樂，多守位球員透過隊伍空位直接指定守位。
26. 對戰隊伍顯示卡色數量、紅紫限制及投打能力平均。
27. 對戰棒次可拖曳排序，記分板不產生水平捲動。
28. 每場對戰結果顯示勝敗投、救援、全壘打與 MVP 單場數據。

## Git 與備份

`cpbl-opendata/` 是可重新下載的來源資料，因此由 `.gitignore` 排除。產出的
`BBO_Search/bbo-data.js` 必須納入 Git。

查看狀態：

```powershell
git status --short
```

建立提交：

```powershell
git add .
git commit -m "描述本次修改"
```

建立完整 Git 歷史備份：

```powershell
git bundle create ..\BBO_challenge_backups\BBO_challenge-git.bundle --all
git bundle verify ..\BBO_challenge_backups\BBO_challenge-git.bundle
```

由 bundle 還原：

```powershell
git clone BBO_challenge-git.bundle BBO_challenge-restored
```

## 已知限制與注意事項

- 能力值是推算值，不是原版全民打棒球完整官方卡片數值。
- `cpbl-opendata` 沒有完整歷年實測球速，因此球威是壓制力代理值。
- 前端資料檔約 1.7 MB，瀏覽器會一次載入全部球員。
- 專案沒有自動化瀏覽器測試，目前仍需要手動測試主要流程。
- HTML、CSS 與 JavaScript 未經打包或壓縮，方便直接維護。
- 音樂及圖片的使用授權應由專案維護者自行確認。
- `BBO_Search` 中的 EXE、Access 資料庫與 INI 是舊測試素材，不是目前遊戲執行必要檔案。
