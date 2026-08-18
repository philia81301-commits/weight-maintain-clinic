# 交接：weight-maintain-clinic

## ⏯️ 目前做到哪

**2026-08-18。表單已建好並接上，工具可以用了。** 尚未做端到端送出測試。

- 表單（填寫）：https://docs.google.com/forms/d/e/1FAIpQLScS35aQ8V6-g4gRbQzkEwFY0GwC3b3O5DWPAXy8k6Uyj_GNQg/viewform
- 表單（編輯）：https://docs.google.com/forms/d/19uUl-kPa90fyVJaUasqjStXSNXUfCeGLyJj_5ZXT-e4/edit
- 回覆試算表：https://docs.google.com/spreadsheets/d/1QYUX1yrZmjbbKkhb44i1ZA2D3liKAs0VL0ID_OEy_2E/edit
- 兩者都在「門診工具-正式運作中」資料夾，三個分頁（表單回應／個案歷程／個案總表）已生成

**注意：回應分頁的實際名稱是英文 `Form Responses 1`**，表頭也是英文 `Timestamp`
（試算表以英文語系建立）。欄位字母定位不受影響，但**分頁名稱**曾經害慘一次，見下。

**2026-08-18 修掉一個靜默失敗的 bug**：原本用 `ss.getSheets()[0]` 取回應分頁名稱，
但索引 0 是 `SpreadsheetApp.create()` 留下的預設空白表 `工作表1`，公式因此指向空表，
`個案歷程`／`個案總表` 全白且被 `IFERROR` 吃掉不報錯。已改用 `getFormUrl()` 判別
（`findResponseSheet()`），並加 `removeDefaultSheet()` 清掉多餘分頁。
腳本另附 `repair()`：不重建表單就能修好既有試算表，測試資料不受影響。

**已做的煙霧測試**（瀏覽器載入 `index.html`，未送出任何資料）：console 無錯誤、
BMI 自動計算與分級、劑量隨藥切換、無用藥自動帶「無」、併用切換文字框、
運動選「無」自動補三個「無」、劑量字串 `Mounjaro 7.5 mg/週`、ENTRY 14 個全有值。

**已上線**：<https://philia81301-commits.github.io/weight-maintain-clinic/>
- repo：<https://github.com/philia81301-commits/weight-maintain-clinic>（公開，main 的 root）
- 線上版已驗證：HTTP 200、`FORM_ID` 正確帶上線、佔位字串只剩防呆碼本身

**代碼 7 的更正已推上 dotfiles**（commit `253a36f`）。
注意：這台機器（使用者 `office`）**沒有 PowerShell profile，`Sync-Agents` 不存在**，
是手動做完等效動作（改來源檔 → `chezmoi apply` → commit → push）。

## ⏭️ 下一步（照順序做）

1. ~~建表單~~ **已完成 2026-08-18**
2. ~~貼進 `index.html`~~ **已完成**
3. **端到端測試**（大部分已完成 2026-08-18，見下）（用 `_local/回診3個月以上個案名單_2026_07.xlsx` 的個案手動輸入）：
   - 送出 → 「表單回應 1」出現該筆、每一欄都有值（**特別確認飲食習慣、運動類型這兩題
     複選有沒有完整進去，以及藥物劑量的字串格式**）
   - 「個案歷程」黃格填姓名＋出生年 → 列出該人紀錄、折線圖有畫出來
   - **同一人送兩筆不同體重** → 與前次差、與首次差、累積減重% 算對
   - 「個案總表」該人回診次數＝2、首次／最新體重正確
4. 測完清掉測試資料（直接刪回應分頁的列即可，歷程與總表是公式會自己更新）。
5. ~~`git init` + GitHub repo + Pages~~ **已完成 2026-08-18**

## ⚠️ 公開 repo 的注意事項

- **任何臨床資料都不進版控**。個案姓名、病歷號只留在 `_local/`（已 gitignore）。
  2026-08-18 建 repo 前掃出 `handoff.md` 曾寫入 7 組病歷號與 1 個病人姓名，已清除。
  **日後寫交接紀錄時不要再貼個案識別資訊，改寫「見 `_local/` 的某某檔」。**
- `FORM_ID` 隨頁面公開，理論上任何人都能往表單塞資料（與既有 `weight-clinic` 同樣取捨）。
- `repair()` 內的試算表 ID 也公開，但試算表未公開分享，光有 ID 無法存取。

## ⚠️ 一定要先看

- `agents.md` 的「不可違反」與「踩過的坑」——`pageHistory` 靜默丟資料、必填靜默拒收、
  選項字串一字不差，這三個都是實際發生過的。
- 本專案**會上傳姓名**，和 `sarcopenia-clinic` 的守則不同，那是刻意的決定，
  理由寫在 `agents.md`「隱私」一節。回覆試算表因此不得公開分享。

## 📋 2026-08-18 做了什麼

**查證（都有實際跑過，不是憑印象）**

- 讀完 `weight-clinic` 線上版原始碼（31 KB），確認它的送出機制與兩條血淚註解
- `*減重評估表` 的題目從回覆試算表表頭確認（Drive API 讀不了 Google 表單本體）
- 確認 `*減重評估表` 的「目前用藥」下拉**只寫進病歷貼稿、沒有送進表單**
  （沒有對應 entry ID），所以本專案的「目前用藥」是新建題目而非沿用
- `減重門診個案2026_7.xls`（個案列表 794 筆）：`drug` 欄自由文字散化情況、
  `chart` 病歷號完整度、性別編碼交叉驗證，數字都記在 `agents.md`

**決策（使用者拍板）**

- 個案鍵：**姓名＋西元出生年**（不加病歷號）
- 歷程呈現：**只在回覆試算表看**，工具維持只寫不讀 → 個案資料不離開 Google 帳號，
  不發布 CSV、不做帶 token 的 Web App

**產出**

- `tools/create-google-form.gs`、`index.html`、`docs/google-form-fields.md`、
  `agents.md`、`README.md`、`.gitignore`
- `_local/回診3個月以上個案名單_2026_07.xlsx`（267 人，供手動測試）

**2026-08-18 第二輪修正（使用者指出用藥代碼有紀錄）**

- `git pull` 全域指令庫（`~/.local/share/chezmoi`，已是最新），在
  `.chezmoitemplates/skill-weight-clinic.md` 找到用藥代碼表，抄進 `agents.md`
- 名單的用藥欄原本用我自己臨時寫的對應（108 筆數字代碼被誤標「需確認」），
  **已改用官方 `normalizeDrug()` 重跑**（node eval 原始函式，不另寫一份）。
  全 794 筆只剩 1 筆需人工確認（那筆 `7`，代碼表明載不存在）
- 名單新增「用藥分類(官方)」「表單下拉選項」兩欄
- **下拉補上「手術後（bariatric）」**——官方分類有「手術」而參考工具的下拉沒有，
  全庫 13 筆。理由與移除方式寫在 `docs/google-form-fields.md` 末節。
  **→ 2026-08-18 第三輪已撤除**，見下。

**2026-08-18 第三輪（使用者更正代碼 7 定義 + 手術個案不追蹤）**

- **代碼 `7` = 手術**，與 `bariatric`／`GS`／`ESG`／`外科` 同義。全域紀錄原本寫「代碼 7
  不存在」是錯的，已改三處來源檔並 `chezmoi apply` 部署：
  `.chezmoitemplates/skill-weight-clinic.md`、`executable_analyze_case.js`、
  `executable_duration_analysis.js`（後兩支的 `normalizeDrug()`）。
  **chezmoi 尚未 push 到 GitHub**（`Sync-Agents` 未執行，等使用者確認）。
- 重跑後全 794 筆**零筆待確認**，手術共 14 筆
  （`bariatric` 9、`7` 1、`GS` 1、`ESG` 1、`外科` 1、`手術` 1）。
- **撤除**上一輪加的「手術後（bariatric）」下拉選項——減重門診不追蹤手術個案。
- 名單改用 `_local/回診3個月以上個案名單_2026_07_v2.xlsx`：**265 人**（排除 2 名符合
  3 個月條件的手術個案，另立「已排除(手術)」分頁），用藥欄 **0 筆對不上下拉選項**。
  舊的 `..._2026_07.xlsx` 當時被 Excel 鎖住無法覆寫，可直接刪除。

## ✅ 端到端測試結果（2026-08-18）

用假名個案「測試甲／1980」送兩筆（80 kg → 78.5 kg）：

- `Form Responses 1`：兩筆都完整落地，**複選題沒被吃掉**
  （飲食習慣 `外食居多, 含糖飲料`／運動類型 `走路, 重訓`），
  劑量字串 `Mounjaro 7.5 mg/週`、`Mounjaro 10 mg/週` 格式正確
- `個案總表`：回診次數 2、首次 80.0、最新 78.5、總變化 -1.5、累積減重 1.9% **全部正確**
- **`個案歷程` 分頁仍未驗證**——它要人工在黃色格子 B2／B3 填姓名與出生年才會出資料，
  Drive API 無法代填。測試資料已於 2026-08-18 刪除，故這一項**至今沒有實測過**。
  第一次門診實際使用時，記得順手確認：同一人第二筆送出後，
  「與前次差／與首次差／累積減重%」有沒有算出來、折線圖有沒有畫。
  公式邏輯本身已用 dry-run 檢查過（`個案總表` 用同一組資料驗證正確），
  但歷程分頁的 FILTER／SORT 尚未跑過真實資料。
- 工具端煙霧測試（未送出）：console 無錯誤、BMI 自動計算與分級、劑量隨藥切換、
  無用藥自動帶「無」、併用切換文字框、運動選「無」自動補三個「無」

## 🔍 源檔資料異常（2026_7.xls，待使用者處理）

挑名單時發現，**不影響本工具，但月報統計會受影響**，共 43 筆。
**個案識別資訊（姓名、病歷號）一律只留在本機** `_local/回診3個月以上個案名單_2026_07_v2.xlsx`
的「資料異常」分頁，不寫進這個 repo 的任何檔案——本 repo 是公開的。

| 問題 | 筆數 | 說明 |
|---|---|---|
| `v2` 有值但不是日期 | 33 | 26 筆是純空白字元；另有 `GS`、`OP`、`bariatric`、`出納先生很胖`、`2026/30/16`、`2026/6//1` |
| `v2` 早於 `v1` | 6 | 5 筆疑似日期填反；1 筆的 `v2` 存成 `YYYYMMDD` 純數字被當成奈秒解析成 1970 年 |
| `v1` 空白或無法解析 | 4 | — |
| `drug` 寫法無法歸類 | 0 | 代碼 `7` 已確認為手術（見 `agents.md` 代碼表），全數可歸類 |

## 📎 相關位置

- 參考工具：<https://philia81301-commits.github.io/weight-clinic/>
- 表單資料夾：我的雲端硬碟／門診工具-正式運作中（`18xqn4hGq4fIZ06-jzm7MZRx3FdFZACoc`）
- 分析資料夾：我的雲端硬碟／臨床工作／減重門診分析（`1NQn_oOC_HpLTTIlRrJntoCo0bcc1bwZa`）
- 個案檔：`減重門診個案2026_7.xls`（`1VB2HapiRm3YoYnhU41_oDJ0AXRW_JbLX`）
