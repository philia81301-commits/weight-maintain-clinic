# 交接：weight-maintain-clinic

## ⏯️ 目前做到哪

**v1.0 已上線並實際使用中。** 2026-08-18 一天內從零完成：建表單、建輸入工具、
上 GitHub Pages、端到端驗證，使用者已輸入 5 筆真實個案資料（2 位個案）。

2026-08-19 使用者實際補了 100+ 筆歷史回覆（22 位個案），並反映**回應分頁的日期顯示成
美式 M/D/YYYY**，與輸入工具、分析分頁的 YYYY/MM/DD 不一致，已修（見下方）。

**2026-08-21 歷程圖 Y 軸攻堅完成**：使用者反映折線圖 Y 軸 0–100 把減重壓成平線。
經五輪 repair 實測，`setOption` 與 PRETTY 模式全是死路（詳見 agents.md 坑 9），
最終方案＝Sheets 進階服務 `addChart` 從零建圖＋onEdit 觸發器在切換個案時
動態設 Y 軸上下限（貼齊 5 的倍數 → 每 5 kg 一格）。14:22 目視驗收通過。
同日順帶套用了之前累積的五項改動（圖表位置、下拉選單、劑量去冗字、日期格式等）。
雲端側新增了兩個一次性設定（已完成）：建置腳本專案啟用 Sheets 進階服務、
安裝 `onHistoryPick` 觸發器。

## 🚦 目前狀態

| 項目 | 狀態 |
|---|---|
| 線上工具 | ✅ 可用 <https://philia81301-commits.github.io/weight-maintain-clinic/> |
| Google 表單 → 試算表 | ✅ 已驗證，複選題、劑量字串、回診日期都正確落地 |
| `個案總表` | ✅ 已驗證（某個案 4 次、72.2→68.3、-3.9kg、5.4%，手算核對過） |
| `個案歷程` | ✅ 已驗證（四列日期正確、折線圖有畫出來） |
| 圖表位置／下拉選單／劑量字串 | ✅ 2026-08-21 `repair()` 已套用 |
| 日期顯示格式 | ✅ 同上，A 欄 `yyyy/mm/dd hh:mm:ss`、P 欄 `yyyy/mm/dd` |
| 歷程圖 Y 軸 | ✅ 2026-08-21 14:22 全部完工並目視驗證：切換個案時觸發器自動把 Y 軸設成該個案範圍（貼齊 5 的倍數、每 5 kg 一格、不從 0 起算），有「體重 (kg)」標題、資料點圓標 |
| 兩表合併分析的日期對齊 | ⏳ 程式已備妥 `alignAssessmentSheetDates()`，尚未執行 |

## ➡️ 下一步

1. **（已完成 ✅）歷程圖 Y 軸**：2026-08-21 14:22 驗收通過，切換個案自動調整。
   之後若圖表怪怪的，先確認建置腳本專案的觸發器還在（編輯器左側鬧鐘圖示 →
   應有 `onHistoryPick`），以及「服務」裡有 `Sheets`。
3. **（合併分析前才需要）跑 `alignAssessmentSheetDates()`**：把 `*減重評估表 (回覆)`
   的時間戳記從 `2025/9/25 下午 1:41:34` 統一成 `2025/09/25 13:41:34`。
   只改顯示格式、不動資料，但**動到的是減重門診那份正式運作中的檔案**，
   故刻意不併進 `repair()`，要單獨執行。細節見 `docs/google-form-fields.md` 末節。
4. **實際門診用一段時間**，收集不順手之處。後續改進想法列在 `agents.md` 末段，
   但建議用過再決定，實際手感比憑空設想準。
5. **（待決定）是否匯入 xls 的歷史底稿**：xls 每人有 v1／v2 兩個時間點，可產生成
   表單回覆列貼進試算表，讓舊個案立刻有歷程起點。限制：每人只有兩點、飲食運動腰圍
   都空白、需排除手術個案與 43 筆日期異常。**建議先不做**，等欄位結構穩定再說。

## ⚠️ 注意事項

- **改動前先讀 `agents.md`** 的「不可違反」與「踩過的坑」。那裡記了六個**靜默失敗**的坑
  （pageHistory、必填拒收、選項字串、`getSheets()[0]`、QUERY `order by`、日期用 Timestamp），
  每一個都是實際發生過、而且不會報錯的。
- **建置腳本必須是獨立專案**，不要從表單 ⋮ →「指令碼編輯器」建。綁定式專案在容器檔案
  被刪時會一起進垃圾桶（2026-08-18 發生過）。
- **本 repo 是公開的**：個案姓名、病歷號一律只留在 `_local/`（已 gitignore），
  交接紀錄不要貼識別資訊。
  **push 前先掃一次 `git diff`**——2026-08-19 就是這樣抓到交接檔的驗證紀錄裡漏了一個
  真實姓名＋體重（已改成「某個案」，驗證意義不變）。`_local/` 有 gitignore 擋著，
  但**手打進 md 的識別資訊沒有任何機制會擋**，只能靠掃。
- **改 `index.html` 後一定要驗語法**：把 `<script>` 內容抽出來跑 `node --check`。
  瀏覽器預覽窗是靜態快照、腳本不執行，語法錯誤完全不會顯示。
- 源檔 `減重門診個案2026_7.xls` 有 43 筆日期異常（`v2` 非日期 33、`v2` 早於 `v1` 6、
  `v1` 缺 4），清單在 `_local/回診3個月以上個案名單_2026_07_v2.xlsx` 的「資料異常」分頁。
  不影響本工具，但會影響月報統計。

## 🖥️ 兩台電腦的分工

- **醫院端（`X108521`）**：**補減重維持表單的舊資料在這台做**
- **家裡筆電**：`git clone https://github.com/philia81301-commits/weight-maintain-clinic.git`
  即可改程式碼。雲端的表單／試算表／Apps Script 用瀏覽器操作，不需要本機環境。
  注意 `_local/` 不在版控裡，家裡 clone 下來不會有臨床資料檔（這是刻意的）。

## 📎 相關位置

- 線上工具：<https://philia81301-commits.github.io/weight-maintain-clinic/>
- repo：<https://github.com/philia81301-commits/weight-maintain-clinic>（公開，main 的 root）
- 表單（編輯）：<https://docs.google.com/forms/d/19uUl-kPa90fyVJaUasqjStXSNXUfCeGLyJj_5ZXT-e4/edit>
- 回覆試算表：<https://docs.google.com/spreadsheets/d/1QYUX1yrZmjbbKkhb44i1ZA2D3liKAs0VL0ID_OEy_2E/edit>
- 建置腳本（Apps Script 獨立專案）：
  <https://script.google.com/d/1Y-jx2LivSjo1bF1gXPMi_JMmNkONHA3lsrtusypyz_8B9PZ21PrMnN-z/edit>
- 以上四個雲端檔案都在「我的雲端硬碟／門診工具-正式運作中」
- 參考工具（初診版）：<https://philia81301-commits.github.io/weight-clinic/>

## 🕐 最後更新

2026-08-21 · Claude Fable 5 @ `X108521` · 歷程圖 Y 軸完工（addChart＋onEdit 觸發器，
驗收通過）· Git push：✅ 已推（95c4b2c）
2026-08-19 · Claude Opus 5 · 日期格式統一（見 `docs/google-form-fields.md` 末節）
2026-08-18 · Claude Opus 5 @ `X108521` · Git push：✅ 已推

L3 Obsidian 筆記已建立：
`C:\Users\office\OneDrive\2ndBrain\weight-maintain-clinic\專案工作流程.md`
（決策原因與踩坑細節的完整版在那裡）
