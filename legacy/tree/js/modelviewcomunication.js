"use strict"

class NodeModelMVCDataTransferObject {
    constructor(node) {
        this.id = node.idMVC;

        this.idMVC = node.idMVC;
        this.previousIdMVC = node.previousIdMVC;


        this.colapsed               = node.colapsed;

        this.subnodes = [];

        if(!node.colapsed) // Fill subnodes only if node expanded
            node.subnodes.forEach( nodeModel => this.subnodes.push(new NodeModelMVCDataTransferObject(nodeModel)) );

        this.isLink                 = node.isLink;
        this.titleCssClass          = node.titleCssClass;
        this.titleBackgroundCssClass= node.titleBackgroundCssClass;
        this.additionalTextCss      = node.additionalTextCss;

        this.needFaviconAndTextHelperContainer = node.needFaviconAndTextHelperContainer;

        this.marks = {relicons:[]};

        if('getHoveringMenuActions' in node) { //It's a NodeModel class
            this._getCustomTitle              = node.getCustomTitle();
            this._hoveringMenuActions         = node.getHoveringMenuActions(); // там только ключ и action.id его дублирующий юзается в view (hoveringMenuActions[action.id] == action.id или null)
            this._countSubnodesStatsBlockData = node.countSubnodesStatsBlockData();
            this._getIcon                     = node.getIcon();
            this._getIconForHtmlExport        = node.getIconForHtmlExport();
            this._getTooltipText              = node.getTooltipText();
            this._getHref                     = node.getHref();
            this._getNodeText                 = node.getNodeText();
            this._isSelectedTab               = node.isSelectedTab();
            this._isFocusedWindow             = node.isFocusedWindow();
            this._isProtectedFromGoneOnClose  = node.isProtectedFromGoneOnClose();
            this._getNodeContentCssClass      = node.getNodeContentCssClass();
            this._getNodeTextCustomStyle      = node.getNodeTextCustomStyle();
            this._isSubnodesPresent           = node.isSubnodesPresent();
        } else { // It's serialezed to View during message passing plain Object
            this._getCustomTitle              = node._getCustomTitle;
            this._hoveringMenuActions         = node._hoveringMenuActions;
            this._countSubnodesStatsBlockData = node._countSubnodesStatsBlockData;
            this._getIcon                     = node._getIcon;
            this._getIconForHtmlExport        = node._getIconForHtmlExport;
            this._getTooltipText              = node._getTooltipText;
            this._getHref                     = node._getHref;
            this._getNodeText                 = node._getNodeText;
            this._isSelectedTab               = node._isSelectedTab;
            this._isFocusedWindow             = node._isFocusedWindow;
            this._isProtectedFromGoneOnClose  = node._isProtectedFromGoneOnClose;
            this._getNodeContentCssClass      = node._getNodeContentCssClass;
            this._getNodeTextCustomStyle      = node._getNodeTextCustomStyle;
            this._isSubnodesPresent           = node._isSubnodesPresent;

        }
    }

    getNodeContentCssClass()        { return this._nodeContentCssClass   }
    getHoveringMenuActions()        { return this._hoveringMenuActions  }
    countSubnodesStatsBlockData()   { return this._countSubnodesStatsBlockData }
    getIcon()                       { return this._getIcon }
    getIconForHtmlExport()          { return this._getIconForHtmlExport }
    getTooltipText()                { return this._getTooltipText }
    getHref()                       { return this._getHref }
    getCustomTitle()                { return this._getCustomTitle }
    getNodeText()                   { return this._getNodeText }
    isSelectedTab()                 { return this._isSelectedTab }
    isFocusedWindow()               { return this._isFocusedWindow }
    isProtectedFromGoneOnClose()    { return this._isProtectedFromGoneOnClose }
    getNodeContentCssClass()        { return this._getNodeContentCssClass }
    getNodeTextCustomStyle()        { return this._getNodeTextCustomStyle }
    isSubnodesPresent()             { return this._isSubnodesPresent }

    updateSubnodesInfoForViewAfterChangesInSubnodes(parentUpdateData) {
        this._isSubnodesPresent           = parentUpdateData.isSubnodesPresent;
        this.colapsed                     = parentUpdateData.isCollapsed;
        this._countSubnodesStatsBlockData = parentUpdateData.subnodesStatBlock;
        this._isProtectedFromGoneOnClose  = parentUpdateData.isProtectedFromGoneOnClose;

        this.titleCssClass           = parentUpdateData.titleCssClass;
        this.titleBackgroundCssClass = parentUpdateData.titleBackgroundCssClass;
        this._isSelectedTab          = parentUpdateData._isSelectedTab;
        this._isFocusedWindow        = parentUpdateData._isFocusedWindow;
        this._getNodeContentCssClass = parentUpdateData._getNodeContentCssClass;
    }
}
//kind: "string"
//type: "text/plain"
//
//kind: "string"
//type: "text/uri-list"
//
//kind: "string"
//type: "text/html"
function getItemFromDragDataStoreByMimeType(dataTransfer, mimeType) {
    var items = dataTransfer['items']; // .items become magled by closure compiler, so we need put them in ""
    if(items)
        for(var i = 0; i < items.length; ++i)
            if (items[i]['type'] == mimeType)
                return items[i];

    return null;
}


// =================================================================================================================
// метод задающую общую структуру проверок для onDragEnter и onDrop, только для onDragEnter с его помощью определяет разрешать ли драг, а onDrop строит нужную ей модель ждя вставки
// Важный нюанс, в onDragEnter мы не можем прочитать контент event.dataTransfer с помощью event.dataTransfer.getData (getData возвращает null или пустые строки в onDragEnter).
// мы в onDragEnter только видим какие там mime типы переносятся
function processDragDataStore(dataTransferContainer,
                                instanceUnicalClipboardDataMimeType,
                                handleThisInstanceMimeType,
                                handleTabsOutlinerActionLinkMimeType,
                                handleXTabsOutlinerItemsMimeType,
                                handleUriListMimeType,
                                handleTextPlainMimeType,
                                handleTextHtmlMimeType,
                                handleNoSuitableMimeType) {
    // !!!! Интересный и неочевидный момент,
    // getData возвращает null или пустые строки в onDragEnter,
    // она возвращает данные тока в onDrop
    // а onDrop вызывается только если drop был разрешон
    // For all other events (кроме dragstart & drop). The formats and kinds in the drag data store list of items representing dragged data can be
    // enumerated,
    // !!!!! but the data itself is unavailable and no new data can be added.
    // поэтому я тут юзаю getItemFromDragDataStoreByMimeType() чтоб проверить есть какой майм тип или нет таки

    var r;

    if(        getItemFromDragDataStoreByMimeType(dataTransferContainer, instanceUnicalClipboardDataMimeType) ) {
        r = handleThisInstanceMimeType(dataTransferContainer);
    } else if( getItemFromDragDataStoreByMimeType(dataTransferContainer, 'application/x-tabsoutliner-actionlink') ) {// Драг и дроп инициирован кемто кто нас знает - скорее всего нашими веб страничками
        r = handleTabsOutlinerActionLinkMimeType(dataTransferContainer);
    } else if( getItemFromDragDataStoreByMimeType(dataTransferContainer, 'application/x-tabsoutliner-items') ) {// Драг и дроп инициирован кемто кто нас знает - скорее всего нашими веб страничками
        r = handleXTabsOutlinerItemsMimeType(dataTransferContainer);
    } else if( getItemFromDragDataStoreByMimeType(dataTransferContainer, 'text/uri-list') ) {
        r = handleUriListMimeType(dataTransferContainer);
    } else if( getItemFromDragDataStoreByMimeType(dataTransferContainer, 'text/plain') ) {
        r = handleTextPlainMimeType(dataTransferContainer);
    } else if( getItemFromDragDataStoreByMimeType(dataTransferContainer, 'text/html') ) { // Драги из TabsOutliner засейваных HTML содержат тока 'text/html', без 'text/plain' или 'text/uri-list'
        r = handleTextHtmlMimeType(dataTransferContainer);
    } else {
        r = handleNoSuitableMimeType(dataTransferContainer);
    }

    return r;
}


function makeDragModelFromJson( jsonDataObj, treeModel ) {
    try {
        var actionLinkModelParent =  treeModel[ jsonDataObj['type'] ]();

        if(jsonDataObj['title'] || jsonDataObj['url']) {
            var data = {};
            if(jsonDataObj['title']) data['title'] = jsonDataObj['title'];
            if(jsonDataObj['url'])   data['url']   = jsonDataObj['url'];
            actionLinkModelParent.setDataForNodeConstructor(data);
        }

        if(jsonDataObj['subnodes']) jsonDataObj['subnodes'].forEach( function(jsonDataSubnodeObj) {
            actionLinkModelParent.subnodes.push( makeDragModelFromJson(jsonDataSubnodeObj, treeModel) );
        } );

        return actionLinkModelParent;
    } catch(e) {
        console.error('MakeDragModelFromJson json interchange format parse error', e);
        var errorNote =  treeModel[ 'textline_' ]();
        errorNote.setDataForNodeConstructor("#?????#");

        return errorNote;
    }
}

function makeDragModelFromUriList(dragedUriList, linkText, treeModel) {
    var actionLinkModel = treeModel[ 'link_' ]();
    actionLinkModel.setDataForNodeConstructor({'url':dragedUriList, 'title':linkText});
    return actionLinkModel;
}

function makeDragModelFromText(dragedTextPlain, treeModel) {
    var actionLinkModel = treeModel[ 'textline_' ]();
    actionLinkModel.setDataForNodeConstructor({'title': /*restrictDragedText*/dragedTextPlain.substring(0,1024) });
    return actionLinkModel;
}

function makeDragModelFromUriListMimeType(dataTransferContainer, treeModel) {
    let dragedModel;

    var url = dataTransferContainer.getData('text/uri-list');
    var title = url;
    try {
        var realTitle = dataTransferContainer.getData('text/html').match(/<a[^\b>]+>(.+)[\<]\/a>/)[1];
        if(realTitle) title = realTitle;
    } catch(e) {/*no 'text/html' or regexp is broken, url will be used as title*/}

    if(url === title/*<a> тег небыл найден*/ && !isUrlStartWithValidSchema(url)) {
        var plaint_text_title = dataTransferContainer.getData('text/plain');
        // Это сделано после теста на vsPro Tanks. там 'text/uri-list' при перетаскивании спецификации
        // возвращал некий текст который вовсе небыл урл + у него ещё первая буква всегда была в lover case
        // в отличии от 'text/plain'
        if(plaint_text_title) title = plaint_text_title;
        dragedModel = makeDragModelFromText( title, treeModel );
    } else {
        dragedModel = makeDragModelFromUriList( url, title, treeModel );
    }

    return dragedModel;

}

function makeDragModelFromTextHtmlMimeType(dataTransferContainer, treeModel) {
    let dragedModel;

    //            var url = event.dataTransfer.getData('text/uri-list');
    //            var title = url;
    //            try {
    //                var realTitle = event.dataTransfer.getData('text/html').match(/<a[^\b>]+>(.+)[\<]\/a>/)[1];
    //                if(realTitle) title = realTitle;
    //            } catch(e) {/*no 'text/html' or regexp is broken*/}
    //            dragedModel = this.makeDragModelFromUriList( url, title, передать treeModel );
    //

    var htmlData = dataTransferContainer.getData('text/html');
    if( htmlData.indexOf(TO_DD_HTML_INTERCHANGE_BEG) == 0 && htmlData.indexOf(TO_DD_HTML_INTERCHANGE_END) > 0) {
        // This is drag from our othere instance or window
        try {
            var jsonHierarchyData = JSON.parse( htmlData.substring(TO_DD_HTML_INTERCHANGE_BEG.length, htmlData.indexOf(TO_DD_HTML_INTERCHANGE_END)) );
            dragedModel = makeDragModelFromJson( jsonHierarchyData, treeModel );
        } catch (e) { console.warn("WARNING prepareDragedModel - error during parsing tabsoutlinerdata embeded in interwindow dataTransfer html", e); }

    } else {
        // This is some third party strange "html without textplain" drag, will insert it as Text node
        dragedModel = makeDragModelFromText( htmlData, treeModel );
    }

    return dragedModel;
}



// prepareDragedModel_old : function(event) {
//
//     var dragedModel;
//
//     if( getItemFromDragDataStoreByMimeType(event.dataTransfer, this.instanceUnicalClipboardDataMimeType) ) {
//         dragedModel = this.treeModel.findNodeByIdMVC(event.dataTransfer.getData(this.instanceUnicalClipboardDataMimeType) );                 // поэтому берем закешированную и засинхроненную во всех View через бекграунд this.currentlyDragedIdMVC
//     }
//     else if( getItemFromDragDataStoreByMimeType(event.dataTransfer, 'application/x-tabsoutliner-actionlink') )
//     {   // Это наша кнопочка из нижнего меню
//         let actionLinkModelConstructor = treeView.treeModel[event.dataTransfer.getData("application/x-tabsoutliner-actionlink") ];
//         dragedModel = actionLinkModelConstructor();
//     }
//     else if( getItemFromDragDataStoreByMimeType(event.dataTransfer, "application/x-tabsoutliner-items") ) // Драг и дроп инициирован кемто кто нас знает - скорее всего нашими веб страничками
//     {
//         //console.log( "D&D, dragedTabsoutlinerIntercahangeFormatItems:", getItemFromDragDataStoreByMimeType(event.dataTransfer, "application/x-tabsoutliner-items") );
//         dragedModel = this.treeModel.createHierarchyFromTabsOutlinerInterchangeFormat( event.dataTransfer.getData("application/x-tabsoutliner-items") );
//         // old onDragEnterCase dragedModel = this.makeDragModelFromText( '#', treeModel );
//     }
//     else if( getItemFromDragDataStoreByMimeType(event.dataTransfer, 'text/uri-list') )
//     {
//         //console.log( "D&D, dragedUriList:", event.dataTransfer.getData('text/uri-list') );
//         var url = event.dataTransfer.getData('text/uri-list');
//         var title = url;
//         try {
//             var realTitle = event.dataTransfer.getData('text/html').match(/<a[^\b>]+>(.+)[\<]\/a>/)[1];
//             if(realTitle) title = realTitle;
//         } catch(e) {/*no 'text/html' or regexp is broken, url will be used as title*/}
//
//         if(url === title/*<a> тег небыл найден*/ && !isUrlStartWithValidSchema(url)) {
//             var plaint_text_title = event.dataTransfer.getData('text/plain');
//             // Это сделано после теста на vsPro Tanks. там 'text/uri-list' при перетаскивании спецификации
//             // возвращал некий текст который вовсе небыл урл + у него ещё первая буква всегда была в lover case
//             // в отличии от 'text/plain'
//             if(plaint_text_title) title = plaint_text_title;
//             dragedModel = this.makeDragModelFromText( title, treeModel );
//         } else {
//             dragedModel = this.makeDragModelFromUriList( url, title, treeModel );
//         }
//
//         // old onDragEnterCase dragedModel = this.makeDragModelFromUriList( '#','#', передать treeModel - );
//     }
//     else if( getItemFromDragDataStoreByMimeType(event.dataTransfer, 'text/plain') )
//     {
//         //console.log( "D&D, dragedTextPlain:",  event.dataTransfer.getData(event.dataTransfer, 'text/plain') );
//         dragedModel = this.makeDragModelFromText( event.dataTransfer.getData('text/plain'), treeModel );
//
//         // old onDragEnterCase dragedModel = this.makeDragModelFromText( '#', treeModel );
//     }
//     else if( getItemFromDragDataStoreByMimeType(event.dataTransfer, 'text/html') ) // Драги из TabsOutliner засейваных HTML содержат тока 'text/html', без 'text/plain' или 'text/uri-list'
//     {
//         // console.log( "D&D, dragedTextHtml:", dragedTextHtml );
// //            var url = event.dataTransfer.getData('text/uri-list');
// //            var title = url;
// //            try {
// //                var realTitle = event.dataTransfer.getData('text/html').match(/<a[^\b>]+>(.+)[\<]\/a>/)[1];
// //                if(realTitle) title = realTitle;
// //            } catch(e) {/*no 'text/html' or regexp is broken*/}
// //            dragedModel = this.makeDragModelFromUriList( url, title,, передать treeModel);
// //
//         var htmlData = event.dataTransfer.getData('text/html');
//         if( htmlData.indexOf(TO_DD_HTML_INTERCHANGE_BEG) == 0 && htmlData.indexOf(TO_DD_HTML_INTERCHANGE_END) > 0) {
//             // This is drag from our othere instance or window
//             try {
//                 var jsonHierarchyData = JSON.parse( htmlData.substring(TO_DD_HTML_INTERCHANGE_BEG.length, htmlData.indexOf(TO_DD_HTML_INTERCHANGE_END)) );
//                 dragedModel = this.makeDragModelFromJson( jsonHierarchyData );
//             } catch (e) { console.warn("WARNING prepareDragedModel - error during parsing tabsoutlinerdata embeded in interwindow dataTransfer html", e); }
//
//         } else {
//             // This is some third party strange "html without textplain" drag, will insert it as Text node
//             dragedModel = this.makeDragModelFromText( htmlData, treeModel );
//         }
//         // old onDragEnterCase    dragedModel = this.makeDragModelFromText( '#', treeModel );
//     } else {
//         dragedModel = null;
//     }
//
//     return dragedModel;
// },

function prepareDragedModel(dataTransferContainer, instanceUnicalClipboardDataMimeType, treeModel) {
    // handleThisInstanceMimeType,
    // handleTabsOutlinerActionLinkMimeType,

    // handleXTabsOutlinerItemsMimeType,
    // handleUriListMimeType,

    // handleTextPlainMimeType,
    // handleTextHtmlMimeType,

    // handleNoSuitableMimeType
    return processDragDataStore(dataTransferContainer, instanceUnicalClipboardDataMimeType,
        (dataTransferContainer) => treeModel.findNodeByIdMVC(dataTransferContainer.getData(instanceUnicalClipboardDataMimeType) ),
        (dataTransferContainer) => treeModel[ dataTransferContainer.getData("application/x-tabsoutliner-actionlink") ](),//get actionLinkModelConstructor()

        (dataTransferContainer) => treeModel.createHierarchyFromTabsOutlinerInterchangeFormat( dataTransferContainer.getData("application/x-tabsoutliner-items") ),
        (dataTransferContainer) => makeDragModelFromUriListMimeType(dataTransferContainer, treeModel),

        (dataTransferContainer) => makeDragModelFromText( dataTransferContainer.getData('text/plain'), treeModel ),
        (dataTransferContainer) => makeDragModelFromTextHtmlMimeType(dataTransferContainer, treeModel ),

        (dataTransferContainer) => null,

    )
}