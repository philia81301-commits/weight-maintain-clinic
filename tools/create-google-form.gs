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

    // --- 身體測量 ---
    { key: 'weight',     type: 'text',     title: '體重(kg)' },
    { key: 'height',     type: 'text',     title: '身高(cm)' },
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
  var respName = findResponseSheet(ss).getName();

  buildHistorySheet(ss, respName);
  buildSummarySheet(ss, respName);
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

/** 個案歷程：輸入姓名＋出生年，列出該人每次回診與體重變化，附折線圖。 */
function buildHistorySheet(ss, respName) {
  var sh = ss.insertSheet('個案歷程');
  var R = "'" + respName + "'!";
  var LAST = 105; // 最多顯示 100 次回診

  sh.getRange('A1').setValue('個案歷程查詢').setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setValue('姓名');
  sh.getRange('A3').setValue('西元出生年');
  sh.getRange('A2:A3').setFontWeight('bold');
  sh.getRange('B2:B3').setBackground('#fff2cc').setBorder(true, true, true, true, false, false);
  sh.getRange('D2').setValue('← 在黃色格子填入要查的個案（出生年用來區分同名不同人）')
    .setFontColor('#888');

  var headers = ['回診日期', '體重(kg)', '腰圍(cm)', 'BMI分級', '目前用藥', '藥物劑量',
                 '與前次差(kg)', '與首次差(kg)', '累積減重(%)'];
  sh.getRange(5, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#d9e2f3');

  // 原始資料：依姓名＋出生年篩出、按日期升冪
  sh.getRange('A6').setFormula(
    '=IF($B$2="","",IFERROR(SORT(FILTER({' +
      R + 'A2:A,' + R + 'D2:D,' + R + 'G2:G,' + R + 'F2:F,' + R + 'N2:N,' + R + 'O2:O},' +
      'TRIM(' + R + 'B2:B)=TRIM($B$2),' +
      'TRIM(' + R + 'C2:C)&""=TRIM($B$3)&""' +
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
function buildSummarySheet(ss, respName) {
  var sh = ss.insertSheet('個案總表');
  var R = "'" + respName + "'!";
  var LAST = 400;

  var headers = ['姓名', '西元出生年', '回診次數', '首次日期', '最新日期',
                 '首次體重(kg)', '最新體重(kg)', '總變化(kg)', '累積減重(%)'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#d9e2f3');

  // label 全部設成 '' 才不會多出一列 QUERY 自動表頭
  sh.getRange('A2').setFormula(
    '=IFERROR(QUERY(' + R + 'A2:O,' +
    '"select Col2, Col3, count(Col1), min(Col1), max(Col1) ' +
    'where Col2 is not null group by Col2, Col3 order by max(Col1) desc ' +
    "label Col2 '', Col3 '', count(Col1) '', min(Col1) '', max(Col1) ''\"" +
    '),"")'
  );

  // 首次／最新體重用 SORT+INDEX 取，不用時間戳記字串比對（datetime 比對容易踩精度問題）
  var pick = function (asc) {
    return '=IF($A2="","",IFERROR(INDEX(SORT(FILTER({' + R + '$A$2:$A,' + R + '$D$2:$D},' +
      'TRIM(' + R + '$B$2:$B)=TRIM($A2),' +
      'TRIM(' + R + '$C$2:$C)&""=TRIM($B2)&""' +
      '),1,' + asc + '),1,2),""))';
  };
  sh.getRange('F2').setFormula(pick('TRUE'));
  sh.getRange('G2').setFormula(pick('FALSE'));
  sh.getRange('H2').setFormula('=IF(OR($A2="",$F2="",$G2=""),"",$G2-$F2)');
  sh.getRange('I2').setFormula('=IF(OR($A2="",$F2="",$F2=0),"",($F2-$G2)/$F2)');
  sh.getRange('F2:I2').copyTo(sh.getRange(3, 6, LAST - 2, 4));

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
  var respName = findResponseSheet(ss).getName();
  Logger.log('偵測到的回應分頁名稱：「' + respName + '」');

  ['個案歷程', '個案總表'].forEach(function (n) {
    var old = ss.getSheetByName(n);
    if (old) ss.deleteSheet(old);
  });
  buildHistorySheet(ss, respName);
  buildSummarySheet(ss, respName);
  removeDefaultSheet(ss, respName);
  Logger.log('修復完成。分頁現況：' + ss.getSheets().map(function(s){return s.getName();}).join('、'));
}
