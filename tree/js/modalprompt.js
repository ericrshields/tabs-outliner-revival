/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

// remove element from body and remeber it in closure
function initModalPrompt(window_, modalPromtId) {
    function createModalDialogDom(document) {
        //--><div id=modalEditPrompt class="modal" style="display:none"><!--
        //    --><input id=modalEditPrompt-editField class="form_input" type="text" value="Initial Value" tabindex=0 placeholder="Enter Node Text" ><!--
        //    --><button id=modalEditPrompt-cancellBtn class="form_btn btn_cancell" tabindex=-1>Cancel</button> <button id=modalEditPrompt-okBtn class="form_btn btn_ok" tabindex=-1>OK</button><!--
        //--></div>
        var div = document.createElement('div');
        div.id              = 'modalEditPrompt';
        div.className       = 'modal';
        div.style.display   = 'none';

        div.innerHTML = '<input id=modalEditPrompt-editField class="form_input" type="text" value="Initial Value" tabindex=0 placeholder="Enter Node Text" >'+
                        '<button id=modalEditPrompt-cancellBtn class="form_btn btn_cancell" tabindex=-1>Cancel</button> <button id=modalEditPrompt-okBtn class="form_btn btn_ok" tabindex=-1>OK</button>';
        return div;
    }

    function onBlur_preventFocusLoss(e) {
       // Prevent focus lost on tab key or click outside
       e.stopPropagation();
       e.target.focus();

       // Тут был очень неприятный баг с хромом, на removeModal этот эвент срабытывал и потом основоне окно не получало onkeydown эвентов до тех пор пока мы по нему
       // не кликали и не возвращали ему фокус. пофиксано тем что этот эвент отреестрируется при убирании модальника
    }

    var modalElement = modalPromtId ? window_.document.getElementById(modalPromtId) : createModalDialogDom(window_.document);

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

    removeModal(window_); // Убираем из DOM чтоб он там не мешался

    // TODO As window as document i can get from event listeners event object, when i call this method not need to closure them
    function removeModal(window_) {
        delete window_['modalEditPromptActive'];

        if(modalBg.parentNode) modalBg.parentNode.removeChild(modalBg);
        if(modalElement.parentNode) modalElement.parentNode.removeChild(modalElement);
    }

    // TODO not need to closure modalBg & modalElement - i can pass them when calling this function, and before this i can just create them - not need to store them
    // Yet actualy - isnt it will just create more garbage? Most likely yes. Not need to closure them there anyway.
    function showModal(window_, defaultText) {
        window_['modalEditPromptActive'] = true; // document.defaultView - is the window

        window_.document.body.insertBefore(modalBg,      null);
        window_.document.body.insertBefore(modalElement, null);
        modalElement.style.display = "block";
        var editField = modalElement.querySelector('#modalEditPrompt-editField');
        if(editField) {
            editField.value = defaultText;
            // editField.focus();
            // editField.select();
            // Тут проблема была, treeModel вызывает этот метод в момент установки ноды, и сразу потом выполняет
            // this.newNode.setCursorHereOrToFirstCollapsedParent(treeView); (славить это можно тока дебажа в двох окнах сразу)
            // что забирало курсор у нас с editField
            // Поэтому мы focus() перенесли в setTimeout - чтоб он выполнился уже после setCursorHereOrToFirstCollapsedParent

        }
    }

    return function activatePrompt(defaultText, onOk, onCancell) { // TODO  onOk, onCancell - must be replaced by firing the setText event with the new value
        showModal(window_, defaultText);

        var cancellBtn = modalElement.querySelector('#modalEditPrompt-cancellBtn');
        var okBtn      = modalElement.querySelector('#modalEditPrompt-okBtn');
        var editField = modalElement.querySelector('#modalEditPrompt-editField');


        // setTimeout(...,1) так как нас могли вызвать в onClick/keyDown event какойто кнопки. Мы в жтот момент пойдём и навесим на окно onclick
        // и сами же его сразу словим когда текущий onClick в котором нас вызвали доплывёт на верх.
        window_.setTimeout(function() {
            // on any edits update removeEventListeners
            window_.document.addEventListener('click', onCancellTouch, false );  // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
            window_.document.addEventListener('touchstart', onCancellTouch, false);  // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
            window_.addEventListener('keydown', onWindowKeyDown, false);
            cancellBtn.addEventListener('click', onCancellTouch, false );
            okBtn.addEventListener('click', onOkTouch, false );
            if(editField) editField.addEventListener('blur', onBlur_preventFocusLoss, false);

            if(editField) editField.focus();
            if(editField) editField.select(); // This must be in setTimeout, читай комент в showModal()
        },1);

        function removeEventListeners(window_) {
            window_.document.removeEventListener('click', onCancellTouch, false );
            window_.document.removeEventListener('touchstart', onCancellTouch, false);
            window_.removeEventListener('keydown', onWindowKeyDown, false);
            cancellBtn.removeEventListener('click', onCancellTouch, false );
            okBtn.removeEventListener('click', onOkTouch, false );
            if(editField) editField.removeEventListener('blur', onBlur_preventFocusLoss, false);  // Тут был очень неприятный баг с хромом, на removeModal этот эвент срабытывал и потом основное окно не получало onkeydown эвентов до тех пор пока мы по нему не кликали
        }

        function onWindowKeyDown(e) {
            if (e.keyCode == 27/*Esc*/)
                onCancellTouch(e);

            if (e.keyCode == 13/*Enter*/)
                onOkTouch(e);
        }

        function onCancellTouch(e) {
            var window_ = e.target.ownerDocument.defaultView;

            removeEventListeners(window_);
            if(onCancell) onCancell();
            removeModal(window_);
        }

        function onOkTouch(e) {
            var window_ = e.target.ownerDocument.defaultView;

            removeEventListeners(window_);
            onOk( modalElement.querySelector('#modalEditPrompt-editField').value );
            removeModal(window_);
        }
    }
}
