// @ts-nocheck

//■■■■グローバル変数■■■■

//認証用インスタンスの生成
var twitter = TwitterWebService.getInstance(
  'xxxxxx',//API Key
  'xxxxxxxxxxxx'//API secret key
);

//bot設定シートの取得
var SS = SpreadsheetApp.getActiveSpreadsheet();
var CONFIG_SHEET = SS.getSheetByName('主要設定');
var BLACKLIST_SHEET = SS.getSheetByName('ブラックリスト');

//■■■■グローバル変数ここまで■■■■

//■■■■トリガーで呼び出す関数■■■■

// トリガーで呼び出すRTBOT
function rtBot() {
  //自動RT・いいねを行う
  if (CONFIG_SHEET.getRange('B3').getValue()) {
    var searchWord = CONFIG_SHEET.getRange('B4').getValue();
    var rtNum = CONFIG_SHEET.getRange('B5').getValue();
    var sinceId = CONFIG_SHEET.getRange('B6').getValue();
    var lastTweetId = rtAndFaborite(searchWord, rtNum, sinceId, false);
    var updateCell = CONFIG_SHEET.getRange('B6');
    updateCell.setValue(lastTweetId);
    console.log("自動RT・いいねを行いました");
  }

  //画像有のみ自動RT・いいねを行う
  if (CONFIG_SHEET.getRange('B7').getValue()) {
    var searchWord = CONFIG_SHEET.getRange('B8').getValue();
    var rtNum = CONFIG_SHEET.getRange('B9').getValue();
    var sinceId = CONFIG_SHEET.getRange('B10').getValue();
    var lastTweetId = rtAndFaborite(searchWord, rtNum, sinceId, true);
    var updateCell = CONFIG_SHEET.getRange('B10');
    updateCell.setValue(lastTweetId);
    console.log("画像有のみ自動RT・いいねを行いました");
  }

  //既存トリガーを削除する
  deleteTriggers("rtBot");

  //設定シートから時刻関連の数値を取得し、次のトリガーを作成する
  var startH = CONFIG_SHEET.getRange('B11').getValue();
  var startM = CONFIG_SHEET.getRange('B12').getValue();
  var finH = CONFIG_SHEET.getRange('B13').getValue();
  var finM = CONFIG_SHEET.getRange('B14').getValue();
  var intarvalM = CONFIG_SHEET.getRange('B15').getValue();
  createTriggerWithInterval('rtBot', intarvalM, startH, startM, finH, finM);
}

// トリガーで呼び出す定期ツイートBOT
function mediaTweetBot1() {
  // 起動チェックされていたらツイート投稿して画像移動を行う
  if (CONFIG_SHEET.getRange('F3').getValue()) {
    var tweetText = CONFIG_SHEET.getRange('F4').getValue();
    var fromFolderId = CONFIG_SHEET.getRange('F5').getValue();
    var toFolderId = CONFIG_SHEET.getRange('F6').getValue();
    mediaTweetAndFileMove(tweetText, fromFolderId, toFolderId);
  }

  //既存トリガーを削除する
  deleteTriggers("mediaTweetBot1");

  //設定シートから時刻関連の数値を取得し、次のトリガーを作成する
  var tweetH = CONFIG_SHEET.getRange('F7').getValue();
  var tweetM = CONFIG_SHEET.getRange('F8').getValue();
  var nextDate = createTrigger("mediaTweetBot1", tweetH, tweetM);
}

// トリガーで呼び出す定期セルフRTBOT
function selfRTBot () {
  if (CONFIG_SHEET.getRange('J3').getValue()) {
    var id = CONFIG_SHEET.getRange('J4').getValue();
    postUnRetweet(id);
    Utilities.sleep(1000); //RT解除・RTの間に1秒間挟む
    postRetweet(id);
  }

  //既存トリガーを削除する
  deleteTriggers("selfRTBot");

  //設定シートから時刻関連の数値を取得し、次のトリガーを作成する
  var correntNum = CONFIG_SHEET.getRange('J5').getValue();

  var tweetH;
  var tweetM;
  var updateCell = CONFIG_SHEET.getRange('J5');
  if (correntNum == 1) {
    tweetH = CONFIG_SHEET.getRange('J8').getValue();
    tweetM = CONFIG_SHEET.getRange('J9').getValue();
    updateCell.setValue(2);
  } else if (correntNum == 2) {
    tweetH = CONFIG_SHEET.getRange('J10').getValue();
    tweetM = CONFIG_SHEET.getRange('J11').getValue();
    updateCell.setValue(3);
  } else {
    tweetH = CONFIG_SHEET.getRange('J6').getValue();
    tweetM = CONFIG_SHEET.getRange('J7').getValue();
    updateCell.setValue(1);
  }

  var nextDate = createTrigger("selfRTBot", tweetH, tweetM);

  console.log("トリガーの時間を変更しました。次回起動時刻:" + nextDate);
}

//■■■■トリガーで呼び出す関数ここまで■■■■



//■■■■以下、部品

// 設定シートに基づきツイートを検索し、RT・いいねを行う
// 画像・動画付きのみRTする場合はonlyMedia=true
// 戻り値：最後にRT・いいねのチェックを行ったツイートのID
function rtAndFaborite(searchWord, rtNum, sinceId, onlyMedia) {
  var tweetList = searchTweets(searchWord, rtNum, sinceId);
  console.log("検索hit数:" + tweetList.length);

  var rtCount = 0;
  
  //複数件ツイートを取得されるので for を使って1つずつツイートを取り出し いいね or RT をする
  for (var i = 0, len = tweetList.length; i < len; i++ ) {
    var tweetId = tweetList[i].id_str;
    // 最新のツイートのIDを取る
    if (tweetId > sinceId) {
      sinceId = tweetId;
    }

    var status = getTweetStatus(tweetId);

    // onlyMedia=trueかつ画像付きツイートでなければRT・いいねを行わない
    if (onlyMedia && (status.entities.media == null || status.entities.media.length == 0)) {
      continue;
    }

    // 他の人へのリプライであればRT・いいねを行わない
    if (status.in_reply_to_screen_name != null) {
      continue;
    }

    // ブラックリスト対象であればRT・いいねを行わない
    if(!isAllowed(status)) {
      continue;
    }

    // RT・いいねされていないものに対してRT・いいねを行う
    console.log("ツイートID:" + tweetId　
      + "<br>ユーザー名:" + status.user.screen_name 
      + "<br>text:" + status.text);
    
    if (!status.retweeted) { 
      postRetweet (tweetId);
      console.log("上記ツイートをRTしました");
    }
    if (!status.favorited) {
      postFavorite (tweetId);
      console.log("上記ツイートをいいねしました");
    }
    rtCount++;
  }

  console.log("RT・いいね対象数（RT・いいねできなかった場合もカウント）:" + rtCount);
  return sinceId;
}

//ツイートを検索する
function searchTweets(searchWord, rtNum, sinceId) {
  var service = twitter.getService();
  var json = service.fetch("https://api.twitter.com/1.1/search/tweets.json?"
    +"q="+encodeURIComponent(searchWord)+"&count="+rtNum+"&result_type=recent&since_id="+sinceId);
  var result = JSON.parse(json);
  return result.statuses;　//テキストデータがstatusesの中に入っているので一度取り出しが必要（これをしないとmapが使えない）
}

// ツイートのステータスを取得する
function getTweetStatus (id) {
  var service  = twitter.getService();
  var response = service.fetch('https://api.twitter.com/1.1/statuses/lookup.json?id=' + id);
  var result = JSON.parse(response)
  return result[0];
}

// RTする
function postRetweet (id) {
  var service  = twitter.getService();
  var response = service.fetch('https://api.twitter.com/1.1/statuses/retweet/' + id +'.json', {
    method: 'post'
  });
}

// いいねする
function postFavorite (id) {
  var service  = twitter.getService();
  var response = service.fetch('https://api.twitter.com/1.1/favorites/create.json', {
    method: 'post',
    payload: { id: id }
  });
}

// ブラックリストを見てRT・いいねしていいツイートかどうか判断する
function isAllowed (status) {
  var user = status.user.screen_name;
  var userBlackList = BLACKLIST_SHEET.getRange('A:A').getValues();
  for (var i = 1, len = userBlackList.length; i < len; i++ ) { //先頭行は見出しなので2行目から見る
    if(userBlackList[i] == "") {
      break;
    }
    if(userBlackList[i] == user) {
      return false;
    }
  }

  var id = status.id;
  var idBlackList = BLACKLIST_SHEET.getRange('B:B').getValues();
  for (var i = 1, len = userBlackList.length; i < len; i++ ) { //先頭行は見出しなので2行目から見る
    if(idBlackList[i] == "") {
      break;
    }
    if(idBlackList[i] == id) {
      return false;
    }
  }

  var text = status.text;
  var wordBlackList = BLACKLIST_SHEET.getRange('C:C').getValues();
  for (var i = 1, len = userBlackList.length; i < len; i++ ) { //先頭行は見出しなので2行目から見る
    if(wordBlackList[i] == "") {
      break;
    }
    if(text.indexOf(wordBlackList[i]) != -1) {
      return false;
    }
  }

  return true;
}

// 稼働間隔後のトリガーを作成する
function createTriggerWithInterval (funcName, intarvalM, startH, startM, finH, finM) {
  var nextDate = getNextDate(intarvalM, startH, startM, finH, finM);
  ScriptApp.newTrigger(funcName).timeBased().at(nextDate).create();
  console.log("トリガーの時間を変更しました。次回起動時刻:" + nextDate);
}

// 稼働間隔後の時刻を算出する。終了時刻を過ぎている場合は開始時刻を返す
function getNextDate(intarvalM, startH, startM, finH, finM) {
  //同じ日付になるように現在時刻+稼働間隔、開始時刻、終了時刻を算出する
  var date = new Date();
  date.setMinutes(date.getMinutes() + intarvalM);

  startDate = new Date();
  startDate.setMinutes(startDate.getMinutes() + intarvalM);
  startDate.setHours(startH);
  startDate.setMinutes(startM);

  finDate = new Date();
  finDate.setMinutes(finDate.getMinutes() + intarvalM);
  finDate.setHours(finH);
  finDate.setMinutes(finM);

  // 開始時刻 = 終了時刻の場合は無条件で稼働間隔後の時刻を返す
	if (startDate == finDate) {
		return date;
	}

	// 開始時間 < 停止時間
	if (startDate < finDate) {
    // 開始時間～停止時間の場合は稼働間隔後の時刻を返す
	  if (startDate < date && date < finDate) {
      return date;
    }
    // 日付が変わっていなければ翌日の開始時間を返す
    if (startDate < date) {
      startDate.setDate(startDate.getDate() + 1);
    }
    return startDate;
	}

	// 停止時間 < 開始時間（RT停止時間が日付変わった後）
  // ～停止時間、開始時間～の場合は稼働間隔後の時刻を返す
	if (date < finDate || startDate < date) {
    return date;
  }
  return startDate;
}

// 画像投稿・画像付きツイートを行った後、フォルダ移動を行う
// 画像が取得できない場合は何もせずreturn
function mediaTweetAndFileMove(tweetText, fromFolderId, toFolderId) {
  var folderFrom = DriveApp.getFolderById(fromFolderId);
  var files = folderFrom.getFiles();

  // 古い画像から使うためイテレータを無駄に回す（）
  var file;
  while(files.hasNext()) {
    file = files.next();
  };
  if (file == null) {
    return;
  }

  var fileBase64 = Utilities.base64Encode(file.getBlob().getBytes());//Blobを経由してBase64に変換
  var mediaIds = [];
  mediaIds[0] = postMedia(fileBase64);
  postTweetWithMedia(tweetText, mediaIds);

  //使用したファイルを移動する
  var toFolder = DriveApp.getFolderById(toFolderId);
  file.moveTo(toFolder);
}

// 画像付きツイートする。
// もしかしたらmediaIds空っぽなら画像無しツイートになるかも（未確認）
function postTweetWithMedia(text, mediaIds) {
  var service = twitter.getService();
  var json = service.fetch('https://api.twitter.com/1.1/statuses/update.json', {
    method: 'post',
    payload: {
      status: text,
      media_ids : mediaIds.join(',')
    }
  });

  console.log("次の内容でツイートしました:" + text + "(画像ID:" + mediaIds);
}

// 画像を投稿する
function postMedia(fileBase64) {
  var service = twitter.getService();
  var json = service.fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'post',
    payload: {
      media_data : fileBase64
    }
  });
  
  return JSON.parse(json).media_id_string;
}

// RTを解除する
function postUnRetweet (id) {
  var service  = twitter.getService();
  var response = service.fetch('https://api.twitter.com/1.1/statuses/unretweet/' + id +'.json', {
    method: 'post'
  });
}

// 指定した関数名のトリガーを全削除する
function deleteTriggers(funcName) {
  var triggers = ScriptApp.getProjectTriggers();
  for(var i = 0, len = triggers.length; i < len; i++){
    if(triggers[i].getHandlerFunction() == funcName){
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// 指定した関数名・時間のトリガーを作成する。
function createTrigger(funcName, h, m) {
  var today = new Date();
  var nextDate = new Date();
  nextDate.setHours(h);
  nextDate.setMinutes(m);
  if (nextDate <= today) { //次の設定時刻が過去だったら1日後の日付に設定する
    nextDate.setDate(nextDate.getDate() + 1);
  }
  ScriptApp.newTrigger(funcName).timeBased().at(nextDate).create();
  console.log("トリガーの時間を変更しました。次回起動時刻:" + nextDate);

  return nextDate;
}

//■■■■以下、認証系の関数■■■■

//アプリを連携認証する
function authorize() {
  twitter.authorize();
}
 
//認証を解除する
function reset() {
  twitter.reset();
}
 
//認証後のコールバック
function authCallback(request) {
  return twitter.authCallback(request);
}
