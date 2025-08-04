/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */
"use strict";

var activateEnterLicenseKeyDialog                    = initEnterLicenseKeyDialog(window);
var activateBeforeIdentityAccessExplanationDialog = initBuyLicenseKeyDialog_beforeIdentityAccess(window);
//var activateBuyLicenseKeyDialog_afterIdentityAccess  = initBuyLicenseKeyDialog_afterIdentityAccess(window);



function showEnterLicenseKeyDialog(userInfo) {
    activateEnterLicenseKeyDialog( userInfo.email,
                                   'OK: identity.email GRANTED & accessible. userInfo.email:' + userInfo.email + '; userInfo.id:' + userInfo.id,
                                   function onOk() {},
                                   function onCancel() {} );
}

function initBuyLicenseKeyDialog_beforeIdentityAccess(window_) {
    // Special ids recognized by dialog factory:
    //
    // #modalEditPrompt-editField
    // #serialNumber
    //
    // #modalEditPrompt-cancellBtn
    // #modalEditPrompt-okBtn
    return initModalDialog_(window_, 'buyBeforeIdentityAccessDialog');
}

//function initBuyLicenseKeyDialog_afterIdentityAccess(window_) {
//    // Special ids recognized by dialog factory:
//    //
//    // #modalEditPrompt-editField
//    // #serialNumber
//    //
//    // #modalEditPrompt-cancellBtn
//    // #modalEditPrompt-okBtn
//    return initModalDialog_(window_, 'buyBeforeFastSpringDialog');
//}

function initEnterLicenseKeyDialog(window_, modalPromtId) {
    // Special ids recognized by dialog factory:
    //
    // #modalEditPrompt-editField
    // #serialNumber
    //
    // #modalEditPrompt-cancellBtn
    // #modalEditPrompt-okBtn
    return initModalDialog_(window_, 'manualyEnterProKeyDialog');
}