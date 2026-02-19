"use strict";

/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

function initContextMenu(window_/*, contextMenuId*/) {
    function createContextMenu(document) {
        // USE 3 spaces to separate Title from Shortcuts (we split by 3 spaces)
        var goProWarning = '<div id="noteGoProContextMenuWarning" class="goProAlertBlock">' +
                            'Context menu, clipboard operations and keyboard shortcuts are not working in the Free Mode. ' +
                            'To enable them you need to Upgrade ' +
                            'to the <a target="_blank" href="'+chrome.runtime.getURL('options.html')+'">Paid Mode</a>.' +
                            'Below is a preview of what will be available after the Upgrade.'
                           '</div>';

        // АКУРАТНО! между текстом и шорткатами должно быть минимум по 3 пробела чтоб шорткаты прижимались к правому краю менюхи автоматом
        var cnmenuModel = [
                        ,['section',                 'Clipboard',//                [Ctrl]+[X] [C] [V]
                          ,['actionCut',                  'Cut                           [Ctrl]+[X]']
                          ,['actionCopy',                 'Copy                          [Ctrl]+[C]']
                          ,['actionPaste',                'Paste (as the last subnode)   [Ctrl]+[V]']
                          ,['tip',                        'Tips: Paste or Drag&Drop to notepad to export hierarchy in a plain text. Dragging Tab node to the Chrome Tab Strip or Adress Bar is also supported.']
                         ]
                          ,['subsection',                   'General   [F2], [-], [Del], [⇐<span style="margin-left: -2px;margin-right: 1px;">=</span>], [&nbsp;&nbsp;&nbsp;Space&nbsp;&nbsp;&nbsp;] ...',
                            ,['actionCollapseExpand',       'Collapse\\Expand            [+] or [-]']
                            ,['actionEdit',                 'Edit                              [F2]']
                            ,['actionSaveClose',            'Save & Close            [⇦ Backspace]']
                            ,['actionDelete',               'Delete                           [Del]']
                            ,['tip',                        'Tip: Deletion of an open window will delete only unmarked open tabs, tabs with notes will be saved']
                            ,['actionRestore',              'Restore\\Activate        {DblClick} or [&nbsp;&nbsp;&nbsp;Space&nbsp;&nbsp;&nbsp;]']
                            ,['actionAltRestore',           'Alt Restore     [Alt] + {DblClick} or [&nbsp;&nbsp;&nbsp;Space&nbsp;&nbsp;&nbsp;]']
                            ,['tip',                        'Alternative Restore restore only those tabs in window that was open on last save']
                            ,['tip',                        'Tip: To apply Delete, Save & Close, Restore commands on all subnodes need collapse hierarchy first. Quick way to do so is by clicking the circle in the hovering menu.<br><br>Note that Drag & Drop and Clipboard operations work with the whole hierarchy, regardless of the collapsed state']
                           ]
                          ,['subsection',                 'Notes                       [Ins], [Enter] ...'//>
                            ,['actionEdit',                 'Edit Inline Note (exist only on Tabs)                 [F2]']
                            ,['space']
                            ,['actionInsNoteAsParent',      'Insert Note as parent                        [Shift]+[Ins]']
                            ,['actionInsNoteAsFirstSubnode','Insert Note as the first subnode               [Alt]+[Ins]']
                            ,['actionInsNoteAsLastSubnode', 'Insert Note as the last subnode                      [Ins]']
                            ,['space']
                            ,['actionAddNoteAbove',         'Add Note above                             [Shift]+[Enter]']
                            ,['actionAddNoteBelove',        'Add Note below (on the same level)                 [Enter]']
                            ,['actionAddNoteAtTheEndOfTree','Add Note to the end of Tree                  [Alt]+[Enter]']
                            ,['space']
                            ,['actionAddGroupAbove',        'Add Group above                                [Shift]+[G]']
                            ,['tip',                        'Tip: Alternatively you can start note text with "2G " to create Group instead of Note']
                            ,['actionAddSeparatorBelove',   'Add Separator below                                    [L]']
                            ,['tip',                        'Tip: Note with the text like "----" or "====" or "...." (of any length) will be automatically converted to a separator']
                           ]
                          ,['subsection',                 'Move    [Tab], [Ctrl]+[⇐⇕⇒][Home] [End] ...'// > //[⇦⇕⇨] ⇓ ⇑ ⇧ ⇩
                            ,['actionMoveRight',            'Right                                   [Tab] or [Ctrl]+[⇒]']
                            ,['actionMoveLeft',             'Level Up                        [Shift]+[Tab] or [Ctrl]+[⇐]']
                            ,['actionMoveUp',               'Up 						                      [Ctrl]+[⇑]']
                            ,['actionMoveDown',             'Down 							                  [Ctrl]+[⇓]']
                            ,['actionMoveHome',             'As the first subnode                          [Ctrl]+[Home]']
                            ,['actionMoveEnd',              'As the last subnode                            [Ctrl]+[End]']
                            ,['space']
                            ,['tip',                        'Keys for cursor movement:</br>' +
                                                             '<table>'+
                                                                '<tr><td>[Home]</td><td>- </td><td>to first node on the same level</td></tr>'+
                                                                '<tr><td>[End]</td><td>- </td><td>to last node on the same level</td></tr>'+
                                                                '<tr><td>[⇐]</td><td>- </td><td>to parent</td></tr>'+
                                                                '<tr><td>[⇒]</td><td>- </td><td>to the first subnode</td></tr>'+
                                                             '</table>'+
                                                            '[PgUp], [PgDn], [⇑], [⇓] - moves cursor up and down by rows.<br>'+
//                                                          '[Alt]+[⇑], [Alt]+[⇓] - moves cursor up and down by nodes of the same level.'
                                                            '']
                            ,['tip',                        'Tip: Ctrl + Drag & Drop create copies of dragged hierarchies']
                           ]
//                          ,['section',                    'Style'
//                            ,['   B | U | I | S []]
//                            ,['    [Font Size ^]
//                            ,['    Border: {} [] ()
//                            ,['    T: # # # # # # # # # [...]
//                            ,['    H: # # # # # # # # # [...]
//
//                          ,['section',                    'Icon'
//                            , A B C # $ %  More >

                          ,['section',                    'Utils'
                            ,['actionFlattenTabsHierarchy',     'Flatten Tabs Hierarchy                    [/]']
                            ,['actionMoveWindowToTheEndOfTree', 'Move Window\\Group To The End Of Tree     [E]']
                            ,['actionOpenLinkInNewWindow',      'Open Link In New Window       [Shift]+[Click]']
                            ,['actionOpenLinkInNewTab',         'Open Link In Last Window       [Ctrl]+[Click]']

                           ]

                          ,['section',                    'Global Keyboard Shortcuts'
//                          ,['actionSearch',              'Search Through Expanded Nodes        [Ctrl]+[F]']
//                          ,['actionExportAsHtml',        'Export as HTML                       [Ctrl]+[S]']
//                          ,['actionImportHtml',          'Import exported HTML                           ']
//                            ,['actionPrint',             'Print Tree                           [Ctrl]+[P]']
//                          ,['actionOneClickSwitchMode',  'Enable "Activate by one click" mode']
                            ,['tip',                       //'Other Global Shortcuts:</br>' +
                                                            '<table>'+
                                                                '<tr><td style="text-align: right">[W]</td><td>- </td><td> Scroll Up To Next Open Window</td></tr>'+
                                                                '<tr><td style="text-align: right">[S]</td><td>- </td><td> Undo Scroll</td></tr>'+
                                                                '<tr><td style="text-align: right">[C]</td><td>- </td><td> Clone View</td></tr>'+
                                                                '<tr><td style="text-align: right">[Q]</td><td>- </td><td> Close All Open Windows</td></tr>'+
                                                                '<tr><td style="text-align: right">[Ctrl]+[F]</td><td>- </td><td> Search Through Visible Nodes</td></tr>'+
                                                                '<tr><td style="text-align: right">[Ctrl]+[P]</td><td>- </td><td> Print Tree</td></tr>'+
                                                                '<tr><td style="text-align: right; vertical-align:top">[Ctrl]+[S]</td><td style="text-align: right; vertical-align:top">- </td><td> Export Visible Nodes as HTML (select "Save as complete HTML" in a dialog that will open)</td></tr>'+


                                                            '</table>'+
                                                           'There is also shortcuts to open Tabs Outliner, and for Save-Close Tab or Window without opening or switching to Tabs Outliner, see the help.' ]
                            ,['tip',                       'Tip: Native Chrome context menu can be opened by Right Click with [Shift] pressed']
                           ]
                          ];

        //--><div id=modalEditPrompt class="modal" style="display:none"><!--
        //    --><input id=modalEditPrompt-editField class="form_input" type="text" value="Initial Value" tabindex=0 placeholder="Enter Node Text" ><!--
        //    --><button id=modalEditPrompt-cancellBtn class="form_btn btn_cancell" tabindex=-1>Cancel</button> <button id=modalEditPrompt-okBtn class="form_btn btn_ok" tabindex=-1>OK</button><!--
        //--></div>
        function createElement(tag, id, className) {
            var r = document.createElement(tag);
            if(id)r.id               = id;
            if(className)r.className = className;
            return r;
        }
        var contextMenuElement = createElement('ul', 'treeContextMenu' , 'contextMenu');
        contextMenuElement.style.display   = 'none';

        function getEntryClass(entryId) {
            var match = /^[a-z]*/.exec(entryId);
          	return match ? match[0] : "";

        }

        function processEntryText(text, isGroup){
            if(!text) return '';
            var a = text.split(/\s\s\s+/);
            var titleClasses = isGroup ? 'contextMenu-grpTitle' : 'contextMenu-entryTitle';
            function processShortcutsBorders(text) {
                var r = text;
                r = r.replace(/\[(.+?)\]/g, "<span class='shortCutKey'>$1</span>");
                r = r.replace(/\{(.+?)\}/g, "<span class='mouseKey'>$1</span>");
                return r;
            }
            var r = '<span class="'+titleClasses+'">'+processShortcutsBorders(a[0])+'</span>';
            if(a[1])
                r += '<span class="contextMenu-entryShortcuts">'+processShortcutsBorders(a[1])+'</span>';
            return r;
        }

        function processGroup(groupParentDomElement, groupArray) {
            groupArray.forEach(function(entry){
                var entryId    = entry[0];
                var entryText  = entry[1];
                var entryType = getEntryClass(entryId);
                if(entryId === entryType) entryId = '';

                var entryClassesList = 'contextMenu-' + entryType + ' contextMenu-item';
                var isGroup = entryType === 'subsection' || entryType === 'section';
                entryClassesList += (isGroup ? ' contextMenu-grp' : ' contextMenu-entry');
                if(entryType === 'subsection' || entryType === 'action')
                    entryClassesList += ' contextMenu-hoverable';

                var entryDom = createElement( 'il', entryId, entryClassesList);
                entryDom.innerHTML = processEntryText(entryText, isGroup);

                groupParentDomElement.appendChild(entryDom);

                if(entryType === 'section') {
                    processGroup(entryDom, entry.slice(2));
                }

                if(entryType === 'subsection') {
                    var popupDom = createElement( 'ul', '', 'contextMenu-subMenuPopup');
                    entryDom.appendChild(popupDom);
                    processGroup(popupDom, entry.slice(2));
                }

            });
        }
        processGroup(contextMenuElement, cnmenuModel);

        var goProWarningElement =  createElement( 'div', 'noteGoProContextMenuWarningPopUp', '');
        goProWarningElement.innerHTML = goProWarning;
        contextMenuElement.insertBefore(goProWarningElement, contextMenuElement.firstChild);


        return contextMenuElement;
    }

    var modalElement = /*contextMenuId ? window_.document.getElementById(contextMenuId) : */createContextMenu(window_.document);

    // -----------------------------------------------------------------------
    Array.prototype.slice.call(modalElement.querySelectorAll('.contextMenu-subMenuPopup')).forEach(function(submenuPopUpElement){
        submenuPopUpElement.style.display = 'none';
    });
    Array.prototype.slice.call(modalElement.querySelectorAll('.contextMenu-subsection')).forEach(function(subsectionTitle){
        subsectionTitle.addEventListener("mouseenter", function( e ) {
            var subMenuEntry = e.currentTarget;
            var subPopup = subMenuEntry.querySelector('.contextMenu-subMenuPopup');
            // Показать SubPop Up
            var groupTitleRect = subMenuEntry.getBoundingClientRect();
            showPopUpInPos(e.clientX, groupTitleRect.top + 13, subPopup, e.target.ownerDocument.defaultView, 60/*padding around cursor*/, groupTitleRect,  4, 5, true/*isSubmenu*/) ;

        }, false);
        subsectionTitle.addEventListener("mouseleave", function( e ) {
            // Спрятать SubPop Up
            var subPopup = e.currentTarget.querySelector('.contextMenu-subMenuPopup');
            subPopup.style.display = "none";
        }, false);
    });
    Array.prototype.slice.call(modalElement.querySelectorAll('.contextMenu-action')).forEach(function(action){
        action.addEventListener("click", function( e ) {
            var isPreventDefaultFlagSet = dispatchBubledCustomEvent(e.currentTarget, 'actionCommand', {'action':e.currentTarget.id});
            if(!isPreventDefaultFlagSet) deactivatePopUp(e);
        }, false);
    });


//    modalElement.querySelector('#modalEditPrompt-editField').addEventListener('blur', function(e) { //####
//        // Prevent focus lost on tab key or click outside
//        e.stopPropagation();
//        e.target.focus();
//    }, false);

    modalElement.addEventListener('click', function(e) {
        // Prevent the "Hide all modals" function
        e.stopPropagation();
    }, false);
    modalElement.addEventListener('touchstart', function(e) {
        // Prevent the "Hide all modals" function
        e.stopPropagation();
    }, false);

    var modalBg = window_.document.createElement('div');
    modalBg.classList.add('modal-bg');

    modalBg.addEventListener('contextmenu', deactivatePopUp, false );
    modalElement.addEventListener('contextmenu',deactivatePopUp, false );

    removeModal(window_); // Убираем из DOM чтоб он там не мешался

    // TODO As window as document i can get from event listeners event object, when i call this method not need to closure them
    function removeModal(window_) { // Глупо сюда окно передавать учитывая что мы и так тут держим modalBg & modalElement
        delete window_['modalContextMenuActive']; //####

        if(modalBg.parentNode) modalBg.parentNode.removeChild(modalBg);
        if(modalElement.parentNode) modalElement.parentNode.removeChild(modalElement);
    }

    function connectGlobalEventListeners(window_, okBtn, cancellBtn) {
        // on any edits dont forget to update removeEventListeners

        window_.document.addEventListener('click',      deactivatePopUp, false ); // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
        window_.document.addEventListener('touchstart', deactivatePopUp, false);  // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
        window_.addEventListener('keydown', onWindowKeyDown, false);
        // cancellBtn.addEventListener('click', onCancellTouch, false );
        // okBtn.addEventListener('click', onOkTouch, false );
    }

    function removeGlobalEventListeners(window_) {
        window_.document.removeEventListener('click',      deactivatePopUp, false );
        window_.document.removeEventListener('touchstart', deactivatePopUp, false);
        window_.removeEventListener('keydown', onWindowKeyDown, false);
        // cancellBtn.removeEventListener('click', onCancellTouch, false );
        // okBtn.removeEventListener('click', onOkTouch, false );
    }

    function onWindowKeyDown(e) {
        if (e.keyCode == 27/*Esc*/)
            deactivatePopUp(e);
//
//            if (e.keyCode == 13/*Enter*/)
//                onOkTouch(e);
    }

    function onCancellTouch(e) {
        deactivatePopUp(e);
    }

    function deactivatePopUp(e) {
        removeGlobalEventListeners(e.target.ownerDocument.defaultView);
        removeModal(e.target.ownerDocument.defaultView);
        if(!e.ctrlKey) e.preventDefault(); // Prevent native context menu in case we right click on modalBg or modalelement, but still can be caled with CTRL pressed
    }

    function showPopUpInPos(x, y, modalElement, window_, xPadding, titleRect, xMinLeftOverlapWithTitle, xMinRightOverlapWithTitle, isSubmenu ) {
        xPadding = xPadding || 0; // Отступ вокруг курсора для показа субменю, чтоб не слишком рядом
        modalElement.style.display = "block";

        // От предыдущего открытия могли остаться открытые подменюхи, прячем их
        Array.prototype.slice.call(modalElement.querySelectorAll('.contextMenu-subMenuPopup')).forEach(function(subMenuPopup){
            subMenuPopup.style.display = "none";
        });

        var clientWidth  = window_.document.documentElement.clientWidth; // Width of the viewport excluding scrollbars
        var clientHeight = window_.document.documentElement.clientHeight; // Height of the viewport excluding scrollbars
        var popupWidth  = modalElement.offsetWidth;
        var popupHeight = modalElement.offsetHeight;

        // Если ниже нижней границы то подвинуть вверх
        if(y + popupHeight > clientHeight) y -= y + popupHeight - clientHeight;

        // Если заходит за правую границу то флипнуть на другую сторону от курсора, если там таки больше места чем справа
        if(x + popupWidth > clientWidth && x > (clientWidth-x)) {// если слева таки действительно больше места
            // Выводим попап слева от курсора
            x -= popupWidth + xPadding;
            //его левая грань (x+popupWidth)  не должна пересекать titleRect.left+xMinLeftOverlapWithTitle
            if(titleRect && (x+popupWidth) < (titleRect['left']+xMinLeftOverlapWithTitle)) x = (titleRect['left']+xMinLeftOverlapWithTitle) - popupWidth;
        } else {
            // Выводим попап справа от курсора
            x += xPadding;
            //его правая грань (x)  не должна пересекать titleRect.right-xMinRightOverlapWithTitle
            if(titleRect && (x) > (titleRect['right']-xMinRightOverlapWithTitle)) x = (titleRect['right']-xMinRightOverlapWithTitle);
        }

        // Мы вывели поп ап справа от курсора потому как слева было недостаточно места, однако всёже справа нас обрезало границей окна, это не дело
        // сдвигаемся назад в видимую область если это произошло.
        if(x+popupWidth > clientWidth )
            x = clientWidth - popupWidth;


        if(x < 0) { // Во время флипа (или сдвига изза обрезки правым краем окна, если окно уже попапа) мы всёже вышли за левый край окна
                    // Сдвигаемся назад в право - левая граница попапа никогда не должна быть перекрыта
            x = 0;
            // тут логичней не просто съехать назад, а ещё и доехать правым краем до правого края окна если там есть место таки (место может не быть если окно уже попапа)
            if(!isSubmenu && popupWidth < clientWidth) x = clientWidth - popupWidth;
            // Для сабменю это наоборот мешает при ведении курсора по правому краю главного попапа - сабменюхи перекрывают так курсор иногда если это сдвиг разрешить
        }

        modalElement.style.top  = y +'px';
        modalElement.style.left = x +'px';
    }

    // TODO not need to closure modalBg & modalElement - i can pass them when calling this function, and before this i can just create them - not need to store them
    // Yet actualy - isnt it will just create more garbage? Most likely yes. Not need to closure them there anyway.
    function showModal(x, y, window_, isGoProBanerVisible) {
        window_['modalContextMenuActive'] = true; // document.defaultView - is the window  //####

        window_.document.body.insertBefore(modalBg,      null);
        window_.document.body.insertBefore(modalElement, null);

        var goProBaner = modalElement.querySelector('#noteGoProContextMenuWarningPopUp');
        if(goProBaner) goProBaner.style.display = isGoProBanerVisible ? '' : 'none';

        showPopUpInPos(x, y, modalElement, window_);

        var noteGoProContextMenuWarningPopUp = modalElement.querySelector('#noteGoProContextMenuWarningPopUp');
        if(noteGoProContextMenuWarningPopUp) {
            noteGoProContextMenuWarningPopUp.style.top = "-" + (noteGoProContextMenuWarningPopUp.offsetHeight + 2) + "px";
        }

        var editField = modalElement.querySelector('#modalEditPrompt-editField');
        if(editField) {
            // editField.value = defaultText;
            editField.focus();
            editField.select();
        }
    }

    return function activateContextMenu(e, isGoProBanerVisible) {
        var window_ =  e.target.ownerDocument.defaultView;
        var x = e.clientX;
        var y = e.clientY;

        showModal(x, y, window_, isGoProBanerVisible);

        // var cancellBtn = modalElement.querySelector('#modalEditPrompt-cancellBtn');
        // var okBtn      = modalElement.querySelector('#modalEditPrompt-okBtn');

        // setTimeout(...,1) так как нас могли вызвать в onClick/keyDown event какойто кнопки. Мы в жтот момент пойдём и навесим на окно onclick
        // и сами же его сразу словим когда текущий onClick в котором нас вызвали доплывёт на верх.
        window_.setTimeout(function() {
            connectGlobalEventListeners(window_);
        }, 1);

        //post message to background to invoke: 
        //FF_REMOVED_GA ga_event('Context Menu Shown - ' + (isGoProBanerVisible ? 'Free' : 'Paid'));
    }
}
