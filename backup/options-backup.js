/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

var BACKUP_FILENAME = "tabsoutlinerbackup.json";

// chrome.runtime.onMessage.addListener(
//     function(msg, sender, sendResponse) {
//         console.log("@@@@", msg, sender)
//         if (msg.request == "message2options_refreshLocalBackupsList") {
//                 listLocalBackups();
//         }
//     }
// );


// DOM Elements Manipulation utils -----------------------------------
function insertAfter(referenceElement, newElement)  {
    referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
}

function getHtmlElementById(elementId) {
    return document.getElementById(elementId);
}

function deleteChildNodes(elementId) {
    var elem = document.getElementById(elementId);
    if(elem) elem.innerHTML = '';
}

function deleteElementFromPage(elementId) {
    var elem = document.getElementById(elementId);
    if(elem) elem.parentNode.removeChild(elem);
}

function createElement(type, atributes) {
    var elem = document.createElement(type);
    for (a in atributes || {})
        elem[a] = atributes[a];
    return elem;
}

function hideHtmlElement(elementId) {
    var elem = getHtmlElementById(elementId);
    if(elem) elem.style.display = 'none';
}

function showHtmlElement(elementId) {
    var elem = getHtmlElementById(elementId);
    if(elem) elem.style.display = null;
}

//if (String.prototype.format) alert("Warning String.prototype.format is already defined and will be replaced now!");
//String.prototype.format = function() {
//    var str = this.toString();
//    if (!arguments.length)
//        return str;
//    var args = typeof arguments[0],
//        args = (("string" == args || "number" == args) ? arguments : arguments[0]);
//    for (arg in args)
//        str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
//    return str;
//};


//--------------------------------------------------------------------

const nullthrows = (v) => {
    if (v == null) throw new Error("it's a null");
    return v;
}

function injectCode(src) {
    const script = document.createElement('script');
    // This is why it works!
    script.src = src;
    script.onload = function() {
        console.log("script injected");
        this.remove();
    };

    // This script runs before the <head> element is created,
    // so we add the script to <html> instead.
    nullthrows(document.head || document.documentElement).appendChild(script);
}
//injectCode(chrome.runtime.getURL('/myscript.js'));

function addGapiScript_setAuthToken_listGdriveFiles() {
    // Тут когдато была кгтешьу загрузка GAPI скрипта с google CDN, после загрузки успешной вызывалось setAuthToken_listGdriveFiles();
    // но в manifest v3 такое больше нельзя, так что будем сами справляться, без GAPI library

    setAuthToken_listGdriveFiles(false);
}

function manualAuth_listGdriveFiles(event) {
    event.target.innerText = "Please Wait For Authorize Popup and grant access..."; //i18n +

    setAuthToken_listGdriveFiles(true);
}


function setAuthToken_listGdriveFiles(interactive) {
    //FF_REMOVED_GA if(interactive) ga_event_access_states('Gdrive Access Request', null, null,'R');

    chrome.identity.getAuthToken({ 'interactive': !!interactive }, function(token) {
        if(token) {
            backgroundport.postMessage({request:"request2bkg_authTokenGranted_notifyAllOpenedViews"}); // Теоретически тут достаточно гасить эти месаги, так как это единственное место где мы можем успешно получить токен после того как он был анулирован или его небыло

            hideAuthorizeGdriveAccessControls();

            async_listGdriveBackups();
            //FF_REMOVED_GA if(interactive) ga_event_access_states('Gdrive Access Granted', null, null,'Y');
        } else {
            console.error("Auth token undefined. chrome.runtime.lastError:", chrome.runtime.lastError);
            // Some examples of possible errors:
            //
            // No connection Before getAuthToken call:
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "OAuth2 request failed: Connection failed (-105)."}
            // Connection lost After PopUp Will be Shown And Before User click Accept:
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "Authorization page could not be loaded."}
            // User press Cancel or Close in Auth PopUp:
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "The user did not approve access."}
            // interactive == false && no permission granted:
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "OAuth2 not granted or revoked."}
            // interactive == false && Chrome Is Not Signed In
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "The user is not signed in."}

            if(interactive) alert("Error: " + chrome.runtime.lastError.message);
            backgroundport.postMessage({request:"request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews"});

            //FF_REMOVED_GA if(interactive) ga_event_access_states('Gdrive Access Declined - ' + chrome.runtime.lastError.message, null, null,'N');
        }
    });
}

function show401Error_showAuthorizeGdriveAccessControls(){
    show401Error();
    showAuthorizeGdriveAccessControls();
    deleteChildNodes("gdriveBackupsListTable");
}

function showAuthorizeGdriveAccessControls() {
    document.getElementById("authorizeButton").innerText = originalAuthorizeButtonText;  // this clears "Please Wait..." after previous possible click
    showHtmlElement("authorizeDiv");
}

function hideAuthorizeGdriveAccessControls() {
    hideHtmlElement("authorizeDiv");
}

function setAuthToken_deleteGdriveBackup(fileId, continueCallback) {
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
        if(token) {
            deleteGdriveBackup(fileId, continueCallback);
        } else {
            console.error("Auth token undefined. chrome.runtime.lastError:", chrome.runtime.lastError); // see examples of possible errors in setAuthToken_listGdriveFiles
            backgroundport.postMessage({request:"request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews"});
        }
    });
}

function deleteGdriveBackup(fileId, continueCallback) {
    // WARNING Перед любой GAPI операцией, если менаджинг токена осуществляется не самой GAPI.auth (тоесть если мы ставим Access Token туда вручную через gapi.auth.setToken,
    // беря его из Identity.API к примеру) надо всегда выполнять повторный gapi.auth.setToken(). Так как у gapi нет Refresh Tokena чтоб получить новый Access Token
    // который возможно уже заэкспайрился, а заэкспайривается он в течении часа!!!!

    // //gapi.client.drive.files["delete"]({ 'fileId': fileId }).execute(continueCallback);
    // gapi.client.request({
    //    'method':'DELETE',
    //    'path':'/drive/v2/files/'+fileId
    // }).execute(continueCallback);

    async_deleteFile(fileId, continueCallback);
}

async function async_getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError || !token) {
            reject(chrome.runtime.lastError);
        } else {
            resolve(token);
        }
        });
    });
}

async function async_deleteFile(fileId, continueCallback) {
    try {
      const token = await async_getAuthToken();
  
      const response = await fetch(`https://www.googleapis.com/drive/v2/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
  
      // Call the continueCallback upon successful deletion
      continueCallback();
  
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
}
  
async function async_listGdriveBackups() {
    try {
        const token = await async_getAuthToken();

        //TODO parents&maxResults=1000 - если файлов больше maxResults то надо вообщето следующую страницу запрашивать используя pageToken, см как тут: https://developers.google.com/drive/v2/reference/files/list
        const response = await fetch('https://www.googleapis.com/drive/v2/files?q=%27appdata%27+in+parents&maxResults=1000', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
        });

        if (!response.ok) {
            if(response.status == 401) {// Access rewoked by user most likely, through own google profile in "Third-party apps & services \ Keep track of your connections"
                backgroundport.postMessage({request:"request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews"});
                console.warning('Failed to fetch files - authorization to access gdrive is not longer valid, need request it again', response);
            }
            if(response.status == 400) {
                //Access to fetch at 'https://www.googleapis.com/upload/drive/v2/files/19nm9R4zXy6AKlnsOD23y4sB5Jde80JCJjkp1LpjhkMUGLg?uploadType=multipart' 
                //from origin 'chrome-extension://fbmpogndmllmikplkccngajcbmaonfif' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' 
                //header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch 
                //the resource with CORS disabled.                
            }            
            console.error('Failed to fetch files:', response);
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        if(!data.items) console.error("ERROR obtainig list of backup files from Gdrive", response);
        renderGdriveBackupsList(data.items);

    } catch (error) {
        console.error('Failed to fetch files:', error);

    }
}

// function listGdriveBackups() {
//     // WARNING Перед любой GAPI операцией, если менаджинг токена осуществляется не самой GAPI.auth (тоесть если мы ставим Access Token туда вручную через gapi.auth.setToken,
//     // беря его из Identity.API к примеру) надо всегда выполнять повторный gapi.auth.setToken(). Так как у gapi нет Refresh Tokena чтоб получить новый Access Token
//     // который возможно уже заэкспайрился, а заэкспайривается он в течении часа!!!!
//     //
//     // Но мы уже не юзаем GAPI от гугла... но комент пусть будет

//     //TODO у нас есть ещё код запроса списков файлов в function listFile() на background. и это не есть хорошо, там код весьма чуствительный к ошибкам рассинхронизации cut & paste
//     //gapi.client.load("drive", "v2", function() {
//         gapi.client.request({
//             'path':'/drive/v2/files',
//             'params':{  'q': "'appdata' in parents",
//                         'maxResults':1000     //TODO если файлов больше maxResults то надо вообщето следующую страницу запрашивать используя pageToken, см как тут: https://developers.google.com/drive/v2/reference/files/list
//                      }
//         }).execute(function(response) {
//             renderGdriveBackupsList(response.items);

//             if(!response.items) console.error("ERROR obtainig list of backup files from Gdrive", response);

//             if(response.error) {
//                 // response content in case of network error:
//                 //response: Object
//                 //    code: -1
//                 //    data: undefined
//                 //    message: "A network error occurred, and the request could not be completed."
//                 //    error: Object
//                 //        code: -1
//                 //        data: undefined
//                 //        message: "A network error occurred, and the request could not be completed."

//                 if(response['error']['code'] == 401) backgroundport.postMessage({request:"request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews"});

//                 //FF_REMOVED_GA ga_event_error('Options - Error Requesting Backups List From Gdrive', response['error'] || response['error']['message']);
//             }
//         });
//     //});
// }

function isTabsOutlinerBackupFile(item) {
    return item['title'].indexOf(BACKUP_FILENAME) >= 0
}
function byTimesaved(o1,o2) {
    return o2['timesaved'] - o1['timesaved']
}

/**
 * @param items - array
 *          every item must contain: {id, title, description, downloadUrl, modifiedDate} //title - filename with extension, description - label
 */
function renderGdriveBackupsList(items) {
    deleteChildNodes("gdriveBackupsListTable");
    deleteElementFromPage("backupNowBtn");

    var itemsListElement = getHtmlElementById("gdriveBackupsListTable");


    if(items) {
        items.forEach(function(dirEntry) {
            dirEntry['timesaved'] = (new Date(dirEntry['modifiedDate'])).getTime();
        });

        items = items.filter( isTabsOutlinerBackupFile )
                     .sort  ( byTimesaved );

        renderItems(items, itemsListElement);
    } else {
        itemsListElement.innerHTML = '<div class="backupsListEntry">Cannot Access Files List</div>'; //i18n +
    }

    insertAfter(getHtmlElementById("gdriveBackupsList"), createBackupNowBtn());
}


function renderItems(items, itemsListElement) {
    for (var i =0; i < items.length; i++) {
        var item = items[i];

        function getMachineLabel(item) {
            var machineLabel;
            try{machineLabel = JSON.parse(item['description'])['machineLabel']}catch(e){}
            return machineLabel ? "[" + machineLabel + "] " : "";
        }
        function getGdriveFileSizeLabel(item) {
           return item['fileSize'] ? " ("+Math.ceil(Number(item['fileSize'])/1024)+" KB)":"";
        }
        function getAutoManualLabel(item) {
            var isManual;
            try{
                return JSON.parse(item['description'])['manual'] ? " manually" : " automatically"; //i18n +
            } catch(e){}

            return "";
        }

        function makeBackupTitle(item) {
            var timesaved = new Date(item['timesaved']);
            var r = getMachineLabel(item) +
                    "Backup"+
                    getGdriveFileSizeLabel(item) +
                    getAutoManualLabel(item) +
                    " saved at " + timesaved.toLocaleTimeString() + ", " + timesaved.toLocaleDateString(); //i18n +
            return r;
        }

        var title = createElement('td', {
            innerText: makeBackupTitle(item)
        });

        var delBtn = createElement('button', {
            type:              "button",
            innerText:         "Delete", //i18n +
            itemId:            item['id'],
            backupItemEntryId: item['id'],
            path:              item['downloadUrl'],
            isLocal:           !!item['isLocalFile'],
            onclick:           deleteBackup
        });

        var viewBtn = createElement('button', {
            type:        "button",
            innerText:   "View", //i18n +
            itemId:      item['id'],
            path:        item['downloadUrl'],
            timesaved:   item['timesaved'],
            isLocal:     !!item['isLocalFile'],
            fileSize:    item['fileSize'], // present only in gdrive files
            onclick:     viewBackup
        });

        var backupsListEntry = createElement('tr', { 'className': "backupsListEntry", 'id': item['id'] });

        backupsListEntry.appendChild(title);
        backupsListEntry.appendChild(createElement('td')).appendChild(delBtn);
        backupsListEntry.appendChild(createElement('td')).appendChild(viewBtn);

        itemsListElement.appendChild( backupsListEntry );
    }

    if(items.length == 0) {
        itemsListElement.innerHTML = '<div class="backupsListEntry">Backup Files Do Not Created Yet</div>'; //i18n
    }
}

//Cut&Paste from background.js
function fsErrorHandler(err){
    console.error('ERROR on file system access. FileError.code:', err['code']);
}


//Cut&Paste from background.js
function listAllFiles(callback_listResults/*[entries]*/) {
    window.webkitRequestFileSystem(self.PERSISTENT, 1024*1024, onInitFs_listAllFiles, fsErrorHandler);

    function onInitFs_listAllFiles(fs) {

      var dirReader = fs.root.createReader();
      var entries = [];

      // Call the reader.readEntries() until no more results are returned.
      var readEntries = function() {
         dirReader.readEntries (function(results) {
          if (!results.length) {
              callback_listResults(entries);
          } else {
            entries = entries.concat( Array.prototype.slice.call(results || [], 0)/*toArray*/ );
            readEntries();
          }
        }, fsErrorHandler);
      };

      readEntries(); // Start reading dirs.

    }
}

function listLocalBackups() {
    listAllFiles(function(entries){
        //TODO копипаста c deleteOlderBackups(), да и глупо что я время из названия беру
        var pattern = new RegExp("(.)-backup-([\\d]*)-[\\d]*\\.json");
        var nowTime = Date.now();
        var sortedBackupFilesWithTime = entries
            .filter(function(dirEntry) { return dirEntry.isFile && pattern.test(dirEntry.name)} )
            .map(function(dirEntry) { return {
                'dirEntry'    : dirEntry,
                'timesaved'   : Number(dirEntry.name.match(pattern)[2]),
                'id'          : "id"+dirEntry.name.match(pattern)[2], // we need something html valid for future referencing
                'downloadUrl' : dirEntry.fullPath,
                'isLocalFile' : true,
                'description' : ""//dirEntry.name.match(pattern)[1] //[h] [d]
            } } )
            .sort(function(o1,o2) { return Math.abs(o1['timesaved']-nowTime) - Math.abs(o2['timesaved']-nowTime) } );

        deleteChildNodes("localBackupsListTable");
        renderItems(sortedBackupFilesWithTime, getHtmlElementById("localBackupsListTable"));
    });

}

//Cut&Paste from background.js
function saveSessionDataAsFile_fsErrorHandler(err){
    console.error('ERROR on file system access. FileError.code:', err['code']);
    //window['treeWriteFail'] = true;
}

//Cut&Paste from background.js
function saveSessionDataAsFile(filename, sessionData, onwriteend) {
    console.log('saveSessionDataAsFile START', filename, new Date().toTimeString());

    var exportDataString = JSON.stringify(sessionData);
    var exportDataBlob = new Blob([exportDataString]); // Теоретически строки будут как UTF-8 закодированы
    webkitRequestFileSystem(PERSISTENT/*TEMPORARY*/, exportDataBlob.size+100, fsReady, saveSessionDataAsFile_fsErrorHandler);

    function fsReady(fs){
        fs.root.getFile(filename, {create: true, exclusive: false}, function(fileEntry) {
            fileEntry.createWriter(function(fileWriter) {
                fileWriter.truncate(0);
                fileWriter.onwriteend = function() {
                    fileWriter.onwriteend = onwriteend || null;  // кстате будет рекурсия если onwriteend не переписать
                    fileWriter.write(exportDataBlob);
                }
              }, saveSessionDataAsFile_fsErrorHandler);
        }, saveSessionDataAsFile_fsErrorHandler);
    }
}

//Cut&Paste from background.js
function performBackups(sessionDataAsOperations, localStorageFieldForLastBackupTimestamp, timeBetweenBackups, backupFilePrefix, howManyBackupsHandle) {
    var lastBackupTime = Number(localStorage[localStorageFieldForLastBackupTimestamp] || 0); // 0 or 'time'
    if( Math.abs(Date.now() - lastBackupTime) > timeBetweenBackups ) {
        localStorage[localStorageFieldForLastBackupTimestamp] = Date.now(); // до записи файла иначе мы пока таймаут будет подходит ещё 4 раза стартанём
        setTimeout(function() { 
            saveSessionDataAsFile(backupFilePrefix+Date.now()+"-"+sessionDataAsOperations.length+".json", sessionDataAsOperations, function onwriteend() {
            deleteOlderBackups(backupFilePrefix, howManyBackupsHandle);
        })}, 5000 + Math.round(Math.random()*2000) ); // setTimeout - Чтоб на нас не повлияли exceptions
    }
}

//Cut&Paste from background.js
function deleteOlderBackups(backupFilePrefix, howManyBackupsHandle) {
    listAllFiles(function(entries){
        var pattern = new RegExp(backupFilePrefix+"([\\d]*)-[\\d]*\\.json");
        var nowTime = Date.now();
        var sortedBackupFilesWithTime = entries.filter(function(dirEntry) { return dirEntry.isFile && pattern.test(dirEntry.name)} )
                                               .map(function(dirEntry) { return {'dirEntry':dirEntry, 'time': Number(dirEntry.name.match(pattern)[1])} } )
                                               .sort(function(o1,o2) { return Math.abs(o1['time']-nowTime) - Math.abs(o2['time']-nowTime) } );

        // оставить ближайшие несколько штук, остальные удалить
        // Более свежие (близкие к текущему моменту, коий может быть кстате хрен зна где в будущем или прошлом) находится по более низким индексам
        for(var i = howManyBackupsHandle/*свежие пропускаем*/; i < sortedBackupFilesWithTime.length; i++) {
            deleteFileByFullPath(sortedBackupFilesWithTime[i]['dirEntry'].fullPath);
        }

        // chrome.runtime.sendMessage({request:"message2options_refreshLocalBackupsList"}); // Refresh list of local backups
        listLocalBackups();

    });
}

//Cut&Paste from background.js
function deleteFileByFullPath(fullPath, continuneCallback) {
    continuneCallback = continuneCallback || function(){};
    webkitRequestFileSystem(PERSISTENT, 1024*1024 /*1MB*/, function(fs) {
        fs.root.getFile(fullPath, {create: false}, function(fileEntry) {
            fileEntry.remove(continuneCallback);
        });
    });
}

//Cut&Paste from background.js
function deleteLocalBackup(fullPath, continueCallback) {
    deleteFileByFullPath(fullPath, continueCallback);
}

function createBackupNowBtn() {
    var r = document.createElement('div');
    r.id = 'backupNowBtn';
    r.class = 'button';
    r.innerText = "Backup Now"; //i18n +

    r.onclick = backupNow;

    return r;
}

function viewBackup(event) {
    var item = this; // event.target; - нельзя юзать, гугле транслейт там два вложенных тега <font> вставляет вокруг лейбла

    var path        = item.path;
    var isLocal     = item.isLocal;
    var timestamp   = new Date(Number(item.timesaved));
    var itemId      = item.itemId;
    var fileSize    = Number(item.fileSize);

    // will open in new tab
    // window.open('backup/backupview/view_tree.html?backupUrl='+encodeURIComponent(downloadUrl),'_blank');

    if(isLocal && !PRO_LICENSE_KEY_VALID) {
        alert('You need to buy Paid Mode License Key to enable this feature.'); //i18n +
        return;
    }

    viewTree(path, timestamp, fileSize, isLocal, false);
}

function viewTree(path, timestamp, fileSize, isLocal, isUserSelectedFile) {
    // will open in new window
    chrome.windows.create({
        url:'backup/backupview/view_tree.html?path='+encodeURIComponent(path)+'&timestamp='+timestamp.getTime()+'&fileSize='+fileSize+'&isLocal='+isLocal+'&isUserSelectedFile='+isUserSelectedFile,
        width:500
    }, null/*callback*/);
}

function deleteBackup(event) {
    var element = this; // event.target; - нельзя юзать, гугле транслейт там два вложенных тега <font> вставляет вокруг лейбла

    var t = Date.now();
    var isConfirmed = confirm("Are You Sure?"); //i18n +
    if((Date.now() - t) < 30) isConfirmed = true; //User set [] prevent this window to display more warnings, will treat this as "always yes" (this will reset after new page will be opened, note that only page refresh does not reset this mode)

    if( isConfirmed ) {
        deleteElementFromPage(element.backupItemEntryId);
        if(element.isLocal)
            deleteLocalBackup(  element.path,    listLocalBackups );
        else
            setAuthToken_deleteGdriveBackup( element.itemId, async_listGdriveBackups );
    }
}

function backupNow() {
    backgroundport.postMessage({request:"request2bkg_performGdriveBackup", backupOperationId_:Math.random()}); // performGdriveBackup() will call backupStarted_backgroundPageCall before connecting and then one more time before starting upload (if no error during connect)

    chrome.runtime.sendMessage({request:"message2bkg_getDataForLocalBackup"})
    .then( (sessionDataAsOperations) => {
            //Cut&Paste from background.js
            //For tests for now
            performBackups(sessionDataAsOperations, 'lastDaylyBackupTime', 0/*time between backups*/, "d-backup-", 20);
            //performBackups(sessionDataAsOperations, 'lastHourlyBackupTime',   60*60*1000, "h-backup-", 6);
        }
    )

    //FF_REMOVED_GA ga_event('Backup Now Button Clicked - Options - ' + (PRO_LICENSE_KEY_VALID ? 'Paid' : 'NoValidKey'));
}


function msg2view_backupStarted_backgroundPageCall(response) {
    let isUploadStartedPhase = response.isUploadStartedPhase;
    if (isUploadStartedPhase)
        switchBackupNowBtnToUploadingInProgressState();
    else
        switchBackupNowBtnToConnectingState(); // backup now btn will be switched back to normal state in onBackupComplete_backgroundPageCall or on Error
}
function msg2view_onAuthorizationTokenGranted_backgroundPageCall(response) {
    hide401Error();
}
function msg2view_onBackupSucceeded_backgroundPageCall(response) {
    setAuthToken_listGdriveFiles(false); // this will also clear backup spinner on BackupNowBtn
    // Всегда надо ставить токен перед самой операцией с gapi, так как тот что есть уже возможно заэкспайрился
}
function msg2view_onGdriveAccessRewoked_backgroundPageCall(response) {
    show401Error_showAuthorizeGdriveAccessControls();
    switchBackupNowBtnToNormalState(); // Мы могли спаймать 401 в тот момент когда её нажали бо юзер отозвал permissions
}
function msg2view_noConnectionError_backgroundPageCall(response) {
    let operationInitiatorId = response.operationInitiatorId;
    alertErrorMessageIfOurWindowIsOperationInitiator(operationInitiatorId, "Network Error"); // i18n +
    switchBackupNowBtnToNormalState();
}
function msg2view_backupError_backgroundPageCall(response) {
    let operationInitiatorId = response.operationInitiatorId;
    let errorCode = response.errorCode;
    let errorMessage = response.errorMessage;
    alertErrorMessageIfOurWindowIsOperationInitiator(operationInitiatorId, 'Error during Backup operation, try again later. Error message returned by server:' + errorMessage + '; Error code:' + errorCode); // i18n +
    switchBackupNowBtnToNormalState();
}


var backupOperationId_;
function alertErrorMessageIfOurWindowIsOperationInitiator(operationInitiatorId, errorMessage) {
    if(operationInitiatorId == backupOperationId_) setTimeout(function(){alert(errorMessage)},1); //setTimeout to not block background script
}

function switchBackupNowBtnToConnectingState() {
    var btn = document.getElementById('backupNowBtn');
    if(btn) {
        btn.innerHTML = "<img src='/img/loading_chrome.gif'/> Connecting..."; // i18n +
        btn.classList.add('uploadInProgress');
    }
}

function switchBackupNowBtnToUploadingInProgressState() {
    var btn = document.getElementById('backupNowBtn');
    if(btn) {
        btn.innerHTML = "<img src='/img/loading_chrome.gif'/> Uploading Backup..."; // i18n +
        btn.classList.add('uploadInProgress');
    }
}

function switchBackupNowBtnToNormalState() {
    var btn = getHtmlElementById('backupNowBtn');
    if(btn) { // Not always present, but sometimes this method is caled for example on onGdriveAccessRewoked_backgroundPageCall & other messages
        btn.innerText = "Backup Now"; //i18n
        btn.classList.remove('uploadInProgress');
        btn.class = 'button';
    }
}

function syncronizeInputFieldWithLocalStorage(fieldId, defaultValue, localStorageLabel) {
    var inputElem = getHtmlElementById(fieldId);

    if(!inputElem) {
        console.error("syncronizeInputFieldWithLocalStorage html field not present:", fieldId);
        return;
    }

    inputElem.value = (window.localStorage[localStorageLabel] || defaultValue);
    inputElem.oninput = function(event) {
        var newValue = event.srcElement.value.trim();
        if(newValue)
            localStorage[localStorageLabel] = newValue;
        else
            delete localStorage[localStorageLabel];
    };
}


// Will only tuch local backups, as gdrive access infrastructure might not be initialized meantime
syncronizeInputFieldWithLocalStorage("machineLabel", "", "machineLabel");
//FFv3 syncronizeInputFieldWithLocalStorage("numberOfBackupsOnGdriveToKeep", "30", "numberOfBackupsOnGdriveToKeep");


var authorizeButton = document.getElementById("authorizeButton");
var originalAuthorizeButtonText = authorizeButton.innerText;
authorizeButton.onclick = manualAuth_listGdriveFiles;

listLocalBackups();

// the entry point to list gdrivebackups is function addGapiScript_setAuthToken_listGdriveFiles()
// wich is will be called after license check
