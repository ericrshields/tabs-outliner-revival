/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

// --------------------------------------------------------------------------------------------
var tiles = {
    rexmark:{src:"tree/img/tagicons/test/exmark_red_s1.png", w:8, h:18},
    gexmark:{src:"tree/img/tagicons/test/exmark_green_s1.png", w:8, h:18},
    ystar:{src:"tree/img/tagicons/test/star_yellow_s1.png", w:17, h:16},
    vstar:{src:"tree/img/tagicons/test/star_violet_s1.png", w:17, h:16},
    bigstar:{src:"tree/img/tagicons/test/star_big_s1.png", w:29, h:27},
    work:{src:"tree/img/tagicons/test/work_s1.png", w:45, h:18},

    nodeanchor_no_subnodes:{src:"tree/img/treetiles/correlatestyle/node_anchor_no_subnodes_s1.png", w:15, h:16, className:"rellinetiles"},
    nodeanchor_colapsed:{src:"tree/img/treetiles/correlatestyle/node_anchor_colapsed_s1.png", w:15, h:16, className:"rellinetiles"},
    nodeanchor_expanded:{src:"tree/img/treetiles/correlatestyle/node_anchor_expanded_s1.png", w:15, h:16, className:"rellinetiles"},

    lineto_last_subnode:{src:"tree/img/treetiles/correlatestyle/lineto_last_subnode_s1.png", w:15, h:16, className:"rellinetiles"},
    lineto_subnode:{src:"tree/img/treetiles/correlatestyle/lineto_subnode_s1.png", w:15, h:16, className:"rellinetiles"},
    line_vertical:{src:"tree/img/treetiles/correlatestyle/line_vertical_s1.png", w:15, h:1, className:"rellinetiles"},
    line_horizontal:{src:"tree/img/treetiles/correlatestyle/line_horizontal_s1.png", w:1, h:16, className:"rellinetiles"},
    icons_separator:{src:"tree/img/treetiles/correlatestyle/icons_separator_s1.png", w:5, h:16, className:"rellinetiles"}
};
// --------------------------------------------------------------------------------------------
var incorect_tiles_size_warning_alert_was_fires = false;

function onClick_hoveringMenu_expandCollapseBtn() {
    dispatchBubledCustomEvent(this, 'node_expand_collapse_anchor_activated');
}

function onClick_hoveringMenu_actionBtn() {
    dispatchBubledCustomEvent(this, 'hovering_menu_action_btn_activated', {'actionId':this.id});
}


function makeHoveringMenu(window_) {
    var r = window_.document.createElement("span"); r.className = "hoveringMenu_container";

    r._ref_actionButtonsContainer = window_.document.createElement("span"); r._ref_actionButtonsContainer.className = "hoveringMenu_panel";
    r.appendChild(r._ref_actionButtonsContainer);

    r._ref_hoveringMenu_expandCollapseBtn = document.createElement("div");  r._ref_hoveringMenu_expandCollapseBtn.className = "hoveringMenu_expandCollapseBtn";
    r._ref_hoveringMenu_expandCollapseBtn.onclick = onClick_hoveringMenu_expandCollapseBtn;

    r.addActionButton = function(action) {
        if(!action) return;

        var b = this.ownerDocument.createElement("span");
        b.className = "hoveringMenu_"+action.id;
        b.id = action.id;
        b.onclick = onClick_hoveringMenu_actionBtn;
        this._ref_actionButtonsContainer.appendChild(b);
    };
    r.setOwner = function(owner) {
        this._ref_owner = owner;

        if(owner) {
            // TODO Small Optimization - Трохи тупо, кнопки почти всегда теже, и не клозают саму модель, а мы постоянно пересоздаём этот список на каждой строчке
            this._ref_actionButtonsContainer.innerHTML = ""; // fast delete all axtion buttons inside hovering menu

            // Кнопка сворачивания/разворачивания
            if(this._ref_owner._ref_nodeModel.isSubnodesPresent())
                this._ref_actionButtonsContainer.appendChild(this._ref_hoveringMenu_expandCollapseBtn);

            // Action buttons
            var actions = this._ref_owner._ref_nodeModel.getHoveringMenuActions();

            if(this._ref_owner._ref_treeView.isOneClickToActivateMode && window['isKeysAndcontextMenuActionsEnabled'])
                this.addActionButton(actions['setCursorAction']);

            this.addActionButton(actions['editTitleAction']);
            this.addActionButton(actions['deleteAction']);
            this.addActionButton(actions['closeAction']);
        }
    };
    r.getOwner = function() {
        return this._ref_owner;
    };

//    var b = document.createElement("span");
//    b.className = "hoveringMenu_test_button";
//    mb.appendChild(b);
//    r._ref_hoveringMenu_test_button = b;

    return r;
}

function makeDragFeedbackAsFirstChild(window_) {
    var i = window_.document.createElement("img");
    i.src = "tree/img/drag_feedback_as_first_child.png";
    i.style.cssText = "pointer-events:none;";//TODO убрать отсюда стили в css

    var r =  window_.document.createElement("div");
    r.id = "dragFeedback";

    r.appendChild(i);

    return r;
}

function makeDragFeedbackAsSibling(window_) {
    var i =  window_.document.createElement("img");
    i.src = "tree/img/drag_feedback_as_sibling.png";
    i.style.cssText = "pointer-events:none;position:absolute;bottom:-9px"; //TODO убрать отсюда стили в css

    var r =  window_.document.createElement("div");
    r.id = "dragFeedback";

    r.appendChild(i);

    return r;
}
//
//function makeDragFeedbackAsFirstChild(window_) {
//    var i = window_.document.createElement("img");
//    i.src = "tree/img/drag_feedback_as_first_child.png";
//    i.style.cssText = "pointer-events:none;";//TODO убрать отсюда стили в css
//
//    var r =  window_.document.createElement("div");
//    r.id = "dragFeedback";
//    r.className = "dragFeedback_container";
//
//
//    r.appendChild(i);
//
//
//    //  window_.document.body.appendChild(r);
//
//    return r;
//}
//
//function makeDragFeedbackAsSibling(window_) {
//    var i =  window_.document.createElement("img");
//    i.src = "tree/img/drag_feedback_as_sibling.png";
//    i.style.cssText = "pointer-events:none;position:absolute;bottom:-9px"; //TODO убрать отсюда стили в css
//
//    var r =  window_.document.createElement("div");
//    r.id = "dragFeedback";
//    r.className = "dragFeedback_container";
//
//
//    r.appendChild(i);
//
//
//    //  window_.document.body.appendChild(r);
//
//    return r;
//}

function findAbsolutePosition(obj)
{
    var box = obj.getBoundingClientRect(),
        doc = obj.ownerDocument,
        body = doc.body,
        docElem = doc.documentElement,
        clientTop = docElem.clientTop || body.clientTop || 0,
        clientLeft = docElem.clientLeft || body.clientLeft || 0,
        top  = box.top  + window.pageYOffset - clientTop,
        left = box.left + window.pageXOffset - clientLeft;
    return { top: top, left: left };

    //return { top: Math.random()*100, left: Math.random()*100 };
    // ---------------------------
    //
    //    var curleft = 0;
    //    var curtop = 0;
    //    if (obj && obj.offsetParent) {
    //	    do {
    //	         curleft += obj.offsetLeft;
    //	         curtop += obj.offsetTop;
    //	     } while (obj = obj.offsetParent);
    //    }
    //    return {left:curleft,top:curtop};
}


// parameters object is optional argument - collection of optional parameters wich if provided will substitute default values from tiles declaration.
// Example with all suported data: {w:"100%", h:"100%", style:"background-color:#03C"}
function makeTileDom(tile, parameters)
{
    var r = new Image();
    r.src = tile.src;
    if(parameters && parameters.style)     r.style.cssText = parameters.style;
    if(parameters && parameters.w)         r.style.width   = parameters.w; else r.width = tile.w;
    if(parameters && parameters.h)         r.style.height  = parameters.h; else r.height = tile.h;
    if(parameters && parameters.className) r.className     = parameters.className; else if(tile.className) r.className = tile.className;

    // Assert check of correctly set with and height in tile declaration
    r.onload = function() {
        var warningsPresent = false;

        if (this.naturalWidth != tile.w) {
            warningsPresent = true;
            if (typeof console != "undefined") console.warn("Warning: tile " + this.src + " have incorect width, provided:" + tile.w + " must be:" + this.naturalWidth, tile, this);
        }
        if (this.naturalHeight != tile.h) {
            warningsPresent = true;
            if (typeof console != "undefined") console.warn("Warning: tile " + this.src + " have incorect height, provided:" + tile.h + " must be:" + this.naturalHeight, tile, this);
        }

        if (warningsPresent && !incorect_tiles_size_warning_alert_was_fires) {
            alert("Warning. Some tiles was declared with incorect size, see console log for details.");
            incorect_tiles_size_warning_alert_was_fires = true;
        }
    };

    return r;
}

//======================================================================================================================
// View
//======================================================================================================================

//innerHTMLvsDOM?
function makeRelIconDom(icontile)
{
    // <span id="icon_height_excluder" style="display:inline-block;height:0;"><img id="relicon" src="http://habrahabr.ru/favicon.ico" style="background-color:#30C; height:30px; width:30px; position:relative; top:-25px; "/></span>

    var r = document.createElement("span");

    var rellinerowheight = tiles.line_horizontal.h;

    // Тут ставим не нулевую высоту, это помогает в Firefox & Chrome более менее одинаково отцентрировать иконку.
    r.style.cssText = "display:inline-block; position:relative; width:"+icontile.w+"px;height:"+rellinerowheight+"px;";

    // добавляем иконку
    var icon = makeTileDom(icontile);
    icon.style.cssText = "position:absolute; top:"+(rellinerowheight - icontile.h)/2+"px";  //top - центрирует иконку в строке
    r.appendChild(icon);

    return r;
}

var tiles_line_horizontal_w100 = makeTileDom(tiles.line_horizontal, {w:"100%"});
function makeRelLineWithIconsDom(window_, icons)
{
    // If no icons return simple one image line
    if(!icons || icons.length === 0)
        return tiles_line_horizontal_w100; // TODO need replace by calculated manualy width. In othere case there was errors during constant zoomin - zoomout in chrome


    // Some icons present - build structure like this:
    //   <table width="100%" style="border-collapse:collapse;padding:0;"><tr><td style="padding:0;">---------------------</td> <td width="100%" style="padding:0;"><img src="line_horizontal_s1.png" width="100%" height="16" /></td></tr></table>
    //
    //   <img src="line_horizontal_s1.png" width="5" height="16" />
    //
    //	 <img src="icons_separator_s1.png" width="5" height="16" />
    //
    //	 <span id="icon_height_excluder" style="display:inline-block;height:0;"><img id="relicon" src="http://habrahabr.ru/favicon.ico" style="background-color:#30C; height:30px; width:30px; position:relative; top:-25px; "/></span>
    //
    //	 <img src="icons_separator_s1.png" width="5" height="16" />
    //
    //	 <span id="icon_height_excluder" style="display:inline-block;height:0;"><img id="relicon" src="http://habrahabr.ru/favicon.ico" style="background-color:#30C; height:30px; width:30px; position:relative; top:-25px; "/></span>
    //
    //	 <img src="icons_separator_s1.png" width="5" height="16" />
    //
    //	 <img src="line_horizontal_s1.png" width="10" height="16" />

    var r = window_.document.createElement("table"); r.className = "relllineiconstable";

    var row = r.insertRow(-1);

    // ------------------------------------------------------------------------------------
    var iconscontainer = row.insertCell(-1);

    iconscontainer.appendChild( makeTileDom(tiles.line_horizontal, {w:"5"}) );

    icons.forEach( function(icon) {
        iconscontainer.appendChild( makeTileDom(tiles.icons_separator) );
        iconscontainer.appendChild( makeRelIconDom(icon) );
    });

    iconscontainer.appendChild( makeTileDom(tiles.icons_separator) );

    // ------------------------------------------------------------------------------------
    var fillercontainer = row.insertCell(-1);
    fillercontainer.style.width = "100%";
    fillercontainer.appendChild( tiles_line_horizontal_w100 ); // TODO need replace by calculated manualy width. In othere case there was errors during constant zoomin - zoomout. Also this will help remove unneded anymore table

    return r;
}
function NodeTextWithAnchorDom_createStatBlockInnerHtml(nodeModel) {
    var subnodesStatistic = nodeModel.countSubnodesStatsBlockData();
    if(subnodesStatistic['nodesCount'] === subnodesStatistic['activeTabsCount']) delete subnodesStatistic['nodesCount']; // Нет нужды выводить две одинаковые цифры для свёрнутого окна
    var r = '';
    for(var s in subnodesStatistic)
        if(subnodesStatistic.hasOwnProperty(s) && subnodesStatistic[s] > 0)
            r += '<span class="' + s + '">' + subnodesStatistic[s] + '</span>';

    return r;
}

function NodeTextWithAnchorDom_updateNodeAnchorImageAndCollapsedStatDom(window_, nodeModel, isCursored) {
    this.updateCssClasses(nodeModel, isCursored); // Will update "nosubnodes", "collapsedsubnodes", "expandedsubnodes"

    // Collapsed nodes information (if node collapsed) -----------------------------------------------------------------
    if(nodeModel.colapsed && nodeModel.isSubnodesPresent()) {
        if(!this._ref_collapsedNodesInfoDom) {
            this._ref_collapsedNodesInfoDom = window_.document.createElement("span"); this._ref_collapsedNodesInfoDom.className = "collapsedNodesInfo " + nodeModel.titleCssClass;
            this._ref_collapsedNodesInfoDom.addEventListener('mousedown', fireExpandCollapseAnchorEventOnSelf, false);  // mousedown instead of click simple because its feel much more responsive to user

            this.insertBefore(this._ref_collapsedNodesInfoDom, this.firstChild) ;
        }

        this._ref_collapsedNodesInfoDom.innerHTML = NodeTextWithAnchorDom_createStatBlockInnerHtml(nodeModel);
    }
    else {
        if(this._ref_collapsedNodesInfoDom) { this.removeChild(this._ref_collapsedNodesInfoDom); this._ref_collapsedNodesInfoDom = null; }
    }
}

function NodeTextWithAnchorDom_updateNodeTitle(nodeModel, isCursored, isFullTreeBuild) {
    var nodeIcon              = nodeModel.getIcon();
    var nodeIconForHtmlExport = nodeModel.getIconForHtmlExport();
    // this.title                                      =  nodeModel.getTooltipText();
    this.href                                          =  nodeModel.getHref();
    if(nodeIcon !== null) {
        if(isFullTreeBuild) {
            if(nodeIcon.indexOf(':') === -1) //  no http:// or chrome://favicon - so it is img from our crx - can be inserted right away
                this._ref_nodeFaviconDom.src =  nodeIcon;
            else
                this._ref_nodeFaviconDom.dataset['iconSrcDefferedLoad'] = nodeIcon;
        } else {
            this._ref_nodeFaviconDom.src =  nodeIcon;
        }
    }
    if(nodeIconForHtmlExport) this._ref_nodeFaviconDom.dataset['nodeIconForHtmlExport'] = nodeIconForHtmlExport;


    if(nodeModel.isLink && nodeModel.getCustomTitle())
        this._ref_nodeTextDom.innerHTML   = '<span class="tab_comment">' + nodeModel.getCustomTitle() + '</span>' + nodeModel.getNodeText();
    else
        this._ref_nodeTextDom.textContent =  nodeModel.getNodeText();

    this.updateCssClasses(nodeModel, isCursored); // will set css classes for focusedWindow, selectedTab, contentCssClasses, ....
}

function isSimleLeftClickWithoutKeybModifiers(event){
    // Кросброузерная проверка на клик именно левой клавишей (event.which это стандарт -  1 - left, 2 - midle, 3 - right ) no IE его до IE9 не знает
    var isLeftClick =  (event.which == null) ? /* IE case */ (event.button <= 1) : /* All othere */ (event.which == 1);

    return isLeftClick && !event.ctrlKey && !event.shiftKey;
}

function NodeTextWithAnchorDom_preventDefaultOnSimpleLMBClick(event){
    // Prevent folowing a link on simple left click
    if( isSimleLeftClickWithoutKeybModifiers(event) )
        event.preventDefault();
    // а вот мидл клик, ctrl click & shift click  мы разрешаем, произойдёт открытие в новом табе или окне
}

function dispatchBubledCustomEvent(domElem, eventType, detail) {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(eventType, true/*canItBubble*/, true/*isItCancelable*/, detail /*detailAboutEvent - мона event выслать в результате которого породились*/);

    var isPreventDefaultFlagSet = !domElem.dispatchEvent(evt);
//    if(isPreventDefaultFlagSet) {
//      // A handler called event.preventDefault()
//      // alert("canceled");
//    } else {
//      // None of the handlers called event.preventDefault()
//      // alert("not canceled");
//    }

    return isPreventDefaultFlagSet;
}

function isClickOnAnchorArea(nodeTextWithAnchorDomObjThis, event) {
    // Нам надо фильтровать клик эвенты порождённые кликами на тексте и только реагировать на клики на бекграунде (где
    // нарисован анхор)
    // Для текстовых нод это вообще не проблема, там до конца экрана бекграунд перекрыт и можно чекать только на this === event.srcElement,
    // но вот ноды окна до конца не доходят

    // способы узнать размер падинга (анхор у нас в падинге рисуется) :
    // window.getComputedStyle(this, null).getPropertyValue('padding-left')
    // $(txt).css('padding-left');  // this does work in IE6-8.
    // но чтото я дуаю что это дикий оверкил и вообще, даже если кешировать эти данные
    // А поэтому просто ограничимся магической константой - 40
    // Мы всёравно не реагируем на клике в descendant элементах - под этим подразумевается что область в 40 пикселей таки заходит на область
    // где уже рисуется оно или фавиконка таба (и сильно, пикселей на 24), но так как там есть другой элемент уже
    // мы не отриагируем на клики на нём как на таковые что сворачивают иерархию

    // осторожно - event.offsetX - скорее всего без проверки this === event.srcElement показывает смещение относительно srcElement (но не факт)
    return nodeTextWithAnchorDomObjThis === event.srcElement && event.offsetX < 40; /*с offsetX имеется кросброузернонекомпатибельная жопа*/
}

function NodeTextWithAnchorDom_detectAndFireExpandCollapseAnchorEvent(event){
    // Чтоб отфильтровать клики всплывающие в bubling phase из самого тайтла мы можем либо в его onclick (тайтла)
    // цеплять к эвент обекту какойто флаг, что он уже обработан (не стоит делать e.stopPropagation(); так как этим мы
    // отключим возможно какуюто логику повешенную на самом документе)
    // либо использовать srcElement и регировать только на клике порождённые непосредственно нами и стат блоком
    if( isClickOnAnchorArea(this, event) )
        dispatchBubledCustomEvent(this, 'node_expand_collapse_anchor_activated');
}

function fireExpandCollapseAnchorEventOnSelf(event){
    dispatchBubledCustomEvent(this, 'node_expand_collapse_anchor_activated');
}

function NodeTextWithAnchorDom_onHover(event){
    dispatchBubledCustomEvent(this.parentNode, 'node_hovered'); // Warning! для оптимизации кидаем сразу на парент эвент - значит его на NodeTextWithAnchorDom ловить бесполезно
}

function NodeTextWithAnchorDom_onActivated(event){
    if( isSimleLeftClickWithoutKeybModifiers(event) && !isClickOnAnchorArea(this, event) ) {
        dispatchBubledCustomEvent(this.parentNode, 'node_activated', {'altKey': event['altKey']}); // Warning! для оптимизации кидаем сразу на парент эвент - значит его на NodeTextWithAnchorDom ловить бесполезно
        event.preventDefault(); // Баним реакцию на одноклик - для линка это открытие линка, в принципе уже забанено в NodeTextWithAnchorDom_preventDefaultOnSimpleLMBClick, но на всякий случай
    }
}

function NodeTextWithAnchorDom_onFocused(event){
    dispatchBubledCustomEvent(this.parentNode, 'node_focused'); // Warning! для оптимизации кидаем сразу на парент эвент - значит его на NodeTextWithAnchorDom ловить бесполезно
}

function NodeTextWithAnchorDom_isInEditMode() {
    return this._ref_nodeFaviconAndTextContainerDom.contentEditable === "true"; /*it can be "inherit" or "false", so check only for "true"*/
}

function NodeTextWithAnchorDom_setEditMode(isEditMode) {
    return this._ref_nodeFaviconAndTextContainerDom.contentEditable = isEditMode ? "true" : "inherit"; // Se also -webkit-user-modify
}

function NodeTextWithAnchorDom_updateCssClasses(nodeModel, isCursored) {
    // Base Css Classes ------------------------------------------------------------------------------------------------
    var classes = "nodeTitleContainer "
            + nodeModel.titleCssClass
            + "NTC NTC-" + nodeModel.titleBackgroundCssClass;

    // Anchor Image Css Classes ----------------------------------------------------------------------------------------
    var isColapsedSubnodes = nodeModel.colapsed;
    var isSubnodesPresent  = nodeModel.isSubnodesPresent();

    if(!isSubnodesPresent) classes += " nosubnodes";
    else                   classes += (isColapsedSubnodes ? " collapsedsubnodes" : " expandedsubnodes");

    // Othere Css Classes ----------------------------------------------------------------------------------------------
    if(nodeModel.isSelectedTab())              classes += " selectedtab";
    if(nodeModel.isFocusedWindow())            classes += " focusedwindow";
    if(nodeModel.isProtectedFromGoneOnClose()) classes += " protected";
    if(nodeModel.getNodeContentCssClass())     classes += " NCC-NTC-" + nodeModel.getNodeContentCssClass();

    if(isCursored) classes += " " + cursoredNodeCssClass;

    if(this.className != classes) this.className = classes;
}

//innerHTMLvsDOM?
function makeNodeTextWithAnchorDom(window_, nodeModel, isOneClickToActivateMode, isCursored, isFullTreeBuild)
{
    var rNodeTitleContainer = window_.document.createElement(nodeModel.isLink ? "a" : "div");

    rNodeTitleContainer.updateCssClasses                         = NodeTextWithAnchorDom_updateCssClasses;
    rNodeTitleContainer.updateNodeTitle                          = NodeTextWithAnchorDom_updateNodeTitle;
    rNodeTitleContainer.isInEditMode                             = NodeTextWithAnchorDom_isInEditMode;
    rNodeTitleContainer.setEditMode                              = NodeTextWithAnchorDom_setEditMode;
    rNodeTitleContainer.updateNodeAnchorImageAndCollapsedStatDom = NodeTextWithAnchorDom_updateNodeAnchorImageAndCollapsedStatDom;

    rNodeTitleContainer.addEventListener('click',                                          NodeTextWithAnchorDom_preventDefaultOnSimpleLMBClick, false); // Prevent folowing a link on simple left click
    rNodeTitleContainer.addEventListener('mousedown',                                      NodeTextWithAnchorDom_detectAndFireExpandCollapseAnchorEvent, false);  // mousedown instead of click simple because its feel much more responsive to user
    rNodeTitleContainer.addEventListener('mousedown',                                      NodeTextWithAnchorDom_onFocused, false);  // mousedown instead of click simple because its feel much more responsive to user // Механизм селектинга текущей ноды
    rNodeTitleContainer.addEventListener('mouseover',                                      NodeTextWithAnchorDom_onHover, false); // Hovering menu initiator
    rNodeTitleContainer.addEventListener(isOneClickToActivateMode ? 'click' : 'dblclick',  NodeTextWithAnchorDom_onActivated, false); // DblClick

    // rNodeTitleContainer.updateCssClasses(nodeModel); // Set rNodeTitleContainer.className - Закоменчен бо это и так сделают 2 других updateXxx метода ниже

    // Anchor & collapsed nodes counter --------------------------------------------------------------------------------
    rNodeTitleContainer.updateNodeAnchorImageAndCollapsedStatDom(window_, nodeModel, isCursored);

    // Helper Frame if Needed ------------------------------------------------------------------------------------------
    if(nodeModel.needFaviconAndTextHelperContainer) {
        var nodeFaviconAndTextHelperContainerDom = window_.document.createElement("div"); nodeFaviconAndTextHelperContainerDom.className = "nodeFaviconAndTextHelperContainer " + nodeModel.titleCssClass;
        rNodeTitleContainer.appendChild(nodeFaviconAndTextHelperContainerDom) ;
    }

    rNodeTitleContainer._ref_nodeFaviconAndTextContainerDom = nodeFaviconAndTextHelperContainerDom ? nodeFaviconAndTextHelperContainerDom : rNodeTitleContainer ;

    // Favicon ---------------------------------------------------------------------------------------------------------
    if(nodeModel.getIcon() != null) {
        var favicon = window_.document.createElement("img"); favicon.className = "node_favicon " + nodeModel.titleCssClass + "_favicon";
        rNodeTitleContainer._ref_nodeFaviconAndTextContainerDom.appendChild(favicon);
    }

    // Node Text -------------------------------------------------------------------------------------------------------
    var text    = window_.document.createElement("span"); text.className = "node_text "+nodeModel.titleCssClass + "_text"; // We use span & convert by css to display:block to make drag to GoogleDocs looks cool - text on same line as favicon
    text.setAttribute("draggable", "true"); //From Chrome 62 ondragstart was not fired anymore without this line

    if(nodeModel.additionalTextCss) text.className += " " + nodeModel.additionalTextCss;

    if(nodeModel.getNodeTextCustomStyle()) text.style.cssText = nodeModel.getNodeTextCustomStyle();

    rNodeTitleContainer._ref_nodeFaviconAndTextContainerDom.appendChild(text);

    rNodeTitleContainer._ref_nodeFaviconDom = favicon;
    rNodeTitleContainer._ref_nodeTextDom  = text;

    rNodeTitleContainer.updateNodeTitle(nodeModel, isCursored, isFullTreeBuild);

    return rNodeTitleContainer;
}

// ---------------------------------------------------------------------------------------------------------------------
var SubnodesListView = function(){

};

// ---------------------------------------------------------------------------------------------------------------------
// Отвечает за линию с иконками (от начала), узел и раскрытые подузлы
// сюда приходят все сообщения об изменениях в моделе
// TODO Refactoring - Introduce NodeView
// именно сюда должны быть зареганы обсерверы, а не на какеито странные короутины внутри методов с референсами на DOM в стеке
// именно сюда должны быть зареганы mouse & keyboard events, или как минимум работать через методы этого класса, а не опять таки на короутинах сделаны
// var NodeView = function(nodeModel, nodeViewOwner){
//     this.nodeModel     = nodeModel;
//     this.nodeViewOwner = nodeViewOwner;
//
//     // this.makeNodeDom(); // Нах заранее то?
//
//     // this.subnodesViews = recursiveCreateNodeViews(nodeModel);
// };
//
// //Штмл генераторы не должны ничего знать про NodeView - калбеки что они реестрируют на DOM они должны получать
// // как параметры
// // Кстате NodeView тоже не должен нихера знать про HTML который ему сгенерят генераторы (в идеале) но вощето это всё
// // слишком както усложняется - ну нафиг (NodeView у нас всётаки View, хотя по сути своих главных задач - Controler)
// NodeView.prototype = {
//     nodeModel:null,
//     nodeViewOwner:null, //For quick access, especialy from mouse & keyboard events
//     subnodesViews:[],
//
//     // HTML DOM references to regulary acesed objects
//     nodeRowDom:null,
//     nodeContentAndSubnodesCellDom:null,
//     nodeContentDom:null,
//     nodeSubnodesDom:null, //Also used as cache for generated subnodes HTML when it collapsed for fast expand
//
//     takeFocus: function() {},
//     removeFromTabOrder: function() {},
//     switchToEditMode: function() {},
//
//     selectNodeUp: function() {},
//     selectNodeDown: function() {},
//     selectNodeLeft: function() {},
//     selectNodeRight: function() {},
//
//     // Messages from view ----------------------------------------------------------------------------------------------
//     fromHtml_onAnchorClicked:function() {},
//
//     // Messages from model ---------------------------------------------------------------------------------------------
//     fromModel_onSubnodesCollapsingStatusChanged:function() {},
//     fromModel_onSubnodeDeleted: function(atIndex) {},
//     fromModel_onSubnodeInserted: function(atIndex) {},
//
//
//     // Controller section (communication with model) ===================================================================
//     // Работа с моделью только из этих методов, а не гдето в короутинах размазанных в view
//     // TODO - тут должен будет использоваться CommandPattern для изменения модели
//     model_setSubnodesCollapsedState: function() {},
//
//     model_addObserver: function() {},
//
//     model_applyNewTextToNode: function() {},
//
//     model_deleteNode: function() {},
//
//     model_addSiblingNodeAbove: function() {},
//     model_addSiblingNodeBelow: function() {},
//     model_addSubNode: function(atIndex) {},
//
//     end:null
// };

var cursoredNodeCssClass = "currentNode";

function getRowDomFromEvent_orNull(e) {
    // Ищем до тех пор пока не наткнёмся на _ref_treeView
    for(var element = e.target; !!element.parentNode;  element = element.parentNode)
        if(element.parentNode._ref_treeView) break;

    return element.parentNode;
}

function TreeView(window_, treeModel, thisTreeTabIndex, bottomMainPanelHeight, isEnableContextMenu, globalViewId, backgroundport, modelInstanceId) {
    // instanceUnicalClipboardDataMimeType - Used in drag and drop to distinct between own idMVC values and values that will come from ext instances in other Chrome profiles or Backup vies
    this.instanceUnicalClipboardDataMimeType = 'application/x-tabsoutliner-instaneid'+modelInstanceId+'-idmvc' // Warning! Must be all in lovercase!!!!

    this.currentlyDragedIdMVC;
    this.backgroundport = backgroundport;
    this.globalViewId_ICursorOwner = globalViewId; // Создается в background в момент конектинга окна дерева к порту,
                                      // используется в курсор операциях, не очень удачно сделанных, мы часто просим модель поставить за нас кудато курсор наш обращаясь к
                                      // к моделям узлов с этим запросов, а узлы потом ВСЕМ VIEW посылают месагу на установку курсора, они так фильтруют им месага пришла или не им по
                                      // этому ID
                                      // мы и так на самом деле знаем из какого View пришол запрос через проперти port обэкта
    this.cursoredNodeIdMVC  = null;

    this.treeTabIndex = thisTreeTabIndex;

    this.activatePrompt/*(defaultText, onOk, onCancell)*/ = initModalPrompt(window_);
    this.activateContextMenu/*(event, isGoProBanerVisible)*/ = initContextMenu(window_);


    this.bottomMainPanelHeight = bottomMainPanelHeight;

    // -----------------------------------------------------------------------
    this.currentDragFeedbackHolder = null;
    this.dragFeedbackAsFirstChild = makeDragFeedbackAsFirstChild(window_);
    this.dragFeedbackAsSibling    = makeDragFeedbackAsSibling(window_);
    this.dragFeedback = this.dragFeedbackAsFirstChild; // to not check in clearDragFeedback for assigning of this value

    this.dragFeedbackDefferedDrawTimer = null;
    // -----------------------------------------------------------------------
    this.hoveringMenu = makeHoveringMenu(window_);

    //this.hoveringMenu_preventhide = false;
    //this.hoveringMenu.onmouseover = (function(event) { this.hoveringMenu_preventhide = true; }).bind(this);
    //this.hoveringMenu.onmouseout  = (function(event) { this.hoveringMenu_preventhide = false; this.clearHoveringMenu(null)}).bind(this);

    this.isOneClickToActivateMode = !!localStorage['oneClickToOpen'];

    // Создаём дерево (это должно быть после инициализации всех мемберов) -----------------------------------

    //this.treeDom = makeSubnodesTableDom(treeModel, this);
    this.currentSessionRowDom = makeNodeRowDom( window_, treeModel[0], this, true/*isFullTreeBuild*/ );

    this.connectClipboardListeners(window_);
    if(isEnableContextMenu) this.connectContextMenu();



 // Селектаем Current Session как текущий узел (а нафига?)
 //    if (this.treeDom.childNodes.length > 0) //TODO treeDom.childNodes - Хуета!!!!
 //        this.selectNodeAsCurrent(this.treeDom.childNodes[0]);

 // TODO Refactoring - Introduce NodeViews graph
 //    реально тут должно сформироваться дерево из NodeViews
 //    this.subnodesViews = [],
 //    и в selectNodeAsCurrent должен менно NodeView передаваться (а не какаято глубокая DOM подхрень),
 //    и найтись он должен тоже не лазя в Dom за rows[0] а быть взят из subnodesViews[0]
 //    и сам селект должен быть выполнен методам NodeView - только она знает устройство своих View
 //    removeFromTabOrder()
 //    takeFocus()
}


function getNodeRowDomByIdMVC(idMVC) {
    return document.getElementById(idMVC);
}

TreeView.prototype = {
    PAGE_UP_DOWN_REPEAT:10,

    // getNodeRowDom : function(pathFromRoot) {
    //     var currentRowDom = this.currentSessionRowDom;
    //     pathFromRoot.forEach(function(subnodeIndex) {
    //         currentRowDom = currentRowDom._ref_subnodesDom.children[subnodeIndex];
    //     });
    //
    //     return currentRowDom;
    // },


    // requestDataForDataTransferObj : function(dataTransferObj) {
    //     this.refToDataTransferObj = dataTransferObj; // Remember untill response processing in fillDataTransferObj
    //     this.refToDataTransferObj.setData('text/plain', "TEST BAD : (");
    //
    //     backgroundport.postMessage({request:"request2bkg_fillDataTransferObj"});
    //
    // },
    //
    // fillDataTransferObj : function(response) {
    //     this.refToDataTransferObj.setData('text/plain', response.data);
    //     this.refToDataTransferObj = null; // To allow garbage collection
    // },

    getRowDomByIdMVC : function(idMVC) {
        return document.getElementById(idMVC);
    },

    connectContextMenu : function() {
        this.currentSessionRowDom.addEventListener('contextmenu', function(e) {
            if(e.shiftKey) return true; // Will show native context menu on ShiftKey+RMB, we cannot use Ctrl!!! as this is default MAC context menu shortcut, also using the ALT imedeately close the native context menu

            var rowDom = getRowDomFromEvent_orNull(e);
            if(rowDom) {
                // We cannot use this here (instead of rowDom._ref_treeView) as this inner function is called from inside the event
                rowDom._ref_treeView.setCursorToRowDom(rowDom); // При вызове с ховеринг меню курсор таки не переставлялся, бо right click не долетал
                rowDom._ref_treeView.activateContextMenu(e, !!window['isContextMenuGoProBanerVisible']);
                e.preventDefault();
            }
        }, false);

    },

    activateCurrentNode : function(isAlternativeRestore) {
        // ми сюда влетаем полько по контекстному меню или пробелу
        // а какогото хрена по дабл клику, f2 или карандашику все работает и без посещения background

        this.backgroundport.postMessage({request:"request2bkg_activateNode", targetNodeIdMVC:this.cursoredNodeIdMVC, isAlternativeRestore:isAlternativeRestore });
    },

    activateHoveringMenuActionOnCurrentNode : function( actionId ) {
        this.backgroundport.postMessage({request:"request2bkg_activateHoveringMenuActionOnNode", targetNodeIdMVC:this.cursoredNodeIdMVC, actionId:actionId });
    },

    editCurrentNodeNote : function() {
        this.activateHoveringMenuActionOnCurrentNode('editTitleAction');
    },

    deleteCurrentNode : function() {
        this.activateHoveringMenuActionOnCurrentNode('deleteAction');
    },

    deleteCurrentHierarchy : function() { //Called only during the clipboard CUT operation
        this.backgroundport.postMessage({request:"request2bkg_deleteHierarchy", targetNodeIdMVC:this.cursoredNodeIdMVC});
    },

    saveCloseCurrentNode : function() {
        this.activateHoveringMenuActionOnCurrentNode('closeAction');
    },

    // -------------------------------------------------------------
    moveHierarchy : function(hierarchyIdMVC, whereRelativeToAnchorModel, anchorModel) {
        if(!anchorModel || !hierarchyIdMVC) return;

        var dropTarget = selectDropTarget(whereRelativeToAnchorModel, anchorModel);
        this.backgroundport.postMessage({request:"request2bkg_moveHierarchy", dropTarget:dropTarget, hierarchyToMoveIdMVC:hierarchyIdMVC });
    },

    moveCurrentNode_levelDown : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_NEXT_SIBLING, /*of*/ getParentRowDom(cursoredRowDom) /*model.parent*/);
    },

    moveCurrentNode_levelUp : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_LAST_SUBNODE, /*of*/  findPrevSibling_RowDom(cursoredRowDom) /*model.findPrevSibling()*/);
    },

    moveCurrentNode_up : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_PREV_SIBLING, /*of*/  findPrevSibling_ifAbsent_parent_RowDom(cursoredRowDom) /*model.findPrevSibling_ifAbsent_parent()*/);
    },

    moveCurrentNode_down : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_NEXT_SIBLING, /*of*/  findNextSibling_ifAbsent_anyParentsNextSibling_RowDom(cursoredRowDom) /*model.findNextSibling_ifAbsent_anyParentsNextSibling(false)*/);
    },

    moveCurrentNode_asFirstSiblingInSameLevel : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_FIRST_SUBNODE, /*of*/  getParentRowDom(cursoredRowDom) /*model.parent*/);
    },

    moveCurrentNode_asLastSiblingInSameLevel : function() {
        let cursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);  if(!cursoredRowDom) return;

        this.moveHierarchy(this.cursoredNodeIdMVC, AS_LAST_SUBNODE, /*of*/  getParentRowDom(cursoredRowDom) /*model.parent*/);
    },
    // -------------------------------------------------------------

    actionFlattenTabsHierarchy : function() {
        // For Window or Group or saved Window - this will flatten all its tabs
        // If called on tab - it's flaten the tabs above the current tab
        // it's skip other Groups (but not if we collapsed)
        // it's not flatten notes
        // it's flatten separators only if they attached directly on tab or saved tab (not if on any other node)

        this.backgroundport.postMessage({request:"request2bkg_actionFlattenTabsHierarchy", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },

    actionMoveWindowToTheEndOfTree : function() {
        this.backgroundport.postMessage({request:"request2bkg_actionMoveWindowToTheEndOfTree", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },

    actionOpenLinkInNewWindow : function() {
        var model = this.ICursorOwner_getNodeModelAtCursor(); if(!model) return;
        var href = model.getHref(); if(!href) return;

        chrome.windows.getAll({}, function(chromeWindowObjects) {
            var chromeWindowObj = {'top':11, 'left':11, 'height':720, 'width':1024, 'id':0};

            // // Search last opened normal window to emulate new window creation in same position
            // chromeWindowObjects.forEach(function(winobj) {
            //     if( winobj['type'] == 'normal' && winobj['id'] >= chromeWindowObj.id ) chromeWindowObj = winobj;
            // });

            chrome.windows.create({
                'url': href,
                'top': chromeWindowObj.top + 11,
                'left': chromeWindowObj.left + 11,
                'height': chromeWindowObj.height,
                'width': chromeWindowObj.width
            });
        });
    },

    actionOpenLinkInNewTab : function() {
        var model = this.ICursorOwner_getNodeModelAtCursor(); if(!model) return;
        var href = model.getHref(); if(!href) return;

        window.open(href, '_blank');
    },


    // -------------------------------------------------------------

    addNoteAsParentOfCurrentNode : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAsParentOfCurrentNode", targetNodeIdMVC:this.cursoredNodeIdMVC });
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt

    },

    addNoteAsFirstSubnodeOfCurrentNode : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAsFirstSubnodeOfCurrentNode", targetNodeIdMVC:this.cursoredNodeIdMVC });
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt
    },

    addNoteAsLastSubnodeOfCurrentNode : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAsLastSubnodeOfCurrentNode", targetNodeIdMVC:this.cursoredNodeIdMVC });
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt
    },

    addNoteAsPrevSiblingOfCurrentNode : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAsPrevSiblingOfCurrentNode", targetNodeIdMVC:this.cursoredNodeIdMVC });
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt
    },

    addNoteAsNextSiblingOfCurrentNode : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAsNextSiblingOfCurrentNode", targetNodeIdMVC:this.cursoredNodeIdMVC });
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt
    },

    addNoteAtTheEndOfTree : function() {
        this.backgroundport.postMessage({request:"request2bkg_addNoteAtTheEndOfTree"});
        //-> will initiate editing by model.editTitle() -> msg2view_activateNodeNoteEditTextPrompt
    },

    actionAddSeparatorBelove : function() {
        this.backgroundport.postMessage({request:"request2bkg_actionAddSeparatorBelove", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },

    actionAddGroupAbove : function() {
        this.backgroundport.postMessage({request:"request2bkg_actionAddGroupAbove", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },

    // addHierarchyAsLastSubnodeOfCurrentNode : function(hierarchy) {
    //     var model = this.ICursorOwner_getNodeModelAtCursor(); if(!model) return;
    //
    //     model.setCollapsing(false);
    //
    //     var newnote = model.insertAsLastSubnode(hierarchy);
    //
    //     newnote.setCursorHereOrToFirstCollapsedParent(this.globalViewId_ICursorOwner);
    // },
    // -----------------------------------------------------------------------------------------------------------------


    moveCursor_toFirstSiblingInSameLevel : function() {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_toFirstSiblingInSameLevel", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },

    moveCursor_toLastSiblingInSameLevel : function() {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_toLastSiblingInSameLevel", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },


    // --

    moveCursor_up : function(bySiblings/*not implemented*/) {
        this.moveCursorUp(1);
    },

    moveCursor_pageUp : function() {
        this.moveCursorUp(this.PAGE_UP_DOWN_REPEAT);

    },

    moveCursorUp:function(repeat) {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_up", targetNodeIdMVC:this.cursoredNodeIdMVC, repeat:repeat });
    },

    // --

    moveCursor_down : function(bySiblings/*not implemented*/) {
        this.moveCursorDown(1);
    },

    moveCursor_pageDown : function() {
        this.moveCursorDown(this.PAGE_UP_DOWN_REPEAT);
    },

    moveCursorDown:function(repeat) {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_down", targetNodeIdMVC:this.cursoredNodeIdMVC, repeat:repeat });
    },

    // --

    moveCursor_toFirstSubnode : function() {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_toFirstSubnode_expandIfCollapsed", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },


    moveCursor_toParent_butNotToRoot : function() {
        this.backgroundport.postMessage({request:"request2bkg_moveCursor_toParent_butNotToRoot", targetNodeIdMVC:this.cursoredNodeIdMVC });
    },


    // -----------------------------------------------------------------------------------------------------------------

    togleCollapsedStateOfCursoredNode : function() {
        this.togleCollapsedStateOfNode(this.cursoredNodeIdMVC);
    },

    togleCollapsedStateOfNode : function(idMVC) {
        this.backgroundport.postMessage({request:"request2bkg_invertCollapsedState", targetNodeIdMVC:idMVC });
    },

    // -----------------------------------------------------------------------------------------------------------------
    isModalUiElementsActive :function(event) {
        var w_ =  event.target.ownerDocument.defaultView;
        return w_['modalEditPromptActive'] || w_['modalContextMenuActive'];
    },

    isNoteEditBoxActive :function(event) {
        var w_ =  event.target.ownerDocument.defaultView;
        return w_['modalEditPromptActive'] ;
    },

    setDragClipboardData : function(dataTransferObj, hierarchy) {
        // The order os setData is important for other programs
        // Read more there: https://developer.mozilla.org/en-US/docs/DragDrop/Recommended_Drag_Types

        //x-moz-url - не выявлено чтоб его вообще хоть ктото распознавал и понимал, его не понимает ни одна прога вообще, даже Firefox
        //dataTransaForDataTransferObj(dataTransferObj);
    },

    setDragClipboardData_fromHtmlStructure : function(dataTransfer, rowDom_hierarchyRoot) {
        try{

            // The order os setData is important for other programs
            // Read more there: https://developer.mozilla.org/en-US/docs/DragDrop/Recommended_Drag_Types

            //x-moz-url - не выявлено чтоб его вообще хоть ктото распознавал и понимал, его не понимает ни одна прога вообще, даже Firefox
            //dataTransfer.setData('text/x-moz-url',                   this.treeModel.makeTransferableRepresentation_MozUriList(hierarchy)); // Must go before text/uri-list

            // MM берёт первую строку text/plain (до \n) + линк из uri-list

            // Удобная херня для тестирования что там в dataTransferObj положилось: https://evercoder.github.io/clipboard-inspector/

            let data = this.makeTransferableRepresentation_UriList_Html_TextMultiline_fromHtml(rowDom_hierarchyRoot);

            for (const [key, value] of Object.entries(data)) {
                dataTransfer.setData(key, value);
            }

            try {
            dataTransfer.setData( 'application/x-tabsoutliner-items', 
                                this.makeTransferableRepresentation_TabsOutlinerInterchangeFormat_fromHtml(rowDom_hierarchyRoot._ref_nodeModel));
            } catch(e) {
                console.warn("dataTransfer.setData( 'application/x-tabsoutliner-items' ) meantime expected to fail in View connected to background service worker");
                // оно отрабатывает на backup views но крешет на настоящих изза
                // TypeError: nodeModel.cloneForCopyInActiveTree_withoutSubnodes is not a function
                // В результате покачто между разными инстансами TabsOutliner в разных профайлах драг и дроп невозможен не через backup view
                // бо 'application/x-tabsoutliner-items' не наполняются
            }

        } catch(e) {console.error(e)}


        // Это обслуживает кейс MOVE драгов в одном инстанс. Бесполезно для драгов/copy между инстанcами
        dataTransfer.setData(this.instanceUnicalClipboardDataMimeType, rowDom_hierarchyRoot.id);

        this.comminicateCurrentlyDraggedIdMVCToAllViews(rowDom_hierarchyRoot.id); // нужно потому что onDragEnter, которая отрисовывает запретный курсор
                                                                                         // если мы драгаем иерархию саму на себя не может прочитать dataTransferObj, это возможно только в onDrop
                                                                                         // а нам нужно в возможном окне клоне таки правильно курсор отрисовывать
    },

    onDragStartedInSomeView : function(response) {
        this.currentlyDragedIdMVC = response.currentlyDragedIdMVC;
    },

    comminicateCurrentlyDraggedIdMVCToAllViews : function(idMVC) {
        this.backgroundport.postMessage({request:"request2bkg_communicateDragStartDataToOtherViews", currentlyDragedIdMVC:idMVC }); // -> will call onDragStartedInSomeView() in all Views
    },

    serializeHierarchyAsJSO : function(hierarchy, serializeOpenNodesAsSaved) { // backward - restoreHierarchyFromJSO
        var r = {};
        (function doRecursiveSerialize_(nodeModel, container) {
            container['n']     = (serializeOpenNodesAsSaved ? nodeModel.cloneForCopyInActiveTree_withoutSubnodes() : nodeModel).serialize();

            // process subnodes
            if(nodeModel.subnodes.length > 0) {
                container['s'] = [];

                for(var i = 0; i < nodeModel.subnodes.length; i++) {
                    container['s'][i] = {};
                    doRecursiveSerialize_(nodeModel.subnodes[i], container['s'][i]);
                }
            }
        })(hierarchy || this.currentSession_rootNode, r);

        return r;
    },    

    makeTransferableRepresentation_TabsOutlinerInterchangeFormat_fromHtml : function(hierarchy) { // For 'application/x-tabsoutliner-items'
        // Note that serializeOpenNodesAsSaved := true also play important role to nulify
        // dId, cdId, sdId, sdIdKnot properties
        return JSON.stringify(this.serializeHierarchyAsJSO(hierarchy, true /*serializeOpenNodesAsSaved*/));
    },

    makeTransferableRepresentation_UriList_Html_TextMultiline_fromHtml : function(rowDom_hierarchyRoot) { // For 'text/uri-list'
        // Про 'text/uri-list' формат:
        // Вродебы что главный кейс для заполнения 'text/uri-list' это открыть веб страницу в броузере перетаскивание из дерева на строку табов
        //http://www.mozilla.org
        //#A second link
        //http://www.xulplanet.com
        // Title Коменты '#' не понимает вообще никто, ни ММ ни Firefox, ни Chrome
        // Подозреваю чтоб MM понимал надо тащить просто HTML <a> формат

        var indent = "";
        var ONE_LEVEL_INDENT = "    ";

        let rdata = {
            'text/uri-list' : [],
            'text/html' : "",
            'text/plain' : ""
        };


        (function doRecursive_(rowDom) {
            let nodeModel = rowDom._ref_nodeModel;

            if( nodeModel.isLink ) {
                rdata['text/uri-list'].push(nodeModel.getHref());
                rdata['text/html']    += '<li><a href="'+nodeModel.getHref()+'">'+nodeModel.getNodeText()+'</a></li>';
                rdata['text/plain']   += indent + nodeModel.getNodeText()+' ('+nodeModel.getHref()+')';

            } else {
              //rdata['text/uri-list'] do nothing if this not a link
                rdata['text/html']    += '<li>'+nodeModel.getNodeText()+'</li>';
                rdata['text/plain']   += indent + nodeModel.getNodeText();
            }

            rdata['text/plain'] += '\n';

            // process subnodes
            let subnodesHTML = getLevelOneSubnodesRowDomElements(rowDom);
            if(subnodesHTML.length > 0) {
                rdata['text/html'] += '<ul>';
                indent += ONE_LEVEL_INDENT;

                subnodesHTML.forEach((subnodeHtmlTree) => doRecursive_(subnodeHtmlTree));

                rdata['text/html'] += '</ul>';
                indent = indent.slice(0, -ONE_LEVEL_INDENT.length);
            }

        })(rowDom_hierarchyRoot);

        // Если в списке более одного линка Chrome берёт первый, а вот MM последний
        // Поэтому мы вообще тока один елемент будем тут возвращать
        // (немного туповато что мы всю иерархию обходим)
        rdata['text/uri-list'] = rdata['text/uri-list'][0] ?? '';

        return rdata;
    },

    cut : function(event) {
        if( this.isNoteEditBoxActive(event) ) return true; // run Default implementation

        let cursoredRowDom = this.getRowDomAtCursor(); if(!cursoredRowDom) return;

        this.setDragClipboardData_fromHtmlStructure(event.clipboardData, cursoredRowDom );

        this.deleteCurrentHierarchy(); // The CUT
        event.clipboardData.clearData(this.instanceUnicalClipboardDataMimeType ); // бо мы только что удалили это поддерево, будем вычитывать на вставке из 'application/x-tabsoutliner-items'


        // Зачем я делаю stopPropagation & preventDefault я не знаю, кейс не осмысливал, так, на всякий случай, возможно не надо
        event.stopPropagation();
        event.preventDefault();
    },

    copy : function(event) {
        if( this.isNoteEditBoxActive(event) ) return true; // run Default implementation

        let cursoredRowDom = this.getRowDomAtCursor(); if(!cursoredRowDom) return;

        this.setDragClipboardData_fromHtmlStructure(event.clipboardData, cursoredRowDom );

        // Зачем я делаю stopPropagation & preventDefault я не знаю, кейс не осмысливал, так, на всякий случай, возможно не надо
        event.stopPropagation();
        event.preventDefault();
    },

    paste : function(event) {
        if( this.isNoteEditBoxActive(event) ) return true; // run Default implementation

        let cursoredRowDom = this.getRowDomAtCursor(); if(!cursoredRowDom) return;

        var dropTarget = selectDropTarget(AS_LAST_SUBNODE, cursoredRowDom);

        this.performDrop( dropTarget, true, event.clipboardData );


        // var model = this.ICursorOwner_getNodeModelAtCursor(); if(!model) return;
        //
        // var x_tabsoutliner_data = event.clipboardData.getData('application/x-tabsoutliner-items');
        //
        // var nodesHierarchy;
        // if(x_tabsoutliner_data)
        //     nodesHierarchy = this.treeModel.createHierarchyFromTabsOutlinerInterchangeFormat( x_tabsoutliner_data );
        // else
        //     nodesHierarchy = this.treeModel.createNodeNote( event.clipboardData.getData('text/plain') );
        //
        // this.addHierarchyAsLastSubnodeOfCurrentNode(nodesHierarchy);

        // Зачем я делаю stopPropagation & preventDefault я не знаю, кейс не осмысливал, так, на всякий случай, возможно не надо
        event.stopPropagation();
        event.preventDefault();
    },

    connectClipboardListeners : function(window_) {
        // в качестве target/srcElement у нас обычно прилетает window_.document.body,
        // но иногда - вот так:input#modalEditPrompt-editField.form_input
        // Значит надо фильтровать когда edit mode

        // target.ownerDocument.defaultView в любом случае всегда даёт нам доступ к окну


        this.binded_paste = this.paste.bind(this); // Запоминаем чтоб было как вызвать removeEventListeners
        this.binded_copy = this.copy.bind(this); // Запоминаем чтоб было как вызвать removeEventListeners
        this.binded_cut = this.cut.bind(this); // Запоминаем чтоб было как вызвать removeEventListeners
        window_.addEventListener("paste", this.binded_paste);
        window_.addEventListener("copy", this.binded_copy);
        window_.addEventListener("cut", this.binded_cut);

        // todo - cool events to think about
        //    rowDom.onbeforecut
        //    rowDom.onbeforecopy
        //    rowDom.onbeforepaste

    },

    // -----------------------------------------------------------------------------------------------------------------

    deleteAllMembers : function(window_) {
        window_.removeEventListener("paste", this.binded_paste);
        window_.removeEventListener("copy", this.binded_copy);
        window_.removeEventListener("cut", this.binded_cut);
        this.binded_paste = null;
        this.binded_copy = null;
        this.binded_cut = null;

        this.activatePrompt = null;
        this.cursoredNodeRowDom = null;
        this.cursoredNodeidMVC = 0;
        this.treeTabIndex = null;
        this.dragedModelStorage = null;
        this.currentSessionRowDom = null;
        this.currentDragFeedbackHolder = null;
        this.dragFeedbackAsFirstChild = null;
        this.dragFeedbackAsSibling = null;
        this.dragFeedback = null;
        this.hoveringMenu.setOwner(null);
        this.hoveringMenu = null;
    },

    isRowDomCursored : function( rowDom ) {
        return rowDom.id == this.cursoredNodeIdMVC;
    },

    // isNodeModelCursored : function(nodeModel) {
    //     // После того как к примеру была выполнена операция deleteNodeAndPromoteSubnodesInPlace
    //     // А курсор находится на одной из субнод
    //     // Какаято из НОВЫХ генерирующихся rowDom несёт таки nodeModel что была раньше в уже в выкинутой из DOM cursoredNodeRowDom
    //     // И надо сравнивать именно модели чтоб правильно установить стили
    //     return this.ICursorOwner_getNodeModelAtCursor() === nodeModel;
    // },

    ICursorOwner_getNodeModelAtCursor : function() {
        var cursoredRowDom = this.getRowDomAtCursor();
        return !cursoredRowDom ? null : cursoredRowDom._ref_nodeModel;
    },

    getRowDomAtCursor : function() {
        return this.getRowDomByIdMVC(this.cursoredNodeIdMVC);
    },

    scrollIntoViewIfOutOfView_byShortestPath:function(element, window_) {
        var isAboveVisibleArea = element.offsetTop < window_.pageYOffset;
        var bottomMainPanelHeight = 70;
        var isBelowVisibleArea = element.offsetTop + element.offsetHeight > window_.pageYOffset + window_.innerHeight - this.bottomMainPanelHeight;
        var PADDING = 2;
        if(isAboveVisibleArea) window_.scrollTo(0, element.offsetTop - PADDING); // element.scrollIntoView(true);
        if(isBelowVisibleArea) window_.scrollTo(0, element.offsetTop - window_.innerHeight + (element.offsetHeight + PADDING) + this.bottomMainPanelHeight); // element.scrollIntoView(false);
    },

    removeCursorStyles: function(rowDom) {
        rowDom._ref_nodeTextWithAnchorDom.tabIndex = -1;
        rowDom.classList.remove(cursoredNodeCssClass);
        rowDom._ref_nodeTextWithAnchorDom.classList.remove(cursoredNodeCssClass);
    },

    setCursorToRowDomByIdMVC : function(idMVC, doNotScrollView) {
        this.setCursorToRowDom(this.getRowDomByIdMVC(idMVC));
    },

    setCursorToRowDom : 	function(rowDom, doNotScrollView) {
        if(!rowDom._ref_treeView) return; // Это не rowDom а чтото левое

        //removeFromTabOrder() // Если юзер уйдёт табом на другой контрол то когда вернётся он должен вернутся на прошлый селектнутый
        var oldCursoredRowDom = this.getRowDomByIdMVC(this.cursoredNodeIdMVC);
        if(oldCursoredRowDom)
            this.removeCursorStyles(oldCursoredRowDom); // -> this.removeCursorStyles(relatedRowDom)

        // Make  current
        this.cursoredNodeIdMVC = rowDom.id;

        // Кстате это дубликат алгоритма установки стилей который также юзается в makeRowDom, что какбы плохо
        rowDom.classList.add(cursoredNodeCssClass);
        rowDom._ref_nodeTextWithAnchorDom.classList.add(cursoredNodeCssClass);
        rowDom._ref_nodeTextWithAnchorDom.tabIndex = this.treeTabIndex; // Make tabIndex >= 0. Without This onblur & onfocus events will not work + читай комент комент возле tabIndex = -1;

        // doNotScrollView is true during drag&drop operations, to not scroll cloned & source windows when cursor is moved along with draged hierarchies
        if(!doNotScrollView) {
            this.scrollIntoViewIfOutOfView_byShortestPath(rowDom._ref_nodeTextWithAnchorDom, window); // можно не юзать кстате, .focus() тогда всегда будет скролить элемент объект в середину экрана
            rowDom._ref_nodeTextWithAnchorDom.focus();
        }

        //    // View methods ----------------------------------------------------------------------------------------------------
        //    rowDom.removeFromTabOrder = function(){
        //	    this._ref_nodeTextWithAnchorDom.tabIndex = -1;
        //    }
        //
        //    rowDom.takeFocus = function(treeTabIndex){
        //	    this._ref_nodeTextWithAnchorDom.tabIndex = treeTabIndex;
        //        this._ref_nodeTextWithAnchorDom.focus();
        //    }
    },

    // setCursorToDomElementWithId : function(nodeId, alternateNodeId /*will be selected if nodeId is collapsed and invisble */) {
    //     var rowDom = document.getElementById(nodeId);
    //     if(!rowDom)
    //         rowDom = document.getElementById(alternateNodeId); // Всёравно может не существовать и быть колапснута в другом узле : (
    //
    //     if(rowDom)
    //         this.setCursorToRowDom(rowDom);
    // },

    deferred_clearDragFeedback : function() {
        var _this = this;
        window.clearTimeout( this.dragFeedbackDefferedDrawTimer );
        this.dragFeedbackDefferedDrawTimer = window.setTimeout( function() {_this.clearDragFeedback()} , 26);
    },

    deferred_showDragFeedback : function(rowDom, dropPosition) {
        var _this = this;
        window.clearTimeout( this.dragFeedbackDefferedDrawTimer );
        this.dragFeedbackDefferedDrawTimer = window.setTimeout( function() {_this.showDragFeedback(rowDom, dropPosition)} , 26);
    },

    clearDragFeedback : function() {
        this.currentDragFeedbackHolder = null;

        if(this.dragFeedback.parentNode) this.dragFeedback.parentNode.removeChild(this.dragFeedback);
        // this.dragFeedback.style.visibility="hidden"; // сам элемент остаётся в дереве, ну и пох
    },

    showDragFeedback : function(rowDom, dropPosition) {
        if(dropPosition === AS_FIRST_SUBNODE)
            this.showDragFeedback_asFirstSubnode(rowDom._ref_nodeTextWithAnchorDom); // ибо rowDom ещё включает в себя таблицу субнод!
        else // "AS_NEXT_SIBLING"
            this.showDragFeedback_asNextSibling(rowDom);
    },

    showDragFeedback_asNextSibling : function(dragFeedBackHolder) {
       this._showDragFeedback(this.dragFeedbackAsSibling, dragFeedBackHolder)
    },

    showDragFeedback_asFirstSubnode : function(dragFeedBackHolder) {
        this._showDragFeedback(this.dragFeedbackAsFirstChild, dragFeedBackHolder, dragFeedBackHolder.offsetWidth);
    },

    _showDragFeedback : function(dragFeedback, dragFeedBackHolder, width) {
        this.clearHoveringMenu(null);

        if(this.currentDragFeedbackHolder === dragFeedBackHolder) return; // постоянно по несколько раз срабатывает для тогоже самого узла при

        this.currentDragFeedbackHolder = dragFeedBackHolder;

        // -------------------------------------------------------------------------------
        if(this.dragFeedback !== dragFeedback)
            this.clearDragFeedback();

        this.dragFeedback = dragFeedback;
        if(this.dragFeedback.parentNode) this.dragFeedback.parentNode.removeChild(this.dragFeedback); // Всю эту кучу css стоит менять на не подключенной к view ноде!!! реально быстрее пашет

        var abspos = findAbsolutePosition(dragFeedBackHolder);

        // Всю эту кучу css стоит менять на не подключенной к view ноде!!! реально быстрее пашет
        //this.dragFeedback.style.visibility="visible";

        if(width)
            this.dragFeedback.style.width = width + 'px';
        else // if undefined - fallback to css rules
            delete this.dragFeedback.style.width;

        this.dragFeedback.style.height = dragFeedBackHolder.offsetHeight + 'px'; //was pixelHeight //getting offsetHeight is CPU Intensive!
        this.dragFeedback.style.left = abspos.left + 'px';
        this.dragFeedback.style.top  = abspos.top + 'px';

        document.body.appendChild(this.dragFeedback); //помойму быстрее работает чем document.body.insertBefore(this.dragFeedback, this.treeDom);
    },

// show drag feedback по технологии Hovering menu - недоделано
//    _showDragFeedback : function(dragFeedbackDomStructure, dragFeedBackHolder, width) {
//        this.clearHoveringMenu(null);
//
//        console.log("_showDragFeedback");
//
//        if(this.currentDragFeedbackHolder === dragFeedBackHolder) return; // постоянно по несколько раз срабатывает для тогоже самого узла при
//
//        this.currentDragFeedbackHolder = dragFeedBackHolder;
//
//        // -------------------------------------------------------------------------------
//        if(this.dragFeedback !== dragFeedbackDomStructure)
//            this.clearDragFeedback();
//
//        this.dragFeedback = dragFeedbackDomStructure;
//
//        this.dragFeedback.style.visibility="visible"; // hidden ставится в clearDragFeedback
//
//        dragFeedBackHolder.insertBefore(this.dragFeedback, dragFeedBackHolder.firstChild);
//    },
//
//    clearDragFeedback : function() {
//        this.currentDragFeedbackHolder = null;
//
//        // if(this.dragFeedback.parentNode) this.dragFeedback.parentNode.removeChild(this.dragFeedback);
//        this.dragFeedback.style.visibility="hidden"; // сам элемент остаётся в дереве
//    },


    showHoveringMenu : function(nodeRowDom) {
        if(this.hoveringMenu.getOwner === nodeRowDom) return;

        // DOM кнопок стоит менять на не подключенной к view ноде!!! реально быстрее пашет (ну не факт... но не вредит это точно, скорее всего)
        if(this.hoveringMenu.parentNode) this.hoveringMenu.parentNode.removeChild(this.hoveringMenu);

        this.hoveringMenu.setOwner(nodeRowDom); // Тут кнопки строятся на hovering menu - DOM структура меняется

        this.hoveringMenu.style.visibility="visible"; // hiden ставится в clearHoveringMenu

        // Вставляем _после_ блока содержащий иконку и текст но перед субнодами
        // nodeRowDom.parentElement.insertBefore(this.hoveringMenu, nodeRowDom.nextSibling);
        nodeRowDom.insertBefore(this.hoveringMenu, nodeRowDom.firstChild);

        // this._showHoveringMenu(nodeRowDom/*._ref_nodeTextWithAnchorDom._ref_nodeFaviconAndTextContainerDom*/);
    },

    updateHoveringMenu : function(nodeRowDom) {
        this.hoveringMenu.setOwner(null);
        this.showHoveringMenu(nodeRowDom);
    },


    clearHoveringMenu : function(ownerNodeView) {
        this.hoveringMenu.setOwner(null);

        // if(this.hoveringMenu.parentNode) this.hoveringMenu.parentNode.removeChild(this.hoveringMenu);
        this.hoveringMenu.style.visibility="hidden"; // сам элемент остаётся в дереве
    },

// Тут есть закоменченный код внутри закоменченного кода который HoveringMenu в дерево ставил по типу dragFeedback
//    _showHoveringMenu : function(domElement) {
//
//        // Всю эту кучу css стоит менять на не подключенной к view ноде!!! реально быстрее пашет (ну не факт... но не вредит это точно, скорее всего)
//        if(this.hoveringMenu.parentNode) this.hoveringMenu.parentNode.removeChild(this.hoveringMenu);
//
//        // var abspos = findAbsolutePosition(domElement); // вобщето мы могли бы и не искать абсолютную позицию, мы и так вставляемся "в ноду"
//                                                    // и кстате это очень затратная операция, которая из-за доступа к offsetXxxx требует reflow
//        // var nodeTitleRightSidePosition = abspos.left + domElement.offsetWidth/*доступ к offsetWidth вызывает reflow!*/;
//
//        // var pageRightVisibleX = document.body.scrollLeft + document.body.clientWidth;
//
//        // var restrictedByRightWindowBorderMaxHoveringMenuPixelLeft = pageRightVisibleX/* могут в этой строке присутствовать панели открытые боковые*/
//        //                                                            - 30/*ховер меню может быть разной ширины*/; //this.hoveringMenu.style.pixelWidth;
//
//        // this.hoveringMenu.style.pixelLeft = restrictedByRightWindowBordeMaxPixelLeft; // прижато к границе окна
//
//        // алгорит который прижимал к ноде ховеринг меню - прикольно, но неудобно - и легко кликнуть close к примеру случайно
//        // this.hoveringMenu.style.pixelLeft = nodeTitleRightSidePosition < restrictedByRightWindowBorderMaxHoveringMenuPixelLeft ? nodeTitleRightSidePosition : restrictedByRightWindowBorderMaxHoveringMenuPixelLeft
//
//        // this.hoveringMenu.style.pixelLeft = restrictedByRightWindowBorderMaxHoveringMenuPixelLeft;
//        // this.hoveringMenu.style.pixelTop  = abspos.top;
//
//        this.hoveringMenu.style.visibility="visible";
//
//        // Вставляем _после_ блока содержащий иконку и текст но перед субнодами
//        // domElement.parentElement.insertBefore(this.hoveringMenu, domElement.nextSibling);
//        domElement.insertBefore(this.hoveringMenu, domElement.firstChild);
//    },

    performDrop : function ( dropTarget, dropAsCopy, dataTransferContainer ) {
        // Just a sample how to display a content of droped  event.dataTransfer

           // var items = dataTransferContainer['items']; // items become closured :(
           // for (var i = 0; i < items.length; ++i) {
           //   if (items[i].kind == 'file') {
           //       items[i].webkitGetAsEntry(function(entry) {
           //       console.log('webkitGetAsEntry: ', entry.name + (entry.isDirectory ? ' [dir]' : ''));
           //     });
           //   }
           //   else {
           //       console.log(items[i].kind);
           //       items[i].getAsString(function(str) {console.log('getAsString: ',str)});
           //   }
           //
           // }

        // let dataTransferContainerForMessage = {};
        // dataTransferContainer.types.forEach( (type) => dataTransferContainerForMessage[type] = dataTransferContainer.getData(type));
        // console.log(dataTransferContainerForMessage)


        function convertDataTransferToObject(dataTransferContainer) {
            return dataTransferContainer.types.reduce((r, type) => { r[type] = dataTransferContainer.getData(type); return r }, {/*accumulator that will be filled and returned*/});
        }


        this.backgroundport.postMessage({request:"request2bkg_performDrop",
            dataTransferContainer:convertDataTransferToObject(dataTransferContainer),
            instanceUnicalClipboardDataMimeType:this.instanceUnicalClipboardDataMimeType,
            dropTarget:dropTarget,
            dropAsCopy:dropAsCopy
        });
    },

    EOC:null
};


//innerHTMLvsDOM?
function makeSubnodesTableDom(window_, MVCDataTransferObject_subnodesList, treeView, isFullTreeBuild)
{
    var rTableDom = document.createElement("ul"); rTableDom.className = "subnodeslist";

    for( var i = 0; i < MVCDataTransferObject_subnodesList.length; i++)
        rTableDom.appendChild( makeNodeRowDom( window_, MVCDataTransferObject_subnodesList[i], treeView, isFullTreeBuild) );

    return rTableDom;
}

function consoleLogCallbackParameters(message, retvalue) {
    return function() {
        var a = [message];
        for(var i = 0; i < arguments.length; ++i)
            a.push(arguments[i]);

        console.log.apply(console, a);

        arguments[0].stopPropagation();
        if(retvalue) return retvalue;
    };
}

// Row methods =========================================================================================================
function RowDom_fromModel_requestScrollNodeToViewInAutoscrolledViews(forThisWindowOnly) {
    if(this.ownerDocument.defaultView.isAutoscrollView) {
        dispatchBubledCustomEvent(window, 'before_scroll_node_to_view'); // Даём возможность функционалу ундо скрола запомнить текущую позицию

        // this._ref_nodeTextWithAnchorDom.scrollIntoView(); // Если делать после применения класса иногда класс почемуто применяется но не рендерится изменения, баг хрома
        scrollIntoViewAnimated( this._ref_nodeTextWithAnchorDom );
    }
}

// function RowDom_fromModel_setCursorHere(globalViewId_ICursorOwner, doNotScrollView) {
//     if(globalViewId_ICursorOwner === this._ref_treeView.globalViewId_ICursorOwner) this.setCursorHere(doNotScrollView);
// }

function RowDom_fromModel_removeCursorStyles(ICursorOwner) {
    if(ICursorOwner === this._ref_treeView) this._ref_treeView.removeCursorStyles(this);
}

function RowDom_fromModel_onNodeUpdated(modelDataCopy) {
    var isCursored = this.isUnderCursor();

    this.updateNodeCssClasses(modelDataCopy, isCursored); // Actualy this is only because _ref_nodeModel.getNodeContentCssClass() might change
    this._ref_nodeTextWithAnchorDom.updateNodeTitle(modelDataCopy, isCursored, false/*isFullTreeBuild*/);
}

// вызывается только для колапснутых нод и только если изменения были в деревьях субнод а не самих субнодах
// изменения в непосредственных субнодах обаработаются в fromModel_onSubnodeInserted и fromModel_onSubTreeDeleted
// function RowDom_fromModel_onChangesInSubnodesTrees() {
//     this.updateNodeAnchorImageAndCollapsedStatDom();
// }

function RowDom_updateNodeAnchorImageAndCollapsedStatDom() {
    this._ref_nodeTextWithAnchorDom.updateNodeAnchorImageAndCollapsedStatDom(this.ownerDocument.defaultView, this._ref_nodeModel, this.isUnderCursor() );
}

function RowDom_updateNodeAnchorImageAndCollapsedStatDom_inAllParents(parentsUpdateData) {
    // parentsUpdateData collection of objects with updates for parents
    // r[nodeModel.idMVC] = {
    //     isSubnodesPresent : nodeModel.subnodes.length > 0,
    //     isCollapsed       : nodeModel.colapsed,
    //     subnodesStatBlock : nodeModel.colapsed ? nodeModel.countSubnodes({'nodesCount':0, 'activeWinsCount':0, 'activeTabsCount':0}) : null;
    // };

    for(let rowDom = this; rowDom; rowDom = rowDom.parent) {
        if(rowDom._ref_nodeModel) rowDom._ref_nodeModel.updateSubnodesInfoForViewAfterChangesInSubnodes(parentsUpdateData[rowDom.id]);

        rowDom.updateNodeAnchorImageAndCollapsedStatDom();
    }
}

function isElementIsPresentInParentsPathRoot(testedElement, elemementToSearchInPathToRoot) {
    for(let e = testedElement; e; e = e.parent)
        if(e == elemementToSearchInPathToRoot) return true;

    return false;
}

function RowDom_fromModel_onSubnodesCollapsingStatusChanged(node_MVCDataTransferObject) {
    //if(!this._ref_nodeModel.isSubnodesPresent()) return
    var nodeModel = new NodeModelMVCDataTransferObject(node_MVCDataTransferObject);

    this._ref_nodeModel = nodeModel;

    this.updateNodeAnchorImageAndCollapsedStatDom();

    this._ref_treeView.updateHoveringMenu(this);

    var subnodesDom = getSubnodesDom_makeIfNotPresent(this.ownerDocument.defaultView, this, nodeModel.subnodes, this._ref_treeView, false);
    if( this._ref_nodeModel.colapsed )
        ShowHideCollapsingAnimator.doCollapsingAndRemove(                subnodesDom );
    else
        ShowHideCollapsingAnimator.doAppendIfNotPresentThenExpand( this, subnodesDom );

    // Возможно нас свернули а курсор находился в субнодах, тогда его надо выставить наверх --------------------------------------------
    // это нужно только для клонированых окон
    // бо в текущем окне курсор и так устанавливается коректно кликом или по клавишам
    // Не факт что вообще это сильно надо так как может быть это хорошо бы было чтоб позиция курсора запоминалась в свернутой иерархии в не текущем окне
    if( this._ref_nodeModel.colapsed )
        if(isElementIsPresentInParentsPathRoot(this._ref_treeView.getRowDomAtCursor(), this))
            this.setCursorHere();
}

function RowDom_fromModel_onBeforeReplaced_RememberCursor() {
    // Нас вызывают на том узле который счас будет выкинут из дерева
    if( this.isUnderCursor()  )
        this._ref_treeView._ref_tmp_needSetCursorOnReplacer = true; // Удаляется в RowDom_fromModel_onAfterReplaced_SetCursor
}
function RowDom_fromModel_onAfterReplaced_SetCursor() {
    // Нас вызывают на том узле который был тока что вставлен вместо удалённого
    if(this._ref_treeView._ref_tmp_needSetCursorOnReplacer) {
        this.setCursorHere();
        delete this._ref_treeView._ref_tmp_needSetCursorOnReplacer;
    }
}

function RowDom_isUnderCursor() {
    return this._ref_treeView.isRowDomCursored(this)
}

function RowDom_setCursorHere(doNotScrollView) {
    this._ref_treeView.setCursorToRowDom(this, doNotScrollView);
}

function getRowDomTypedParent(htmlNode) {
    var r = htmlNode.parentNode;
    while(r && !r._isRowDom) r = r.parentNode;
    return r;
}

// function RowDom_fromModel_onBeforeDeleteHierarchy_MoveCursor() {
//     // По факту, скорее всего это сообщение прийдет месагой уже после того как иерархия была удалена из дерева!!!
//
//     var currentCursoredNodeModel = this._ref_treeView.ICursorOwner_getNodeModelAtCursor();
//
//     if(this.isUnderCursor() || currentCursoredNodeModel.isSupliedNodePresentInPathToRoot(this._ref_nodeModel) ) {
//         var nextCursorHolder = this._ref_nodeModel.findNextSibling_ifAbsent_anyParentsNextSibling();
//         if(!nextCursorHolder)
//             nextCursorHolder = this._ref_nodeModel.findNodeOnPrevRow();
//
//         if(nextCursorHolder) nextCursorHolder.setCursorHereOrToFirstCollapsedParent(this._ref_treeView.globalViewId_ICursorOwner);
//     }
// }

function RowDom_fromModel_afterCopyPlacedDuringMove_TransferCursor() {
    //if( this.isUnderCursor() ) insertedCopy.setCursorHereOrToFirstCollapsedParent(this._ref_treeView.globalViewId_ICursorOwner, true/*doNotScrollView*/); // Мы не скролим Views во время D&D операций чтоб не терять позиции source окна (и других views) при драгах в клон за границы видимой области
}

function RowDom_remove_ref_subnodesDom(rowDom) {
    if(rowDom._ref_subnodesDom && rowDom._ref_subnodesDom.parentElement) // Если узлы свёрнуты  this._ref_subnodesDom != null но он не добавлен в парент!
        rowDom._ref_subnodesDom.remove();
    rowDom._ref_subnodesDom = null;
}

function createSubnodesListWithFirstSubnode(parentRowDom, newNode_MVCDataTransferObject) {
    RowDom_remove_ref_subnodesDom(parentRowDom);

    appendSubnodesDomIfSubnodesVisible(
        parentRowDom.ownerDocument.defaultView,
        parentRowDom,
        parentRowDom._ref_nodeModel.colapsed,
        [newNode_MVCDataTransferObject],
        parentRowDom._ref_treeView,
        false);
}

function RowDom_fromModel_onSubnodeInserted(newNode_MVCDataTransferObject, newNodeIndex, isInsertedInLastRow, isSubnodesWasEmptyBeforeInsert, parentsUpdateData) {
    var newNode_MVCDataTransferObject = new NodeModelMVCDataTransferObject(newNode_MVCDataTransferObject);

    if (isSubnodesWasEmptyBeforeInsert) { 
        // Это был раньше узел без субнод вообще - нет HTML структуры для subnod!
        // точнее не должно ее быть, но она таки откудато есть как оказалось изза бага
        //console.log("RowDom_fromModel_onSubnodeInserted isSubnodesWasEmptyBeforeInsert", this._ref_nodeModel, newNode_MVCDataTransferObject, newNodeIndex, isInsertedInLastRow, isSubnodesWasEmptyBeforeInsert, parentsUpdateData)
        createSubnodesListWithFirstSubnode(this, newNode_MVCDataTransferObject);
    } else if(this._ref_subnodesDom) {// Подузлы уже были, и отрендерены в HTML // их может не быть, если узел был свёрнут, или раньше небыло вообще субнод, И они могут быть но не иметь parent - если узел был свёрнут юзером
        if(this._ref_nodeModel.colapsed) {
            //console.log("RowDom_fromModel_onSubnodeInserted _ref_subnodesDom + colapsed", this._ref_nodeModel, newNode_MVCDataTransferObject, newNodeIndex, isInsertedInLastRow, isSubnodesWasEmptyBeforeInsert, parentsUpdateData)
            RowDom_remove_ref_subnodesDom(this); // will recreate on expand from scratch
        } else {
            //console.log("RowDom_fromModel_onSubnodeInserted _ref_subnodesDom + !colapsed", this._ref_nodeModel, newNode_MVCDataTransferObject, newNodeIndex, isInsertedInLastRow, isSubnodesWasEmptyBeforeInsert, parentsUpdateData)
            this._ref_subnodesDom.insertBefore( makeNodeRowDom(this.ownerDocument.defaultView, newNode_MVCDataTransferObject, this._ref_treeView, false),
                                                getChildElement(this._ref_subnodesDom, newNodeIndex));
        }
    } else { // was not empty && no _ref_subnodesDom - it was colapsed then, but if not - it's an  error
        if(!this._ref_nodeModel.colapsed) {
            // we might recreate subnodes here, but this situation must not happen, and we do not have original this._ref_nodeModel.subnodes to insert newly added subnode
            console.error("RowDom_fromModel_onSubnodeInserted, parent node was not empty or collapsed but dont have _ref_subnodesDom ");
        } else {
            /*do nothing, субноды свернуты, вставим при развороте*/;
        }
    }

    if(newNode_MVCDataTransferObject.previousIdMVC == this._ref_treeView.cursoredNodeIdMVC) {// Это была только что вставлена, при move операции, нода с курсором, нужно курсор на новом месте перерисовать
        let insertedRowDom = getNodeRowDomByIdMVC(newNode_MVCDataTransferObject.idMVC);
        if(insertedRowDom) //может быть null если была вставлена в свернутую иерархию, теоретически курсор там кудато переставился коректно когда она была выдергнута и з дерева
            this._ref_treeView.setCursorToRowDom(insertedRowDom, false);
    }


    this.updateNodeAnchorImageAndCollapsedStatDom_inAllParents(parentsUpdateData);

    // Ничего не делаем если узел уже содержал субноды, но в данный момент просто свёрнут
}

// allNodesIdMVCsOfDeletedHierarchy - Список удаленных узлов и nextCursorHolderIdMVC передаются чтоб если там был курсор на комто из удаленных нод оно его переставило на nextCursorHolderIdMVC
function RowDom_fromModel_onSubTreeDeleted( nodeToDeleteIdMVC, 
                                            isSubnodesListEmpty, 
                                            allNodesIdMVCsOfDeletedHierarchy, 
                                            nextCursorHolderInCaseCursoredElementsAffectedIdMVC, 
                                            parentsUpdateData) {

    var nodeToDelete = this._ref_treeView.getRowDomByIdMVC(nodeToDeleteIdMVC);
    let parentOfDeletedNode = this; //getRowDomTypedParent(this);

    removeNodeAndSetCursor(nodeToDelete, isSubnodesListEmpty, parentOfDeletedNode, parentsUpdateData, allNodesIdMVCsOfDeletedHierarchy, nextCursorHolderInCaseCursoredElementsAffectedIdMVC);
}

// allNodesIdMVCsOfDeletedHierarchy - Список удаленных узлов и nextCursorHolderIdMVC передаются чтоб если там был курсор на комто из удаленных нод оно его переставило на nextCursorHolderIdMVC
function RowDom_fromModel_onRemoveSubnodeAndPromoteItsSubnodessInPlace( nodeToDeleteIdMVC, 
                                                                        isSubnodesListEmpty, 
                                                                        allNodesIdMVCsOfDeletedHierarchy, 
                                                                        nextCursorHolderInCaseCursoredElementsAffectedIdMVC, 
                                                                        parentsUpdateData) {


    var nodeToDelete = this._ref_treeView.getRowDomByIdMVC(nodeToDeleteIdMVC);
    let parentOfDeletedNode = this; //getRowDomTypedParent(this);

    // Move all child nodes to the parent
    if(nodeToDelete) {// Может не быть если иерархия свернута. но нам всеравно еще надо проапдейтить стат блоки у парентов поэтому выполняемся дальше
        let leveloneSubnodes = getLevelOneSubnodesRowDomElements(nodeToDelete);
        if(leveloneSubnodes) //Их может не быть если узел свернут
            leveloneSubnodes.forEach( (subnodeTree) => nodeToDelete.parentNode.insertBefore(subnodeTree, nodeToDelete) );
    }

    removeNodeAndSetCursor(nodeToDelete, isSubnodesListEmpty, parentOfDeletedNode, parentsUpdateData, allNodesIdMVCsOfDeletedHierarchy, nextCursorHolderInCaseCursoredElementsAffectedIdMVC);
}

function removeNodeAndSetCursor(nodeToDelete, isSubnodesListEmpty, parentOfDeletedNode, parentsUpdateData, allNodesIdMVCsOfDeletedHierarchy, nextCursorHolderInCaseCursoredElementsAffectedIdMVC) {

    // Remove the empty element
    if(nodeToDelete) { // може не бути в document бо була сгорнута и ваще в идеале б ще перевырити чи то реально Child текущего узла
       nodeToDelete.remove();

        if(isSubnodesListEmpty)
            RowDom_remove_ref_subnodesDom(nodeToDelete);
    }

    parentOfDeletedNode.updateNodeAnchorImageAndCollapsedStatDom_inAllParents(parentsUpdateData);

    // Перестановка курсора - если он был на комто из удаленных узлов то поставить его в nextCursorHolderIdMVC
    // в модели nextCursorHolderIdMVC расчитывается как узел на следующей строке после удаленной иерархии или если нет такого (это последняя в дереве иерархия)
    // тогда на узел на строке перед ней
    if(allNodesIdMVCsOfDeletedHierarchy.includes(parentOfDeletedNode._ref_treeView.cursoredNodeIdMVC) ) // + because cursoredNodeIdMVC is a string
        parentOfDeletedNode._ref_treeView.setCursorToRowDomByIdMVC(nextCursorHolderInCaseCursoredElementsAffectedIdMVC,false);
}

// function RowDom_fromModel_onRemoveSelfAndPromoteSubnodesInPlace( nextCursorHolderInCaseCursoredElementsAffectedIdMVC) {
//     let deletedNodeWasUnderCursor = this.isUnderCursor();

//     let leveloneSubnodes = getLevelOneSubnodesRowDomElements(this);
//     let parent = this.parentNode; //getRowDomTypedParent(this);

//     // Move all child nodes to the parent
//     leveloneSubnodes.forEach( (subnodeTree) => parent.insertBefore(subnodeTree, this) );

//     // Remove the empty element
//     this.remove();

//     if(deletedNodeWasUnderCursor) this._ref_treeView.setCursorToRowDomByIdMVC(nextCursorHolderInCaseCursoredElementsAffectedIdMVC,false);
// }

function RowDom_fromModel_onProtectedOnCloseAndStatBlockUpdate(updateData) {
    this._ref_nodeModel.updateSubnodesInfoForViewAfterChangesInSubnodes(updateData);
    this.updateNodeAnchorImageAndCollapsedStatDom();
}

function RowDom_fromHtml_onAnchorClicked(event){
    this._ref_treeView.togleCollapsedStateOfNode(this.id);

    event.stopPropagation(); // Или он во всех парентах засветится и всё свернётся
}

function RowDom_fromHtml_onHoveredMenuActionBtnClicked(event){
    // this тут это HTML object, LI обычно
    this._ref_treeView.backgroundport.postMessage({request:"request2bkg_activateHoveringMenuActionOnNode", targetNodeIdMVC:this.id, actionId:event['detail'].actionId });

    event.stopPropagation(); // Или он во всех парентах засветится и всё свернётся
}

function RowDom_fromHtml_onNodeTextWithAnchorDomHovered(event) {
// Раньше это делалось внутри makeNodeRowDom() так (с помощью клозуры):
//rowDom._ref_nodeTextWithAnchorDom.onmouseover = function(event) { // Раньше было повешено сразу на rowDom. Но так плохо - меню скачет на парента неприятно когда мы попадаем в дырки между тайтлами субнод или после них
//    // К сожалению тут похоже не обойтись без клозуры бо this := _ref_nodeTextWithAnchorDom если мы цепляемся к rowDom._ref_nodeTextWithAnchorDom.onmouseover
//    // Есть ещё вариант либо конвертить этот эвент в custom и перекидывать в rowDom и обрабатывать уже тут
//    // либо делать обработку тут но итерировать от srcElement.parentNode и смотреть или между ним и rowDom таки есть _ref_nodeTextWithAnchorDom (тоесть что это таки _ref_nodeTextWithAnchorDom иерархия, а не rowDom)
//    // но все эти варианты помойму хуже простой клозуры с запоминанием rowDom
//    rowDom._ref_treeView.showHoveringMenu(rowDom);
//
//    // rowDom ВЛОЖЕННЫ ДРУГ В ДРУГА!!! поэтому все эвенты без event.stopPropagation(); мы увидим и в нодах-анцесторах
//    // в этих наших листенарах. Надо или проверять таржет === this или stopPropagation() делать
//    // выбрано stopPropagation() чтоб минимизировать лишнее code execution
//    event.stopPropagation(); // Без этого дико глючило, возможно можно както иначе по таржет === this раздуплится, но лень + минус тормоза так, бо в анцесторов тоже есть этот метод
//    // Хотя вобщето это уже не важно если мы вешаем на _ref_nodeTextWithAnchorDom а не rowDom, но пусть будет
//};
// Теоретически это быстрее но уж очень не хотелось этой клозуры создавать на каждой ноде

    this._ref_treeView.showHoveringMenu(this);

    event.stopPropagation();
}

function RowDom_fromHtml_onNodeTextWithAnchorDomActivated(event) {
    // this тут это HTML object, LI обычно
    this._ref_treeView.backgroundport.postMessage({request:"request2bkg_activateNode", targetNodeIdMVC:this.id, isAlternativeRestore:(event['detail'] && event['detail']['altKey']) });

    event.stopPropagation();
}

function RowDom_fromHtml_onNodeTextWithAnchorDomFocused(event) {
    if(!this.isUnderCursor()) // this prevent problems in node edit mode when user will click by mouse to move cursor in line
        this.setCursorHere();

    event.stopPropagation();
}

function RowDom_updateNodeCssClasses(newNode_MVCDataTransferObject, isCursored) {
    var classes = "nodeTitleAndSubnodesContainer " + newNode_MVCDataTransferObject.titleCssClass + "NTASC NTASC-" + newNode_MVCDataTransferObject.titleBackgroundCssClass; // TODO Все вот эти + "NTASC" жуткие вообщето можно откинуть и секономить на времени и временных объектах на слейку, тоже самое с NTC
    if(newNode_MVCDataTransferObject.getNodeContentCssClass()) classes += " NCC-NTASC-" + newNode_MVCDataTransferObject.getNodeContentCssClass();
    if(isCursored) classes += " " + cursoredNodeCssClass;

    if(this.className != classes) this.className = classes;
}


//innerHTMLvsDOM?
function makeNodeRowDom(window_, newNode_MVCDataTransferObject, treeView, isFullTreeBuild)
{
    var rowDom = document.createElement("li"); // rowDom.className = "nodeTitleAndSubnodesContainer " + nodeModel.titleCssClass + "NTASC " + nodeModel.titleBackgroundCssClass + "NTASC";

    //rowDom.idMVC = nodeModel.idMVC;

    //TODO вынести все _ref_ в NodeView
    rowDom._ref_nodeModel = newNode_MVCDataTransferObject;
    rowDom._ref_treeView = treeView;
    //rowDom.id = nodeModel.id;
    rowDom.id = newNode_MVCDataTransferObject.idMVC;

    rowDom._isRowDom = true;

    rowDom.updateNodeAnchorImageAndCollapsedStatDom_inAllParents = RowDom_updateNodeAnchorImageAndCollapsedStatDom_inAllParents;
    rowDom.updateNodeAnchorImageAndCollapsedStatDom              = RowDom_updateNodeAnchorImageAndCollapsedStatDom;
    rowDom.isUnderCursor                                         = RowDom_isUnderCursor;
    rowDom.setCursorHere                                         = RowDom_setCursorHere;
    rowDom.updateNodeCssClasses                                  = RowDom_updateNodeCssClasses;

    var isCursored = rowDom.isUnderCursor();

    rowDom.updateNodeCssClasses(newNode_MVCDataTransferObject, isCursored); // Set rowDom.className

    // Линия ведущая к узлу -----------------------------------------------------------------------
    if(newNode_MVCDataTransferObject.marks.relicons.length > 0) rowDom.appendChild( makeRelLineWithIconsDom(window_, newNode_MVCDataTransferObject.marks.relicons) );

    // Сам узел -----------------------------------------------------------------------------------
    rowDom._ref_nodeTextWithAnchorDom = makeNodeTextWithAnchorDom(window_, newNode_MVCDataTransferObject, treeView.isOneClickToActivateMode, isCursored, isFullTreeBuild);
    rowDom.appendChild( rowDom._ref_nodeTextWithAnchorDom );

    rowDom.addEventListener('node_expand_collapse_anchor_activated', RowDom_fromHtml_onAnchorClicked); // Этот эвент возникает на rowDom._ref_nodeTextWithAnchorDom и всплывает сюда по DOM, перехватывая его тут мы получаем коректный this
    rowDom.addEventListener('hovering_menu_action_btn_activated',    RowDom_fromHtml_onHoveredMenuActionBtnClicked);
    rowDom.addEventListener('node_hovered',                          RowDom_fromHtml_onNodeTextWithAnchorDomHovered); // Warning! для оптимизации 'node_hovered' эвент сразу кидается на nodeTextWithAnchorDom.parentNode - значит его на NodeTextWithAnchorDom ловить бесполезно (без фикса firing метода)
    rowDom.addEventListener('node_activated',                        RowDom_fromHtml_onNodeTextWithAnchorDomActivated);
    rowDom.addEventListener('node_focused',                          RowDom_fromHtml_onNodeTextWithAnchorDomFocused); // раньше было повешено на rowDom.onmousedown - плохо, бо это приводило к тому что клик на вертикальную линию селектал хрен знает кого и скролил view к нему - особенно неудобно когда к Current Session скролилио при клике слева в пустоту

    connectDragControllers( rowDom );

    // Подузлы ------------------------------------------------------------------------------------
    appendSubnodesDomIfSubnodesVisible(window_, rowDom, newNode_MVCDataTransferObject.colapsed, newNode_MVCDataTransferObject.subnodes, rowDom._ref_treeView, isFullTreeBuild);

    // Реестрируем обсерверы на модель ---------------------------------------------------------------------------------
    //nodeModel.observers.push(rowDom);

    // fromModel_ events processing ------------------------------------------------------------------------------------
    //rowDom['fromModel_setCursorHere']                                          = RowDom_fromModel_setCursorHere;

    //TODO нах через модель, он никогда из модели не вызывается, всегда из view причом только для себя самого (ICursorOwner юзает для фильтрации)
    rowDom['fromModel_removeCursorStyles']                                     = RowDom_fromModel_removeCursorStyles;

    rowDom['fromModel_requestScrollNodeToViewInAutoscrolledViews']             = RowDom_fromModel_requestScrollNodeToViewInAutoscrolledViews;
    rowDom['fromModel_onNodeUpdated']                                          = RowDom_fromModel_onNodeUpdated;
    rowDom['fromModel_onSubnodesCollapsingStatusChanged']                      = RowDom_fromModel_onSubnodesCollapsingStatusChanged;
    rowDom['fromModel_onSubnodeInserted']                                      = RowDom_fromModel_onSubnodeInserted;
    rowDom['fromModel_onSubTreeDeleted']                                       = RowDom_fromModel_onSubTreeDeleted;
    rowDom['fromModel_onProtectedOnCloseAndStatBlockUpdate']                   = RowDom_fromModel_onProtectedOnCloseAndStatBlockUpdate;
//    rowDom['fromModel_onChangesInSubnodesTrees']                             = RowDom_fromModel_onChangesInSubnodesTrees; // Вызывается только для колапснутых нод для пересчёта стат блока

    rowDom['fromModel_onBeforeReplaced_RememberCursor']                        = RowDom_fromModel_onBeforeReplaced_RememberCursor;
    rowDom['fromModel_onAfterReplaced_SetCursor']                              = RowDom_fromModel_onAfterReplaced_SetCursor;
    rowDom['fromModel_onRemoveSubnodeAndPromoteItsSubnodessInPlace']           = RowDom_fromModel_onRemoveSubnodeAndPromoteItsSubnodessInPlace;
//    rowDom['fromModel_onBeforeDeleteHierarchy_MoveCursor']                   = RowDom_fromModel_onBeforeDeleteHierarchy_MoveCursor;
//    rowDom['fromModel_afterCopyPlacedDuringMove_TransferCursor']             = RowDom_fromModel_afterCopyPlacedDuringMove_TransferCursor;


    return rowDom;
}

function getChildElement(ancestorElement, index) {
    return (ancestorElement.childNodes.length > index)? ancestorElement.childNodes[index] : null;
}

function filterOutFavIconsInHtml(htmlText)
{
    return htmlText.replace(/<img[^>]*>/g, '');
}

function getOwnPositionInParentRowDomSubnodes(rowDom) {
    let parentSubnodeRowDomElements = [...getLevelOneSubnodesRowDomElements(getParentRowDom(rowDom))];
    return parentSubnodeRowDomElements.indexOf(rowDom);
}

function getLevelOneSubnodesRowDomElements(rowDom) {
    return rowDom.querySelectorAll(`#${rowDom.id} > ul > li`);
}

function getParentRowDom(rowDom) {
    do {
        rowDom = rowDom.parentNode;
    } while(rowDom && !rowDom._isRowDom);

    return (rowDom && rowDom._isRowDom) ? rowDom : null;

}

function findPrevSibling_RowDom(rowDom) {
    var parent = getParentRowDom(rowDom);
    if(!parent) return null;

    let parentSubnodeRowDomElements = [...getLevelOneSubnodesRowDomElements(parent)];
    var ourIndex = parentSubnodeRowDomElements.indexOf(rowDom);

    if(ourIndex === 0) { // Мы первая сабнода
        return null;
    } else { // Перед нами таки есть сиблинги
        return parentSubnodeRowDomElements[ourIndex-1];
    }

}

function findPrevSibling_ifAbsent_parent_RowDom(rowDom) {
    var r = findPrevSibling_RowDom(rowDom);
    if(!r) // это когда мы первая субнода у нашего парента
        return getParentRowDom(rowDom);
    else
        return r;
}

function findNextSibling_ifAbsent_anyParentsNextSibling_RowDom(rowDom) {
    var parent = getParentRowDom(rowDom);
    if(!parent) return null;

    let parentSubnodeRowDomElements = [...getLevelOneSubnodesRowDomElements(parent)];
    var ourIndex = parentSubnodeRowDomElements.indexOf(rowDom);

    if((ourIndex + 1) < parentSubnodeRowDomElements.length) // Ниже есть ещё сиблинги на томже уровне
        return parentSubnodeRowDomElements[ourIndex + 1];
    else                                        // Это последняя нода, ниже на этом уровне ничего нет
        return findNextSibling_ifAbsent_anyParentsNextSibling_RowDom(parent);
}

// D&D -----------------------------------------------------------------------------------------------------------------
var AS_FIRST_SUBNODE = "DROP_AS_FIRST_SUBNODE";
var AS_LAST_SUBNODE  = "AS_LAST_SUBNODE";
var AS_PREV_SIBLING  = "AS_PREV_SIBLING";
var AS_NEXT_SIBLING  = "AS_NEXT_SIBLING";


function selectDropTarget(dropPosition, hoveredRowDom) {
    var r = {};

    if        (dropPosition === AS_FIRST_SUBNODE) {
        r.containerIdMVC = hoveredRowDom.id;
        r.position       = 0;
    } else if (dropPosition === AS_LAST_SUBNODE) {
        r.containerIdMVC = hoveredRowDom.id;
        r.position       = -1;
    } else if (dropPosition === AS_PREV_SIBLING) {
        r.containerIdMVC = getParentRowDomIdOrNull(hoveredRowDom);
        r.position       = getOwnPositionInParentRowDomSubnodes(hoveredRowDom);
    } else {// "AS_NEXT_SIBLING"
        r.containerIdMVC = getParentRowDomIdOrNull(hoveredRowDom);
        r.position       = getOwnPositionInParentRowDomSubnodes(hoveredRowDom) + 1;
    }

    return r;
}

function isDropAllowed(dropTarget, dropedNodeModelIdMVC) {
    if(!dropedNodeModelIdMVC) return false;

    function isSameNodeOrPresentInPathToRoot(dropTargetContainerIdMVC, dropedNodeModelIdMVC) {
        for(var testnode = getNodeRowDomByIdMVC(dropTargetContainerIdMVC); testnode; testnode = testnode.parentNode )
            if(testnode.id === dropedNodeModelIdMVC) return true;
        return false;
    }

    if(!dropTarget) return false; // Такое бывает когда юзер к примеру пытается драгать курсор над узлом активной сессии (без парента) в режиме дропнуть как сиблинг

    if( isSameNodeOrPresentInPathToRoot(dropTarget.containerIdMVC, dropedNodeModelIdMVC) ) return false;

    return true; // dropTarget.container.isDropAllowed(dropTarget.position, dropedNodeModel); // false возвращает только сепаратор пока что... На самом деле все возращали true
}

function getParentRowDomIdOrNull(hoveredRowDom) {
    var parentRowDom = getParentRowDom(hoveredRowDom); // can be null if no parent

    return parentRowDom != null ? parentRowDom.id : null;
}



function isUrlStartWithValidSchema(url) {
    return /^[A-z0-9-.+]+:\S/.test(url); //\S - non whitespace character, most of the time this will be "/", but mailto:user might have "u"
}

function isElementPresentInPathFromTo(element, from, to) {
    for(var i = from; i && i != to; i = i.parentNode)
        if(i == element)
            return true;

    return false;
}

function connectDragControllers( rowDom )
{
    // rowDom ВЛОЖЕННЫ ДРУГ В ДРУГА!!! поэтому все эвенты без event.stopPropagation(); мы увидим и в нодах анцесторах
    // в этих наших листенарах. Надо или проверять таржет === this или stopPropagation() делать
    // выбрано stopPropagation() чтоб минимизировать лишнее code execution

    // Обяснения работы HTML5 D&D:
    //
    // http://www.quirksmode.org/blog/archives/2009/09/the_html5_drag.html
    // The dragover and dragenter events exist for the sole reason of forcing web developers
    // who want to perform a drop action _to cancel their obscure default actions._
    // Поэтому в обоих этих методах если мы хотим чтоб дроп таки произошол надо делать
    // return false; - что отменяет дефолтный обработчик эвента
    // если "true" вернуть работы не выйдет : ))) дефолтный бехавиор "_запрещает_ дроп" и возвращая false мы это отменяем
    // Таким образом для запрета дропа - надо вернуть true + event.dataTransfer.dropEffect = 'none' мона поставить -
    // но возможно это лишнее, так как курсор потом надо будет скорее всего возвращать на нормальный в ondragenter другого узла
    //
    // Внимание - и dragover и dragenter должны синхронно возвращать одинаковый результат и одинаковый курсор устанавливать с помощью
    // присваивания event.dataTransfer.dropEffect
    // Если этого не делать то к примеру если в ondragenter вернуть true а в ondragover false то драгаться мы всё равно будем,
    // но курсор постоянно будет фликать на "запрещённый драг"
    // Это происходит так как ondragenter в своём default action (который запускается если его не отменить
    // вернув тут false - вот такой пиздец) запрещает дроп. Но наш ondragover его сразу же разрешает так как мы вернули false
    // тонее разрешает нечто перед ondragover - и это нечто не отменяется.
    //
    // -----
    //
    // ondragover vs ondrag
    // ondragover Всё время вызывается при драге, но в отличие от ondrag(который вызывается на том элементе который драгаем)
    // для элемента под мышкой - потенциальным таржетом драгом. Причём сюда попадут и все всплывшие ondragover от вложенных
    // узлов (этоже относится ко всем drag эвентам).
    //
    // -----
    //
    // Про ondragleave, ondragenter
    // (тоже относится ко всем эвентам, но для leave особо неудобно)
    // Раздражает, и крайне необычно что к нам приходят ondragleave для всех наших субузлов (target/srcElement = субузлу)
    // При этом для самого узла на который навешан эвент (так чтоб event.target === эвентхолдер) он может вообще
    // не прийти ни разу!!!
    //
    // -----
    //
    // 3. those 7 events are to be split into two groups: the ones firing at the *source* (the thing being dragged; namely:
    // - dragstart
    // - drag
    // - dragend
    // and the ones firing at potential *targets*
    // - dragenter
    // - dragover
    // - dragleave
    // - drop
    // You complained dragover was just like drag, well it fires at the same time, but on different objects
    //
    // 4. the drop event: for the drop event to fire, you must have previously told the browser that this (the "current" element)
    // is a valid drop target; and this must be done as soon as your mouse pointer enters the element (dragenter).
    // Because the default behavior is to *not* be a drop target, cancelling the event actually makes the event target a drop target.
    // As for the dragover event, I admit it's a bit "strange"; but it allows you to change the dropEffect depending on where the mouse
    // is within the drop target (some kind of "image map" for DnD).
    //
    // ....
    //
    // 6. Finally, dropEffects vs. effectsAllowed; again, it's all about drag source vs. drop target:
    // the source object sets the effectsAllowed
    // (if it's read-only, it won't allow "move"; if it's inherently temporary, it won't allow "link", etc.)
    // and the drop target choose a dropEffect among them.
    //
    // ....
    //
    // see also -webkit-user-drag:none/element css property
    // and draggable="true" attribute
    // вообще странно, в jsfiddle без этого не пашет, а у меня пашет
    //
    // ....
    //
    // Detailed instruction: https://developer.mozilla.org/En/DragDrop/Drag_Operations
    //
    // ....
    //
    // you can use the event.dataTransfer.dropEffect in ondragend to determine that drop operation is realy occurred (in anothere window!)
    // and remove draged element in case this was move operation
    // If the dropEffect property has the value none during a dragend, then the drag was cancelled.
    // Otherwise, the effect specifies which operation was performed. The source can use this information after a
    // move operation to remove the dragged item from the old location. The mozUserCancelled property will be set to
    // true if the user cancelled the drag (by pressing Escape), and false if the drag was cancelled for other reasons
    // such as an invalid drop target, or if it was successful.


    // -----------------------------------------------------------------------------------------------------------------

    rowDom.selectDragAndDropCursor = DD_selectDragAndDropCursor; // Должна выдавать в ondragenter & ondragover синхронно одно и тоже, чтоб курсор не фликал

    rowDom._ref_treeView.onDragEnterReturnValueCasheForOnDragOver = true; // при попытке эту переменную использовать как локальную к rowDom и опред. здесь функций, наблюдались баги

    rowDom.ondragstart   = DD_ondragstart;
//  rowDom.ondrag        = DD_ondrag;
//  rowDom.ondragleave   = DD_ondragleave;
    rowDom.ondragend     = DD_ondragend; // Тут ещё нужно будет при MOVE (а не copy) операциях В ДРУГОЕ ОКНО! удалять источник если дроп был успешен
    rowDom.ondragover    = DD_ondragover;

    rowDom.ondragenter   = DD_ondragenter;
    rowDom.ondrop        = DD_ondrop;
}

var TO_DD_HTML_INTERCHANGE_BEG = '<!--tabsoutlinerdata:begin';
var TO_DD_HTML_INTERCHANGE_END = 'tabsoutlinerdata:end-->';

function DD_ondragstart(event) {
    console.log("DD_ondragstart"); //REMOVE

    //console.log("modelid:" + this._ref_nodeModel.id + " ondragstart");
    event.stopPropagation(); // без этого эвент всплывает абсолютно через все узлы наверх, а учитывая что они у нас все друг друга включают - выходит жесть

    // Set text & HTML content for drops outside the root doc.
    // https://developer.mozilla.org/User:venesa/Recommended_Drag_Types


    this._ref_treeView.setDragClipboardData_fromHtmlStructure(event.dataTransfer, this);

    // event.dataTransfer.effectAllowed = 'all'; A default behaviour, not need to set 'all'

    // В случае мультпл селект делаем другой рисуночек, не дефолтный  -------------------------------------------------------------
    // dt.setDragImage(ТутМонаПихнутьDOMЭлемент!!!, 25, 25);  Но только если он хоть когдато был отрендерен в дереве перед этим! Пример
    //    var dragImage = document.createElement("div");
    //    dragImage.innerHTML = '' +
    //    '<ul>' +
    //        '<li><div>Morbi ut lmolestie mattis.</div>' +
    //            '<ul>' +
    //            '<li draggable="true" class=""><div>Ut sit amet turpis non ipsum sagittis vestibulum.</div></li>' +
    //            '<li><div>Donec tempus massa vel leo blandit ut dictum ipsum dictum.</div><ul></ul></li>' +
    //            '<li><div>Donec feugiat interdum augue, at convallis felis pretium vel.</div><ul></ul></li>' +
    //            '<li><div>Maecenas sollicitudin mi ut mi vestibulum bibendum.</div></li>' +
    //            '</ul>' +
    //        '</li>' +
    //    '</ul>';
    //    dragImage.style.color = "red";
    //    window.document.body.appendChild(dragImage);
    //    event.dataTransfer.setDragImage(dragImage, 25, 25);

    // It is also possible to use images and canvases that are _NOT_IN_DOCUMENT_.
    // This technique is useful when drawing custom drag images using the canvas element, as in the following example:
    // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Drag_operations#dragdata

    // Для слишком больших DOM обектов попытка запуска дефолтной реализации рендеринга DragImage приводит к крешу extension
    // поэтому мы для таких dom обектов заменяем их на всегда присутствующую в documetn картинку у root узла
    // TODO надо бы вообщето это как багу на Chrome зарепортить, наверняка починят
    if(this.getBoundingClientRect().height > 1000) {
        try{
        var treeIcon = document.getElementsByClassName('session_favicon')[0]; //Always present in a root node
        event.dataTransfer.setDragImage(treeIcon, 16, 16);
        } catch(e) {console.error('Error during setting DragImage - session_favicon not found in a document',e)}
    } else  {
        event.dataTransfer.setDragImage(this, 28, 20); // This makes nice drag image with all the draged subelements. Default implementation will take whatewer is clicked to initiate drag - favicon or label
    }

    return true; // Запускаем дефолтную реализация - она нам рисуночек сбахает кстате красивый для драга, в любом случае драг не начнётся если тут вернуть false
}

function DD_ondrag(event) {
    //consoleLogCallbackParameters("modelid:"+this._ref_nodeModel.id+" ondrag")();
    event.stopPropagation();
}

function DD_ondragleave(event) {
    //console.log("modelid:" + this._ref_nodeModel.id + " ondragleave",  event.target === this, event.target.id, event.target.className);
    event.stopPropagation();

    this._ref_treeView.clearDragFeedback();
    return false;
}

// Тут ещё нужно будет при MOVE (а не copy) операциях В ДРУГОЕ ОКНО! ремовать источник если дроп был успешен
function DD_ondragend(event) {
    // Remove Self On Move - you can use the event.dataTransfer.dropEffect in ondragend to determine that drop operation is realy occurred (in anothere window!)
    // and remove draged element in case this was move operation - google this phrase for details.

    //console.log("modelid:" + this._ref_nodeModel.id + " ondragend");
    event.stopPropagation();

    this._ref_treeView.clearDragFeedback();
}

// Должна выдавать в ondragenter & ondragover синхронно одно и тоже, чтоб курсор не фликал
function DD_selectDragAndDropCursor(event)
{
    // Вобщето этот метод надо вынести в treeView

    // установку dataTransfer.dropEffect к сожалению прийдётся продублировать и в ondragover, или курсор будет фликать обратно на move
    var isCopyDrag = event.ctrlKey || event.altKey;

    if(isCopyDrag ) {
        event.dataTransfer.dropEffect = 'copy';
    } else {
        event.dataTransfer.dropEffect = 'move';

        // Однако тут проблема, к примеру урлы из броузера тянутся с event.dataTransfer.effectAllowed === 'copyLink'
        // И если мы ставим dropEffect = 'move' то мы вообще запретим дроп таким образом. Так что воркэраунд делаем:
        if(event.dataTransfer.effectAllowed == 'copyLink') event.dataTransfer.dropEffect = 'link';
        if(event.dataTransfer.effectAllowed ==     'copy') event.dataTransfer.dropEffect = 'copy';
        if(event.dataTransfer.effectAllowed ==     'link') event.dataTransfer.dropEffect = 'link';
    }
}

function DD_ondragover(event) {
    // console.log("modelid:" + this._ref_nodeModel.id + " ondragover", event, this === event.target, event.target.id, event.target.className);
    event.stopPropagation();


    // See comments about d&d // onDragEnterReturnValueCasheForOnDragOver Это тоже значение что вернуло ondragenter которое было (тут ващето баг может быть, если значение не из той rowDom)
    if(this._ref_treeView.onDragEnterReturnValueCasheForOnDragOver) { // Set drag cursor to "not allowed" // See comments about d&d
        // Драг ЗАПРЕЩАЕМ
        event.dataTransfer.dropEffect = 'none';
        event.preventDefault(); // Таки нужно, недостаточно только  return true; В Клонированом окне без этого курсор не свитчался на зпрещенный

        return true;
    } else {
        // Драг РАЗРЕШАЕМ
        this.selectDragAndDropCursor(event);

        return false;
    }

}

function selectDropPosition_AS_FIRST_SUBNODE_or_AS_NEXT_SIBLING(rowDom, event) {
    var dropPosition = isElementPresentInPathFromTo( rowDom._ref_nodeTextWithAnchorDom, event.srcElement, rowDom ) ? AS_FIRST_SUBNODE : AS_NEXT_SIBLING;

// С таким этим фиксом возникала нехорошая беда - имея "лесенку" у окна и прицеливаясь за последним элементом окна в дырку
// перед следующим окном (а там она больше сделана), драг фидбек таки отображается с этим фиксом фиг знает где -
// как первый элемент окна, а не на против курсора - как и должен.
// Также если мы раздвинем узлы css ом это опять таки перестанет работать хорошо
//
// Но самое главное что даже с этим фиксом но без deferred_ работает хуже чем без него но с deferred_ отрисовкой курсора
// Поэтому фикс и отключен. но вообщето он верен. И надо выкинуть таки defrerred, а его оставить. Но починить этот прикол с лесенкой.
//    if(dropPosition == AS_NEXT_SIBLING) { // Ту проверка не верная по сути, по сути нам важней откуда эвент всплыл, просто расчёт dropPosition перекрывает этот кейс (в том коде что есть)
//        // Проверяем или это мы просто в дырку не провалились между узлами просто вне области проводов....
//        // Были тормоза из за этого. Мы заказывали в результате отрисовку другого драг фидбека. совершенно ненужного
//        // Причом он даже не успевал отобразиться на экране, так как при движении курсора по нодах почти сразу мы
//        // заказывали другой драг фидбек на другой ноде. Но тормозило это дико на одной из поломанных (заторможенных) версий хрома.
//        // Бо при движении курсора он таки отслеживает и вызывает все ondragenter
//        var nodeRect = rowDom._ref_nodeTextWithAnchorDom.getBoundingClientRect();
//        if(event.clientX >= nodeRect.left) dropPosition = AS_FIRST_SUBNODE;
//    }

    return dropPosition;
}


function DD_ondragenter(event) {
    event.stopPropagation(); // Вверху например для того чтоб какойто exception ниже это не отменил

    var dropPosition = selectDropPosition_AS_FIRST_SUBNODE_or_AS_NEXT_SIBLING(this, event);

    // Тут была неприятная бага что при движении мыши, не по проводам, она проваливалась в щели между элементов
    // и на долю секунду включался режим отображения AS_NEXT_SIBLING
    // При этом это даже dragfeedbackcursor между элементами не успевал нарисоваться, я никогда не видел этого, но запрос таки выполнялся и дерево перестраивалось
    // Просто не успевало отобразиться
    // console.log("DD_ondragenter", dropPosition);
    // Типичная картина была при движении по узлам:
    // DD_ondragenter AS_NEXT_SIBLING
    // DD_ondragenter DROP_AS_FIRST_SUBNODE
    // DD_ondragenter AS_NEXT_SIBLING
    // DD_ondragenter DROP_AS_FIRST_SUBNODE
    // DD_ondragenter AS_NEXT_SIBLING

    //var dragedModel = this._ref_treeView.prepareDragedModel(event, this._ref_treeView.instanceUnicalClipboardDataMimeType); //БАШОЙ СЛОЖНЫЙ МЕТТОД

    // Мы не можем его прочитать в DD_ondragenter datastore в момент onDragEnter, только в onDrop
    // поэтому берем закешированную и засинхроненную во всех View через бекграунд this.currentlyDragedIdMVC
    let isDropHereAllowed = processDragDataStore( event.dataTransfer,  this._ref_treeView.instanceUnicalClipboardDataMimeType,
        // handleThisInstanceMimeType,
        // handleTabsOutlinerActionLinkMimeType,

        // handleXTabsOutlinerItemsMimeType,
        // handleUriListMimeType,

        // handleTextPlainMimeType,
        // handleTextHtmlMimeType,

        // handleNoSuitableMimeType
        (event) => isDropAllowed( selectDropTarget(dropPosition, this), this._ref_treeView.currentlyDragedIdMVC ),
        (event) => true,

        (event) => true,
        (event) => true,

        (event) => true,
        (event) => true,

        (event) => false
    );

    //console.log("DD_ondragenter", dropPosition, isDropHereAllowed); //REMOVE

    //if( !dragedModel || !isDropAllowed( selectDropTarget(dropPosition, this), dragedModel.idMVC ) )
    if(!isDropHereAllowed) {
        // Драг ЗАПРЕЩАЕМ

        // Set drag cursor to "not allowed"
        event.dataTransfer.dropEffect = 'none';
        event.preventDefault(); // See comments about d&d // preventDefault Таки нужно, недостаточно только  return true; В Клонированом окне без этого курсор не свитчался на зпрещенный

        this._ref_treeView.deferred_clearDragFeedback(); // deffered - решение проблемы дикого замедления на кривой промежуточно версии Chrome при большом (20k) дереве, можно и без deffered

        return this._ref_treeView.onDragEnterReturnValueCasheForOnDragOver = true; // This will disallow drop // or call event.preventDefault(); for same result // See comments about d&d
    } else {
        // Драг РАЗРЕШАЕМ
        this.selectDragAndDropCursor(event);

        this._ref_treeView.deferred_showDragFeedback(this, dropPosition); // deffered - решение проблемы дикого замедления на кривой промежуточно версии Chrome при большом (20k) дереве, можно и без deffered

        return this._ref_treeView.onDragEnterReturnValueCasheForOnDragOver = false;
    }
}

function DD_ondrop(event) {
    //console.log("modelid:" + this._ref_nodeModel.id + " ondrop");
    event.stopPropagation();

    //console.log("dropEffect:",event.dataTransfer.dropEffect,'ctrl', event.ctrlKey,event);

    // -------------------------------------------------------------------------------------------------------------
    this._ref_treeView.clearDragFeedback(); // В ситуации когда мы дропаем чтото между разными окнами, в окно дропа не приходит ondragend, поэтому надо тут фидбек тоже прятать
                                            // Делаем это до performAfterDropAction чтоб во время редактирования note в popup окне не весел драг фидбек

    var dropPosition =  selectDropPosition_AS_FIRST_SUBNODE_or_AS_NEXT_SIBLING(this, event);

    var dropAsCopy = event.ctrlKey || event.altKey;
    var dropTarget = selectDropTarget(dropPosition, this);

    this._ref_treeView.performDrop( dropTarget, dropAsCopy, event.dataTransfer );

    return false; // or call event.preventDefault(); for same result // See comments about d&d
}

// ---------------------------------------------------------------------------------------------------------------------
function appendSubnodesDomIfSubnodesVisible(window_, rowDom, isCollapsed, MVCDataTransferObject_subnodesList, treeView, isFullTreeBuild)
{
    if(!isCollapsed && MVCDataTransferObject_subnodesList.length > 0) {
        rowDom.appendChild( getSubnodesDom_makeIfNotPresent(window_, rowDom, MVCDataTransferObject_subnodesList, treeView, isFullTreeBuild) ); // Recursive call troughs makeSubnodesTableDom()
    }
}

function getSubnodesDom_makeIfNotPresent(window_, rowDom, MVCDataTransferObject_subnodesList, treeView, isFullTreeBuild)
{
    if( !rowDom._ref_subnodesDom )
        rowDom._ref_subnodesDom = makeSubnodesTableDom(window_, MVCDataTransferObject_subnodesList, treeView, isFullTreeBuild);

    return rowDom._ref_subnodesDom;
}

// Simple Show/Hide behaviour without any animations -------------------------------------------------------------------------------
var simpleShowHideCollapsing = {
    doCollapsingAndRemove          :  function (animatedelem)         { animatedelem.parentNode.removeChild( animatedelem ); },
    doAppendIfNotPresentThenExpand :  function (parent, animatedelem) { parent.appendChild( animatedelem ); }
};

// Expand Collapse Animation ---------------------------------------------------------------------------------------------------------
var animatedShowHideCollapsing = {
    doCollapsingAndRemove          :  animateCollapseThenRemove,
    doAppendIfNotPresentThenExpand :  addIfNotPresentAndAnimateExpand
};
var ShowHideCollapsingAnimator = animatedShowHideCollapsing;
// var ShowHideCollapsingAnimator = simpleShowHideCollapsing;

//var test_f = function(zxc){ for(var j = 0; j < 100000; j++);};
//var test_inside = function() {
//    var st = Date.now();
//    var r = [];
//    for(var i = 0; i < 100000; i++) {
//        r.push({ f1:function as(zxc){ for(var j = 0; j < 100000; j++); }
//               , f2:function ds(zxc){ for(var j = 0; j < 1000300; j++); }
//               , f3:function ts(zxc){ for(var j = 0; j < 1006000; j++); }
//               , f4:function er(zxc){ for(var j = 0; j < 1400000; j++); }
//               , f5:function fg(zxc){ for(var j = 0; j < 1050000; j++); }
//            }
//        );
//    }
//    console.log("### :",Date.now()-st);
//    return {m:r};
//};
//var test_otside = function() {
//    var st = Date.now();
//    var r = [];
//    for(var i = 0; i < 100000; i++) {
//        r.push({ f1:test_f
//                       , f2:test_inside
//                       , f3:test_otside
//                       , f4:test_otside
//                       , f5:test_otside
//                    });
//    }
//    console.log("### :",Date.now()-st);
//    return {m:r};
//};




