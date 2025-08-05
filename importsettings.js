"use strict";

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

//Cut&Paste from options.js
function getUrlVars(href) {
    var vars = {};
    var parts = href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
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

function importOptionFromLocalStorage(fieldName) {
    if(localStorage[fieldName])
        chrome.storage.local.set({ [fieldName]: true });
}

function importSettingsFromLocalStorage() {
    try {
        var keys = getArrayFromLocalStorage('licenseKeys');
        if(keys && keys.length) console.log("Upgrade to manifest v3 - Keys found");
        keys.forEach(function(key){
            console.log("Key --------");
            console.log(key);
            console.log(key.serial);

            // достаем ключ как его достает options при открытии своей странички, код скутендпащен и кривоват
            // бо ващето ключ у нас уже есть, тупо генерить href и с нова его от туда вытаскивать. но лень формат проверять
            let hrefWithSetKeycommand = chrome.runtime.getURL('options.html')+'?setkey='+packLicenseKey(key);
            console.log("Key Apply URL:");
            console.log(hrefWithSetKeycommand);
            let keyFromHref = getUrlVars(hrefWithSetKeycommand)['setkey'];
            if(keyFromHref) 
                chrome.runtime.sendMessage({request:"message2bkg_setLicenseKey", key:keyFromHref})
        });
    } catch(e) {
        console.error(e);
    }
    // Хочу по дефолту TreeStyleTabs 
    localStorage['relateNewTabToOpener'] = true;
    importOptionFromLocalStorage('relateNewTabToOpener');

    importOptionFromLocalStorage('openTabsOutlinerInLastClosedPos');

    importOptionFromLocalStorage('openOnStatup');    

    importOptionFromLocalStorage('doNotAutoscroll');    

    importOptionFromLocalStorage('openSavedWindowsInOriginalPos');      
}

if(!localStorage['localStorageOptionsOnManifestV3UpgradeImportDone']) {
    console.log("Upgrade to manifest v3 - import settings from localStorage started");

    importSettingsFromLocalStorage();

    localStorage['localStorageOptionsOnManifestV3UpgradeImportDone'] = true;
}
