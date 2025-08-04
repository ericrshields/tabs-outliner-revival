/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

var backupOperationInitiatorId_ = null;
var rapidClicksChecker_seriesStartTime;
function performGdriveBackup(backupOperationInitiatorId){
    backupOperationInitiatorId_ = backupOperationInitiatorId; //if null then it's automaticaly initiated backup from background page

    // Prevent rapid clicks to request new backup operations
    if(rapidClicksChecker_seriesStartTime + 5*1000 > Date.now()) return; //NaN > digit - always false
    rapidClicksChecker_seriesStartTime = Date.now();

    callBackupStarted_ForAllViews(false);

    console.log("performGdriveBackup()");

    setAuthToken_backupTreeToGdrive();


    //FF_REMOVED_GA ga_event_backup_started(!!backupOperationInitiatorId);
}


//ExtIdentityApi Auth Flow
function setAuthToken_backupTreeToGdrive() {
    chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
        if(token) {
            backupTreeToGdrive(!!backupOperationInitiatorId_);
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
            // Chrome Is Not Signed In & interactive == false:
            //       Auth token undefined. chrome.runtime.lastError: Object {message: "The user is not signed in."}

            authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews(); // вобщето нет смысла дропать закешированый токен тут, так как его нет

            //FF_REMOVED_GA ga_event_backup_error('Auth Token Invalid Or Absent');
        }
    });


}

function getTreeDataForGdriveBackup() {
    return JSON.stringify( serializeActiveSessionToOperations() ); // Tcnm to` serializeHierarchyAsJSO() и просто serialize() и они работают быстрее
}
function backupTreeToGdrive(isBackupUserInitiated) {
    console.log("Start GDrive backup");

    listFile( function(fileIdToOverwrite) {
        insertFileInApplicationDataFolderOnGdrive(fileIdToOverwrite, getTreeDataForGdriveBackup(), isBackupUserInitiated)
    });
}

function authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews(){
    chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
        if(token)
            chrome.identity.removeCachedAuthToken( { 'token': token } ); // If there is no cached token there will be error exception and callback parameter of removeCachedAuthToken will not be called, so we must not use it for anything
        else
            chrome.runtime.lastError;
        // In case token is absent we must check runtime.lastError, to prevent such output in the console:
        // Unchecked runtime.lastError while running identity.getAuthToken: OAuth2 not granted or revoked.

        callOnGdriveAccessRewoked_ForAllViews();
    });
}

function maxNumberOfBackupFilesToKeep() {
    // var maxNumberOfBackupFilesToKeep = Number(localStorage['numberOfBackupsOnGdriveToKeep']);
    // if(!maxNumberOfBackupFilesToKeep || maxNumberOfBackupFilesToKeep < 0) {
    //     maxNumberOfBackupFilesToKeep = 30;
    //     delete localStorage['numberOfBackupsOnGdriveToKeep'];
    // }
    // return maxNumberOfBackupFilesToKeep;

    return 30;
}

function isTabsOutlinerBackupFile(item) {
    return item['title'].indexOf(BACKUP_FILENAME) >= 0;
}

function by_modifiedDate(a, b) {
    return (new Date(b['modifiedDate'])).getTime() - (new Date(a['modifiedDate'])).getTime();
}

async function getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, function(token) {
        if (chrome.runtime.lastError || !token) {
          authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews();
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
}
  
  
async function listFile(callback) {
    try {
      const token = await getAuthToken();
  
      const response = await fetch('https://www.googleapis.com/drive/v2/files?q=%27appdata%27+in+parents&maxResults=1000', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`, 
          'Accept': 'application/json'
        }
      });
  
      if (!response.ok) {
        if(response.status == 401) {// Access rewoked by user most likely, through own google profile in "Third-party apps & services \ Keep track of your connections"
            authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews();
            console.error('Failed to fetch files - authorization to access gdrive is not longer valid, need request it again', response);
          }          
        throw new Error(`Error: ${response.statusText}`);
      }
    
  
      const data = await response.json();
  
      if (data.items) {
        const ourBackupFiles = data.items.filter(isTabsOutlinerBackupFile);
        let oldestFileItemId = null;
  
        if (ourBackupFiles.length >= maxNumberOfBackupFilesToKeep()) {
          ourBackupFiles.sort(by_modifiedDate);
          oldestFileItemId = ourBackupFiles.pop().id;
        }
  
        callback(oldestFileItemId);
      } else {
        console.error("ERROR obtaining list of backup files from Gdrive", data);
        onGdriveOperationError(data);
      }
    } catch (error) {
      console.error('Failed to list files:', error);
      callBackupError_ForAllViews(backupOperationInitiatorId_, error);
      onGdriveOperationError(error);
    }
}


async function insertFileInApplicationDataFolderOnGdrive(fileIdToOverwrite, data, isBackupUserInitiated) {
    callBackupStarted_ForAllViews(true);
  
    const description = JSON.stringify({
      'machineLabel': "FFv3" /*FF localStorage['machineLabel']*/ || "",
      'manual': !!isBackupUserInitiated
    });
  
    const metadata = {
      'title': BACKUP_FILENAME,
      'mimeType': 'application/json',
      'parents': [{ 'id': "appdata" }],
      'description': description
    };
  
    // https://developers.google.com/drive/web/appdata#inserting_a_file_into_the_application_data_folder
    // https://developers.google.com/drive/web/manage-uploads also see Best Practices section
    //
    // отправляем как Content-Type: application/json
    // хотя в примерах к GDrive APi там всюду перекодировка в base64 и отправка как 'application/octet-stream'
    // вроде работает, и наверняка json намного лучше пакуется при отправке и получении через gzip
    //
    // как получить progress индикацию:
    // http://stackoverflow.com/questions/30562391/track-progress-of-file-upload-to-google-cloud-storage-via-js
    // it's actualy used GAPI CORS support described there:
    // https://developers.google.com/api-client-library/javascript/features/cors
    // проблема тока в том что это потребует в манифесте прямо прописать урлы, а значит это запрос новых разрешений у юзера    
    
    const boundary =   '-------314159265358979323846';
    //const boundary = '---------314159265358979323846';
    
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      data +
      closeDelimiter;
 
  
    const url = fileIdToOverwrite
      ? `https://www.googleapis.com/upload/drive/v2/files/${fileIdToOverwrite}?uploadType=multipart&uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&uploadType=multipart';

    const method = fileIdToOverwrite ? 'PUT' : 'POST';
  
    try {
      const token = await getAuthToken();
  
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/mixed; boundary="${boundary}"`,
          //mode: 'same-origin'
          //'sec-fetch-mode': 'no-cors',
          //'mode': 'no-cors',  // Set the request mode to 'no-cors'
                            //It's essential to note that when using 'no-cors' mode, the response will be opaque, meaning you 
                            //can't access its headers or body directly from JavaScript. 
                            //You'll only be able to check the response's status and whether it's ok or not.
        },
        body: multipartRequestBody
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

        throw new Error(`Error: ${response.statusText}`);
      }
  
      chrome.storage.local.set({ 'gdriveLastSuccessfulBackupTime': Date.now() });
      callBackupSucceeded_ForAllViews();
      console.log("GDrive backup succeeded");
  
    } catch (error) {
      console.error('Error File Upload', error);
      onGdriveOperationError(error);
    }
  }
  


// function insertFileInApplicationDataFolderOnGdrive(fileIdToOverwrite, data, isBackupUserInitiated) {
//     callBackupStarted_ForAllViews(true);

//     // WARNING Перед любой GAPI операцией, если менаджинг токена осуществляется не самой GAPI.auth (тоесть если мы ставим Access Token туда вручную через gapi.auth.setToken,
//     // беря его из Identity.API к примеру) надо всегда выполнять повторный gapi.auth.setToken(). Так как у gapi нет Refresh Tokena чтоб получить новый Access Token
//     // который возможно уже заэкспайрился, а заэкспайривается он в течении часа!!!!

//     var description = JSON.stringify({ 'machineLabel': "FFv3"/*FF localStorage['machineLabel']*/ || "", 'manual': !!isBackupUserInitiated });

//     var metadata = {
//         'title': BACKUP_FILENAME,
//         'mimeType': "application/json",
//         'parents': [{ 'id': "appdata" }],
//         'description': description
//     };

//     // https://developers.google.com/drive/web/appdata#inserting_a_file_into_the_application_data_folder
//     // https://developers.google.com/drive/web/manage-uploads also see Best Practices section
//     //
//     // отправляем как Content-Type: application/json
//     // хотя в примерах к GDrive APi там всюду перекодировка в base64 и отправка как 'application/octet-stream'
//     // вроде работает, и наверняка json намного лучше пакуется при отправке и получении через gzip
//     //
//     // как получить progress индикацию:
//     // http://stackoverflow.com/questions/30562391/track-progress-of-file-upload-to-google-cloud-storage-via-js
//     // it's actualy used GAPI CORS support described there:
//     // https://developers.google.com/api-client-library/javascript/features/cors
//     // проблема тока в том что это потребует в манифесте прямо прописать урлы, а значит это запрос новых разрешений у юзера
//     var multipartRequestBody = "\r\n---------314159265358979323846\r\nContent-Type: application/json\r\n\r\n" + JSON.stringify(metadata) + "\r\n---------314159265358979323846\r\nContent-Type: application/json\r\n\r\n" + data + "\r\n---------314159265358979323846--";

//     gapi.client.request({
//         'path': "/upload/drive/v2/files" + (fileIdToOverwrite != null  ? "/" + fileIdToOverwrite : "") + "?uploadType=multipart",
//         'method': fileIdToOverwrite != null  ? "PUT" : "POST",
//         'params': {
//             'fileId': fileIdToOverwrite,
//             'uploadType': "multipart"
//         },
//         'headers': {
//             "Content-Type": 'multipart/mixed; boundary="-------314159265358979323846"'
//         },
//         'body': multipartRequestBody
//     }).then(
//         function onSuccess(response) {
//             localStorage['gdriveLastSuccessfulBackupTime'] = Date.now();
//             callBackupSucceeded_ForAllViews();

//             console.log("GDrive backup succeded");
//             //FF_REMOVED_GA ga_event_backup_succeded(multipartRequestBody.length);
//         },
//         function onError(reason) {
//             // reason in case we disconect cable during upload
//             //    body: "{"error":{"code":-1,"message":"A network error occurred, and the request could not be completed."}}"
//             //    headers: null
//             //    result: Object
//             //        error: Object
//             //            code: -1
//             //            message: "A network error occurred, and the request could not be completed."
//             //    status: null
//             //    statusText: null


//             // reason in case permission was rewoked before call
//             //    body: "{↵ "error": {↵ "errors": [↵ {↵ "domain": "global",↵ "reason": "required",↵ "message": "Login Required",↵ "locationType": "header",↵ "location": "Authorization"↵ }↵ ],↵ "code": 401,↵ "message": "Login Required"↵ }↵}↵"
//             //        headers: Object
//             //        result: Object
//             //            error: Object
//             //                code: 401
//             //                errors: Array[1]
//             //                message: "Login Required"
//             //
//             //        status: 401
//             //        statusText: "OK"
//             //
//             // In this case we need to drop current access token from cache!
//             console.error('Error File Upload', reason);
//             onGdriveOperationError(reason);

//             //FF_REMOVED_GA ga_event_backup_error('Upload Stage Error: '+ ((reason['error'] && reason['error']['message'])?reason['error']['message']:'Unknown Reason'));
//         }
//     );
// }

function onGdriveOperationError(reason) {
    // reason in case we disconect cable during upload
    //    body: "{"error":{"code":-1,"message":"A network error occurred, and the request could not be completed."}}"
    //    headers: null
    //    result: Object
    //        error: Object
    //            code: -1
    //            message: "A network error occurred, and the request could not be completed."
    //    status: null
    //    statusText: null


    // reason in case permission was rewoked before call
    //    body: "{↵ "error": {↵ "errors": [↵ {↵ "domain": "global",↵ "reason": "required",↵ "message": "Login Required",↵ "locationType": "header",↵ "location": "Authorization"↵ }↵ ],↵ "code": 401,↵ "message": "Login Required"↵ }↵}↵"
    //        headers: Object
    //        result: Object
    //            error: Object
    //                code: 401
    //                errors: Array[1]
    //                message: "Login Required"
    //
    //        status: 401
    //        statusText: "OK"
    //
    // In this case we need to drop current access token from cache!


    if     (reason['error'] && reason['error']['code'] ==  -1) callNoConnectionError_ForAllViews(backupOperationInitiatorId_);
    else if(reason['error'] && reason['error']['code'] == 401) authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews();
    else                                                       callBackupError_ForAllViews(backupOperationInitiatorId_, reason['error'] && reason['error']['code'], reason['error'] && reason['error']['message']);

}

// --------------------------------------------------------------------
var isGdriveBackupSchedulerActive = false;

function activateGdriveBackupScheduler() {
    // We come here on every key check, so we must ensure that we run only one scheduler
    if(isGdriveBackupSchedulerActive) return;

    isGdriveBackupSchedulerActive = true;
    runGdriveBackupScheduler();
}

function runGdriveBackupScheduler() {
    if(!isGdriveBackupSchedulerActive) return;

    setTimeout(runGdriveBackupScheduler, (24 * 60 * 60 * 1000/*1h*/)); // Schedule own next execution

    isTimeForNextAutomaticGdriveBackup().then( (itsTime) => { if(itsTime) performGdriveBackup(null) } );

    updatePassedTimeFromLastSuccesfulBackupIndicators();
}

async function isTimeForNextAutomaticGdriveBackup() {
    var backupFrequence = (24 * 60 * 60 * 1000/*24h*/);
    
    var lastBackupToDriveTime = Number((await chrome.storage.local.get('gdriveLastSuccessfulBackupTime')).gdriveLastSuccessfulBackupTime || 0);

    return Date.now() >= (lastBackupToDriveTime + backupFrequence);
}

function updatePassedTimeFromLastSuccesfulBackupIndicators() {
    chrome.storage.local.get('gdriveLastSuccessfulBackupTime')
    .then((data) => {
        var lastBackupToDriveTime = Number(data.gdriveLastSuccessfulBackupTime || 0);
        callUpdateBackupIndicator_ForAllViews(lastBackupToDriveTime);
    }); 
}

//------------------------------------------------------------------------
function callUpdateBackupIndicator_ForAllViews(gdriveLastSuccessfulBackupTime) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_updateBackupIndicator_backgroundPageCall', gdriveLastSuccessfulBackupTime:gdriveLastSuccessfulBackupTime});
    //callOnAllViews('updateBackupIndicator_backgroundPageCall', gdriveLastSuccessfulBackupTime);
}
function callBackupSucceeded_ForAllViews() {
    viewsCommunicationInterface.postMessageToAllViews({command: 'msg2view_onBackupSucceeded_backgroundPageCall'});
    //callOnAllViews('onBackupSucceeded_backgroundPageCall');
}
function callOnGdriveAccessRewoked_ForAllViews() {
    viewsCommunicationInterface.postMessageToAllViews({command: 'msg2view_onGdriveAccessRewoked_backgroundPageCall'});
    //callOnAllViews('onGdriveAccessRewoked_backgroundPageCall');
}
function callOnAuthorizationTokenGranted_ForAllViews() {
    viewsCommunicationInterface.postMessageToAllViews({command: 'msg2view_onAuthorizationTokenGranted_backgroundPageCall'});
    //callOnAllViews('onAuthorizationTokenGranted_backgroundPageCall');
}
function callBackupStarted_ForAllViews(isUploadStartedPhase) {
    viewsCommunicationInterface.postMessageToAllViews({command: 'msg2view_backupStarted_backgroundPageCall', isUploadStartedPhase: isUploadStartedPhase});
    //callOnAllViews('backupStarted_backgroundPageCall', isUploadStartedPhase);
}

function callNoConnectionError_ForAllViews(userInitiatedOperation) {
    viewsCommunicationInterface.postMessageToAllViews({command: 'msg2view_noConnectionError_backgroundPageCall', userInitiatedOperation: userInitiatedOperation});
    //callOnAllViews('noConnectionError_backgroundPageCall', userInitiatedOperation);
}
function callBackupError_ForAllViews(userInitiatedOperation, errorCode, errorMessage) {
    viewsCommunicationInterface.postMessageToAllViews({
        command: 'msg2view_backupError_backgroundPageCall',
        userInitiatedOperation: userInitiatedOperation,
        errorCode: errorCode,
        errorMessage: errorMessage
    });
    //callOnAllViews('backupError_backgroundPageCall', userInitiatedOperation, errorCode, errorMessage);
}

var authTokenGranted_notifyAllOpenedViews = callOnAuthorizationTokenGranted_ForAllViews;

var authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews = authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews;

var BACKUP_FILENAME = "tabsoutlinerbackup.json";



// window['setLicenseState_valid'] = function(licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/ ) {
//     activateGdriveBackupScheduler();
// };

checkAndUpdateLicenseStatusInAllViews(); // Will call there setLicenseState_valid() and this will perform or sheduled backup if Pro mode enabled