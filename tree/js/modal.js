/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

// if modalPromtId is given then get it by getElementById, then remove element from body and remeber it in closure
function initModalDialog_(window_, modalPromtId, createModalDialogDom) {
    var modalElement = modalPromtId ? window_.document.getElementById(modalPromtId) : createModalDialogDom(window_.document);

    var editField = modalElement.querySelector('#modalEditPrompt-editField');
    if(editField) editField.addEventListener('blur', function(e) {
        // Prevent focus lost on tab key or click outside
        e.stopPropagation();
        e.target.focus();
    }, false);

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
    function showModal(window_, defaultText, serial, customLabel) {
        window_['modalEditPromptActive'] = true; // document.defaultView - is the window

        window_.document.body.insertBefore(modalBg,      null);
        window_.document.body.insertBefore(modalElement, null);
        modalElement.style.display = "block";
        var editField = modalElement.querySelector('#modalEditPrompt-editField');
        if(editField) {
            editField.value = defaultText;
            editField.focus();
            editField.select();
        }
        
        var serialField = modalElement.querySelector('#modalPrompt-serialNumber');
        if(serialField) {
            serialField.innerText = serial;
        }

        var customLabelField = modalElement.querySelector('#modalPrompt-customLabelField');
        if(customLabelField) {
            customLabelField.innerText = customLabel;
        }
    }

    return function activatePrompt(serial, defaultText, onOk, onCancell) { // TODO  onOk, onCancell - must be replaced by firing the setText event with the new value
        showModal(window_, defaultText, serial, defaultText);

        var cancellBtn = modalElement.querySelector('#modalEditPrompt-cancellBtn');
        var okBtn      = modalElement.querySelector('#modalEditPrompt-okBtn');

        // setTimeout(...,1) так как нас могли вызвать в onClick/keyDown event какойто кнопки. Мы в этот момент пойдём и навесим на окно onclick
        // и сами же его сразу словим когда текущий onClick в котором нас вызвали доплывёт на верх.
        window_.setTimeout(function() {
            // on any edits update removeEventListeners
            window_.document.addEventListener('click', onCancellTouch, false );  // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
            window_.document.addEventListener('touchstart', onCancellTouch, false);  // этиже эвенты обрабатывает и popUp. и вызывает им e.stopPropagation();
            window_.addEventListener('keydown', onWindowKeyDown, false);
            if(cancellBtn) cancellBtn.addEventListener('click', onCancellTouch, false );
            if(okBtn)      okBtn.addEventListener('click', onOkTouch, false );
        },1);

        function removeEventListeners(window_) {
            window_.document.removeEventListener('click', onCancellTouch, false );
            window_.document.removeEventListener('touchstart', onCancellTouch, false);
            window_.removeEventListener('keydown', onWindowKeyDown, false);
            if(cancellBtn) cancellBtn.removeEventListener('click', onCancellTouch, false );
            if(okBtn)      okBtn.removeEventListener('click', onOkTouch, false );
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
            var editField = modalElement.querySelector('#modalEditPrompt-editField');
            onOk( editField && editField.value );
            removeModal(window_);
        }
    }
}


