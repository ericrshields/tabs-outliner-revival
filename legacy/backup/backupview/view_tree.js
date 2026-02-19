/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

//FF_REMOVED_GA ga_screenview('Backup View');

function EntrysLoader(treeModel, treeId, userId, entrysCdidsListInOrderOfAppearence, entrysCdidsToNodesMap) {
    this.treeId                             = treeId;
    this.userId                             = userId;
//{#    this.treeModel                          = treeModel;#}
//{#    this.entrysCdidsListInOrderOfAppearence = entrysCdidsListInOrderOfAppearence;#}
    this.entrysCdidsToNodesMap              = entrysCdidsToNodesMap;

}
EntrysLoader.prototype.requestEntrysByRev = function(rev) {
    this._requestEntrys("/render_entrys?userId="+this.userId+"&treeId="+this.treeId+"&rev="+rev);
};

EntrysLoader.prototype.requestTreeByRev = function(rev) {
    this._requestTree("/render_knots?userId="+this.userId+"&treeId="+this.treeId+"&rev="+rev);
};

EntrysLoader.prototype.requestTreeByTime = function(utcTimestamp) {
    this._requestTree("/render_knots?userId="+this.userId+"&treeId="+this.treeId+"&utcTimestamp="+utcTimestamp);
};
EntrysLoader.prototype._entrysReady = function(entrysDict) {
    var entrysCdidsArray = [];
    for(var cdid in entrysDict) {
        if(cdid) entrysCdidsArray.push(cdid); //TODO А вообще надо view спросить кто счас виден, кто в конце, и такое прочее, и рендерить в порядке видимости
                                              // Более того, это надо спрашивать после каждого batch реально, так как могли проскролить нас
    }

    var BATCH_SIZE = 200; // TODO намного лучше бы считать по времени, примерно 100ms перед остановкой
    var PAUSE_BEFORE_NEXT_BATCH = 1;
    scheduleEntrysBatchInsert(BATCH_SIZE); // Done so in setTimeout to not block the rendering and userInput(scroll) upon restoring big trees, or even small

    var _this = this;

    function scheduleEntrysBatchInsert(entrysToInsertInOneBatch) {
        setTimeout( function insertEntrysInBatch() {
            // let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");
            // activeSessionTreeScrollableContainer.removeChild( treeView.currentSessionRowDom ); // Это оказалось плохой идеей. тормозит КУДА сильнее на полной перевставке всего дерева
            var cdid;
            while( cdid = entrysCdidsArray.pop() /*cdid cannot evaluate to false, we asure so when we add them to array*/ ) {
                // if(dictionary.hasOwnProperty(key)) не нужно, так как методов из prototype всёравно нет в this.entrysCdidsToNodesMap

                var node = _this.entrysCdidsToNodesMap[cdid];

                setEntry(node, entrysDict[cdid]); // TODO Read comment inside - it is very cost operation now, without a reason

                if(--entrysToInsertInOneBatch <= 0) {
                    scheduleEntrysBatchInsert(BATCH_SIZE);
                    break;
                }
            }
            if(entrysCdidsArray.length == 0) showAjaxSpiner(false);
            // activeSessionTreeScrollableContainer.insertBefore( treeView.currentSessionRowDom, activeSessionTreeScrollableContainer.firstChild );
        },
        PAUSE_BEFORE_NEXT_BATCH);
    }
};

EntrysLoader.prototype._knotsReady = function(treeData) {
    renderTree(treeData, window.document);
};

EntrysLoader.prototype._requestEntrys = function(url) {

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET",url,true);
    // xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    // xmlhttp.send("data="+encodeURIComponent( JSON.stringify(data) ));
    // xmlhttp.setRequestHeader("Content-type", contentType);
    xmlhttp.send();
    xmlhttp.onreadystatechange = onreadystatechange; // TODO in case of network errors this might not give reliable results, see also (& TEST!!) onabort, onerror, ontimeout, onloadend

    var _entrysReady = this._entrysReady.bind(this);
    function onreadystatechange() {
        if(this.readyState == this.DONE) {
            if(this.status == 200 && this.responseText != null) {
                _entrysReady(JSON.parse(this.responseText));
                return;
            }

            // something went wrong
            console.error(this);
        }
    }

    return xmlhttp;
    // this._entrysReady({"28h": "[7,{\"height\":1136,\"id\":10,\"left\":1,\"top\":1,\"type\":\"popup\",\"width\":400}]", "28j": "[4,{\"active\":true,\"favIconUrl\":\"chrome-extension://ohbcdlnedmchfcehpcokfgpncomdefoe/img/favicon.png\",\"highlighted\":true,\"id\":11,\"selected\":true,\"title\":\"Tabs Outliner\",\"url\":\"chrome-extension://ohbcdlnedmchfcehpcokfgpncomdefoe/activesessionview.html?type=main&focusNodeId=tab2&altFocusNodeId=win1&scrollToViewWinId=1\",\"windowId\":10}]", "2f6": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/favicon.ico\",\"highlighted\":true,\"id\":19,\"selected\":true,\"title\":\"localhost:8080/test_render_entrys?userId=185804764220139124118&treeId=1372831422963.6628&rev=550\",\"url\":\"http://localhost:8080/test_render_entrys?userId=185804764220139124118&treeId=1372831422963.6628&rev=550\",\"windowId\":18}]", "2es": "[4,{\"active\":true,\"favIconUrl\":\"https://www.google.com.ua/favicon.ico\",\"highlighted\":true,\"id\":26,\"selected\":true,\"title\":\"safasf - Google Search\",\"url\":\"https://www.google.com.ua/search?q=safasf&oq=safasf&aqs=chrome..69i57j0l3.1824j0&sourceid=chrome&ie=UTF-8\",\"windowId\":25}]", "2": "[1,{\"treeId\":\"1372831422963.6628\",\"nextDId\":311,\"nonDumpedDId\":1}]", "2fg": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/static/img/favicon.png\",\"highlighted\":true,\"id\":23,\"selected\":true,\"title\":\"Tabs Outliner Tree (rev:561)\",\"url\":\"http://localhost:8080/test_render_tree?userId=185804764220139124118&treeId=1372831422963.6628&startingDid=1\",\"windowId\":18}]", "28z": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/favicon.ico\",\"highlighted\":true,\"id\":2,\"selected\":true,\"title\":\"Account Page\",\"url\":\"http://localhost:8080/profile?t=ag9kZXZ-dGFtbnViYXRlc3RyPgsSC1VzZXJQcm9maWxlIhUxODU4MDQ3NjQyMjAxMzkxMjQxMTgMCxILQWN0aW9uVG9rZW4YgICAgIDQuwoM&action=impart_state\",\"windowId\":1}]", "296": "[7,{\"focused\":true,\"height\":1106,\"id\":18,\"left\":515,\"top\":0,\"type\":\"normal\",\"width\":1226}]", "2ea": "[7,{\"focused\":true,\"height\":1106,\"id\":25,\"left\":632,\"top\":0,\"type\":\"normal\",\"width\":1226}]", "293": "[8,{\"focused\":true,\"height\":1106,\"id\":1,\"left\":350,\"top\":14,\"type\":\"normal\",\"width\":1226}]"})
};

EntrysLoader.prototype._requestTree = function(url) {

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET",url,true);
    // xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    // xmlhttp.send("data="+encodeURIComponent( JSON.stringify(data) ));
    // xmlhttp.setRequestHeader("Content-type", contentType);
    xmlhttp.send();
    xmlhttp.onreadystatechange = onreadystatechange; // TODO in case of network errors this might not give reliable results, see also (& TEST!!) onabort, onerror, ontimeout, onloadend

    var _knotsReady = this._knotsReady.bind(this);
    function onreadystatechange() {
        if(this.readyState == this.DONE) {
            if(this.status == 200 && this.responseText != null) {
                _knotsReady(JSON.parse(this.responseText));
                return;
            }

            // something went wrong
            console.error(this);
        }
    }

    return xmlhttp;
    // this._entrysReady({"28h": "[7,{\"height\":1136,\"id\":10,\"left\":1,\"top\":1,\"type\":\"popup\",\"width\":400}]", "28j": "[4,{\"active\":true,\"favIconUrl\":\"chrome-extension://ohbcdlnedmchfcehpcokfgpncomdefoe/img/favicon.png\",\"highlighted\":true,\"id\":11,\"selected\":true,\"title\":\"Tabs Outliner\",\"url\":\"chrome-extension://ohbcdlnedmchfcehpcokfgpncomdefoe/activesessionview.html?type=main&focusNodeId=tab2&altFocusNodeId=win1&scrollToViewWinId=1\",\"windowId\":10}]", "2f6": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/favicon.ico\",\"highlighted\":true,\"id\":19,\"selected\":true,\"title\":\"localhost:8080/test_render_entrys?userId=185804764220139124118&treeId=1372831422963.6628&rev=550\",\"url\":\"http://localhost:8080/test_render_entrys?userId=185804764220139124118&treeId=1372831422963.6628&rev=550\",\"windowId\":18}]", "2es": "[4,{\"active\":true,\"favIconUrl\":\"https://www.google.com.ua/favicon.ico\",\"highlighted\":true,\"id\":26,\"selected\":true,\"title\":\"safasf - Google Search\",\"url\":\"https://www.google.com.ua/search?q=safasf&oq=safasf&aqs=chrome..69i57j0l3.1824j0&sourceid=chrome&ie=UTF-8\",\"windowId\":25}]", "2": "[1,{\"treeId\":\"1372831422963.6628\",\"nextDId\":311,\"nonDumpedDId\":1}]", "2fg": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/static/img/favicon.png\",\"highlighted\":true,\"id\":23,\"selected\":true,\"title\":\"Tabs Outliner Tree (rev:561)\",\"url\":\"http://localhost:8080/test_render_tree?userId=185804764220139124118&treeId=1372831422963.6628&startingDid=1\",\"windowId\":18}]", "28z": "[4,{\"active\":true,\"favIconUrl\":\"http://localhost:8080/favicon.ico\",\"highlighted\":true,\"id\":2,\"selected\":true,\"title\":\"Account Page\",\"url\":\"http://localhost:8080/profile?t=ag9kZXZ-dGFtbnViYXRlc3RyPgsSC1VzZXJQcm9maWxlIhUxODU4MDQ3NjQyMjAxMzkxMjQxMTgMCxILQWN0aW9uVG9rZW4YgICAgIDQuwoM&action=impart_state\",\"windowId\":1}]", "296": "[7,{\"focused\":true,\"height\":1106,\"id\":18,\"left\":515,\"top\":0,\"type\":\"normal\",\"width\":1226}]", "2ea": "[7,{\"focused\":true,\"height\":1106,\"id\":25,\"left\":632,\"top\":0,\"type\":\"normal\",\"width\":1226}]", "293": "[8,{\"focused\":true,\"height\":1106,\"id\":1,\"left\":350,\"top\":14,\"type\":\"normal\",\"width\":1226}]"})
};



// TODO - больше логично это в самой модели вроде держать? Почему View получает на это ссылку?
// var backgroundInterpagesComunicationStorageForDragedItems = {
//     tabsOutlinerDraggedModel:null,
//
//     'setDragedModel' : function (model) {
//         this.tabsOutlinerDraggedModel = model;
//     },
//
//     'clearDragedModel' : function () {
//         this.tabsOutlinerDraggedModel = null;
//     },
//
//     'getDragedModel' : function () {
//         return this.tabsOutlinerDraggedModel;
//     }
// };

function renderTree(treeData, treeBackupFileData, document) {
    window.treeData = treeData;
    document.title = treeData.treeTitle + " (Rev:" + treeData.treeRev + " Time:"+ (new Date(treeData.treeUtcTimestamp)).toLocaleString()+")";

    // document.getElementById('revId').value       = treeData.treeRev;
    // document.getElementById('revDateTime').value = (new Date(treeData.treeUtcTimestamp-timeShift)).toISOString().slice(0,-1); // slice to cut trailing 'Z' character
    var timesaved = new Date(treeData.treeUtcTimestamp-timeShift);
    document.title = "Tabs Outliner Backup saved at " + timesaved.toLocaleTimeString() + ", " + timesaved.toLocaleDateString(); //savetime.toLocaleString(); //i18n +



    var entrysCdidsListInOrderOfAppearence = [];
    var entrysCdidsToNodesMap = {};

    var treeModel;
    if(treeBackupFileData) {
        // var rootNode = new NodeSession();
        // rootNode.insertSubnode( 0, new NodeNote( {'note':"#1"}) );
        // rootNode.insertSubnode( 1, new NodeNote( {'note':"#2"}) );

        var rootNode = restoreTreeFromOperations(treeBackupFileData);

        treeModel = extentToTreeModel([rootNode], dummyTreePersistenceManager);
        showAjaxSpiner(false);

    } else {
        treeModel = buildTreeModel(treeData.beFilled_rootDid, treeData.beFilled_allKnots, entrysCdidsListInOrderOfAppearence, entrysCdidsToNodesMap);

        var entrysLoader = new EntrysLoader(treeModel, treeData.treeId, treeData.userId, entrysCdidsListInOrderOfAppearence, entrysCdidsToNodesMap);
        entrysLoader.requestEntrysByRev(treeData.treeRev);
    }

    // -----------------------------------------------------------------------------------------------------------------

    let activeSessionTreeScrollableContainer = document.getElementById("ID_activeSessionTreeScrollableContainer");

    //Хз ваще нафиг этот код по удалению какогото существующего дерева старого из HTML кода, там его вроде не должно быть
    //до манифеста3 рут узел носил id == currentSessionRoot, теперь стал id == 1 но ващет это некрасиво ужасно что я тут знание о id рут узла юзаю
    //чесно говоря я даже не знаю когда этот код исполняется и нужен ли он
    var oldTree = document.getElementById("currentSessionRoot");
    if(oldTree) activeSessionTreeScrollableContainer.removeChild(oldTree);
    oldTree = document.getElementById("1");
    if(oldTree) activeSessionTreeScrollableContainer.removeChild(oldTree);

    var lastChildCssFix = document.getElementById("lastChildCssFix");
    if(lastChildCssFix) activeSessionTreeScrollableContainer.removeChild(lastChildCssFix);

    activeSessionTreeScrollableContainer.appendChild( createTreeView( document.defaultView/*window*/, treeModel, 1, 20 ) );

    // TODO Механизм scrollToLastNodeCompensator надо вынести в отдельный файл из activesessionview
    // А тут мы тупо добавляем пустой div чтоб прибить срабатывание :last-child селектора на сессии. Который рисует тупиковую точку
    if(!lastChildCssFix) {
        lastChildCssFix = document.createElement("div");
        lastChildCssFix.id = "lastChildCssFix";
        lastChildCssFix.setAttribute('style', 'height:40px;');
    }

    activeSessionTreeScrollableContainer.appendChild( lastChildCssFix ); // Механизм для того чтоб возможно было проскролить дерево так чтоб даже самая последняя нода окна могла быть показано в первой строчке вьюпорта
    // applyCustomUserStyles();

    prepareDomForSavedAsHtmlMode__()
}

function prepareDomForSavedAsHtmlMode__() {
    document.styleSheets[0].addRule('a:hover','text-decoration: underline; cursor:pointer;');
    document.styleSheets[0].addRule('.node_text','cursor: auto;');

    // makeAllElementsDragable();

    //RR replaceChromeFaviconUrls__();
}

function replaceChromeFaviconUrls__() {
    var images = document.images;
    for (var i = 0; i < images.length; i++){
        var imgsrc = images[i].dataset['nodeIconForHtmlExport'] || images[i].src;
        images[i].src = isChromeUrl(imgsrc) ? "img/chrome-window-icon-rgb.png": imgsrc;
    }
}

function isChromeUrl(url) {
    return url.indexOf("chrome:") == 0;
}

// //var treeData = {{treeData}};
//{#
//var treeData = {
//    beFilled_rootDid  : '{{rootDid}}',
//    beFilled_allKnots : {{treeStructure}},
//    userId            : '{{userId}}',
//    treeId            : '{{treeId}}',
//    treeRev           : '{{treeRev}}',
//    treeUtcTimestamp  : {{treeTimestamp}}*1000',
//    treeTitle         : '{{treeTitle}}'
//}
//#}

var timeShift = (new Date()).getTimezoneOffset()*(60*1000);

var treeData = {
    beFilled_rootDid  : 'none',
    beFilled_allKnots : 'none',
    userId            : 'none',
    treeId            : 'none',
    treeRev           : '?',
    treeUtcTimestamp  : 0,
    treeTitle         : 'Tabs Outliner Backup File'
};

function ThrotleEvent(action) {
    this.interval = 1000;
    this.timerId = null;
    this.action = action;
    this.event = null;
}
ThrotleEvent.prototype._fireAction = function _fireAction() {
    this.action(this.event);
    this.event = null;
};
ThrotleEvent.prototype.eventListener = function eventListener(event) {
    this.event = event;
    clearTimeout(this.timerId);
    this.timerId = setTimeout(ThrotleEvent.prototype._fireAction.bind(this), this.interval);
};
function throtleEvent(action) {
    return ThrotleEvent.prototype.eventListener.bind( new ThrotleEvent( action ) );
}

// document.getElementById('revId').onclick = onRevClick;
// document.getElementById('revId').onkeyup = throtleEvent(onRevClick);
// document.getElementById('revDateTime').onchange = onRevDateTimeRequest;

//document.getElementById('revDateTime').onkeyup = onRevDateTimeEnter;

function showAjaxSpiner(isVisible) {
    document.getElementById("ajaxSpiner").style.display = isVisible ? "block" : "none";
}


function onRevDateTimeRequest(event) {
    if(!event.target.value) return; // Can be "" if user click reset btn in date control

    var entrysLoader = new EntrysLoader(null, treeData.treeId, treeData.userId, null, null);
    entrysLoader.requestTreeByTime(Date.parse(event.target.value)+timeShift);

    showAjaxSpiner(true);
}

function onRevClick(event) {
    var requestedRev = event.target.value;
    if(requestedRev == window.treeData.treeRev) return;

    var entrysLoader = new EntrysLoader(null, treeData.treeId, treeData.userId, null, null);
    entrysLoader.requestTreeByRev(requestedRev);

    showAjaxSpiner(true);
}

function getUrlParameters() {
    var queryDict = {};
    location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});
    return queryDict;
}

function openTreeFromUrl(downloadUrl, treeData) {
    //Google bug fix
    downloadUrl = downloadUrl.replace('content.google','www.google'); // Fix for not being able to open backup, url changes - https://issuetracker.google.com/issues/150193301

//FF_REMOVED_GA 
//    var access_token = gapi.auth.getToken().access_token;
//    if(!access_token) {
//        // most likely page just restored by url, yet we can access the token anyway....
//        // We can use Ext Identity ID or ask the token using Auth Api
//        console.error("No Auth Token");
//    }

    chrome.identity.getAuthToken({ 'interactive': true }, function(token) { // interactive true - this way if token absent or expired we request them again, it's not show dialog if token present
        if(token) {
            ajax(downloadUrl, token, updateProgress)
            .then(JSON.parse) // will parse response with backupData, JSON.parse SyntaxError exception will be handled by Promise.catch
            .then(function(backupDataJson) {
                renderTree(treeData, backupDataJson, document);
                //FF_REMOVED_GA ga_event_backup_view('Backup View Tree Successfully Rendered');
            })
            .catch(function(error/*Error object*/) {
                console.error(error);
                if(error instanceof AuthorizationError) {
                    rewokeToken();
                    alert("Authorization Error. Please reload this page and Authorize Google Drive Access in Authorize dialog which will appear.");
                    //FF_REMOVED_GA ga_event_backup_view('Backup View Error', 'Gdrive Authorization Error');
                } else if( error instanceof SyntaxError){ // JSON.parse exception
                    alert("Error: Tree Data has invalid format.");
                    //FF_REMOVED_GA ga_event_backup_view('Backup View Error', 'Data In Invalid Format');
                } else {
                    alert(error.toString());
                    //FF_REMOVED_GA ga_event_backup_view('Backup View Error', error.toString());
                }
            });
        } else {
            console.error("Auth token undefined. chrome.runtime.lastError:", chrome.runtime.lastError);
            alert("Error: " + chrome.runtime.lastError.message);
            rewokeToken();
            //FF_REMOVED_GA ga_event_backup_view('Backup View Error', 'No Auth Token');
        }
    });
}

function rewokeToken() {
    backgroundport.postMessage({request:"request2bkg_authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews"});
}

function updateProgress(oEvent) {
  if (oEvent.lengthComputable) {
        var percentComplete = 100*(oEvent.loaded / oEvent.total);
        document.getElementById('ajaxSpinerPercentComplete').innerText = Math.floor(percentComplete)+'%';
  } else if(fileSize) {
        var percentComplete = 100*(oEvent.loaded / fileSize);
        document.getElementById('ajaxSpinerPercentComplete').innerText = Math.floor(percentComplete)+'%';
  }
}

function getJSON(url) {
  return ajax(url).then(JSON.parse);
}

function AuthorizationError() {
    this.name = "AuthorizationError";
    this.message = "Authorization Error";
}
AuthorizationError.prototype = Object.create(Error.prototype); // Object.create is a must, or any error will pass the instaceof test for AuthorizationError
AuthorizationError.prototype.constructor = AuthorizationError; // Not sure why this needed. but MDN suggest so

var Promise = Promise || function(){alert('Error:Promises is not supported')}// Просто чтоб красным не подсвечивало в редакторе

function ajax(url, authToken, progresseventhandler) {
    return new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.setRequestHeader("Authorization", "Bearer " + authToken);

        xhr.addEventListener("progress", progresseventhandler, false);

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (xhr.status == 200) {
                resolve(xhr.response);
            } if (xhr.status == 401) { // This will be a result in case any problem with the token, we need then revoke token
                reject(new AuthorizationError()); // xhr.statusText in this case is 'OK'
            } if (xhr.status == 403) { // This will be a result in case url is invalid
                reject(Error("403 Access Denied (invalid URL)")); // xhr.statusText in this case is 'OK'
            } if (xhr.status == 404) {
                reject(Error("404 No Such File On Server")); // xhr.statusText in this case is 'OK'
            }
            else {
                // reject with the status text which will hopefully be a meaningful error
                reject(Error("Server respond with Error. status:"+xhr.status+"; statusText:" + xhr.statusText));
            }


        };

        // Handle network errors
        xhr.onerror = function() {
          reject(Error("A network error occurred, and the download could not be completed. Check you Internet connection."));
        };

        // Make the request
        xhr.send();
    });
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

// ----------------------------------------------------------------------------------------------
// Function to read the content of the file from the temporary filesystem
function readSessionDataFromUserSelectedFile(path, callback) {

    // path = 'selectedFile'; // Hardcoded 

    // Request the temporary filesystem again
    window.webkitRequestFileSystem(window.TEMPORARY, 1024*1024, function(fs) {
        // Get the file from the filesystem
        fs.root.getFile(path, {}, function(fileEntry) {
            // Create a FileReader object to read the file content
            fileEntry.file(function(file) {
                readJsonOperationsFromFile(file, callback);

                // var reader = new FileReader();

                // reader.onload = function(e) {
                //     var content = e.target.result;
                //     console.log('Read file content:', content);
                // };

                // reader.onerror = function(e) {
                //     console.log('Error reading file:', e);
                // };

                // Read the file content as text
                //reader.readAsText(file);
            }, fsErrorHandler);
        }, fsErrorHandler);
    }, fsErrorHandler);
    
    // Error handling function for the filesystem
    function fsErrorHandler(error) {
        console.log('Filesystem Error:', error);
    }
}


// function readSessionDataFromUserSelectedFile(callback) {
//     readJsonOperationsFromFile(userSelectedFileToOpen, callback);
// }

function readJsonOperationsFromFile(file, callback) {
    var reader = new FileReader();
    reader.onloadend = function(e) {
        try { 
            var operations = JSON.parse(e.target.result); 
        } 
        catch(parseError) { 
            console.error("Error parsing JSON", parseError);
            callback(parseError); 
        }
        callback(operations);
    };
    reader.onerror = function fsErrorHandler(error) {
        console.error('Filesystem Error:', error);
        callback(error);
    }

    reader.readAsText(file); // Тип UTF энкодинга будет определён по первым байтам файлам или UTF-8 если они его не задают (вродебы)
    //reader.readAsArrayBuffer(file);
}

function openTreeFromFilesystem(path, treeData){
    readSessionDataFromFile(path, function(backupData) {
        renderTree(treeData, backupData, document);
    });
}

function openTreeFromUserInput(path, treeData){
    readSessionDataFromUserSelectedFile(path, function(backupData) {
        renderTree(treeData, backupData, document);
    });
}

var queryDict = getUrlParameters();

var path = decodeURIComponent( queryDict.path );
var fileSize = Number(queryDict.fileSize);

treeData.treeUtcTimestamp = parseInt(queryDict.timestamp) + timeShift;

if (path) {
    if(queryDict.isLocal != 'true') {
        openTreeFromUrl(path, treeData);
    } else {
        if(queryDict.isUserSelectedFile == 'true')
            openTreeFromUserInput(path, treeData);
        else
            openTreeFromFilesystem(path, treeData);
    }
}

//renderTree(treeData, document);

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

