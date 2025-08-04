/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

var backgroundport = chrome.runtime.connect({name: "background"});

backgroundport.onMessage.addListener(function getResp(response) {
    console.log(response.command, " handlerPresent:", !!self[response.command], response);

    if(self[response.command]) self[response.command](response); 
    if(false) { // Читай комент ниже:
        // Этот блок кода не вызывается, тут это все для ideшке что б по GetUsage & Search
        // было понятно что от сюда эти вызовы происходят
        // А происходят они динамически, в строчке self[response.command](response); if(false) {
        msg2view_setLicenseState_valid(response);
        msg2view_setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey(response);
        msg2view_setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn(response);
        msg2view_setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission(response);
        msg2view_setLicenseState_invalid_NoLicenseKey(response);

        // in options-backup.js
        msg2view_backupStarted_backgroundPageCall(response);
        msg2view_onAuthorizationTokenGranted_backgroundPageCall(response);
        msg2view_onBackupSucceeded_backgroundPageCall(response);
        msg2view_onGdriveAccessRewoked_backgroundPageCall(response);
        msg2view_noConnectionError_backgroundPageCall(response);
        msg2view_backupError_backgroundPageCall(response);
    }

});

// New storage.local options - accessed from service worker --------------------------
function setOptionsFieldAndOnchangeListener(fieldName) {
    getOption(fieldName).then( (value) => {
        document.getElementById(fieldName).checked = !!value;
        document.getElementById(fieldName).onchange = onchange_optionInStorageLocal;
    });
}

function onchange_optionInStorageLocal() {
    setOption(this.id,!!this.checked);
}

setOptionsFieldAndOnchangeListener('doNotAutoscroll');
setOptionsFieldAndOnchangeListener('openOnStatup');    
//setOptionsFieldAndOnchangeListener('relateNewTabToOpener');
//setOptionsFieldAndOnchangeListener('openTabsOutlinerInLastClosedPos');
//setOptionsFieldAndOnchangeListener('openSavedWindowsInOriginalPos');

// Old localStorage options ------------------------------------------------------------
document.getElementById('oneClickToOpen').checked = !!localStorage['oneClickToOpen'];
document.getElementById('oneClickToOpen').onchange = onchange_oneClickToOpen;

document.getElementById('showBackupNowBtn').checked = !!localStorage['showBackupNowBtn'];
document.getElementById('showBackupNowBtn').onchange = onchange_showBackupNowBtn;

document.getElementById('experimentalLightBackground').checked = !!localStorage['experimentalLightBackground'];
document.getElementById('experimentalLightBackground').onchange = onchange_experimentalLightBackground;


function onchange_experimentalLightBackground() {
    if(this.checked) localStorage['experimentalLightBackground'] = 'true';
    else      delete localStorage['experimentalLightBackground'];

    optionsChanged_notifyAllViews('colors');
}

function onchange_oneClickToOpen() {
    if(this.checked) localStorage['oneClickToOpen'] = 'true';
    else      delete localStorage['oneClickToOpen'];

    optionsChanged_notifyAllViews('oneClickToOpen');
}

function onchange_showBackupNowBtn() {
    if(this.checked) localStorage['showBackupNowBtn'] = 'true';
    else      delete localStorage['showBackupNowBtn'];
    
    optionsChanged_notifyAllViews('showBackupNowBtn');
}

function optionsChanged_notifyAllViews(changedOption) {
    backgroundport.postMessage({request:"request2bkg_optionsChanged_notifyAllViews", changedOption:changedOption});
}

// ---------------------------------------------------------------------------------------------------------------------
[].slice.call(document.getElementsByClassName('showMoreContent')).forEach(
    function (item) { item.onclick = onShowMoreClick}
);

function onShowMoreClick(event) {
    var moreContentEl = document.getElementById(event.target.getAttribute('name'));
    if(!moreContentEl) return;

    moreContentEl.style.display='block'; //Show
    event.target.style.display='none'; //Hide
}
// ---------------------------------------------------------------------------------------------------------------------

function readSessionDataFromUserSelectedFile(callback) {
    readJsonOperationsFromFile(userSelectedFileToOpen, callback);
}

// Даже если файла нет или любая проблема мы вызовем callback.
function readSessionDataFromFile(filename, callback/*(fileData or error)*/) {
    webkitRequestFileSystem(PERSISTENT, 1024*1024, fsReady, callback /*fsErrorHandler*/);

    function fsReady(fs) {
      fs.root.getFile(filename, {create: false}, function(fileEntry) {
        fileEntry.file( function(file) { readJsonOperationsFromFile(file, callback) }, callback /*errorCallback*/);
      }, callback /*errorCallback*/);
    }
}

function readJsonOperationsFromFile(file, callback) {
    var reader = new FileReader();
    reader.onloadend = function(e) {
        try { var operations = JSON.parse(e.target.result); } catch(parseError) { callback(parseError); }
        callback(operations);
    };
    reader.onerror = callback;
    reader.readAsText(file); // Тип UTF энкодинга будет определён по первым байтам файлам или UTF-8 если они его не задают (вродебы)
}

async function saveCurrentSessionAsFileNow(callback) {
    console.time("= Save Tree Total ====");

    console.time("Serialize Tree Full");


    const exportDataString = await chrome.runtime.sendMessage({request:"message2bkg_getCurrentSessionAsJsonString"});
    
    console.time("Blobify Tree");
    var exportDataBlob = new Blob([exportDataString], { "type" : "application\/octet-stream" });
    console.timeEnd("Blobify Tree");
    console.log("data.size:",exportDataBlob.size);

    console.timeEnd("Serialize Tree Full");

    function fsErrorHandler(err){
        console.error('ERROR on file system access. FileError.code:', err['code']);
    }

    window.webkitRequestFileSystem(window.TEMPORARY/*window.PERSISTENT*/, exportDataBlob.size+100, fsReady, fsErrorHandler);

    function fsReady(fs){
        fs.root.getFile('tree-exported-'+(new Date()).toDateString().replace(/ /g,'-')+'.tree', {create: true, exclusive: false}, function(fileEntry) {
            console.log('A file ' + fileEntry.name + ' was created successfully.');
            fileEntry.createWriter(function(fileWriter) {
                console.time("Write Data");
                fileWriter.write(exportDataBlob);
                console.timeEnd("Write Data");
                console.timeEnd("= Save Tree Total ====");
                console.log(fileEntry.toURL());

                callback(fileEntry, exportDataBlob);
              }, fsErrorHandler);
        }, fsErrorHandler);
    }
}


var URL =  window.URL || window.webkitURL || window;

document.getElementById('exportToFile').addEventListener('click', exportToFile );
function exportToFile() {
    document.getElementById('exporteBlobUrl').innerHTML = '';
    // startThreadCheck();


    saveCurrentSessionAsFileNow( function(fileEntry, blob){
        var filename = 'tree-exported-'+(new Date()).toDateString().replace(/ /g,'-')+'.tree';
        var save_link= document.createElementNS("http://www.w3.org/1999/xhtml", "a");

        function click (node) {
            var eventMouseClick = document.createEvent("MouseEvents");
            eventMouseClick.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            node.dispatchEvent(eventMouseClick);
        }

        document.getElementById('exporteBlobUrl').innerHTML =
            '<a download="'+filename+'" href="'+fileEntry.toURL()+'">Exported Data  - right click and save it to filesystem by context menu item "Save link as..."</a>';

        save_link.href = URL.createObjectURL(blob);
        save_link.download = filename;
        click(save_link);
    });
}

document.getElementById('viewExportedFile').addEventListener('change', handleFileSelect_viewExportedFile, false);
function handleFileSelect_viewExportedFile(evt) {
    var files = evt.target.files; // FileList object

    // files is a FileList of File objects. List some properties.
    var output = [];
    for (var i = 0, file; file = files[i]; i++)
        viewExportedFile(file);
}

// function viewExportedFile(file) {
//     backgroundport.postMessage({request:"request2bkg_storeUserSelectedFile", file:file});

//     viewTree('selectedFile', file.lastModifiedDate, file.size, true, true);
// }

function viewExportedFile(file) {
    // Check for FileReader support
    if (!window.FileReader) {
        console.log("The File APIs are not fully supported in this browser.");
        return;
    }

    // Read the content of the file
    var reader = new FileReader();

    // This event listener will be triggered when the reading operation is completed
    reader.onload = function(event) {
        var fileContent = event.target.result;
        var exportDataBlob = new Blob([fileContent], { type: file.type });

        // Request the temporary filesystem
        window.webkitRequestFileSystem(window.TEMPORARY, exportDataBlob.size + 100, function(fs) {
            // Once we have access to the filesystem, create a file
            var filePath = 'selectedFile';  // Define the file path
            fs.root.getFile(filePath, { create: true, exclusive: false }, function(fileEntry) {
                // Create a FileWriter object for writing to the file
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.truncate(0);

                    fileWriter.onwriteend = function() {
                        // After truncating, write the new content
                        fileWriter.write(exportDataBlob);


                        fileWriter.onwriteend = function() {
                            console.log('File written to filesystem successfully.');

                            // After writing, read the file from the filesystem
                            viewTree(filePath, file.lastModifiedDate, file.size, true, true);
                        };
                    }

                    fileWriter.onerror = function(err) {
                        console.log('Error while writing to the file:', err);
                    };
                }, fsErrorHandler);
            }, fsErrorHandler);
        }, fsErrorHandler);
    };

    // Error handling function for the filesystem
    function fsErrorHandler(error) {
        console.log('Filesystem Error:', error);
    }

    // Read the file as text (or binary depending on your needs)
    reader.readAsText(file);
}

// ---------------------------------------------------------------------------------------------------------------------
function registerColorOverrideControlsListener(overrideOptionId, colorSelectorId) {
    document.getElementById(overrideOptionId).checked = !!localStorage[overrideOptionId];
    if(localStorage[colorSelectorId]) document.getElementById(colorSelectorId).value = localStorage[colorSelectorId];


    function onchange_listener() {
        if(document.getElementById(overrideOptionId).checked)
            localStorage[overrideOptionId] = 'true';
        else
            delete localStorage[overrideOptionId];

        localStorage[colorSelectorId] = document.getElementById(colorSelectorId).value;

        optionsChanged_notifyAllViews('colors');
    }

    document.getElementById(overrideOptionId).onchange = onchange_listener;
    document.getElementById(colorSelectorId).onchange = onchange_listener;
}
registerColorOverrideControlsListener('overrideSavedTabColor',   'savedTabTextColor');
registerColorOverrideControlsListener('overrideOpenTabColor',    'openTabTextColor');
registerColorOverrideControlsListener('overrideCurrentTabColor', 'currentTabTextColor');
registerColorOverrideControlsListener('overrideNoteTextColor',   'noteTextColor');

//---------------------------------------------------------------------------------------

document.getElementById('dropInvalidLicenseKey').addEventListener('click', dropInvalidLicenseKey );

document.getElementById('enableTrialBackupBtn').addEventListener('click', initiateEnableBackupUiTrialSequence );

document.getElementById('testNoIdentityEmailPermissionGrantedWarning').addEventListener('click', showNoIdentityEmailPermissionGrantedWarning);
document.getElementById('testNotSignedInToChromeWarning').addEventListener('click', showNotSignedInToChromeWarning);

function addHtmlMessage(areaElementId, clearAreaBeforeAdd, htmlMessage) {
    var messagesArea = document.getElementById(areaElementId);
    if(clearAreaBeforeAdd) messagesArea.innerHTML = ""; // delete everything

    var div = document.createElement('div');
    div.innerHTML = htmlMessage;
    while (div.children.length > 0) {
        var lastInsertedElement = messagesArea.insertBefore(div.children[0], null);
    }

    messagesArea.scrollIntoView();

    return lastInsertedElement;
}

function addHeaderWarning(messageHtml) {
    addHtmlMessage('headerWarningMessageArea', false, messageHtml);
    window.scrollTo(0,0);
}

function showIdentityAccessErrorWarning(messageHtml) {
    addHtmlMessage('identityAccessWarningsMessageArea-Pro', true, messageHtml);
    addHtmlMessage('identityAccessWarningsMessageArea-Backup', false, messageHtml);

}

function clearIdentityAccessErrorWarnings () {
    document.getElementById('identityAccessWarningsMessageArea-Pro').innerHTML = ""; // delete everything
    document.getElementById('identityAccessWarningsMessageArea-Backup').innerHTML = ""; // delete everything

}
function showNoIdentityEmailPermissionGrantedWarning(){ //i18n +
    showIdentityAccessErrorWarning('<div class="mainViewMessage" type="warning">'+
                                        '<span class="mainViewMessageIcon"></span>'+
                                        '<div class="mainViewMessageBody">Warning: Permission to access Chrome Profile email address is not granted. To validate your license key and further configure online backup to your Google Drive account, Tabs Outliner needs access to your Chrome Profile identity and email. Please grant access.</div>'+
                                   '</div>');
}
function showNotSignedInToChromeWarning(){ //i18n +
    showIdentityAccessErrorWarning('<div class="mainViewMessage" type="warning">'+
                                        '<span class="mainViewMessageIcon"></span>'+
                                        '<div class="mainViewMessageBody">Warning: Chrome is not Signed In or Sync is off. <p>Chrome Sign In required to validate your license key and to configure online backup on your Google Drive account. <p>'+
                                        '<br/>Please <button name=signInToChromeBtn>Sign In to Chrome</button> and try again.<br/>If you Signed in <b>please check that Sync is Turned On</b> '+
                                        '<br/>(you can go to the chrome://settings/syncSetup to check Sync status, or click your Chrome profile avator icon in any Chrome window top right corner)'+ 
                                        '<p>Alternatively you can open <b>Sign In to Chrome</b> dialog from Chrome settings, or by clicking the Profile name on the top right of any normal Chrome window (above the tabs strip).</div>'+
                                   '</div>');
    [].slice.call(document.getElementsByName('signInToChromeBtn')).forEach(
        function (item) { item.onclick = signInToChrome }
    );
}
function show401Error(){ //i18n+
    if(document.getElementById('noGdriveAccessGrantedErrorWarning')) return; // Only one warning message on page

    addHeaderWarning(              '<div id=noGdriveAccessGrantedErrorWarning class="mainViewMessage" type="warning">'+
                                        '<span class="mainViewMessageIcon"></span>'+
                                        '<div class="mainViewMessageBody">Backup To Google Drive Currently Disabled! <button id=authorizeBtnInMessage>Authorize Google Drive Access</button> To Enable It.</div>'+
                                   '</div>');

    document.getElementById('authorizeBtnInMessage').onclick = manualAuth_listGdriveFiles;
}
function hide401Error(){
    var message = document.getElementById('noGdriveAccessGrantedErrorWarning');
    if(message) message.parentElement.removeChild(message);
}
if(document.getElementById('enterLicenseKeyBtn')) document.getElementById('enterLicenseKeyBtn').addEventListener('click', function(event) {
    clearIdentityAccessErrorWarnings();

    // Permissions must be requested from inside a user gesture, like a button's click handler.
    requestIdentityPermisionsContinueIfGrantedShowErrorsIfNot(showEnterLicenseKeyDialog);

});


document.getElementById('allowEmailAccessBtn-pro').addEventListener('click', function(event) {
    //FF_REMOVED_GA ga_event('Grant Email Access Button Clicked - Pro Tab');
    showEmailAccessExplanation_continueToRequestIdentityPermissions_continueToRevalidateLicenseKey();
});

document.getElementById('buyLicenseKeyBtn-pro').addEventListener('click', function(event) {
    //FF_REMOVED_GA ga_event('Buy Button Clicked - Pro Tab');
    initiateBuyLicenseKeySequence();
});

document.getElementById('buyLicenseKeyBtn-backup').addEventListener('click', function(event) {
    //FF_REMOVED_GA ga_event('Buy Button Clicked - Backup Tab');

    switchToProTab(); //As they contain warnings message area for not accessible identity
    initiateBuyLicenseKeySequence();
});

function switchToProTab() {
    var tab_pro = document.getElementById('tab-pro');
    tab_pro && (tab_pro.checked = true);
}

function initiateBuyLicenseKeySequence() {
    clearIdentityAccessErrorWarnings();

    if_NotSignedInOrSignedInAndEmailGranted_Else_ChromeSignedInbutEmailNotGranted(
                                   requestIdentityPermissions_continueToPaymentFlow,
        showEmailAccessExplanation_requestIdentityPermissions_continueToPaymentFlow
    );
}

function initiateEnableBackupUiTrialSequence() {
    //FF_REMOVED_GA ga_event('Request Backup Controls Trial');

    clearIdentityAccessErrorWarnings();

    if_NotSignedInOrSignedInAndEmailGranted_Else_ChromeSignedInbutEmailNotGranted(
                                   requestIdentityPermissions_continueToEnableBackupTrialControls,
        showEmailAccessExplanation_requestIdentityPermissions_continueToEnableBackupTrialControls
    );
}

function showEmailAccessExplanation_requestIdentityPermissions_continueToPaymentFlow() {
    showBeforeEmailAccessExplanation( requestIdentityPermissions_continueToPaymentFlow, "Payment Process" ); //i18n
}
function showEmailAccessExplanation_requestIdentityPermissions_continueToEnableBackupTrialControls() {
    showBeforeEmailAccessExplanation( requestIdentityPermissions_continueToEnableBackupTrialControls, "Backup Trial" ); //i18n
}

function showEmailAccessExplanation_continueToRequestIdentityPermissions_continueToRevalidateLicenseKey() {
    showBeforeEmailAccessExplanation( requestIdentityPermissions_continueToRevalidateLicenseKey, "" ); //i18n
}

function showBeforeEmailAccessExplanation(onBuyLicenseKeyDialogContinue, identityAccessExplanationNextStepTitle) {
    //FF_REMOVED_GA ga_event('Email Access Explanation Shown - ' + identityAccessExplanationNextStepTitle);

    activateBeforeIdentityAccessExplanationDialog( null,
                                                   identityAccessExplanationNextStepTitle,
                                                   onBuyLicenseKeyDialogContinue );
}

function requestIdentityPermissions_continueToPaymentFlow() {
    // Modal will be closed after we return from this function!

    // Permissions must be requested from inside a user gesture, like a button's click handler.
    requestIdentityPermisionsContinueIfGrantedShowErrorsIfNot( showBuyLicenseKeyDialog_afterIdentityAccess );
}


function showBuyLicenseKeyDialog_afterIdentityAccess( userInfo ) {
    // нужно в диалог ващето серийник передать, в том числе на линк для фастспринга
    calculateSerialNumber_promise(userInfo.email)
    .then(function(serialNumber) {
            openFastSpringBuyPage(serialNumber);
//          activateBuyLicenseKeyDialog_afterIdentityAccess( serialNumber,  // useremail, ,
//                                                           null,          // defaultText
//                                                           function() { openFastSpringBuyPage(serialNumber) });//onOk
    });

}

function openFastSpringBuyPage(serialNumberHex) {
//    var referrerObj = { // id: chrome.app.getDetails().id,
//                        version: chrome.app.getDetails().version,
//                        serial: serialNumberHex };
//    encodeURIComponent(btoa(JSON.stringify(referrerObj)))

    chrome.windows.create({
        url: "http://sites.fastspring.com/tabsoutliner/product/tabsoutliner?referrer="+serialNumberHex,
        focused:true
    }, function() {
        //FF_REMOVED_GA ga_event('Shopping Cart Opened');
    } );
}

// Permissions must be requested from inside a user gesture, like a button's click handler.
function requestIdentityPermisionsContinueIfGrantedShowErrorsIfNot(continueCallback) {
    //FF_REMOVED_GA ga_event_access_states('Email Access - Request','R','R',null);

    continueCallback({ userInfo:"shierposid@gmail.com" });

    // // modal will be closed AFTER this function will exit
    // // Permissions must be requested from inside a user gesture, like a button's click handler.
    // requestIdentityEmailPermission( function(granted) {
    //     // The callback argument will be true if the user granted the permissions.
    //     if (granted) {
    //         chrome.identity.getProfileUserInfo( function(userInfo) {
    //             if(!userInfo.email) { //Currently if we not signed in they return as granted, even without consent modal!!! but there will be userInfo.email=='', it's a chrome bug! UPD: похоже уже нет этого бага, но надо перепроверить
    //                 showNotSignedInToChromeWarning();
    //                 //FF_REMOVED_GA ga_event_access_states('Email Access - NotSignedIn','N','Y',null);
    //             } else {
    //                 continueCallback(userInfo);
    //                 //FF_REMOVED_GA ga_event_access_states('Email Access - Allowed','Y','Y',null);
    //             }
    //         });
    //     } else { //We was signed in and user press Decline on email permission request dialog
    //         showNoIdentityEmailPermissionGrantedWarning();
    //         //FF_REMOVED_GA ga_event_access_states('Email Access - Declined',null,'N',null);
    //     }
    // } );
}

// Permissions must be requested from inside a user gesture, like a button's click handler.
// callback(true) - The callback argument will be true if the user granted the permissions, callback(false) - permission not granted
// C&P in background page
function requestIdentityEmailPermission(callback) {
    callback(true);
    // chrome.permissions.request({
    //         permissions: ['identity.email'], //identity не требует consent скрина, identity.email - требует! и 100% блокирует extension на апдейте если указано не в optional_permissions
    //         origins: [] // origins: ['http://www.test.com/']
    //     }, callback);
}


function if_NotSignedInOrSignedInAndEmailGranted_Else_ChromeSignedInbutEmailNotGranted(alreadyGranted_Or_NotSignedIn_Callback, notYetgranted_And_SignedIn_Callback) {
    alreadyGranted_Or_NotSignedIn_Callback();
    // chrome.permissions.contains({
    //    permissions: ['identity.email'],
    //    origins: [] // origins: ['http://www.test.com/']
    // }, function(result) { // ALSO TRUE IF WE NOT SIGNED IN TO CHROME !!!!!! AND IT'S STAY TRUE AFTER SIGN IN WITHOUT CONSENT SCREEN IF WE PERFORM chrome.permissions.request immedeately aftewards!!! This can change at any moment, it's a bug, but cool one UPD: надо бы проверить, вроде уже както не так пашет
    //    if (result) {
    //        alreadyGranted_Or_NotSignedIn_Callback();
    //    } else {
    //        notYetgranted_And_SignedIn_Callback(); // Meantime this case happen only if chrome alreade signed in already (but this can change in future)
    //    }
    // });
}

//---------------------------------------------------------------------------------------
document.getElementById('test_setLicenseState_valid').addEventListener('click', function(event) {
    requestIdentityEmailPermission( function(granted) {
        // The callback argument will be true if the user granted the permissions.
        backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
        // if (granted) {
        //     chrome.identity.getProfileUserInfo( function(userInfo) {
        //         backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
        //     });
        // } else {
        //     alert('Permission To Access Identity.Email Not Granted')
        // }
    } );
});
document.getElementById('test_setLicenseState_invalidLicenseState_IncorectIdentity').addEventListener('click', function(event) {
    requestIdentityEmailPermission( function(granted) {
        // The callback argument will be true if the user granted the permissions.
        if (granted) {
            backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
        } else {
            alert('Permission To Access Identity.Email Not Granted')
        }
    } );
});
document.getElementById('test_setLicenseState_invalidLicenseState_KeyPresentButNoAccessToUserIdentity').addEventListener('click', function(event) {
    requestIdentityEmailPermission( function(granted) {
        // The callback argument will be true if the user granted the permissions.
        if (granted) {
            alert('Permission To Access Identity.Email Granted, will rewoke it now');
            chrome.permissions.remove({
                        permissions: ['identity.email'], //identity не требует consent скрина, identity.email - требует! и 100% блокирует extension на апдейте если указано не в optional_permissions
                        origins: []
                    }, function(removed) {
                            if (removed)
                                alert('The permissions have been removed');
                            else
                                alert('The permissions have not been removed');
                            });
        } else {
            alert('OK - Permission To Access Identity.Email Not Granted')
        }
    } );
    backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
});
document.getElementById('test_setLicenseState_invalidLicenseState_KeyPresentButNoAccessToUserIdentity2').addEventListener('click', function(event) {
    alert('LogOut From Chrome');
    backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
});
document.getElementById('test_setLicenseState_invalidLicenseState_NoLicenseKey').addEventListener('click', function(event) {
    backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});
});

//---------------------------------------------------------------------------------------

function setProTabToLicenseSetState(blockIdToShow, licenseStateValues) {
    document.getElementById('licenseKeyValidProTabBlock').style.display = 'none';
    document.getElementById('licenseKeyAbsentProTabBlock').style.display = 'none';
    document.getElementById('licenseKeyNotMatchUserIdentityProTabBlock').style.display = 'none';
    document.getElementById('licenseKeyPresentButChromeIsNotSignedInProTabBlock').style.display = 'none';
    document.getElementById('licenseKeyPresentButEmailPermissionIsNotGrantedProTabBlock').style.display = 'none';


    document.getElementById(blockIdToShow).style.display = '';

    if(licenseStateValues && licenseStateValues.licenseKey) Array.prototype.forEach.call(document.getElementsByName('licensee'), function(item, index) {
        item.innerText = licenseStateValues.licenseKey.licenseeEmail;
    });
}

function setBackupTabToLicenseSetState(blockIdToShow) {
    document.getElementById('licenseKeyAbsentBackupTabBlock').style.display = 'none';
    document.getElementById('licenseKeyPresentBackupTabBlock').style.display = 'none';

    document.getElementById(blockIdToShow).style.display = '';
}

function getArrayFromLocalStorage(arrayName) {
    try {
        var r = JSON.parse(localStorage[arrayName]);
    } catch(e) {
        r = [];
    }

    return r;
}


function packLicenseKey(keyObj) {
    return encodeURIComponent(btoa( JSON.stringify(keyObj) ));
}

async function console_log_licenseKeysLinks(console) {
    var keys = (await chrome.storage.local.get('licenseKeys')).licenseKeys || [];
    keys.forEach(function(key){
        console.log(key);
        console.log("Key Apply URL:");
        console.log(chrome.runtime.getURL('options.html')+'?setkey='+packLicenseKey(key));
    });
}

async function console_log_licenseKey(header) {
    console.log(header);
    console.log("License Keys:");
    await console_log_licenseKeysLinks(console);
    console.log("To Drop License Keys type: localStorage.licenseKeys_ = localStorage.licenseKeys; delete localStorage.licenseKeys; or dropkey()");
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function processUrlSetKeyCommand() {
    var urlVars = getUrlVars();
    if(urlVars['setkey']) {
       
        chrome.runtime.sendMessage({request:"message2bkg_setLicenseKey", key:urlVars['setkey']})
        .then( (isKeyValid) => {
            if(!isKeyValid) setTimeout(function(){alert("Submitted Pro License Key is not valid.\n\nIf you feel that you see this message by mistake please contact support@tabsoutliner.com")},100); //setTimeout because in other case alert block css styles apply on page load till dismissed
        });

        showBackupNowBtnOnMainToolbar();
    }
}

function showBackupNowBtnOnMainToolbar() {
    document.getElementById('showBackupNowBtn').checked = true; // This is not invoke .onchange automatically
    document.getElementById('showBackupNowBtn').onchange(null); // it's use .this inside
}

function enableTestButtons() {
    document.getElementById("testButtonsBlock").style.display = "";
}

function revalidateLicenseKey() {
    backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});    
}

function requestIdentityPermissions_continueToRevalidateLicenseKey() {
    // Modal will be closed after we return from this function!

    // Permissions must be requested from inside a user gesture, like a button's click handler.
    requestIdentityPermisionsContinueIfGrantedShowErrorsIfNot( revalidateLicenseKey );
}

function requestIdentityPermissions_continueToEnableBackupTrialControls() {
    // Modal will be closed after we return from this function!

    // Permissions must be requested from inside a user gesture, like a button's click handler.
    requestIdentityPermisionsContinueIfGrantedShowErrorsIfNot( enableBackupTrialControls );
}

function enableBackupTrialControls() {
    setBackupTabToLicenseSetState('licenseKeyPresentBackupTabBlock');
    // а шо если юзер тыцнет кнопку быстрее чем gapi загрузится или оно вообще не загрузится бо связи нет!!!
    // надо это синхронизировать
    addGapiScript_setAuthToken_listGdriveFiles();

    //FF_REMOVED_GA ga_screenview('Backup Trial UI');
}

var isChromeSignInRequestedFromWarning = false;
function signInToChrome(skipReport) {
    isChromeSignInRequestedFromWarning = true;

    //FF_REMOVED_GA  if(!skipReport) ga_event_access_states('Chrome Not SignedIn Warning - SignIn Btn Clicked','R',null,null);

    chrome.identity.getAuthToken({'interactive':true, 'scopes':[""]}, function(token) { 
        /*empty scopes will not result in additional consent screen about google drive access, to not distract user from buy sequence*/
        console.log('##############################'); // It's newer called in case of empty scopes
        //We come here if Sync is turned off!!!
        alert('Sync is turned off, please turn in on in Chrome profile settings');
    })
}

var signInToChromeBtn_keyPresentBlock = document.getElementById('signInToChromeBtn_keyPresentBlock');
if(signInToChromeBtn_keyPresentBlock) signInToChromeBtn_keyPresentBlock.onclick = function(event) {
    //FF_REMOVED_GA ga_event_access_states('Chrome Is Not SignedIn - Key Present Block - SignIn Btn Clicked','R',null,null);
    signInToChrome(true); // note that also we will not get 'SignIn Success' ga event, as it's fired only in No Key block
};

function setBackupControlsStateToTrialMode(isTrial) {
    if(isTrial) {
        setBackupTabToLicenseSetState('licenseKeyAbsentBackupTabBlock');
        document.getElementById('trialModeBackupWarning').style.display = '';
    } else {
        setBackupTabToLicenseSetState('licenseKeyPresentBackupTabBlock');
        document.getElementById('trialModeBackupWarning').style.display = 'none';
    }


}

var PRO_LICENSE_KEY_VALID = false;

function msg2view_setLicenseState_valid(response) {
    let licenseStateValues = response.licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/;

    PRO_LICENSE_KEY_VALID = true;
    setProTabToLicenseSetState('licenseKeyValidProTabBlock', licenseStateValues);
    setBackupControlsStateToTrialMode(false);

    addGapiScript_setAuthToken_listGdriveFiles();

    console_log_licenseKey("License Key Valid");

    reportScreeViewIfChanged('Options - Paid');
}

function msg2view_setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey(response) {
    let licenseStateValues = response.licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/;
    
    setProTabToLicenseSetState('licenseKeyNotMatchUserIdentityProTabBlock', licenseStateValues);
    setBackupControlsStateToTrialMode(false);

    addGapiScript_setAuthToken_listGdriveFiles();

    console_log_licenseKey("License Key does not match User Identity");

    reportScreeViewIfChanged('Options - Key Present - Invalid');
}
    
function msg2view_setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn(response) {
    let licenseStateValues = response.licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/;
    
    setProTabToLicenseSetState('licenseKeyPresentButChromeIsNotSignedInProTabBlock', licenseStateValues);
    setBackupControlsStateToTrialMode(false);

    addGapiScript_setAuthToken_listGdriveFiles();

    console_log_licenseKey("Key Present - Chrome Is Not Signed In");

    reportScreeViewIfChanged('Options - Key Present - Chrome Is Not Signed In');
}
    
function msg2view_setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission(response) {
    let licenseStateValues = response.licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/;
    
    setProTabToLicenseSetState('licenseKeyPresentButEmailPermissionIsNotGrantedProTabBlock', licenseStateValues);
    setBackupControlsStateToTrialMode(false);

    addGapiScript_setAuthToken_listGdriveFiles();

    console_log_licenseKey("Key Present - Chrome Signed In - No Email Permission");

    reportScreeViewIfChanged('Options - Key Present - Chrome Signed In - No Email Permission');
}

function msg2view_setLicenseState_invalid_NoLicenseKey(response) {
    let licenseStateValues = response.licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/;
    
    setProTabToLicenseSetState('licenseKeyAbsentProTabBlock');
    setBackupControlsStateToTrialMode(true);

    if(isChromeSignInRequestedFromWarning && licenseStateValues.onSignInChanged_isSignedIn) {
        isChromeSignInRequestedFromWarning = false; //Prevent multiple alerts if several options tabs opened

        //FF_REMOVED_GA ga_event_access_states('Chrome Not SignedIn Warning - SignIn Success','Y',null,null);

        clearIdentityAccessErrorWarnings(); // Remove "Chrome is not SignedIn" warning showed after BUY click, if user acomplish SignIn

        chrome.tabs.getCurrent(function(tab) {
            setTimeout( function() { // Wee need setTimeout as for some reason chrome refresh SignIn page that was opened in new tab, and take focus back to it after Sign in
                chrome.windows.update(tab.windowId, {focused:true}, null); // need for popup version of Options
                chrome.tabs.update(tab.id, {active:true}, null);
            }, 3000); // and unfortunately that's not always suficient as mentioned SignInTab  refresh might happen after 3s, but it's better than nothing or risking switch focus from the purchase page
        });

        // this alert return focus to the Options Popup and prevent switching from it on chrome SignInTab refresh.
        // It does not return focus if Options opened in a normal Tab, but at least it inform user that everything is okey
        // (as SignInTab does not idicate that SignIn is successfull actually and continue requesting password)
        // Also, as it's block the Tab rendering pipeline, it's actualy return focus to it after user click OK even if they do so on other tab.
        alert('Chrome has been successfully Signed In.\n\nYou can now continue Tabs Outliner purchase process.');
    }

    console.log("No License Key present; try localStorage.licenseKeys = localStorage.licenseKeys_; or returnkey()");

    reportScreeViewIfChanged('Options - Free');
}

function dropInvalidLicenseKey() {
    //FF_REMOVED_GA ga_event('Drop Invalid License Key Btn Clicked');
    dropkey();
}

function dropkey() {
    localStorage.licenseKeys_ = localStorage.licenseKeys; delete localStorage.licenseKeys;
    chrome.storage.sync.remove('licenseKeys');

    backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});    
}

function isEmailPemissionPresent(callback) {
    chrome.permissions.contains({
        permissions: ['identity.email'],
        origins: []
    }, function(result) {
        if (result) {
            console.log('identity.email permission present');
            callback && callback(true);
        } else {
            console.log('identity.email permission absent');
            callback && callback(false);
        }
    });
}

function dropEmailPemission() {
    isEmailPemissionPresent(function(isPresent){
        chrome.permissions.remove({
            permissions: ['identity.email'],
            origins: []
        }, function(removed) {
            console.log("removed status:", removed);
            isEmailPemissionPresent();
            if (removed) {
              // The permissions have been removed.
            } else {
              // The permissions have not been removed (e.g., you tried to remove
              // required permissions).
            }
        });
    });
}


function returnkey() {
    localStorage.licenseKeys = localStorage.licenseKeys_
}

var lastSeenScreen;
function reportScreeViewIfChanged(screenName) {
    if(screenName != lastSeenScreen) {
        //FF_REMOVED_GA ga_screenview(screenName);
        lastSeenScreen = screenName;
    }
}

async function getOption(optionName) {
    return (await chrome.storage.local.get(optionName))[optionName];
}

function setOption(optionName, value) {
    return chrome.storage.local.set({ [optionName]: value });
}

function testSetAllOldLocalStorageOptions() {
    localStorage['relateNewTabToOpener']            = true;
    localStorage['openTabsOutlinerInLastClosedPos'] = true;
    localStorage['openOnStatup']                    = true;
    localStorage['doNotAutoscroll']                 = true;
    localStorage['openSavedWindowsInOriginalPos']   = true;
}

console.log("Type enableTestButtons() for messages tests");
console.log("Use Account Permissions to test rewoked access to GDrive");
console.log("dropEmailPermission() to test rewoked access to email");



processUrlSetKeyCommand();

backgroundport.postMessage({request:"request2bkg_checkAndUpdateLicenseStatusInAllViews"});



//
//<!-- +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//<a id="exportBtnInFile" href="#" title="Export Tree">Export the Current Session Tree as File</a>
//<br/>
//<a id="exportBtnInDb" href="#" title="Export Tree">Force Current Session Tree Save To IndexedDb</a>
//<br/>
//<a id="importBtn" href="#" title="Import Tree">Import and Replace the Current Session Tree (WARNING! This will delete all saved nodes in current Tree!!!). Open windows in current session will be merged to imported session.</a>
//<br/>
//
//<div style="vertical-align: middle">
//<span style="display: inline-block;padding:2px;border:solid 1px #CCC">
//    <span style="display: inline-block;border-radius: 5px;padding: 1px 9px 1px 9px;text-align: center;border:dashed 1px gray" id="drop_zone">Drop exported session here</span>
//</span> or <input style="margin-bottom:4px" type="file" id="files" name="files[]"/>
//</div>
//
//<output id="list"></output>
//
//<ul id="filelist"></ul>
//
//<hr />
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->
//
//document.getElementById('importBtn').addEventListener('click', importTree);
//
//document.getElementById('exportBtnInFile').addEventListener('click', exportTreeInFile);
//document.getElementById('exportBtnInDb').addEventListener('click', exportTreeInDb);
//
//
////document.getElementById("exportBtn").addEventListener("dragstart", function(evt){
////        evt.dataTransfer.setData("DownloadURL", getExportFileDetails());
////},false);
//
//function getExportFileDetails(){
//    return "application/octet-stream:Tree.json:http://test.come/Tree.json";
//}
//
//
//function startThreadCheck() {
//    var CHECK_INTERVAL = 30;
//    console.log("@@@@@ THREAD CHECK STARTED, interval:", CHECK_INTERVAL);
//
//    var startTime = (new Date()).getTime();
//    var secondStartTime = startTime;
//    var lastCheckTime = startTime;
//    var checks = [];
//    function threadCheckCheck() {
//        var time = (new Date()).getTime();
//        if((time - lastCheckTime) <= (CHECK_INTERVAL + 7))
//            checks.push('.');
//        else
//            checks.push(/*(time - startTime)+":d"+*/(time - lastCheckTime));
//
//        if(time - secondStartTime >= 1000) {
//            secondStartTime = time;
//            checks.push('|');
//        }
//
//        if((time - startTime) < 5000) {
//            setTimeout(threadCheckCheck, CHECK_INTERVAL);
//        } else {
//            var msg = "";
//            for(var i = 0; i < checks.length; i++) msg += checks[i] + ' ';
//            console.log("@@@@@ THREAD CHECKS:\n", msg);
//        }
//        lastCheckTime = time;
//    }
//
//    threadCheckCheck();
//}
//
//function fsErrorHandler(err){
//    console.error('ERROR on file system access. FileError.code:', err['code']);
//}
//
//
//window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
//window.BlobBuilder        = window.BlobBuilder || window.WebKitBlobBuilder;
//
//function exportTreeInDb() {
//    startThreadCheck();
//    saveCurrentSessionInDbNow();
//}
//
//function exportTreeInFile() {
//    document.getElementById('list').innerHTML = '';
//    startThreadCheck();
//    saveCurrentSessionAsFileNow(function(fileEntry){
//        document.getElementById('list').innerHTML = '<ul><li>' +
//                '<a href="'+fileEntry.toURL()+'">Exported Data (save by context menu item: "Save link as...")</a>' +
//                '</li></ul>';
//
//        window.requestFileSystem(window.PERSISTENT, 1024*1024, onInitFs_listAllFiles, fsErrorHandler);
//    });
//}
//
//function toArray(list) {
//  return Array.prototype.slice.call(list || [], 0);
//}
//
//function listResults(entries) {
//  // Document fragments can improve performance since they're only appended
//  // to the DOM once. Only one browser reflow occurs.
//  var fragment = document.createDocumentFragment();
//
//  entries.forEach(function(entry, i) {
//
//    var li = document.createElement('li');
//    li.innerHTML = [(entry.isDirectory ? "Dir:" : "File:"), entry.name].join(' ');
//    fragment.appendChild(li);
//  });
//
//  document.querySelector('#filelist').innerHTML = '';
//  document.querySelector('#filelist').appendChild(fragment);
//}
//
//function onInitFs_listAllFiles(fs) {
//
//  var dirReader = fs.root.createReader();
//  var entries = [];
//
//  // Call the reader.readEntries() until no more results are returned.
//  var readEntries = function() {
//     dirReader.readEntries (function(results) {
//      if (!results.length) {
//        listResults(entries.sort());
//      } else {
//        entries = entries.concat(toArray(results));
//        readEntries();
//      }
//    }, fsErrorHandler);
//  };
//
//  readEntries(); // Start reading dirs.
//}
//
//
//
//var importFile;
//
//function importTree() {
//    var reader = new FileReader();
//
//    // Closure to capture the file information.
//    reader.onload = function(e) {
//        var span = document.createElement('span');
//        span.innerHTML = e.target.result;
//        document.getElementById('list').insertBefore(span, null);
//    };
//
//
//    reader.readAsText(importFile); // Also can be read by readAsDataURL(), readAsBinaryString(), readAsArrayBuffer().
//                                   // Monitoring read progress and reading file by slices is also supported
//}
//
//
//
//// Export/Import ---------------------------------------------------------------------------------------
//document.getElementById('files').addEventListener('change', handleFileSelect, false);
//
//document.getElementById('drop_zone').addEventListener('dragover', handleDragOver, false);
//document.getElementById('drop_zone').addEventListener('drop', handleFileDrop, false);
//
//function handleFileSelect(evt) {
//    processSelectedFiles(evt.target.files); // FileList object
//}
//
//function handleFileDrop(evt) {
//    evt.stopPropagation();
//    evt.preventDefault();
//
//    processSelectedFiles(evt.dataTransfer.files); // FileList object.
//}
//
//function handleDragOver(evt) {
//    evt.stopPropagation();
//    evt.preventDefault();
//    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
//}
//
//function processSelectedFiles(files) {
//    // files is a FileList of File objects. List some properties.
//    var output = [];
//    for (var i = 0, f; f = files[i]; i++) {
//    output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
//                f.size, ' bytes, last modified: ',
//                f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
//                '</li>');
//      importFile = f;
//    }
//    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
//}
//
