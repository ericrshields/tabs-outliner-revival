/** @preserve Copyright 2012, 2013, 2014, 2015, 2022, 2023, 2024  by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

console.log('BACKGROUND_V3.JS STARTED');

chrome.runtime.onStartup.addListener( () => {
  // э слухи что без onStartup.addListener при рестарте хрома наш extention ваще не будет больше исполнятся
  console.log(`onStartup() BACKGROUND_V3.JS `);
});
chrome.runtime.onInstalled.addListener( () => {
    console.log(`onInstalled() BACKGROUND_V3.JS `);
});
chrome.runtime.onRestartRequired.addListener( () => {
    console.log(`onRestartRequired() BACKGROUND_V3.JS `);
});
chrome.runtime.onSuspend.addListener( () => {
    console.log(`onSuspend() BACKGROUND_V3.JS `);
});



importScripts(   "crypto_utils.js" );
importScripts(   "libs/classinheritance.js" );
importScripts(   "tree/js/modelviewcomunication.js" );

importScripts(   "tree/js/dboperations.js" );
importScripts(   "tree/js/treemodel.js" );

importScripts(   "signaturevalidator.js" );
importScripts(   "background.js" );
importScripts(   "backup/background-backup.js" );




