/**
 * 建立「*體重維持紀錄」Google 表單 + 回覆試算表（含個案歷程／個案總表）
 * ---------------------------------------------------------------------------
 * 使用方式：
 *   1. 開 https://script.google.com → 新增專案 → 把本檔全部內容貼進 Code.gs
 *   2. 上方函式選 buildAll → 執行。第一次會要求授權（Forms / Sheets / Drive）
 *   3. 跑完後看「執行紀錄」（Ctrl+Enter），把最後印出的 ENTRY 區塊整段複製回來
 *      貼進 index.html 的 ENTRY 常數
 *
 * 設計決策（會影響資料正確性，改動前請先看完）：
 *
 *   [單一區段] 全部題目放同一頁、不做分支跳頁。
 *     減重門診那份表單有 6 個區段，Google 只採計 pageHistory 宣告「走過」的區段答案，
 *     其餘靜默丟棄，2026-07 曾造成資料截斷。單一區段就完全不需要 pageHistory。
 *
 *   [全部題目不設必填] Google 表單的必填是伺服器端驗證：背景 no-cors 送出時只要缺一項，
 *     整筆被拒收，而前端讀不到拒絕回應 → 看起來送出成功、實際什麼都沒留下。
 *     故必填一律改在輸入工具前端擋。最壞情況是收到一筆欄位不全的紀錄（看得見、可補），
 *     而不是整筆無聲蒸發。
 *
 *   [運動細項不分支] 每週頻率／每次時間／運動類型都加一個「無」選項，
 *     沒運動習慣時由工具自動填「無」，避免為了分支而分頁。
 *
 *   [個案鍵＝姓名＋西元出生年] 資料庫 771 筆個案裡有 3 組真的同名不同人，
 *     純用姓名會把不同人的歷程合併。
 */

var FOLDER_ID  = '18xqn4hGq4fIZ06-jzm7MZRx3FdFZACoc'; // 我的雲端硬碟 / 門診工具-正式運作中
var FORM_TITLE  = '*體重維持紀錄';
var SHEET_TITLE = '*體重維持紀錄 (回覆)';

/** 題目定義。順序＝回覆試算表的欄位順序（A 為時間戳記，故本表第 n 項為第 n+1 欄）。 */
function itemSpecs() {
  return [
    // --- 基本資料 ---
    { key: 'name',       type: 'text',     title: '姓名' },
    { key: 'birthYear',  type: 'text',     title: '西元出生年' },
    { key: 'visitDate',  type: 'date',     title: '回診日期' },

    // --- 身體測量 ---
    { key: 'height',     type: 'text',     title: '身高(cm)' },
    { key: 'weight',     type: 'text',     title: '體重(kg)' },
    { key: 'bmiGrade',   type: 'radio',    title: 'BMI分級',
      choices: ['小於24但腰圍超標', '24-27', '27-30', '30-35', '大於35'] },
    { key: 'waist',      type: 'text',     title: '腰圍(cm)' },
    { key: 'weightTrend', type: 'radio',   title: '與前次相比體重變化',
      choices: ['下降', '無變化', '上升'] },

    // --- 飲食習慣 ---
    { key: 'diet',       type: 'checkbox', title: '飲食習慣',
      choices: ['外食居多', '含糖飲料', '偏好肉類', '偏好飯、麵食類',
                '甜點、餅乾類', '宵夜', '經常飲酒', '其他'] },

    // --- 運動 ---
    { key: 'exercise',   type: 'radio',    title: '運動頻率', choices: ['無', '有'] },
    { key: 'exFreq',     type: 'radio',    title: '每週運動頻率',
      choices: ['1-3次', '3-5次', '每天', '假日', '無'] },
    { key: 'exDuration', type: 'radio',    title: '每次運動時間',
      choices: ['30分鐘以內', '30至60分鐘', '60分鐘以上', '無'] },
    { key: 'exType',     type: 'checkbox', title: '運動類型',
      choices: ['走路', '快走', '慢跑', '重訓', '瑜珈', '球類',
                '腳踏車', '游泳', '核心訓練', '其他', '無'] },

    // --- 用藥 ---
    { key: 'drug',       type: 'radio',    title: '目前用藥',
      choices: ['無用藥／生活型態', 'Mounjaro', 'Ozempic', 'Wegovy', 'Saxenda',
                'Rybelsus', 'Contrave', 'Xenical', 'Jardiance', 'Acarbose',
                '併用／轉換兩種'] },
    { key: 'dose',       type: 'text',     title: '藥物劑量' }
  ];
}

function buildAll() {
  var form = FormApp.create(FORM_TITLE);
  form.setDescription('減重維持期回診紀錄。由「減重維持輸入工具」自動送出，'
    + '亦可手動填寫。個案歷程以「姓名＋西元出生年」合併。');

  form.setCollectEmail(false);          // 不收 email：門診同一台裝置連續填多位個案
  form.setLimitOneResponsePerUser(false); // 同一人可多次回診，必須允許重複提交
  form.setAllowResponseEdits(false);
  form.setProgressBar(false);
  form.setShowLinkToRespondAgain(true);

  var specs = itemSpecs();
  specs.forEach(function (spec) {
    var item;
    if (spec.type === 'text') {
      item = form.addTextItem();
    } else if (spec.type === 'radio') {
      item = form.addMultipleChoiceItem();
      item.setChoiceValues(spec.choices);
    } else if (spec.type === 'checkbox') {
      item = form.addCheckboxItem();
      item.setChoiceValues(spec.choices);
    } else if (spec.type === 'date') {
      item = form.addDateItem();
      item.setIncludesYear(true);
    }
    item.setTitle(spec.title);
    item.setRequired(false); // 見檔頭 [全部題目不設必填]
  });

  // ---- 回覆試算表 ----
  var ss = SpreadsheetApp.create(SHEET_TITLE);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  // setDestination 之後才會出現回應分頁，重新開檔才抓得到
  ss = SpreadsheetApp.openById(ss.getId());
  var respSheet = findResponseSheet(ss);
  var respName = respSheet.getName();
  var C = colMap(respSheet);

  buildHistorySheet(ss, respName, C);
  buildSummarySheet(ss, respName, C);
  removeDefaultSheet(ss, respName);

  // ---- 搬進「門診工具-正式運作中」----
  try {
    var folder = DriveApp.getFolderById(FOLDER_ID);
    DriveApp.getFileById(form.getId()).moveTo(folder);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  } catch (e) {
    Logger.log('！搬移資料夾失敗（檔案留在我的雲端硬碟根目錄，手動拖進去即可）：' + e.message);
  }

  // ---- 印出 entry ID ----
  var pub = form.getPublishedUrl();                  // .../forms/d/e/1FAIpQL.../viewform
  var m = pub.match(/\/forms\/d\/e\/([^\/]+)\//);
  var publishedId = m ? m[1] : '（解析失敗，請從表單「傳送」→ 連結網址取得）';

  var ids = entryIds(form);

  Logger.log('==================== 建立完成 ====================');
  Logger.log('表單編輯：' + form.getEditUrl());
  Logger.log('表單填寫：' + pub);
  Logger.log('回覆試算表：' + ss.getUrl());
  Logger.log('回應分頁名稱：' + respName);
  Logger.log('');
  Logger.log('---------- 以下整段貼進 index.html ----------');
  Logger.log("const FORM_ID = '" + publishedId + "';");
  Logger.log('const ENTRY = {');
  specs.forEach(function (spec, i) {
    var id = ids[i] || 'NOT_FOUND';
    Logger.log("  " + spec.key + ": 'entry." + id + "',   // " + spec.title);
  });
  Logger.log('};');
  Logger.log('--------------------------------------------');
}

/**
 * 取每一題的 entry ID。
 * FormApp 沒有直接提供 entry ID：item.getId() 是內部 ID，不是送出用的 entry.N。
 * 唯一可靠做法是為每一題單獨造一筆「只填這題」的預填連結，再從網址把 entry.N 抓出來。
 */
function entryIds(form) {
  return form.getItems().map(function (item) {
    var t = item.getType(), resp = null;
    try {
      if (t === FormApp.ItemType.TEXT) {
        resp = item.asTextItem().createResponse('x');
      } else if (t === FormApp.ItemType.MULTIPLE_CHOICE) {
        resp = item.asMultipleChoiceItem()
                   .createResponse(item.asMultipleChoiceItem().getChoices()[0].getValue());
      } else if (t === FormApp.ItemType.CHECKBOX) {
        resp = item.asCheckboxItem()
                   .createResponse([item.asCheckboxItem().getChoices()[0].getValue()]);
      } else if (t === FormApp.ItemType.DATE) {
        resp = item.asDateItem().createResponse(new Date(2026, 7, 18));
      }
    } catch (e) {
      resp = null;
    }
    if (!resp) return null;
    // withItemResponse 回傳新物件，不是就地修改——沒接回傳值會拿到空的預填網址
    var fr = form.createResponse().withItemResponse(resp);
    var found = fr.toPrefilledUrl().match(/entry\.(\d+)/);
    return found ? found[1] : null;
  });
}

/**
 * 依表頭文字解析欄位位置，回傳 {題目: 欄號(1-based)}。
 * 公式一律透過這張表產生，不寫死欄位字母——表單題目順序調整時才不會整排錯位
 * （2026-08-18 把身高調到體重之前時導入）。
 */
function colMap(respSheet) {
  var headers = respSheet.getRange(1, 1, 1, respSheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    var name = String(h).trim();
    if (name) map[name] = i + 1;
  });
  return map;
}

/** 欄號轉欄位字母（1 → A、27 → AA）。 */
function colLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

/** 從欄位對照表取欄號，找不到就明確報錯，不要讓公式默默指到錯的欄。 */
function need(C, title) {
  if (!C[title]) {
    throw new Error('回應分頁找不到欄位「' + title + '」。目前表頭：' + Object.keys(C).join('、'));
  }
  return C[title];
}

/** 時間戳記欄的標題會隨試算表語系不同（英文 Timestamp／中文 時間戳記）。 */
function tsCol(C) {
  return C['Timestamp'] || C['時間戳記'] || 1;
}

/**
 * 回診日期的取值運算式。
 * 優先用「回診日期」欄（人工填的實際回診日），該欄空白才退回 Timestamp（送出時間）。
 * 補舊資料時全部都是同一天送出，只看 Timestamp 會讓歷程變成一條垂直線。
 */
function dateExpr(R, C, abs) {
  var d = function (L) { return abs ? (R + '$' + L + '$2:$' + L) : (R + L + '2:' + L); };
  var TS = d(colLetter(tsCol(C)));
  if (!C['回診日期']) return TS;
  var DT = d(colLetter(C['回診日期']));
  return 'IF(' + DT + '="",' + TS + ',' + DT + ')';
}

/** 個案歷程：輸入姓名＋出生年，列出該人每次回診與體重變化，附折線圖。 */
function buildHistorySheet(ss, respName, C) {
  var sh = ss.insertSheet('個案歷程');
  var R = "'" + respName + "'!";
  var LAST = 105; // 最多顯示 100 次回診

  var col = function (title) { return colLetter(need(C, title)); };
  var NAME  = col('姓名'),      BY    = col('西元出生年');
  var WT    = col('體重(kg)'),  WAIST = col('腰圍(cm)'), GRADE = col('BMI分級');
  var DRUG  = col('目前用藥'),  DOSE  = col('藥物劑量');
  var rng = function (L) { return R + L + '2:' + L; };
  var DATE = dateExpr(R, C, false);

  sh.getRange('A1').setValue('個案歷程查詢').setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setValue('姓名');
  sh.getRange('A3').setValue('西元出生年');
  sh.getRange('A2:A3').setFontWeight('bold');
  sh.getRange('B2:B3').setBackground('#fff2cc').setBorder(true, true, true, true, false, false);
  sh.getRange('D2').setValue('← 在黃色格子填入要查的個案（出生年用來區分同名不同人）')
    .setFontColor('#888');
  sh.getRange('D3').setValue('日期以「回診日期」欄為準，該欄空白才退用送出時間')
    .setFontColor('#888');

  var headers = ['回診日期', '體重(kg)', '腰圍(cm)', 'BMI分級', '目前用藥', '藥物劑量',
                 '與前次差(kg)', '與首次差(kg)', '累積減重(%)'];
  sh.getRange(5, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#d9e2f3');

  sh.getRange('A6').setFormula(
    '=IF($B$2="","",IFERROR(SORT(FILTER({' +
      DATE + ',' + rng(WT) + ',' + rng(WAIST) + ',' +
      rng(GRADE) + ',' + rng(DRUG) + ',' + rng(DOSE) + '},' +
      'TRIM(' + rng(NAME) + ')=TRIM($B$2),' +
      'TRIM(' + rng(BY) + ')&""=TRIM($B$3)&""' +
    '),1,TRUE),""))'
  );

  // 第一次回診沒有「前次」與「首次差」，標 —
  sh.getRange('G6').setFormula('=IF($A6="","","—")');
  sh.getRange('H6').setFormula('=IF($A6="","","—")');
  sh.getRange('I6').setFormula('=IF($A6="","","—")');

  // 第二次之後逐列計算
  sh.getRange('G7').setFormula('=IF(OR($A7="",$A6=""),"",$B7-$B6)');
  sh.getRange('H7').setFormula('=IF(OR($A7="",$B$6=""),"",$B7-$B$6)');
  sh.getRange('I7').setFormula('=IF(OR($A7="",$B$6=""),"",($B$6-$B7)/$B$6)');
  sh.getRange('G7:I7').copyTo(sh.getRange(8, 7, LAST - 7, 3));

  sh.getRange(6, 1, LAST - 5, 1).setNumberFormat('yyyy/mm/dd');
  sh.getRange(6, 2, LAST - 5, 2).setNumberFormat('0.0');
  sh.getRange(6, 7, LAST - 5, 2).setNumberFormat('+0.0;-0.0;0.0');
  sh.getRange(6, 9, LAST - 5, 1).setNumberFormat('0.0%');
  sh.setColumnWidth(1, 110);
  sh.setFrozenRows(5);

  var chart = sh.newChart()
    .asLineChart()
    .addRange(sh.getRange(5, 1, LAST - 4, 2))
    .setPosition(2, 6, 0, 0)
    .setOption('title', '體重變化歷程')
    .setOption('legend', { position: 'none' })
    .setOption('width', 520)
    .setOption('height', 300)
    .setOption('pointSize', 5)
    .build();
  sh.insertChart(chart);
}

/** 個案總表：每人一列，首次／最新體重、總變化、回診次數。 */
function buildSummarySheet(ss, respName, C) {
  var sh = ss.insertSheet('個案總表');
  var R = "'" + respName + "'!";
  var LAST = 400;

  var TS   = tsCol(C);
  var NAME = need(C, '姓名'), BY = need(C, '西元出生年'), WT = need(C, '體重(kg)');
  var lastLetter = colLetter(Object.keys(C).length);

  var headers = ['姓名', '西元出生年', '回診次數', '首次日期', '最新日期',
                 '首次體重(kg)', '最新體重(kg)', '總變化(kg)', '累積減重(%)'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#d9e2f3');

  // QUERY 只負責分組與計數（QUERY 無法在欄位上套 IF，故日期改用下方陣列公式取）
  // label 全部設成 '' 才不會多出一列 QUERY 自動表頭
  sh.getRange('A2').setFormula(
    '=IFERROR(QUERY(' + R + 'A2:' + lastLetter + ',' +
    '"select Col' + NAME + ', Col' + BY + ', count(Col' + TS + ') ' +
    'where Col' + NAME + ' is not null group by Col' + NAME + ', Col' + BY + ' ' +
    'order by max(Col' + TS + ') desc ' +
    "label Col" + NAME + " '', Col" + BY + " '', count(Col" + TS + ") ''\"" +
    '),"")'
  );

  // 首次／最新的日期與體重：依「回診日期」排序後取頭尾
  // 不用 QUERY 的 min/max：那是 Timestamp（送出時間），補舊資料時會全部變成今天
  var DATE = dateExpr(R, C, true);
  var A = function (L) { return R + '$' + L + '$2:$' + L; };
  var pick = function (asc, second) {
    return '=IF($A2="","",IFERROR(INDEX(SORT(FILTER({' + DATE + ',' + second + '},' +
      'TRIM(' + A(colLetter(NAME)) + ')=TRIM($A2),' +
      'TRIM(' + A(colLetter(BY)) + ')&""=TRIM($B2)&""' +
      '),1,' + asc + '),1,2),""))';
  };
  sh.getRange('D2').setFormula(pick('TRUE',  DATE));            // 首次日期
  sh.getRange('E2').setFormula(pick('FALSE', DATE));            // 最新日期
  sh.getRange('F2').setFormula(pick('TRUE',  A(colLetter(WT)))); // 首次體重
  sh.getRange('G2').setFormula(pick('FALSE', A(colLetter(WT)))); // 最新體重
  sh.getRange('H2').setFormula('=IF(OR($A2="",$F2="",$G2=""),"",$G2-$F2)');
  sh.getRange('I2').setFormula('=IF(OR($A2="",$F2="",$F2=0),"",($F2-$G2)/$F2)');
  sh.getRange('D2:I2').copyTo(sh.getRange(3, 4, LAST - 2, 6));

  sh.getRange(2, 4, LAST - 1, 2).setNumberFormat('yyyy/mm/dd');
  sh.getRange(2, 6, LAST - 1, 3).setNumberFormat('0.0');
  sh.getRange(2, 9, LAST - 1, 1).setNumberFormat('0.0%');
  sh.setFrozenRows(1);
}

/**
 * 找出「表單回應」分頁。
 * 不可以用 ss.getSheets()[0]：SpreadsheetApp.create() 會先建一張預設空白表，
 * setDestination() 才另外加上回應分頁，索引 0 很可能是那張空白表——
 * 公式若指向它，個案歷程／個案總表會全部空白且不報錯（2026-08-18 實際踩到）。
 * getFormUrl() 只有連結表單的分頁才會回傳網址，這是唯一可靠的判別方式。
 */
function findResponseSheet(ss) {
  var hit = ss.getSheets().filter(function (sh) { return !!sh.getFormUrl(); });
  if (!hit.length) throw new Error('找不到表單回應分頁（沒有任何分頁連結到表單）');
  return hit[0];
}

/** 移除 SpreadsheetApp.create() 留下的預設空白分頁，避免日後誤認。 */
function removeDefaultSheet(ss, respName) {
  var keep = [respName, '個案歷程', '個案總表'];
  ss.getSheets().forEach(function (sh) {
    if (keep.indexOf(sh.getName()) === -1 && sh.getLastRow() === 0 && sh.getLastColumn() === 0) {
      var n = sh.getName();
      ss.deleteSheet(sh);
      Logger.log('已刪除預設空白分頁：' + n);
    }
  });
}

/**
 * 修復已經建好的試算表：重建個案歷程／個案總表，指向正確的回應分頁。
 * SS_ID 已填好本專案的回覆試算表，直接執行 repair() 即可。
 */
function repair() {
  var SS_ID = '1QYUX1yrZmjbbKkhb44i1ZA2D3liKAs0VL0ID_OEy_2E';
  var ss = SpreadsheetApp.openById(SS_ID);
  var respSheet = findResponseSheet(ss);
  var respName = respSheet.getName();
  var C = colMap(respSheet);
  Logger.log('偵測到的回應分頁名稱：「' + respName + '」');
  Logger.log('欄位對照：' + JSON.stringify(C));

  ['個案歷程', '個案總表'].forEach(function (n) {
    var old = ss.getSheetByName(n);
    if (old) ss.deleteSheet(old);
  });
  buildHistorySheet(ss, respName, C);
  buildSummarySheet(ss, respName, C);
  removeDefaultSheet(ss, respName);
  Logger.log('修復完成。分頁現況：' + ss.getSheets().map(function(s){return s.getName();}).join('、'));
}

/**
 * 調整既有表單的題目順序：把「身高(cm)」移到「體重(kg)」之前，並重建兩張分析分頁。
 * 表單題目順序會連動回應分頁的欄位順序，故重建時一律重新解析表頭（colMap），
 * 不假設欄位落在哪個字母。
 *
 * 執行前務必確認回應分頁沒有重要資料——這支會刪掉並重建個案歷程／個案總表
 * （那兩張是純公式，沒有原始資料，重建不會遺失任何回覆）。
 */
function reorderFields() {
  var FORM_ID_EDIT = '19uUl-kPa90fyVJaUasqjStXSNXUfCeGLyJj_5ZXT-e4';
  var SS_ID        = '1QYUX1yrZmjbbKkhb44i1ZA2D3liKAs0VL0ID_OEy_2E';

  var form = FormApp.openById(FORM_ID_EDIT);
  var items = form.getItems();
  var titles = items.map(function (it) { return it.getTitle(); });
  Logger.log('調整前題目順序：' + titles.join(' → '));

  var hIdx = titles.indexOf('身高(cm)');
  var wIdx = titles.indexOf('體重(kg)');
  if (hIdx === -1 || wIdx === -1) throw new Error('找不到身高或體重題目');

  if (hIdx > wIdx) {
    form.moveItem(items[hIdx], wIdx);
    Logger.log('已把「身高(cm)」從第 ' + (hIdx + 1) + ' 題移到第 ' + (wIdx + 1) + ' 題');
  } else {
    Logger.log('身高已在體重之前，表單不需調整');
  }
  Logger.log('調整後題目順序：' +
    form.getItems().map(function (it) { return it.getTitle(); }).join(' → '));

  // 重建分析分頁：回應分頁的欄位順序可能跟著變，一律重新解析表頭
  var ss = SpreadsheetApp.openById(SS_ID);
  var respSheet = findResponseSheet(ss);
  var respName = respSheet.getName();
  var C = colMap(respSheet);
  Logger.log('回應分頁「' + respName + '」實際欄位順序：');
  Object.keys(C).forEach(function (k) { Logger.log('  ' + colLetter(C[k]) + ' 欄 = ' + k); });

  ['個案歷程', '個案總表'].forEach(function (n) {
    var old = ss.getSheetByName(n);
    if (old) ss.deleteSheet(old);
  });
  buildHistorySheet(ss, respName, C);
  buildSummarySheet(ss, respName, C);
  Logger.log('分析分頁已依實際欄位順序重建完成。');
}

/**
 * 在既有表單加上「回診日期」題，並重建兩張分析分頁。
 *
 * 為什麼需要這題：Google 表單只會記錄「送出時間」。補過去的回診紀錄時全部都是今天送出，
 * 歷程會變成同一天的一堆點，排序、與前次差、折線圖全部失去意義。
 *
 * 日期題的送出參數不是單一 entry.N，本函式會把實際參數名稱印出來，不要用猜的。
 */
function addVisitDateField() {
  var FORM_ID_EDIT = '19uUl-kPa90fyVJaUasqjStXSNXUfCeGLyJj_5ZXT-e4';
  var SS_ID        = '1QYUX1yrZmjbbKkhb44i1ZA2D3liKAs0VL0ID_OEy_2E';

  var form = FormApp.openById(FORM_ID_EDIT);

  var exist = form.getItems().filter(function (it) { return it.getTitle() === '回診日期'; });
  var item;
  if (exist.length) {
    item = exist[0];
    Logger.log('「回診日期」已存在，不重複新增。');
  } else {
    item = form.addDateItem();
    item.setTitle('回診日期').setIncludesYear(true).setRequired(false);
    item.setHelpText('實際回診日期。補舊資料時務必填寫，否則會被當成今天。');
    // 移到「西元出生年」之後，手動填表時順手
    var idx = form.getItems().map(function (it) { return it.getTitle(); }).indexOf('西元出生年');
    if (idx !== -1) form.moveItem(item, idx + 1);
    Logger.log('已新增「回診日期」題。');
  }

  // ---- 印出這題的實際送出參數（日期題會拆成 _year / _month / _day）----
  var resp = form.createResponse()
                 .withItemResponse(item.asDateItem().createResponse(new Date(2026, 7, 18)));
  var url = resp.toPrefilledUrl();
  Logger.log('回診日期題的預填網址：');
  Logger.log(url);
  var q = url.split('?')[1] || '';
  Logger.log('--- 參數逐項（貼這段回來）---');
  q.split('&').forEach(function (kv) {
    if (kv.indexOf('entry.') === 0) Logger.log('  ' + decodeURIComponent(kv));
  });
  Logger.log('-----------------------------');

  Logger.log('表單題目順序：' +
    form.getItems().map(function (it) { return it.getTitle(); }).join(' → '));

  // ---- 重建分析分頁 ----
  var ss = SpreadsheetApp.openById(SS_ID);
  var respSheet = findResponseSheet(ss);
  var respName = respSheet.getName();
  var C = colMap(respSheet);
  Logger.log('回應分頁「' + respName + '」欄位：');
  Object.keys(C).forEach(function (k) { Logger.log('  ' + colLetter(C[k]) + ' 欄 = ' + k); });
  if (!C['回診日期']) {
    Logger.log('！回應分頁還沒出現「回診日期」欄。Google 有時要幾秒才補上表頭，');
    Logger.log('！請等一下再單獨執行 repair() 重建分頁，否則歷程仍會用送出時間。');
  }

  ['個案歷程', '個案總表'].forEach(function (n) {
    var old = ss.getSheetByName(n);
    if (old) ss.deleteSheet(old);
  });
  buildHistorySheet(ss, respName, C);
  buildSummarySheet(ss, respName, C);
  Logger.log('分析分頁重建完成。');
}
