/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

// Google CLosure Section - BEG ----------------------------------------------------------------------------------------------
var VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick = "__a";

// Exports for Background Page
//
// Раньше чтоб некий символ был калабелен из другого места (в данном случае из background page)
// Я тут его экспортировал через window['xyz'] = xyz
// А при компиляции background.js определял для него через externs-background.js что все его упоминания недолжны
// переименовываться. Как вариант можно было просто вызывать через ['xyz'] и не связываться с externs файлами
window[VIEW_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick] = selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick;
//
//
// Google CLosure Section - END ----------------------------------------------------------------------------------------------

var actionLinksBtnsIds = ['newWindowActionLink', 'newTextNodeActionLink', 'newGroupNodeActionLink', 'newSeparatorNodeActionLink', 'newGoogleDocNodeActionLink'];
actionLinksBtnsIds.forEach( function(btnId) {
    var btn = document.getElementById(btnId);
    btn.addEventListener('click',     actionLink_onclick);
    btn.addEventListener('dragstart', actionLink_ondragstart);
});

document.getElementById('cloneViewButton').addEventListener('click', cloneView);
document.getElementById('undoScrollButton').addEventListener('click', undoScroll);
document.getElementById('nextOpenWindowButton').addEventListener('click', scrollUpToNextOpenWindow);
//document.getElementById('groupOpenWindowsButton').addEventListener('click', cloneView);
document.getElementById('savecloseAllWindowsButton').addEventListener('click', closeAllOpenWindows);
document.getElementById('expandAllButton').addEventListener('click', expandAll);
document.getElementById('undoExpandAllButton').addEventListener('click', undoExpandAll);
document.getElementById('backupNowButton').addEventListener('click', backupNow);
//document.getElementById('undoDeleteButton


document.getElementById('infoButton').addEventListener('click', onInfoClick);
document.getElementById('helpButton').addEventListener('click', onHelpClick);
document.getElementById('settingsButton').addEventListener('click', onOptionsClick);

window.isAutoscrollView = false;

var treeView;

var performOperationOnLoadComplete = null;

// Functionality Wich Make Possible "Scroll Even Last Node To Window Top Bound"  ---------------------------------------
// Механизм для того чтоб возможно было проскролить дерево так чтоб даже самая последняя нода окна могла быть показано в первой строчке вьюпорта
var scrollToLastNodeCompensator = document.createElement("div"); scrollToLastNodeCompensator.id = 'scrollToLastNodeCompensator';
var winNodePlusOneTabNodeHeight = 46;

var preventResizeOnEveryEvent_resizeTimeout = 200;
var preventResizeOnEveryEvent_resizeTimeoutId;

var backgroundport = chrome.runtime.connect({name: "background"});

backgroundport.onMessage.addListener(function getResp(response) {
    console.log(response.command, " handlerPresent:", !!self[response.command], response);

    if(self[response.command]) self[response.command](response); 
    if(false) { // Читай комент ниже:
        // Этот блок кода не вызывается, тут это все для ideшке что б по GetUsage & Search
        // было понятно что от сюда эти вызовы происходят
        // А происходят они динамически, в строчке self[response.command](response); if(false) {
        msg2view_initTreeView(response);
        msg2view_requestScrollNodeToViewInAutoscrolledViews(response);
        msg2view_continueToScrollUpToNextOpenWindow(response);
        msg2view_setCursorHere(response);
        msg2view_activateNodeTabEditTextPrompt(response);
        msg2view_activateNodeNoteEditTextPrompt(response);
        msg2view_activateNodeWindowEditTextPrompt(response);

        msg2view_notifyObserver(response);
        msg2view_notifyObserver_onNodeUpdated(response);

        msg2view_onDragStartedInSomeView(response);

        msg2view_optionsChanged_message(response);

        // declared in activesessionview_messages.js ------------------------------------------------------
        msg2view_setLicenseState_valid(response);
        msg2view_setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey(response);
        msg2view_setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn(response);
        msg2view_setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission(response);
        msg2view_setLicenseState_invalid_NoLicenseKey(response);
        
        msg2view_updateBackupIndicator_backgroundPageCall(response)
        msg2view_backupStarted_backgroundPageCall(response);
        msg2view_onAuthorizationTokenGranted_backgroundPageCall(response);
        msg2view_onBackupSucceeded_backgroundPageCall(response);
        msg2view_onGdriveAccessRewoked_backgroundPageCall(response);
        msg2view_noConnectionError_backgroundPageCall(response);
        msg2view_backupError_backgroundPageCall(response);
    }

});


function msg2view_onDragStartedInSomeView(response) {
    treeView.onDragStartedInSomeView(response);
}

function msg2view_notifyObserver_onNodeUpdated(response) {
    var observer = treeView.getRowDomByIdMVC(response.idMVC);
    if(!observer) {
        console.error("msg2view_notifyObserver_onNodeUpdated cannot find element with id:", response.idMVC); //скорее всего свернутый узел, его нет в view
        return;
    }

    var node_MVCDataTransferObject = new NodeModelMVCDataTransferObject(response.modelDataCopy);


    if(observer.ownerDocument.defaultView)
        if(observer.fromModel_onNodeUpdated) observer.fromModel_onNodeUpdated(node_MVCDataTransferObject);

}

function updateStatBlockAndProtectedOnCloseStatusForExistedInDomCollapsedParents(response) {
    if(!response.parentsUpdateData) return;

    function updatedStatBlockAndProtectedOnCloseIfCollapsedAndExistInDom (idMVC, updateData) {
        if(!updateData.isCollapsed) return;

        let rowDom = treeView.getRowDomByIdMVC(idMVC);
        if(!rowDom) return;

        rowDom.fromModel_onProtectedOnCloseAndStatBlockUpdate(updateData);

    }

    Object.keys(response.parentsUpdateData).map((idMVC) => updatedStatBlockAndProtectedOnCloseIfCollapsedAndExistInDom(idMVC, response.parentsUpdateData[idMVC]));

}

function msg2view_notifyObserver(response) {
    var observer = treeView.getRowDomByIdMVC(response.idMVC);
    if(!observer) {
        // console.warn("msg2view_notifyObserver cannot find element with id:", response.idMVC);

        // Грязный хак, но....
        // короче скорее всего тут вызван onSubnodeInserted или onSubTreeDeleted для узла который счас внутри свернутой иерархии и потому не присутствует в DOM
        // но нам надо стат блоки свернутых парентов проапдейтить всеравно при этом. поэтому вызовем для тех кто свернут и есть в DOM апдейт стат блока
        // очень хуево что такие решения принимает просто диспатч метод, но уж как есть

        updateStatBlockAndProtectedOnCloseStatusForExistedInDomCollapsedParents(response);

        return;
    }

    function obj2array(obj) { // Chrome convert array to objects like {0:"a", 1:"b"}; during message dispatching
        var r = [];
        for(var i=0;i in obj;i++)
            r.push(obj[i]);

        return r;//Object.keys(obj).map((key) => obj[key]);
    }

    var args = Array.prototype.slice.apply(obj2array(response.parameters));
    if(response.parentsUpdateData) args.push(response.parentsUpdateData) // Ну очень грязный хак
    var callbackName = args.shift();


    try {
        // это внутри модели когдато было и там это было важно бо мне надо было всех обзерверов проинформировать даже если некоторый выкинули exception
        // счас уже этот блок возможно не актуален, ну але най буде
        //
        // Важный try-catch! - мы так оберегаем модель от проблем на стороне обзерверов - которые случаются (DOM EXCEPTIONS к примеру если чегото не нашло), причём мы в этом случае даже не получали лога никакого вменяемого в бекграйнд консоли без этого try-catch
        // TODO BUG!
        // Который к томуже исходит из предположения что observer это HTMLElement - что вовсе и не правда, это в будущем NodeView
        // ReferencesLeak - старые View которые уже в дохлых окнах находятся
        // при вызовах чегото вроде new Image() сдыхают так как Image уже нет в их области видимости (window у них нет)
        // Правильная имплементация должна из модели выкинуть все свои обзерверы при закрытие её окна (на onClose Window или тут - на
        // детектинге закрытия нашего таба - лучше на onClose, а ещё лучше и тут и на onClose в view )
        if(observer.ownerDocument.defaultView)
            if(observer[callbackName]) observer[callbackName].apply(observer, args);
    }
    catch(error) {
        console.error("ERROR during observer notify", callbackName, args, error, error.stack);
        console.log(error.message);
        console.log(error.stack);
    }

}

function msg2view_activateNodeWindowEditTextPrompt(response) {
    activateEnterTextPrompt(response, "request2bkg_onOkAfterSetNodeWindowTextPrompt");
}

function msg2view_activateNodeNoteEditTextPrompt(response) {
    activateEnterTextPrompt(response, "request2bkg_onOkAfterSetNodeNoteTextPrompt");
}

function msg2view_activateNodeTabEditTextPrompt(response) {
    activateEnterTextPrompt(response, "request2bkg_onOkAfterSetNodeTabTextPrompt");
}

function msg2view_setCursorHere(response) {
    treeView.getRowDomByIdMVC(response.targetNodeIdMVC).setCursorHere(response.doNotScrollView);
}

function msg2view_continueToScrollUpToNextOpenWindow(response) {
    continue_scrollUpToNextOpenWindow(response.allOpenWindowsIdMVCs);
}

function msg2view_requestScrollNodeToViewInAutoscrolledViews(response) {
    scrollNodeToViewInAutoscrolledViews(response.idMVC);
}

function msg2view_initTreeView(response) {
    console.time();
    var treeModel = [new NodeModelMVCDataTransferObject(response.rootNode_currentSession)]; // [rootNode_CurrentSession]
    console.timeLog();
    var globalViewId = response.globalViewId;

    treeView = new TreeView(
        window,
        treeModel,
        1/*thisTreeTabIndex*/,
        document.getElementById("mainToolbar").offsetHeight,
        true/*enableContextMenu*/,
        globalViewId,
        backgroundport,
        response.instanceId
    );

    let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");
    activeSessionTreeScrollableContainer.appendChild( treeView.currentSessionRowDom );
    activeSessionTreeScrollableContainer.appendChild( scrollToLastNodeCompensator ); // Механизм для того чтоб возможно было проскролить дерево так чтоб даже самая последняя нода окна могла быть показано в первой строчке вьюпорта

    doScrollAndSetIsAutoscrollViewOnReadyAndShowHelpBlock();

    loadAllDefferedIcons(70); // Сразу грузим последнии 70 так как они уже могут быть видны будут
                              // 70 выбрано с таким расчётом что это наверняка покрывает все открытые табы в низу
                              // но это сильно меньше 1500 - цифра на каторой падает TO на убунте если запросить сразу стока картинок из favicons кеша

    // Остальное теперь грузит механизм догрузке тех что видны на экране
    // Это сильно экономит память. Хоть и не так интерактивно.
    // scheduleDefferedIconsLoading(); // Откладываем загрузку всех остальных на позже
    //                                 // Отложенная загрузка фиксает сразу 2 проблемы
    //                                 //  1) Пропадание проводов при over 9000 нодах
    //                                 //  2) Мёртвый креш на Ubunte при одновременном заказе больше 2000 картинок из chrome://favicon

    applyCustomUserStyles();

    // connectKeyboardShortcuts
    window.addEventListener('keydown',       window_onkeydown, false);
    window.addEventListener('actionCommand', window_onActionCommand, false);
}

function activateEnterTextPrompt(response, onOkRequest2bkgMessageName) {
    treeView.activatePrompt(response.defaultText, function onOk(newText){
        backgroundport.postMessage({request:onOkRequest2bkgMessageName,
            targetNodeIdMVC:response.targetNodeIdMVC,
            newText:newText
        });
    });
}

function scrollNodeToViewInAutoscrolledViews(idMVC) {
    treeView.getRowDomByIdMVC(idMVC).fromModel_requestScrollNodeToViewInAutoscrolledViews();
}

function Global_onResize_UpdateScrollToLastNodeCompensator(event) {
    clearTimeout(preventResizeOnEveryEvent_resizeTimeoutId);
    preventResizeOnEveryEvent_resizeTimeoutId = setTimeout(enablePossibilityToScrollLastWindowTitleToFirstVisibleLine, preventResizeOnEveryEvent_resizeTimeout);
}

function enablePossibilityToScrollLastWindowTitleToFirstVisibleLine() {
    var h = window.innerHeight;
    // let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");
    // activeSessionTreeScrollableContainer.clientHeight - раньше была со скролингом. а теперь без!!! его clientHeight теперь равна полной длине
    // if(activeSessionTreeScrollableContainer) h = activeSessionTreeScrollableContainer.clientHeight;
    scrollToLastNodeCompensator.style.height = (h - winNodePlusOneTabNodeHeight)+'px'; // -x to not make possible for user to scroll completely out and see only empty screen //was pixelHeight
    // кстате отрицательное значение в style.pixelHeight засетать невозможно
}

enablePossibilityToScrollLastWindowTitleToFirstVisibleLine();
window.addEventListener('resize', Global_onResize_UpdateScrollToLastNodeCompensator);

// ---------------------------------------------------------------------------------------------------------------------
// Первые 2 параметра для курсора, 
function selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick(focusTabId, altFocusNodeId /*will be selected if focusNodeId is collapsed and invisble */, scrollToVieWinId) {
    //if(!treeView) return; // For rare cases we called from background page before initialization done

    enablePossibilityToScrollLastWindowTitleToFirstVisibleLine(); // Без этого скрол нормально не произойдёт, точнее произойдёт но потом в новое место отложенный Global_onResize_UpdateScrollToLastNodeCompensator передвинет страницу!

    backgroundport.postMessage({request:"request2bkg_selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick", focusTabId:focusTabId, scrollToVieWinId:scrollToVieWinId }); // must result in initTreeView() call with data returned by response
}

function scrollToDefaultPageOffestForClonedViewsOnInitialOpen(sourceViewPageYOffset) {
    //if(!treeView) return; // For rare cases we called from background page before initialization done

    enablePossibilityToScrollLastWindowTitleToFirstVisibleLine(); // Без этого скрол нормально не произойдёт, точнее произойдёт но потом в новое место отложенный Global_onResize_UpdateScrollToLastNodeCompensator передвинет страницу!

    // window.scrollTo(0, sourceViewPageYOffset); // Скролл в туже позицию что и окно из которого клонировались
    undoScroll_memorizePageOffset(sourceViewPageYOffset);

    // Скрол в конец дерева, так чтоб под меню ничего не подлезло и был виден максимальный хвост дерева
    window.scrollTo(0,
            window.document.documentElement.scrollHeight
            - window.innerHeight
            - scrollToLastNodeCompensator.offsetHeight //was pixelHeight
            + document.getElementById("mainToolbarAndMessagesContainer").offsetHeight);
}


// Запрещаем селектинг - очень часто появляется селектинг на узлах при драге - он мешает и раздражает + его сложно убрать
// Особенно при драге с меню к примеру.
window.document.addEventListener('selectstart', preventSelection);
function preventSelection(e) {
    // document.getSelection().removeAllRanges() - можно ещё юзать для надёжности, особенно после edit операций
    e.preventDefault(); // Просто return false не срабатывало почемуто (иногда)
    return false; // Prevent default action
}

// Баним горизонтальный скролинг (возникает при драге к примеру) потом сложно задрагать всё назад
window.addEventListener('scroll', undoHorizontalScroling);
function undoHorizontalScroling (e) {
    if(window.pageXOffset != 0) { // Тут был странный баг без фигурных скобок вроде, при первом ресайзе эта штука срабатывала и скролила назад
        window.scrollTo(0, window.pageYOffset);
    }
}

// CloneView functionality ---------------------------------------------------------------------------------------------
function cloneView() {
    backgroundport.postMessage({request:"request2bkg_cloneTabsOutlinerView", 
        tabsOutlinerInitiatorWindow_outerWidth:window.outerWidth, 
        tabsOutlinerInitiatorWindow_screenX:window.screenX,
        sourceViewPageYOffset:window.pageYOffset
    });
}

// UndoScroll functionality --------------------------------------------------------------------------------------------
window.addEventListener('scroll', undoScroll_onScroll_pageOffsetsMemorizerScheduler);
window.addEventListener('before_scroll_node_to_view', undoScroll_memorizeCurrentPageOffset);

var undoScroll_pageOffsetStableTimeoutToMemorizeIt = 1000;
var undoScroll_pageOffsetsMemorizerId;
var undoScroll_memorizerEnabled = true;

var undoScroll_memorizedOffsets = [];

function undoScroll_onScroll_pageOffsetsMemorizerScheduler (e) {
    clearTimeout(undoScroll_pageOffsetsMemorizerId);
    undoScroll_pageOffsetsMemorizerId = setTimeout(undoScroll_memorizeCurrentPageOffset , undoScroll_pageOffsetStableTimeoutToMemorizeIt);
}


function undoScroll_memorizeCurrentPageOffset() {
    if(undoScroll_memorizerEnabled) // временно отключается в дико костыльной логике внутри scrollUpToNextOpenWindow() чтоб не портить undo очередь из-за кучи scroll вызовов
        undoScroll_memorizePageOffset(window.pageYOffset);
}

function undoScroll_memorizePageOffset(pageYOffsetToMemorize) {
    // Не запоминаем одинаковые значения
    if(undoScroll_memorizedOffsets.length > 0 && undoScroll_memorizedOffsets[undoScroll_memorizedOffsets.length-1] == pageYOffsetToMemorize)
        return;


    undoScroll_memorizedOffsets.push(pageYOffsetToMemorize);

    if(pageYOffsetToMemorize != undoScroll_memorizedOffsets_undoSequenceCopy_lastUndoValue) // Не тоже самое значение что запросил само undo
        undoScroll_memorizedOffsets_undoSequenceCopy = null; // Drop current undo sequence if new value obtained
}
var undoScroll_memorizedOffsets_undoSequenceCopy = null;
var undoScroll_memorizedOffsets_undoSequenceCopy_lastUndoValue = 0;

function undoScroll() {
    if(!undoScroll_memorizedOffsets_undoSequenceCopy) // Делаем себе копию по которой и будем возвращать скролл до тех пор пока нового значения не прийдёт
        undoScroll_memorizedOffsets_undoSequenceCopy = undoScroll_memorizedOffsets.slice();

    do {
        var pageOffset = undoScroll_memorizedOffsets_undoSequenceCopy.pop();
    } while(pageOffset && pageOffset == window.pageYOffset/*нет смысла ундонится на теже значения что имеем*/);

    if(pageOffset) window.scrollTo(0, undoScroll_memorizedOffsets_undoSequenceCopy_lastUndoValue = pageOffset);
}
// Expand All/Undo Exapnd All ------------------------------------------------------------------------------------------

function expandBtnsAnimationEnd_ClearStyles() {
    document.getElementById("expandAllButton").removeEventListener("webkitAnimationEnd", expandBtnsAnimationEnd_ClearStyles);
    document.getElementById("undoExpandAllButton").removeEventListener("webkitAnimationEnd", expandBtnsAnimationEnd_ClearStyles);

    document.getElementById("expandAllButton").classList.remove("flipIn");
    document.getElementById("undoExpandAllButton").classList.remove("flipIn");
    document.getElementById("expandAllButton").classList.remove("flipOut");
    document.getElementById("undoExpandAllButton").classList.remove("flipOut");
    document.getElementById("expandAllButton").classList.remove("face");
    document.getElementById("undoExpandAllButton").classList.remove("face");
    document.getElementById("expandAllButton").classList.remove("face");
    document.getElementById("undoExpandAllButton").classList.remove("face");
}

function flitToUndoAnimationEnd_performExpand() {
    document.getElementById("undoExpandAllButton").removeEventListener("webkitAnimationEnd", flitToUndoAnimationEnd_performExpand);

    expandAllNodesInTreeModel();
}

function flitToNormalAnimationEnd_performUndoExpand() {
    document.getElementById("expandAllButton").removeEventListener("webkitAnimationEnd", flitToNormalAnimationEnd_performUndoExpand);

    undoExpandAllNodesInTreeModel();
}

function expandAllBtnAnimationEnd_flitToUndo() {
    document.getElementById("expandAllButton").removeEventListener("webkitAnimationEnd", expandAllBtnAnimationEnd_flitToUndo);

    document.getElementById("expandAllButton").classList.add("hidden");
    document.getElementById("undoExpandAllButton").classList.remove("hidden");

    document.getElementById("undoExpandAllButton").addEventListener("webkitAnimationEnd", expandBtnsAnimationEnd_ClearStyles);
    document.getElementById("undoExpandAllButton").addEventListener("webkitAnimationEnd", flitToUndoAnimationEnd_performExpand);
    document.getElementById("undoExpandAllButton").classList.add("flipIn");
}

function undoExpandAllButtonEnd_flipToNormal() {
    document.getElementById("undoExpandAllButton").removeEventListener("webkitAnimationEnd", undoExpandAllButtonEnd_flipToNormal);

    document.getElementById("expandAllButton").classList.remove("hidden");
    document.getElementById("undoExpandAllButton").classList.add("hidden");

    document.getElementById("expandAllButton").addEventListener("webkitAnimationEnd", expandBtnsAnimationEnd_ClearStyles);
    document.getElementById("expandAllButton").addEventListener("webkitAnimationEnd", flitToNormalAnimationEnd_performUndoExpand);
    document.getElementById("expandAllButton").classList.add("flipIn");
}


function expandAll() {
    document.getElementById("expandAllButton").addEventListener("webkitAnimationEnd", expandAllBtnAnimationEnd_flitToUndo);
    document.getElementById("expandAllButton").classList.add("face");
    document.getElementById("expandAllButton").classList.add("flipOut");
}

function undoExpandAll() {
    document.getElementById("undoExpandAllButton").addEventListener("webkitAnimationEnd", undoExpandAllButtonEnd_flipToNormal);
    document.getElementById("undoExpandAllButton").classList.add("face");
    document.getElementById("undoExpandAllButton").classList.add("flipOut");
}

var undoExpandAllNodesList = null;

function expandAllNodesInTreeModel() {
    undoExpandAllNodesList = treeView.treeModel.getAllCollapsedNodes();

    undoExpandAllNodesList.forEach( function(node) {
        node.setCollapsing(false);
    });
}

function undoExpandAllNodesInTreeModel() {
    if(!undoExpandAllNodesList) return;

    undoExpandAllNodesList.forEach( function(node) {
        node.setCollapsing(true);
    });

    undoExpandAllNodesList = null;
}


// Close All Open ------------------------------------------------------------------------------------------------------
function closeAllOpenWindows() {
    if(confirm("Confirm close all open windows. \n\nClosed windows will be preserved in the tree as saved.")) { //i18n
        window.chrome.windows.getCurrent({'populate': false}, function (ourChromeWindowObj) {
            backgroundport.postMessage({request:"request2bkg_closeAllWindowsExceptThis", preserveWinId:ourChromeWindowObj.id});
        });
    }
}

// Scroll up to next open window ------------------------------------------------------------------------------------------
function scrollUpToNextOpenWindow() {
    backgroundport.postMessage({request:"request2bkg_getListOfAllActiveWindowNodes_continueToScrollUpToNextOpenWindow_onRequestedPort"});
}

function continue_scrollUpToNextOpenWindow(allOpenWindowsIdMVCs) {
    var isAutoscrollView_originalValue = window.isAutoscrollView;
    window.isAutoscrollView = true; // Enable treeView scroling - чтоб requestScrollNodeToViewInAutoscrolledViews() срабатывал для нас

    var pageYOffset_originalValue = window.pageYOffset;

    undoScroll_memorizerEnabled = false;
    for(var j = allOpenWindowsIdMVCs.length-1; j >= 0; j--) { // Итерируем с низу вверх
        scrollNodeToViewInAutoscrolledViews(allOpenWindowsIdMVCs[j]);
        if(window.pageYOffset < pageYOffset_originalValue) // Мы скрольнулись кудато выше - окей!
            break;
    }
    undoScroll_memorizerEnabled = true;
    undoScroll_memorizeCurrentPageOffset(); // Хотя если был скролл он и так через секунду прийдёт, но ждать секунду - не очень здорово

    window.isAutoscrollView = isAutoscrollView_originalValue;
}

const application_x_tabsoutliner_actionlink = 'application/x-tabsoutliner-actionlink';

function actionLinkEventGetFabric(event) {
    return event.srcElement.dataset['fabric'];
}

function actionLink_ondragstart(event) {
    event.dataTransfer.setData(application_x_tabsoutliner_actionlink, actionLinkEventGetFabric(event));
    return true; // Запускаем дефолтную реализация - она нам рисуночек сбахает кстате красивый для драга,
                 // в любом случае драг не начнётся если тут вернуть false ->> Это кстате не правда если мы подвешены через addEventListener, это так только для подвеса через el.ondragstart
}

function actionLink_onclick(event) {
    let dummyDataTransfer = {
        types                                   : [application_x_tabsoutliner_actionlink],
        [application_x_tabsoutliner_actionlink] : actionLinkEventGetFabric(event),
        getData                                 : function(type) { return this[type]; },
    };

    // TODO Тут надо переделать шоб если в Options це зазначено то вставляло в месте курсора as last subnode
    let dropTarget = selectDropTarget(AS_LAST_SUBNODE, treeView.currentSessionRowDom )
    treeView.performDrop( dropTarget, false, dummyDataTransfer );

    return true; // Запускаем дефолтную реализация
}


// About block functionality --------------------------------------------------------------------------------------------
function onInfoClick() {
    focusTabIfAliveCreateAsPopUpIfAbsent( chrome.runtime.getURL('about.html'),
                                          function(){ window.open('about.html','_blank','height=1000,width=920, left=350, top=50') } );

}

// Settings block functionality --------------------------------------------------------------------------------------------
function onOptionsClick() {
    focusTabIfAliveCreateAsPopUpIfAbsent( chrome.runtime.getURL('options.html'),
                                          function(){ window.open('options.html','_blank','height=850,width=900, left=200, top=200') } );
}

function focusTabIfAliveCreateAsPopUpIfAbsent(url, createMethod){
    window.chrome.windows.getAll({'populate':true}, function(windowsList) {
        var alifeTabWithRequestedUrl;

        windowsList.forEach(function(chromeWindowObj) {
            chromeWindowObj.tabs.forEach(function(chromeTabObj) {
                if(chromeTabObj.url.indexOf(url) == 0)
                alifeTabWithRequestedUrl = chromeTabObj;
            })
        });

        if(alifeTabWithRequestedUrl) backgroundport.postMessage({request:"request2bkg_focusTab", tabWindowId:alifeTabWithRequestedUrl.windowId, tabId:alifeTabWithRequestedUrl.id });
        else                         createMethod();
    });
}

// = BEG = Main Toolbar Focus Hack ====================================================================================================================================================
// Main Toolbar Focus Hack - предназначен чтоб во время активации маин тулбара убирать подсказку урла для узла в фокусе которая его перекрывает обычно
// (если был клик на какомто из узлов он становится пермаментно зафокусеным)

document.getElementById("mainToolbar").addEventListener("mouseover", maintoolbarFocusHack_onMouseOver);
document.getElementById("mainToolbar").addEventListener("mouseout", maintoolbarFocusHack_onMouseOut);


var elementFocusedWhenMainToolbarHovered = null;

function isAChildOf(_parent, _child)
{
    var testElement = _child;
    while (testElement) {
       if(testElement === _parent) return true;
       testElement = testElement.parentNode;
    }

    return false;
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function maintoolbarFocusHack_onMouseOver(event) {
    if(!isAChildOf(this, event.relatedTarget)) maintoolbarFocusHack_onMouseEnter();
}

function maintoolbarFocusHack_onMouseOut(event) {
    if(!isAChildOf(this, event.relatedTarget)) maintoolbarFocusHack_onMouseLeave();
}

function maintoolbarFocusHack_onMouseEnter() {
    elementFocusedWhenMainToolbarHovered = document.activeElement;
    document.activeElement.blur();
}

function maintoolbarFocusHack_onMouseLeave() {
    // РАньше вместо всего этого дикого костыля было просто elementFocusedWhenMainToolbarHovered.focus(); - но это приводило к скролингу к зафокусенному элементу при Leave - и почти всегда это было не в тему
    undoScroll_memorizerEnabled = false;
    var currentScrollPos = window.pageYOffset;
    elementFocusedWhenMainToolbarHovered.focus(); // focus it back - это приводит к скролингу окна! А оно могло быть уже в другом совершенно месте - неудобно
    window.scrollTo(0, currentScrollPos); // Undo scroll generated by .focus() - if any
    undoScroll_memorizerEnabled = true;

    elementFocusedWhenMainToolbarHovered = null; // To not hold reference, also on windows unload this must be dublicated
}
// = END = Main Toolbar Focus Hack ====================================================================================================================================================

// function getTreeModel() {
//     if(window.chrome && window.chrome.extension) {
//         // Extention Mode
//         return getActiveSessionTreeModel();
//     }
//     else {
//         // Test Mode - We are regular web page
//         // return window.extentToTreeModelRecursive(createTreeModelFromBuddySession(testexportedsession));
//     }
// }

// Мы раньше создавали наше дерево в window.onload но думаю оно не очень нужно, так как можно просто этот код перед </body> поставить (что и сделано)
// Запуск в window.onload кстате приведёт к тому что мы сначало дождёмся загрузки даже всех картинок, внешних css и всякого такого (в том числе банеров и сторонних компонент)
// можно юзать DOMContentLoaded или document.onreadystatechange (document.readyState == "complete") чтоб не ждать картинок (и именно их юзает jQuery, но она ещё и проверяет доступность body и делает таймер паузу)
console.time("SessionView TreeGenerationTime");



if(window.chrome && window.chrome.extension) {
    // We are in extension
    backgroundport.postMessage({request:"request2bkg_get_tree_structure"}); // must result in msg2view_initTreeView() call with data returned by response

} else {
    // We are in regular, saved, web page
    // But, list on nodes is not ready meantime, so we will work on them (make them dragable and replace favicons urls) when they will be ready and present in html
    document.addEventListener('DOMContentLoaded', prepareDomForSavedAsHtmlMode);
}

function actionPrint() {
    setTimeout( function(){ window.print() }, 1); // setTimeout, because it's called from context menu and i whant to close it (so need return from event) before render print page
}
//function actionsSearch() {
//    setTimeout( function(){ window.find() }, 1); // setTimeout, because it's called from context menu and i whant to close it (so need return from event) before render print page
//}

function requestClipboardPermissions(callback) {
    chrome.permissions.request({
            permissions: [ "clipboardRead", "clipboardWrite"], //identity не требует consent скрина, identity.email - требует! и 100% блокирует extension на апдейте если указано не в optional_permissions
            origins: []
        }, callback);
}
function execCommand_cut() { document.execCommand('cut') }
function execCommand_copy() { document.execCommand('copy') }
function execCommand_paste() { document.execCommand('paste') }

function ifLite_goPro(skipNagScreen) {
    if( !!window['isKeysAndcontextMenuActionsEnabled'] ) {
        return false; //to continue execution in such expression: ifLite_goPro() || executeProAction()
    } else {
        if(!skipNagScreen) activateProFeatureUsageInLiteModeDialog(null,null,onOptionsClick);
        return true; // Block next command in such expression: ifLite_goPro() || executeProAction();
    }
}

function window_onActionCommand(event){
    if( ifLite_goPro() ) return; // Do not show nag screen in case of Ctrl-C in lite mode, as many translators autovaticaly send this shortcuts in every focused  window

    var action = event['detail']['action'];

    switch(action) {
        case 'actionCut':   requestClipboardPermissions(execCommand_cut);   break;
        case 'actionCopy':  requestClipboardPermissions(execCommand_copy);  break;
        case 'actionPaste': requestClipboardPermissions(execCommand_paste); break;

        case 'actionCollapseExpand': treeView.togleCollapsedStateOfCursoredNode(); break;
        case 'actionEdit':           treeView.editCurrentNodeNote();               break;
        case 'actionSaveClose':      treeView.saveCloseCurrentNode();              break;
        case 'actionDelete':         treeView.deleteCurrentNode();                 break;
        case 'actionRestore':        treeView.activateCurrentNode(false);          break;
        case 'actionAltRestore':     treeView.activateCurrentNode(true);           break;

        case 'actionInsNoteAsParent':       treeView.addNoteAsParentOfCurrentNode();       break;
        case 'actionInsNoteAsFirstSubnode': treeView.addNoteAsFirstSubnodeOfCurrentNode(); break;
        case 'actionInsNoteAsLastSubnode':  treeView.addNoteAsLastSubnodeOfCurrentNode();  break;
        case 'actionAddNoteAbove':          treeView.addNoteAsPrevSiblingOfCurrentNode();  break;
        case 'actionAddNoteBelove':         treeView.addNoteAsNextSiblingOfCurrentNode();  break;
        case 'actionAddNoteAtTheEndOfTree': treeView.addNoteAtTheEndOfTree();              break;

        case 'actionAddGroupAbove':         treeView.actionAddGroupAbove();     break;
        case 'actionAddSeparatorBelove':    treeView.actionAddSeparatorBelove(); break;


        case 'actionMoveRight': treeView.moveCurrentNode_levelUp();                   break;
        case 'actionMoveLeft':  treeView.moveCurrentNode_levelDown();                 break;
        case 'actionMoveUp':    treeView.moveCurrentNode_up();                        break;
        case 'actionMoveDown':  treeView.moveCurrentNode_down();                      break;
        case 'actionMoveHome':  treeView.moveCurrentNode_asFirstSiblingInSameLevel(); break;
        case 'actionMoveEnd':   treeView.moveCurrentNode_asLastSiblingInSameLevel();  break;

        case 'actionFlattenTabsHierarchy':     treeView.actionFlattenTabsHierarchy();     break;
        case 'actionMoveWindowToTheEndOfTree': treeView.actionMoveWindowToTheEndOfTree(); break;

        case 'actionOpenLinkInNewWindow':     treeView.actionOpenLinkInNewWindow(); break;
        case 'actionOpenLinkInNewTab':        treeView.actionOpenLinkInNewTab();  break;

        case 'actionPrint':  actionPrint(); break;
        //case 'actionSearch': actionsSearch(); break;

        //case 'actionExportAsHtml':       actionExport(); break;
        //case 'actionImportHtml':         actionImport(); break;
        //case 'actionOneClickSwitchMode': actionTogleOneClickMode(); break;
    }
}
function window_onkeydown(event) {
    //console.log(event, event.keyIdentifier);

    if( treeView.isModalUiElementsActive(event) ) return; // Это нужно для всех клавиш но самый паршивый баг случался после нажатия Enter в edit диалоге,
                                                  // при этом опять вызывался edit, но он на экран не показывался, так как его успевал погасить
                                                  // обработчик enter edit диалога который срабатывал позже этого обработчика.
                                                  // но при этом листенеры edit диалога оставались висеть добавленными и был на самом деле режим редактирования

    // Context:
    //   Tree navigation
    //   Node editing
    //   ? Icons editing
    // Хотя вобщемто эти контексты просто должны вызывать preventDefault & stopPropagation когда сами перехватывают клаву и активируются

    // keyCode is deprecated, it is suggested to use event.key - but event.key is not implemented on latest Firefox, so it is stupid suggestion actually
    // Note some othere useful event properties:
    // keyLocation (numpad:3, left/right side of the keyboard)
    // keyIdentifier
    // metaKey (for mac)
    // which - something OS depended, and is always same as keyCode, but..
    // Example:
    //    keyCode: 13
    //    keyIdentifier: "Enter"
    //    keyLocation: 3 - numpad
    //
    //    keyCode: 13
    //    keyIdentifier: "Enter"
    //    keyLocation: 0 - main
    //
    //    keyCode: 113
    //    keyIdentifier: "F2"
    //    keyLocation: 0
    switch(event.keyCode){
        case 107/*keypad, keylocation:3*/: case 187/*regular, keylocation:0*/: /* + */
        case 109/*keypad, keylocation:3*/: case 189/*regular, keylocation:0*/: /* - */
        if(!event.ctrlKey && !event.metaKey) { // To not brake default browser Zoom controls (on MAC it's CMD-+/-)
            treeView.togleCollapsedStateOfCursoredNode();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 33: // page up
        treeView.moveCursor_pageUp();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 34: // page down
        treeView.moveCursor_pageDown();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 36: // home
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_asFirstSiblingInSameLevel();
        else
            ifLite_goPro() || treeView.moveCursor_toFirstSiblingInSameLevel();
        event.preventDefault();
        event.stopPropagation();
        break;


        case 35: // end
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_asLastSiblingInSameLevel();
        else
            ifLite_goPro() || treeView.moveCursor_toLastSiblingInSameLevel();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 37: // arrow left
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_levelDown();
        else
            ifLite_goPro() || treeView.moveCursor_toParent_butNotToRoot();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 39: // arrow right
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_levelUp();
        else
            ifLite_goPro() || treeView.moveCursor_toFirstSubnode();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 38: // arrow up
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_up();
        else
            treeView.moveCursor_up(event.altKey);
        event.preventDefault();
        event.stopPropagation();
        break;

        case 40: // arrow down
        if(event.ctrlKey)
            ifLite_goPro() || treeView.moveCurrentNode_down();
        else
            treeView.moveCursor_down(event.altKey);
        event.preventDefault();
        event.stopPropagation();
        break;

        case 9:  // tab
        if(event.shiftKey) // Буду расписывать учесть что в каждую из веток должно пасть event.xxxx() & break
            ifLite_goPro() || treeView.moveCurrentNode_levelDown();
        else
            ifLite_goPro() || treeView.moveCurrentNode_levelUp();
        event.preventDefault();
        event.stopPropagation();
        break;

        //----------------------------------

        case 32:  // space
        ifLite_goPro() || treeView.activateCurrentNode(event.altKey);
        event.preventDefault(); // space by default scrolls view
        event.stopPropagation();
        break;

        case  13:  // Enter - both - numpad and main (they differs by keyLocation propertie)
        if(event.shiftKey && (event.altKey || event.ctrlKey))
            ifLite_goPro() || treeView.addNoteAsParentOfCurrentNode();       //Shift-Ctrl-Enter or Shift-Alt-Enter
        else if(event.altKey || event.ctrlKey)
            ifLite_goPro() || treeView.addNoteAtTheEndOfTree();              //Ctrl-Enter or Alt-Enter
        else if(event.shiftKey)
            ifLite_goPro() || treeView.addNoteAsPrevSiblingOfCurrentNode();  //Shift-Enter
        else
            ifLite_goPro() || treeView.addNoteAsNextSiblingOfCurrentNode();  //Enter
        event.preventDefault();
        event.stopPropagation();
        break;

        case 45:  // insert
        if(event.shiftKey)
            ifLite_goPro() || treeView.addNoteAsParentOfCurrentNode();           //Shift-Ins
        else {
            if(event.altKey || event.ctrlKey)
                ifLite_goPro() || treeView.addNoteAsFirstSubnodeOfCurrentNode(); //Ctrl-Ins or Alt-Ins
            else
                ifLite_goPro() || treeView.addNoteAsLastSubnodeOfCurrentNode();  //Ins
        }
        event.preventDefault();
        event.stopPropagation();
        break;

        case 113:  // F2
        ifLite_goPro() || treeView.editCurrentNodeNote();
        event.preventDefault();
        event.stopImmediatePropagation(); // Or edit dialog will catch the Enter key. Хотя он там event listeners вешает в setTimeout (тоесть вне этого even обработчика) и это уже не актально, но пусть будет
        break;


        case 8:   // backspace
        ifLite_goPro() || treeView.saveCloseCurrentNode();
        event.preventDefault(); // Or it will perform Back action
        event.stopPropagation();
        break;

        case 46:  // delete
        if(event.altKey)
            ifLite_goPro() || treeView.saveCloseCurrentNode(); //Alt-Del
        else
            ifLite_goPro() || treeView.deleteCurrentNode(); //Del
        event.preventDefault();
        event.stopPropagation();
        break;

        case 191: case 111/*keypad*/: // /
        ifLite_goPro() || treeView.actionFlattenTabsHierarchy();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 69: // E
        ifLite_goPro() || treeView.actionMoveWindowToTheEndOfTree();
        event.preventDefault();
        event.stopPropagation();
        break;

        case 87:  // W
        if(!event.altKey && !event.ctrlKey && !event.metaKey) { // CMD/Ctrl-W is a default shortcut for window close, Alt-W is our shortcut for save&close we must not catch them
            ifLite_goPro() || scrollUpToNextOpenWindow();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 83:  // S
        if(!event.ctrlKey && !event.metaKey) { // Ctrl-S пропускаем
            ifLite_goPro() || undoScroll();
            event.preventDefault();
            event.stopPropagation();
        }
        break;


        case 67:  // C
        if(!event.ctrlKey && !event.metaKey) { // Ctrl-C пропускаем
            ifLite_goPro() || cloneView();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 81:  // Q
        if(!event.ctrlKey && !event.metaKey) { // Ctrl/CMD-Q - is the default Chrome close shortcut
            ifLite_goPro() || closeAllOpenWindows();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 80: // P
        if(event.ctrlKey || event.metaKey) { //Ctrl-P
            actionPrint();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 66: // B
        if(event.ctrlKey)  { //Ctrl-B
            ifLite_goPro() || backupNow(); //Ctrl-B
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 71: // G
        if(event.shiftKey) { //Shift-G
            ifLite_goPro() || treeView.actionAddGroupAbove();
            event.preventDefault();
            event.stopPropagation();
        }
        break;

        case 76: //L
        ifLite_goPro() || treeView.actionAddSeparatorBelove();
        event.preventDefault();
        event.stopPropagation();
        break;


        default:
        break; // do not block other keys
    }
}

function getEmptyCustomStyleshit() {
    var customStyleshitId = 'usersCustomColorsStyleshit';

	var alreadyPlacedCustomStyleshit = document.getElementById(customStyleshitId);
    if(alreadyPlacedCustomStyleshit) alreadyPlacedCustomStyleshit.parentNode.removeChild(alreadyPlacedCustomStyleshit);

    var styleshit = document.createElement("style");
    styleshit.id = customStyleshitId;

	// Add a media (and/or media query) here if you'd like!
	// style.setAttribute("media", "screen")
	// style.setAttribute("media", "only screen and (max-width : 1024px)")

	// WebKit hack :( - not sure if they needed actualy, not tested without
	styleshit.appendChild(document.createTextNode(""));

    // Add the <style> element to the page
    // .sheet property will be created only after that!
   	document.head.appendChild(styleshit);

	return styleshit.sheet;
}

function applyCustomUserStyles() {
    // TODO this is slightly ineficient as we alway regenerate and reaply complete styleshit, even if there was no changes at all

    //var styleshit = document.styleSheets[0]
    var styleshit = getEmptyCustomStyleshit();

    if(localStorage['experimentalLightBackground']) {
        styleshit.addRule('#ID_activeSessionTreeScrollableContainer','background-image: url(tree/img/backgrounds/wavecut.png);');
        styleshit.addRule('::-webkit-scrollbar-track','background-image: url(tree/img/backgrounds/wavecut.png);');
        styleshit.addRule('.tabNTC','color: black;');
        styleshit.addRule('.collapsedNodesInfo','color: black;');
        styleshit.addRule('.textnote_text','color: #009C6A;');
        styleshit.addRule('.tab_comment','color: #009C6A;');
    }
    if(localStorage['overrideSavedTabColor'])
        styleshit.addRule('.savedtab_text','color: '+localStorage['savedTabTextColor'] + ';');
    if(localStorage['overrideOpenTabColor'])
        styleshit.addRule('.tabNTC','color: '+localStorage['openTabTextColor'] + ';');
    if(localStorage['overrideCurrentTabColor'])
        styleshit.addRule('.selectedtab.tabNTC','color: '+localStorage['currentTabTextColor'] + ';');
    if(localStorage['overrideNoteTextColor']) {
        styleshit.addRule('.textnote_text','color: '+localStorage['noteTextColor'] + ';');
        styleshit.addRule('.tab_comment','color: '+localStorage['noteTextColor'] + ';');
    }
}

function prepareDomForSavedAsHtmlMode() {
    document.title = "Tabs Outliner Window Saved As Html File"; //i18n;
    document.getElementById("mainToolbar").style.display="none";
    document.styleSheets[0].addRule('a:hover','text-decoration: underline; cursor:pointer;');
    document.styleSheets[0].addRule('.node_text','cursor: auto;');

    makeAllElementsDragable();
    replaceChromeFaviconUrls();
}



//function finishInitializing(){
//    //enablePossibilityToScrollLastWindowTitleToFirstVisibleLine(); // пересчёт размеров scrollToLastNodeCompensator
//    if(performOperationOnLoadComplete) {
//        performOperationOnLoadComplete(); // Это скрол к ноде обычно (точнее только)
//        performOperationOnLoadComplete = null;
//    }
//    else {
//        window.scrollTo(0,
//                window.document.documentElement.scrollHeight
//                - window.innerHeight
//                - scrollToLastNodeCompensator.style.pixelHeight
//                + document.getElementById("mainToolbar").offsetHeight);  /*случай для clonedView - скроляемся в конец*/
//
//        console.log( window.document.documentElement.scrollHeight - window.innerHeight - scrollToLastNodeCompensator.style.pixelHeight + document.getElementById("mainToolbar").offsetHeight,
//                window.document.documentElement.scrollHeight,
//                window.innerHeight,
//                scrollToLastNodeCompensator.style.pixelHeight,
//                document.getElementById("mainToolbar").offsetHeight);
//    }
//
//}

//winunload_onbeforeunload_start: ""2013-04-08T22:28:13.255Z""
//winunload_onpagehide_start:     ""2013-04-08T22:28:13.256Z""
//window.onpagehide = function(e) {
//    window.localStorage['winunload_onpagehide_start'] = JSON.stringify( new Date() );
//};

window.onbeforeunload = function(e) {
    // Если это последнее окно у нас тут есть целая секунда !!!!!!!! "1113" Правда диалог это уже не покажет, закроет всёравно. но нам и не надо.
    // А если это не последнее окон то оно может ебошить кико угодно! Правда бекграунд страница при этом тоже блоконётся.

    if( getUrlVars()['type'] == 'main' )
        localStorage['MainViewLastClosedPos'] = JSON.stringify({'x':window.screenX,'y':window.screenY,'w':window.outerWidth,'h':window.outerHeight, 'iw':window.innerWidth, 'ih':window.innerHeight});

    backgroundport.postMessage({request:"request2bkg_onViewWindowBeforeUnload_saveNow"});
};

window.onunload = function() {
    elementFocusedWhenMainToolbarHovered = null;
    performOperationOnLoadComplete = null;
    //treeView.treeModel.deleteDeadObservers(window.document, treeView);

    // всё что ниже похоже никакого эфекта не даёт. Хотя это и странно. ------------------
    treeView.deleteAllMembers(window);
    treeView = null;
    window.document.body.innerHTML = "";
    let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");
    while (activeSessionTreeScrollableContainer.hasChildNodes()) {
        activeSessionTreeScrollableContainer.removeChild(activeSessionTreeScrollableContainer.lastChild);
    }
    activeSessionTreeScrollableContainer = null;
    scrollToLastNodeCompensator = null;
    window.onload = null;
    window.onbeforeunload = null;
    window.onunload = null;
    window.removeEventListener('resize', Global_onResize_UpdateScrollToLastNodeCompensator);
    undoExpandAllNodesList = null;

    localStorage['MainViewLastClosedTime'] = Date.now();
};


function doScrollAndSetIsAutoscrollViewOnReadyAndShowHelpBlock() {
    var urlVars = getUrlVars();
    if(urlVars['type'] == 'clone') {
        scrollToDefaultPageOffestForClonedViewsOnInitialOpen( parseInt(urlVars['yo']) );

        backgroundport.postMessage({request:"request2bkg_setCursorToLastChildOfRoot"});
    }

    if(urlVars['type'] == 'main') {
        window.isAutoscrollView = true;
        selectTreeNodePlusScrollToNodeOnBrowserActionBtnClick(urlVars['focusNodeId'], urlVars['altFocusNodeId'], urlVars['scrollToViewWinId']);

        if(!localStorage["doNotShowHelpBlockOnStartV2"]) showHelpBlock(false);
    }
}

console.timeEnd("SessionView TreeGenerationTime");

//console.time("SessionView TimeAfterTreeDoneTillDOMContentLoadedFire (+)");
//console.time("SessionView TimeAfterTreeDoneTillOnloadFire (+)");
//console.time("SessionView TimeAfterTreeDoneTillOnResizeFire (+)");

// Раньше не всегда срабатывал скрол к последней ноде, особенно при первом старте
// Не доказано но есть теория что это из-за того что мы делали дерево в window.onload и тамже сразу выполняли скрол, при этом возможно дерево ещё не успевало зарендерится правильно
// а размеры посчитаться

// document.addEventListener( "DOMContentLoaded" стартует мгновенно после окончания html
// а window.onload сильно позже, если 10000 узлов то и на пару секунд позже, он ждёт загрузки всех внешних стайлшитов, внешних скриптов и всех внешних картинок!!!
// в document.addEventListener( "DOMContentLoaded" обычно нет никаких размеров ещё, особенно window.innerHeight (хотя document.body.clientHeight уже есть), поэтому он для скролинга довольно бесполезен
// Интересно что первый onresize приходит сильно быстрее window.onload и там нет глюков с неустановленными размерами окна
// window.onload = onLoad;
// function onLoad() {
//     window.onload = null;
//     // console.timeEnd("SessionView TimeAfterTreeDoneTillOnloadFire (+)");
//     // console.log("window.onload: w, db, dd:",window.innerHeight, document.body.clientHeight, document.documentElement.clientHeight);

//     //TODO плохо это делать в onload возможно, висит окно на старте с уже построенным деревом какоето время и чегото там ждет, возможно загрузок всех картинок и чегото там еще (css стилей и т.д.)
//     doScrollAndSetIsAutoscrollViewOnReadyAndShowHelpBlock(); // Я когдато дублировал это ещё и в первом onResize, смотри все коменты ниже

//     /* Нижеследующий комент уже не актуален но оставлен тут для истории:
//         // Вызываю и тут и в onFirstResize, и похоже это самый надёжный способ (надёжный для чего?) что я нашол пока. Бо на 10000 дереве онресайз не вызывается вообще и
//         // main окно не получает статус автоскролера, а в клозуред билде в onload почемуто не всё хорошо с window.innerHeight... да и ваще...
//         // кстате document.body.clientHeight тут и в onresize разнятся
//     */
// }

/*Закоменчено. Потому что толи в новом хроме это больше не проблема, толи что
  но суть такая что это тока генерило мне баг с тем что при ресайзе (когда юзер хочет дляинные табы глянуть) у меня прыгало окно (скролилось) назад
  а зачем вообще был нужен этот фрагмент ща загадка

  Вобще главной проблемой насколько я припоминаю было то что окно не успевало получить статус автоскролера к тому моменту как ему бекграунд страница фаерила
  текущий таб. Поэтому я пытался это решить подвязавшись на все методы
  Но счас это через другие каналы вобщем идёт и всё успевается. короче не уверен, но вроде всё пашет отлично.

  Ещё одной нехорошой причиной могло быть то что onresize может приходить раньше чем onload!!!
  и возможно обычный обработчик on resize тогда страшно глюкался так как для него  не выставлены какието важные параметры.
  Но счас всё работает точно в этом плане - проверено

    // Невероятно, но onResize приходит сильно раньше windows.onload и там гарантировано посчитаны размеры правильно windows.innerHeight (чего не всегда в window.onload происходит,
    // особенно в closured билде в clone view !),
    // как это возможно не помойму, но факт
    // catch first resize - this will guarantee all window.innerHeight to be successfully calculated, so we can do programmatic scrolls
    // Одна вот тока проблема.... иногда это вообще не срабатыват, особенно на моём 10000 дереве
    //window.addEventListener('resize', onFirstResize, false );
    //function onFirstResize() {
    //    window.removeEventListener( "resize", onFirstResize, false );
    //
    //    console.timeEnd("SessionView TimeAfterTreeDoneTillOnResizeFire (+)");
    //    console.log("resize: w, db, dd:",window.innerHeight, document.body.clientHeight, document.documentElement.clientHeight);
    //    doScrollAndSetIsAutoscrollViewOnReadyAndShowHelpBlock();
    //}
*/

// if window.onload used window.innerHeight is not available sometime, so its not possible to correctly scroll tree to the end
//document.addEventListener( "DOMContentLoaded", function(){
//    document.removeEventListener( "DOMContentLoaded", arguments.callee, false );
//
//    console.timeEnd("SessionView TimeAfterTreeDoneTillDOMContentLoadedFire (+)");
//    console.log("DOMContentLoaded: w, db, dd:",window.innerHeight, document.body.clientHeight, document.documentElement.clientHeight);
//}, false );

// Help block functionality --------------------------------------------------------------------------------------------
var HELP_BLOCK_ELEMENT_ID = 'helpBlock';
function createHelpBlock() {
    var r = document.createElement("div");
    r.id = HELP_BLOCK_ELEMENT_ID;
    r.innerHTML = window['helpBlockHtmlContent'];
    return r;
}

function onChange_doNotShowHelpBlockOnStartV2() {
    if(this.checked) localStorage['doNotShowHelpBlockOnStartV2'] = 'true';
    else             delete localStorage['doNotShowHelpBlockOnStartV2'];
}

function hideHelpBlock() {
    var helpBlock = document.getElementById(HELP_BLOCK_ELEMENT_ID);
    if(helpBlock) helpBlock.parentElement.removeChild(helpBlock);
}
window['hideHelpBlock'] = hideHelpBlock;

function showHelpBlock(scrollIntoView) {
    var helpBlock = document.getElementById(HELP_BLOCK_ELEMENT_ID);
    if(!helpBlock) {
        helpBlock = createHelpBlock();
        let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");
        activeSessionTreeScrollableContainer.insertBefore(helpBlock, scrollToLastNodeCompensator);
    }

    document.getElementById('doNotShowHelpBlockOnStartV2').checked = !!localStorage['doNotShowHelpBlockOnStartV2'];

    document.getElementById("printFriendlyBtn").onclick = onPrintClick;
    document.getElementById("hideHelpBtn").onclick = hideHelpBlock;
    document.getElementById("doNotShowHelpBlockOnStartV2").onchange = onChange_doNotShowHelpBlockOnStartV2;

    var colapsibleBlocks = helpBlock.getElementsByClassName("toggleHlpBlock");
    for (var i = 0; i < colapsibleBlocks.length; ++i) {
        var elem = colapsibleBlocks[i];  // Calling myNodeList.item(i) isn't necessary in JavaScript
        elem.onclick = onclick_toggleHlpBlock;
    }

    if(scrollIntoView) {
        helpBlock.scrollIntoView();
        window.scrollTo(0, window.pageYOffset - 120);
    }
}
function onHelpClick() {
    showHelpBlock(true);
}

window['onPrintClick'] = function() {
    var helpWindow = window.open('help.html','_blank','height=1000,width=800, left=300, top=0');
    helpWindow.onload = onHelpWindowLoaded;
};

function onHelpWindowLoaded() {
    var helpBlock = createHelpBlock();

    this.document.body.appendChild(helpBlock);

    // Без этого кода ниже, если сразу вызвать this.print() печатает без картинок
    var imges = this.document.querySelectorAll('img');
    var img = imges[imges.length-1];

    function loaded(event) {
        event.target.ownerDocument.defaultView.print();
    }

    if (img.complete) {
      loaded();
    } else {
      img.addEventListener('load', loaded);
      img.addEventListener('error', loaded);
    }
}

function onclick_toggleHlpBlock() {
    var controlelement = this;

	var bodyelement = document.getElementById(controlelement.id+"-body");

	if(bodyelement.offsetHeight == 0)
	{
		// Expand
    	bodyelement.style.height = bodyelement.firstChild.offsetHeight+"px";

		controlelement.classList.add("expanded");
		controlelement.classList.remove("collapsed");

        bodyelement.addEventListener("webkitTransitionEnd", onExpandTransitionEnd /*must be same as in Expand!*/, false );
  	}
	else
	{   // Close
		bodyelement.classList.add("block_body_collapsed");
		bodyelement.classList.remove("block_body_expanded");
    	bodyelement.style.height = "";
		controlelement.classList.remove("expanded");
		controlelement.classList.add("collapsed");
	}
}

function onExpandTransitionEnd()
{
	this.removeEventListener("webkitTransitionEnd", onExpandTransitionEnd );
	var isExpanded = parseInt(this.style.height) != 0; // parseInt to trim "px", "em", "%", ... sufixes

	if(isExpanded) {
		this.classList.add("block_body_expanded");
		this.classList.remove("block_body_collapsed");
		this.style.height = "";
	}
}



// ---------------------------------------------------------------------------------------------------------------------
// Functions wich support drags from saved as HTML tree // Copied from HTML on move to manifest 2
function replaceChromeFaviconUrls() {
    var images = document.images;
    for (var i = 0; i < images.length; i++){
        var imgsrc = images[i].dataset['nodeIconForHtmlExport'];
        if(imgsrc) images[i].src = imgsrc;
    }
}

//function scheduleDefferedIconsLoading() {
//    setTimeout( function loadNextPorcia() {
//        var porcia = 300; // 300 - примерно 50ms на моей машине, 1000 - 143.000ms
//        var foundCount = loadAllDefferedIcons(porcia);
//        if(foundCount >= porcia) scheduleDefferedIconsLoading();
//    }, 50 );
//}
//
function loadAllDefferedIcons(max) {
    var images = document.images;
    var count = 0;
    for (var i = images.length-1; i >= 0; i--){
        var imgsrc = images[i].dataset['iconSrcDefferedLoad'];
        if(imgsrc) {
            images[i].src = imgsrc;
            delete images[i].dataset['iconSrcDefferedLoad'];
            count++;
            if(count >= max) break;
        }
    }

    return count;
}

// LOAD VISIBLE ICONS --------------------------------------------------------------------------------------------------------------
// Happens before scroll redraw on mobile phones - so can be used for quickly paint favicons on mobile phones
//addEventListener('touchstart', zzz, false);
//addEventListener('touchmove', zzz, false);
//function zzz(e) {
//    console.log('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
//    e.preventDefault();
//    e.stopImmediatePropagation();
//}

setTimeout( function() { // Отложено просто потому что когда мы ещё исполняем это body размеры DOM елементов не посчитаны скорее всего, возможно они не будут посчитаны и позже, но пофиг
    // addEventListener('DOMContentLoaded', loadVisibleIcons, false);
    // addEventListener('load', loadVisibleIcons, false);
    addEventListener('scroll', loadVisibleIcons, false);
    addEventListener('resize', loadVisibleIcons, false);
    loadVisibleIcons();
}, 1500 );


//var loadVisibleIcons_defferingTimer = 0;
//function loadVisibleIcons_collectEvents() {
//    clearTimeout(loadVisibleIcons_defferingTimer);
//    loadVisibleIcons_defferingTimer = setTimeout(loadVisibleIcons, 200);
//}

var favIconSourceDatasetName = (window.location.href.indexOf('activesessionview.html') < 0) ? 'nodeIconForHtmlExport' : 'iconSrcDefferedLoad';

function loadVisibleIcons() {
    //console.time('loadVisibleIcons');

    var visibleFavicons = getVisibleFavicons();

    var requestedCount = 0;

    //console.time('processVisible');
    for(var i = 0; i < visibleFavicons.length; i++ ){
        var visibleFavicon = visibleFavicons[i];

        var imgsrc = visibleFavicon.dataset[favIconSourceDatasetName];
        if(imgsrc && visibleFavicon.src != imgsrc) {
            visibleFavicon.src = imgsrc;
            requestedCount++;
        }
    }
    //console.timeEnd('processVisible'); // 0-10ms
    //console.log('requestedCount',requestedCount);

    //console.timeEnd('loadVisibleIcons');
    // TODO Sometimes i have loadVisibleIcons: 115.000ms - for unknown reason - need more log output

}

var lastVisibleImageIndex = -1;
function getVisibleFavicons() {
    // console.time('getImages');
    var images = document.images;
    // var images = document.querySelectorAll('img.node_favicon'); //8ms vs 0ms for document.images;
    // console.timeEnd('getImages'); // Oms

    // console.time('getVisible');
    var visibleImages = [];

    // 3 цикла для ускорения обхода. Шагаем с низу 20 кратными шагами, а потом от первой найденной видимой вверх и вниз
    // по масиву бежим. Масив хранит картинки теоретически в порядке их следования
    // Ускорение огромно, для 23000 с 90ms до 0ms внизу и 15 ms вверху
    // эти 15 ms тоже можно ускорить. если перейти на бинарный поиск... вообще за 15 взятий можно найти
    // for(var i = images.length-1; i >=0; i-=20)
    //    if(isElementVerticalProjectionInViewport(images[i])) break;

    // и надо бы перейти, так как с +20 мы можем пролететь в случае длинного текстового блока когда на экране всего
    // <20 иконок

    // перешли... теперь стабильно 4ms, но алгоритм "более правильный", и не имеет "слепых зон"


    var i;
    var maxIndex = images.length-1;
    if(maxIndex<0) return [];

    // lastVisibleImageIndex юзаем для более быстрого нахождения видимого фрагмента при скроле.
    // реально на 2ms ускоряет (в результате с 4.23ms до 2.52ms вся процедура ускоряется на скроле, в среднем)
    // Хотя и не совсем понятно почему, бо вобщемто там максимум 10 попыток нахождения делалось этим бинарным поиском
    if(lastVisibleImageIndex < 0 || lastVisibleImageIndex >= images.length) lastVisibleImageIndex = maxIndex >> 1;
    var beg_index_end = [0, lastVisibleImageIndex, maxIndex];

    var preventHalt = 32; // Наступает когда картинок ваще нет
    while(--preventHalt > 0) {
        i = beg_index_end[1];
        beg_index_end = getNextSearchIntervalForVisibleElement(images[i], beg_index_end); // TODO ой там надо бы подумать чо творится с крайними значениями и вырожденными случаями.
        if(!beg_index_end) break;
    }
    // - лишний вызов getClientRect
    // - надо юзать не maxIndex / 2 а прошлое успешное значение, но токо если оно в промежутке



    for(var up = i; up >=0; up--) { // Добавляем всех видимых сверху до первой невидимой
        if(!isElementVerticalProjectionInViewport(images[up])) break;
        else visibleImages.push(images[up]);
    }

    for(var dn = i+1; dn < images.length; dn++) { // Добавляем всех видимых снизу до первой невидимой
        if(!isElementVerticalProjectionInViewport(images[dn])) break;
        else visibleImages.push(images[dn]);
    }

    lastVisibleImageIndex = up + ((dn-up) >> 2); // Делим на 4 бо скролл вверх более частая операция, и более вероятно что середина уйдёт вниз слишком,
                                                 // и бинарный поиск тогда запустится по полной, а верхняя четверть таки будет видна на следующем скроле

    // Запрашиваем ещё по 15 картинок вверх и в низ, чтоб не так мигали квадраты при скроле (совершенно не влияет на скорость и намного лучше выглядит)
    for(var up2 = up; up2 >=0 && (up-up2) <= 20; up2--)
        visibleImages.push(images[up2]);


    for(var dn2 = dn; dn2 < images.length && (dn2-dn) <= 20; dn2++)
        visibleImages.push(images[dn2]);


    // console.timeEnd('getVisible'); // For direct iteration 90ms for 23000 nodes (just the iteration took 12-14ms)
                                   // Dbn with new algorith it's much fater

    return visibleImages;
}

// It is utterly important that you attach your image position determining process on document load event and not
// the usually use DOM ready, because you have to wait for the document to load in order for your images to have
// final positions.
function isElementVerticalProjectionInViewport (el) {
    if(!el) return false;

    var rect = el.getBoundingClientRect(); // TODO I must use this everywhere instead of traversion the DOM tree and add el.offsetXxx; as they are buggy (in some browsers) and slow
    var elHeight = (rect.bottom-rect.top);
    var viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
    return (
        rect.top >= 0 - elHeight // was 0, but this will create empty elements ot top
        // && rect.left >= 0
        && rect.bottom <= viewportHeight + elHeight /*or $(window).height() */
        // && rect.right <= (window.innerWidth || document.documentElement.clientWidth) /*or $(window).width() */
    );
}
function getNextSearchIntervalForVisibleElement (el, beg_index_end) {
    var beg = beg_index_end[0];
    var index = beg_index_end[1];
    var end = beg_index_end[2];
    var rect = el.getBoundingClientRect(); // TODO I must use this everywhere instead of traversion the DOM tree and add el.offsetXxx; as they are buggy (in some browsers) and slow
    var elHeight = (rect.bottom-rect.top);
    var viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
    if( rect.bottom < (0 - elHeight) )           return [index, index + ((end-index) >> 1), end]; // Вьюпорт ниже чем мы
    if( rect.top > (viewportHeight + elHeight) ) return [beg,   beg + ((index-beg) >> 1), index]; // Вьюпорт выше чем мы
    return null;
}
// --------------------------------------------------------------------------------------------------------------

function makeAllElementsDragable() {
    var nodes = document.getElementsByTagName("li");
    for (var i = 0; i < nodes.length; i++)
         nodes[i].ondragstart = linodes_ondragstart;
}

function linodes_filterOutFavIconsInHtml(htmlText){
    return htmlText.replace(/<img[^>]*>/g, '');
}

function linodes_classListToInterchangeType(nodeTitleEl) {
    if( nodeTitleEl.classList.contains("winNTC") )           return 'savedwin_';
    if( nodeTitleEl.classList.contains("savedwinNTC") )      return 'savedwin_';
    if( nodeTitleEl.classList.contains("tabNTC") )           return 'link_';
    if( nodeTitleEl.classList.contains("savedtabNTC") )      return 'link_';
    if( nodeTitleEl.classList.contains("groupNTC") )         return 'group_';
    if( nodeTitleEl.classList.contains("separatorlineNTC") ) return 'separator_';
    if( nodeTitleEl.classList.contains("textnoteNTC") )      return 'textline_';

    return '?';
}

// { type:'textline_', title:innerHTML,                       subnodes:[] }
// { type:'link_',     title:innerHTML, url:nodeTitleEl.href, subnodes:[] }
function linodes_convertDomElementToInterchangeJsonObj(nodeDomObj) {
    var r = {};
    var nodeTitleEl    = nodeDomObj.querySelector('.nodeTitleContainer');
    if(nodeTitleEl) {
        r['type'] = linodes_classListToInterchangeType(nodeTitleEl);

        var node_textEl = nodeTitleEl.querySelector('.node_text');
        if(node_textEl) r['title'] = node_textEl.innerHTML;

        if(nodeTitleEl.href) r['url'] = nodeTitleEl.href;
    }
    var nodeSubnodesEl = nodeDomObj.querySelector('.subnodeslist');
    if(nodeSubnodesEl) {
        r['subnodes'] = [];
        for(var i=0; i < nodeSubnodesEl.childNodes.length; i++)
            r['subnodes'].push( linodes_convertDomElementToInterchangeJsonObj(nodeSubnodesEl.childNodes[i]) );
    }

    return r;
}

function linodes_convertToInterchangeJson(nodeDomObj) {
    var r = linodes_convertDomElementToInterchangeJsonObj(nodeDomObj);

    return JSON.stringify(r);
}

// TODO это частичный C&P с treeview.js
function linodes_ondragstart(event) {
    //console.log("modelid:" + this._ref_nodeModel.id + " ondragstart");
    event.stopPropagation(); // without this event will buble up through all our parent and their ondragstart

    try{
    //event.dataTransfer.setData('text/uri-list', '#'+this._ref_nodeModel.getNodeText() +'\n'+this._ref_nodeModel.getHref());
    event.dataTransfer.setData('text/html', TO_DD_HTML_INTERCHANGE_BEG + linodes_convertToInterchangeJson(this) + TO_DD_HTML_INTERCHANGE_END + linodes_filterOutFavIconsInHtml(this.outerHTML));
    //event.dataTransfer.setData('text/plain', this._ref_nodeModel.getNodeText() + ' ('+this._ref_nodeModel.getHref()+')');
    //event.dataTransfer.setData('text/x-moz-url', this._ref_nodeModel.getNodeText() +'\n'+this._ref_nodeModel.getHref() ); // Must go before text/uri-list
    // event.dataTransfer.setData("application/x-tabsoutliner-items", "test"); // already work in Chrome
    } catch(e) {console.error(e)}

    return true; // Run default implementation, they will do nice drag feedback picture. Anyway we must return true as drag will not start if we will return false.
}

function setTrialMode() {
    window['isContextMenuGoProBanerVisible'] = true;
    window['isKeysAndcontextMenuActionsEnabled'] = false;
}


function setProMode() {
    window['isContextMenuGoProBanerVisible'] = false;
    window['isKeysAndcontextMenuActionsEnabled'] = true;
}

function msg2view_optionsChanged_message(response) {
    let changedOption = response.changedOption;

    switch(changedOption)  {
        case 'showBackupNowBtn': setBackupNowBtnVisibility();
                                 break;

        case 'colors':           applyCustomUserStyles();
                                 break;

        case 'oneClickToOpen':   location.reload();
                                 break;

    }
};

function setBackupNowBtnVisibility() {
    document.getElementById('backupNowButton').style.display = localStorage['showBackupNowBtn'] ? '' : 'none';
}

setBackupNowBtnVisibility();

var backupOperationId_;
function backupNow() {
    ifLite_goPro() || backgroundport.postMessage({request:"request2bkg_performGdriveBackup", backupOperationId_:Math.random()}); // performGdriveBackup() will call backupStarted_backgroundPageCall before connecting and then one more time before starting upload (if no error during connect)
    
    //FF_REMOVED_GA ga_event('Backup Now Button Clicked - Main View - ' + (!!window['isKeysAndcontextMenuActionsEnabled']?'Paid':'NoValidKey') );
}



