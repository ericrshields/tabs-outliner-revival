/** @preserve Copyright 2012, 2013, 2014, 2015, 2022 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

console.log('BACKGROUND.JS STARTED', new Date());

//chrome.windows.getAll({populate:true}, function(zz){console.log("@@@@@@@@@@@@@@@@",zz)});
//chrome.windows.onCreated.addListener(       function(windowObj)                      { console.log('>>>>>>>>>>>>>>>Window onCreated winid:' + windowObj.id, windowObj)} );
//chrome.tabs.onCreated.addListener(          function(tab)                            { console.log('=======Tab onCreated tabid:' + tab.id + '; url:' + tab.url + '; title:' + tab.title, tab)} );


/** @define {boolean} */
var debugLogChromeOperations = false;

var backEndInterface = new BackEndInterface();

var lastSeenTabs = [];

checkTabsChanges(); // Запускает setTimeout(tabsCheck, CHECK_INTERVAL);

var winIdForWhichNeedSkipScrollToView = -1;

// var DETACH_WAITING_LIST = [];
var mainActiveSessionViewWinId = null;
var mainActiveSessionViewTabId = null;
var activeSession;

var notUnexpectedRemovedTabsIds = [];
var notUnexpectedRemovedWindowsIds = [];

chrome.action.onClicked.addListener(browserAction_onClicked);

if(chrome.runtime.id === 'eggkanocgddhmamlbiijnphhppkpkmkl') {
    // This is Chrome Web Store Version
    chrome.action.setBadgeBackgroundColor({color:[0x32, 0x68, 0xcf, 255]/*"#3268cf", ubunta Chrome does not support css colors*/}); 
} else {
    // This our local test version
    chrome.action.setBadgeBackgroundColor({color:[0x11, 0x78, 0x34, 255]/*"#ff9600", ubunta Chrome does not support css colors*/}); 
}

// Реестрируем функционал обновления каунтеров табов и окон на тултипе кнопки нашего расширения
// теоретично updateBrowserActionTitle не юзает (не юзал) ничего из ActiveSession
chrome.tabs.onCreated.addListener(    updateBrowserActionTitle );
chrome.tabs.onRemoved.addListener(    updateBrowserActionTitle );
chrome.windows.onCreated.addListener( updateBrowserActionTitle );
chrome.windows.onRemoved.addListener( updateBrowserActionTitle );


//onload = function() { 
    setTimeout( function() {   // С setTimeout вроде стабильней Reload работает, без вылетов
        console.log("=== TabsOutliner Background script code started ===");

        activeSession = new ActiveSession( 
            function continueExecution() {
                console.log("ActiveSession initialized");
                updateBrowserActionTitle();
                getOption('openOnStatup').then( (openOnStatup) => {
                    if(!!openOnStatup) openTabsOutlinerMainView();
                });
            });
    }, 300 );
//};

//onunload = function() {
//    localStorage['lastUnload'] = Date.now();
//};

var currentSessionSnapshotFilename = 'currentSessionSnapshot.json';

var userSelectedFileToOpen;

chrome.commands.onCommand.addListener(processCommand); // save_close_current_tab, save_close_current_window, save_close_all_windows

chrome.identity.onSignInChanged.addListener(function( accountInfo, isSignedIn) {
    checkAndUpdateLicenseStatusInAllViews( accountInfo, isSignedIn ); // Погасит автоматом лишние еррор месаги когда юзер залогается в хром
});

// License key module ------
var licenseKeyLinkRegExp = /\?tabsoutlinerkey=(.*)/;
var alreadyDetektedLicenseKey;

chrome.tabs.onUpdated.addListener( licenseKeyLinkHandler );

setTimeout(function() {
    chrome.storage.sync.get({'licenseKeys': []}, adapter_proceedLicenseKeysFromSyncStorage);

    chrome.storage.onChanged.addListener(function(changes, namespace) { // But it's does not called on restart if changes happens when we was offline
        //   for (var key in changes) {
        //     var storageChange = changes[key];
        //     console.log('Storage key "%s" in namespace "%s" changed. ' +
        //                 'Old value was "%s", new value is "%s".',
        //                 key,
        //                 namespace,
        //                 storageChange['oldValue'],
        //                 storageChange['newValue']);
        //   }
        if(changes['licenseKeys']) {
            // var storageChange = changes['licenseKeys'];
            // console.log(storageChange['oldValue']);
            // console.log(storageChange['newValue']);

            proceedLicenseKeysFromSyncStorage(changes['licenseKeys']['newValue']); //если dropkey() было вызвано и sync storage было очищено, тогда срабатывает onChanged но changes['licenseKeys']['newValue'] == undefined
        }
    });
}, 1000); // No real reason for setTimeout, this is just to be safe and maybe give some time for Chrome to update Sync storage, though unlikely 1second is enough for that

// Детектаем ключ при инстале... нафиг надо, але хай буде
//chrome.windows.getAll({'populate':true},
//    function (windows) { windows.forEach( function(win) { win.tabs.forEach( function(tab) {
//        licenseKeyLinkHandler(null, null, tab)})
//    })}
//);

var VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick = "__a";

// ----------------------------------------------------------------------------------------------------------------------
//var viewPorts = [];
var nextGlobalViewId = 1234;
var instanceId = Date.now();

var viewsCommunicationInterface = {
    viewPorts:[],

    viewRequestScrollNodeToViewInAutoscrolledViews:function(idMVC) {
        this.viewPorts.forEach( function (port) {
            try {
                port.postMessage({command: "msg2view_requestScrollNodeToViewInAutoscrolledViews", idMVC: idMVC});
            } catch(exception) {
                // To prevent iteration break on any error, especialy: Uncaught Error: Attempting to use a disconnected port object
                console.error(exception);
            }
        })
    },

    portConnected:function(port) {
        this.viewPorts.push(port)
    },

    portDisconected:function(port) {
        const index = this.viewPorts.indexOf(port);
        if (index > -1) { // only splice array when item is found
            this.viewPorts.splice(index, 1); // 2nd parameter means remove one item only
        } else {
            console.log("port.onDisconnect - warning - port was not found in ports list");
        }
    },

    postMessageToAllViews:function(message) {
        this.viewPorts.forEach( function (port) {
            try {
                port.postMessage(message);
            } catch(exception) { // To prevent iteration break on any error, especialy: Uncaught Error: Attempting to use a disconnected port object, которые на постой во время дебага образуются
                console.error(exception);
            }
        })
    },

    //Cut&Paste notifyObserversInViews_onNodeUpdated
    notifyObserversInViews:function(targedNodeIdMVC, parameters) {
        this.postMessageToAllViews({command:"msg2view_notifyObserver", idMVC:targedNodeIdMVC, parameters:parameters});
    },

    //Cut&Paste notifyObserversInViews
    notifyObserversInViews_alsoUpdateCollapsedParents:function(targedNodeIdMVC, parameters, parentsUpdateData) {
        this.postMessageToAllViews({command:"msg2view_notifyObserver", idMVC:targedNodeIdMVC, parameters:parameters, parentsUpdateData:parentsUpdateData});
    },

    //Cut&Paste notifyObserversInViews
    notifyObserversInViews_onNodeUpdated:function(targedNodeIdMVC, modelDataCopy) {
        this.postMessageToAllViews({command:"msg2view_notifyObserver_onNodeUpdated", idMVC:targedNodeIdMVC, modelDataCopy:modelDataCopy});
    }


    // Также по сути тут должны бы были все методы ниже быть что с request2bkg_ начинаются

};

chrome.runtime.onConnect.addListener(function(port) {
    console.log("chrome.runtime.onConnect", port);
    viewsCommunicationInterface.portConnected(port);

    port.onMessage.addListener(function(msg) {
        console.log(msg.request, msg);

        self[msg.request](msg,port); if(false) { // Читай комент ниже:
            // Этот блок никода не вызывается, тут это все для ideшке что б по GetUsage & Search
            // было понятно что от сюда эти вызовы происходят
            // А происходят они динамически, в строчке self["msg.request](msg,port);
            request2bkg_getListOfAllActiveWindowNodes_continueToScrollUpToNextOpenWindow_onRequestedPort(msg,port);
            request2bkg_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick(msg,port);
            request2bkg_get_tree_structure(msg,port);
            request2bkg_setCursorToLastChildOfRoot(msg,port);
            request2bkg_activateNode(msg,port);
            request2bkg_activateHoveringMenuActionOnNode(msg, port);

            request2bkg_setCursorToNodeOrToFirstCollapsedParent(msg, port); // ??? Нихто такой месаги не шлет

            request2bkg_onOkAfterSetNodeTabTextPrompt(msg, port);
            request2bkg_onOkAfterSetNodeNoteTextPrompt(msg, port);
            request2bkg_onOkAfterSetNodeWindowTextPrompt(msg, port);

            request2bkg_addNoteAsNextSiblingOfCurrentNode(msg, port);
            request2bkg_addNoteAsLastSubnodeOfCurrentNode(msg, port);
            request2bkg_addNoteAsParentOfCurrentNode(msg, port);
            request2bkg_addNoteAsFirstSubnodeOfCurrentNode(msg, port);
            request2bkg_addNoteAsPrevSiblingOfCurrentNode(msg, port);
            request2bkg_addNoteAtTheEndOfTree(msg, port);

            request2bkg_actionAddSeparatorBelove(msg, port);
            request2bkg_actionAddGroupAbove(msg, port);

            request2bkg_deleteHierarchy(msg, port);

            request2bkg_communicateDragStartDataToOtherViews(msg, port);

            request2bkg_moveHierarchy(msg, port);
            request2bkg_invertCollapsedState(msg, port);

            request2bkg_performDrop(msg, port);

            request2bkg_moveCursor_toParent_butNotToRoot(msg, port);
            request2bkg_moveCursor_toFirstSubnode_expandIfCollapsed(msg, port);
            request2bkg_moveCursor_down(msg, port);
            request2bkg_moveCursor_up(msg, port);
            request2bkg_moveCursor_toLastSiblingInSameLevel(msg, port);
            request2bkg_moveCursor_toFirstSiblingInSameLevel(msg, port);

            request2bkg_actionFlattenTabsHierarchy(msg, port);
            request2bkg_actionMoveWindowToTheEndOfTree(msg, port);

            request2bkg_onViewWindowBeforeUnload_saveNow(msg, port);

            request2bkg_cloneTabsOutlinerView(msg, port);

            request2bkg_checkAndUpdateLicenseStatusInAllViews(msg, port);

            request2bkg_authTokenGranted_notifyAllOpenedViews(msg, port);
            request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews(msg, port);

            request2bkg_performGdriveBackup(msg, port);

            request2bkg_focusTab(msg, port);

            request2bkg_closeAllWindowsExceptThis(msg, port);

            request2bkg_optionsChanged_notifyAllViews(msg, port);

            request2bkg_storeUserSelectedFile(msg, port); 

        }

    });

    port.onDisconnect.addListener(function(port) {
        console.log("port.onDisconnect", port);
        viewsCommunicationInterface.portDisconected(port);
    });
});

const serviceWorkerId = Date.now() + Math.random();;


chrome.runtime.sendMessage({request:"message2bkg_twoAliveServiceWorkerPreventionWorkaround", serviceWorkerId:serviceWorkerId})
.then( (response) => { console.error("GA_ MUST NEWER HAPPEN -  2 SERVICE WORKERS EXIST!!!", response) } )// search for "GA_ MUST NEWER HAPPEN" for comments, приходе в обидва service worker instance аби не було chrome.runtime.reload()
.catch((error) => { /* EXPECTED - Error: Could not establish connection. Receiving end does not exist. */ });


chrome.runtime.onMessage.addListener(
    function(msg, sender, sendResponse) {
      console.log("chrome.runtime.onMessage", msg, sender);
      if (msg.request == "message2bkg_getCurrentSessionAsJsonString") {
            console.time("Serialize Tree");
            var exportData = serializeActiveSessionToOperations();//serializeActiveSessionToJSO();
            console.timeEnd("Serialize Tree");
        
            console.time("Stringify Tree");
            var exportDataString = JSON.stringify(exportData);
            console.timeEnd("Stringify Tree");
        
            sendResponse(exportDataString);
      }
      if (msg.request == "message2bkg_setLicenseKey") {
            sendResponse(setLicenseKey(msg.key));
      }
      if (msg.request == "message2bkg_getDataForLocalBackup") {
            sendResponse(serializeActiveSessionToOperations());
      }
      if (msg.request == "message2bkg_twoAliveServiceWorkerPreventionWorkaround") {
            console.error("GA_ MUST NEWER HAPPEN - 2 SERVICE WORKERS EXIST!!! THIS HAPPENS DURING DEVELOPMENT WHEN SOURCES IS CHANGED FOR UNPACKED EXTENTION");
            // Это фикс для следующей проблемы:
            // - !!!!! после хибернации и востановления машины, на другой день, при том что были открыты dev panels service workera во время хибернации
            // кром создал вторую какуюто кривую копию service worker (я чот не вижу чтоб там чтото работало, но это не точно
            // оба висят и доступны одновременно, view уже открытые общаются с первым
            // !!! но новые view не открываются по нажатию кнопки extention!!!!
            // !!! у них разные исходники !!!
            //
            // !!!!!!!!~~~~!!!!!!!! Это все ниже, скорее всего, связано с тем что я меняю в Load Unpacked расширении сорцы 
            // service worker скрипта (background.js обычно) и не сделал reload() или update.
            // последуюзее нажатие на кнопку расширения (если все tree view были закрыты) открывает пустое поломанное окно без дерева
            // а потом уже вообще нихрена не открывает и появляется вторая копия  service workera запущенная (наверно что с новым кодом) 
            // и оно все не работает уже после этого, 
            //         - возможно есть смысл это исследовать получше, както такое детектать и разруливать 2 версии паралельные service worker запущенные
            //         но в принципе эта ситуация возможна тока при девелопменте
            //
            // !!!! небольшое исследование что происходит, при старте второго service worker (после изменения сорцов!!!!! и нажатии action button при закрытых всех View)
            // второй инстантс стартует и весь его код выполняется
            // но, те event listener что он вешает не воспринимают потом новые events
            // также event listener повешенные предыдущим service worker перестают работать
            //
            // - соответственно, можно попробовать просто вызвать reload() если задетектано присутствие живого service worker, 
            //   чтоб всех убить и не попасть в ситуацию двох запущенных service worker
            //
            // и вообще никакие месаги им не приходят об обновлениях в хроме
            // явно нужен reload
            //
            // !!!reload() в консоли все прибил и норм рестартанул но прикол что расширение было тупо дохлым по сути
            //         - зарегать вотч дог алерты? которые сделают релоад если такое дело?
            //         - эта бага по сути описана
            //
            // - надо отлавливать такую ситуацию чтоб они оба не перетирали базу одновременно
            //     - можно через базу инстанс тока один гарантировать            
            
            console.log("msg.serviceWorkerId == serviceWorkerId", msg.serviceWorkerId == serviceWorkerId, msg.serviceWorkerId, serviceWorkerId);

            if(msg.serviceWorkerId != serviceWorkerId) //ця перевырка не треба, ми не маэмо сюди влетати теоретично, но на всяк випадок 
                chrome.runtime.reload();
        
            sendResponse(msg.serviceWorkerId == serviceWorkerId); 
      }      
    }
);

function request2bkg_storeUserSelectedFile(msg, port) {
    storeUserSelectedFile(msg.file);
}

function request2bkg_optionsChanged_notifyAllViews(msg, port) {
    optionsChanged_notifyAllViews(msg.changedOption);
}

function request2bkg_closeAllWindowsExceptThis(msg, port) {
    closeAllWindowsExceptThis(msg.preserveWinId);
}

function request2bkg_focusTab(msg, port) {
    focusTab(msg.tabWindowId, msg.tabId); 
}

function request2bkg_performGdriveBackup(msg, port) {
    performGdriveBackup(msg.backupOperationId_);
}

function request2bkg_authTokenGranted_notifyAllOpenedViews(msg, port) {
    callOnAuthorizationTokenGranted_ForAllViews();
}

function request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews(msg, port) {
    authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews();
}

function request2bkg_checkAndUpdateLicenseStatusInAllViews(msg, port) {
    checkAndUpdateLicenseStatusInAllViews();
}


function request2bkg_onViewWindowBeforeUnload_saveNow(msg, port) {
    activeSession.treeModel.saveNowOnViewClose();
}

function request2bkg_cloneTabsOutlinerView(msg, port) {
    cloneTabsOutlinerView(msg.tabsOutlinerInitiatorWindow_outerWidth, msg.tabsOutlinerInitiatorWindow_screenX, msg.sourceViewPageYOffset);
}

function request2bkg_performDrop(msg, port) {
    //console.log("request2bkg_performDrop --------------------------------------------------------------------");
    //console.log(msg.dataTransferContainer);

    msg.dataTransferContainer.items = Object.keys(msg.dataTransferContainer).map((key) => { return { type: key }; }); // This is for operation of if( getItemFromDragDataStoreByMimeType() )
    msg.dataTransferContainer.getData = function(type) { return this[type]; };

    var nodesHierarchy = prepareDragedModel(msg.dataTransferContainer, msg.instanceUnicalClipboardDataMimeType, activeSession.treeModel); // было раньше-> песец, accesing global event - и при этом это ещё и работает << это так раньше было, хз зачем, теперь передаю event из вызывающей функции
    if(nodesHierarchy) activeSession.treeModel.moveCopyHierarchy( msg.dropTarget, nodesHierarchy, msg.dropAsCopy, port/*передаётся для активации prompt диалога при вставки note + для установки курсора на вставленный узел*/ );
}

function request2bkg_actionMoveWindowToTheEndOfTree(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    var tabsOrganizer = nodeModel.findFirstSavedOrOpenTabsOrganizerInPathToRoot();
    if(tabsOrganizer) tabsOrganizer.moveToTheEndOfTree();
}

function request2bkg_actionFlattenTabsHierarchy(msg, port) {
    // For Window or Group or saved Window - this will flatten all its tabs
    // If called on tab - it's flaten the tabs above the current tab
    // it's skip other Groups (but not if we collapsed)
    // it's not flatten notes
    // it's flatten separators only if they attached directly on tab or saved tab (not if on any other node)


    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    var a = [nodeModel];

    if(nodeModel.colapsed) nodeModel.findAllTabsOrganizersInsideHierarchy(a);

    a.forEach((node) => node.flattenTabsHierarchy_skipTabsOrganizers() )
}

function request2bkg_moveCursor_toFirstSiblingInSameLevel(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    if(!nodeModel.parent) return; // This is root;
    if(nodeModel.parent.subnodes.length == 0) return;

    requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, nodeModel.parent.subnodes[0], false);
}

function request2bkg_moveCursor_toLastSiblingInSameLevel(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    if(!nodeModel.parent) return; // This is root;
    if(nodeModel.parent.subnodes.length == 0) return;

    requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, nodeModel.parent.subnodes[nodeModel.parent.subnodes.length-1], false);
}

function request2bkg_moveCursor_up(msg, port) {
    request2bkg_moveCursor_fn(msg, port, node => node.findNodeOnPrevRow() )

}

function request2bkg_moveCursor_down(msg, port) {
    request2bkg_moveCursor_fn(msg, port, node => node.findNodeOnNextRow(false/*stayInParentBounds != false*/) )
}

function request2bkg_moveCursor_fn(msg, port, fn) {
    let cursoredNode = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!cursoredNode) return;

    let repeat = +msg.repeat;

    while(repeat-- && cursoredNode) {
        //noinspection AssignmentToFunctionParameterJS
        cursoredNode = fn(cursoredNode);
        if(cursoredNode)
            requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, cursoredNode, false);
            //port.postMessage({ command: "msg2view_setCursorHere", targetNodeIdMVC: cursoredNode.idMVC, doNotScrollView:false});
    }
}

function request2bkg_moveCursor_toFirstSubnode_expandIfCollapsed(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.setCollapsing(false);
    if(nodeModel.subnodes.length > 0)
        requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, nodeModel.subnodes[0], false);
        //port.postMessage({ command: "msg2view_setCursorHere", targetNodeIdMVC: nodeModel.subnodes[0].idMVC, doNotScrollView:false});

}

function request2bkg_moveCursor_toParent_butNotToRoot(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    if(!nodeModel.parent) return; // This is root;
    if(!nodeModel.parent.parent) return; // This is a first child of root (session node?);

    //port.postMessage({ command: "msg2view_setCursorHere", targetNodeIdMVC: nodeModel.parent.idMVC, doNotScrollView:false});
    requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, nodeModel.parent, false);
}



function request2bkg_invertCollapsedState(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.setCollapsing(!nodeModel.colapsed);
}

function request2bkg_moveHierarchy(msg, port) {
    activeSession.treeModel.moveHierarchy_byIdMVC(msg.dropTarget, msg.hierarchyToMoveIdMVC);
}

function request2bkg_communicateDragStartDataToOtherViews(msg, port) {
    viewsCommunicationInterface.postMessageToAllViews({command:"msg2view_onDragStartedInSomeView", currentlyDragedIdMVC: msg.currentlyDragedIdMVC});
}

function request2bkg_deleteHierarchy(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.setCollapsing(true);
    DeleteAction_performAction(nodeModel, port);
}

function request2bkg_addNoteAsLastSubnodeOfCurrentNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    nodeModel.setCollapsing(false);
    let newnote = nodeModel.insertAsLastSubnode(activeSession.treeModel.createNodeNote());
    //---
    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);
}

function request2bkg_addNoteAsNextSiblingOfCurrentNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    let newnote = nodeModel.insertAsNextSibling(activeSession.treeModel.createNodeNote());
    //---
    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);
}

function request2bkg_addNoteAsParentOfCurrentNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    let newnote = nodeModel.insertParent(activeSession.treeModel.createNodeNote());
    //---
    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);

}

function request2bkg_addNoteAsFirstSubnodeOfCurrentNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    nodeModel.setCollapsing(false);

    let newnote = nodeModel.insertAsFirstSubnode(activeSession.treeModel.createNodeNote());
    //---
    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);
}

function request2bkg_addNoteAsPrevSiblingOfCurrentNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    let newnote = nodeModel.insertAsPreviousSibling(activeSession.treeModel.createNodeNote());
    //---

    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);
}

function request2bkg_addNoteAtTheEndOfTree(msg, port) {

    //---
    let nodeModel = activeSession.treeModel.currentSession_rootNode; if(!nodeModel) return;

    let newnote = nodeModel.insertAsLastSubnode(activeSession.treeModel.createNodeNote());
    //---

    msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote);
}

function request2bkg_actionAddSeparatorBelove(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    nodeModel.insertAsNextSibling(activeSession.treeModel.createNodeSeparator());
    //---
}

function request2bkg_actionAddGroupAbove(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    //---
    nodeModel.insertAsPreviousSibling(activeSession.treeModel.createNodeGroup());
    //---
}

function msg2view_setCursor_activateNodeNoteEditTextPrompt(port, newnote) {
    port.postMessage({ command: "msg2view_setCursorHere", targetNodeIdMVC: newnote.idMVC, doNotScrollView:false});

    newnote.editTitle(port);
}

function request2bkg_onOkAfterSetNodeWindowTextPrompt(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.setCustomTitle(msg.newText);
}

function request2bkg_onOkAfterSetNodeTabTextPrompt(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.setCustomTitle(msg.newText);
}

function request2bkg_onOkAfterSetNodeNoteTextPrompt(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if (!nodeModel) return;

    var newText = msg.newText;

    if      (newText.toLowerCase().indexOf('2g ') == 0) nodeModel.replaceSelfInTreeBy_mergeSubnodesAndMarks(makeGroup(newText));
    else if (newText.indexOf('----') == 0) nodeModel.replaceSelfInTreeBy_mergeSubnodesAndMarks(new NodeSeparatorLine({'separatorIndx': 0}));
    else if (newText.indexOf('====') == 0) nodeModel.replaceSelfInTreeBy_mergeSubnodesAndMarks(new NodeSeparatorLine({'separatorIndx': 1}));
    else if (newText.indexOf('....') == 0) nodeModel.replaceSelfInTreeBy_mergeSubnodesAndMarks(new NodeSeparatorLine({'separatorIndx': 2}));
    else nodeModel.setNodeTitle(newText) // TODO Serious Refactoring, сдесь должна была быть создана новая нода NodeNote - копия. Хотя не факт.


    function makeGroup(titleStrWith2g) {
        var r = new NodeGroup();
        r.setCustomTitle(titleStrWith2g.substr('2g '.length));
        return r;
    }
}

function performAction(nodeModel, actionId, port){
    var action = nodeModel.getHoveringMenuActions()[actionId];

    if(action) action.performAction(nodeModel, port);
}

function request2bkg_activateHoveringMenuActionOnNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    performAction(nodeModel, msg.actionId, port)
}

function request2bkg_activateNode(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    nodeModel.onNodeDblClicked(activeSession.treeModel, port, msg.isAlternativeRestore);
}

function request2bkg_setCursorToNodeOrToFirstCollapsedParent(msg, port) {
    var nodeModel = activeSession.treeModel.findNodeByIdMVC(msg.targetNodeIdMVC);
    if(!nodeModel) return;

    requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, nodeModel, false );
}

function requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, targetNode, doNotScrollView) {
    requestCaller_setCursorToNode(port, targetNode.getFirstCollapsedNodeInPathFromRootOrThisIfNotHiden().idMVC, doNotScrollView);
}

function requestCaller_setCursorToNode(port, targetNodeIdMVC, doNotScrollView) {
    port.postMessage({ command: "msg2view_setCursorHere", targetNodeIdMVC: targetNodeIdMVC, doNotScrollView:doNotScrollView});
}

function request2bkg_getListOfAllActiveWindowNodes_continueToScrollUpToNextOpenWindow_onRequestedPort(msg, port) {
    var allOpenWindows = activeSession.treeModel.getListOfAllActiveWindowNodes();
    var allOpenWindowsIdMVCs = [];
    allOpenWindows.forEach(function(node){
        allOpenWindowsIdMVCs.push(node.idMVC);
    });

    port.postMessage({command:"msg2view_continueToScrollUpToNextOpenWindow", allOpenWindowsIdMVCs:allOpenWindowsIdMVCs});
}


function request2bkg_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick(msg, port) {
    var scrollToVieWinId          = msg.scrollToVieWinId;
    var focusTabId                = msg.focusTabId;


    var windowNode = activeSession.treeModel.findActiveWindow(scrollToVieWinId);
    if(windowNode) windowNode.requestScrollNodeToViewInAutoscrolledViews(viewsCommunicationInterface);

    var tabNode = activeSession.treeModel.findActiveTab(focusTabId);
    if(tabNode)         requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, tabNode,    false);
    else if(windowNode) requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, windowNode, false); // Хотя такого не должно никогда происходить, але хай буде
}


function request2bkg_get_tree_structure(msg, port) {
    console.time("request2bkg_get_tree_structure data wraping");
    let data = new NodeModelMVCDataTransferObject(activeSession.treeModel[0]);
    console.timeEnd("request2bkg_get_tree_structure data wraping"); //~229ms 30'749 узлов (135ms null strings - not a solution)

    console.time("port.postMessage({command:\"msg2view_initTreeView\"");
    port.postMessage({command:"msg2view_initTreeView",
        rootNode_currentSession: data,
        globalViewId:            nextGlobalViewId++,
        instanceId:              instanceId
    });
    console.timeEnd("port.postMessage({command:\"msg2view_initTreeView\""); //~429ms 30'749 узлов (370ms null strings - not a solution)
}

function request2bkg_setCursorToLastChildOfRoot(msg, port) {
    var rootNode = activeSession.treeModel.currentSession_rootNode;
    var lastRootChild = rootNode.subnodes[rootNode.subnodes.length-1];
    requestCaller_setCursorToNodeOrToFirstCollapsedParent(port, lastRootChild, false);
}

/*RUN INTERNAL BACKUP UNSTUCK*/(() => {
    const INTERNAL_BACKUP_PORT = "CT_Internal_backup_port";
    var backup_port = null;

    const SECONDS = 1000;
    var lastCall = Date.now();
    var isFirstStart = true;
    var timer = 4*SECONDS;
    // -------------------------------------------------------
    var wakeup = setInterval(BackupUnstuck, timer);
    // -------------------------------------------------------
        
    async function BackupUnstuck() {

        const now = Date.now();
        const age = now - lastCall;

        function convertNoDate(long) {
            var dt = new Date(long).toISOString()
            return dt.slice(-13, -5) // HH:MM:SS only
        }
        
        //console.log(`(DEBUG BackupUnstuck) ------------- time elapsed from first start: ${convertNoDate(age)}`) 
        if(backup_port == null) {
            backup_port = chrome.runtime.connect({name:INTERNAL_BACKUP_PORT})

            backup_port.onDisconnect.addListener( (p) => {
                if (chrome.runtime.lastError){
                    // console.log(`(DEBUG BackupUnstuck) Expected disconnect (on error). SW should be still running.`); 
                } else {
                    console.error(`(DEBUG BackupUnstuck): port disconnected - MUST NEVER HAPPEN !!!`);
                }

                backup_port = null;
            });
        }

        if(backup_port) {
            backup_port.postMessage({content: "initiate_backup"});
            
            if (chrome.runtime.lastError) {                              
                console.error(`(DEBUG BackupUnstuck): postMessage error: ${chrome.runtime.lastError.message}`);                
            } else {                               
                // console.log(`(DEBUG BackupUnstuck): "ping" sent through $ backup_port.name} port`); 
            }            
        }         
        //lastCall = Date.now();
        if (isFirstStart) {
            isFirstStart = false;
            clearInterval(wakeup);
            timer = 260*SECONDS;
            wakeup = setInterval(BackupUnstuck, timer);
        }        
    }
})();


// ------------------------------------------------------------------------------------------------------------------------
function getTabs(windowId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ windowId: windowId }, (tabsList) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(tabsList);
        });
    });
}

function tabsListContainOurViews(tabsList) {
    const extensionTabs = tabsList.filter(tab => tab.url && tab.url.includes(chrome.runtime.getURL('')));

    return extensionTabs.length > 0;
}        



//try {
//var CHROME_MAJOR_VERSION = parseInt(navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10); // Внизу чтоб оно мне не крешанула бекграунд старницу если match навернётся
//} catch(e) { console.error(e) }

// Также может понадобиться стандартная функция decodeURIcomponent()для последующей раскодировки процентных символов
//'?a=123&b=abc#anchor' -> {a: "123", b: "abc"}
function getJsonFromQueryString(url) {
  var questionMarkStart = url.indexOf('?');
  var anchorStart = url.lastIndexOf('#');
  var query = url.substring(questionMarkStart+1, anchorStart < 0 ? url.length : anchorStart);
  var data = query.split("&");
  var result = {};
  for(var i=0; i<data.length; i++) {
    var item = data[i].split("=");
    result[item[0]] = item[1];
  }
  return result;
}

function console_log_differenceTransaction(diff) {
    console.group("Diff Data");
    if(diff['k']) for(var key in diff['k']) console.log('%s:%c %s', key, 'color:#522900', diff['k'][key]);
    else          console.log('NO KNOTS');

    if(diff['c']) for(    key in diff['c']) console.log('%s:%c %s', key, 'color:#00297A', diff['c'][key]);
    else          console.log('NO ENTRIES');
    for(key in diff)
        if(key != 'k' && key != 'c')console.log('%s:%c', key, 'color:orange', diff[key]);
    console.groupEnd();
}

function getLocalStorageConfigInfoAsJsonString() {
    var r = {};

    for( var key in localStorage ) {
        if( localStorage.hasOwnProperty(key) && localStorage[key].length < 500/*just to be save*/ ) // Кстате 52 узла (один экран, это 4kb)
            r[key] = localStorage[key]
    }

    return JSON.stringify(r);
}

//?t=ag9kZXZ-dGFtbnViYXRlc3RyPgsSC1VzZXJQcm9maWxlIhUxODU4MDQ3NjQyMjAxMzkxMjQxMTgMCxILQWN0aW9uVG9rZW4YgICAgIDwrwoM&action=impart_state

function BackEndInterface(){
    this.authorizedServerSides =[ "http://localhost:8080",
                                  "https://tamnubatest.appspot.com",
                                  "https://gcdc2013-tabsoutliner.appspot.com",
                                  "https://tabs-outliner.appspot.com",
                                  "https://pro.tabsoutliner.com"];

    this.profilePath           = "/profile";
    this.usedTokens            = {};
}

// If url represent our server side return get parameters as JSON + serverSideUri which point to correct server
BackEndInterface.prototype.ifThisIsOurServerSideProfilePathReturnParams = function(url) {
    for(var i = 0; i < this.authorizedServerSides.length; i++) {
        var testStr = this.authorizedServerSides[i] + this.profilePath;
        if(url.indexOf(testStr) === 0) {
            var r = getJsonFromQueryString(url.substr(testStr.length));
            r.serverSideUri = this.authorizedServerSides[i];
            return r;
        }
    }

    return null;
};

BackEndInterface.prototype.titleContainConfirmIndicator = function(title) {
    var confirmMark = '[#]';
    return (title.length - title.lastIndexOf(confirmMark)) === confirmMark.length;
};

// Asynchromously load backend_gateway.js and add it to document, then execute action wich is use it
BackEndInterface.prototype.callOnBackEndInterface = function(params_serverSideUri, actionToCall) {
    var backEndInterfaceGlobalObjectCreatedByGatewayScript = '__backEndInterface';
    if(!window[backEndInterfaceGlobalObjectCreatedByGatewayScript]) { // Не очень здорово так вобщето проверять, как раз в этотм момент мы можем грузится, но вроде большой бедыф не будет даже если 2 скрипта будут загружены
        if(debugLogChromeOperations) console.log("BE-IS-NOT-READY-WILL-LOAD");
        var backEndInterfaceScript = document.createElement('script');
        //backEndInterfaceScript.id = backEndInterfaceScriptTagId;
        backEndInterfaceScript.type = 'text/javascript'; // Not very needed actualy
        backEndInterfaceScript.async = true; //This is useful exclusively for Firefox 3.6 which is the only browser that doesn't do that by default.
        backEndInterfaceScript.src = params_serverSideUri+'/static/to_backend_gateway_4.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(backEndInterfaceScript, s);

        backEndInterfaceScript.onload = function() {
            actionToCall(window[backEndInterfaceGlobalObjectCreatedByGatewayScript]); // onload гарантировано приходит после полного выполнения скрипта? Это надо проверить!
        };
        backEndInterfaceScript.onerror = function() {
            console.error("BEINT LOAD ERROR");
        };
    } else {
        if(debugLogChromeOperations) console.log("BE-ALREADY-LOADED-AND-READY");
        actionToCall(window[backEndInterfaceGlobalObjectCreatedByGatewayScript]);
    }
};
// ---------------------------------------------------------------------------------------------------------------------

function getNewChromeSessionAndUpdateChangedTabs() {
    // var startTime = Date.now();
    chrome.tabs.query({}, function(chromeActiveTabObjectsList) { // Вроде быстрее Window get.all
        // var stopTime = Date.now();
        // console.log("= tabs.query populate time:", stopTime-startTime);
        for(i = 0; i < chromeActiveTabObjectsList.length; i++) {
            var isChanged = false;

            var currentChromeTabObj  = chromeActiveTabObjectsList[i];
            var lastSeenChromeTabObj = lastSeenTabs[currentChromeTabObj.id];

            if(lastSeenChromeTabObj && lastSeenChromeTabObj.title !== currentChromeTabObj.title) {
                if(debugLogChromeOperations) console.log("TABSCHECKER New Tab Title:", lastSeenChromeTabObj.title,"-->",currentChromeTabObj.title);
                isChanged = true;
            }

            if(lastSeenChromeTabObj && lastSeenChromeTabObj.url !== currentChromeTabObj.url) {
                if(debugLogChromeOperations) console.log("TABSCHECKER New Tab Url:", lastSeenChromeTabObj.url,"-->",currentChromeTabObj.url);
                isChanged = true;
            }

            if(lastSeenChromeTabObj && currentChromeTabObj.favIconUrl/*иногда фавиконка была, а теперь нету её, нехочу апдейта в этом случае*/ && lastSeenChromeTabObj.favIconUrl !== currentChromeTabObj.favIconUrl) {
                if(debugLogChromeOperations) console.log("TABSCHECKER New Tab favIconUrl:", lastSeenChromeTabObj.favIconUrl,"-->",currentChromeTabObj.favIconUrl);
                isChanged = true;
            }

            if(lastSeenChromeTabObj && lastSeenChromeTabObj.status !== currentChromeTabObj.status) {
                if(debugLogChromeOperations) console.log("TABSCHECKER New Tab status:", lastSeenChromeTabObj.status,"-->",currentChromeTabObj.status);
                isChanged = true;
            }

            if(isChanged) {
                if(debugLogChromeOperations) console.log("TABSCHECKER DETECT TAB UPDATE", currentChromeTabObj);
                if(activeSession && activeSession.treeModel) {
                    var tabModel = activeSession.treeModel.findActiveTab(currentChromeTabObj.id);
                    if(tabModel) tabModel.updateChromeTabObj( currentChromeTabObj );
                }
            }
        }

        // Update lastSeenTabs -----------------------------------------------------------------------------------------
        lastSeenTabs = [];
        for(var i = 0; i < chromeActiveTabObjectsList.length; i++)
            lastSeenTabs[chromeActiveTabObjectsList[i].id] = chromeActiveTabObjectsList[i];
    });
}

function checkTabsChanges() {
    var CHECK_INTERVAL = 2000;
    if(debugLogChromeOperations) console.log("@@@@@ TABS CHECK STARTED, interval:", CHECK_INTERVAL);
    function tabsCheck() {
        getNewChromeSessionAndUpdateChangedTabs();
        setTimeout(tabsCheck, CHECK_INTERVAL);
    }
    tabsCheck();
}


function threadCheck() {
    var CHECK_INTERVAL = 30;
    console.log("@@@@@ THREAD CHECK STARTED, interval:", CHECK_INTERVAL);

    var startTime = Date.now();
    var lastCheckTime = startTime;
    var checks = [];
    function threadCheckCheck() {
        var time = Date.now();
        checks.push( ( (time - lastCheckTime) <= (CHECK_INTERVAL + 7) ) ? '.' : (time - lastCheckTime) );
        if((time - startTime) < 10000) {
            setTimeout(threadCheckCheck, CHECK_INTERVAL);
        } else {
            var msg = "";
            for(var i = 0; i < checks.length; i++) msg += checks[i] + ' ';
            console.log("@@@@@ THREAD CHECKS:\n", msg);
        }
        lastCheckTime = time;
    }

    threadCheckCheck();
}

function serializeActiveSessionToJSO() {
    return activeSession.treeModel.serializeHierarchyAsJSO();
}

function serializeActiveSessionToOperations() {
    return activeSession.treeModel.serializeAsOperationsLog();
}

function saveCurrentSessionAsJSONtoLocalStorage() {
    // threadCheck();
    console.log('saveCurrentSessionAsJSON to LocalStorage ====================================');
    var startTime = Date.now();
    var dataToSave_Objects_startTime = Date.now();
    var dataToSave_Objects = serializeActiveSessionToJSO();
    var dataToSave_Objects_stopTime = Date.now();


    var dataToSave_Strings_startTime =  Date.now();
    var dataToSave_Strings = JSON.stringify(dataToSave_Objects);
    var dataToSave_Strings_stopTime =  Date.now();


    var startToStorageTime =  Date.now();
    localStorage.setItem(currentSessionSnapshotDbKey, dataToSave_Strings);
    localStorage.setItem('timestamp', Date.now());
    var stopToStorageTime =  Date.now();

    console.log('SerializeToObjectsTime', dataToSave_Objects_stopTime - dataToSave_Objects_startTime);
    console.log('ObjectsToStringTime', dataToSave_Strings_stopTime - dataToSave_Strings_startTime);


    console.log('SaveTime', stopToStorageTime - startToStorageTime);
    console.log('FullSaveTime', stopToStorageTime - startTime);
    console.log('');

}

function saveCurrentSessionAsOperationsToIndexedDbNow() {
    // threadCheck();
    // console.log('saveCurrentSessionAsOperations to IndexedDB ====================================');
    var startTime = Date.now();

    var dataToSave_Objects = serializeActiveSessionToOperations();

    var startToStorageTime =  Date.now();

    saveToDefaultIndexedDB(currentSessionSnapshotDbKey, dataToSave_Objects);

    var stopToStorageTime =  Date.now();

    // ZERO                console.log('SaveTime', stopToStorageTime - startToStorageTime);
    // Равно SerializeTime console.log('FullSaveTime', stopToStorageTime - startTime);
    // console.log('');

// IndexedDB заюзаем прямо. Хорошо бы понять также в каком среде оно крутится и блокирует ли мой скрипт
// А как это понять? и зачем? Хуй с того что иногда тормозит? Даже на 3ть секунды.
//
// Скорее всего сред блокирует. Альтернативное решение - юзать настоящий WebWoker и передавать ему обект с передачей владения.
// Писать в файл, хотя возможно он умеет тоже юзать IndexedDB или WebSQL - он ТОЧНО умеет, но вот в каком среде они исполняются это интересный вопрос
// Возможно что таки в среде WebWokerа - ведь они юзают его обект который не доступен в рендер среде!!! и это решает тогда все проблемы
// Есть инфа что IndexedDB работает в своём среде онли!!!    Таким образом оно должно копировать скорее всего переданные аргументы, причём копировать
// синхронно - это легко проверить!!! досточно СРАЗУ после копирования чтото поменять в переданном обекте.
//
// Есть ещё ГАРАНТИРОВАНО не блокируещее FileAPI которое мона юзать из веб вокера (но скорее всего IndexedDB хватит)
// И вроде оно в Firefox работает
//
// Юзать через Modernizr.com ?
// Кстате Web SQL Database  - работате во всех мобильных броузерах (ну и хуй?)

// *!*Запись в базу блокирует мой Thread.*!* (кстате в файл тоже) Причём IndexedDB операции выполняются дольше чем LoacalStorage Save - раза в 2
// в m18 уже вроде должен IndexedDB стать доступным из Workers

//    console.log('Lawnchair ====================================');
//    var startTimeLawnchair = Date.now();
//
//    var store = new Lawnchair({'name':'tabs_outliner_store'}, function(store) {
//        console.log("lanchair Callback 1 executed");
//        this.save({'key':'currentSessionSnapshot__', 'data':dataToSave_Objects}, function(obj){
//                console.log("savedone",obj);
//            })
//    });
//
//    var store2 = new Lawnchair({'name':'tabs_outliner_store'}, function(store) {
//        // console.log("lanchair Callback 2 executed");
//        this.get('currentSessionSnapshot__', function(data) {
//            // console.log(data);
//        });
//
//    });
//    var stopTimeLawnchair = Date.now();
//    console.log('FullSaveTime', stopTimeLawnchair - startTimeLawnchair);
}

//if(!indexedDB) // Need check because new Chromes anymore do not allow assign this readonly property 
//    var indexedDB = indexedDB      || webkitIndexedDB      || mozIndexedDB      || msIndexedDB;
//
//if(!IDBTransaction) // Need check because new Chromes anymore do not allow assign this readonly property 
//    var IDBTransaction = IDBTransaction || webkitIDBTransaction || mozIDBTransaction || msIDBTransaction;


//var INDEXED_DB_TRANSACTION_readonly  = CHROME_MAJOR_VERSION < 22 ? IDBTransaction.READ_ONLY  : "readonly"; // Also will do "readonly" even if undefined or ""
//var INDEXED_DB_TRANSACTION_readwrite = CHROME_MAJOR_VERSION < 22 ? IDBTransaction.READ_WRITE : "readwrite";

var INDEXED_DB_TRANSACTION_readonly  = "readonly"; // Also will do "readonly" even if undefined or ""
var INDEXED_DB_TRANSACTION_readwrite = "readwrite";


//var dbName = "TabsOutlinerDB";
var dataBaseSchemeV33 = { dbName:"TabsOutlinerDB2" // !!!! Теперь я всегда должен пробовать это прочитать!, даже в версии 66 апгрейд может происходить с версии 33 а не 65
                        , dbVersion:2
                        , dbObjectStoreName:"current_session_snapshot" /*keyPath: "key"; index: "key"*/};

var dataBaseSchemeV34_Default = { dbName:"TabsOutlinerDB34"
                                , dbVersion:2
                                , dbObjectStoreName:"current_session_snapshot" /*keyPath: "key"; index: "key"*/};

var currentSessionSnapshotDbKey    = 'currentSessionSnapshot';

function openIndexedDbToUse_neverCreateAnything(dataBaseScheme, useDbCallback) {
    // WARNING Не юзать ни в коем случае этот МЕТОД!!!!!
    // Он открывает базу данных без onupgrade needed эвента и это отсавляет её в состоянии когда ничто уже не может ей помочь
    throw new Error();

    // console.log('IndexedDB = Open DB ====================================');

    var openRequest = indexedDB.open(dataBaseScheme.dbName, dataBaseScheme.dbVersion);

    // Always anticipate blocked events
    openRequest.onblocked = function (event) {
        if(console) console.error("ERROR IndexedDB openRequest.onblocked", event); //TODO TBD Error case
        useDbCallback(null);
    };

    openRequest.onerror = function (event) {
        if(console) console.error("ERROR IndexedDB openRequest.onerror",  event.target.webkitErrorMessage, event.target.errorCode, event); //TODO TBD Error case. Do something with this.errorCode!
        useDbCallback(null);
    };

// Пох на апгрейд, не будем его производить!!!
//    openRequest.onupgradeneeded = function (event) {
//        if(console) console.log("IndexedDB openRequest.onupgradeneeded",  event);
//    };

    openRequest.onsuccess = function(event) {
        // console.log("IndexedDB openRequest.onsuccess",  event, "; time from indexedDB.open():", Date.now() - startTime_openIndexedDbToUse);

        var db = this.result;
        useDbCallback(db);

// Тут никаких апгрейдов версии, будем юзать такую как есть
//        var oldVersion = Number(db.version);
//        if (oldVersion !== dataBaseScheme.dbVersion) {
//
//            if(console) console.log("IndexedDB openRequest.onsuccess - oldVersion !== dbVersion - will do db.setVersion",  event);
//
//            // Support older API:
//            if (!db.setVersion) { throw new Error(); }
//
//            var versionRequest = db.setVersion(dataBaseScheme.dbVersion);
//            versionRequest.onsuccess = function (event) {
//                if(console) console.log("IndexedDB versionRequest.onsuccess",  event);
//                createObjectStoreAndIndexIfNoObjectStores(db, dataBaseScheme, oldVersion);
//
//                var transaction = event.target.result;
//                transaction.oncomplete = function() {
//                    useDbCallback(db);
//                };
//            };
//        } else {
//            useDbCallback(db);
//        }
    };
}

function openIndexedDbToUse_createStoreIfAbsent(dataBaseScheme, useDbCallback) {
    // console.log('IndexedDB = Open DB ====================================');

    var startTime_openIndexedDbToUse = Date.now();

    var openRequest = indexedDB.open(dataBaseScheme.dbName, dataBaseScheme.dbVersion);

    // Always anticipate blocked events
    openRequest.onblocked = function (event) {
        if(console) console.error("ERROR IndexedDB openRequest.onblocked:", event); //TODO TBD Error case
        useDbCallback(null);
    };

    openRequest.onerror = function (event) {
        // Сюда мы прилетаем в случае поломанной базы данныйх
        if(console) {
            console.error("ERROR IndexedDB openRequest.onerror:",  event['target']['webkitErrorMessage'], event['target']['errorCode'], event,
            "\nSERIOUS ERROR IndexedDB folder is corrupted most likely - need manualy delete the extension IndexedDB folder to recover from this!\n"+
            "the folder is contained in Chrome profile (use chrome:version to learn the correct path) and has the name: \nIndexedDB/chrome-extension_eggkanocgddhmamlbiijnphhppkpkmkl_0.indexeddb.leveldb\n"+
            "This was very common error in Chrome v24 and Chrome v25 because of some LevelDB engine bug which was introduced in Chrome v24; \nChrome v26 delete such corrupted database folders on open automaticaly");
            //TODO TBD Error case. Do something with this.errorCode! //TODO report to server
        }
        useDbCallback(null);
    };

//    // Support newer API:
//    Само наличие этой хуеты приводит к проблеме
//    doUpgrade вызвается в Chrome Canary хотя база данных и индексы которые он собирается создать таки уже созданы!
//    в результате мы влетаем в onerror
    openRequest.onupgradeneeded = function (event) {
        if(console) console.log("IndexedDB openRequest.onupgradeneeded",  event);
        var db = event.target.result;
        createObjectStoreAndIndexIfNoObjectStores(db, dataBaseScheme, event.oldVersion);
    };

    openRequest.onsuccess = function(event) {
        // console.log("IndexedDB openRequest.onsuccess",  event, "; time from indexedDB.open():", Date.now() - startTime_openIndexedDbToUse);

        var db = this.result;

        var oldVersion = Number(db.version);
        if (oldVersion !== dataBaseScheme.dbVersion) {
            // этот код для < Chrome 21, в новых он не должен вообще выполняться по идеи.

            if(console) console.log("IndexedDB openRequest.onsuccess - oldVersion !== dbVersion - will do db.setVersion",  event);

            // Support older API:
            if (!db.setVersion) { throw new Error(); }

            var versionRequest = db.setVersion(dataBaseScheme.dbVersion);
            versionRequest.onsuccess = function (event) {
                if(console) console.log("IndexedDB versionRequest.onsuccess",  event);
                createObjectStoreAndIndexIfNoObjectStores(db, dataBaseScheme, oldVersion);

                var transaction = event.target.result;
                transaction.oncomplete = function() {
                    useDbCallback(db);
                };
            };
        } else {
            useDbCallback(db);
        }
    };
}

function createObjectStoreAndIndexIfNoObjectStores(db, dataBaseScheme, oldVersion) {
    if(console) console.log("IndexedDB = Create ObjectStore in DB ===================");

    if(db['objectStoreNames'].length === 0) {
        var objectStore = db.createObjectStore(dataBaseScheme.dbObjectStoreName, { 'keyPath': "key" });
        objectStore.createIndex("key", "key", { 'unique': true })
    }
}


// var worker = new Worker('test_idb.js');
//
//function test_filesave() {
//
//    var startT =  Date.now();
//    var data = {key:"activeSession", data:activeSession.treeModel.serialize()};
//    // for(var i=0; i<200; i++) data["data"+i] = activeSession.treeModel.serialize();
//    var startPost =  Date.now();
//    worker.postMessage(data);
//    var endPost =  Date.now();
//
//    worker.onmessage = function(event) {
//        var endSave =  Date.now();
//        console.log("Got: " + event.data + "\n");
//
//        console.log('SerializeToObjectsTime', startPost - startT);
//        console.log('postMessage', endPost - startPost);
//        console.log('SaveTime', endSave - endPost);
//
//    };
//}

function saveDataToDB(db, objectStoreName, key, JSO, onDone) {
    // console.log('IndexedDB = Write ======================================');

    var transaction = db.transaction([objectStoreName], INDEXED_DB_TRANSACTION_readwrite);

    var objectStore = transaction.objectStore(objectStoreName);

    var startRIB_add = Date.now();
    // -------------------------------------------------------------------------------------------------------------
    var data = {'key':key, 'data':JSO};
    var putRequest = objectStore.put(data); // Тут происходит синхронное копирование данных (но стоит заметить что мы отрабатываем в onsuccess эвенте, тоесть не сразу)
                                            // data.testForSynchroSave = "This - must not appear in db if objectStore.put(data) make a copy or save data synchronously(immedeately)"; оно и не появляется
    // -------------------------------------------------------------------------------------------------------------
    var stopRIB_add = Date.now();
    // 800ms дл 5500 нод console.log('IndexedDB time to serialize data to IndexedDB Worker during objectStore.put(data) ###:', stopRIB_add - startRIB_add);

    putRequest.onsuccess = function(event) {
        // console.log("IndexedDB putRequest.onsuccess", event);
        // console.log('IndexedDB time from serialize end to putRequest.onsuccess:', Date.now() - stopRIB_add); // от 300ms до 12sec!
        // Типичные времена прихода для 2000 нод:
        // IndexedDB time from serialize end to putRequest.onsuccess: 4
        // IndexedDB time from serialize end to transaction.oncomplete: 308

    };

    putRequest.onerror = function(event) {
        if(console) console.log("IndexedDB ERROR putRequest.onerror", event);
    };

    // Do something when all the data is added to the database.
    transaction.oncomplete = function(event) {
        // console.log('IndexedDB Write transaction.oncomplete', event);
        // console.log('IndexedDB time from serialize end to transaction.oncomplete:', Date.now() - stopRIB_add); // 1s для 5500 нод, но может быть и 13sec если шо

        // Типичные времена прихода для 2000 нод:
        // IndexedDB time from serialize end to putRequest.onsuccess: 4
        // IndexedDB time from serialize end to transaction.oncomplete: 308

        // Таки это похоже не является гарантией записи на диск, но всёже

        if(onDone) onDone(db);
    };

    transaction.onerror = function(event) {
        if(console) console.log("IndexedDB ERROR write transaction.onerror", event);
    };
}

function readDataFromDB(db, objectStoreName, key, callback) {
    // console.log('IndexedDB = Read ==================================');

    var transaction = db.transaction([objectStoreName], INDEXED_DB_TRANSACTION_readonly);  // если не найдёт требуемый objectStoreName просто выкинет exception тут (без срабатывания onerror)

    var getRequest = transaction.objectStore(objectStoreName).get(key);

    getRequest.onsuccess = function(event) {
        // console.log("IndexedDB getRequest.onsuccess", event, event.target.result);

        if( event.target.result === undefined ) // event.target.result === undefined если не нашло key, при этом никакие onerror не срабатывают!!!! и event.type === 'success'
            callback(undefined);
        else
            callback(event.target.result.data /*для пустой базы это undefined*/); // event.target.result содержит 2 поля: data & key

    };

    getRequest.onerror = function(event) {
        if(console) console.log("IndexedDB ERROR getRequest.onerror", event);
        callback(undefined);
    };

    transaction.oncomplete = function(event) {
        // console.log('IndexedDB Read transaction.oncomplete', event);
    };

    transaction.onerror = function(event) {
        if(console) console.log("IndexedDB ERROR read transaction.onerror", event);
        callback(undefined);
    };
}

function saveToDefaultIndexedDB(key, data) {
    if(debugLogChromeOperations) if(console) console.log('saveToDefaultIndexedDB START', new Date().toTimeString());

    openIndexedDbToUse_createStoreIfAbsent( dataBaseSchemeV34_Default, function(db){
        if(db) {
            saveDataToDB(db, dataBaseSchemeV34_Default.dbObjectStoreName, key, data, function() {
            // console.log("SAVE-DONE"); // TODO Вместо этого можно сделать chunked save с сейвом оставшихся чунков после успешного сейва предыдущего
            });
        } else {
            window['treeWriteFail'] = true;
        }
    })
}

function readOperationsFromIndexedDB( dataBaseScheme, callback ) {
    var multipleCallbackinvocationOnErrorsChecker_db = 0; //TODO пиздец проверка на повторные входы из-за error, и такаяже ещё ниже есть - это надо убрать
    if(++multipleCallbackinvocationOnErrorsChecker_db !== 1) return;

    openIndexedDbToUse_createStoreIfAbsent( dataBaseScheme, function(db){
        try {
            if(!db) throw new Error("IDB open error");
            readDataFromDB(db, dataBaseScheme.dbObjectStoreName, currentSessionSnapshotDbKey, function(data) {
                if(console) console.log("IDB READ-DONE", dataBaseScheme.dbName);
                try{
                    callback(data);
                } catch(e) { // ставим тут try catch блок чтоб не влететь из-за ошибке в калбеке в тот catch что ниже и не фаернуть callback 2 раза!
                    console.error("ERROR !!! IDB READ CALLBACK EXECUTION EXCEPTION - ERROR DURING TREE INSTANTIATION FROM SERIALIZED DATA", e);
                    console.log(e['message']);
                    console.log(e['stack']);
                }
            })
        } catch(e) {
            // Сюда мы приходили тока во время искуственных ситуаций, когда база данных была создана а апгрейд эвент пропущен!
            console.error("ERROR !!! IDB READ ERROR", dataBaseScheme.dbName, e);
            console.log(e['message']);
            console.log(e['stack']);
            callback(null);
        }
    })
}

//----------------------------------------------------------------------------------------------------------------------
// Используется для аплаинга в новой сессии onRemoved эвентов которые возможно были потеряны при резком закрытии прошлой сессии
// до того как чтото успело записаться на диск.
var OnRemovedTracker = Class.extend({
    init:function() {
        this.PERIOD_OF_INACTIVITY_BEFORE_CLEARING_DATA = 25*1000; // ms //must be surely bigger than possible period between saves
        this.lastSessionOnRemoved = this._getDataFromLocalStorage();
        this.clearStorage();
    },

    clearStorage:function() {
        this.recentlyRemoved = this.getEmptyOnRemovedCollection(); // Тут поменяеш также в getItemsArrayFromLocalStorage надо проверку на Array изменить и инициализатор
        this._dumpDataToLocalStorage();
        this.clearTimerID  = null;
    },

    getEmptyOnRemovedCollection:function() {
        return {'removedTabs':{}, 'removedWindows':{}}; // If changed the getItemsArrayFromLocalStorage() also must be changed
    },

    _dumpDataToLocalStorage:function() {
        try{
        var s = JSON.stringify(this.recentlyRemoved);
        if(s.length < 100000) // Impossible, but, just to be safe
            localStorage['recentlyRemoved'] = s;
        } catch(e) {console.error("ERROR DDTLS",e);} // Catch possible Quata errors, to not brake the onRemoved logic which update tree
    },

    _getDataFromLocalStorage:function(){
        try{
        var removedItems = JSON.parse(localStorage['recentlyRemoved']);
        }catch(e){/*ignore parse errors*/}
        if(!removedItems || !removedItems['removedWindows'] || !removedItems['removedTabs'] )
            removedItems = this.getEmptyOnRemovedCollection();

        return removedItems;
    },

    recentlyRemovedItemsListUpdated_dubpData_scheduleClear:function() {
        this._dumpDataToLocalStorage();

        clearTimeout(this.clearTimerID); // Will cancell currently scheduled clear,if any, and postpone it
        this.clearTimerID = setTimeout(this.clearStorage.bind(this), this.PERIOD_OF_INACTIVITY_BEFORE_CLEARING_DATA);
    },

    register_onTabRemoved:function(tabId, isWindowClosingInfo/*{isWindowClosing: true/false, windowId: 964} */) {
        this.recentlyRemoved['removedTabs'][tabId] = isWindowClosingInfo;
        // isWindowClosingInfo - CAN BE UNDEFINED!!!!
        if(isWindowClosingInfo && isWindowClosingInfo.isWindowClosing)
            this.recentlyRemoved['removedWindows'][isWindowClosingInfo.windowId] = Date.now(); // Потому как последний onRemoved для окна может и не добежать на закрытии

        this.recentlyRemovedItemsListUpdated_dubpData_scheduleClear();
    },

    register_onWindowRemoved:function(windowId) {
        this.recentlyRemoved['removedWindows'][windowId] = Date.now(); // этот же код в register_onTabRemoved() С&P чтоб не дампить в localStorage лишний раз

        this.recentlyRemovedItemsListUpdated_dubpData_scheduleClear();
    },

    getTabsOnRemovedEventsFromLastSession:function() {
        return this.lastSessionOnRemoved['removedTabs']; // Object.keys(w); ignore the keys assigned like this: Object.prototype.zzz = 'ssss' в отличии от for (var k in w) {console.log(k)}
    },

    getWindowsOnRemovedEventsFromLastSession:function() {
        return this.lastSessionOnRemoved['removedWindows']; // Object.keys(w); ignore the keys assigned like this: Object.prototype.zzz = 'ssss' в отличии от for (var k in w) {console.log(k)}
    },

    EOC:null
});
//var ClosedItemsTracker = Class.extend({
//    init:function() {
//        this.PERIOD_OF_INACTIVITY_BEFORE_CLEARING_DATA = 20*1000; // ms //must be surely bigger than possible period between saves
//        this.closedWindowsFromLastSession = this.getItemsArrayFromLocalStorage();
//        this.clearStorage();
//    },
//
//    clearStorage:function() {
//        this.recentlyRemovedWindows = []; // Тут поменяеш также в getItemsArrayFromLocalStorage надо проверку на Array изменить и инициализатор
//        localStorage['recentlyRemovedWindows'] = JSON.stringify(this.recentlyRemovedWindows);
//        this.clearTimerID  = null;
//    },
//
//    getItemsArrayFromLocalStorage:function(){
//        try{
//        var removedItems = JSON.parse(localStorage['recentlyRemovedWindows']);
//        }catch(e){/*ignore parse errors*/}
//        if(!removedItems || !(removedItems instanceof Array)) removedItems = [];
//
//        return removedItems;
//    },
//
//    recentlyRemovedItemsListUpdated:function() {
//        var s = JSON.stringify(this.recentlyRemovedWindows);
//        if(s.length < 100000) // Impossible, but, just to be safe
//            localStorage['recentlyRemovedWindows'] = s;
//
//        clearTimeout(this.clearTimerID); // Will cancell currently scheduled clear,if any, and postpone it
//        this.clearTimerID = setTimeout(this.clearStorage.bind(this), this.PERIOD_OF_INACTIVITY_BEFORE_CLEARING_DATA);
//    },
//
//    registerWinRemove:function(hierarchy/*chromeWindowObj in root, chromeTabObjects in tree like structure with subnodes*/) {
//        if( !this.isWindowIdPresentInList(this.recentlyRemovedWindows, hierarchy.id) ) {
//            this.recentlyRemovedWindows.push(hierarchy);
//            this.recentlyRemovedItemsListUpdated()
//        }
//    },
//
//    isWindowIdPresentInList:function(hierarchies, windowId) {
//        for(var i = 0; i < hierarchies.length; i++)
//            if(hierarchies[i].id === windowId) return true;
//
//        return false;
//    },
//
//    EOC:null
//});
//----------------------------------------------------------------------------------------------------------------------
function SaveScheduler(saveFunction, UPDATES_ACCUMULATING_PERIOD, MAXIMUM_POSTPONE_BECAUSE_OF_UPDATES_PERIOD_BEFORE_FORCED_SAVE){
    this.performSaveFunction = saveFunction;
    this.timeOfFirstUnsavedUpdate = null;
    this.timeoutCallId = 0;
    this.MAXIMUM_POSTPONE_BECAUSE_OF_UPDATES_PERIOD_BEFORE_FORCED_SAVE = MAXIMUM_POSTPONE_BECAUSE_OF_UPDATES_PERIOD_BEFORE_FORCED_SAVE;
    this.UPDATES_ACCUMULATING_PERIOD                                   = UPDATES_ACCUMULATING_PERIOD;
}

SaveScheduler.prototype = {
    _cancellAnyAlreadyScheduledSaveCall : function()    {
        clearTimeout(this.timeoutCallId)
    },

    _callSave : function() {
        if(debugLogChromeOperations) { console.log("SaveScheduler(%d)::_callSave():", this.UPDATES_ACCUMULATING_PERIOD); }

        this.timeOfFirstUnsavedUpdate = null; // до performSave call - так как если там exeption мы опять влетим в callSave за 1ms на очередном upate если это было из-за _isWeAllreadyPostponeSaveExecutionForTooMuch - а так всёже с задержкой. что лучше, хоть и всёравно ситуация кривая, save не должен выкидывать exceptions на верх
        (this.performSaveFunction)();
    },

    _scheduleSaveCall: function(period) {
        this.timeoutCallId = setTimeout(this._callSave.bind(this), period)
    },

    _isWeAllreadyPostponeSaveExecutionForTooMuch: function() {
        return (Date.now() - this.timeOfFirstUnsavedUpdate) > this.MAXIMUM_POSTPONE_BECAUSE_OF_UPDATES_PERIOD_BEFORE_FORCED_SAVE;
    },

    processUpdateRequest: function() {
        if(!this.timeOfFirstUnsavedUpdate) this.timeOfFirstUnsavedUpdate = Date.now();

        var scheduleToCallInNmilisecond = this._isWeAllreadyPostponeSaveExecutionForTooMuch() ? 1 : this.UPDATES_ACCUMULATING_PERIOD;

        if(debugLogChromeOperations) { console.log("SaveScheduler(%d)::processUpdateRequest scheduleToCallInNmilisecond:", this.UPDATES_ACCUMULATING_PERIOD, scheduleToCallInNmilisecond); }

        this._cancellAnyAlreadyScheduledSaveCall(); // Will cancell currently scheduled save and postpone it in hope to accumulate more changes in tree before save
        this._scheduleSaveCall( scheduleToCallInNmilisecond );
    }
};

var TreeModelPersistenceManagerAbstractBase = Class.extend({
    init:function() {
        this.tree = null;

        this.localStorageQuataReached = false;

        this.fullSaveScheduler = new SaveScheduler(this._diff_and_full_performScheduledSave.bind(this), 3000, 8*1000);
        //REALTIMEBACKUP this.diffSaveScheduler = new SaveScheduler(this._diff_performScheduledSave.bind(this),            70,    200);
    },

    registerTree:function(tree) {
        this.tree = tree
    },

    restoreTree:function( callback /*(restoredTree)*/) {
        // Abstract;
    },

    saveTree:function(isPerformSureSynchronousSave_onViewClose) {
        // Abstract;
    },

    diff_saveTree:function() {
        // Abstract
    },

    saveNow:function() { // Вызывается прямо из View, на onbeforeclose
        if(this.fullSaveScheduler.timeOfFirstUnsavedUpdate == null) return; // Нечего писать, ничего не менялось

        this.fullSaveScheduler._cancellAnyAlreadyScheduledSaveCall();
        //REALTIMEBACKUP this.diffSaveScheduler._cancellAnyAlreadyScheduledSaveCall();

        this._diff_and_full_performScheduledSave(true/*doLocalStorageSave*/);

        this.fullSaveScheduler.timeOfFirstUnsavedUpdate = null;
        //REALTIMEBACKUP this.diffSaveScheduler.timeOfFirstUnsavedUpdate = null;
    },

    _diff_and_full_performScheduledSave:function(doLocalStorageSave/*can be undefined*/) {
        // TODO счас нахрен этого не нужно тут diff_saveTree делать перед saveTree!!! Потому что между ними нет зависимости которая раньше предполагалось что будет
        // в любом случае diff_saveTree скорее всего не сработает. Так как для него изменений по сравнению с прошлым его вызовом врядли будет.
        try { this.diff_saveTree()                                                                                 } catch(e) { console.error("!!! diff_saveTree exception:", e); }
        try { this.saveTree(!!doLocalStorageSave/*true - to make sure & synchronous save in localstorage first*/)  } catch(e) { console.error("!!! saveTree exception:", e); }
    },

    _diff_performScheduledSave:function() {
        try { this.diff_saveTree() } catch(e) { console.error("!!! diff_saveTree3 exception:", e); }
    },

    treeUpdated:function() {
        // TODO _full_performScheduledSave также вызывает diff_saveTree в обязательном порядке,
        // Но произойдёт это после срабатывания diffSaveScheduler таймера, но зачем он обязательно вызывает diffSave перед собой... чтото такое было насчёт того чтоб diff всегда
        // приходились на границу... но вроде счас это не надо.
        // и вообще это сейчас не diffSave а Send по сути
        // Вобщем шо происходит:
        // Срабатывает таймер на 70 ms и сразу вызывает diffSave
        // Через 3000ms срабатывает fullSave и опять перед полной записью вызывает diffSave. Та правда send уже не делает, так как изменений не задетектала скорее всего.
        //      но нахер она вообще срабатывает.

        this.fullSaveScheduler.processUpdateRequest(); // --> _full_performScheduledSave() --> diff_saveTree() + saveTree(false)
        //REALTIMEBACKUP this.diffSaveScheduler.processUpdateRequest(); // --> _diff_performScheduledSave() --> diff_saveTree() --> асинхронная загрузка бек енд интерфейса, formingDiff, и вызов send

        //        if(debugLogChromeOperations) {
        //            if(console) console.log('TREE UPDATE timeSinceFirstUnsavedUpdate:', (Date.now() - this.timeOfFirstUnsavedUpdate)/1000, 'timeSinceLastCall:', (Date.now() - this.lastTreeUpdateTime)/1000);
        //            this.lastTreeUpdateTime = Date.now();
        //        }
    },

    EOC:null
});

var TreeModelPersistenceManagerIndexedDB = TreeModelPersistenceManagerAbstractBase.extend({
    restoreTree:function( callback /*(restoredTree)*/) {
        readOperationsFromIndexedDB(dataBaseSchemeV34_Default, function(savedOperations) {
            callback( savedOperations ? restoreTreeFromOperations(savedOperations) : null )
        } )
    },

    saveTree:function() {
        saveCurrentSessionAsOperationsToIndexedDbNow();
    },

    EOC:null
});

var TreeModelPersistenceManagerLocalStorage = TreeModelPersistenceManagerAbstractBase.extend({
    restoreTree:function( callback /*(restoredTree)*/) {
        var savedData = JSON.parse( localStorage.getItem(currentSessionSnapshotDbKey) );
        callback( (savedData && savedData['node']) ? restoreHierarchyFromJSO(savedData) : null );
    },

    saveTree:function() {
        saveCurrentSessionAsJSONtoLocalStorage();
    },

    EOC:null
});

// TODO, это очень тупо, но мы берём treeModel из глобальной activeSession.treeModel
var TreeModelPersistenceManagerIndexedDBAndFilesystem = TreeModelPersistenceManagerAbstractBase.extend({
    restoreTree:function( callback___________ /*callback___________(restoredTree)*/) {
        //FFv3 setTimeout(consoleLoglistOfAllFiles, 1); // Чтоб на нас не повлияли exceptions

        // WARNING СЛЕДИ ЗА CALLBACK() - это всегда должен быть последний вызов в ветке и в этой функции!

        // IndexedDB юзается таки в первую очередь так как я больше доверяю её serialize-deserialize уже проверенному
        // TODO ну и и для файла стоит не трим-save делать а save-rename (бажано во время фреш инстала или апгрейда при этом таки завратать файл с нужным именем чтоб filename1 нумерованный забить)

        // Я хочу поддерживать кейс востановление базы по бекапу IndexedDB базы. Хотя стоит от этого уходить. IndexedDB это жопа. <- мы уже совсем этот кейс потеряли.

        //RemovedInTransitionToV3
        //var serviceOptions_restoreSource =  localStorage['serviceOptions_restoreSource'];
        //RemovedInTransitionToV3 delete localStorage['serviceOptions_restoreSource'];
        // switch(serviceOptions_restoreSource) {
        //     case 'indexedDB'    : readOperationsFromIndexedDB( dataBaseSchemeV34_Default, function(indexedDbSavedOperations_v34) {
        //                                 if(isValidV34Data_endNodeIsEof(indexedDbSavedOperations_v34)) callback___________(restoreTreeFromOperations(indexedDbSavedOperations_v34));
        //                           });
        //                           return;
        //
        //     case 'file'         : readSessionDataFromFile(currentSessionSnapshotFilename, function(fileSavedOperations) {
        //                                 if(isValidV34Data_endNodeIsEof(fileSavedOperations))          callback___________(restoreTreeFromOperations(fileSavedOperations));
        //                           });
        //                           return;
        //
        //     case 'webSQL'       : readSessionDataBackupFromWebSQL( function(webSqlSavedOperations) {
        //                                 if( isValidV34Data_endNodeIsEof(webSqlSavedOperations) )      callback___________(restoreTreeFromOperations(webSqlSavedOperations));
        //                           });
        //                           return;
        //  
        //     case 'localstorage' : var treeInLocalStorage = JSON.parse(localStorage['onViewClose_lastSessionSnapshot']);
        //                           if( isValidV34Data_endNodeIsEof(treeInLocalStorage) )               callback___________(restoreTreeFromOperations(treeInLocalStorage));
        //                           return;
        //
        //     default/*filename*/ : readSessionDataFromFile(serviceOptions_restoreSource, function(fileSavedOperations) {
        //                                 if(isValidV34Data_endNodeIsEof(fileSavedOperations))          callback___________(restoreTreeFromOperations(fileSavedOperations));
        //                           });
        //                           return;
        // 
        //     case undefined: //MUST BE AFTER THE default:! Fall trough & continue normal execution
        // }


        // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
        readOperationsFromIndexedDB( dataBaseSchemeV34_Default, function(indexedDbSavedOperations_v34) {
            // Тут получаем:
            // либо валидную, но возможно она не совпадает с known save последним и в файле чтото свежее
            //    => надо чекнуть или даты совпадают с последним save, если нет то чекнуть файл и выбрать что свежее
            // либо невалидную indexedDbSavedOperations_v34, значит save v34DB ещё небыло (fresh install or upgrade), или, если файл таки есть это "rare strange case"
            //    => надо чекнуть есть ли файл

            // Сюда также могут зайти 2 типа откатов по бекапу, на 33 базу и на 34 тую, при том что файл таки будет существовать

            chrome.storage.local.get("lastSessionSnapshotSaveTime", (result) => {
                continueTreeInitialization(result.lastSessionSnapshotSaveTime);
            });

            function continueTreeInitialization(lastSessionSnapshotSaveTime) {
                try {
                if(console) console.log("localStorage.lastSessionSnapshotSaveTime :", (new Date(lastSessionSnapshotSaveTime)).toISOString());                
                if(console) console.log("V34DataSaveTime                          :", (new Date(getV34DataSaveTime(indexedDbSavedOperations_v34))).toISOString());
                } catch (e) {
                    // RangeError: Invalid time value
                    console.log("readOperationsFromIndexedDB lastSessionSnapshotSaveTime V34DataSaveTime",lastSessionSnapshotSaveTime,getV34DataSaveTime(indexedDbSavedOperations_v34));
                }
                
                if(getV34DataSaveTime(indexedDbSavedOperations_v34)) {
                    callback___________(restoreTreeFromOperations(indexedDbSavedOperations_v34)/*должно вернуть иерархию нод*/ );
                } else {
                    if(console) console.log('TABSOUTLINER FRESH INSTALL');
                    chrome.storage.local.set({ 'install-time': new Date().getTime() });
                    callback___________(restoreTreeFromOperations([/*Operations коих нет, вернёт null кстате*/]));
                    //FF_REMOVED_GA ga_setInstanceInstallTimeDimensions();
                }
            }

            //FFv3 function continueTreeInitialization(lastSessionSnapshotSaveTime) {
            //     if(getV34DataSaveTime(indexedDbSavedOperations_v34)/*NaN if not valid*/ == lastSessionSnapshotSaveTime ) {
            //         // сначало кейс "всё окей и по плану", это то что мы прошлый раз записали, никаких лишних движений не надо
            //         if(console) console.log("DB read ok; Data in DB have known lastSessionSnapshotSaveTime");
            //         callback___________(restoreTreeFromOperations(indexedDbSavedOperations_v34)/*должно вернуть иерархию нод*/ );
            //     } else {
            //         // Не совпадает с последним known save, возможно файл свежее, или это апгрейд, или фреш, или база тупо сдохла ("rare strange case"), в любом случае нужно чекнуть файл ещё
            //         if(console) console.log("No valid v34 data in database, or with unknown lastSaveTime (V34DataSaveTime, localStorage.lastSessionSnapshotSaveTime):", (new Date(getV34DataSaveTime(indexedDbSavedOperations_v34))).toISOString(), (new Date(lastSessionSnapshotSaveTime)).toISOString());

            //         var multipleCallbackinvocationOnErrorsChecker_file = 0;
            //         readSessionDataFromFile(currentSessionSnapshotFilename, function(fileSavedOperations) {
            //             if(++multipleCallbackinvocationOnErrorsChecker_file !== 1) return;

            //             // Тут мы уже имеем данные из файла также
            //             // Возьмём ещё и из localStorage
            //             try {
            //             var localStorageSavedOperations = {};//JSON.parse(localStorage['onViewClose_lastSessionSnapshot']);
            //             } catch(e) { /*ignore parse errors*/ }

            //             var idb_tstmp  =  getV34DataSaveTime(indexedDbSavedOperations_v34);
            //             var file_tstmp =  getV34DataSaveTime(fileSavedOperations);
            //             var lstr_tstmp =  0;//getV34DataSaveTime(localStorageSavedOperations);
            //             console.log('IDB, file, localstorage snapshots timestamps & lastSessionSnapshotSaveTime:', idb_tstmp, file_tstmp, lstr_tstmp, lastSessionSnapshotSaveTime);

            //             if (file_tstmp == lastSessionSnapshotSaveTime) {
            //                 // Довольно стандартный кейс, была запись но она успела произойти тока в файл. база данных обломалась
            //                 if(console) console.log("Data in file have known lastSaveTime, will restore tree from file");
            //                 callback___________(restoreTreeFromOperations(fileSavedOperations)/*должно вернуть иерархию нод*/ );
            //             } else if(lstr_tstmp == lastSessionSnapshotSaveTime) {
            //                 //Опять таки, стандартный кейс - была запись на закрытии TO, TO View было последним окном
            //                 if(console) console.log("Data in localStorage have known lastSaveTime, will restore tree from localStorage");
            //                 callback___________(restoreTreeFromOperations(localStorageSavedOperations)/*должно вернуть иерархию нод*/ );
            //             } else {
            //                 // У нас явные проблемы, либо фреш инсталл -----------------------------------------------------
            //                 // Ок, никто не имеет success lastSessionSnapshotSaveTime, либо само это значение в localStorage испорченное или несуществующее
            //                 if(console) console.log("Nor file, nor idb, nor localstorage have data with lastSessionSnapshotSaveTime", lastSessionSnapshotSaveTime);

            //                 // Один из очень вероятных вариантов - была запущено запись, но она обламалась и никуда не попала на диск, тем не менее lastSessionSnapshotSaveTime сменилось
            //                 // Это могло произойти и после успешной записи в localStorage, или после успешной записи в IDB
            //                 // Надо выбрать того кто самый свежий. И вообще живой (_tstmp != NaN)

            //                 // Есть правда одно но, если у чувака полетел и File и IDB storage мы не хотим юзать localStorage, так как оно скорее всего содержит данные более древнии чем есть в WebSQL (UPD: вообщето это уже не так, мы теперь туда тоже регулярно пишем)
            //                 if(idb_tstmp || file_tstmp) {// Если оба NaN мы не хотим пробовать localStorage, переходим сразу к WebSQL бекапу так как скорее всего он более свежий
            //                     // Test var numbers = [[4,{}], [2,{}], [0,{}], [1,{}], [3,{}], [6,{}]]; numbers.sort(function(a, b) { return b[0] - a[0]; }); console.log(numbers);
            //                     var freshestData = [[idb_tstmp || 0, indexedDbSavedOperations_v34], [file_tstmp || 0, fileSavedOperations], [lstr_tstmp || 0, localStorageSavedOperations]]; // NaN || 0 -> 0
            //                     freshestData.sort(function(a, b) { return b[0] - a[0] }); //NaN оно не сортирует
            //                     // freshestData[0] - самый больший timestamp имеет, в конце все с 0 (то что было NaN)
            //                     if(console) console.log("No data with known save time, will restore the freshest store");
            //                     callback___________(restoreTreeFromOperations(freshestData[0][1])/*должно вернуть иерархию нод*/ );
            //                 } else { // нет ни того ни другого валидного - это апгрейд c v33 или фреш инсталл,
            //                         // или и IndexedDB и File System обе окончательно сдохли (весьма вероятный сценарий который реально был)
            //                         // Кстате при апгрейде на v26 так и будет с целой кучей юзеров!

            //                     if(console) console.log("No valid DB34 nor File nor localStorage with knownSaveTime data");

            //                     // Проверяем или мы были заинсталены и хоть когдато чтото пытались писать, если да - читаем WebSQL, там должна быть последняя надежда : )
            //                     //if(lastSessionSnapshotSaveTime) {
            //                         // Тут была попытка востановится из WebSQL
            //                         // Но вообщето тут типа збой базы и возможно есть файловые бекапы, или на GDrive , 
            //                         // но пусть юзер сам их вручную востанавливает, хотя ему стоит об этом хотябы напомнить и расказать где
            //                         // причом не месагой а пермаментным (удаляемым) note в дереве
            //                         // #dataRestoreError
            //                     //} 

            //                     if(console) console.log('TABSOUTLINER FRESH INSTALL');
            //                     chrome.storage.local.set({ 'install-time': new Date().getTime() });
            //                     callback___________(restoreTreeFromOperations([/*Operations коих нет, вернёт null кстате*/]));
            //                     ga_setInstanceInstallTimeDimensions();
            //                 }
            //             }

            //         });
            //     }
            // }
        });
    },

    registerTree:function(tree) {
        this._super(tree);

        //REALTIMEBACKUP
        //this.prepareAndSendDiffsManager = new PrepareAndSendDiffsManager(tree);

    },

    diff_saveTree:function() { // Вызывается также всегда перед saveTree() в обязательном порядке + сильно чаще обычного saveTree из-за настроект таймера накоплений изменений
        //REALTIMEBACKUP
        //this.prepareAndSendDiffsManager.treeUpdated();
    },

    saveTree:function(isSynchronousUnscheduledSaveRequested) {
        var sessionDataAsOperations = this.tree.serializeAsOperationsLog(); //TODO нафиг надо AsOperationsLog, просто .serialize() быстрее и выдаёт JSON, ну да хер с ним
        chrome.storage.local.set({ 'lastSessionSnapshotSaveTime':    sessionDataAsOperations[sessionDataAsOperations.length-1]['time'] });
        chrome.storage.local.set({ 'lastSavedSessionSnapshotLength': sessionDataAsOperations.length });

        // Save Tree Synchronously, on onbeforeunload ------------------------------------------------------------------
        // Выходит на рестарте я всегда делаю бекап в WebSQL, а c версии 81 в LocalStorage. Какбы мне боком это не вылезло и тормоза на старте. Хотя большое дерево в LS всёравно не влезет
        // TODO вообще тут на старте так выходит что я пишу просто вообще всюду копию. Для большого дерева это явно тормоза!!
        
        //RemovedInTransitionToV3
        //var webSqlBackupPeriod = 20*60*1000;
        //var isTimeForWebSqlBackup = !window['lastWebSqlBackupTime'] || (window['lastWebSqlBackupTime'] + webSqlBackupPeriod) < Date.now();

        //RemovedInTransitionToV3
        // try {
        // if(!this.localStorageQuataReached && (isSynchronousUnscheduledSaveRequested/*true on onbeforeunload*/ || isTimeForWebSqlBackup)) { // Раз в 20 минут всёже пишем и в LoacalStorage, бо в Dev билда была хорошая бага - которая стирала все storages кроме LS
        //     var exportDataString = JSON.stringify(sessionDataAsOperations);
        //     if(exportDataString.length < 2333444) {// максимально влазит 2620991; 2333444 это 10000 нод
        //         try {
        //             localStorage['onViewClose_lastSessionSnapshot'] = exportDataString;
        //         } catch (e) { console.error("ERROR SSC QUATA", e); }
        //     } else {
        //         onsole.warn("WARNING SSC QUATA"); // Synchronous save canceled because size exceed the safe margin
        //         this.localStorageQuataReached = true; // disable this branch for this session
        //     }
        // }
        // } catch(e) { /*На всякий случай если console закрешают */ }
        // -------------------------------------------------------------------------------------------------------------

        setTimeout(function() { saveToDefaultIndexedDB(currentSessionSnapshotDbKey,   sessionDataAsOperations) } ,1); // Чтоб на нас не повлияли exceptions
        //FFv3 setTimeout(function() { saveSessionDataAsFile(currentSessionSnapshotFilename, sessionDataAsOperations) } ,1); // Чтоб на нас не повлияли exceptions

        //RemovedInTransitionToV3
        // if(window['treeWriteFail'] || isTimeForWebSqlBackup ) {
        //     setTimeout(function() { backupSessionDataInWebSQL( JSON.stringify(sessionDataAsOperations), sessionDataAsOperations.length ) } ,1); // Чтоб на нас не повлияли exceptions
        //     // if(console) console.log('Do WebSQL backup');
        //     window['lastWebSqlBackupTime'] = Date.now();
        // }

        // Переходим к бекапу ------------------------------------------------------------------------------------------
        //FFv3 performBackups(sessionDataAsOperations, 'lastDaylyBackupTime', 24*60*60*1000, "d-backup-", 9);
        //FFv3 performBackups(sessionDataAsOperations, 'lastHourlyBackupTime',   60*60*1000, "h-backup-", 6);
    },

    EOC:null
});

// =====================================================================================================================================================
//REALTIMEBACKUP
//var PrepareAndSendDiffsManager = Class.extend({
//    init:function(tree) {
//        this.tree = tree;
//        this.lastTryToSendTimestamp = null;
//        this.xmlhttprequest = null;
//        this.issueTreeUpdatedOnSendFinish = false;
//    },
//
//    isSendIsInprogress:function() {
//        return this.xmlhttprequest && this.xmlhttprequest.readyState != this.xmlhttprequest.DONE;
//    },
//
//    isWaitingOfSendDoneForTooLong:function() {
//        return (Date.now() - this.lastTryToSendTimestamp) > (1000 * 120); // 2m
//    },
//
//    treeUpdated:function() {
//        if(this.isSendIsInprogress() && !this.isWaitingOfSendDoneForTooLong() ) {
//            this.issueTreeUpdatedOnSendFinish = true;
//            if(debugLogChromeOperations) { console.log("SEND-IS-IN-PROGRESS"); }
//        } else {
//            if(this.isSendIsInprogress() && this.isWaitingOfSendDoneForTooLong()) { console.error("ERROR !!! Last XmlHttpRequest cannot finish save in 2m!"); } // TODO Report to server side
//
//            this.issueTreeUpdatedOnSendFinish = false;
//            this.lastTryToSendTimestamp = Date.now();
//            this._makeDiff_Save_Send();
//        }
//    },
//
//    _makeDiff_Save_Send:function() {
//        // var differenceTransaction = this.tree.serializeTheDifference( this.tree.currentSession_rootNode.getNextDid_withoutAdvance() );
//        // Тут можем в результате получить при первом запуске запросто дерево размером в 10000 нод которое ни разу не влазит в local storage, и вообще никуда (out of space)
//        // console.log(differenceTransaction, JSON.stringify(differenceTransaction).length);
//
//        // -------------------------------------------------------------------------------------------------------------
//
//        if(localStorage['be_connected'] !== 'true') return;
//
//        if(debugLogChromeOperations) { console.group("#saveDiff#"); }
//
//        try{
//        var _this_PrepareAndSendDiffsManager = this;
//        backEndInterface.callOnBackEndInterface(localStorage['be_serverSideUri'], saveDiff);
//        } catch(e) {
//            console.groupEnd("#saveDiff#");
//            throw e; // Кидаем вверх по стеку, там обработчики этого ждут
//        }
//
//        function saveDiff(backEndInterface) {
//
//            if(debugLogChromeOperations) { console.time("#saveDiff# SERIALIZE DIFF"); }
//
//            var nextUnsentDid = Number(localStorage['be_nextUnsentDid']);
//            var diffData = _this_PrepareAndSendDiffsManager.tree.serializeTheDifference( nextUnsentDid );
//            var nextNonutilizedDid = _this_PrepareAndSendDiffsManager.tree.currentSession_rootNode.getNextDid_withoutAdvance(); // Надо вызывать после serializeTheDifference, так как именно там новые did назначаются
//            diffData['pass'] = localStorage['be_treeWritePass']; // Посылаем его внутри post body, чтоб в урле оно не светилось для чужих расширений что следят за таким
//
//            if(debugLogChromeOperations) { console.timeEnd("#saveDiff# SERIALIZE DIFF"); }
//
//            if( nextUnsentDid == nextNonutilizedDid ) {
//                if(debugLogChromeOperations) { console.log("#saveDiff# No Changes meantime - nextUnsentDid == nextNonutilizedDid"); }
//                if(debugLogChromeOperations) { console.groupEnd("#saveDiff#"); }
//            } else {
//                // SEND ---------------------------------------------------------------------------------------------------------
//                var diffDataStringified = JSON.stringify(diffData);
//                if(debugLogChromeOperations) { console.log("#saveDiff# BE-SAVE-CALL len:%d, obj:%O, str(obj):\n", diffDataStringified.length, diffData, diffDataStringified); }
//                if(debugLogChromeOperations) { console_log_differenceTransaction(diffData); }
//                localStorage['be_onRestartAdvaceNextDidToLastSentDidForNextDiff'] = nextNonutilizedDid;
//
//                if(debugLogChromeOperations) { console.time("#saveDiff# PERFORMSEND"); }
//
//                _this_PrepareAndSendDiffsManager.xmlhttprequest =  backEndInterface.saveDiff(
//                    localStorage['be_serverSideUri'],
//                    localStorage['be_ownerUserId'],
//                    localStorage['be_treeId'],
//                    localStorage['be_nextUnsentDid'],
//                    nextNonutilizedDid,
//                    "text/plain", // для него не надо вызывать encodeURIComponent() после JSON.stringify, в отличии от "application/x-www-form-urlencoded" к примеру
//                    diffDataStringified, //TODO стоило бы глянуть как оно реально передаётся, и вообще как оно знает что это UTF-8, и знает ли, и действительно ли это UTF-8!
//                    function onAccepted(responseText) {
//                        var response = JSON.parse(responseText);
//                        localStorage['be_nextUnsentDid'] = response['expectedNextDid']; // Хотя покачто это гарантировано то что мы передали в nextDidThatWillBeUsed
//                        localStorage['be_lastRev']       = response['rev'];
//
//                        if(debugLogChromeOperations) { console.log("#saveDiff# onAccepted", responseText); }
//                    },
//                    function onError(xmlHttpRequestObj, httpStatus, responseText) {
//                        try {
//                            var response = JSON.parse(responseText);
//                            if(response['status'] == 'DIDS_COLLISION') {
//                                console.error("DIDS_COLLISION", response, "LS[rev]:", localStorage['be_lastRev']);
//                                localStorage['be_nextUnsentDid'] = response['expectedNextDid'];
//                                _this_PrepareAndSendDiffsManager.tree.renumerateDidsOnCollision( Number(response['minDid']), Number(response['expectedNextDid']), Number(response['maxDid']));
//                                _this_PrepareAndSendDiffsManager.issueTreeUpdatedOnSendFinish = true; // onDoneState wich will be called next will schedule new call to treeUpdate
//                                return;
//
//                            }
//                        } catch(e) {
//                            // JSON.parse exception
//                        }
//                        console.error("#saveDiff# ERROR SENDING DATA", httpStatus, responseText, xmlHttpRequestObj);
//                    },
//                    function onDoneState() {
//                        if(debugLogChromeOperations) { console.timeEnd("#saveDiff# PERFORMSEND"); }
//
//                        if( _this_PrepareAndSendDiffsManager.issueTreeUpdatedOnSendFinish ) { // Во время send был treeUpdate - его надо дослать, на тот случай если нового долго (или вообще - креш) не будет, да и просто чтоб история о нём была
//                            setTimeout( function() {_this_PrepareAndSendDiffsManager.treeUpdated()}, 1 ); // setTimeout просто на всякий случай, никаких показаний особых к этому небыло
//                            if(debugLogChromeOperations) { console.log("#saveDiff# Issue treeUpdate which was skiped because of the send_in_progress"); }
//                        }
//
//                        if(debugLogChromeOperations) { console.groupEnd("#saveDiff#"); }
//                    }
//                );
//            }
//
//
//        }
//    },
//
//    EOC:null
//});

function backupSessionDataInWebSQL(dataString, op_array_len) {
    var db = openDatabase('backupdb', '1.0', 'Tree Backup', 20 * 1024 * 1024);
    db.transaction(function (tx) {
      tx.executeSql('CREATE TABLE IF NOT EXISTS current_session_snapshot (id unique, timestamp, op_array_len, data)');
      tx.executeSql('INSERT OR REPLACE INTO current_session_snapshot (id, timestamp, op_array_len, data) VALUES (?, ?, ?, ?)', [1, Date.now(), op_array_len, dataString]);
    });
}

function readSessionDataBackupFromWebSQL( callback ) {
    var db = openDatabase('backupdb', '1.0', 'Tree Backup', 20 * 1024 * 1024);
    db.readTransaction(function (tx) {
        tx.executeSql('SELECT * FROM current_session_snapshot WHERE id == 1', [], function (tx, results) {
            var result = results.rows.item(0);
            if(!result) {
                if(console) console.log("WEBSQL backup read error - result is empty");
                callback(null);
            } else {
                try { var operations = JSON.parse(result.data); } catch(parseError) { callback(parseError); }
                callback(operations);
            }
        }, function (error) {
            if(console) console.log("WEBSQL executeSql error:", error);
            callback(null);
        } );
    });

}

function getV34DataSaveTime(operations) {
    if(isValidV34Data_endNodeIsEof(operations))
        return operations[operations.length-1]['time'];

    return NaN;
}

function isValidV34Data_endNodeIsEof(operations) {
    return operations &&
           operations.length &&
          (operations.length >= 2) &&
          (operations[0]['type'] == DbOperations.OperationsEnum.NODE_NEWROOT) &&
          (operations[operations.length-1]['type'] == DbOperations.OperationsEnum.EOF);
}

function performBackups(sessionDataAsOperations, localStorageFieldForLastBackupTimestamp, timeBetweenBackups, backupFilePrefix, howManyBackupsHandle) {
    var lastBackupTime = Number(localStorage[localStorageFieldForLastBackupTimestamp] || 0); // 0 or 'time'
    if( Math.abs(Date.now() - lastBackupTime) > timeBetweenBackups ) {
        localStorage[localStorageFieldForLastBackupTimestamp] = Date.now(); // до записи файла иначе мы пока таймаут будет подходит ещё 4 раза стартанём
        setTimeout(function() { saveSessionDataAsFile(backupFilePrefix+Date.now()+"-"+sessionDataAsOperations.length+".json", sessionDataAsOperations, function onwriteend() {
            deleteOlderBackups(backupFilePrefix, howManyBackupsHandle);
        })}, 5000 + Math.round(Math.random()*2000) ); // setTimeout - Чтоб на нас не повлияли exceptions
    }
}

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
    });
}

function deleteFileByFullPath(fullPath, continuneCallback) {
    continuneCallback = continuneCallback || function(){};
    webkitRequestFileSystem(PERSISTENT, 1024*1024 /*1MB*/, function(fs) {
        fs.root.getFile(fullPath, {create: false}, function(fileEntry) {
            fileEntry.remove(continuneCallback);
        });
    });
}

function consoleLoglistOfAllFiles() {
    listAllFiles(function(entries){
        console.log('- Files -------------------------------');
        for(var i = 0; i < entries.length; i++)
            console.log(entries[i].name);
    });
}

function listAllFiles(callback_listResults/*[entries]*/) {
    webkitRequestFileSystem(PERSISTENT, 1024*1024, onInitFs_listAllFiles, fsErrorHandler);

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

//----------------------------------------------------------------------------------------------------------------------
function ActiveSession(continueCallback) {
    this.treeModel = null;

    //RRv3 this.onRemovedTracker =  new OnRemovedTracker();

    // this.treeModelPersistenceManager = new TreeModelPersistenceManagerLocalStorage();
    // this.treeModelPersistenceManager = new TreeModelPersistenceManagerIndexedDB();
    this.treeModelPersistenceManager = new TreeModelPersistenceManagerIndexedDBAndFilesystem();


    var _this = this;

    this.treeModelPersistenceManager.restoreTree( function(restoredHierarchy) {
        var rootNode = restoredHierarchy;
        if(!rootNode) rootNode = new NodeSession();

        // простенький кейс препятствующий перекрытию dids на серваке, при падении дерева и без механизма долива высланных diffs
        // Таким образом на серваке возможно будет более свежий вариант дерева, который таки перетрётся тем что опять будет выслано
        // но без ерроров, и by step back можно будет эти предыдущие варианты, которые были высланы до рестарта, даже увидеть.
        //REALTIMEBACKUP rootNode.advanceNextDidToValue(localStorage['be_onRestartAdvaceNextDidToLastSentDidForNextDiff']);

        _this.treeModel = extentToTreeModel([rootNode], _this.treeModelPersistenceManager, viewsCommunicationInterface);

        //RRv3 _this.applyOnRemovedRecordedBeforeLastSessionExit();

        _this.asyncSynchronizeTreeWithOpenWindowsList( function continueInit() {
            // Регестрировать эвенты надо(i think so) именно сдесь - после создания дерева окон готовых принять эти эвенты
            _this.registerChromeEventsListeners();

            continueCallback();
        });

    });
}

ActiveSession.prototype = {
    applyOnRemovedRecordedBeforeLastSessionExit : function() {
        try {
            var tabOnRemovedEvents = this.onRemovedTracker.getTabsOnRemovedEventsFromLastSession();
            var tabOnRemovedIds = Object.keys(tabOnRemovedEvents); // {id:closingInfo, ...}
            for(var i = 0; i < tabOnRemovedIds.length; i++) {
                var closedTabId = tabOnRemovedIds[i];
                var closedTabClosingInfo = tabOnRemovedEvents[closedTabId];
                if(console)console.log("APPLY CT", closedTabId, JSON.stringify(closedTabClosingInfo));
                this.treeModel.onActiveTabRemoved(closedTabId, closedTabClosingInfo, true/*supress not found errors*/);
            }

            var winOnRemovedEvents = this.onRemovedTracker.getWindowsOnRemovedEventsFromLastSession();
            var winOnRemovedIds = Object.keys(winOnRemovedEvents); // {id:Date, ...}
            for(i = 0; i < winOnRemovedIds.length; i++) {
                if(console)console.log("APPLY CW", winOnRemovedIds[i]);
                this.treeModel.onActiveWindowRemoved(winOnRemovedIds[i], true/*supress not found errors*/);
            }
        } catch(e) {
            // There was bug which i was not be able to reproduce, but it's stop the tree restoration,
            // So this Try Catch block just to be sure we will start anyway even if there some problems,
            // As this block is highly optional
            // The exceptionl was inside  this.treeModel.onActiveTabRemoved() -> "Cannot read property 'isWindowClosing' of undefined"
            // It must not anymore produced eeven in such case, but, just to be sure there is no unnecesary
            // start halt because of other errors, for example mannualy corrupted localStorage

            console.error("ERROR ! AORRBRS", e);
            console.log(e['message']);
            console.log(e['stack']);
        }
    },

    asyncSynchronizeTreeWithOpenWindowsList : function( doneCallback ) {
        var _this = this;
        chrome.windows.getAll({ 'populate': true }, function(chromeActiveWindowObjectsList) {

            // Crashed Nodes Creation ----------------------------------------------------------------------------------

            // Для всех NodeActiveTab в дереве - конвертим себя в saved-crashed если нас нет среди живых.
            var listOfTabNodesThatMustBeConvertedToSaved = [];
            forEachNodeInTree_noChangesInTree(_this.treeModel, function(node) {
                if(node.updateChromeTabObjOrRequestConvertToSavedIfNotInActiveList)
                    node.updateChromeTabObjOrRequestConvertToSavedIfNotInActiveList(chromeActiveWindowObjectsList, listOfTabNodesThatMustBeConvertedToSaved);
            });

            listOfTabNodesThatMustBeConvertedToSaved.forEach(function(tabNode) { tabNode.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabSavedAfterCrash(tabNode.chromeTabObj) ) } );


            // Для всех NodeActiveWindow в дереве - конвертим себя в saved-crashed если для нашего обекта не создалось ни одного NodeActiveTab
            var listOfWindowNodesThatMustBeConvertedToSaved = [];
            var crashedSavedPopupWindowNodes = [];
            forEachNodeInTree_noChangesInTree(_this.treeModel, function(node) {
                if(node.updateChromeWindowObjOrConvertToSavedIfNoActiveTabNodesCreated)
                    node.updateChromeWindowObjOrConvertToSavedIfNoActiveTabNodesCreated(chromeActiveWindowObjectsList, listOfWindowNodesThatMustBeConvertedToSaved);
            });

            listOfWindowNodesThatMustBeConvertedToSaved.forEach(function(windowNode) {
                var newNode = windowNode.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeWindowSavedAfterCrash(windowNode.chromeWindowObj) );

                // Удаляем крешпнутые Tabs Outliner и другие Popup окна если они не имеют никаких отметок
                if(newNode.chromeWindowObj && newNode.chromeWindowObj.type && newNode.chromeWindowObj.type == 'popup') {
                    var crashedSavedPopupWinNode = newNode;
                    if(crashedSavedPopupWinNode.subnodes.length === 1 /*один таб*/) {
                        var crashedPopupTab = crashedSavedPopupWinNode.subnodes[0];
                        // и ни он не само окно не имеет никаких отметок или других табов
                        if( crashedPopupTab.subnodes.length === 0 &&
                            !crashedPopupTab.isCustomMarksPresent() &&
                            !crashedSavedPopupWinNode.isCustomMarksPresent() ) crashedSavedPopupWinNode.removeOwnTreeFromParent();
                    }
                }
            });

            // Nodes For New Items -------------------------------------------------------------------------------------

            // Вызываем fromChrome_onWindowCreated & fromChrome_onWindowCreated  для всех окон и табов что небыли заюзаны - тоесть это новые табы и окна без ноды в дереве
            chromeActiveWindowObjectsList.forEach( function(chromeWindowObj){
                   if( !chromeWindowObj.isUsedByNode ) _this.fromChrome_onWindowCreated(chromeWindowObj); // isUsedByNode устанавливается в true в предыдущих проходах
                   else delete chromeWindowObj.isUsedByNode; // Просто убираем мусор чтоб он не сериализировался в базу

                   chromeWindowObj.tabs.forEach( function(chromeTabObj){
                        if( !chromeTabObj.isUsedByNode ) _this.fromChrome_onTabCreated(chromeTabObj);
                        else delete chromeTabObj.isUsedByNode; // Просто убираем мусор чтоб он не сериализировался в базу
                   } );

                   if(chromeWindowObj.haveActiveTabNodesInTree) delete chromeWindowObj.haveActiveTabNodesInTree; // Просто убираем мусор чтоб он не сериализировался в базу
            } );

            // ---------------------------------------------------------------------------------------------------------

            // [уже не нужный код] Удаляем не востановленным saved табам и окнам id шки табов и окон, нужно чтоб в последующем при записи сессии они не совпали с новыми записанными табами
            forEachNodeInTree_noChangesInTree(_this.treeModel, function(node) {
                if(node.onAfterCrashRestorationDone) node.onAfterCrashRestorationDone();
            });

            doneCallback();
        });
    },

    registerChromeEventsListeners : function () {
        //if(!chrome.tabs.onReplaced) chrome.tabs.onReplaced = {addListener:function(f){}}; // To preven errors on very old chromes where is onReplaced is not defined

        // Debug log events
        if(debugLogChromeOperations) {
            chrome.tabs.onCreated.addListener(          function(tab)                            { console.log('Tab onCreated tabid:' + tab.id + '; url:' + tab.url, tab)} );
            chrome.tabs.onRemoved.addListener(          function(tabId, isWindowClosing )        { console.log('Tab onRemoved tabid:' + tabId + '; isWindowClosingInformation:', isWindowClosing)} );
            chrome.tabs.onAttached.addListener(         function(tabId, attachInfo)              { console.log('Tab onAttached tabid:' + tabId + '; attached to windowid:' + attachInfo.newWindowId, attachInfo)} );
            chrome.tabs.onDetached.addListener(         function(tabId, detachInfo)              { console.log('Tab onDetached tabid:' + tabId + '; detached from windowid:' + detachInfo.oldWindowId, detachInfo)} );
            chrome.tabs.onMoved.addListener(            function(tabId, info)                    { console.log('Tab onMoved tabid:' + tabId, info)} );
            chrome.tabs.onUpdated.addListener(          function(tabId, changeInfornamtion, tab) { console.log('Tab onUpdated tabid:' + tabId + '; url: ' + changeInfornamtion.url + '; status: ' + changeInfornamtion.status + '; favicon url : ' + tab.favIconUrl + '; changeInfornamtion:', changeInfornamtion, '; tab:', tab)} );
            chrome.tabs.onReplaced.addListener(         function(addedTabId, removedTabId)       { console.log('Tab onReplaced addedTabId:',addedTabId, 'removedTabId:',removedTabId)} );
            //chrome.tabs.onSelectionChanged.addListener( function(tabId, selectInformation)       { console.log('Tab onSelectionChanged(deprecated) tabid:' + tabId + '; selected in window:' + selectInformation.windowId, selectInformation)} );
            chrome.tabs.onActivated.addListener(        function(activeInfo)                     { console.log('Tab onActivated activeInfo:', activeInfo)} );
            chrome.windows.onCreated.addListener(       function(windowObj)                      { console.log('Window onCreated winid:' + windowObj.id, windowObj)} );
            chrome.windows.onRemoved.addListener(       function(windowId)                       { console.log('Window onRemoved winid:' + windowId)} );
            chrome.windows.onFocusChanged.addListener(  function(windowId)                       { console.log('Window onFocusChanged winid:' + windowId + ' got focus')} );

            // есть ещё:
            // chrome.tabs.onHighlightChanged
            // chrome.tabs.onActiveChanged
            // chrome.tabs.onHighlighted

            // chrome.idle.queryState(15, function(newState) { console.log('# IDLE #### queryState # newState:' + newState) });
            // chrome.idle.onStateChanged.addListener( function(newState) { console.log('# IDLE #### onStateChanged # newState:' + newState) } );
        }

        /*
        chrome.history.onVisited.addListener(function(e) {
            console.log("history.onVisited ", e.id, e.url, e)
            chrome.history.getVisits( {'url':e.url}, function(visitItems) {
                var vi = visitItems[visitItems.length-1]
                console.log("history.getVisits lastVisit transition:" + vi.transition +" id:"+ vi.id + " referringVisitId:"+ vi.referringVisitId)
            } );
        });
        */
        // Реестрируем функционал ведения дерева
        chrome.tabs.onCreated.addListener(          this.fromChrome_onTabCreated          .bind(this) );
        chrome.tabs.onRemoved.addListener(          this.fromChrome_onTabRemoved          .bind(this) );
        chrome.tabs.onAttached.addListener(         this.fromChrome_onTabAttached         .bind(this) );
        chrome.tabs.onDetached.addListener(         this.fromChrome_onTabDetached         .bind(this) );
        chrome.tabs.onMoved.addListener(            this.fromChrome_onTabMoved            .bind(this) );  //This event is not fired when a tab is moved between windows. For that, see onDetached.
        chrome.tabs.onUpdated.addListener(          this.fromChrome_onTabUpdated          .bind(this) );
        chrome.tabs.onReplaced.addListener(         this.fromChrome_onTabReplaced         .bind(this) );
        chrome.tabs.onActivated.addListener(        this.fromChrome_onTabActivated        .bind(this) );
        chrome.windows.onCreated.addListener(       this.fromChrome_onWindowCreated       .bind(this) );
        chrome.windows.onRemoved.addListener(       this.fromChrome_onWindowRemoved       .bind(this) );
        chrome.windows.onFocusChanged.addListener(  this.fromChrome_onWindowFocusChanged  .bind(this) );

        //REALTIMEBACKUP
        // Реестрируем функционал связи с бек ендом
        // FAG
        //chrome.tabs.onUpdated.addListener( this.fromChrome_onTabUpdated_checkForServerSideRequests.bind(this) );

        //chrome.runtime.onMessageExternal.addListener( this.fromChrome_onExternalMessage.bind(this) );
    },

    // fromChrome_onExternalMessage : function(request, sender, sendResponse) {
    //     console.log("ExternalRequest:", request, sender/*{tab: , url: }*/);

    //     //sendResponse({"trialTimeLeft":"3 days"});
    //     sendResponse({"isTrialExpired":true});
    //     //sendResponse({"isRegistered":true, "licenseKey":"KEYKEYKEY"});
    // },
    
    fromChrome_onTabReplaced : function(addedTabId, removedTabId) {
        var newTabNode = this.treeModel.onTabIdReplaced(removedTabId, addedTabId);
        if(!newTabNode) return;

        // ChromeTabObj must be updated, it contains incorrect Title Url and everything else exept ID fater onTabReplaced
        chrome.tabs.get(newTabNode.chromeTabObj.id, function(chromeTabObj) {
            if(chromeTabObj) newTabNode.updateChromeTabObj( chromeTabObj )
        });
    },

////REALTIMEBACKUP
//// FAG    // Communication with GAE ------------------------------------------------------------------------------------------
//    fromChrome_onTabUpdated_checkForServerSideRequests : function(tabId, changeInfornamtion, chromeTabObj) {
//        if( chromeTabObj['status'] != "complete" ) return; // To prevent potential double calls on loading and then on complete
//
//        var params = backEndInterface.ifThisIsOurServerSideProfilePathReturnParams(chromeTabObj.url);
//        if( params ) {
//            switch(params['action']) {
//                case 'impart_state':
//                    if(!backEndInterface.usedTokens[params['t']]) {
//
//                        this.reportOwnStateToBackEnd(params);
//
//                        backEndInterface.usedTokens[params['t']] = true; // Чтоб по 2 раза на loading -> complete не дёргать сервак
//                    }
//                    break;
//
//                case 'connect_signal':
//                    // Мониторим title на признак того что юзер реально владеет данным акаунтом - там появляется '#' если таки он залоган и userId в url равен реальному userId
//                    if(backEndInterface.titleContainConfirmIndicator(chromeTabObj.title)) {
//                        if(!backEndInterface.usedTokens[params['t']]) {
//
//                            this.connectOwnTreeToBackEnd(params);
//                            // this.connectToBackEnd(params); // store userId=185804764220139124118
//                            // this.reportOwnStateToBackEnd(params);
//
//                             backEndInterface.usedTokens[params['t']] = true; // Чтоб по 2 раза на loading -> complete не дёргать сервак
//                        }
//
//                    }
//                    break;
//            }
//        }
//
//    },
//
//    connectToBackEnd : function(params, treeIdAndPassJsonObj) {
//        if(debugLogChromeOperations) console.log("BE-CON", params);
//        if(params['userId'] && treeIdAndPassJsonObj['treeId'] && treeIdAndPassJsonObj['writePass']) {
//            localStorage['be_lastRev']       = -1;
//            localStorage['be_nextUnsentDid'] = 1; // Мы начинаем с еденицы, 0 для эрроров
//            localStorage['be_connected']     = 'true';
//            localStorage['be_serverSideUri'] = params.serverSideUri;
//
//            localStorage['be_ownerUserId']   = params['userId'];
//            localStorage['be_treeId']        = treeIdAndPassJsonObj['treeId'];
//            localStorage['be_treeWritePass'] = treeIdAndPassJsonObj['writePass'];
//
//         // localStorage['be_onRestartAdvaceNextDidToLastSentDidForNextDiff'] = 1; См. комент ниже
//         // Не надо тут сетать, просто тут упомянут чтоб знать что он есть, хотя это больше с самим деревом связанная штука чем с бек ендом
//         // При подготовке Diff к отсылке и до самой отсылки сюда мы пишем nextDid
//         // При этом отсылка могла пройти, а могла и не пройти, не важно, важно что что дерево могло грохнутся в тот момент когда этот nextDid
//         // ещё небыло сериализировано на диск и на следующим рестарте какието узлы получат did которые уже высылались на сервак,
//         // и соответственно сервак не примет такой diff => надо эти did проскипать на рестарте ещё до использования метода tree.getNextDid
//
//        }
//
//    },
//
//    disconectFromBackEnd : function() {
//        delete localStorage['be_lastRev'];
//
//        delete localStorage['be_nextUnsentDid'];
//
//        delete localStorage['be_connected'];
//        delete localStorage['be_ownerUserId'];
//        delete localStorage['be_serverSideUri'];
//
//        delete localStorage['be_treeId'];
//        delete localStorage['be_treeWritePass'];
//    },
//
//    reportOwnStateToBackEnd : function(params, isAfterConnectAction) {
//        if(debugLogChromeOperations) console.log("BE-REP", params);
//
//        function reportInfo(backEndInterface) {
//            if(debugLogChromeOperations) console.log("BE-REP-CALL");
//
//            var status = {
//                "alifeAndWell":true,
//                "connected":localStorage['be_connected'],
//                "userId":localStorage['be_ownerUserId'],
//                "treeId":localStorage['be_treeId']
//            };
//
//            if(isAfterConnectAction) status['refreshPageAfterNewTreeConnected'] = true;
//
//            backEndInterface.reportState(params.serverSideUri, params['t'], status );
//        }
//
//        backEndInterface.callOnBackEndInterface(params.serverSideUri, reportInfo);
//    },
//
//
//// FAG
//    connectOwnTreeToBackEnd : function(params) {
//        if(debugLogChromeOperations) console.log("BE-REG", params);
//
//        var _this = this;
//
//        function connectNewTree(backEndInterface) {
//            if(debugLogChromeOperations) console.log("BE-REG-CALL");
//            backEndInterface.createNewTree(
//                params['serverSideUri'],
//                params['t'],
//                params['userId'],
//                getLocalStorageConfigInfoAsJsonString(),
//                function onAccepted(treeIdAndPassJson) {
//                    if(debugLogChromeOperations) console.log("BE-REG-CALL succeded", params, treeIdAndPassJson);
//
//                    _this.connectToBackEnd(params, JSON.parse(treeIdAndPassJson));
//                    _this.reportOwnStateToBackEnd(params, true);
//                },
//                function onRejected(p) {
//                    console.error("BE-REG-CALL rejected", p);
//                },
//                function onError(p) {
//                    console.error("BE-REG-CALL connection error", p);
//                }
//            );
//        }
//
//        backEndInterface.callOnBackEndInterface(params.serverSideUri, connectNewTree);
//    },
//
//    // подвешено на тестовую кнопку на test page
//    sendDiffDataToBackEnd_ifConnected : function() {
//        //REALTIMEBACKUP
//        //( new PrepareAndSendDiffsManager(activeSession.treeModel) )._makeDiff_Save_Send();
//    },

    // -----------------------------------------------------------------------------------------------------------------

    fromChrome_onTabCreated : function(chromeTabObj) {
        return this.treeModel.fromChrome_onTabCreated(chromeTabObj);
    },

    fromChrome_onWindowCreated : function(chromeWindowObj) {
        return this.treeModel.fromChrome_onWindowCreated(chromeWindowObj);
    },

    fromChrome_onTabAttached : function(tabId, attachInfo) {
        // attachInfo - {newWindowId:x, newPosition:n}

        let relateNewTabToOpener = true;
        // getOption('relateNewTabToOpener').then( (relateNewTabToOpener) => {

            var windowNode = this.treeModel.findActiveWindow(attachInfo.newWindowId);
            if(!windowNode)
            {
                console.error("ERROR fromChrome_onTabAttached attachInfo.newWindowId has no coresponding windowNode in tree");
                // TODO, so what? we must create this new window! Or beter request full active session rescan and synchronize our tree with current crome state
                // TODO FULLRESCAN
                return;
            }

            var corespondingTabNodeInTargetWindow = windowNode.findAlifeTabInOwnTabsById(tabId);

            if(corespondingTabNodeInTargetWindow) // Мы ожидали этого detach-attach-move он был инициирован нами, либо это реатач в тоже самое окно из которого был сделан детач
            {
                if(debugLogChromeOperations) console.log("This Is Tabs Move Initiated By Our Extention Or Chrome Initiated In One Window ReAttach");

                var corespondingTabNodeInTargetWindow_chromeTabObj = corespondingTabNodeInTargetWindow.chromeTabObj;

                if(corespondingTabNodeInTargetWindow_chromeTabObj.windowId === attachInfo.newWindowId)
                { // Это детач и реатач в тоже самое окно из которого сделали детач
                    if(debugLogChromeOperations) console.log("This Is Tabs Move Inside One Window because of Initiated By Chrome Reattach");

                    if(attachInfo.newPosition !== corespondingTabNodeInTargetWindow_chromeTabObj.index/*нельзя его юзать, он уж давно левый мог быть*/)
                        this.chromeInitiated_moveTabNode(tabId, {'fromIndex':corespondingTabNodeInTargetWindow_chromeTabObj.index, 'toIndex':attachInfo.newPosition, 'windowId':attachInfo.newWindowId}, relateNewTabToOpener);
                }
                else
                { // Этот onTabAttached инициирован нашим плагином в результате move между разным tabsOrganizer, и мы его ожидаем,
                    if(debugLogChromeOperations) console.log("This Is Tabs Move Initiated By Our Extention, between different tabsOrganizers");

                    // TODO Стоило бы сделать полноценный апдейт chromeTabObj через chrome.tabs.get() и updateChromeTabObj(), там много чего могло сменится (windowid, index, selected, pinned, highlighted)
                    corespondingTabNodeInTargetWindow_chromeTabObj.active   = false; // вот совсем не факт что оно false!!! Но в большинстве случаев onAttach (во всех инициированные нашим extentions) это таки так, не охота делать асинхронный getTab ради этого, да и проблема при ошибке не большая
                    corespondingTabNodeInTargetWindow_chromeTabObj.windowId = attachInfo.newWindowId;
                    corespondingTabNodeInTargetWindow_chromeTabObj.index    = attachInfo.newPosition; // Index хранить бесполезно, он может поменять уже на следующе move операции другого таба (при multiselect move) причём мы об этом не узнаем

                    corespondingTabNodeInTargetWindow.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabActive( corespondingTabNodeInTargetWindow_chromeTabObj ) );
                }

                windowNode.fromChrome_onAlifeTabAppearInHierarchy();
            }
            else
            { // Это был инициированный хромом (юзером) tabs move методом детач-аттач
                if(debugLogChromeOperations) console.log("This Crome Initiated Dettach-Attach between different windows");

                this.chromeInitiated_moveTabNode(tabId, {'toIndex':attachInfo.newPosition, 'windowId':attachInfo.newWindowId}, relateNewTabToOpener );
            }

        //}); // getOption('relateNewTabToOpener').then( (relateNewTabToOpener) => {  
    },

    fromChrome_onTabRemoved : function(tabId, isWindowClosingInfo/*{isWindowClosing: true/false, windowId: 964} - CAN BE UNDEFINED! also the windowId is absent on Ubunta, always*/) {
        // Fix for ubunta, Chrome 22
        if(isWindowClosingInfo && !isWindowClosingInfo['windowId'])
            isWindowClosingInfo['windowId'] = this.treeModel.findActiveWindowIdForTabId(tabId);

        //RRv3 this.onRemovedTracker.register_onTabRemoved(tabId, isWindowClosingInfo);

        this.treeModel.onActiveTabRemoved(tabId, isWindowClosingInfo);
    },

    fromChrome_onWindowRemoved : function(windowId) {
        //RRv3 this.onRemovedTracker.register_onWindowRemoved(windowId);

        this.treeModel.onActiveWindowRemoved(windowId);
    },

    fromChrome_onTabDetached : function(tabId, detachInfo) {
// Выкидываем, мы никак не используем DETACH_WAITING_LIST - но вообще так мона вычислять move между окнами инициируемые TO
//        var detachedTabIndexInDetachList = DETACH_WAITING_LIST.indexOf(tabId);
//        if( detachedTabIndexInDetachList >= 0)
//            DETACH_WAITING_LIST.splice(detachedTabIndexInDetachList, 1);
//     /* else
//            do nothing. это chrome initiated move, во время onAttach его мовнем, или уже мовнули */
    },

    fromChrome_onTabMoved : function(tabId, moveInfo/*{fromIndex:, toIndex:, windowId:}*/) {
        let relateNewTabToOpener = true;
        //getOption('relateNewTabToOpener').then( (relateNewTabToOpener) => {
            this.chromeInitiated_moveTabNode(tabId, moveInfo, relateNewTabToOpener);
        //});
    },

    fromChrome_onTabActivated : function(activeInfo) {
        this.treeModel.setActiveTabInWindow(activeInfo['tabId'], activeInfo['windowId']);
    },

    fromChrome_onTabUpdated : function(tabId, changeInfornamtion, chromeTabObj) {
        // Example of log during new chromeTabObj creation by midl click
        // Tab 230 http://mamonino.livejournal.com/51107.html is created
        // Tab 230 is updating with url : http://mamonino.livejournal.com/51107.html and status is loading
        // Tab 230 is updating with url : undefined and status is complete

        lastSeenTabs[chromeTabObj.id] = chromeTabObj;

        var tabModel = this.treeModel.findActiveTab(tabId);
        if(tabModel)
        {
            // TODO тут вместо вот такой простой строчки - tabModel.updateNode( createTabModelUpdateData(chromeTabObj) ); - приходится вызывать жопу нижу, которая ещё и асинхронные запросы делает
            // это сделано только для выдёргивания favicons
            // причём оно не всегда срабатывает всёравно и может быть полностью выкинуто если будет другой механизм подгрузки недогруженных favicons
            // причём можно юзать chrome://favicon/url механизм как адрес самого favicon когда оно уже догружено (оно тока не выдаёт иконки extentions)
            this.requestTabNodeUpdate_getFaviconHack(tabModel, changeInfornamtion.status); // Assinchronous call!!!!
        }
        else
        {
            if(isRemovedTabIdUnexpected(tabId))
                console.error("ERROR NOT ! OTUPD #qwve#  ", tabId, chromeTabObj); // Chrome v26 introduce zombi tabs problem
            else // Not unexpected, but need to put it back to expexted unexpected list (isXxxx() check was removed it) to prepare it for onRemove event
                supressUnexpectedRemovedTabIdErrorFor(tabId);
        }
    },

    fromChrome_onWindowFocusChanged : function(windowId) {
        // console.log("#### fromChrome_onWindowFocusChanged", windowId )
        // Этот комент, или то шо мы тут переформатировали код, мистически убрал багу с автоскролом на свои собственные окна
        if( windowId !== -1) {
            setTimeout(this.postponed_updateFocusedWindowState, 100, this, windowId);
            // setTimeout needs for chrome.extension.getViews({'windowId':windowId}); to correctly return our Views from newly created window
            // эта ситуация возникает когда мы клонируем окно, на момент fromChrome_onWindowFocusChanged в клонированном окне ещё не успевает
            // появится таб с нашим View. Время 100 выбрано без тестов с потолка, может и 1 сработало бы.
            // доп аргументы в setTimeout поддерживаются тока начиная с IE10
            //
            // кстате в main rev154 есть альтернативный фикс, и возможно более прикольный
        }
    },

    postponed_updateFocusedWindowState : function(_this, windowId) {
        /// Dont use this. here!!! use _this.!!!

        getTabs(windowId)
            .then((tabsList) => {
                if(!tabsListContainOurViews(tabsList)) {
                    // Мы не хотим не только скролинга, но и вообще терять выделение активного окна при переключении на табаутлайнер
                    getOption('doNotAutoscroll').then( (doNotAutoscroll) => {
                        var scrollToView = (doNotAutoscroll || winIdForWhichNeedSkipScrollToView == windowId)? false : true;
                        _this.treeModel.setFocusedWindow(windowId, scrollToView);                         
                    });
                }   
            })
            .catch((error) => {
                console.error('Error fetching tabs:', error);
            })
            .finally(() => winIdForWhichNeedSkipScrollToView = -1);
    },

    requestTabNodeUpdate_getFaviconHack : function(tabModel, changeInfornamtion_status) {
        // Note that before we come to declared in this method callback many things can happen,
        // for example tab can become detached during move operation (or even deleted) and will not be accesible by chrome.tabs.get(),

        if(!tabModel.parent) return; // A hack (as all this method) its purpose is to prevent some console.error() output - because there we can come (because of setTimeout(2000)) after tab is already closed by user

        var _this = this;
        var DO_ONE_MORE_TRY_IF_NOFAVICON_AGAIN = "do one more try";
        var DO_ONE_MORE_TRY_IF_NOFAVICON_AGAIN_FINAL = "do one more try, final one";
        var STOP_TRYING_TO_OBTAIN_FAVICON = "stop trying";

        // We do additional chrome.tabs.get() call (even in case we already have ready tab objects in event) because
        // of problems with favicon, it often not provided in chromeTabObj object from event, need issue additional get call
        chrome.tabs.get(tabModel.chromeTabObj.id, function(chromeTabObj) {
            if(chromeTabObj) // When tabs is detached from widow  chrome.tabs.get() call this callback with undefined parameter
            {
                tabModel.updateChromeTabObj( chromeTabObj ); // Вообщето это единственная строчка которая тут была бы нужна еслиб не проблема с фавикон
                                                             // TODO причём этот хак не всегда срабатывает, проблему надо решать другим, более умным механизмом,
                                                             // как минимум выделить от сюда этот бред относящийся только к Favicon, введя tabModel.updateNodeIcon

                // Данный код когдато занимался запросами фавиконки даже через 30 секунд если её небыло, но счас всё что дольше 2х секунд - период работы таб чекера уже просто не нужно
                // Можно и вообще выкинуть этот код что ниже, но пусть будет, возможно он позволяет получить иконку быстрее иногда, чем через табчекер

                // Workaround for Chrome problem - in this event, when chromeTabObj update status is complete, favicon url SOMETIMES is not ready, and cannot be read from tabs data!
                // it will even be not accesible even if we put there 100ms enstead of 500ms
                // So we request additional update in hope it will be ready later
                // And if not then will do it one more time, and again, and again - 3 trys total, in 500ms, 2sec & 30sec
                if(chromeTabObj.favIconUrl === undefined && chromeTabObj.url !== 'chrome://newtab/')
                {
                    if(changeInfornamtion_status === "complete") // Will issue series of this hacks only if Tab is completely loaded, and no more updates expected anymore (which might set correct favIcon)
                        setTimeout(  function(){_this.requestTabNodeUpdate_getFaviconHack(tabModel, DO_ONE_MORE_TRY_IF_NOFAVICON_AGAIN) }, 600 );

                    if(changeInfornamtion_status === DO_ONE_MORE_TRY_IF_NOFAVICON_AGAIN) // Continue to be undefined! Will do ONE more try
                        setTimeout(  function(){_this.requestTabNodeUpdate_getFaviconHack(tabModel, STOP_TRYING_TO_OBTAIN_FAVICON) }, 1100 );

                    // Дальше этим займётся уже таб чекер

                    // if(changeInfornamtion_status === DO_ONE_MORE_TRY_IF_NOFAVICON_AGAIN_FINAL) // Continue to be undefined! Will do ONE more try, and only ONE!
                    //    setTimeout(  function(){_this.requestTabNodeUpdate_getFaviconHack(tabModel, STOP_TRYING_TO_OBTAIN_FAVICON) }, 30000/*30 sec*/ );

                    // if(changeInfornamtion_status === STOP_TRYING_TO_OBTAIN_FAVICON) // Continue to be undefined!
                    //    console.log("Get favIcon workaround is unsuccessful. url:", chromeTabObj.url ); // Now its up to the user to update favicon manualy, using reload for example
                }
            }
            else
            {
                console.log("CERROR ! NOCT RTNUGFH"); // Call to chrome.tabs.get with unexisted id // Must never occur!
                // Но это может произойти,
                // К примеры мы открыли таб, у него во время update status === "complete" не пришол фавикон (это бывает)
                // тогда мы заказываем обновление фав иконки ЧЕРЕЗ 600 милисекунд - если таб будет закрыт за это время мы тут выкинем error
                // Аналогично может случаться при onReplaced
                // TODO (А) и это хак и плохо!!! Эти ошибки реально возникают. Мы не должны такое держать гдето в setTimeout() мы должны сканировать
                // список нод с непоставленными фавиконами и пытаться добыть у хрома для них фавикон что через минуту что через час
                // тем более мы там подвешиваем референс на tabModel!!!!!!!!!!!
                // кстате быстрым решением чтоб этот еррор не возникал было бы глянуть или tabModel жива таки
                // tabModel.isClosed или !tabModel.parent - несколько решает эту проблему

                // TODO ошибка начала часто возникать и с не закрытыми табами. после введения onReplaced вроде. Дополнительный еффект такой что спинер не пропадает!
            }

        });
    },

    chromeInitiated_moveTabNode : function(tabId, moveInfo/*{fromIndex:, toIndex:, windowId:}*/, relateNewTabToOpener) {
        var nodeModelForMovedTab = this.treeModel.findActiveTab(tabId);
        var nodeModelForAffectedWindow = this.treeModel.findActiveWindow(moveInfo.windowId);

        if(!nodeModelForMovedTab) {
            console.error("ERROR############# onMove # Cannot find tab in tree with tabid: "+ tabId);
            // TODO FULLRESCAN, и попробовать снова
            return;
        }
        if(!nodeModelForAffectedWindow) {
            console.error("ERROR############# onMove # Cannot find window in tree with windowId: "+ moveInfo.windowId);
            // TODO FULLRESCAN, и попробовать снова
            return
        }

        // Проверить или вставка не в тоже самое место должна произойти
        // Это может произойти в случае детач и реатач в тоже самое место где табы были
        // ! Также это бывает каждый раз после chrome.move, запрошенных нашим плагином, по результатам дропа
        if(nodeModelForMovedTab === nodeModelForAffectedWindow.findAlifeTabInOwnTabsByIndex(moveInfo.toIndex)) {
            if(debugLogChromeOperations) console.log("chromeInitiated_moveTabNodeInSameWindow called with toIndex which is same as node already have in tree - IGNORE");
            return;
        }

        var deletedActiveTabNode_chromeTabObj = nodeModelForMovedTab.chromeTabObj;

        // Делаем Delete, по правилах Delete из хрома
        // иконки и нотатки приведут к тому что копия в виде засейванного таба останется на месте
        // если человеку надо пусть помержает ручками, или мовает в самом TO
        this.treeModel.onActiveTabRemoved(deletedActiveTabNode_chromeTabObj.id, false, false);

        deletedActiveTabNode_chromeTabObj.windowId = moveInfo.windowId; // Таки это может быть move между разными окнами, мы юзаем этот метод в onAttach
        deletedActiveTabNode_chromeTabObj.index    = moveInfo.toIndex;

        // Вставляем пустую ноду, по правилах вставки из хрома, иконки и иерархия будут "утеряны", а на самом деле если были то останутся на saved узле
        // если человеку надо пусть помержает ручками, или мовает в самом TO
        var newActiveTabNode = nodeModelForAffectedWindow.fromChrome_onTabCreated(deletedActiveTabNode_chromeTabObj, !!relateNewTabToOpener); // Вставляем в новом месте, по правилам появления новых нод

        this.requestTabNodeUpdate_getFaviconHack(newActiveTabNode, "complete"); // To update selected state
    },

    END: null
};

const TABS_OUTLINER_DEFAULT_WIDTH = 400;

function cloneTabsOutlinerView( tabsOutlinerInitiatorWindow_outerWidth, tabsOutlinerInitiatorWindow_screenX, sourceViewPageYOffset ) {
    getDisplayWorkAreaBounds( ( primaryDisplayWorkArea) => {
        var createData =  {
            url: chrome.runtime.getURL('activesessionview.html') + "?type=clone&yo="+sourceViewPageYOffset,
            type: 'normal',
            left: tabsOutlinerInitiatorWindow_outerWidth + tabsOutlinerInitiatorWindow_screenX + 1,
            width:TABS_OUTLINER_DEFAULT_WIDTH,
            top:primaryDisplayWorkArea.top + 1,
            height:primaryDisplayWorkArea.height -1/*отступ с верху*/ -1/*симетричный отступ с низу*/,
            focused:true
        };
    
        if(createData.left + createData.width > primaryDisplayWorkArea.width) delete createData.left; //will use default chrome behaviour to decide position
    
        chrome.windows.create(createData, null);
    //    chrome.windows.create(createData, function(chromeWindowObj){
    //        var tabsOutlinerDomWindows = chrome.extension.getViews({'windowId':chromeWindowObj.id});
    //        tabsOutlinerDomWindows.forEach( function (ourWindow) {
    //            if(ourWindow && ourWindow.scrollToDefaultPageOffestForClonedViewsOnInitialOpen)
    //                ourWindow.scrollToDefaultPageOffestForClonedViewsOnInitialOpen(sourceViewPageYOffset);
    //        })
    //    });            

    });
}

function createNewActiveSessionViewWin( focusNodeId, altFocusNodeId, scrollToViewWinId, newWindowCreatedCallback, donecallback ) {
    getDisplayWorkAreaBounds( ( primaryDisplayWorkArea) => {
        var createData =  {
            'url': chrome.runtime.getURL('activesessionview.html') + "?type=main&focusNodeId="+focusNodeId+"&altFocusNodeId="+altFocusNodeId+"&scrollToViewWinId="+scrollToViewWinId ,
            'type': 'popup', // popup advantages -
                            // 1!) currentWindow() его скипает и новое окно которое инстанцирует юзер из таск бара к примеру, или даже я сам, кодом
                            // появляется в томже месте и тогоже размера как предыдущее нормальное окно которое было в фокусе
                            // 2) больше места, нет ненужных букмарков, ненужно строки, ненужной вкладки которую никогда не юзаеш
                            // 3) выглядит более "системно" - как часть интерфейса
                            // 4) ищи ещё по коду 'popup' - есть фильтрация крешнутых окон без коментов по этому флагу
                            // The 'panel' and 'detached_panel' types create a popup unless the '--enable-panels' flag is set.
            'left':primaryDisplayWorkArea.left + 1, // Zero is not work for unknown reasons
            'top':primaryDisplayWorkArea.top + 1, // Zero is not work for unknown reasons
            'width':TABS_OUTLINER_DEFAULT_WIDTH,
            'height':primaryDisplayWorkArea.height -1/*отступ с верху*/ -1/*симетричный отступ с низу*/,
            'focused':true
        };
    //    var isLinux = (navigator.appVersion.indexOf("Linux") != -1);
    //
    //    if( isLinux/* && (CHROME_MAJOR_VERSION < 23)*/ ) {
    //        // Linux bug fix
    //        // Всё ещё нужен бо если тупо влупить availHeight то окно будет больше на величину заголовка попап окна и выступать таки за край
    //        createData['height'] -= 100; // Размер заголовка кстате легко определить как outerHeight - innerHeight, но хай вже буде
    //    }

        // Apply last know position if needed
        if(false/*FASTFORWARDv3 localStorage['openTabsOutlinerInLastClosedPos']*/)
            if(localStorage['MainViewLastClosedPos']) {
                try{
                    //= JSON.stringify({'x':screenX,'y':screenY,'w':outerWidth,'h':outerHeight});
                    var oldpos = JSON.parse(localStorage['MainViewLastClosedPos']);
                    createData.left = oldpos['x'];
                    createData.top = oldpos['y'];
                    createData.width = oldpos['w'];
                    createData.height = oldpos['h'];
    //
    //                if(isLinux) { // Убунта, и наверно таки мак, к этим значения ещё заголовок и бортики добавляет, окно раздвигатеся таким образом постоянно.
    //                    if( oldpos['iw']) createData.width = oldpos['iw'];
    //                    if( oldpos['ih']) createData.height = oldpos['ih'];
    //                }
                } catch(e) {}
            }

        chrome.windows.create(createData, function(chromeWindowObj){
            // Workaround for Chrome bug in v25 & Linux that chrome.windows.create treat width & height as innerWith & innerHeight
            // If we will always do this update it will неприятно фликать на тех броузерах где жтой проблемы нет, хотя помойму оно и так фликает
            if(createData['height'] !== chromeWindowObj.height) {
                var updateData =  {
                        // 'left':createData['left'], // Will not restore them as this on linux will move us behind the left Ubunta desktop sidebar!!!
                        // 'top':createData['top'],
                        'width':createData['width'],
                        'height':createData['height']
                    };
                chrome.windows.update(chromeWindowObj.id, updateData, null);
            }
            newWindowCreatedCallback(chromeWindowObj);
            donecallback(chromeWindowObj.id);
        });
    });
}

function preventScrollToViewInNextOnFocusChangeForWinId(winId) {
    winIdForWhichNeedSkipScrollToView = winId;
}

function focusWindow(winId, dontScrollToView) {
    if(!winId) return;
    if(dontScrollToView) preventScrollToViewInNextOnFocusChangeForWinId(winId);

    chrome.windows.update(winId, {'focused':true});
}

function focusTab(winId, tabId, donecallback, dontScrollToView) {
    if(dontScrollToView) preventScrollToViewInNextOnFocusChangeForWinId(winId);

//    chrome.windows.update(winId, {'focused':true}, function(chromeWindowObj) {
//        chrome.tabs.update(tabId, {'selected': true}, function(chromeTabObj) {
//            if(donecallback) donecallback(chromeTabObj.windowId); });
//    });
//
    chrome.tabs.update(tabId, {'selected': true}, function(chromeTabObj) {
        focusWindow(chromeTabObj.windowId, dontScrollToView);
        if(donecallback) donecallback(chromeTabObj.windowId);
    });
}

function focusTabIfAliveCreateIfAbsent(winId, tabId, focusNodeId, altFocusNodeId, scrollToViewWinId, createMethod, focusMethod, newWindowCreatedCallback, donecallback){
    chrome.windows.getAll({'populate':true}, function(windowsList) {
        var ourWindow = windowsList.filter( function(chromeWindowObj){ return chromeWindowObj.id === winId } );
        if( ourWindow.length >= 1 ) // Window is Alive and Present
        {
            var ourChromeWindowObj = ourWindow[0];
            if( ourChromeWindowObj.tabs.some(function(chromeTabObj){ return chromeTabObj.id === tabId }) ) // Our Tab is Alive
                focusMethod(winId, tabId, donecallback);
            else
                createMethod(focusNodeId, altFocusNodeId, scrollToViewWinId, newWindowCreatedCallback, donecallback);
        }
        else
        {
            createMethod(focusNodeId, altFocusNodeId, scrollToViewWinId, newWindowCreatedCallback, donecallback);
        }
    });
}

function updateBrowserActionTitle() {
    calculateNumberOfTabsAndWindow(setStatsInBrowserActionTitle);
}

function setStatsInBrowserActionTitle(tabsCount, windowsCount) {
    chrome.action.setBadgeText({'text': ""+tabsCount});
    chrome.action.setTitle({'title': ""+windowsCount+" windows / "+tabsCount+" tabs"});
}

function calculateNumberOfTabsAndWindow(callback) {
    chrome.windows.getAll({'populate':true}, function(windowsList) {
        var windowsCount = windowsList.length;
        var tabsCount    = 0;
        windowsList.forEach( function(w){ tabsCount += w.tabs.length} );

        callback(tabsCount, windowsCount);
    });
}

function isThisWindowContainOurExtentionViews(windowId) {
    return false; //FASTFORWARDv3
    var views = chrome.extension.getViews({'windowId':windowId});
    return (views && views.length > 0);
}

function supressUnexpectedRemovedTabIdErrorFor(id) {
    notUnexpectedRemovedTabsIds.push(id);
}
function supressUnexpectedRemovedWindowIdErrorFor(id) {
    notUnexpectedRemovedWindowsIds.push(id);
}
function isIdUnexpected(notUnexpectedIds, id) {
    var i = notUnexpectedIds.indexOf(id);
    if(i >= 0)
        return false;
    else
        return true;
}
function isRemovedTabIdUnexpected(id) {
    return isIdUnexpected(notUnexpectedRemovedTabsIds, id);
}
function isRemovedWindowIdUnexpected(id) {
    return isIdUnexpected(notUnexpectedRemovedWindowsIds, id);
}

function openTabsOutlinerMainView() {
    getLastFocusedTabIdAndWindowId(createOrFocusTabsOutlinerTab);
}

function getLastFocusedTabIdAndWindowId(callback) {
    chrome.windows.getLastFocused({'populate':true}, function(chromeWindowObj) {
        var selectedTabId    = getSelectedTabIdInWindowObj(chromeWindowObj);
        var selectedWindowId = chromeWindowObj && chromeWindowObj.id;
        callback( selectedTabId, selectedWindowId );
    });
}

function getSelectedTabIdInWindowObj(chromeWindowObj) {
    if(!chromeWindowObj)         return undefined;
    if(!chromeWindowObj['tabs']) return undefined;

    var selectedTabId = chromeWindowObj['tabs'][0] && chromeWindowObj['tabs'][0].id;
    for(var i = 0; i < chromeWindowObj['tabs'].length; i++)
        if(chromeWindowObj['tabs'][i]['selected']) selectedTabId = chromeWindowObj['tabs'][i].id;

    return selectedTabId;
}

function browserAction_onClicked(clickedChromeTabObj) {
    createOrFocusTabsOutlinerTab(clickedChromeTabObj.id,  clickedChromeTabObj.windowId);
}

function createOrFocusTabsOutlinerTab(clickedChromeTabObj_id,  clickedChromeTabObj_windowId, continueCallback) {
    // TODO checkForOutOfScreen Conditions For Tabs Outliner window - if so - resize & move window to default (or at least better) position/size

    var focusOpenTabNodeId = clickedChromeTabObj_id;
    var altFocusNodeId = clickedChromeTabObj_windowId;
    var scrollToViewWinId = /*scroll View to this node*/clickedChromeTabObj_windowId; // А вот это Id уже по нормальному в activeSession.treeModel.findActiveWindow() ищет и посылает nodeModel.requestScrollNodeToViewInAutoscrolledViews() которое затем возвращается в View

    focusTabIfAliveCreateIfAbsent(
        mainActiveSessionViewWinId, // Вобщето мы можем без этого обойтись, юзая chrome.extension.getViews - но тогда нужна будет кнопка чтоб дублицировать TabsOutliner view, счас это возможно мувом
        mainActiveSessionViewTabId,
        focusOpenTabNodeId, altFocusNodeId, scrollToViewWinId,
        createNewActiveSessionViewWin,
        focusTab,
        function newWindowCreatedCallback(chromeWindowObj) {
            mainActiveSessionViewWinId = chromeWindowObj.id;
            // manifest v2
            //  chrome.tabs.getAllInWindow(chromeWindowObj.id, function(tabsList) {
            //     mainActiveSessionViewTabId = tabsList[0].id;
            // });
            chrome.tabs.query({ windowId: chromeWindowObj.id }, function(tabsList) {
                mainActiveSessionViewTabId = tabsList[0].id;
            });

            // подвигаем в видимую область узел окна с которого скликнули
            // так как пока создавалось окно Таб Аутлайнера пришол лишний focus changed и селектнул его
            activeSession.treeModel.setFocusedWindow(clickedChromeTabObj_windowId, /*scrollToView*/true);
            // Одна вот только проблема - в момент этого вызова окно ещё не успело создаться полностью - до завершения onload - и этот setFocused скоерее всего не привёл к скролу
            // По этой причине мы ещё раз попросим этот скрол в doneCallback(), всёравно мы там просим селектинг таба с которого кликнули
        },
        function doneCallback(tabsOutlinerViewWindowId) {
            // Устанавливаем курсор на таб с которого открыли tree view

            // Manifestv2 version
            // var tabsOutlinerDomWindows = chrome.extension.getViews({'windowId':mainActiveSessionViewWinId});
            // tabsOutlinerDomWindows.forEach( function (ourWindow) {
            //     if(ourWindow && ourWindow[VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick] ) {
            //         // ourWindow.isAutoscrollView = true; // Must be set before selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick() !
            //
            //         // этот метод в случае если Dom дерево ещё не успело создаться (а это часто бывает) откладывает операции селектинга до конца activesessionview.html:window.onload
            //         // NOTE:Это вроде уже не так! ничего никто не откладывает вроде уже
            //         //      Однако это не важно. Этот кейс вроде как вызвается только для уже созданного окна.
            //         //      чтоб курсор и скрол переставить
            //         //      свежесозданное окно берёт эти парметры из url строки и само себе вызывает этот метод когда дерево построит
            //         ourWindow[VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick]( focusOpenTabNodeId, altFocusNodeId, scrollToViewWinId);
            //         // 3 параметр (/*scroll View to this node*/) Нужен по двум причинам:
            //         // 1) если окна небыло то activeSession.treeModel.setFocusedWindow() и последующее requestScrollNodeToViewInAutoscrolledViews() которые тут (методом выше) произошли не скрольнули View так как обычно оно не успело создаться полностью, до выполнения нашего кода
            //         // 2) если окно таки уже было создано то нужно для повторных нажатий browserAction кнопки в томже окне что и было уже зафокусено, фокус состояние в этом случае не изменяется
            //         // даже если предварительно мы свитчались на таб аутлайнер и назад (так как мы отфильтровываем таб аутлайнер окно)
            //         // и без этой строчки скролинга не произойдёт если позиция была изменена
            //     }
            //     else {
            //         // Sometimes selectTreeNodePlusScrollToNodeOnInitialOpen is not present (or ready), for unknown reason
            //         // В прошлом это приводило к тому что: and as result we not scroll & not set ourWindow.isAutoscrollView = true;
            //         // счас логика переделана и параметры скролинга передаются в урле при открытии окна
            //         // так что это значения не имеет
            //     }
            // } );

            // это переписан код выше, 
            // бо вызов  ourWindow[VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick] прям сразу приводит к request2bkg_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick
            // но не тестировал и хуй пойми или таки все порты стоит оббегать или всеже только главное окно TabsOutlenera
            viewsCommunicationInterface.viewPorts.forEach( (port) => { try {request2bkg_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick({scrollToVieWinId: scrollToViewWinId, focusTabId: focusOpenTabNodeId}, port)} catch (e) {console.error(e)} } );

            if(continueCallback) continueCallback(clickedChromeTabObj_id,  clickedChromeTabObj_windowId, tabsOutlinerViewWindowId);
        }
    );
}



//chrome.contextMenus.create({
//    "type":"separator",
//    "title": "Sep",
//    "contexts": ["all"],
//    "onclick" : clickHandler
//});

//chrome.contextMenus.create({
//"title": "Buzz This",
//"contexts": ["page", "selection", "image", "link"],
//"onclick" : clickHandler,
//"documentUrlPatterns" : [chrome.runtime.getURL('activesessionview.html')]
//});
//
//
//var buzItemId = chrome.contextMenus.create({
//"title": "Buzz That",
//"contexts": ["all"],
//"onclick" : clickHandler
//});
//
//chrome.contextMenus.create({
//"title": "Buzz That Child",
//    "parentId":buzItemId,
//"contexts": ["all"],
//"onclick" : clickHandler
//});
//
//
//chrome.contextMenus.create({
//    "type":"checkbox",
//    "title": "Buzz Checkbox",
//    "contexts": ["all"],
//    "onclick" : clickHandler
//});
//
//chrome.contextMenus.create({
//    "type":"radio",
//    "title": "Buzz Radio 2",
//    "contexts": ["all"],
//    "onclick" : clickHandler
//});
//
//chrome.contextMenus.create({
//    "type":"radio",
//    "title": "Buzz Radio 1",
//    "contexts": ["all"],
//    "onclick" : clickHandler
//});
//
//
//chrome.contextMenus.create({
//    "type":"separator",
//    "title": "Sep",
//    "contexts": ["all"],
//    "onclick" : clickHandler
//});

function clickHandler(e, tab) {
    console.log( e.pageUrl, e.selectionText, e.mediaType, e.linkUrl, e.srcUrl, e, tab );
}

function BackgroundInterpagesComunicationStorageForDragedItems() {
    this.tabsOutlinerDraggedModel = null;
}

BackgroundInterpagesComunicationStorageForDragedItems.prototype.setDragedModel = function (model) {
        this.tabsOutlinerDraggedModel = model;
};
BackgroundInterpagesComunicationStorageForDragedItems.prototype.clearDragedModel = function () {
        this.tabsOutlinerDraggedModel = null;
};
BackgroundInterpagesComunicationStorageForDragedItems.prototype.getDragedModel = function () {
        return this.tabsOutlinerDraggedModel;
};

// ---------------------------------------------------------------------------------------------------------------------
function closeAllWindowsExceptThis(excludedChromeWindowObjId) {
    activeSession.treeModel.getListOfAllActiveWindowNodes().forEach( function(openWindowNode){
        if( openWindowNode.chromeWindowObj.id != excludedChromeWindowObjId )
            openWindowNode.performChromeRemove(/*protectFromDeleteOnChromeRemovedEvent*/true, /*storeCloseTime*/true);
    });
}

// ---------------------------------------------------------------------------------------------------------------------
function getActiveSessionTreeModel() {
    return activeSession.treeModel;
}


function fsErrorHandler(err){
    console.error('ERROR on file system access. FileError.code:', err['code']);
}


function saveSessionDataAsFile_fsErrorHandler(err){
    console.error('ERROR on file system access. FileError.code:', err['code']);
    window['treeWriteFail'] = true;
}

function saveSessionDataAsFile(filename, sessionData, onwriteend) {
    if(debugLogChromeOperations) if(console) console.log('saveSessionDataAsFile START', filename, new Date().toTimeString());

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


function storeUserSelectedFile(file) {
    userSelectedFileToOpen = file;
}

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

// callback(fileEntry)
function saveCurrentSessionAsFileNow(callback) {
    console.time("= Save Tree Total ====");

    console.time("Serialize Tree Full");

    console.time("Serialize Tree");
    var exportData = serializeActiveSessionToOperations();//serializeActiveSessionToJSO();
    console.timeEnd("Serialize Tree");

    console.time("Stringify Tree");
    var exportDataString = JSON.stringify(exportData);
    console.timeEnd("Stringify Tree");

    console.time("Blobify Tree");
    var exportDataBlob = new Blob([exportDataString], { "type" : "application\/octet-stream" });
    console.timeEnd("Blobify Tree");
    console.log("data.size:",exportDataBlob.size);

    console.timeEnd("Serialize Tree Full");

    webkitRequestFileSystem(TEMPORARY/*PERSISTENT*/, exportDataBlob.size+100, fsReady, fsErrorHandler);

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

function processCommand(command) {
    calculateNumberOfTabsAndWindow(function(tabsCount, windowsCount) {
        getLastFocusedTabIdAndWindowId( function(tabId, windowId) {
            if(command == "save_close_current_tab") {
                if(tabsCount <= 1) createOrFocusTabsOutlinerTab(tabId, windowId, saveTab);
                else               saveTab(tabId);
            }

            if(command == "save_close_current_window") {
                if(windowsCount <= 1) createOrFocusTabsOutlinerTab(tabId, windowId, saveWindow);
                else                  saveWindow(tabId, windowId);
            }

            if(command == "save_close_all_windows") {
                createOrFocusTabsOutlinerTab(tabId, windowId, saveAllWindows);
            }
        });
    });

}

function saveTab(tabId) {
    var tabModel = activeSession.treeModel.findActiveTab(tabId);
    if(tabModel)
        tabModel.performChromeRemove(true);
    else
        console.error("ERROR NOT ! STM #qdfhwve#  ", tabId);

}

function saveWindow(tabId, windowId) {
    var windowModel = activeSession.treeModel.findActiveWindow(windowId);
    if(windowModel)
        windowModel.performChromeRemove(/*protectFromDeleteOnChromeRemovedEvent*/true, /*storeCloseTime*/true);
    else
        console.error("ERROR NOT ! STM #qdfhwve#  ", tabId);
}

function saveAllWindows(tabId, windowId, tabsOutlinerViewWinId) {
    closeAllWindowsExceptThis(tabsOutlinerViewWinId);
}

// License Key Checks ---------------------------------------------------------------------------------------------------------------------

// continue_callback(null) - no permission granted, continue_callback(userInfo{email:'email@zzz.xxx', id:'2342342'}) if(!userInfo.email) then permission exist but no email (Chrome not logged in)
function getIdentityEmailWithoutInteractiveRequestingEmailPermissions( continue_callback ) {
    chrome.identity.getProfileUserInfo( function(userInfo) {
            continue_callback(userInfo);
    });
}

function isEmailPemissionPresent(callback) {
    chrome.permissions.contains({
        permissions: ['identity.email'],
        origins: []
    }, callback);
}

// Returns false if it's not a corectly formated key object
function setLicenseKey(newLicenseKey_base64) {
    var keyObj = unpackLicenseKey(newLicenseKey_base64);

    if(!keyObj || !keyObj['serial'] || !keyObj['timestamp'] || !keyObj['product'] || !keyObj['signature']) return false;

    _addLicenseKeyToLocalStorage(keyObj);
    _addLicenseKeyToSyncStorage(keyObj);

    return true;
}
function unpackLicenseKey(licenseKeyUrlString) {
    var keyString =  atob(decodeURIComponent(licenseKeyUrlString));
    try {
        var keyObj = JSON.parse(keyString);
    } catch(e) {
        return false;
    }

    return keyObj;
}

function packLicenseKey(keyObj) {
    return encodeURIComponent(btoa( JSON.stringify(keyObj) ));
}

async function _addLicenseKeyToLocalStorage(keyObj, isFromSyncStorage) {
    // We support multiple license keys just to not implement any additional dialogs that propose to drop previous key
    // in case user folow the options.html?setLey link with the other key
    // which is incorect, or is already present, or anything - will just add it, without removing previous keys,
    // and then check the one with the current serial for validity

    var keysArray  = (await chrome.storage.local.get('licenseKeys')).licenseKeys || [];
    let keysArray_ = keysArray.filter(function(obj) { return obj.serial != keyObj.serial}); // Remove previous copy of the same key if they exist, to not create dublicates
    keysArray_.push(keyObj);

    chrome.storage.local.set({ 'licenseKeys': keysArray_ });

    if(keysArray_.length > keysArray.length) {
        //FF_REMOVED_GA ga_event( "New License Key Added" + (isFromSyncStorage?" - From Sync":" - From Link") );
        return true;
    } else {
        return false;
    }
}


async function getLicenseKeys() {
    let localKeys = (await chrome.storage.local.get('licenseKeys')).licenseKeys;
    let syncKeys = (await chrome.storage.sync.get('licenseKeys')).licenseKeys;
    return (syncKeys || []).concat(localKeys || []);
}


async function console_log_licenseKeysLinks(console) {
    var keys = (await chrome.storage.local.get('licenseKeys')).licenseKeys || [];
    keys.forEach(function(key){
        console.log(key);
        console.log("Key Apply URL:");
        console.log(chrome.runtime.getURL('options.html')+'?setkey='+packLicenseKey(key));
    });
}


// Тут и дальше я использую catch для сообщения о невалидном лицензионном ключе, это не очень здорово так как туда и просто exceptions могут упасть.
// надо использовать тока then() и передавать флаг валидности через параметр
function checkLicenseKeySignature_promise(licenseKeyObj) {
    var message   = licenseKeyObj.timestamp+licenseKeyObj.serial+licenseKeyObj.product;
    var signature = licenseKeyObj.signature;

    return new Promise( function(resolve, reject) {
                            SignatureValidator.isMessageSignatureValid_promise(message, signature)
                            .then(function(isValid){ 
                                if(isValid)
                                    resolve(licenseKeyObj);
                                else
                                    reject(licenseKeyObj);
                            });
                      });
}

async function isLicenseKeySignatureValid(licenseKeyObj) {
    var message   = licenseKeyObj.timestamp+licenseKeyObj.serial+licenseKeyObj.product;
    var signature = licenseKeyObj.signature;

    return  SignatureValidator.isMessageSignatureValid_promise(message, signature);
}

async function getAnyValidLicenseKey(licenseKeysArray, userEmail) {
    let serialNumber = await calculateSerialNumber_promise(userEmail);

    var thisSerialLicenseKeys = ( licenseKeysArray.filter(function(key) { return key.serial == serialNumber}) ); 
    for(let i = 0; i < thisSerialLicenseKeys.length;i++) {
        if(thisSerialLicenseKeys[i].serial == serialNumber && await isLicenseKeySignatureValid(thisSerialLicenseKeys[i])) 
            return thisSerialLicenseKeys[i];
    }   

    // no key with correct serial found, take any key
    return null;
}

async function checkAndUpdateLicenseStatusInAllViews( onSignInChanged_accountInfo, onSignInChanged_isSignedIn ) {
    var licenseKeys = ['eyJ0aW1lc3RhbXAiOiJNb24sIDI2IEF1ZyAyMDI0IDA2OjQxOjI2IEdNVCIsInNlcmlhbCI6IjA4MjI0NGUxZmIzMGNkNTY5YjYwNTcyMjZlZWNiNzY0MGFiN2Y2YzIiLCJwcm9kdWN0IjoiVGFicyBPdXRsaW5lciBQYWlkIE1vZGUgTGljZW5zZSBLZXkiLCJzaWduYXR1cmUiOiJsOVdJaGx3bS9YSGV5VmdvaW5teG9hbXdUT2l4N1RIdlk3SjlTY2pwQnE4L24rdlNacDFLRG8wUnUzQmYvcWZoV0xsVUkvRllBMzRlcFFqV2Y4bzk2SVZ3d2QyUUFIK1F2czh0OWxVZHJCajF1UEVZcGl3WGZmbWo1eFZjVDU1am9KMjZubkRXengzRHRBWTlPOHRRaFRRd05QVktPT2JTQWdXRlI1OEVuUHc9IiwibGljZW5zZWUiOiJDT01QQU5ZX0lTX05PVF9TRVQiLCJsaWNlbnNlZUVtYWlsIjoic2hpZXJwb3NpZEBnbWFpbC5jb20ifQ%3D%3D'];

    if(licenseKeys.length == 0) {
        notifyAllViews_invalidLicenseState_NoLicenseKey({'isLicenseValid':false, 'isUserEmailAccessible':false, 'isLicenseKeyPresent':false, 'userInfoEmail':null, 'licenseKey':null, 'onSignInChanged_isSignedIn':onSignInChanged_isSignedIn});
        return;
    }

    // getIdentityEmailWithoutInteractiveRequestingEmailPermissions( async function(userInfo) {
    //     // userInfo == null; if identity.email permission is not granted
    //     // userInfo.email == ""; if identity.email permission is granted, but Chrome is not logged in
    //     // ^^^^^^^^^^^^^^^^^^^^^^ устаревшая инфа, это поменялось в новом хроме!!!!
    //     // теперь если permission нету то   userInfo = Object {email: "", id: ""}
    //     // и если хром не залоган то тоже!! userInfo = Object {email: "", id: ""}
    //     // тоесть надо дополнительно проверять ситуацию есть или нет email permission
    //     //
    //     // Есть ещё способ узнать SignIn state
    //     // Если хром не залоган то chrome.runtime.lastError после вызова getAuthToken с interactive == false
    //     // chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
    //     // chrome.runtime.lastError будет содержать такую месагу: Object {message: "The user is not signed in."}
    //     // внутри калбека с токеном, который будет undefined
    //
    //     if(userInfo && userInfo.email ) {
    //         // Хром залоган если мы это получили и разрешение на доступ к емаил есть
    //
    //         let validLicenseKey = await getAnyValidLicenseKey(licenseKeys, userInfo.email);
    //         if(validLicenseKey) {
                notifyAllViews_validLicenseState({'isLicenseValid':true, 'isUserEmailAccessible':true, 'isLicenseKeyPresent':true, 'userInfoEmail':'shierposid@gmail.com', 'licenseKey':licenseKeys[0]});
                activateGdriveBackupScheduler();
    //         } else {
    //             // сюда попадаем в 2х случаях:
    //             // - если ключ есть, серийник что надо, но криптографически невалидный - подпись неправильная (результат шальных ручек скорее всего)
    //             // - ключ какойто есть, но не с тем серийником
    //             let invalidLicenseKey = licenseKeys[0];
    //             notifyAllViews_invalidLicenseState_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey({'isLicenseValid':false, 'isUserEmailAccessible':true, 'isLicenseKeyPresent':true, 'userInfoEmail':userInfo.email, 'licenseKey':invalidLicenseKey});
    //         }
    //     } else { // !userInfo.email
    //
    //         // Есть на данный момент интересная хроме бага:
    //         // Если после реквеста (через identity.request) identity.email permission разрешон, но userInfo.email возвращается как ""
    //         // значит хром не залоган!!!
    //         // Причом сразу после того как он залогается юзером емаил нам дадут без консент скрина дополнительного!!!!
    //         // (скорее всего это также завязано на то что мы этот permission запрашивали, пусть и не интерактивно даже, без этого может не работать
    //         // и похоже это работает тока если мы делали реквест не в бекраунд страницы, а из под интерактивного клика)
    //
    //         chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
    //             if(!token && chrome.runtime.lastError.message == "The user is not signed in.") {
    //                 notifyAllViews_invalidLicenseState_KeyPresentButChromeIsNotSignedIn({'isLicenseValid':false, 'isUserEmailAccessible':false, 'isLicenseKeyPresent':true, 'userInfoEmail':null, 'licenseKey':licenseKeys[0]});
    //             } else {
    //                 // Теоретически токена тут тоже может не быть, но chrome.runtime.lastError.message == "OAuth2 not granted or revoked."
    //                 // На самом деле тут бы стоило проверить isEmailPemissionPresent() и если таки да - то реально мы не знаем что это за ситуация тут такая
    //                 notifyAllViews_invalidLicenseState_KeyPresentChromeIsSignedInButNoEmailPermission({'isLicenseValid':false, 'isUserEmailAccessible':false, 'isLicenseKeyPresent':true, 'userInfoEmail':null, 'licenseKey':licenseKeys[0]});
    //             }
    //         });
    //     }
    // });
}

// function callOnAllViews(methodName, argument1, argument2, argument3) {
//     chrome.extension.getViews({}).forEach(function(tab) {
//         try { if(tab && tab[methodName]) tab[methodName](argument1, argument2, argument3); } catch (e) { console.error(e);console.error(e.stack); }
//     });
// }

function notifyAllViews_validLicenseState(licenseStateValues/*isLicenseValid, isUserEmailAccessible, isLicenseKeyPresent, userInfoEmail, licenseKey*/ ) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_setLicenseState_valid', licenseStateValues:licenseStateValues});
    //callOnAllViews('setLicenseState_valid', licenseStateValues);
}
function notifyAllViews_invalidLicenseState_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey(licenseStateValues) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey', licenseStateValues:licenseStateValues});
    //callOnAllViews('setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey', licenseStateValues);
}
function notifyAllViews_invalidLicenseState_KeyPresentButChromeIsNotSignedIn(licenseStateValues) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn', licenseStateValues:licenseStateValues});
    //callOnAllViews('setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn', licenseStateValues);
}
function notifyAllViews_invalidLicenseState_KeyPresentChromeIsSignedInButNoEmailPermission(licenseStateValues) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission', licenseStateValues:licenseStateValues});
    //callOnAllViews('setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission', licenseStateValues);
}
function notifyAllViews_invalidLicenseState_NoLicenseKey(licenseStateValues) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_setLicenseState_invalid_NoLicenseKey', licenseStateValues:licenseStateValues});
    //callOnAllViews('setLicenseState_invalid_NoLicenseKey', licenseStateValues);
}

function optionsChanged_notifyAllViews(changedOption) {
    viewsCommunicationInterface.postMessageToAllViews({command:'msg2view_optionsChanged_message', changedOption:changedOption});
    //callOnAllViews('optionsChanged_message', changedOption);
}

// ---------------------------------------------------------------------------------------------------------------------------
function getArrayFromLocalStorage(arrayName) {
    try {
        var r = JSON.parse(localStorage[arrayName]);
    } catch(e) {
        r = [];
    }

    return r;
}

function setArrayToLocalStorage(arrayName, arrayObj) {
    localStorage[arrayName] = JSON.stringify(arrayObj);
}

function firstUseOfEventMark(eventTitle) {
    var alreadyFiredEventsArray = getArrayFromLocalStorage('alreadyFiredEventsArray');

    if( alreadyFiredEventsArray.some(function(item){ return item == eventTitle }) ) {
        return 'N';
    } else {
        alreadyFiredEventsArray.push(eventTitle);
        setArrayToLocalStorage('alreadyFiredEventsArray', alreadyFiredEventsArray);
        return 'Y';
    }
}

function pad4(n) {
    var padding = "0000";
    return (padding + n).slice(-padding.length);
}
function beforeAfter(n) {
    if(n > 0)  // Install after the Paid version first release
        return 'B'+pad4( n | 0);
    else   // Install before the Paid version first release
        return 'A'+pad4(-n | 0);  // -0.1 => 0
}
function getInstallTimestamp() {
    return Number(localStorage['install']);
}

function msecondsInstalledBeforePaidRelease() {
    return (new Date(2015, 9, 28)).getTime() - (getInstallTimestamp() || 0); // 9 - October (from 0)
}

function getInstanceInstallDayDimension() {
    return getInstallDimension(   24*60*60*1000);
}
function getInstanceInstallWeekDimension() {
    return getInstallDimension( 7*24*60*60*1000);
}
function getInstanceInstallMonthDimension() {
    return getInstallDimension(30*24*60*60*1000);
}

function getInstallDimension(k) {
    if(!getInstallTimestamp()) return 'NONE';
    var days_weeks_months = msecondsInstalledBeforePaidRelease() / k;
    return beforeAfter(days_weeks_months);
}

// var ga; //TODO v3 enable it back
// (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
// (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
// m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
// })(window,document,'script','https://www.google-analytics.com/analytics.js','ga'); //analytics_debug / analytics
// //ga_debug = {trace: true}; //display more information with analytics_debug.js

// ga('create', 'UA-33566936-5', 'auto'); //Mobile tracker: 'UA-33566936-4'
// ga('set', 'checkProtocolTask', null); //аналитик по дефолту не любит self урлов откуда его дёргают начинающихся с чегото кроме "http" - https://code.google.com/p/analytics-issues/issues/detail?id=312

// ga('set', 'useBeacon',   true  ); // Просто так, теоретически это не надо, бо мы и так переживаем все страницы, и закрываемся вместе с хромом одновременно

// ga('set', 'appName',    chrome.app.getDetails().name    );
// ga('set', 'appVersion', chrome.app.getDetails().version/* + '.' + chrome.app.getDetails().id*/);
// ga('set', 'appId',      chrome.app.getDetails().id      );

// // dimension2 - isFirstUse

// function ga_setInstanceInstallTimeDimensions() {
//     ga('set', 'dimension6', getInstanceInstallDayDimension());   //Instance Install Day (User level)
//     ga('set', 'dimension7', getInstanceInstallWeekDimension());  //Instance Install Week (User level)
//     ga('set', 'dimension8', getInstanceInstallMonthDimension()); //Instance Install Months (User level)
// }
// ga_setInstanceInstallTimeDimensions();

// ga('set', 'dimension9',  get_signin_state_dimension('profile_sign_in')); //Chrome Profile Sign In State
// ga('set', 'dimension10', get_signin_state_dimension('email_access')); //Email Access Permission State
// ga('set', 'dimension11', get_signin_state_dimension('gdrive_access')); //GDrive Access Permission State
// ga('set', 'dimension12', !!localStorage['oneClickToOpen'] ? '1':'2' ); //Oneclicker

// //ga('set', 'dataSource', 'app'); // Maybe need change to 'ext' actually (or 'web'), or just skip this


function ga_screenview(screenName) {
    var page = '/'+screenName.replace(/ /g,'');

    //ga('set', {'location': 'http://tabsoutliner.com' + page } );

    ga('set', {'location': window.location.protocol + '//' + window.location.hostname + page } ); //вроде этого не нужно, но както тупо что там location не соответствует page, там всегда .../_generated_background.html

    ga('set', {'page': page, 'title': screenName } ); // Setting both the page and title for ALL subsequent hits, especialy for EVENTS
                                                      // Без этого на Event Pages репорте мы не видим привязки эвентов к страницам, там пишет '(not set)'
    ga('send', 'pageview', setFirstUseDimension('pageview@' + screenName));
    //ga('send', 'pageview', {'page': page, 'title': screenName }); // не устанавливает page & title для последующих hits (events идут не привязанными к странице)
    //ga('send', 'screenview', { 'screenName': screenName });
}


function incrementLocalStorageValue(valueName) {
    var v = Number(localStorage['valueName']) || 0;
    localStorage[valueName] = ++v;
}

function setFirstUseDimension(titleForFirstUseCheck) {
    return { 'dimension2': firstUseOfEventMark(titleForFirstUseCheck) }; // dimension2 - isFirstUse 'Y'/'N'
}


function ga_event_access_states(eventTitle, chromeSignedInState, emailGrantedState, gdriveAccessGrantedState) {
    if(chromeSignedInState)        ga_set_access_state_dimension('dimension9',  'profile_sign_in', chromeSignedInState);

    if(emailGrantedState)          ga_set_access_state_dimension('dimension10', 'email_access',    emailGrantedState);

    if(gdriveAccessGrantedState)   ga_set_access_state_dimension('dimension11', 'gdrive_access',   gdriveAccessGrantedState);

    ga_event(eventTitle);
}

function ga_set_access_state_dimension(dimensionId, dimensionStateName, newDimensionState) {
    ga_signin_state_dimension(dimensionStateName, newDimensionState);
    ga('set', dimensionId, get_signin_state_dimension(dimensionStateName));
}

// '-' - not set
// 'R' - request fired, but no answer meantime
// 'Y' - Allowed
// 'N' - Declined
// 'NY' - Allowed after Decline
// 'YN' - Declined after being Allowed
// -
//     R
//     Y
//        YN
//            NY
//                ...
//     N
//        NY
//            YN
//                ...

function ga_signin_state_dimension(dimensionName, newState) {
    var currentState = get_signin_state_dimension(dimensionName);

    if(currentState.slice(-1) == newState) return; // in other case second 'Y' will overwrite the 'NY' for example

    if(newState == 'N') {
        if(currentState == 'Y' || currentState == 'NY')
            localStorage[dimensionName] = 'YN';
        else
            localStorage[dimensionName] = 'N';
        return;
    }

    if(newState == 'Y') {
        if(currentState == 'N' || currentState == 'YN')
            localStorage[dimensionName] = 'NY';
        else
            localStorage[dimensionName] = 'Y';
        return;
    }

    if(currentState == '-') {
        localStorage[dimensionName] = newState;
        return;
    }
}

// 'profile_sign_in'
// 'email_access'
// 'gdrive_access'
function get_signin_state_dimension(dimensionName) {
    return localStorage[dimensionName] || '-';
}

function ga_event_backup_view(eventTitle, errorText) {
    var category = 'Backup View';
    var action   = eventTitle;
    var label    = errorText || "-"; // All 3 dimensions for events must always be present & set to not false, or event will not be counted properly in some reports;
    ga('send', 'event', category, action, label, setFirstUseDimension(category + '#' + action));
}

function ga_event(eventTitle) {
    var category = 'Flow';
    var action   = eventTitle;
    var label    = '-'; // All 3 dimensions for events must always be present & set to not false, or event will not be counted properly in some reports
    ga('send', 'event', category, action, label, setFirstUseDimension(category + '#' + action) );
}

function ga_event_error(eventTitle, errorText) {
    var category = 'Error';
    var action   = eventTitle;
    var label    = errorText || "-"; // All 3 dimensions for events must always be present & set to not false, or event will not be counted properly in some reports
    ga('send', 'event', category, action, label, setFirstUseDimension(category + '#' + action + '#' + label) );
}

function ga_event_backup_started(isInteractive) {
    var category = 'Backup';
    var action   = 'Backup Started';
    var label    = isInteractive ? 'Interactive' : 'Auto';
    ga('send', 'event', category, action, label, setFirstUseDimension(category + '#' + action + '#' + label) );

    incrementLocalStorageValue('backup_atemptCount');
}

function ga_event_backup_succeded(backupRequestBodySize) {
    var category = 'Backup';
    var action   = 'Backup Succeded';
    var label    = '-'; // All 3 dimensions for events must always be present & set to not false, or event will not be counted properly in some reports
    ga('send', 'event', category, action, label, backupRequestBodySize, setFirstUseDimension(category + '#' + action) );


    incrementLocalStorageValue('backup_successCount');
}

function ga_event_backup_error(errorReason) {
    var category = 'Backup';
    var action   = 'Backup Failed';
    var label    = errorReason || '-'; // All 3 dimensions for events must always be present & set to not false, or event will not be counted properly in some reports
    ga('send', 'event', category, action, label);

    incrementLocalStorageValue('backup_failsCount');
}


// License Key Link Monitor --------------------------------------------------------------------------------------------------


function licenseKeyLinkHandler(tabId, changeInfornamtion, tab) {  
    var match = licenseKeyLinkRegExp.exec(tab.url);
    if (match && match[1]) {
        var key = match[1];

        if(key != alreadyDetektedLicenseKey) { // onUpdates come several times on tab load
            chrome.tabs.create({ 'url' : chrome.runtime.getURL('options.html') + '?setkey=' + key, 'active' : true });
            alreadyDetektedLicenseKey = key;
        }
    }
}

function _addLicenseKeyToSyncStorage(keyObj) { // called from options.js by processUrlSetKeyCommand(), so only in case user MANULY opens the license key link
    chrome.storage.sync.get({'licenseKeys': []}, function getKeys(syncDataObj) {
        var keysArray = syncDataObj['licenseKeys'];
        var keysArray_ = keysArray.filter(function(obj) { return obj.serial != keyObj.serial}); // Remove previous copy of the same key if they exist, to not create dublicates
        keysArray_.push(keyObj);

        chrome.storage.sync.set({'licenseKeys': keysArray_});
    });
}

function adapter_proceedLicenseKeysFromSyncStorage(syncDataObj) {
    proceedLicenseKeysFromSyncStorage(syncDataObj['licenseKeys']);
}

async function proceedLicenseKeysFromSyncStorage(licensekeys) {
    if(!licensekeys) return; // это реально происходит если dropkey() было вызвано и sync storage было очищено, тогда срабатывает onChanged но changes['licenseKeys']['newValue'] == undefined

    // // warning, do not call there _addLicenseKeyToSyncStorage() - is it might create endless loop of updates

    // var isNewKeyAppears = false;
    // licensekeys.forEach( async function(licensekey) {
    //     isNewKeyAppears |= await _addLicenseKeyToLocalStorage(licensekey, true);
    // });
    // if(isNewKeyAppears) {
    //     console.log('New license key applied from chrome.sync');
    //     checkAndUpdateLicenseStatusInAllViews();
    // }

    checkAndUpdateLicenseStatusInAllViews();
}


// ----------------------------------------------------------------------------------------------------------------------------------------------
let previousSyncState = null;

// Function to get sync state
function getSyncState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        resolve(false); // Sync is off
      } else {
        resolve(true); // Sync is on // ALWAYS TRUE - это не пашет!!!!!
      }
    });
  });
}

// // Function to check sync state and notify if changed
// воно вроде не паше нормально
//
// async function checkSyncState() {
//   const currentSyncState = await getSyncState();
//   console.log("Sync state is", currentSyncState ); // ALWAYS TRUE - это не пашет!!!!!
// 
//   if (previousSyncState === null) {
//         previousSyncState = currentSyncState;
//   } else if (previousSyncState !== currentSyncState) {
//         previousSyncState = currentSyncState;
//         if (currentSyncState) {
//             console.log("Sync state changed to ON");
//             // Add your notification or handling code here
//         } else {
//             console.log("Sync state changed to OFF");
//             // Add your notification or handling code here
//         }
//   }
// }
// // Listen for sign-in state changes
// chrome.identity.onSignInChanged.addListener((account, signedIn) => {
//   console.log(`Sign-in state changed for ${account.email}: ${signedIn ? 'Signed In' : 'Signed Out'}`, account, signedIn);
//   // Если Sync is off то будет account.email == undefined
//   // причому onSignInChanged не викликаэться якщо ми Sync включили після логіна
//   checkSyncState();
// });
// // Initial check
// checkSyncState();
