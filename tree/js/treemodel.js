/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

"use strict";

var nextIdForBackgroudViewCommunication = 1;

function getDisplayWorkAreaBounds(callback) {
    chrome.system.display.getInfo((displays) => {
        let primaryDisplayWorkArea;
        let anyDisplayWorkArea;
        displays.forEach((display) => {
            if(display.isPrimary) primaryDisplayWorkArea = display.workArea;
            anyDisplayWorkArea = display.workArea;   
        });
        if(!primaryDisplayWorkArea) primaryDisplayWorkArea = anyDisplayWorkArea; // Just to be safe in case no display with dispalay.isPrimary seet to true, не факт что так бывает вообще, но вдруг

        callback(primaryDisplayWorkArea);
    });
}

//======================================================================================================================
// Model Metods & Utilities
//======================================================================================================================
//function getHttpAndHostname(str) {
//    var re = new RegExp('^(?:f|ht)tp(?:s)?\://[^/]+', 'im');
//    var match = str.match(re);
//    console.log(str, match)
//    if(match) return match[0].toString() + "/";
//    else      return "";
//}

function isNewTab(chromeTabObj) {
    return chromeTabObj.url == 'chrome://newtab/' || chromeTabObj.url.indexOf("sourceid=chrome-instant") > 0; // идbотские instant newtab имеют такое в урле
}

function isPropertiesEqual(obj1, obj2, propertiesList) {
    for(var i = 0; i < propertiesList.length; i++)
        if(obj1[propertiesList[i]] !== obj2[propertiesList[i]]) return false;
    return true;
}

function i2s36(v) {
    return v.toString(36);
}

function s2i36(v) {
    return parseInt(v,36);
}

function addToCollectionUnderS36Key(collectionsDict, collectionName, intKey, content) {
    if(!collectionsDict[collectionName]) collectionsDict[collectionName] = {};
    collectionsDict[collectionName][ i2s36(intKey) ] = content;
}

function oneLevelObjectClone(o) {
  var r = {};
  for (var i in o) {
      //noinspection JSUnfilteredForInLoop
      r[i] = o[i];
  }

  return r;
}

function findById(array, id) {
    if(!array) return null;

    for(var i = 0; i < array.length; i++)
        if(array[i]['id'] === id) return array[i];

    return null;
}

// ---------------------------------------------------------------------------------------------------------------------

// TODO идеи некоторых оптимизаций SubnodesChangesMonitor (#changes-pack):
// [DONE] -i, +i <- можно заменить на i replaced - !!!!!! Это самый частый кейс!!! его надо обязательно оптимизнуть
// [DONE] replaced_i, replaced_i <- можно сократить до просто replaced_i
// [DONE, через replaced_i, replaced_i] -i, +i, -i, +i <- можно сократить до -i, +i
// +i, -i  <- Вставили и грохнули потом, можно вообще выкидывать из Changes просто последнюю вставку
// +i, +i+1, +i+2 <- можно перекодировать как range, тоже самое с deleted sequence
// Вообще на выходе после применения всех этих операций мы получаем вот такую строку:
//         #++####+##+##
// где # соответствуют некоторым старым элементам (не всем подряд, бо некоторые удалены)
// и думаю её мона бы было закодировать както проще, даже темже Diff
//
// + insert(i)
// + delete(i)
// + replace(i)
//
// pre serialize packs/post deserialize unpacks
// - ins_at_end()  !!! verycomon case - TODO MUST
// - replace_at_end() !!! very comon case - TODO MUST
// - delete_at_end()
// - все те саме тока at_start() - не так часто надо на самом деле
// - сжимать серии replace(i) с темже i[DONE], или at_end или at_start до одного элемента
//
// - insert_range(i,len)   +i=len
// - delete_range(i,len)   -i=len
// - ins_at_end n times in a row
// - ins_at_start n times in a row
// - del_at_end n times in a row
// - del_at_start n times in a row
//
// Warning. Акуратно тут с сиволами, нельзя юзать для операций тежи символы по которым разрезается node skelet (строками выше определены)
function last(array) {
    return array[array.length - 1];
}

var CDID_SDID_SEPARATOR = '#';
var CDID_SUBNODESLIST_SEPARATOR = '@';
var CDIDSDID_SUBNODESBASEMODIFICATIONS_SEPARATOR = '#';

var OPS_SEPARATOR = '|'; // TODO вообщето ops могли бы обойтись и без этого сепаратора, так как они всегда с операции начинаются
var NEW_DIDS_SEPARATOR = '/';
var SUBNODES_DIDS_SEPARATOR = '&';
var OPS_COMPONENTS_SEPARATOR = '=';

//function SybnodesChangesMonitor() {
//    this.ops = [];
//    this.baseSubnodesArrayLength = 0;
//}

//SybnodesChangesMonitor.prototype.reset = function(baseSubnodesArrayLength) {
//    this.baseSubnodesArrayLength = baseSubnodesArrayLength;
//};

//SybnodesChangesMonitor.prototype.inserted = function(curi) {
//    var curi_base36 = i2s36(curi);
//    if( last(this.ops) === ('-'+curi_base36) ) { // Это replace(i) // this.ops[this.ops.length-1] returns undefined on zero length, so its okey
//        this.ops.pop();
//        if( last(this.ops) !== ('^'+curi_base36) ) // Проверка на replace(i), replace(i)
//            this.ops.push('^'+curi_base36);
//    } else
//        this.ops.push('+'+curi_base36);
//};
//SybnodesChangesMonitor.prototype.deleted = function(curi) {
//    this.ops.push('-'+i2s36(curi)); // See also insert, this is tested for detecting replaces
//};
//SybnodesChangesMonitor.prototype.applyOperationsOnArray = function(arrayToModify, ops, new_node_filler) {
//    for(var i = 0; i < ops.length; i++) {
//        var op = ops[i];
//        var op_i = s2i36(op.substring(1));
//        if (op[0] === '+' ) {
//            arrayToModify.splice(op_i, 0, new_node_filler); //Insert
//        } else if(op[0] === '^' ) {
//            arrayToModify[op_i] = new_node_filler;          //Replace
//        } else {
//            arrayToModify.splice(op_i, 1);                  //Delete
//        }
//        // console.log('applyOperationsOnArray', op, op[0], op_i, '['+arrayToModify.join(SUBNODES_DIDS_SEPARATOR)+']')
//    }
//    return arrayToModify;
//};
//SybnodesChangesMonitor.prototype.callForAllMarkerItemsOfArray = function(array, marker, callback/*(array, i)*/) {
//    for(var i = 0; i < array.length; i++) {
//        if(array[i] === marker) callback(array, i);
//    }
//};
function SybnodesChangesMonitor_isChangesToBase(curSubnodesDids, baseSubnodesArray) {
    if(curSubnodesDids.length != baseSubnodesArray.length) return true;

    for(var i = 0; i < curSubnodesDids.length; i++ ) if(curSubnodesDids[i] != baseSubnodesArray[i]) return true;

    return false;
}

function SybnodesChangesMonitor_serializeCurSubnodes(curSubnodesDids, baseSubnodesArray) {
    var lastFoundDidInBasePos = -1;

    var diff = [];

    for(var curCursor = 0; curCursor < curSubnodesDids.length; curCursor++ ) {
        var si = baseSubnodesArray.indexOf(curSubnodesDids[curCursor], lastFoundDidInBasePos+1);
        // TODO, дополнительная оптимизация, на первом проходе определить макс did в baseArray и не истать вообще тех кто его больше
        if(si < 0) { // Новый did
            diff.push(curSubnodesDids[curCursor]);
        } else { // Один из старых did
            if(lastFoundDidInBasePos+1 === si) {
                var last_op = last(diff);
                if(last_op/*can be undefined*/ && last_op[0] === '*' ) {
                    var op = diff.pop();
                    var n = s2i36(op.split('*')[1]);
                    if(isNaN(n)) n = 1;
                    diff.push('*' + i2s36(++n) ); // Use old
                } else {
                    diff.push('*');
                }
            } else {
                n = si - (lastFoundDidInBasePos+1);
                if(n === 1)
                    diff.push('-');
                else
                    diff.push('-' + i2s36(n));
            }

            // TODO **** -> *4 ; 3*** - >  3*3; причём  i2s36

            lastFoundDidInBasePos = si;
        }
    }

    return diff.join(OPS_SEPARATOR);
}

function SybnodesChangesMonitor_restoreSubnodesList(baseSubnodesArray, changes_str) {
    var diff =  changes_str.split(OPS_SEPARATOR);

    var baseCursor = 0;

    var r_restoredSubnodes = [];

    for(var i = 0; i < diff.length; i++ ) {
        var op = diff[i];

        if(op[0] === '*') {
            var n = s2i36(op.split('*')[1]);
            if(isNaN(n)) n = 1;
            while(n-- > 0) r_restoredSubnodes.push(baseSubnodesArray[baseCursor++]);
        } else if(op[0] === '-') {
            n = s2i36(op.split('-')[1]);
            if(isNaN(n)) n = 1;
            baseCursor += n;
            r_restoredSubnodes.push(baseSubnodesArray[baseCursor++]);
        } else {
            r_restoredSubnodes.push(op);
        }
    }

   return r_restoredSubnodes;
};
function getBaseSubnodesArray(baseKnot /*cdid@did&did&did*/) {
    return baseKnot.split(CDID_SUBNODESLIST_SEPARATOR)[1].split(SUBNODES_DIDS_SEPARATOR);
}

// See testSubnodesChangesAlgorithm()
// Тут бы не помешали примеры того как эти ops выглядят в сериализированном виде
// да и что вообще в ops хранится
// в ops хранится операции модификации, вроде '+index_in_subnodes_base36' '-indes_in_subnodes_base36'
//SybnodesChangesMonitor.prototype.serializeCurSubnodes = function(curSubnodesDids) {
//   var ops = this.ops;
//   var rdids = [];
//   var old = new Array(this.baseSubnodesArrayLength);
//   // console.log("serializeCurSubnodes -", old.join(SUBNODES_DIDS_SEPARATOR));
//
//   var NEW_DID_ENTRY_MARK = '+';
//   this.applyOperationsOnArray(old, ops, NEW_DID_ENTRY_MARK);
//   this.callForAllMarkerItemsOfArray(old, NEW_DID_ENTRY_MARK, function(array, i){
//       rdids.push(curSubnodesDids[i])
//   });
//
//   return [ this.ops.join(OPS_SEPARATOR),
//            i2s36(this.baseSubnodesArrayLength),
//            rdids.join(NEW_DIDS_SEPARATOR) ].join(OPS_COMPONENTS_SEPARATOR); //WARNING Any changes there affect restoreSubndesList & deserializeToContinue
//};
//SybnodesChangesMonitor.prototype.deserializeOpsFromChangesSerializedData = function(changes) {
//   return changes[0].split(OPS_SEPARATOR);
//};
//SybnodesChangesMonitor.prototype.deserializeBaseDidsListLengthFromChangesSerializedData = function(changes) {
//   return s2i36(changes[1]);
//};
//SybnodesChangesMonitor.prototype.deserializeNewDidFromChangesSerializedData  = function(changes) {
//   return changes[2].split(NEW_DIDS_SEPARATOR);
//};
//SybnodesChangesMonitor.prototype.deserializeToContinue = function(changes_str) {
//    var changes =  changes_str.split(OPS_COMPONENTS_SEPARATOR);
//
//    this.ops                     = this.deserializeOpsFromChangesSerializedData(changes);
//    this.baseSubnodesArrayLength = this.deserializeBaseDidsListLengthFromChangesSerializedData(changes);
//};
//SybnodesChangesMonitor.prototype.restoreSubnodesList = function(oldSubnodes, changes_str) {
//   var changes =  changes_str.split(OPS_COMPONENTS_SEPARATOR);
//
//   var ops = this.deserializeOpsFromChangesSerializedData(changes);
//   var new_added_dids = this.deserializeNewDidFromChangesSerializedData(changes);
//   var r_restoredSubnodes = oldSubnodes.slice(0);
//
//   var NEW_DID_ENTRY_MARK = '+';
//   this.applyOperationsOnArray(r_restoredSubnodes, ops, NEW_DID_ENTRY_MARK);
//
//   var j = 0;
//   this.callForAllMarkerItemsOfArray(r_restoredSubnodes, NEW_DID_ENTRY_MARK, function(array, i){
//       array[i] = new_added_dids[j++];
//   });
//
//   return r_restoredSubnodes;
//};

function testSubnodesChangesAlgorithm() {
    var did = 10000;
    var subnodes = [];

    for(var i = 0; i < 400; i++) subnodes.push(i2s36(did++));

    var subnodes_old = subnodes.slice(0);
    var sdidKnot = 'ffff' + CDID_SUBNODESLIST_SEPARATOR + subnodes_old.join(SUBNODES_DIDS_SEPARATOR);

    // changesСollector.reset(subnodes_old.length);

    console.log('##############################################################################');
    console.log('INIT subnodes:', subnodes.join(SUBNODES_DIDS_SEPARATOR));
    function ins(i) {
        subnodes.splice(i, 0, i2s36(did++));

        // changesСollector.inserted(i);

        serializedDifference = SybnodesChangesMonitor_serializeCurSubnodes(subnodes.slice(0), getBaseSubnodesArray(sdidKnot));
        console.log('+('+i+') new_subnodes:', subnodes.join(SUBNODES_DIDS_SEPARATOR),
                    '\tops:', serializedDifference,
                    '\trestored:', SybnodesChangesMonitor_restoreSubnodesList(subnodes_old, serializedDifference).join(SUBNODES_DIDS_SEPARATOR));
    }

    function del(i) {
        subnodes.splice(i, 1);

        // changesСollector.deleted(i);

        serializedDifference = SybnodesChangesMonitor_serializeCurSubnodes(subnodes.slice(0), getBaseSubnodesArray(sdidKnot));
        console.log('-('+i+') new_subnodes:', subnodes.join(SUBNODES_DIDS_SEPARATOR),
                    '\tops:', serializedDifference,
                    '\trestored:', SybnodesChangesMonitor_restoreSubnodesList(subnodes_old, serializedDifference).join(SUBNODES_DIDS_SEPARATOR));
    }

    function replace(i) {
        del(i);
        ins(i);
    }

    function ins_at_end() {
        ins(subnodes.length);
    }

    function replace_at_end() {
        replace(subnodes.length);
    }

    function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    for(i = 0; i <= 100; i++) { //100
        var op = Math.random();
        var ins_i = getRandomInt(0, subnodes.length);
        var del_i = getRandomInt(0, subnodes.length-1);
        if(op < 0.2)         ins_at_end();
        else if(op < 0.3)    replace_at_end();
        else if (op < 0.6)   replace(del_i);
        else if (op < 0.69)  ins(ins_i);
        else if (op < 1)     del(del_i)
    }

    var subnodes_new = subnodes.slice(0);

    console.log('subnodes_old len:', subnodes_old.length, "serialized length:", subnodes_old.join(SUBNODES_DIDS_SEPARATOR).length );
    console.log('subnodes_new len:', subnodes_new.length, "serialized length:", subnodes_new.join(SUBNODES_DIDS_SEPARATOR).length );

    var serializedDifference = SybnodesChangesMonitor_serializeCurSubnodes(subnodes_new, getBaseSubnodesArray(sdidKnot));
    console.log('serializedDifference len:',JSON.stringify(serializedDifference).length);
    console.log('serializedDifference:', serializedDifference);
    var restoredSubnodes = SybnodesChangesMonitor_restoreSubnodesList(subnodes_old, serializedDifference);

    console.log('COMPARE:',restoredSubnodes.toString() === subnodes_new.toString());
    console.log('old      array:',subnodes_old.toString());
    console.log('new      array:',subnodes_new.toString());
    console.log('retored  array:',restoredSubnodes.toString());
}

//function findParentNode(nodesarray, node)
//{
//    // Ищем по всем обектам в их субнодах
//    for( var i = 0; i < nodesarray.length; i++)
//    {
//        if( nodesarray[i].subnodes.indexOf(node) >= 0)
//            return nodesarray[i];
//    }
//    // Не нашли в обектах текущего списка
//    // проведём поиск в по списку всех субнод из всех узлов этого уровня
//    for( i = 0; i < nodesarray.length; i++)
//    {
//        var parent = findParentNode(nodesarray[i].subnodes, node);
//        if(parent) return parent;
//    }
//
//    return null;
//}

// Return first occurency of node with given id or null
function findNodeById(nodesarray, id) {
    return findNode(nodesarray, function(node){return node.id === id} );
}

// Return first occurency of node for which callback give true
//Exact version of findNodeByIdMVC (so propagate any changes)
function findNode(nodesarray, condition) {
    for( var i = 0; i < nodesarray.length; i++)
        if( condition(nodesarray[i]) )
            return nodesarray[i];

    // Не нашли в обектах текущего списка
    // проведём поиск в по списку всех субнод из всех узлов этого уровня
    for( i = 0; i < nodesarray.length; i++)
    {
        if(nodesarray[i].subnodes.length > 0) {
            var node = findNode(nodesarray[i].subnodes, condition);
            if (node) return node;
        }
    }

    return null;
}

//Exact version of findNode (so propagate any changes)
//its just speed optimization, I remove 2 function calls
function findNodeByIdMVC(nodesarray, idMVC) {
    for( var i = 0; i < nodesarray.length; i++)
        if( nodesarray[i].idMVC == idMVC )
            return nodesarray[i];

    // Не нашли в обектах текущего списка
    // проведём поиск в по списку всех субнод из всех узлов этого уровня
    for( i = 0; i < nodesarray.length; i++)
    {
        if(nodesarray[i].subnodes.length > 0) {
            var node = findNodeByIdMVC(nodesarray[i].subnodes, idMVC);
            if (node) return node;
        }
    }

    return null;
}

// =====================================================================================================================================================
function extentToTreeModel(tree, treePersistenceManager, viewsCommunicationInterface)
{
    var rootNode = tree[0];
    rootNode.treeModel = tree;

    tree.viewsCommunicationInterface = viewsCommunicationInterface;

    tree.currentSession_rootNode = rootNode; // Tree должен теперь знать о сессии так как в ней оно будет хранить и сериализировать своё состояние, в частности nextDid

    tree.persistenceManager = treePersistenceManager;
    tree.persistenceManager.registerTree(tree);

    tree.saveNowOnViewClose = function() {
        this.persistenceManager.saveNow();
    };

    tree.hierarchyUpdated = function() {
        this.persistenceManager.treeUpdated();
    };

    // -----------------------------------------------------------------------------------------------------------------
    // TODO find методы мне не нравятся как сделаны
    tree.findActiveWindow = function(windowId) {
        return findNodeById(this, NodeTypesEnum.WINDOW + windowId ); // TODO - то что id формируется именно так это детали реализации!!! именно тех нод что так его формируют
    };

    tree.findActiveTab = function(tabId) {
        return findNodeById(this, NodeTypesEnum.TAB + tabId );
    };

    tree.findNodeByIdMVC = function(idMVC) {
        return findNodeByIdMVC(this, idMVC);
    }

    // -----------------------------------------------------------------------------------------------------------------

    tree.getAllCollapsedNodes = function() {
        var r = [];
        forEachNodeInTree_noChangesInTree(this, function(node) { if(node.colapsed) r.push(node); });
        return r;
    };

    tree.getListOfAllActiveWindowNodes = function () {
        var r = [];
        forEachNodeInTree_noChangesInTree(this, function(node) { if(node.type === NodeTypesEnum.WINDOW) r.push(node); });
        return r;
    };

    tree.setActiveTabInWindow = function(tabId, windowId) {
        // Не только селектаем нужный таб в соответствующем tabsOrginizer но и гасим selection для других табов этогоже окна
        var windowNode = this.findActiveWindow(windowId);

        if(!windowNode) {
            console.log("ERROR NOW SSTIW", tabId, windowId); // Cannot find window - setSelectedTabInWindow
            // TODO FULLRESCAN,
            // вот тока не всё так просто, хотя fullrescan таки надо зашедулить но не стоит его делать сразу
            // так как возможно мы тока что просто кильнули окно трешканом, и соответственно в дереве его уже нет
            // а это приходят эвенты из-за табов которые удаляются.
            // TODO правда когда мы киляли его трешканом его ID стоило именно по этому поводу запомнить! И тут таки чекать
            // нет ли его в списке тока что (или когда либо) удалённых окон в этой сессис
            // see isRemovedWindowIdUnexpected(chromeWindowId)
        }

        if(windowNode) windowNode.setActiveTab(tabId);
    };

    // if windowId === -1 значит операционка селектнула другую прогу, хром потерял фокус
    tree.setFocusedWindow = function (windowId, scrollToView) {
        //if(this.lastFocusedWindowId === windowId) return; // сделано ибо nowFocusedWindowNodeModel.setFocusedState(вызывает в том числе скролинг дерева)
                                                            // и если мы свитчаемся на TabsOutlinerView а потом обратно на тоже окно где были это недоречно
                                                            // (обычно)
                                                            // - таки сделали чтоб скролило и при возвратах на окно с которого зашли на таб аутлайнер - это более прогнозируемо для юзера

        var lastFocusedWindowNodeModel = this.findActiveWindow( this.lastFocusedWindowId );
        if(lastFocusedWindowNodeModel) lastFocusedWindowNodeModel.setChromeWindowObjFocused(false);

        var nowFocusedWindowNodeModel = this.findActiveWindow( windowId );
        if(nowFocusedWindowNodeModel)
        {
            if(scrollToView) nowFocusedWindowNodeModel.requestScrollNodeToViewInAutoscrolledViews(this.viewsCommunicationInterface); // Перед setFocusedState потому что если после иногда новоприменённые стили не рендерятся почемуто
            nowFocusedWindowNodeModel.setChromeWindowObjFocused(true);
        }
        else
        {
            console.error("ERROR NOW SFW", windowId);// ERROR setFocusedWindow() - window with id = "+windowId+" is not present in tree - this must not happen!!!
            //TODO (A) а если и произошло (бывает из-за моих глюков) хорошо бы сразу это окно воссоздать, вместе со всеми табами!!!
            //Тоже самое когда новый таб апдейт или криэйт или атач происходит для окна которого нет
            //TODO FULLRESCAN - at least schedule, after 1 min, сюда эти методы могут прибегать когда мы тока что кильнули окно в дереве трешканом но оно ещё в хроме не закрылось
            // see isRemovedWindowIdUnexpected(chromeWindowId)
        }

        this.lastFocusedWindowId = windowId;
    };

    function ensureAndPrepareTabsOrganizerForActiveTabsMove(dropTarget, dropedHierarchy, isCopyDrop) {
        var r = dropTarget;
        // Создаём новое окно если оно требуется для кого либо из дерева дропнутой модели и его нет выше точки дропа
        if(    !isCopyDrop/*копи дроп никогда не вставляет live обектов, доп таб органайзер не нужен*/
            && dropedHierarchy.isNotCoveredByWindowActiveTabsPresentInHierarchy() )
        {
            //TODO Cut&Paste в TabActive.ensureActivatedSavedOrAlreadyOpenTabsOrganizerIsPresentInPathToRoot, отличие тока в месте вставки и в том что для Active окна не просится реордеринг
            var tabsOrganizer = dropTarget.container.findFirstSavedOrOpenTabsOrganizerInPathToRoot();

            if( !tabsOrganizer ) {
                tabsOrganizer = new NodeWindowSaved();

                dropTarget.container.insertSubnode(dropTarget.position, tabsOrganizer);
                //noinspection AssignmentToFunctionParameterJS
                r = {'container':tabsOrganizer, 'position':-1};
            }

            if( tabsOrganizer.isRelatedChromeWindowAlive )
                tabsOrganizer._f_isWhantRequestTabsMove = true; // Либо внутри одного окна, либо между окон, пофиг, операция таже // Если окно ещё не создано этот флаг вобщето значения иметь не будет, можно не проверять условие
            else
                tabsOrganizer._f_isWhantRequestNewWindowCreation = true; // Условие лишнее - флаг не проверяется для Active окон
        }

        return r;
    };

    tree.moveHierarchy_byIdMVC = function(dropTarget, hierarchyToMoveIdMVC) {
        this.moveCopyHierarchy(dropTarget, this.findNodeByIdMVC(hierarchyToMoveIdMVC), false, null);
    };

    /*OVERRIDE similar method from TreeBase IN ActiveTree*/
    tree.moveCopyHierarchy = function(dropTarget, dropedNodeModel, isCopyDrop, port /*нужно для actionLinks.postInsertActions, активация диалога для Note, установка курсора*/) {
        // Warning - sometimes console === null there

        /*хак*/dropTarget.container = this.findNodeByIdMVC( dropTarget.containerIdMVC ); // ну это хак грязный, надо выкинуть ваще dropTarget.container
        
        function isSameNodeOrPresentInPathToRoot(dropTargetContainerIdMVC, dropedNodeModelIdMVC) {
            // этот метод скопирован с treeview.js и слегка изменен
            for(var testnode = this.findNodeByIdMVC(dropTargetContainerIdMVC); testnode; testnode = testnode.parentNode )
                if(testnode.id === dropedNodeModelIdMVC) return true;
            return false;
        }

        // Просто не позволяем рекурсивных вставок, хотя это можно позволить если заранее сделать копию вставляемого дерева а уже потом вставлять его
        if(dropedNodeModel.idMVC == dropTarget.container.idMVC || dropTarget.container.isSupliedNodePresentInPathToRoot(dropedNodeModel)) {
            if(console) console.error("Attempt of performing recursive drop", dropTarget, dropedNodeModel);
            // ващето проблем нет в том чтоб саму в себя вставлять, просто надо копию сначало сделать дерева которое вставляем и вставлять уже эту копию
            return; 
        } 

        // 1. Пордготовка места вставки. Возможно произойдёт вставка в месте назначения нового TabsOrganizer -----------
        dropTarget = ensureAndPrepareTabsOrganizerForActiveTabsMove(dropTarget, dropedNodeModel/*a hierarchy actualy*/, isCopyDrop);

        // 2. Рекурсивно для всей иерархии модели которую дропаем копируем её в место вставки --------------------------
        var _this = this;
        (function doRecursiveDrop_(dropTarget, dropedNodeModel, isCopyDrop) {
            var newTarget = (function nodeDropMethodCall( dropTarget, dropedNodeModel, isCopyDrop ) {
                                var clonedNodeModel = isCopyDrop ? dropedNodeModel.cloneForCopyInActiveTree_withoutSubnodes() : dropedNodeModel.copyConstructor_withoutSubnodes();
                                clonedNodeModel.previousIdMVC = dropedNodeModel.idMVC; // Используется в View для коректной перерисовки курсора
                                return { 'container':dropTarget.container.insertCopyAsSubnode_MoveCursor(dropTarget.position, clonedNodeModel/*fresh copy*/, dropedNodeModel/*to check for cursor*/, !isCopyDrop),
                                         'position':-1};
                            }) ( dropTarget, dropedNodeModel, isCopyDrop );

            dropedNodeModel.subnodes.forEach( function(nodeModel) { doRecursiveDrop_(newTarget, nodeModel, isCopyDrop) });
        })(dropTarget, dropedNodeModel, isCopyDrop);

        // 3. Удаляем дерево источник ----------------------------------------------------------------------------------
        if(!isCopyDrop) dropedNodeModel.removeOwnTreeFromParent(); // Нельзя это делать кстате в subnodes.forEach() !!!
                                        // Тут раньше стояло deleteHierarchy_MoveCursor - но оно тут не нужно, так как если курсор во время move операции был внутри
                                        // иерархии он переставится методом insertCopyAsSubnode_MoveCursor который вызывается выше
                                        // также deleteHierarchy_MoveCursor - метода нету на ActionLinkModelBase заглушках - падало тут в результате

        var affectedHierarchy = dropTarget.container.findFirstSavedOrOpenTabsOrganizerInPathToRoot(); // если были мувнуты табы то надо переордерить все табы окна
        if(!affectedHierarchy) affectedHierarchy = dropTarget.container;

        // 4. Заказываю у хрома оживление окон, реордеринг табов -------------------------------------------------------
        this.executeWaitedChromeOperations([affectedHierarchy]);

        // 5. Для ActionLinksButtons выполняю пост дроп операции - ввод тайтла, оживление линка ------------------------

        // Итак, это код который тока с кривой ActionLinkModelBase работает (клики и драги actionLinks) и то - потому что та во время копирования в дерево нод
        // та умудряется их запомнить, а .removeOwnTreeFromParent() ей пох, и ничего не делает, такой вот дикий хак
        // TODO это очень грубо, это хак, и это очень неявно, метод срабатывает так как гдето в нутри есть ссылки на вставленную новую иерархии,
        // тоесть он работает не над ЭТОЙ dropedNodeModel!!!
        if(dropedNodeModel.performAfterDropActionForDragedModelHierarchy) dropedNodeModel.performAfterDropActionForDragedModelHierarchy(port); // Вобщемто это надо тока для NodeText было, все остальные неплохо справлялись и внутри рекурсии
                                                                                                                                                   // Счас этот метод отвечает за перестановку курсора, но его тоже может ставить insertCopyAsSubnode_MoveCursor если туда передавать treeView
                                                                                                                                                   // Либо если перед дропом актион линк (в момент создания ActionLinkModelBase) запомнит TreeView в который оно вставляется (от там есть)

        // У нас не будут Wait Detach/Delete нод (табов или окон)
        // Причины:
        //  - Эта операция врядли будет часто спотыкаться. Delete/Detach почти всегда гарантирован
        //  - Наличие таких нод в случае если они являются субнодами других нод которые таки не имеют Wait Remove аналогов
        //    приведут к тому что эти паренты (напримерт текстовая нода) надо таки оставлять до тех пор пока делейт не произойдёт,
        //    а значит оно должно по сути заиметь новое состояние - удалить себя когда не будет детей... а ведь такой узел ещё и както
        //    надо показывать (при том что он уже скопирован со всеми пометками), и чтото с ним пользователь может
        //    сделать - тотже драг и дроп, пока он не исчез.
        //    Тоесть по сути любая ждущая удаления нода требует создания аналогичных у всех других нод, в дереве которых она может находится.
        //    Это неоправдонное усложнение для случая когда и так такие узлы особой ценности не несут и врядли вообще будут жить дольше 100ms
        //  - всё равно не ясно что с ними делать в случае если Remove таки не произошол. И где и как востанавливать - ведь пометки уже скопированы
        //    на Attach/Create Wait ноды
        //
        // Однако, возможноб всёже стоит сохранять список табов и окон для которых мы заказали удаление (хотя если для дебага то просто лога достаточно).
        // Но без Иконок/Тегов/notes или текстовых субнод - только ChromeTabObj и ChromeWinObj
        // И если удаление таки не произошло (в течении какогото времени, или при селекте их юзером в хроме) востанавливать их как
        // при обычном New Tab/Window инициированном пользователем.
        // При этом если Delete/Detach таки прийдёт то удалять by DeleteOrConvertToSavedIfMarked (но отметок у них не будет при востановлении,
        // и подузлов тоже, разве что это таки реально хроме глюкнул, отказался удалять, и юзер успел пометить)
    };

    tree.executeWaitedChromeOperations = ActiveTree_executeWaitedChromeOperations;

    // tree.deleteDeadObservers = function( currentlyClosedDocument, cursorOwner ) {
    //     forEachNodeInTree_noChangesInTree(this, function(nodeModel) { nodeModel.deleteDeadObservers(currentlyClosedDocument); });
    // };

    // Serialize -------------------------------------------------------------------------------------------------------

    // TODO все методы ниже имеют много общего, это обход иерархии, тут была попытка ввести единый способ такого обхода, но забил
    //    tree.processHierarchy = function(hierarchy, container, nodeSerializeCallback, enterSubnodesCallback, exitSubnodesCallback) {
    //        nodeSerializeCallback(nodeModel, container);
    //
    //        // process subnodes
    //        if(nodeModel.subnodes.length > 0) {
    //            var sub_container = enterSubnodesCallback(nodeModel, container);
    //
    //            for(var i = 0; i < nodeModel.subnodes.length; i++)
    //                this.processHierarchy(nodeModel.subnodes[i], sub_container, nodeSerializeCallback, enterSubnodesCallback, exitSubnodesCallback);
    //
    //            exitSubnodesCallback(nodeModel, sub_container);
    //        }
    //    };
    //
    //    tree.serializeAsJSO_ = function() {
    //        var r = {};
    //        function nodeSerializeCallback(nodeModel, container) {
    //            container['n'] = nodeModel.serialize();
    //        }
    //        function enterSubnodesCallback(nodeModel, container) {
    //            return container['s'] = [];
    //        }
    //        function exitSubnodesCallback(nodeModel, container) {
    //
    //        }
    //        this.processHierarchy(this.currentSession_rootNode, r, nodeSerializeCallback, enterSubnodesCallback, exitSubnodesCallback);
    //
    //        return r;
    //           (function doRecursiveSerialize_(nodeModel, container) {
    //               container['n']     = nodeModel.serialize();
    //
    //               // process subnodes
    //               if(nodeModel.subnodes.length > 0) {
    //                   container['s'] = [];
    //
    //                   for(var i = 0; i < nodeModel.subnodes.length; i++) {
    //                       container['s'][i] = {};
    //                       doRecursiveSerialize_(nodeModel.subnodes[i], container['s'][i]);
    //                   }
    //               }
    //           })(this.currentSession_rootNode, r);
    //
    //           return r;
    //       };

//    tree.makeTransferableRepresentation_MozUriList = function(hierarchy) { // For 'text/x-moz-url'
//        //http://www.mozilla.org
//        //Mozilla
//        //http://www.xulplanet.com
//        //XUL Planet
//
//
//        var r = "";
//        (function doRecursiveMozUrilise_(nodeModel) {
//            if( nodeModel.isLink )
//                r += nodeModel.getHref()+ '\n' + nodeModel.getNodeText()+'\n';
//
//            // process subnodes
//            if(nodeModel.subnodes.length > 0) {
//                for(var i = 0; i < nodeModel.subnodes.length; i++)
//                    doRecursiveMozUrilise_(nodeModel.subnodes[i]);
//            }
//        })(hierarchy);
//
//        return r;
//    };

    tree.makeTransferableRepresentation_UriList = function(hierarchy) { // For 'text/uri-list'
        //http://www.mozilla.org
        //#A second link
        //http://www.xulplanet.com


        // Title Коменты '#' не понимает вообще никто, ни ММ ни Firefox, ни Chrome
        // Подозреваю что MM понимал надо тащить просто HTML <a> формат

        // Если в списке более одного линка Chrome берёт первый, а вот MM последний
        // Поэтому мы вообще тока один елемент будем тут возвращать

        var r = [];

        (function doRecursiveUrilise_(nodeModel) {
            if( nodeModel.isLink )
                r.push( nodeModel.getHref() );

            // process subnodes
            if(nodeModel.subnodes.length > 0) {
                for(var i = 0; i < nodeModel.subnodes.length; i++)
                    doRecursiveUrilise_(nodeModel.subnodes[i]);
            }
        })(hierarchy);

        return r[0] ? r[0] : '';
    };

    tree.makeTransferableRepresentation_Html = function(hierarchy) { // For 'text/html'
        var r = "";
        (function doRecursiveHtmlise_(nodeModel) {

            if( nodeModel.isLink )
                r += '<li><a href="'+nodeModel.getHref()+'">'+nodeModel.getNodeText()+'</a></li>';
            else
                r += '<li>'+nodeModel.getNodeText()+'</li>';


            // process subnodes
            if(nodeModel.subnodes.length > 0) {
                r += '<ul>';

                for(var i = 0; i < nodeModel.subnodes.length; i++)
                    doRecursiveHtmlise_(nodeModel.subnodes[i]);

                r += '</ul>';
            }
        })(hierarchy);

        return r;
    };

    tree.makeTransferableRepresentation_TextMultiline = function(hierarchy) { // For 'text/plain'
        var r = "";
        var indent = "";
        var ONE_LEVEL_INDENT = "    ";
        (function doRecursiveTxtlise_(nodeModel) {

            if( nodeModel.isLink )
                r += indent + nodeModel.getNodeText()+' ('+nodeModel.getHref()+')';
            else
                r += indent + nodeModel.getNodeText();

            r += '\n';

            // process subnodes
            if(nodeModel.subnodes.length > 0) {
                indent += ONE_LEVEL_INDENT;

                for(var i = 0; i < nodeModel.subnodes.length; i++)
                    doRecursiveTxtlise_(nodeModel.subnodes[i]);

                indent = indent.slice(0, -ONE_LEVEL_INDENT.length);
            }
        })(hierarchy);

        return r;
    };

    tree.makeTransferableRepresentation_TabsOutlinerInterchangeFormat = function(hierarchy) { // For 'application/x-tabsoutliner-items'
        // Note that serializeOpenNodesAsSaved := true also play important role to nulify
        // dId, cdId, sdId, sdIdKnot properties
        return JSON.stringify(this.serializeHierarchyAsJSO(hierarchy, true /*serializeOpenNodesAsSaved*/));
    };

    tree.createHierarchyFromTabsOutlinerInterchangeFormat = function(data) {
        return restoreHierarchyFromJSO(JSON.parse(data));
    };

    // -----------------------------------------------------------------------------------------------------------------
    tree.serializeHierarchyAsJSO = function(hierarchy, serializeOpenNodesAsSaved) { // backward - restoreHierarchyFromJSO
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
    };

    tree.serializeAsOperationsLog = function() { // backward - restoreTreeFromOperations
        var rOperations = [];
        var rootNode = this.currentSession_rootNode;
        (function doRecursiveSerializeAsOp_(nodeModel, pathToNode) {
            if(pathToNode.length === 0)
                rOperations.push( { 'type' : DbOperations.OperationsEnum.NODE_NEWROOT
                                  , 'node' : nodeModel.serialize()                     } );
            else
                rOperations.push( [ DbOperations.OperationsEnum.NODE_INSERT,  nodeModel.serialize(), pathToNode ] ); // [type, node, path]
//              rOperations.push( { 'type' : DbOperations.OperationsEnum.NODE_INSERT
//                                , 'node' : nodeModel.serialize()
//                                , 'path' : pathToNode                              } );

            // process subnodes
            for(var i = 0; i < nodeModel.subnodes.length; i++) {
                var subnode       = nodeModel.subnodes[i];
                // var pathToSubnode = subnode.getPathToRoot(); // Делает поиск наверх + indexOf() оптимизация используемая сдесь вместо этого несколько ускоряет весь serialize (процентов на 20, 5-8ms выигрыш на 4000 нодах )
                var pathToSubnode =  pathToNode.concat(i);
                doRecursiveSerializeAsOp_(subnode, pathToSubnode);
            }

        })(rootNode, rootNode.getPathToRoot());

        rOperations.push( { 'type' : DbOperations.OperationsEnum.EOF
                          , 'time' : Date.now()  } );

        return rOperations;
    };

    tree.assignDIds_beforeDiffSerialize = function() {
        forEachNodeInTree_noChangesInTree(this, function(node) {
            if(node.dId)  return; // IMPORTANT!!! Continue only if there is no dId and it's must set a new
            // Мы не имеем права делать никаких изменений в sDid или cDid без того чтоб dId не скинуть! Поэтому с ними любые манипуляции
            // возможны тока если dId тока что назначен!

            node.dId = tree.currentSession_rootNode.getNextDid_andAdvance();

            if(!node.cdId) node.cdId = tree.currentSession_rootNode.getNextDid_andAdvance();

            // TODO похоже вообще назначение node.sdId и все манипуляции с ней надо именно в serializeForDiff() делать
            // и две проверки ниже с ней оперирующие кстате тоже
            // так как к примеру serializeForDiff() может сбрасывать sdid вообще, если diff слишком большой выходит
            // (НЕ МОЖЕТ!!! Должна сменить dId при этом, а значит did и у всех парентов)
            // Также очевидно что назначать sdId можно тока после того как назначены уже все dId для сабнод
            // Иначе мы получаем ситуацию (между этим местом и окончанием всего прохода по нодам) что sdId назначен а закодировать то sdIdKnot нельзя так как
            // не все субноды ещё имеют dId. Что не проблема, покачто.... хотя и была ей когда мы тут пытались кодировать sdIdKnot
            //
            // WARNING // Вот тока я не имею права назначать новый sdId ноде с уже высланным и существующим dId !!!!
            // Значит таки нельзя это делать нигде кроме как тут, в  if(!node.dId)  {} блоке
            if(!node.sdId && node.subnodes.length > 0) { // Only assign new sdId if there is subnodes
                node.sdId = node.dId; // TODO  node.sdId == node.dId позже является флагом в serializeForDiff для кодирования сабнод прямо в knot, неявно и не красиво так эту инфу передавать помойму
                node.sdIdKnot = null;
                // Хочется сделать так:
                // node.sdIdKnot = node.serializeNodeStructureAndSubnodesChanges_forDiff();
                // Но мы не можем этого сделать ещё, так как все наши subnodes ещё сейчас не имеют назначенных did!
                // Тоесть мы это будем делать в serializeForDiff()
            }
            // Оптимизация чтоб не юзать механизм дифов для слишком короткого списка сабнод
            if(node.sdId/*уже была назначено когдато*/ && node.subnodes.length > 0 && node.subnodes.length <= 1) {
                node.sdId = node.dId; // Не надо нам через ссылку если мало сабнод (одна), кодируем её прямо в knot в этом слкчае
                node.sdIdKnot = null;
                // TODO помойму этот код-проверку лучше в serializeForDiff делать.
                // Более того, если мы уж хотим скинуть sdId - надо и dId скинуть, хотя сюда мы влетаем ТОКА если он скинут и тока что получил новое значение
            }
            if(node.sdId && node.subnodes.length == 0) { // Это возможно, если sdId был востановлен когда у узла ещё были подузлы, их удаление не скидывает sdId, тока dId, так как sdId это указатель на базу от которой диф считать, его и не надо скидывать при смене субнод
                node.sdId = 0; // Чтоб вообще не сериализировался. Кстате если это таки произойдёт то будет бага (уже не будет, закрыл проверкой на subnodes.length в serializeNodeStructureAndSubnodesChanges_forDiff, но раньше была)
                node.sdIdKnot = null;
                // TODO опять таки, !node.sdId является флагом для serializeForDiff() не кодировать сабноды в knot - что не явно и не красиво
                // Более того, если мы уж хотим скинуть sdId - надо и dId скинуть, хотя сюда мы влетаем ТОКА если он скинут и тока что получил новое значение
            }

            //TODO тут вобщето должен быть такой код:
            //node.assignDidsToChangedNodeContentItems(didsGenerator) который будет перегружен дополнительно разными типами нод для присвоения своим изменённым полям dId
        }); // forEachNodeInTree(this, function(node) {
    };

    tree.renumerateDidsOnCollision  = function(startingDId, newDidForStartingDId, maxFoundDid ) {

        var d = newDidForStartingDId - startingDId;

        this.currentSession_rootNode.advanceNextDidToValue(maxFoundDid + d + 1);

        forEachNodeInTree_noChangesInTree(this, function(node) {
            if(node.dId  >= startingDId) node.dId  += d;
            if(node.cdId >= startingDId) node.cdId += d;
            if(node.sdId >= startingDId) {
                node.sdId = node.dId;
                node.sdIdKnot = null;
                // Как вариант можно бы было парсать вот это: cdid@did&did&did и прогонять через наш алгоритм сдвига did тех кто попадает в range. Но ну его нафиг.
            }


            // sdid указывает с какого узла мы берём base subnodes array (for subnodes difference), если sdid ноды равен did ноды то ни с какого не берём, а копируем как есть
            //
            // sdidKnot это копия base узла на который указывает sdid (он когдато имел такой did). Потому как его может в дереве уже не быть.
            // Точнее даже точно нет если sdid < did. Бо это наша старая версия текущего узла.
            // sdidKnot хранится в таком виде: cdid@did&did&did, его cdid мы вроде никогда не достаём из него и не юзаем (и он скорее всего равен текущему cdid).

        });
    };

    tree.serializeTheDifference = function(startingDId) {
        // startingDId по идеи мы всёже должны получить из persistence manager, так как дерево не очень то и в курсе кто и где там его писал
        // куда и когда, икакие дифы есть а какие нет.
        var differenceAccumulator = {};

        this.assignDIds_beforeDiffSerialize();

        // This will fill:
        // differenceAccumulator['k'] - nodes knots
        // differenceAccumulator['c'] - content of nodes
        // console.log("###################### startingDId:",startingDId);
        forEachNodeInTree_noChangesInTree(this, function(node) {
            // console.log("NODE:",i2s36(node.dId), node.serializeNodeSubnodesList_forDiff());
            if(node.dId >= startingDId) node.serializeForDiff(startingDId, differenceAccumulator);
        });

        // differenceAccumulator['b'] = startingDId;
        // differenceAccumulator['e'] = this.currentSession_rootNode.getNextDid_withoutAdvance();
        differenceAccumulator['r'] = i2s36(this.currentSession_rootNode.dId);

        return differenceAccumulator
    };

    // -----------------------------------------------------------------------------------------------------------------
    const NEW_WINDOW_AND_TO_POPUP_MARGIN = 5;

    tree.initialNewWindowPosition = {
        left: 1 + 400/* TO default width */ + NEW_WINDOW_AND_TO_POPUP_MARGIN/* a margin between TO popup and New Chrome Window */,             // Zero is not work for unknown reasons
        top: 1,                        // Zero is not work for unknown reasons
        width: 800,//((window.screen.availWidth >> 1) < 1000)?(window.screen.availWidth >> 1):1000 // Для тех у кого 2 монитора // Делить нельзя!!! получим xxx.5 и потом non integer error на windows.create()
        height: 700,
    };
    tree.newWindowPositionDisplacement = {
        left:0,
        top:0
    };
    tree.nextWinDisplacement = {'x':34, 'y':34};

    tree.calculateAndMoveNextWindowPosition = function(tabsOutliner_chromeWindowObj) {

        var current_initialNewWindowPosition_left = (tabsOutliner_chromeWindowObj.left + tabsOutliner_chromeWindowObj.width) + NEW_WINDOW_AND_TO_POPUP_MARGIN/*слишком в притык не красиво*/;

        // Если мы переместили таб аутлайнер всё должно сброситься и окна должны начать появляться по новой, с боку от него и с верху
        if(this.initialNewWindowPosition.left != current_initialNewWindowPosition_left)
        {
            this.initialNewWindowPosition.left = current_initialNewWindowPosition_left;
            this.newWindowPositionDisplacement.top = this.newWindowPositionDisplacement.left = 0;
        }

        var r  =  { left:this.initialNewWindowPosition.left + this.newWindowPositionDisplacement.left
                  , top:this.initialNewWindowPosition.top + this.newWindowPositionDisplacement.top
                  , width:this.initialNewWindowPosition.width
                  , height:this.initialNewWindowPosition.height
                  };

        this.updateDisplacementForNextWindow(current_initialNewWindowPosition_left);

        return r;
    };

    tree.updateDisplacementForNextWindow = function() {
        this.newWindowPositionDisplacement.left +=  this.nextWinDisplacement.x;
        this.newWindowPositionDisplacement.top  +=  this.nextWinDisplacement.y;

        getDisplayWorkAreaBounds( (primaryDisplayWorkArea) => {
            // Сбрасываем дисплейсмент если новое окно начинает появляться в последней трети экрана
            if( (this.initialNewWindowPosition.top  + this.newWindowPositionDisplacement.top)  > (primaryDisplayWorkArea.height - 300) )
                this.newWindowPositionDisplacement.top = 0;

            if( (this.initialNewWindowPosition.left + this.newWindowPositionDisplacement.left) > (primaryDisplayWorkArea.width  - 300) )
                this.newWindowPositionDisplacement.left = 0;
        });
    };
    // -----------------------------------------------------------------------------------------------------------------
    tree.requestNewAlifeTabForNode = function(tabsOrganizer, waitedTabNode) {
        var _this_activetree = this;

        var createProperties =  { windowId : tabsOrganizer.chromeWindowObj.id
                                , index    : 999
                                , url      : waitedTabNode.getHref()
                                , active   : waitedTabNode.chromeTabObj.active
                                , pinned   : waitedTabNode.chromeTabObj.pinned
                                };
        // нужно пощитать правильно индекс чтоб минимизировать moves последующие
        // С учотом того что возможно мы не единственные кто в этом проходе среда попросимся на создание. но точно что все будут проситься в порядке следования в дереве
        // Вобщето 999 это как раз идеально для случая востановления saved окна, move потом не происходят
        // Но даже если там поставить 0 - чтоб все табы мовались в результате после создания, это происходит настолько быстро что заметить можно только по логам
        //createProperties.index = tabsOrganizer.guesIndex // Так что можно забить и не парится

        preventScrollToViewInNextOnFocusChangeForWinId(createProperties.windowId);
        chrome.tabs.create(createProperties, function restoreSavedTabCreationDone(newTab_chromeTabObj) {
                // Этот калбек вызывается скорее всего уже после того как прийдёт NewTab
                _this_activetree.replaceTabInWindowByNewlyCreatedRequestedTab_orAttachWaitTab(tabsOrganizer, waitedTabNode, newTab_chromeTabObj);

                tabsOrganizer._f_isWhantRequestTabsMove = true; // Реордеринг произведём чтоб всё было как надо, но хорошо бы его минимизировать
                _this_activetree.executeWaitedChromeOperations([tabsOrganizer]);
        } );
    };

    tree.requestNewAlifeWindowForNode = function(waitedWindowNode) {
        var _this_activetree = this;
        // Плохая идея откладывать  creationWaitTab.isWhantRequestNewTabCreation = false; в асинхронный вызов!!! Хотя в данном конкретном случае ничего плохого не случится
        // так как когда мы будем обрабатывать табы табОрганайзер ещё не будет живым. Но вообще это баг.
        // Надо уже сразу снять этот флаг, не откладывая в асинхронный вызов

        var creationWaitTab = waitedWindowNode.findTabWithActiveRequestForCreation();
        if(creationWaitTab) // Если в иерархии присутствует WaitedSavedTab воспользуемся его урлом чтоб создать новое окно (иначе будем создавать с пустым табом), и снимем этот статус с него - мы его заменим в калбеке окна
            creationWaitTab._f_isWhantRequestNewTabCreation = false;

        var moveWaitTab = null;
        // TODO Алгоритм подхвата для нового окна таба который мы мувнуть собираемся. Приводит к тому что при либерейте на корень табы переставляются местами почемуто
        // и это флатает иерархию - временно отключено
        // if(!creationWaitTab)
        //    moveWaitTab = waitedWindowNode.findTabWithActiveRequestForMove();

        // После создания нового окна обычно надо вернуть фокус в то окно из которого это попросили.
        // chrome.windows.getCurrent возвращает последнее зафокусенное окно, но скипает 'panel' & 'popup' окна! Тоесть наше окно, из которого мы кликнули, оно не вернёт!
        chrome.windows.getLastFocused( {'populate':false}, function(ourTabsoutlinerWindow_chromeWindowObj) {
            // Возможно стоит заюзать chrome.windows.getCurrent() для определения новой позиции для открываемого окна
            // этот метод возвращает последнее НОРМАЛЬНОЕ окно которое было в фокусе - он скипает понели и popup окна
            // можно юзать вобщето если мы НЕ планируем работать в обычном окне.
            // А вообще помойму оптимально когда окна на середине экрана появляются.

            // Определяем позицию и размер для нового окна
            var newWinCoordinates = _this_activetree.calculateAndMoveNextWindowPosition(ourTabsoutlinerWindow_chromeWindowObj);
            var createProperties = { 'type'    : 'normal'
                                   , 'left'    : newWinCoordinates.left
                                   , 'top'     : newWinCoordinates.top
                                   , 'width'   : newWinCoordinates.width
                                   , 'height'  : newWinCoordinates.height
                                   , 'focused' : false // отлично помогает от того чтоб не приходил onFocusChanged и в результате не происходил скролинг к востановленному окну
                                                       // Вот тока следующий востанавливающийся таб к этому таки приведёт если не придпринять меры - ибо селектает окно
                                   };

            if(true/*FASTFORWARDv3 localStorage['openSavedWindowsInOriginalPos']*/) waitedWindowNode.fillCreatePropertiesByPositionAndSize(createProperties);

            // Если в иерархии присутствует WaitedSavedTab воспользуемся его урлом чтоб создать новое окно (иначе будем создавать с пустым табом), и снимем этот статус с него - мы его заменим сдесь
            if(creationWaitTab) createProperties.url = creationWaitTab.getHref();

            // if creationWaitTab exist then moveWaitTab is null
            if(moveWaitTab) createProperties.tabId = moveWaitTab.chromeTabObj.id;

            chrome.system.display.getInfo((displays) => {
                const display = displays[0]; //TOFIX Assuming single dispalay
                
                checkAndFixBounds(createProperties, display.workArea); // To prevent chrome.windows.create fail with "Invalid value for bounds. Bounds must be at least 50% within visible screen space." error

                // console.log("##### createProperties",createProperties);
                chrome.windows.create(createProperties, restoreSavedWinCreationDone);
            });

            function checkAndFixBounds(createProperties, visibleArea) {
                // Кароче есть требование чтоб площадь окна была как минимум на 50% видна
                // если взять пополам высоту и ширину то половина того и того это будет всего 25%, а не 50%, в худшем случае
                // а вот 0.75 x 0.75 всегда будет больше 56%
                //
                // А вообще хром всеравно не дает создать окно задвинутое хоть немного за край visibleArea, 
                // chrome.windows.create сдвигает и обрезает (если за правый кран экрана было задвинуто, и возможно еще иногда)
                // Но если передать неправильные размеры то вообще не создаст а вывалит еррор
                let minVisibleWidth = createProperties.width * 0.75;
                let minVisibleHeight = createProperties.height * 0.75;

                let visibleAreaBoundX = visibleArea.left + visibleArea.width;
                let visibleAreaBoundY = visibleArea.top + visibleArea.height;


                if(createProperties.left + minVisibleWidth > visibleAreaBoundX)
                    createProperties.left = visibleAreaBoundX - minVisibleWidth;

                if(createProperties.top + minVisibleHeight > visibleAreaBoundY)
                    createProperties.top = visibleAreaBoundY - minVisibleWidth;
              
                if(createProperties.left < visibleArea.left) {
                    createProperties.width -= (visibleArea.left - createProperties.left);
                    createProperties.left = visibleArea.left;
                }

                if(createProperties.top < visibleArea.top) {
                    createProperties.height -= (visibleArea.top - createProperties.top);
                    createProperties.top = visibleArea.top;
                }       
                
                function numberToInteger (num) {
                    if(!num /*NAN, undefined, 0*/) return 0;
    
                    return Math.floor(num);
                }

                // Fix for exception Error handling response: TypeError: Error in invocation of windows.create(optional object createData, optional function callback): Error at parameter 'createData': Error at property 'left': Invalid type: expected integer, found number.
                // После чого saved окно не открывалось
                createProperties.height = numberToInteger(createProperties.height);
                createProperties.width = numberToInteger(createProperties.width);
                createProperties.top = numberToInteger(createProperties.top);
                createProperties.left = numberToInteger(createProperties.left);
            }

            function restoreSavedWinCreationDone(newWindow_chromeWindowObj) {
                if(chrome.runtime.lastError) {
                    // If lastError present then Most likely this is:
                    // "Invalid value for bounds. Bounds must be at least 50% within visible screen space."
                    console.error("Error chrome.windows.create", chrome.runtime.lastError, createProperties);
                }

                // Этот калбек вызывался в manifest v2 уже после того как прийдёт NewWindow & NewTab
                // в manifest v3 уже перед !!! 
                // Поэтому мы тут создадим Окно и Таб в своем дереве, а NewWindow & NewTab калбеки проигнорим если эти обекты уже в дереве
                // так нам будет без разницы порядок вызова всех этих асинхронных методов, мы его не знаем на самом деле

                _this_activetree.fromChrome_onWindowCreated(newWindow_chromeWindowObj);
                newWindow_chromeWindowObj.tabs.forEach( (chromeTabObj) => _this_activetree.fromChrome_onTabCreated(chromeTabObj) ); //there must be only one tab, but to be safe

                var newlyCreated_chromeTabObj =  newWindow_chromeWindowObj.tabs[0];

                // найдём ноду окна с нашим chromeWindowObj.id которая уже должна быть создана в дереве
                var nodeWithOurAlifeWindow = _this_activetree.findActiveWindow(newWindow_chromeWindowObj.id);
                if(!nodeWithOurAlifeWindow){
                    console.error("ERROR requestNewWindowForWaitedWindowNode done callback cannot find related chromeWindowObj in tree");
                    return;
                }

                var newWinNode = waitedWindowNode.replaceSelfInTreeBy_mergeSubnodesAndMarks( nodeWithOurAlifeWindow );
                // вот тут мы смержались с окном которое имело таб. а куда он делся то вообще?
                // его переставит replaceNodeByNewlyCreatedRequestedNode_orAttachWaitNode в ожидающий узел
                // или же если это EmptyTab от таки останется висеть в дереве и ждать пока прийдёт нода чтоб его убрать
                // в результате deleteEmptyTabAfterAnyMoveTabOrCreateTabSucceded = true
                if(creationWaitTab/*при заказе окна мы воспользовальсь урлом того таба что это инициировал*/)
                {
                    // эвент о новом табе приходит раньше чем этот калбек отрабатывает и таким образом соответствующая нода уже в дере присутствует,
                    // но если нет, то этот метод это тоже сможет обработать вставив AttachWaitTab с ожидаемым id
                    _this_activetree.replaceTabInWindowByNewlyCreatedRequestedTab_orAttachWaitTab(newWinNode, creationWaitTab, newlyCreated_chromeTabObj);
                }
                else if(moveWaitTab/*при заказе окна мы воспользовальсь id таба которые на очереди чтоб его в это окно мувнули*/)
                {
                    // Ничего делать не надо
                    // Вот так это происходит по Chrome эвентам
                    // Tab onDetached tabid:426; detached from windowid:425 Object {oldPosition: 0, oldWindowId: 425} background.js:1104
                    // Window onCreated winid:503
                    // Object {alwaysOnTop: false, focused: false, height: 1136, id: 503, incognito: false…}
                    // background.js:1110
                    // Tab onAttached tabid:426; attached to windowid:503 Object {newPosition: 0, newWindowId: 503} background.js:1103
                    // This Crome Initiated Dettach-Attach between different windows
                    // После чего вызывается наш алгоритм переатача табов, который просто не находит уже того таба в субнодах окна которое использовалось для его создания
                    // А даже еслиб и нашол то мувнул бы - пофиг.
                }
                else if(waitedWindowNode._f_isWindowScheduledToActivationWithoutAnyTabs)
                {
                    // Этот кейс наступает при дабл клике на SavedWin у которого нет табов
                    // В этом случае не надо прятать временный таб который создался при создании нового окна, так как его некем заменить
                    // И не надо заказывать его удаление
                }
                else /* Мы заказали окно с пустым временным! табом */
                {
                    // Этот кейс наступает при дабл клике на SavedWin с SavedТабами
                    // или (и более интересно) при move ActiveTab на корень или в SavedWin без ActiveWin по пути к корню,
                    // В этом случае возникает временный таб который будет почти сразу удалён, чтоб он не мигал мы его превентивно прячем уже
                    // а также заказываем тут его удаление как только окно получит какието ещё живые табы (сразу удалить не можем бо наверно что окно закроется)

                    var newlyCreatedEmptyTabNode = newWinNode.findAlifeTabInOwnTabsById(newlyCreated_chromeTabObj.id);
                    // Нода соответствующая пустому табу в дереве,
                    // если это результат move ActiveTab на корень или в SavedWin он будет через секунду удалён, поэтому не стоит его вообще светить - выкинем его из дерева
                    if(newlyCreatedEmptyTabNode.subnodes.length === 0 /*sanity check*/) newlyCreatedEmptyTabNode.removeOwnTreeFromParent();
                    newlyCreatedEmptyTabNode.supressUnexpectedIdErrorOnChromeRemovedEvent(); // Чтоб onTabUpdate & onTabRemoved не ругались и не пересканивали дерево

                    // Закажем его удаление как только инстанцируются заказанные сейвед табы или произойдёт move операция
                    newWinNode.deleteEmptyTabIdAfterAnyMoveTabOrCreateTabSucceded = newlyCreated_chromeTabObj.id; // Если создавали по инициативе saved таба то нет смысла удалять пустой таб (это и мог быть пустой таб!!!)
                }

                nodeWithOurAlifeWindow._f_isWhantRequestTabsMove = true; // В резудьтате все табы что ожидают move из других окон смогут выполнить эту операцию //TODO хотя логичней бы это прямо в дереве проверять, ища табы не принадлежащие окну или с неправильными индексами и найдя инициировать move
                _this_activetree.executeWaitedChromeOperations([nodeWithOurAlifeWindow]);

                // switch focus back to tabs outliner window
                chrome.windows.update(ourTabsoutlinerWindow_chromeWindowObj.id, {'focused':true}); // We cannot use there our focusWindow(, true)
                                                                                                            // This will overvrite winIdForWhichNeedSkipScrollToView by tabsOutliner id,
                                                                                                            // as result there was a scroll when restoredWindow obtain focus on next new Restored Tab
                                                                                                            // tabsOutliner window was anyway skiped from scroling during onFocusChange
            }
        });
    };

    tree.findActiveWindowIdForTabId = function(tabId) {
        var activeTab = this.findActiveTab(tabId);
        var tabsOrganizer = activeTab && activeTab.findFirstSavedOrOpenTabsOrganizerInPathToRoot(tabId-1 /*тут нужно windowId чтоб popup окно посчитало себя органайзером, мы его не знаем, типа угадываем его так*/);
        return tabsOrganizer && tabsOrganizer.chromeWindowObj && tabsOrganizer.chromeWindowObj.id;
    };

    tree.createNodeNote = function(text) {
        return new NodeNote({'note': text == undefined ? "#" : text})
    };

    tree.createNodeSeparator = function() {
        return new NodeSeparatorLine();
    };

    tree.createNodeGroup = function() {
        return new NodeGroup();
    };

    // TODO replace as tree.actionLinkModelBaseFabric( type ) { switch(type) { ...} }
    tree.gdoc_       = function(){ return new ActionLinkModelBase(function() { return new NodeTabSaved({'url':"https://docs.google.com/document/create", 'title':'Untitled document'}) }, function(node, port) { node.setCustomColor('#4986E7', '#3460AA'); node.onNodeDblClicked(tree, port) }) };
    tree.note_       = function(){ return new ActionLinkModelBase(function() { return new NodeNote()                                                                             }, function(node, port) { node.onNodeDblClicked(tree, port) }) };
    tree.openwin_    = function(){ return new ActionLinkModelBase(function() { return new NodeWindowSaved()                                                                      }, function(node, port) { node.onNodeDblClicked(tree, port) }) };
    tree.savedwin_   = function(){ return new ActionLinkModelBase(function() { return new NodeWindowSaved()                                                                      }, function(node, port, data) { if(data) node.setCustomTitle(data.title) }) };
    tree.group_      = function(){ return new ActionLinkModelBase(function() { return new NodeGroup()                                                                            }, function(node, port, data) { if(data) node.setCustomTitle(data.title) }) };
    tree.separator_  = function(){ return new ActionLinkModelBase(function() { return new NodeSeparatorLine()                                                                    }, function(node, port, data) { if(data) node.setSeparatorStyleFromText(data.title) }) };

    tree.link_       = function(){ return new ActionLinkModelBase(function(data) { return new NodeTabSaved( {'url' :data.url, 'title':data.title} ) }) };
    tree.textline_   = function(){ return new ActionLinkModelBase(function(data) { return new NodeNote(     {'note':data.title                  } ) }) };
    // All additions to this ..., link_, textline_, .... must be added to externs-common.js

    //------------------------------------------------------------------------------------------------------------------
    // Новые методы модификации дерева - через самодостаточные immutable операции (все данные сериализируются, никаких ссылок на непонятно что)
    //tree.setSelectedTabInWindow
    //tree.setFocusedWindow
    //tree.onWindowRemovedByChrome

    // Operations ------------------------------------------------------------------------------------------------------
    // Тут методы которые на вход получают параметры которые можно/нужно засериализировать как есть и потом их возможно
    // проиграть в тойже последовательности чтоб получить дерево опять. Тоесть параметры не содержат никаких ссылок
    // на что либо что проблематично сериализируется или требует рантайм стейта
    // -----------------------------------------------------------------------------------------------------------------
    //    tree.updateZombiTab = function(lastKnownActiveTabId, newChromeTabObj, windowId) {
    //        var tabNodeToReplace = this.findActiveTab( lastKnownActiveTabId );
    //        if(!tabNodeToReplace) {
    //            console.error("ERROR !! NOT UZT", windowId); //   Log to server, но вообще это абсолютно невозможно
    //            return;
    //        }
    //
    //        tabNodeToReplace.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabActive(newChromeTabObj) );
    //    };

    tree.onTabIdReplaced = function(lastKnownActiveTabId, newTabId) {
        var tabNodeToReplace = this.findActiveTab( lastKnownActiveTabId );
        if(!tabNodeToReplace) {
            console.error("ERROR !! NOT UZT"); // TODO  Log to server
            return null;
        }

        var newChromeTabObj = tabNodeToReplace.chromeTabObj;
        newChromeTabObj['id'] = newTabId;
        return tabNodeToReplace.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabActive(newChromeTabObj) );
    };

    tree.replaceTabInWindowByNewlyCreatedRequestedTab_orAttachWaitTab = function(windowNode, nodeToReplace, newlyCreated_chromeTabObj) {
        var newlyCreatedTabNode = windowNode.findAlifeTabInOwnTabsById(newlyCreated_chromeTabObj.id);

        if(newlyCreatedTabNode) {
            // Если New Tab эвент уже произошол (это всегда так и есть) то новая нода уже в дереве, её надо просто переставить куда надо.
            nodeToReplace.replaceSelfInTreeBy_mergeSubnodesAndMarks( newlyCreatedTabNode );
        } else { // Врядли будет когда выполнятся, но пусть будет
            // Если ещё нет - то подготовимся к его приходу.
            nodeToReplace.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabActive(newlyCreated_chromeTabObj) ); // Подготавливаемся к идущему СЛЕДОМ newTab эвенту - но он может и не следом идти
        }
    };

    tree.onActiveTabRemoved = function(tabId, isWindowClosingInfo, doNotReportNoIdError) {
        var tabNode = this.findActiveTab(tabId);
        if(!tabNode){
            if(!doNotReportNoIdError && isRemovedTabIdUnexpected(tabId))
                console.error("Error - removeTabNodeFromTree called with unexisted in tree tabid:", tabId);
            return;
        }

        var closedWindowNode;
        if(isWindowClosingInfo/*CAN BE UNDEFINED*/ && isWindowClosingInfo['isWindowClosing']) {
            // TODO - есть такая CHROME ошибка что isWindowClosingInfo может быть undefined, редко но это возможно,
            // в этом случае надо всётаки прибивать окно если оно больше не имеет других табов
            // или у нас будут оставаться фантомные пустые узлы-окошки
            // See the treeModel.findActiveWindowIdForTabId(tabId); о том как найти окно.

            closedWindowNode = this.findActiveWindow(isWindowClosingInfo['windowId']);
            if(!closedWindowNode){
                if(!doNotReportNoIdError && isRemovedWindowIdUnexpected(isWindowClosingInfo['windowId']))
                    console.error("Error - removeTabNodeFromTree called with unexisted in tree windowId during windowClose:", isWindowClosingInfo['windowId']);
            }
        }

        tabNode.onAlifeTabClosedByChrome_removeSelfAndPromoteSubnodesInPlace_orConvertToSavedIfMarksOrTextNodesPresent(closedWindowNode);
    };

    tree.onActiveWindowRemoved = function(windowId, doNotReportNoIdError) {
        var winNode = this.findActiveWindow(windowId);
        if(!winNode) {
            if(!doNotReportNoIdError && isRemovedWindowIdUnexpected(windowId))
                console.error("Error - obtain fromChrome_onWindowRemoved for unexisted in tree winid:", windowId);
            return;
        }

        winNode.onAlifeWindowClosedByChrome_removeSelfAndPromoteSubnodesInPlace_orConvertToSavedIfMarksOrTextNodesPresent();
    };

    tree.fromChrome_onTabCreated = function(chromeTabObj) {
        var nodeModelForAffectedWindow = this.findActiveWindow(chromeTabObj.windowId);
        // Ситуации когда таб создан, а окна для него в дереве ещё нет быть не должно!!!
        // Раньше такая бага была - создание модели для окна было отложено в асинхронный метод после получение эвента об этом
        if(!nodeModelForAffectedWindow) console.error("ERROR############# onTabCreated # Cannot find window in tree with windowId: "+ chromeTabObj.windowId, chromeTabObj);

        if(nodeModelForAffectedWindow.findAlifeTabInOwnTabsById(chromeTabObj.id)) return; // Already created, most likely in restoreSavedWinCreationDone, see places where fromChrome_onTabCreated called

        return nodeModelForAffectedWindow.fromChrome_onTabCreated(chromeTabObj, true/*FASTFORWARDv3 !!localStorage['relateNewTabToOpener']*/);
    };

    tree.fromChrome_onWindowCreated = function(chromeWindowObj) {
        if(this.findActiveWindow(chromeWindowObj.id)) return; // Already created, most likely in restoreSavedWinCreationDone, see places where fromChrome_onWindowCreated called

        // if(chromeWindowObj.tabs && chromeWindowObj.tabs.length > 0)
        //    console.error("new NodeWindowActive called with chromeWindowObj with tabs, we are no create there tabs anymore when instantiating Window node", chromeWindowObj);

        this[0/*ActiveSession*/].insertAsLastSubnode( new NodeWindowActive(chromeWindowObj) );

        // Сдесь когдато была очень неприятная ошибка
        // мы должны тут сразу создавать модель для окна, не откладывая ни на какие асинхронные запросы и вызовы.
        // К примеру тут был код который запрашивал табы и только потом создавал окно.
        // Так мы пропускали добавление табов в это окно методом fromChrome_onTabCreated (чтоб он коректносработал
        // нужно чтоб окно уже было в дереве), которые могут произойти до того как сработает наш асинхронный запрос
        // это редко но бывает - к примеру всегда было с background окном и табом
        // Пример бажного кода:
        //        var _this = this;
        //        chrome.tabs.getAllInWindow(chromeWindowObj.id, function(tabs) {
        //            console.log('Adding tabs');
        //            chromeWindowObj.tabs = tabs; // Обычно 1 таб уже есть в наличии НО ! НЕ ВСЕГДА, и если его небыло то мы вообще не вызывались
        //            var newNodeModelForWindow = extentToNodeModel( createWindowModelData(chromeWindowObj) );
        //            _this[0/*ActiveSession*/].insertAsLastSubnode(newNodeModelForWindow);
        //        });

    };


    return tree;
}

var NodeModelBase = Class.extend({
    init:function(type, titleBackgroundCssClass){
        var nowTime = Date.now();

        this.idMVC = 'idmvc'+nextIdForBackgroudViewCommunication++;
        this.previousIdMVC; // Во время перемезения поддеревьев драг и дропом генерится у копии новый idMVC, мы юзаем старый чтоб переставить курсор коректно при апдейте дерева в View

        this.resetStructureDids();
        // resetStructureDids:function() {
        //      this.dId = 0; //node difference ID (actualy a node structure)
        //      this.cdId = 0; //node content difference ID
        //      this.sdId = 0; //node subnodes difference ID
        //      this.sdIdKnot = null; //сериализированный knot c did == sdId, который используется как база для наложения subnodes changes
        // }

        this.titleCssClass = type;
        this.titleBackgroundCssClass = !!titleBackgroundCssClass ? titleBackgroundCssClass : "defaultFrame";

        this.type = type;
        this.colapsed = false;
        this.marks = {
            relicons:[]  // marks+relicons это иммутабле обект - менять только вместе! нигде не должны меняться relicons без смены marks обекта
        };

        this.created = nowTime;
        this.lastmod = nowTime;

        this.parent = null;
        this.subnodes = [];

        // Possible callback methods in observers ("this" will point to the node model):
        // collapsingChanged()
        // itemDeletedFromSubnodes(deletedNode, formerDeletedNodeIndex)
        //this.observers = [];

        this.isLink = false;

        this.isProtectedFromGoneOnCloseCache = false; // Это поле не сериализируется, оно расчитывается по субнодам и по marks при вставке ноды в дерево

        this.hoveringMenuActions = {};
        this.hoveringMenuActions[hoveringMenuDeleteAction.id] = hoveringMenuDeleteAction; // У всех нод по дефолту есть deleteAction, кому не надо - удалят
        this.hoveringMenuActions[hoveringMenuSetCursorAction.id] = hoveringMenuSetCursorAction; // У всех нод она есть, но не всегда рисуется, немного это оверкил конечно

    },

    isSubnodesPresent:function() {
        return this.subnodes.length > 0;
    },

    updateSubnodesInfoForViewAfterChangesInSubnodes:function(parentUpdateData) {
        // Делаем ничего, этот метод предназначен для NodeModelMVCDataTransferObject
        // чтоб там копии о сабнодах проапдейтить после treeDelete или insertSubnode
    },

    resetStructureDids:function() {
        this.dId = 0; //node difference ID (actualy a node structure)
        this.cdId = 0; //node content difference ID
        this.sdId = 0; //node subnodes difference ID
        this.sdIdKnot = null; //сериализированный knot c did == sdId, который используется как база для наложения subnodes changes
    },

    isAnOpenTab:function() {
        return false;
    },

    isAnOpenWindow:function() {
        return false;
    },

    isSavedOrOpenTabsOrganizer:function(forTabsInChromeWindowId) {
        return false;
    },

    getHoveringMenuActions:function() {
        var r = this.hoveringMenuActions;

        if(this.colapsed && !this.hoveringMenuActions[hoveringMenuCloseAction.id]){
            var stat = this.countSubnodesStatsBlockData();//return {'nodesCount':x, 'activeWinsCount':y, 'activeTabsCount':z});
            if(stat['activeTabsCount'] > 0) {
                r = oneLevelObjectClone(this.hoveringMenuActions);
                r[hoveringMenuCloseAction.id] = hoveringMenuCloseAction;
            }
        }

        return r;
    },

    notifyTreeModelAboutUpdate_invalidateDids:function(isNodeContentUpdated_falseIfOnlyTheStructure) {
        var treeModel = this.getTreeModelFromRoot_invalidateDids(isNodeContentUpdated_falseIfOnlyTheStructure);
        if(treeModel) treeModel.hierarchyUpdated();

        return treeModel;
    },

    // notifyObserversDeffered:function(/*callbackName, callbackArguments...*/) {
    //     var _arguments = arguments;
    //     var _this = this;
    //
    //     setTimeout( function() { // setTimeout() фиксает баг с миганием белым областей перерисовки (обычно full window) в TabsOutliner окне когда Chrome очень загружен (при добавлении новых нод обычно было)
    //         _this._notifyObservers(_arguments);
    //     }, 200 );
    // },


    notifyObservers:function(/*Array - [callbackName, callbackArguments...]*/) {
        var treeModel = this.getTreeModelFromRoot();
        if(!treeModel) return; //We are not connected to the tree

        treeModel.viewsCommunicationInterface.notifyObserversInViews(this.idMVC, arguments);
    },

    notifyObservers_alsoUpdateCollapsedParents:function(/*Array - [callbackName, callbackArguments...]*/) {
        var treeModel = this.getTreeModelFromRoot();
        if(!treeModel) return; //We are not connected to the tree

        treeModel.viewsCommunicationInterface.notifyObserversInViews_alsoUpdateCollapsedParents(this.idMVC, arguments, this.calculateParentsUpdatesData());
    },


    notifyObservers_onNodeUpdated :function() {
        var treeModel = this.getTreeModelFromRoot();
        if(!treeModel) return; //We are not connected to the tree

        treeModel.viewsCommunicationInterface.notifyObserversInViews_onNodeUpdated(this.idMVC, new NodeModelMVCDataTransferObject(this));
    },


    notifyAllCollapsedInPathToRoot:function(observerName) {
        // Раньше нотифицировали только первую ноду на пути к руту, но проблема в том что субноды у неё тоже могли быть свёрнуты и при этом для них хранится закешированный
        // и апдейтищийся при изменениях DOM! Не подключенный к экрану.
        // Короче была бага - кидали свёрнутую ноду с глубоким деревом (больше одного уровня) на другую свёрнутую ноду - раскрывали её и видели что стат блок для кинутой ноды показывает только
        // количество субнод первого уровня

        for(var testednode = this.parent; testednode; testednode = testednode.parent)
            if( testednode.colapsed ) testednode.notifyObservers(observerName);
    },

    // deleteDeadObservers:function( currentlyClosedDocument ) {
    //     this.observers = this.observers.filter( function(observer) {
    //         if( !observer.ownerDocument || !observer.ownerDocument.defaultView || observer.ownerDocument == currentlyClosedDocument )
    //             return false; //Exclude
    //         else
    //             return true; //Include
    //     });
    // },

    requestScrollNodeToViewInAutoscrolledViews:function(viewsCommunicationInterface) {
        var nodeToScroll = this.getFirstCollapsedNodeInPathFromRootOrThisIfNotHiden();

        viewsCommunicationInterface.viewRequestScrollNodeToViewInAutoscrolledViews(nodeToScroll.idMVC);

        // nodeToScroll.notifyObservers("fromModel_requestScrollNodeToViewInAutoscrolledViews");
    },

    setCollapsing:function(newCollapsingState) {
        if(newCollapsingState === this.colapsed) return; // Do nothing if nothing changed
        if(this.subnodes.length == 0) newCollapsingState = false; // Если нет подузлов сворачивать не дадим


        this.colapsed = newCollapsingState;

        // Will notify observers Immedeately - because this operation actualy originate from view and wait for model event
        // to start collapsing/expand animation
        // In case we deffer this event animmation often start in a second after click or even longer!!!
        this.notifyObservers("fromModel_onSubnodesCollapsingStatusChanged", new NodeModelMVCDataTransferObject(this));
        var treeModel = this.notifyTreeModelAboutUpdate_invalidateDids(true/*isContentChange, false if only the structure*/); //"setCollapsing"
    },

    getCustomTitle:function() {
        return null; //return this.marks.customTitle; // It's actualy present only in tabs (saved or active)
    },


    getMarksClone:function() {
        var r_marks = oneLevelObjectClone(this.marks);
        r_marks.relicons = this.marks.relicons.slice(0);

        return r_marks;
    },

    setNewMarksObject_notifyObserversAndPersitenceManager:function(immutableMarksObject_MustNotBeChangedInFuture) {
        this.marks = immutableMarksObject_MustNotBeChangedInFuture;

        this.calculateIsProtectedFromGoneOnClose();

        if(this.parent) { // просто чтоб лишнии вызовы не делать, так как в большинстве случаев парента нет. Обзерверы если и есть то это явная бага и не стоит их дёргать полюбому наверно
            this.notifyObservers_onNodeUpdated();
            this.notifyTreeModelAboutUpdate_invalidateDids(true); // marks update
        }
    },

    setCustomColor:function(colorStringActive, colorStringSaved) {
        var new_marks = this.getMarksClone();

        new_marks.customColorActive = colorStringActive;
        new_marks.customColorSaved  = colorStringSaved;

        this.setNewMarksObject_notifyObserversAndPersitenceManager(new_marks);
    },

    setCursorHereOrToFirstCollapsedParent:function(port/*portToViewThatRequestAction*/, doNotScrollView) {
        var targetNode = this.getFirstCollapsedNodeInPathFromRootOrThisIfNotHiden();

        port.postMessage({command:"msg2view_setCursorHere", targetNodeIdMVC:targetNode.idMVC, doNotScrollView:doNotScrollView});
    },

    removeCursorStyles:function(ICursorOwner) {
        this.notifyObservers("fromModel_removeCursorStyles", ICursorOwner);
    },

    // - Tree restructuring operations ---------------------------------------------------------------------------------

    // Сюда приходят на удаление верхний элемент иерархии целиком, с кучей поднод, она ещё возвращается и с ней всякие 
    // манипуляции зачастую делаются с перевставкой последующей
    // к примеру табов с нотатками Если удалялось живое окно, ну или просто всех субнод
    removeSubTree:function(nodeToDelete) {
        // nextCursorHolderInCaseCursoredElementsAffectedIdMVC расчитывается как узел на следующей строке после удаленной иерархии или если нет такого (это последняя в дереве иерархия)
        // тогда это узел на строке перед ней
        let nextCursorHolderInCaseCursoredElementsAffected = nodeToDelete.findNextSibling_ifAbsent_anyParentsNextSibling();
        if(!nextCursorHolderInCaseCursoredElementsAffected)
            nextCursorHolderInCaseCursoredElementsAffected = nodeToDelete.findNodeOnPrevRow();


        let allNodesIdMVCsOfDeletedHierarchy = this.removeSubTree_rawNoObserversNotify(nodeToDelete);
        this.notifyTreeModelAboutUpdate_invalidateDids(false); // "removeSubnode"


        // var nodeToDeleteIndex = this.subnodes.indexOf(nodeToDelete);
        // if(nodeToDeleteIndex < 0) throw "Error deleteSubnode() cannot find specified nodeToDelete in subnodes list";
        // var removedElement = this.subnodes.splice( nodeToDeleteIndex, 1)[0];
        // // if(this.sdId) this.subnodesChangesCollector.deleted(nodeToDeleteIndex);
        //
        // removedElement.parent = null;
        //
        // let allNodesIdMVCsOfDeletedHierarchy = [];
        //
        // forEachNodeInTree_noChangesInTree( [removedElement],  function clearObserver_collectIds(nodeModel) {
        //     nodeModel.observers = [];
        //     allNodesIdMVCsOfDeletedHierarchy.push(nodeModel.idMVC);
        // } );

        this.calculateIsProtectedFromGoneOnClose();

        this.notifyObservers_alsoUpdateCollapsedParents(
            "fromModel_onSubTreeDeleted",
            nodeToDelete.idMVC,
            /*isSubnodesListEmpty*/this.subnodes.length === 0,
            /*allNodesIdMVCsOfDeletedHierarchy*/allNodesIdMVCsOfDeletedHierarchy, //Список удаленных узлов и nextCursorHolderIdMVC передаются для View чтоб если там был курсор на комто из удаленных нод оно его переставило на nextCursorHolderIdMVC
            nextCursorHolderInCaseCursoredElementsAffected.idMVC
        );

        //this.notifyAllCollapsedInPathToRoot("fromModel_onChangesInSubnodesTrees"); // Почему всех а не тока первый по дороге от рута читай в этом методе

        return nodeToDelete;
    },
   
    removeSelfAndPromoteSubnodesInPlace:function() {

        // nextCursorHolderInCaseCursoredElementsAffectedIdMVC - подсказка где будет курсор для тех потенциальных View в которых он стоял как раз на удаленном узле (паренте)
        // - если курсор на удаленном узле и были подузлы то переставит на первый подузел
        // - если курсор на удаленном узле и небыло подузлов то на следующий RowDow (sibling)
        // - если курсор на удаленном узле и небыло подузлов и нет следующего sibling то на предыдущий RowDow (это может быть и парент)
        let nextCursorHolderInCaseCursoredElementsAffected = this.findNodeOnNextRow(false) ?? this.findNodeOnPrevRow();

        // почему перед удалениеием из иерархии мы notifyObservers делаем
        // вообщето это грязный обход проблемы того что внутри notifyObservers мы ищем treeModel для доступа к treeModel.viewsCommunicationInterface
        // методом спуска по иерархии к корню где он лежит
        // и после удаления узла у него parent станет null (не сможем спустится там к root)
        //this.notifyObservers("fromModel_onRemoveSelfAndPromoteSubnodesInPlace", nextCursorHolderInCaseCursoredElementsAffected.idMVC);


        var parent = this.parent;
        var deletedNodeIdMVC = this.idMVC;
        var insertPosition = parent.subnodes.indexOf(this);
        var subnodesFromDeleteHierachy = this.subnodes.slice(0); // Делаем копию для итерирования. Так как node.removeOwnTreeFromParent() будут модифицировать deletedHierarchy.subnodes
        let allNodesIdMVCsOfDeletedHierarchy = parent.removeSubTree_rawNoObserversNotify(this);

        // Тут была раньше бага из-за того что мы итерировались по deletedHierarchy.subnodes и модифицировали его при этом вызовами node.removeOwnTreeFromParent - и forEach глючит в этом случае!
        subnodesFromDeleteHierachy.forEach( function(node) {
            //parent.insertSubnode(insertPosition++, node.removeOwnTreeFromParent(/*подавляем parent present error*/));

            node.parent = null; //подавляем parent present error, поддерево уже удалено из дерева, так что наверно ок так грубо
            parent.rawInsertSubnodeNoObserversNotify(insertPosition++, node);

        });
        // deletedHierarchy.subnodes должно быть тут === [];

        this.notifyTreeModelAboutUpdate_invalidateDids(false); // "removeSubnode"
        this.calculateIsProtectedFromGoneOnClose(); // это только для NodeActiveBase имеет значение

        parent.notifyObservers_alsoUpdateCollapsedParents(
            "fromModel_onRemoveSubnodeAndPromoteItsSubnodessInPlace", 
            deletedNodeIdMVC,
            /*isSubnodesListEmpty*/parent.subnodes.length === 0,
            /*allNodesIdMVCsOfDeletedHierarchy*/allNodesIdMVCsOfDeletedHierarchy,
            nextCursorHolderInCaseCursoredElementsAffected.idMVC
        );


        return this/*deletedHierarchy*/;
    },    

    calculateParentsUpdatesData:function() {
        // parentsUpdateData collection of objects with updates for parents

        let r = {};

        for(let nodeModel = this; nodeModel; nodeModel = nodeModel.parent)
            r[nodeModel.idMVC] = {
                isSubnodesPresent           : nodeModel.subnodes.length > 0,
                isCollapsed                 : nodeModel.colapsed,
                subnodesStatBlock           : nodeModel.colapsed ? nodeModel.countSubnodesStatsBlockData() : null,
                isProtectedFromGoneOnClose  : nodeModel.isProtectedFromGoneOnClose(),

                titleCssClass           : nodeModel.titleCssClass,
                titleBackgroundCssClass : nodeModel.titleBackgroundCssClass,
                _isSelectedTab          : nodeModel.isSelectedTab(),
                _isFocusedWindow        : nodeModel.isFocusedWindow(),
                _getNodeContentCssClass : nodeModel.getNodeContentCssClass(),
            };

        return r;
    },

    removeSubTree_rawNoObserversNotify:function(nodeToDelete) {
        var nodeToDeleteIndex = this.subnodes.indexOf(nodeToDelete);
        if(nodeToDeleteIndex < 0) throw "Error deleteSubnode() cannot find specified nodeToDelete in subnodes list";
        var removedElement = this.subnodes.splice( nodeToDeleteIndex, 1)[0];
        // if(this.sdId) this.subnodesChangesCollector.deleted(nodeToDeleteIndex);

        removedElement.parent = null;

        let allNodesIdMVCsOfDeletedHierarchy = [];

        forEachNodeInTree_noChangesInTree( [removedElement],  function clearObserver_collectDeletedIdMVCs(nodeModel) {
            //nodeModel.observers = [];
            allNodesIdMVCsOfDeletedHierarchy.push(nodeModel.idMVC);
        } );

        return allNodesIdMVCsOfDeletedHierarchy;
    },

    removeOwnTreeFromParent:function() {
        if(!this.parent) {
            if(console)console.error("Trying to delete node without parent, (it's ok and expected during paste hierarchy) ");
            return;
        }

        return this.parent.removeSubTree(this);
    },

    // if subnodeIndex === -1 вставлять в конец списка
    // Сюда приходят на вставку иерархии целиком живых нод. При этом генерится для подключенных обзерверов onSubnodeInserted и если им это интересно они к этой иерархии
    // фигачат ссылки на себя
    //
    // но не во время Move - во время Move новое дерево (в версии 37) создаётся поузлово - сюда мы прилетаем для каждой вставляемой ноды
    // а вот Delete оригинальной иерархии происходит целиком (удаляется корень).
    // dropedNodeModel.moveToActiveTree / dropedNodeModel.copyToActiveTree
    // tree.nodeDropMethodCall
    // doRecursiveDrop_
    // tree.moveCopyHierarchy
    insertSubnode:function(subnodeIndex, newNode, isInsertedDuringDeserializeFromDb) {

        let [newNodeIndex, isStartNewList] = this.rawInsertSubnodeNoObserversNotify(subnodeIndex, newNode);

        this.calculateIsProtectedFromGoneOnClose();

        if(!isInsertedDuringDeserializeFromDb) {

            this.notifyObservers_alsoUpdateCollapsedParents("fromModel_onSubnodeInserted",
                new NodeModelMVCDataTransferObject(newNode),
                newNodeIndex,
                newNodeIndex === (this.subnodes.length-1),
                isStartNewList);

            //this.notifyObservers("fromModel_onSubnodeInserted", newNode, newNodeIndex, newNodeIndex === (this.subnodes.length-1), isStartNewList);
            //this.notifyAllCollapsedInPathToRoot("fromModel_onChangesInSubnodesTrees"); // Почему всех а не тока первый по дороге от рута читай в этом методе

            this.notifyTreeModelAboutUpdate_invalidateDids(false); // "insertSubnode"
        }

        return newNode;
    },

    rawInsertSubnodeNoObserversNotify:function(subnodeIndex, newNode) {
        if(!newNode){ console.error("ERROR - node.rawInsertSubnodeNoObserversNotify called without newNode"); return null; }

        var newNodeIndex = (subnodeIndex === -1) || (subnodeIndex > this.subnodes.length) ? this.subnodes.length : subnodeIndex;

        var isStartNewList = this.subnodes.length === 0;

        // resetStructureDids сделано на всякий случай, потому как paste вызывает эту штуку с готовой иерархией.
        // и хотя в неё никогда не попадают did & cdid не нулевые (бо иерархия копируется через клон), но всё может быть, да и пошутить ктото может
        forEachNodeInTree_noChangesInTree([newNode], function(nodeModel) { /*nodeModel.observers = [];*/ nodeModel.resetStructureDids(); });

        this.subnodes.splice(newNodeIndex, 0, newNode);
        // if(this.sdId && !isInsertedDuringDeserializeFromDb) this.subnodesChangesCollector.inserted(newNodeIndex);

        if(newNode.parent) console.error("ERROR - Parent in inserted node already present!", this, subnodeIndex, newNode);
        //TODO ITS SUBNODES LIST MUST BE UPDATED IN THIS CASE (if(newNode.parent)) TO PREVENT CIRCULAR GRAPHS!!! А лучше вообще чтоб такого небыло
        //Тоесть если не просто parent есть, а ещё и в его subnodes есть реферанс на эту ноду это жопа
        //Вот тока это на самом деле возможно если это просто временный parent (и такие у нас есть) выступающий как колекция элементов
        //Такое было раньше (счас уже пофиксано) например при удалении парента, субноды перед вставкой в парент парента таки хронятся в старом но уже удалённом из дерева паренте.

        newNode.parent = this;

        return [newNodeIndex, isStartNewList];
    },

    // insertCopyAsSubnode и метод ниже (deleteHierarchy) фактически обслуживают тока moveCopyHierarchy и предназначены для перестановки курсора верной
    insertCopyAsSubnode_MoveCursor:function(subnodeIndex, newNode, originalNode, isMoveOperation) {
        var r = this.insertSubnode(subnodeIndex, newNode, false);
//      if(isMoveOperation) r.notifyObservers("fromModel_afterCopyPlacedDuringMove_TransferCursor");
        return r;
    },

    // Это вызывается ТОЛЬКО колапснутого узла на delete action (уже не тока)
    // Башой вопрос, что насчёт работы с курсором во всех других местах где вызывается removeOwnTreeFromParent, точно что не всюду это надо, но...
    deleteHierarchy_MoveCursor:function() {
        //this.notifyObservers("fromModel_onBeforeDeleteHierarchy_MoveCursor");
        return this.removeOwnTreeFromParent();
    },

    insertAsFirstSubnode:function(newNode) {
        return this.insertSubnode(0, newNode); // moveToActiveTree метод всётаки использует -1 как сигнал для вставки в конец, так что insertSubnode(-1, должно всё равно работать как insertAsLastSubnode
    },

    insertAsLastSubnode:function(newNode) {
        return this.insertSubnode(-1, newNode); // moveToActiveTree метод всётаки использует -1 как сигнал для вставки в конец, так что insertSubnode(-1, должно всё равно работать как insertAsLastSubnode
    },

    insertParent:function(newParentToInsertBeforeAs) {
        var targetPoint = this.getTargetPointInParent();
        var ourTree = this.removeOwnTreeFromParent();
        newParentToInsertBeforeAs.insertAsLastSubnode(ourTree);
        return targetPoint.container.insertSubnode(targetPoint.position, newParentToInsertBeforeAs);
    },

    insertAsPreviousSibling:function(newSiblingNode) {
        var insertIndex = this.parent.subnodes.indexOf(this);
        return this.parent.insertSubnode(insertIndex, newSiblingNode);
    },

    insertAsNextSibling:function(newSiblingNode) {
        var insertIndex = this.parent.subnodes.indexOf(this) + 1;
        return this.parent.insertSubnode(insertIndex, newSiblingNode);
    },

    findAllTabsOrganizersInsideHierarchy:function(searchResults) {
        for(var i = 0; i < this.subnodes.length; i++) {
            var node = this.subnodes[i];
            if(node.isSavedOrOpenTabsOrganizer()) searchResults.push(node);
            node.findAllTabsOrganizersInsideHierarchy(searchResults);
        }
    },

    findNodeOnPrevRow:function() {
        var parent = this.parent;
        if(!parent) return null;
        var ourIndex = parent.subnodes.indexOf(this);

        if(ourIndex === 0) { // Мы первая сабнода
            return parent;
        } else { // Перед нами таки есть сиблинги
            return parent.subnodes[ourIndex-1].findLastNodeInHierarhy();
        }
    },

    findPrevSibling:function() {
        var parent = this.parent;
        if(!parent) return null;
        var ourIndex = parent.subnodes.indexOf(this);

        if(ourIndex === 0) { // Мы первая сабнода
            return null;
        } else { // Перед нами таки есть сиблинги
            return parent.subnodes[ourIndex-1];
        }
    },

    findPrevSibling_ifAbsent_parent:function() {
        var r = this.findPrevSibling();
        if(!r)
            return this.parent;
        else
            return r;
    },

    findNodeOnNextRow:function(stayInParentBounds) {
        if(!this.colapsed && this.subnodes.length > 0) { // Есть сабноды и они видны, просто возвращаем первый элемент из сабнод
            return this.subnodes[0];
        } else { // это singl нода, или свёрнутая, возвращаем следующего сиблинга с тогоже уровня
            return this.findNextSibling_ifAbsent_anyParentsNextSibling(stayInParentBounds);
        }
    },

    findNextSibling_ifAbsent_anyParentsNextSibling:function(stayInParentBounds) {
        var parent = this.parent;
        if(!parent) return null;
        var ourIndex = parent.subnodes.indexOf(this);

        if((ourIndex + 1) < parent.subnodes.length) // Ниже есть ещё сиблинги на томже уровне
            return parent.subnodes[ourIndex + 1];
        else                                        // Это последняя нода, ниже на этом уровне ничего нет
            return stayInParentBounds ? null : parent.findNextSibling_ifAbsent_anyParentsNextSibling(false);
    },

    findLastNodeInHierarhy:function() {
        if(this.subnodes.length === 0) return this;

        return this.subnodes[this.subnodes.length-1].findLastNodeInHierarhy();
    },

    replaceSelfInTreeBy_mergeSubnodesAndMarks:function(nodeWhichReplaceThis) {
        var parent = this.parent;

        if(nodeWhichReplaceThis.subnodes.length > 0 || nodeWhichReplaceThis.marks.relicons.length > 0)
        {
            // TODO Надо переименовать метод. Этот метод на самом деле вроде бы что никогда не юзается для мержинга.
            // Он используется чтоб переставлять появившуюся живую ноду на то место где ей положенно быть (вместо заказавшей ноды)
            // При этом всегда та нода которая замещается отдаёт все свои маркс и субноды
            // А та что появится на её месте не должна по идеи иметь ни маркс ни субнод - так как она только повилась мгновение назад - если имеет - это баг!
            console.log("WARNING - replacer have subnodes or icons, its strange"); // Эта распечатка всёже таки часто появляется, что логично, так как при востановлении окна....
        }

        if(nodeWhichReplaceThis.parent) nodeWhichReplaceThis.removeOwnTreeFromParent();
            // requestNewAlifeWindowForNode вызывает нас тут с недавно созданным окном в дереве,
            // ещё есть replaceTabInWindowByNewlyCreatedRequestedTab_orAttachWaitTab, который тоже вызывает нас с табом сейчас в дереве находящимся

        var replaceIndex = parent.subnodes.indexOf(this); // must be calculated AFTER replacing node was delete from tree

        this.notifyObservers("fromModel_onBeforeReplaced_RememberCursor"); // Такой себе хак слегка, view запомнит позицию курсора если это именно та нода что его несла и переставит на ту которая его заменила

        this.removeOwnTreeFromParent(); // this.parent is now null

        nodeWhichReplaceThis.mergeSubnodesAndCopyMarksFrom(this);

        var r = parent.insertSubnode(replaceIndex, nodeWhichReplaceThis);

        r.notifyObservers("fromModel_onAfterReplaced_SetCursor");

        return r;

        // TODO возможно стоит сделать для view новый месадж - onNodeReplaced (и кстате fromModel_onNodeUpdated возможно стоит сделать через него)
    },

    mergeSubnodesAndCopyMarksFrom:function(source) {
        for(var i = source.subnodes.length-1; i >=  0; i--)
            this.insertSubnode(0, source.subnodes[i].removeOwnTreeFromParent(/*подавляем parent present error*/));  // мы хотим чтоб сначало шли те субноды что были в this, а потом уже те что были в nodeWhichReplaceThis

        this.copyMarksAndCollapsedFrom(source);
    },

    flattenTabsHierarchy_skipTabsOrganizers : function() {
        var parent = this;
        var currentNodeModel = parent.subnodes[0]; // can be undefined
        var nodes = [];

        // Form a correct order of flatened nodes under parent
        while(true) {
            if(!currentNodeModel || !currentNodeModel.isSupliedNodePresentInPathToRoot(parent)) break;

            if( currentNodeModel.parent == parent || isLinkOrSeparatorOnLink(currentNodeModel) )
                nodes.push(currentNodeModel);

            if(currentNodeModel.isSavedOrOpenTabsOrganizer()) // Если это табс органайзер пропускаем его иерархию
                currentNodeModel = currentNodeModel.findNextSibling_ifAbsent_anyParentsNextSibling(false/*stayInParentBounds*/);
            else
                currentNodeModel = currentNodeModel.findNodeOnNextRow(false/*stayInParentBounds*/);
        }

        //Now move all found nodes in correct order under parent
        //Note that tabs order do not change, so we not need to reorder tabs in Chrome window if some of them active
        for(var i =  nodes.length-1; i >= 0;i--) {
            var node = nodes[i];

            node.removeOwnTreeFromParent();
            parent.insertAsFirstSubnode(node);
        }

        function isLinkOrSeparatorOnLink(nodeModel) {
            return  nodeModel instanceof NodeTabBase ||
                   (nodeModel instanceof NodeSeparatorLine && nodeModel.parent instanceof NodeTabBase);
        }
    },

    liberateToLevelDownWithOwnHierarchy : function() {
        var parent = this.parent;
        this.removeOwnTreeFromParent();
        return parent.insertAsNextSibling(this);  // а оно точно хавает иерархию?
        // Почемуто не утаскивает за собой всю свою иерархию
    },

    // -----------------------------------------------------------------------------------------------------------------

    // Должно быть вызвано после любого апдейта marks
    calculateIsProtectedFromGoneOnClose:function() {
        // не false значение актуально тока для Active обектов (окон и табов)

        return this.isProtectedFromGoneOnCloseCache = false;
    },

    // Вызывается тока из NodeActive (search this key for othere such comments)
    isCustomMarksPresent:function() {
        return    this.marks.relicons.length > 0
               || this.marks.customFavicon     != undefined
               || this.marks.customTitle       != undefined
               || this.marks.customColorActive != undefined
               || this.marks.customColorSaved  != undefined;
    },

    // Вызывается тока из NodeActive (search this key for othere such comments)
    isSomethingExeptUnmarkedActiveTabPresentInDirectSubnodes:function() {
        for(var i = 0; i < this.subnodes.length; i++) {
            var directSubnode = this.subnodes[i];
            if(directSubnode.type !== NodeTypesEnum.TAB) return true;
            if(directSubnode.isCustomMarksPresent())     return true;
        }

        return false;
    },

    // Единственные два обекта что это переопределяют это ActiveTab & ActiveWindow - они возвращают свои Saved аналоги
    cloneForCopyInActiveTree_withoutSubnodes:function() {
        return this.copyConstructor_withoutSubnodes();
    },


    getIcon:function() {
        return null;
    },

    getIconForHtmlExport:function() {
        return null;
    },

    getNodeContentCssClass:function() {
        return null;
    },

    getNodeTextCustomStyle:function() {
        if(this.type === NodeTypesEnum.TAB || this.type === NodeTypesEnum.WINDOW)
            return this.marks.customColorActive ? "color:"+this.marks.customColorActive : null;
        else
            return this.marks.customColorSaved  ? "color:"+this.marks.customColorSaved : null;
    },

    getNodeText:function(isForEditPromt) {
        console.error("ERROR getNodeText is not overriden", this);
        return "";
    },

    getTooltipText:function() {
        return "";
    },

    getHref:function() { // Also used to detect saved and open tabs nodes in flatten hierarchy command, as only them return non empty Href
        return "";
    },

    isProtectedFromGoneOnClose:function() {
        return this.isProtectedFromGoneOnCloseCache;
    },

    isSelectedTab:function() {
        return false;
    },

    isFocusedWindow:function() {
        return false;
    },

    countSubnodesStatsBlockData:function() {
        return this.countSubnodes({'nodesCount':0, 'activeWinsCount':0, 'activeTabsCount':0}); // Задаём эти поля с нулевыми значения тут, чтоб зафиксировать порядок выдачи для for in, иначе может быть другой порядок и табы окажутся перед окнами в выдаче
    },

    countSelf:function(statData) {
        statData['nodesCount'] = statData['nodesCount'] ? statData['nodesCount']+1 : 1;
    },

    countSubnodes:function(statData) {
        for(var i = 0; i < this.subnodes.length; i++) {
            this.subnodes[i].countSelf(statData);
            this.subnodes[i].countSubnodes(statData);
        }
        return statData;
    },

    copyConstructor_withoutSubnodes:function() {
        console.error("ERROR NodeModelBase::copyConstructor_withoutSubnodes() was not overriden");
        return null;
    },

    // TODO Cut&Paste - deserializeMarksAndCollapsed
    copyMarksAndCollapsedFrom:function(sourceNode) {
        // Этот метод всегда вызывается в рамках объкта который не вставлен дерев - и не имеет parent - тоесть
        // Почти всегда в copyConstructorah или аналогах, на тока что созданной ноде оператором new
        // есть одно исключение в replaceSelfInTreeBy_mergeSubnodesAndMarks но там он тоже вызывается на иерархии которая только что была извлечена из tree
        // и на которой был явно вызван removeOwnTreeFromParent() - который зануляет и парент и обзерверы
        // if(this.parent) if(console) console.error("ERROR !!! CMACF PARENT PRESENT"); Проверка излишня, это всегда так.

        this.colapsed = sourceNode.colapsed;

        var new_marks = sourceNode.getMarksClone();
        new_marks.relicons = new_marks.relicons.concat(this.marks.relicons); // Мержим иконки, вроде именно на мержинг расчитывает replaceSelfInTreeBy_mergeSubnodesAndMarks - но надо проверить или это реально надо или мона просто скопировать
        if(!new_marks.customTitle)   new_marks.customTitle   = this.marks.customTitle;
        if(!new_marks.customFavicon) new_marks.customFavicon = this.marks.customFavicon;
        this.setNewMarksObject_notifyObserversAndPersitenceManager(new_marks); // Ни парента ни обзерверов в this нет (читай комент в начале), так что ничего из этого вызываться не будет

        return this;
    },

    // TODO Cut&Paste - copyMarksAndCollapsedFrom
    deserializeMarksAndCollapsed:function(serializedNodeData) {
        this.colapsed       = !!(serializedNodeData['colapsed']); // colapsed can be undefined

        if(serializedNodeData['marks']) {
            this.marks          = oneLevelObjectClone(serializedNodeData['marks']);
            this.marks.relicons = serializedNodeData['marks']['relicons'].slice(0);
        } else {
            this.marks          = {};
            this.marks.relicons = [];
        }

        // Fix for 0.4.27 & 0.4.28 incorect closured builds
        if(!!this.marks['U']) { //0.4.28
            this.marks.customColorActive = this.marks['U'];
            delete this.marks['U'];
        }
        if(!!this.marks['V']) { //0.4.28
            this.marks.customColorSaved = this.marks['V'];
            delete this.marks['V'];
        }
        if(!!this.marks['J']) { //0.4.27
            this.marks.customTitle = this.marks['J'];
            delete this.marks['J'];
        }
        if(!!this.marks['u']) { //0.4.27
            this.marks.customFavicon = this.marks['u'];
            delete this.marks['u'];
        }
        if(!!this.marks['W']) { //0.4.28
            this.marks.customTitle = this.marks['W'];
            delete this.marks['W'];
        }
        if(!!this.marks['I']) { //0.4.28
            this.marks.customFavicon = this.marks['I'];
            delete this.marks['I'];
        }

        this.calculateIsProtectedFromGoneOnClose(); // TODO Cut&Paste, it Must be automaticaly (from one place) called on any marks update

        // this.notifyTreeModelAboutUpdate(); Это бесполезно тут вызывать, deserializeMarksAndCollapsed метод вызывается из deserializeNode
        // в тот момент когда нода ещё никуда не вставлена
        // Более того. Этот метод и нельзя тут вызывать даже еслиб это было не так, так как он зануляет dId!!!

        return this;
    },

    // type не указан => это NodeTypesEnum.SAVEDTAB
    // marks & marks.relicons отсутствуют если они пусты
    // colapsed отстутствует если false
    serialize:function() {
        var r = {};

        // WARNING take look on insertSubnode() in case any changes there - they must delete all this atributes for inserted hierarchies
        if(this.dId)      r['dId']      = this.dId;  // can be undefined, by the way, in this case JSON.serialize() does not add the property at all to output string
        if(this.cdId)     r['cdId']     = this.cdId;  // can be undefined, by the way, in this case JSON.serialize() does not add the property at all to output string
        if(this.sdId)     r['sdId']     = this.sdId;  // can be undefined, by the way, in this case JSON.serialize() does not add the property at all to output string
        if(this.sdIdKnot) r['sdIdKnot'] = this.sdIdKnot;

        if(this.type !== NodeTypesEnum.SAVEDTAB)
            r['type'] = this.type;

        if(Object.keys(this.marks).length > 1/*relicons always present*/ || this.marks.relicons.length > 0) {
            r['marks'] = this.marks; // marks+rellicons это вроде как immutable обект - по одиночке они не меняются, только в месте, по крайней мере не должны
                                     // нигде не должны меняться rellicons без замены marks обекта

                                     // TODO - вот только тут большая бага, так как я сериализирую в файл прям вот то что JS объекте храню
                                     //        и чуть ниже такаяже ошибка с oneLevelObjectClone(this.persistentData);
                                     //        (хотя в persistentData я всё акуратно ложу через ['xyz'])
                                     //        всё это соответственно сильно зависит от выбрыков closureCompiler и от того не забыл ли я там это как
                                     //        обявить как externs
        }
        // Если custom marks нет то и поля этого не будет в return value

        if(this.colapsed) r['colapsed'] = this.colapsed;

        r['data'] = this.polymorficSerializeData();

        return r;
    },

    // Overriden in Tabs, Windows, and maybe other objects
    polymorficSerializeData:function() {
        var r = null;
        if(this.persistentData) r = oneLevelObjectClone(this.persistentData);
        return r;
    },

    serializeNodeBodyContent_forDiff:function() {
        var normalserialize = this.serialize(); // TODO фигня и куча лишнего
//           Тут проблема короче, сериалайз надо полностью переписывать на новый, с учотом таблиц элементов зареференсеных по внешним ключам
//           вариант без этого - парсить тут возвращённое значение, но это не ООП + при смене логики/введении новых нод-полей тут прийдётс тоже чтото менять, плохо

        var r = [ NodesTypesEnumStr2Num[ this.type ] * (this.colapsed ? -1 : 1) // The type is negative if collapsed
                , normalserialize['data'] //TODO куча лишней лабуды
              //, optional {marks}, see next line
                ];

        if(normalserialize['marks']) r.push(normalserialize['marks']);
        // WARNING - больше опциональных полей тут быть не может...

        return JSON.stringify(r);
    },

    // sdIdKnot (это сериализированный узел):
    // "cdId"                         - нет субнод
    // "cdId@dId&dId&dId&dId&dId&dId" - субноды закодированы прямо тут
    // "cdId#sdId"                    - субноды закодированы в sdId, изменений небыло
    // "cdId#sdId#sops"               - субноды закодированы в sdId + изменения
    serializeNodeStructureAndSubnodesChanges_forDiff:function() {
        var r = [i2s36(this.cdId)];
        if(this.sdId) // Если this.sdId нету (zero) то subnodes list просто пустой, нет субнод
            if(this.sdId === this.dId) {
                r[0] += CDID_SUBNODESLIST_SEPARATOR + this.serializeNodeSubnodesList_forDiff();
            } else { // sdId указывает на другую ноду
                r[0] += CDID_SDID_SEPARATOR          + i2s36(this.sdId);

                var baseSubnodesList = getBaseSubnodesArray(this.sdIdKnot);
                var currentSubnodesList = this.getSubnodesDidsArray();
                // Имей в виду что узлы у нас к сожалению не immutable, и часом там меняется chromeTabObject, без перевставки всего узла в родителя
                // А значит нереально детектать эти изменения тока подвесившись на insert & delete subnodes в паренте
                // TODO можно бы было заставить всёже подузлы выставлять invalidate флаг контролёру сабнод чтоб тут лишнюю проверку не пилить каждый раз!
                // Когда они себе скидывают did! Рас уже есть код который на любое изменение этим занимается!
                // Да и саму проверку... хорошобы не по строкам делать хотябы... этож ужас, в цикле стока гоняем всего
                // Ну и кстате этот флаг можно выставлять при любом скидывании did,
                // тут его надо после проверки кстате опускать
                // Проверка кстате не нужна, можно сразу гнать алгоритм diff но если изменений небыло он не должен делать push
                if(SybnodesChangesMonitor_isChangesToBase(currentSubnodesList, baseSubnodesList)) {
                    r.push(SybnodesChangesMonitor_serializeCurSubnodes(currentSubnodesList, baseSubnodesList));
                    // r.push(this.serializeNodeSubnodesList_forDiff());  2DEL! IT'S FOR TEST
                }
            }

        return r.join(CDIDSDID_SUBNODESBASEMODIFICATIONS_SEPARATOR);
    },

    serializeNodeSubnodesList_forDiff:function() {
        return this.getSubnodesDidsArray().join(SUBNODES_DIDS_SEPARATOR);
    },


    serializeForDiff:function(startingDId, differenceAccumulator) {
        var knot = this.serializeNodeStructureAndSubnodesChanges_forDiff();

        addToCollectionUnderS36Key(differenceAccumulator, 'k', this.dId, knot);

        if(this.sdId === this.dId)
            this.sdIdKnot = knot;

        if(this.sdId  >= startingDId && this.sdId !== this.dId) // Добавляем sdIdKnot как обычный knot. Хотя в дереве его уже может и не быть. Или даже всегда нет. Так как это старая версия текущего узла
            addToCollectionUnderS36Key(differenceAccumulator, 'k', this.sdId, this.sdIdKnot);

        if(this.cdId >= startingDId)
            addToCollectionUnderS36Key(differenceAccumulator, 'c', this.cdId, this.serializeNodeBodyContent_forDiff());
    },

    getSubnodesDidsArray:function() {
        // TODO может проще сразу did такие присваивать? нах нам по сто раз их конвертить туда сюда, проверить тока надо скорость сравнения и монотонность)
        // Монотонность можно проверить сгенерив рандомом много раз
        // И к сожалению оно не монотонное ("12" < "111" == false). Хотя если сначало сравнивать длину строк то становится монотонным
        //        function randomRange(min, max) { return ~~(Math.random() * (max - min + 1)) + min }
        //        function stringifiedNumbersCompare_isLess(a, b) {
        //            if(a.length < b.length) return true;
        //            if(a < b) return true;
        //            return false;
        //         }
        //        var failCount = 0
        //        for(var i = 0; i < 1000000;i++){
        //         var a = randomRange(0,100000000); var b = randomRange(0,100000000);
        //         if( a < b && !stringifiedNumbersCompare_isLess((a).toString(36),(b).toString(36)) ) {failCount++; console.log(a,b,(a).toString(36),(b).toString(36))}
        //        }
        //        console.log("failcount:",failCount)
        // > failcount: 0

        var r = [];
        for(var i = 0; i < this.subnodes.length; i++) r.push( i2s36(this.subnodes[i].dId) );
        return r;
    },

    isNotCoveredByWindowActiveTabsPresentInHierarchy:function() {
        // TODO вот это условие оно какоето левое, помойму явно не нужно тестировать ещё и this.isAnOpenWindow()
        if( this.isSavedOrOpenTabsOrganizer()/*return false for open popup windows*/ || this.isAnOpenWindow() ) return false; // Это Сам по себе Таб Холдер - нет смысла проверять его подузлы, он сам станет для них холдером

        if( this.isAnOpenTab() )
            return true;

        // Ситуация когда мы тащим note или saved tab а на нём лежат актив табы неприкрытые окном
        for(var i = 0; i < this.subnodes.length; ++i)
            if( this.subnodes[i].isNotCoveredByWindowActiveTabsPresentInHierarchy() ) return true;

        return false;
    },

    getTreeModelFromRoot_invalidateDids:function(isCurrentNodeContentAffected) {
        if(isCurrentNodeContentAffected)
            this.cdId = 0;

        var testednode = this;
        testednode.dId = 0;

        while(testednode.parent) {
            testednode = testednode.parent;
            testednode.dId = 0;
        }

        return testednode.treeModel; // Can be of course undefined
    },

    getTreeModelFromRoot:function() {
        var testednode = this;

        while(testednode.parent) testednode = testednode.parent;

        return testednode.treeModel; // Can be of course undefined
    },


    isSupliedNodePresentInPathToRoot:function(nodeModel) {
        var testednode = this;
        while(testednode.parent) {
            testednode = testednode.parent;
            if(testednode === nodeModel) return true;
        }

        return false;
    },

    getPathToRoot:function() {
        // В serializeAsOperationsLog() также используется знание об этом алгоритме для более быстрого расчёта пути
        var rPath = [];

        var testednode = this;
        while(testednode.parent) {
            rPath.push( testednode.parent.subnodes.indexOf(testednode) );
            testednode = testednode.parent;
        }

        return rPath.reverse(); // TODO НАХУЯ РЕВЕРСЕ? Этож тока замедляет работу
    },

    isOnRootSubnodesLevel:function() {
        return this.parent && this.parent.parent == null;
    },

    findFirstSavedOrOpenTabsOrganizerInPathToRoot:function(forTabInChromeWindowId) {
        for(var testednode = this; testednode; testednode = testednode.parent)
            if( testednode.isSavedOrOpenTabsOrganizer(forTabInChromeWindowId) )
                return testednode;

        return null;
    },

    getFirstCollapsedNodeInPathFromRootOrThisIfNotHiden:function() {
        var r = this; // Вернет текущий узел если свернутых узлов нет

        for(var testednode = this.parent; testednode; testednode = testednode.parent)
            if( testednode.colapsed )
                r = testednode;

        return r;
    },

    findPathStartNodeInRoot:function() {
        for(var testednode = this; testednode.parent.parent; testednode = testednode.parent) {}

        return testednode;
    },

    getTargetPointInParent:function() {
        var container = this.parent;

        return {'container':container, 'position':container.subnodes.indexOf(this)};
    },

    onNodeDblClicked:function(treeModel, portToViewThatRequestAction) {
    },

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Методы актуальные только для Active окон и табов.
    // Сдесь они чтоб не делать лишних проверок при вызове их рекурсивно для всего дерева.

    performChromeRemove:function(protectFromDeleteOnChromeRemovedEvent) {
        // Актуально тока для Active обектов (окон и табов) - будет там перегружено
    },

    // Вызывается тока из NodeActive (search this key for othere such comments)
    protectFromDeleteOnClose:function(storeCloseTimeOnClose) {
        // Актуально тока для Active обектов (окон и табов)

        this._f_convertToSavedOnClose = true;
        this._f_storeCloseTimeOnClose = storeCloseTimeOnClose;

        this.calculateIsProtectedFromGoneOnClose();
        this.notifyObservers_onNodeUpdated();
    },

    setTheWasSavedOnWinCloseFlagForAlternativeRestore:function() {
        // Актуально тока для Saved Tab обектов, но Open табы тоже юзают - они удаляют этот флаг в этом методе
    },

    supressUnexpectedIdErrorOnChromeRemovedEvent:function() {
        // Актуально тока для Active обектов (окон и табов) - будет там перегружено
    },

    EOC:null
});



// for forEach, indexOf, some, each, map, reduce, ... implementation for old JS engines - https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach


//function forEachNodeInTree(nodes, nodeObserverFn)
//{
//    for(var i = 0; i < nodes.length; ++i)
//    {
//        var node = nodes[i];
//
//        // TODO не нравится мне тут slice(0) это лишнее создание КУЧИ масивов - лучше просто просмотреть всюду код и там где есть изменение иерархии во время траверсинга отказаться от этой идеи
//        // а тут отказаться от создания временных копий субнод
//        var originalnode_subnodes = node.subnodes.slice(0);  // Node might be deleted from tree in nodeObserverFn, or replaced by othere nodes
//                                                             // Раньше мы просто юзали var originalnode_subnodes = node.subnodes, но прикол что нода обычна заменяется методом replaceSelfInTreeBy_mergeSubnodesAndMarks
//                                                             // И он явно удаляет из выкидываемой ноды всех её потомков
//                                                             // А вообще изменят масив или дерево по которому итерируем в этот момент это плохая идея (BAD PRACTICE).... куча багов было из-за этого
//        nodeObserverFn(node);
//        if(originalnode_subnodes.length > 0)
//            forEachNodeInTree(originalnode_subnodes, nodeObserverFn);
//    }
//}

function forEachNodeInTree_noChangesInTree(nodes, nodeObserverFn)
{
    for(var i = 0; i < nodes.length; ++i)
    {
        var node = nodes[i];
        var originalnode_subnodes = node.subnodes; // Нафиг не нужно это копирование. но пусть будет

        nodeObserverFn(node);
        if(originalnode_subnodes.length > 0)
            forEachNodeInTree_noChangesInTree(originalnode_subnodes, nodeObserverFn);

    }
}

// Стоит учесть что возврат false из калбека не останавливает сканирование а всего лишь скипает сканирование подузлов текущего узла
function forEachNodeInTree_skipSubnodesTraversalOnFalse__noChangesInTree(nodes, nodeObserverFn)
{
    // Cut & Paste from forEachNodeInTree, but it is very used methods - so its really needed
    for(var i = 0; i < nodes.length; ++i)
    {
        var node = nodes[i];

//        // TODODONE? не нравится мне тут slice(0) это лишнее создание КУЧИ масивов - лучше просто просмотреть всюду код и там где есть изменение иерархии во время траверсинга отказаться от этой идеи
//        // а тут отказаться от создания временных копий субнод
//        var originalnode_subnodes = node.subnodes.slice(0);  // Node might be deleted from tree in nodeObserverFn, or replaced by othere nodes
//                                                             // Раньше мы просто юзали var originalnode_subnodes = node.subnodes, но прикол что нода обычна заменяется методом replaceSelfInTreeBy_mergeSubnodesAndMarks
//                                                             // И он явно удаляет из выкидываемой ноды всех её потомков, тоесть явно меняет оригинальный subnodes масив
//                                                             // А вообще изменят масив или дерево по которому итерируем в этот момент это плохая идея (BAD PRACTICE).... куча багов было из-за этого
//

        var originalnode_subnodes = node.subnodes;

        var isNeedScanSubTree = nodeObserverFn(node);
        if(isNeedScanSubTree && originalnode_subnodes.length > 0)
            forEachNodeInTree_skipSubnodesTraversalOnFalse__noChangesInTree(originalnode_subnodes, nodeObserverFn);
    }
}

//function fillNodesIdsAndParents(tree)
//{
//    var id = 1000000;
//    forEachNodeInTree(
//        tree,
//        function(node, parentnode) { if(!node.id || node.id < 0) node.id = id++; if(!node.parent) node.parent = parentnode; return true; },
//        null
//    );
//}

//DbOperations.NodeTypes ={ NodeSession:"NodeSession"
//
//                        , NodeTabSaved:"NodeTabSaved"
//                        , NodeTabCreationWait:"NodeTabCreationWait"
//                        , NodeTabActive:"NodeTabActive"
//                        , NodeTabAttachWait:"NodeTabAttachWait"
//
//                        , NodeWindowSaved:"NodeWindowSaved"
//                        , NodeWindowCreationWait:"NodeWindowCreationWait"
//
//                        , NodeWindowActive:"NodeWindowActive"
//
//                        };

// Строковые параметры используются как
//  -- css типы
//  -- в момент востановления сессии для выбора конструктора
// не менять!!!!
var NodeTypesEnum = { TAB:"tab"
                    , SAVEDTAB:"savedtab"
                    , WAITINGTAB:"waitingtab" //Not used anymore
                    , ATTACHWAITINGTAB:"attachwaitingtab"

                    , WINDOW:"win"
                    , SAVEDWINDOW:"savedwin"
                    , WAITINGWINDOW:"waitingwin" //Nor used anymore


                    , SESSION:"session"
                    , TEXTNOTE:"textnote"
                    , SEPARATORLINE:"separatorline"
                    , GROUP:"group"
                    };

// WARNING The order is important! DONT INSERT ANYTHING IN THE MIDDLE!!!
var NodesTypesEnumNum2Str =  [ 'ZERO' // Zero index is reserved as we code collapsed as negative type
                             , NodeTypesEnum.SESSION       //1
                             , NodeTypesEnum.TEXTNOTE      //2
                             , NodeTypesEnum.SEPARATORLINE //3
                             , NodeTypesEnum.TAB           //4
                             , NodeTypesEnum.SAVEDTAB      //5
                             , NodeTypesEnum.GROUP         //6
                             , NodeTypesEnum.WINDOW        //7
                             , NodeTypesEnum.SAVEDWINDOW   //8
                             , NodeTypesEnum.ATTACHWAITINGTAB
                             , NodeTypesEnum.WAITINGWINDOW
                             , NodeTypesEnum.WAITINGTAB
                             ];
var NodesTypesEnumStr2Num = (function(array) { var r = {}; for(var ijk = 0; ijk < array.length; ijk++) r[array[ijk]] = ijk; return r; })(NodesTypesEnumNum2Str);


var noFavIconUrl              = 'img/nofavicon.png';
var chromeWindowRgbFavIconUrl = 'img/chrome-window-icon-rgb.png';

function makeFaviconUrl(chromeTabObj) {
    // Сдесь можно бы было просто написать
    // return (chromeTabObj.favIconUrl)? chromeTabObj.favIconUrl : noFavIconUrl;
    // и это даже работает но в этом случае сколько фавиконок столько у нас будет и внешних GET реквестов, и они могут десятки минут не выполняться
    // жрать трафик + у нас будет крутиться спинер в нашем плагине что мол окно не догружено всё это время
    // Что вобщемто не так уж и страшно... зато все иконки будут, счас большинство дохлы
    //
    // Из недостатков "chrome://favicon/"
    //    - оно не выдаёт иконки окон плагинов
    //    - defaultFavicon который она выдаёт прозрачный и нечитаемый на чорном бекграунде

    if(!chromeTabObj.favIconUrl) // favIcon often not available if tab is loading.
        return noFavIconUrl; // chrome://favicon/ выдаёт полупрозрачные дефолт иконки, которые не читаются на чорном фоне, юзаем свою!

    if(chromeTabObj.url.indexOf("chrome") === 0) // will catch chrome-extension:// & chrome:// urls
    {
        if(chromeTabObj.url.indexOf("chrome-devtools:") === 0) // просто ради красоты
            return chromeWindowRgbFavIconUrl;

        if(chromeTabObj.favIconUrl.indexOf("chrome://theme/") === 0) // Для chrome://theme/xxx иконок при появлении в HTML в консоль кидается такая бяка "Not allowed to load local resource: chrome://theme/IDR_EXTENSIONS_FAVICON"
            return chromeWindowRgbFavIconUrl;

        return chromeTabObj.favIconUrl; // chrome://favicon/" + chromeTabObj.url выдаёт дефаулт иконку для иконок окон плагинов, юзаем то что есть реально
    }

    //MANIFESTv2 return chrome.extension ? "chrome://favicon/" + chromeTabObj.url : httpsTheFavicon(chromeTabObj.favIconUrl)
    return chrome.extension ? faviconURL(chromeTabObj.url) : httpsTheFavicon(chromeTabObj.favIconUrl)
    

}

function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "16");
    return url.toString();
}

function httpsTheFavicon(favIconUrl) {
    // bad solution: return favIconUrl.replace("http://","https://");
    // Replace favicon urls to turn off page contains insecure content warning - yet this might create worse problems,
    // as during certificates validation as because https is more CPU intensive and much more network requests intensive
    // Also not all serve the favicons through https!!!!

    // TODO, надо делать через свою версию http://getfavicon.appspot.com/ - есть сорцы, и хорошо бы чтоб тока я мог это юзать
    return favIconUrl;
}


//----------------------------------------------------------------------------------------------------------------------
function NodeTabActive_focusThisTab_withoutScrollToView() {
    focusTab(this.chromeTabObj.windowId, this.chromeTabObj.id, null, /*dontScrollToView*/true);
}
function NodeWindowActive_focusThisWindow_withoutScrollToView() {
    focusWindow(this.chromeWindowObj.id, /*dontScrollToView*/true)
}
//----------------------------------------------------------------------------------------------------------------------
function deserializeNode(serializedNodeData) {

    var r;

    var type = serializedNodeData['type'];
    if(!type) type = NodeTypesEnum.SAVEDTAB; // serializeCondensed стрипает этот тип как самый распространённый

    var data = serializedNodeData['data'];

    switch(type)
    {
        case NodeTypesEnum.SESSION:
            r = (new            NodeSession(data));
            break;

        case NodeTypesEnum.TAB:
            r = (new          NodeTabActive(data));
            break;

        case NodeTypesEnum.SAVEDTAB:
            r = (new           NodeTabSaved(data));
            break;

//      case NodeTypesEnum.WAITINGTAB:
//          r = (new    NodeTabCreationWait(data));
//          break;

//        case NodeTypesEnum.ATTACHWAITINGTAB:
//            r = (new      NodeTabAttachWait(data));
//            break;

        case NodeTypesEnum.WINDOW:
            r = (new       NodeWindowActive(data));
            break;

        case NodeTypesEnum.SAVEDWINDOW:
            r = (new        NodeWindowSaved(data));
            break;

//      case NodeTypesEnum.WAITINGWINDOW:
//          r = (new NodeWindowCreationWait(data));
//          break;

        case NodeTypesEnum.SEPARATORLINE:
            r = (new     NodeSeparatorLine(data));
            break;

        case NodeTypesEnum.TEXTNOTE:
            r = (new              NodeNote(data));
            break;

        case NodeTypesEnum.GROUP:
            r = (new             NodeGroup(data));
            break;

        default:
            console.error("Imposible saved node encountered", serializedNodeData);
            return null;
    }

    r.deserializeMarksAndCollapsed(serializedNodeData);

    // Все поля serializedNodeData ниже can be undefined,
    // by the way, in this case JSON.seriualize does not add the property with undefined value at all to output string, so better not to assign 'undefined' values (they zero by default)
    // Они Undefined к примеру во время апгрейда со старого формата, где их ещё нет, на новый

    if(serializedNodeData['dId'])      r.dId      = serializedNodeData['dId'];
    if(serializedNodeData['cdId'])     r.cdId     = serializedNodeData['cdId'];
    if(serializedNodeData['sdId'])     r.sdId     = serializedNodeData['sdId'];
    if(serializedNodeData['sdIdKnot']) r.sdIdKnot = serializedNodeData['sdIdKnot'];
    // if(serializedNodeData['sDiff']) r.subnodesChangesCollector.deserializeToContinue(serializedNodeData['sDiff']);

    return r;
}

function restoreHierarchyFromJSO(savedNode) {
    var restoredNode = deserializeNode(savedNode['n']); // node

    if(savedNode['s']) // absent if no subnodes
        for(var i = 0; i < savedNode['s'].length; i++) // subnodes
            restoredNode.insertSubnode(i, restoreHierarchyFromJSO(savedNode['s'][i]), true );

    return restoredNode;
}

function restoreTreeFromOperations(operations) {
    var rootNode = null;

    for(var i = 0; i < operations.length; i++) {
        var op = operations[i];

        var op_type = !!op['type'] ? op['type'] : op[0];
        var op_node = !!op['node'] ? op['node'] : op[1];
        var op_path = !!op['path'] ? op['path'] : op[2];

        if(op_type === DbOperations.OperationsEnum.NODE_NEWROOT)
            rootNode = deserializeNode(op_node);

        if(op_type === DbOperations.OperationsEnum.NODE_INSERT)
            insertNodeByPathDuringDeserialize(rootNode, op_path, deserializeNode(op_node));
    }

    return rootNode;
}

function insertNodeByPathDuringDeserialize(rootNode, path, newNode) {
    if(path.length < 1) console.error("ERROR insertSubnodeToPath - no path", path, this, newNode);

    var container = rootNode;

    for(var i = 0; i < path.length-1/*!*/; i++) {
        container = container.subnodes[path[i]];
        if(!container) console.error("ERROR insertSubnodeToPath - unexisted path", path, this, newNode);
    }

    container.insertSubnode( path[path.length-1], newNode, true);
}

// =====================================================================================================================
// Nodes

var NodeSession = NodeModelBase.extend({
    init:function(persistentData){
        this._super(NodeTypesEnum.SESSION, 'windowFrame');

        this.persistentData = persistentData || {};
        if(!this.persistentData['treeId']) this.persistentData['treeId'] = '' + (Date.now()+Math.random());
        if(!this.persistentData['nextDId']) this.persistentData['nextDId'] = 1;
        if(!this.persistentData['nonDumpedDId']) this.persistentData['nonDumpedDId'] = 1;

        this.needFaviconAndTextHelperContainer = true;

        delete this.hoveringMenuActions[hoveringMenuDeleteAction.id];
    },
    getIcon:function() {return 'img/favicon.png'},
    getNodeText:function(isForEditPromt) {return "Current Session"}, //i18n +
    getTooltipText:function() {return ""},

    getNextDid_andAdvance:function()     { return this.persistentData['nextDId']++ },
    getNextDid_withoutAdvance:function() { return this.persistentData['nextDId']   },
    advanceNextDidToValue:function(v)    {
        var lastPreparedToSentDId = Number(v) || 1; // '', null, undefined, 0 -> 1
        if(lastPreparedToSentDId > this.persistentData['nextDId'])
            this.persistentData['nextDId'] = lastPreparedToSentDId;
    },

    getTreeId:function() {return this.persistentData['treeId'] },

    copyConstructor_withoutSubnodes:function() { var r = new NodeGroup(); r.colapsed = false /*see comment*/; r.setCustomTitle('Tree'); return r; }, // support of root node drag & drop
                                                                                                                                                        // r.colapsed = true; - this is a quick fix for a problem of importing ~50000 nodes
                                                                                                                                                        // in case we insert them all in once, during masive DOM updates (and they meantime refired on every visible node insert,
                                                                                                                                                        // better code will do this after complete hierarchy insert, but better code cost more time)
                                                                                                                                                        // this crash not only target extension but also the whole chrome !!! (cool way to crash the chrome!!!) #awaytocrashthechromefromextension

    EOC:null
});

var NodeTabBase = NodeModelBase.extend({
    init:function(chromeTabObj, nodeTypesEnumType){
        this._super(nodeTypesEnumType, 'tabFrame');

        this.chromeTabObj = chromeTabObj;
        this.isLink = true;
        this.id = nodeTypesEnumType+chromeTabObj.id;

        this.hoveringMenuActions[hoveringMenuEditTitleAction.id] = hoveringMenuEditTitleAction;
    },

    copyConstructor_withoutSubnodes:function() { console.error("ERROR NodeTabBase::copyConstructor_withoutSubnodes() was not overriden");
                                                 return (new NodeTabBase(this.chromeTabObj, this.type)).copyMarksAndCollapsedFrom(this) },

    getIcon:function() { return (this.chromeTabObj.status === "loading") ? 'img/loading.gif' : makeFaviconUrl(this.chromeTabObj); },
    getIconForHtmlExport:function() { return this.chromeTabObj.favIconUrl; },
    getNodeText:function(isForEditPromt) { return this.chromeTabObj.title; /* if no customTitle in marks */ },
    getTooltipText:function() { return ""; /*todo if customTitle present in marks, then show there original title in tooltip */ },
    getHref:function() { return this.chromeTabObj.url; },

    getCustomTitle:function() { return this.marks.customTitle; },

    editTitle:function(portToViewThatRequestAction) {
        var _this = this;

        portToViewThatRequestAction.postMessage({command:"msg2view_activateNodeTabEditTextPrompt", defaultText:_this.getCustomTitle() || '#', targetNodeIdMVC:this.idMVC}); //i18n
         // On Ok this will result in request2bkg_onOkAfterSetNodeTabTextPrompt(msg,port); with msg.newText
    },

    setCustomTitle:function(customTitle) {
        var new_marks = this.getMarksClone();

        if(customTitle != new_marks.customTitle) {
            new_marks.customTitle = customTitle;
            //new_marks.customFavicon = "img/chrome-window-icon-gold.png";

            this.setNewMarksObject_notifyObserversAndPersitenceManager(new_marks);
        }
    },

    isSelectedTab:function() { return this.chromeTabObj.active; },

    updateChromeTabObj:function(chromeTabObj) {
// Закоменчено так как проблема пропадающих тайтлов при востановлении засейванного таба вызвана не этим методом.
// Код вообще годный, возможно есть смысл его раскоментить. Но юс кейсы когда бы он был реально нужен (приход пустого тайтла или урла) пока не найдены
//        // Если тайтла теперь нет или пустой ("", undefined, null) а был, то взять тот что был
//        if(!chromeTabObj.title && this.chromeTabObj && this.chromeTabObj.title) chromeTabObj.title = this.chromeTabObj.title;
//        // Если url теперь нет или пустой ("", undefined, null) а был, то взять тот что был
//        if(!chromeTabObj.url && this.chromeTabObj && this.chromeTabObj.url) chromeTabObj.url = this.chromeTabObj.url;

        //id ( integer )
        //index ( integer )
        //windowId ( integer )
        //openerTabId ( optional integer )
        //highlighted ( boolean )
        //active ( boolean )
        //pinned ( boolean )
        //url ( optional string )
        //title ( optional string )
        //favIconUrl ( optional string )
        //status ( optional string )
        //incognito ( boolean )
        //height
        //width

        // console.log(this.chromeTabObj, chromeTabObj)

        // TODO id & windowID тоже можно выкинуть из этого осписка, для save Tabs так точно
        // id вроде нужна для openTabs, и то, только на рестарте,
        // во время реасоциации, возможно реасоциацию можно/нужно сделать без этих id
        // а вот windowId нет, но она вроде юзается в алгоритме реасоциации открытых окон
        //
        // короче 'id', 'windowId' надо для open табов занести в runtimeAffectingProperties список и убрать из serializedProperties
        // счас я это сделать не могу из-за алгоритма реасоциаци на рестарте шо их юзает (который мог бы вполне без них обойтись).
        // также ищи по chromeTabObj.windowId - юзается во время атачей и в focusTab()
        //
        // Хотя Id вобщето ещё нужно кроме как для текущего алгоритма реасоциации ещё и если remote чтото будет посылать команды
        //
        // тут ещё такой момент, парметр в notifyTreeModelAboutUpdate_invalidateDids(isNodeContentUpdated_falseIfOnlyTheStructure)
        // возможно я таки хочу id передават ьна сервак. Но не в entry, чтоб не гнать при востановлении табов url-title по новой, а в структуре (просто дописывать в структуру для open табов)
        // аналогично для окон их id и возможно это касаетсяи tab.active win.focused флагов
        var serializedProperties       = [ 'id', 'windowId', 'url', 'title', 'favIconUrl' ]; // TODO !!! именно этим списком и должен руководствоваться serializeChromeTabObjMainPropertiesOnly. Тока надо чекнуть. Действительно ли там оно ни на что не влияет (обновляется при рестарте из runtime) то что мы отбросили
        var runtimeAffectingProperties = [ /*'id', 'windowId'*/ 'openerTabId', 'index', 'highlighted', 'active', 'pinned', /*'url', 'title', 'favIconUrl',*/ 'status'/*, 'incognito', 'height', 'width'*/ ];

        var isSerializedPropertiesSame = isPropertiesEqual(this.chromeTabObj, chromeTabObj,  serializedProperties);

        if( isSerializedPropertiesSame && isPropertiesEqual(this.chromeTabObj, chromeTabObj, runtimeAffectingProperties) )
            return;

        this.chromeTabObj = chromeTabObj;

        this.notifyObservers_onNodeUpdated();

        if(!isSerializedPropertiesSame) this.notifyTreeModelAboutUpdate_invalidateDids(true /*isNodeContentUpdated_falseIfOnlyTheStructure*/); // "updateChromeTabObj"
    },

    serializeChromeTabObjMainPropertiesOnly:function(chromeTabObj){
        var r = oneLevelObjectClone(chromeTabObj);

        if(r.status === "complete") delete r.status;
        if(!r.pinned)               delete r.pinned;
        if(!r.incognito)            delete r.incognito;

        if(!r.active)               delete r.active;

        if(!r.highlighted)          delete r.highlighted;

        delete r.selected; // Deprecated
        delete r.height;
        delete r.width;
        //TODO delete r.windowId; и другие, но надо чекнуть - может юзаются както.

        // if(r.active && r.highlighted && r.selected) { delete r.highlighted; delete r.selected; } // Закоменчено просто так, бо мне показалось что это чересчур

        delete r.index;    //? не уверен шо это хорошая идея
        // delete r.windowId; //Таки юзается в алгоритме реасоциации открытых окон, но saved табы эту проперть киляют чтоб не таскать с собой

        return r;
    },

    polymorficSerializeData:function() {
        var r = null;
        if(this.chromeTabObj) r = this.serializeChromeTabObjMainPropertiesOnly(this.chromeTabObj);
        return r;
    },

    setChromeTabObjActive:function(isActive) {
        if(this.chromeTabObj.active === isActive) return;// Filer not needed updates, its realy need, for example during setingActiveTab i call this method over all tabs in window

        var newChromeTabObj = oneLevelObjectClone(this.chromeTabObj); // Если изменим прямов chromeTabObj то updateChromeTabObj не сработает так как не увидет изменений.
        newChromeTabObj.active = isActive;

        this.updateChromeTabObj(newChromeTabObj); // Will notify view about update.
    },

    EOC:null
});

//var NodeTabCreationWait = NodeTabBase.extend({ // TODO_DONE убрать нахер этот класс? просто заменить на  NodeTabSaved с _f_isWhantRequestNewTabCreation = true флагом?
//    init:function(chromeTabObj) {
//        this._super(chromeTabObj, NodeTypesEnum.WAITINGTAB);
//        this._f_isWhantRequestNewTabCreation = true;
//    },
//
//    copyConstructor_withoutSubnodes:function() { return (new NodeTabCreationWait(this.chromeTabObj)).copyMarksAndCollapsedFrom(this); /*todo_done think - this will reset isWhantRequestNewTabCreation - is it ok?*/  },
//
//    onNodeDblClicked:function(){ /*todo_done force create? (if it is deffered). reset isWhantRequestNewTabCreation & rescan?*/ },
//
//    EOC:null
//});

// Этот узел может быть в двох состояниях - с присутствующим ID таба (только во время востановления сессии после рестарта плагина)
// и без см onAfterCrashRestorationDone (хотя вобщето это onAfterCrashRestorationDone уже нужно выкинуть)
var NodeTabSaved = NodeTabBase.extend({
    init:function(chromeTabObj) {
        this._super(chromeTabObj, NodeTypesEnum.SAVEDTAB);

        // Предотвращает спинер если создано по актив табу со статусом "loading"
        if(this.chromeTabObj/*can be undefined*/) this.chromeTabObj.status = "complete";

        // Просто чтоб не сериализировать лишнюю проперть
        if(this.chromeTabObj/*can be undefined*/) delete this.chromeTabObj.windowId;
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeTabSaved(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },

    //TODO Cut&Paste from tree.insertFindTabsOrganizerOrInsertSavedWindowAndRequestItsActivationIfInsertedHierarchyRequireThis, отличие тока вместе вставки
    ensureActivatedSavedOrAlreadyOpenTabsOrganizerIsPresentInPathToRoot:function() {
        var tabsOrganizer = this.parent.findFirstSavedOrOpenTabsOrganizerInPathToRoot();
        if(!tabsOrganizer) { // между SavedTab и корнем нет кандидатов на окно - надо создать
            // вставляем табс органайзер,
            tabsOrganizer = new NodeWindowSaved(); // Тут с такимже успехом можно бы было и NodeSavedWindow вставить с null chromeWindowObj, они тока тайтлами отличаются

            // в месте контакта с корнем нашего дерева
            var rootContactPoint = this.findPathStartNodeInRoot().insertParent(tabsOrganizer);
        }

        if( !(tabsOrganizer.isRelatedChromeWindowAlive) )
            tabsOrganizer._f_isWhantRequestNewWindowCreation = true; // На случай если tabsOrganizer это saved окно // TODO а он не может это понять по факту что у него NodeTabCreationWait или AttachWait появились?

        return tabsOrganizer; // Кстате ему сразу закажут создание окна по возврату и конверт его в ActiveWindow если он SavedWindow
    },

    onNodeDblClicked:function(treeModel, portToViewThatRequestAction){
        if(treeModel.executeWaitedChromeOperations /*это активная сесия*/)
        {
            var tabsOrganizer = this.ensureActivatedSavedOrAlreadyOpenTabsOrganizerIsPresentInPathToRoot();

            this.set_f_isWhantRequestNewTabCreation();
            this.chromeTabObj.active = true; // This will ensure that tab will be selected as active on restore.
                                             // This is only on manual restoring by double click - restoring window will use saved .active states in tabs
                                             // Yet they meantime was saved incorectly during window close-preserve anyway... but correctly during crash.
            treeModel.executeWaitedChromeOperations([tabsOrganizer]);
        }
        else // Это дерево записанной сесии, в нём невозможно создать активное окно
        {
            // TODO скопировать в активную сесию в корень последним элементом, и запросить оживление
            // (или послать такую месагу както иначе в backgroundPage - ведь мы тут не скорее всего будем в обычной странице - может через SharedWorkers, а может через contentScript & specialSharedDom )
        }
    },

    replaceSelfInTreeBy_mergeSubnodesAndMarks:function(replacer) {
        // Данный код при востановлении saved tabа, и замены его новым, делает так чтоб тайтл не пропадал на время loading, беря его прежнее значение
        if(replacer.chromeTabObj && !replacer.chromeTabObj.title && this.chromeTabObj.title)
            replacer.chromeTabObj.title =  this.chromeTabObj.title;

        return this._super(replacer); // Онaже и дёргнет observers чтоб сделать update view, для уже новой ноды
    },

    set_f_isWhantRequestNewTabCreation:function(dontRestoreIfWasSavedOnLastWinSave) {
        if(dontRestoreIfWasSavedOnLastWinSave && this.chromeTabObj['wasSavedOnLastWinSave'] === true)
            this._f_isWhantRequestNewTabCreation = false;
        else
            this._f_isWhantRequestNewTabCreation = true;
    },

    onAfterCrashRestorationDone:function() {
        delete this.chromeTabObj.id; delete this.chromeTabObj.windowId;
    },

    setTheWasSavedOnWinCloseFlagForAlternativeRestore:function() {
        if(this.chromeTabObj) this.chromeTabObj['wasSavedOnLastWinSave'] = true;
    },

    EOC:null
});

// chromeTabObj - {id:0, windowId:0, index:0, highlighted:false, selected:false, pinned:false, incognito:false, status:"complete/loading", favIconUrl:"", url:"", title:""}
var NodeTabActive = NodeTabBase.extend({
    init:function(chromeTabObj) {
        this._super(chromeTabObj, NodeTypesEnum.TAB);

        this.hoveringMenuActions[hoveringMenuCloseAction.id] = hoveringMenuCloseAction;

        this.setTheWasSavedOnWinCloseFlagForAlternativeRestore(); // To maintain this flag correctly if this node will be converted to saved because of crash
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeTabActive(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },

    cloneForCopyInActiveTree_withoutSubnodes:function() { return (new NodeTabSaved(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },

    isAnOpenTab:function() { return true },

    calculateIsProtectedFromGoneOnClose: NodeActiveBase_calculateIsProtectedFromGoneOnClose,

    onNodeDblClicked: NodeTabActive_focusThisTab_withoutScrollToView,

    onAlifeTabClosedByChrome_removeSelfAndPromoteSubnodesInPlace_orConvertToSavedIfMarksOrTextNodesPresent: function(closedWindowNode/*only provided if isWindowClosing == true*/) {
        if( this.calculateIsProtectedFromGoneOnClose() || /*Regular tab close (The window might be actualy closed, but it is the tab close button which was pressed, not the whole winclose btn*/
            (closedWindowNode && closedWindowNode.isAllOpenTabsProtectedFromGoneOnWindowClose()) /*Это закрытие окна*/)
        {
            this.replaceSelfInTreeBy_mergeSubnodesAndMarks( new NodeTabSaved(this.chromeTabObj) );
        }
        else
        {
            this.removeSelfAndPromoteSubnodesInPlace();
        }
    },

    requestСhromeToMoveTab: function(targetWinId, chromeTabIndex) {
        if(debugLogChromeOperations) console.log("NodeTabActive_requestСhromeToMoveTab, chromeTabIndex:", chromeTabIndex,"targetWinId:", targetWinId, "this.chromeTabObj.id:", this.chromeTabObj.id);

        var thisTabId = this.chromeTabObj.id;
    // if(это межоконный move)
    //     if(DETACH_WAITING_LIST.indexOf(thisTabId) < 0) DETACH_WAITING_LIST.push(thisTabId); // Запомним, так мы можем различать инициированные нами межоконные move, но нам это не надо

        chrome.tabs.move( thisTabId, {'windowId':targetWinId, 'index':chromeTabIndex}, function(movedChromeTabObj/*может и масив вернуть по доке*/) {
            // Подсмотрено в Tabs Manager Extention, фиксает отпинивание табов при move, а главно - gray page!
            // TODO может убрать? gray page уже не актуален, а пин статус мы всёравно не форсим
            chrome.tabs.update(thisTabId, {/*'pinned':movedTab.pinned не нравится мне это*/}, null);
        });
    },

    countSelf:function(statData) {
        statData['nodesCount']      = statData['nodesCount']      ? statData['nodesCount']+1      : 1;
        statData['activeTabsCount'] = statData['activeTabsCount'] ? statData['activeTabsCount']+1 : 1;
    },

    updateChromeTabObjOrRequestConvertToSavedIfNotInActiveList:function(chromeActiveWindowObjectsList, listOfTabNodesThatMustBeConvertedToSaved) {
        var ourChromeWindowObjInActiveList = findById(chromeActiveWindowObjectsList, this.chromeTabObj.windowId);
        if(ourChromeWindowObjInActiveList)
            var ourChromeTabObjInActiveList = findById(ourChromeWindowObjInActiveList.tabs, this.chromeTabObj.id);

        if(ourChromeTabObjInActiveList && ourChromeTabObjInActiveList.url == this.chromeTabObj.url) {
            ourChromeTabObjInActiveList.isUsedByNode = true;
            ourChromeWindowObjInActiveList.haveActiveTabNodesInTree = true;
            this.updateChromeTabObj(ourChromeTabObjInActiveList);
        } else {
            listOfTabNodesThatMustBeConvertedToSaved.push(this); // Не можем этого делать тут так как итератор по дереву этого не поддерживает
        }
    },

    performChromeRemove:function (protectFromDeleteOnChromeRemovedEvent) {
        if(protectFromDeleteOnChromeRemovedEvent) this.protectFromDeleteOnClose(false); // Этот флаг не скопируется при clone операции. что наверно и правильно

        chrome.tabs.remove(this.chromeTabObj.id);
    },

    supressUnexpectedIdErrorOnChromeRemovedEvent:function() {
        supressUnexpectedRemovedTabIdErrorFor(this.chromeTabObj.id);
    },

// все операции по подготовки места вставки вынесены в tree.moveCopyHierarchy и таким образом метод перестал отличатся от базового
//    moveToActiveTree:function(dropTarget) {
//// Теперь это делает moveCopyHierarchy
////        var tabsOrganizer = dropTarget.container.findFirstSavedOrOpenTabsOrganizerInPathToRoot(this.chromeTabObj.windowId); // Всегда должно срабатывать, ибо вставляется при moveCopyHierarchy
////        if( tabsOrganizer.isRelatedChromeWindowAlive && tabsOrganizer.chromeWindowObj.id === this.chromeTabObj.windowId /*мы в своём окне*/ )
////        {   // Это либо move внутри текущего окна, либо метод вызван в результате move узла нашего окна и оно уже перенесено
////            // в target, а метод просто продолжает вызыватся для всег его поднод и табов
////
////        }
////        else // Таржет окно ещё не создано, или это move между разными окнами
////        {
////
////        }
////        tabsOrganizer._f_isWhantRequestTabsMove = true; // Либо внутри одного окна, либо между окон, пофиг, операция таже //TODO можем мы это понять и попросить уровнем выше? там где moveCopyHierarchy ебошим
//
//        var r = this.copyConstructor_withoutSubnodes();
//        return {'container':dropTarget.container.insertSubnode(dropTarget.position, r), 'position':-1};
//    },

    setTheWasSavedOnWinCloseFlagForAlternativeRestore:function() {
        if(this.chromeTabObj) delete this.chromeTabObj['wasSavedOnLastWinSave'];
    },

    EOC:null
});

var NodeTabSavedAfterCrash = NodeTabSaved.extend({
    init:function(chromeTabObj) {
        this._super(chromeTabObj);
        this.savedAfterCrashCssClass = true;
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeTabSavedAfterCrash(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },

    EOC:null
});

//var NodeTabAttachWait = NodeTabActive.extend({
//    init:function(chromeTabObj) {
//        this._super(chromeTabObj);
//        this.titleCssClass = 'attachwaitingtab';
//    },
//
//    copyConstructor_withoutSubnodes:function() { return (new NodeTabAttachWait(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },
//
//    // То что, по сути, это, тотже самый NodeTabActive, обеспечивает этому объекту что он учавствует во всей логики в которой принимает участие и
//    // обычный, живой таб.
//    //       - удаление таба с таким id его найдёт и удалит даже если он в другом окне
//    //       - manual атач этого таба в то окно в чьём он дере (если заказанный не сработал, или не сделан) тоже  его найдёт
//    //       - активация таба произойдёт по дабл клику где бы он не был, если живой (а вот если не живой то халепа)
//    //       - алгоритм moveCopyHierarchy общий, и преобразует при перемещении в своё родное окно ноду правильно в обьчный NodeTabActive
//    // По сути это и есть обычный живой таб, только он находится в дереве не своего окна.
//
//    EOC:null
//});

////TODO_DONE NodeWindowCreationWait надо вообще выкинуть из проекта, он ничем не отличается от NodeSavedWindow по сути
//var NodeWindowCreationWait = NodeWindowSaved.extend({
//    init:function() {
//        this._super(null);
//    },
//
//    copyConstructor_withoutSubnodes:function() { return (new NodeWindowCreationWait()).copyMarksAndCollapsedFrom(this); },
//
//    getNodeText:function() {return 'Window waiting for a creation';}, //i18n
//
//    EOC:null
//});

var NodeNote = NodeModelBase.extend({
    init:function(persistentData) {
        this._super(NodeTypesEnum.TEXTNOTE);

        // TODO какаято лажа, это всё скут и пасчено один в один с SeparatorNode
        this.persistentData = {'note':"#"};

        if(persistentData)
            this.persistentData['note'] = persistentData['note'];

        if(this.persistentData['note'] === undefined) this.persistentData['note'] = '';

        this.hoveringMenuActions[hoveringMenuEditTitleAction.id] = hoveringMenuEditTitleAction;
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeNote(this.persistentData)).copyMarksAndCollapsedFrom(this) },

    getNodeText:function(isForEditPromt) { return this.persistentData['note']; },
  //getNodeContentCssClass:function()    { return this.separators[this.persistentData['separatorIndx']].css;  },

    onNodeDblClicked:function(treeModel, portToViewThatRequestAction){
        this.editTitle(portToViewThatRequestAction);
    },

    editTitle:function(portToViewThatRequestAction) {
        var _this = this;

        portToViewThatRequestAction.postMessage({command:"msg2view_activateNodeNoteEditTextPrompt", defaultText:this.getNodeText(true), targetNodeIdMVC:this.idMVC});
        // On Ok this will result in request2bkg_onOkAfterSetNodeNoteTextPrompt(msg,port); with msg.newText
    },

    setNodeTitle:function(newText) {
        this.persistentData['note'] = newText;

        this.notifyObservers_onNodeUpdated();
        this.notifyTreeModelAboutUpdate_invalidateDids(true); // "NodeNote::setNodeTitle"
    },

    EOC:null
});


// TODO Непонравилось мне сколько усилий и внимания пошло на то чтоб добавить персистенс и сериализацию
// - завели класс, обязательно с шаблонным C&P копи конструктором
// - проапдейтили некий кейс в неком switch для востановления по type (deserializeNode())
// - проапдейтили NodeTypesEnum
// - проапдейтили serialize() глобальный чтоб он подхватывал persistentData, причём он это делает НЕ ДЛЯ ВСЕХ НОД, и только ONE LEVEL CLONE!
// - проапдейтили тут себя чтоб
//     - хранить свой вид в persistentData
//     - Конструктор И КОПИ КОНСТРУКТОР чтоб принимали этот параметр
// - дописали this.notifyTreeModelAboutUpdate(); чтоб дёргался персистент менаджер на изменения
var NodeSeparatorLine = NodeModelBase.extend({
    init:function(persistentData) {
        this._super(NodeTypesEnum.SEPARATORLINE);

        this.persistentData = {'separatorIndx':undefined};

        if(persistentData)
            this.persistentData['separatorIndx'] = persistentData['separatorIndx'];

        if(this.persistentData['separatorIndx'] === undefined) this.persistentData['separatorIndx'] = 0;

        this.hoveringMenuActions[hoveringMenuEditTitleAction.id] = hoveringMenuEditTitleAction;
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeSeparatorLine(this.persistentData)).copyMarksAndCollapsedFrom(this) },

    separators:[{text:"------------------------------------------------------------------------------------------------------", css:"b"},
                {text:"==========================================================",                                             css:"a"},
                {text:"- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ", css:"c"}],

    getNodeText:function(isForEditPromt) { return this.separators[this.persistentData['separatorIndx']].text; },
    getNodeContentCssClass:function()    { return this.separators[this.persistentData['separatorIndx']].css;  },

    onNodeDblClicked:function(treeModel, portToViewThatRequestAction){
        this.editTitle(portToViewThatRequestAction);
    },

    editTitle:function(portToViewThatRequestAction) {
        var si = this.persistentData['separatorIndx'] + 1;
        if(si >= this.separators.length) si = 0;

        this.setSeparatorStyle(si);
    },

    setSeparatorStyle:function(separatorIndx) {
        if(this.persistentData['separatorIndx'] === separatorIndx) return;

        this.persistentData['separatorIndx'] = separatorIndx;

        this.notifyObservers_onNodeUpdated();
        this.notifyTreeModelAboutUpdate_invalidateDids(true); // "NodeSeparatorLine::setSeparatorStyle"
    },

    setSeparatorStyleFromText:function(innerHtmlTextOfExportedSeparator) {
        for(var i = 0; i < this.separators.length; i++)
            if(this.separators[i].text == innerHtmlTextOfExportedSeparator)
                this.setSeparatorStyle(i);
    },

    EOC:null
});

function posAndSizeToString(objWithPosAndSize) {
    return objWithPosAndSize['top'] + '_' + objWithPosAndSize['left'] + '_' + objWithPosAndSize['width'] + '_' + objWithPosAndSize['height'];
}

function strToPosAndSize(str, r) {
    var a =  str.split('_');
    if( !isNaN( Number(a[0]) )) r['top'] = Number(a[0]);
    if( !isNaN( Number(a[1]) )) r['left'] = Number(a[1]);
    if( !isNaN( Number(a[2]) )) r['width'] = Number(a[2]);
    if( !isNaN( Number(a[3]) )) r['height'] = Number(a[3]);
}


function copyPositionAndSize(sourceChromeWindowObj, targetChromeWindowObj) {
    if(sourceChromeWindowObj && targetChromeWindowObj) {
        if(sourceChromeWindowObj['top']) targetChromeWindowObj['top'] = sourceChromeWindowObj['top'];
        if(sourceChromeWindowObj['left']) targetChromeWindowObj['left'] = sourceChromeWindowObj['left'];
        if(sourceChromeWindowObj['width']) targetChromeWindowObj['width'] = sourceChromeWindowObj['width'];
        if(sourceChromeWindowObj['height']) targetChromeWindowObj['height'] = sourceChromeWindowObj['height'];
    }
}
// chromeWindowObj
//    id        ( integer ) The ID of the window. Window IDs are unique within a browser session.
//    focused   ( boolean ) Whether the window is currently the focused window.
//    top       ( integer ) The offset of the window from the top edge of the screen in pixels.
//    left      ( integer ) The offset of the window from the left edge of the screen in pixels.
//    width     ( integer ) The width of the window in pixels.
//    height    ( integer ) The height of the window in pixels.
//    tabs      ( optional array of Tab )  Array of Tab objects representing the current tabs in the window.
//    incognito ( boolean ) Whether the window is incognito.
//    type      ( enumerated string ["normal", "popup", "panel", "app"] )  The type of browser window this is.
//    state     ( enumerated string ["normal", "minimized", "maximized"] ) The state of this browser window.

var NodeWindowBase = NodeModelBase.extend({
    init:function(nodeTypesEnumType, chromeWindowObj) {
        this._super(nodeTypesEnumType, 'windowFrame');

        this.defaultFavicon = 'undefined';
        this.defaultTitle   = 'undefined';

        this.chromeWindowObj = chromeWindowObj;
        if(this.chromeWindowObj && this.chromeWindowObj['rect']) strToPosAndSize(this.chromeWindowObj['rect'], this.chromeWindowObj);

        this.isRelatedChromeWindowAlive = false;

        this.id = nodeTypesEnumType + (!!chromeWindowObj && !!chromeWindowObj.id ? chromeWindowObj.id : "");
        this.needFaviconAndTextHelperContainer = true;

        this.hoveringMenuActions[hoveringMenuEditTitleAction.id] = hoveringMenuEditTitleAction;
    },

    isSavedOrOpenTabsOrganizer:function() {
        return true;
    },

    getIcon:function()     {
        var r = this.marks.customFavicon;
        if(r == undefined) r = this.defaultFavicon;
        return r;
    },

    getNodeText:function(isForEditPrompt) {
        var r = this.marks.customTitle;
        if(r == undefined) r = this.defaultTitle;
        return r;
    },

    editTitle:function(portToViewThatRequestAction) {
        var _this = this;

        portToViewThatRequestAction.postMessage({command:"msg2view_activateNodeWindowEditTextPrompt", defaultText:this.getNodeText(true), targetNodeIdMVC:this.idMVC}); //i18n
        // On Ok this will result in request2bkg_onOkAfterSetNodeWindowTextPrompt(msg,port); with msg.newText
    },

    setCustomTitle:function(customTitle) {
        var new_marks = this.getMarksClone();

        if(customTitle == this.defaultTitle && new_marks.customTitle != undefined) {
            // Delete custom titles info
            delete new_marks.customTitle;
            delete new_marks.customFavicon;

            this.setNewMarksObject_notifyObserversAndPersitenceManager(new_marks);
        } else if(new_marks.customTitle != customTitle) {
            new_marks.customTitle = customTitle;
            if(this.type !== NodeTypesEnum.GROUP && this.marks.customFavicon == undefined)
                new_marks.customFavicon = "img/chrome-window-icon-gold.png";

            this.setNewMarksObject_notifyObserversAndPersitenceManager(new_marks);
        } else {
            // Небыло изменений
        }
    },

    updateChromeWindowObj:function(chromeWindowObj) {
        //id ( optional integer )                                                         - откидываем ?
        //focused ( boolean )                                                             - можно в кnot, хотя окно не дорогое к передаче, можно и тут оставить
        //top ( optional integer )                                                        - +
        //left ( optional integer )                                                       - +
        //width ( optional integer )                                                      - +
        //height ( optional integer )                                                     - +
        //tabs ( optional array of tabs.Tab )                                             - откидываем
        //incognito ( boolean )                                                           - +
        //type ( optional enum of "normal", "popup", "panel", or "app" )                  - можно в кnot, хотя окно не дорогое к передаче, можно и тут оставить
        //state ( optional enum of "normal", "minimized", "maximized", or "fullscreen" )  - ?
        //alwaysOnTop ( boolean )

        // TODO для SavedWin id откинуть! Для Open - возможно перенести в runtimeAffectingProperties
        var serializedProperties       = [ 'id', 'type', 'incognito', 'top', 'left', 'width', 'height' ]; // TODO !!! именно этим списком и должен руководствоваться serializeChromeWindowObjMainPropertiesOnly. Тока надо чекнуть. Действительно ли там оно ни на что не влияет (обновляется при рестарте из runtime) то что мы отбросили
        var runtimeAffectingProperties = [ 'focused' /* 'state', 'alwaysOnTop'*/ ]; // type - юзается для формирования Title окна - Window (popup)

        var isSerializedPropertiesSame = isPropertiesEqual( this.chromeWindowObj, chromeWindowObj, serializedProperties );

        if( isSerializedPropertiesSame && isPropertiesEqual(this.chromeWindowObj, chromeWindowObj, runtimeAffectingProperties) )
            return;

        this.chromeWindowObj = chromeWindowObj;

        this.notifyObservers_onNodeUpdated();

        if(!isSerializedPropertiesSame) this.notifyTreeModelAboutUpdate_invalidateDids(true); // "NodeWindowBase::updateChromeWindowObj"
    },

    serializeChromeWindowObjMainPropertiesOnly:function(chromeWindowObj) {
        var r = oneLevelObjectClone(chromeWindowObj);

     // if(r.type === "normal")  delete r.type; Это поле используется при назначении Default title
        if(r.state === "normal") delete r.state; // Не использую вроде
        if(!r.incognito)         delete r.incognito;
        if(!r.alwaysOnTop)       delete r.alwaysOnTop;
        if(!r.focused)           delete r.focused;

        r['rect'] = posAndSizeToString(r);
        delete r['top'];
        delete r['left'];
        delete r['width'];
        delete r['height'];

        delete r.tabs;

        return r;
    },

    polymorficSerializeData:function() {
        var r = null;
        if(this.chromeWindowObj) r = this.serializeChromeWindowObjMainPropertiesOnly(this.chromeWindowObj);
        return r;
    },

    fillCreatePropertiesByPositionAndSize:function(createProperties) {
        if( this.chromeWindowObj )
            copyPositionAndSize(this.chromeWindowObj, createProperties);
    },

    findTabWithActiveRequestForCreation:function () {
        return this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees(function(node){return !!node._f_isWhantRequestNewTabCreation; });
    },

    findTabWithActiveRequestForMove:function () {
        var _this = this;
        if(this._f_isWhantRequestTabsMove)
            return this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees(function(node){return node.type === NodeTypesEnum.TAB && node.chromeTabObj.windowId !== _this.chromeWindowObj.id /*Open Tab, but not from this window*/; });

        return null
    },

    findAlifeTabInOwnTabsById:function (tabid) {
        return this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees(function(node){return node.type === NodeTypesEnum.TAB && node.chromeTabObj.id === tabid});
    },

    findNodeInWindowSubtree_skipOnOthereWindowsSubtrees:function (isSearchedNodeDetector) {
        var r = null;
        forEachNodeInTree_skipSubnodesTraversalOnFalse__noChangesInTree( this.subnodes,
                            function(node) {
                                if(r) return false; // Node already finded, not need to call isSearchedNodeDetector() anymore (and actualy some callback expect not to be called when they already find something)
                                if(node.isSavedOrOpenTabsOrganizer())  return false; // Will skip on othere windows subtrees
                                if(isSearchedNodeDetector(node)) r = node;
                                return !r ? true : false; // !r -> then continue till not find something
                           } );
        return r;
    },

    moveToTheEndOfTree:function () {
        var root = this.findPathStartNodeInRoot().parent;
        return root.insertAsLastSubnode( this.removeOwnTreeFromParent() ); // cannot chain, as removeOwnTreeFromParent() will be called first
    },

    EOC:null
});

// Этот узел может быть в двох состояниях - с присутствующим ID окна (только во время востановления сессии после рестарта плагина)
// и без см onAfterCrashRestorationDone (хотя вобщето это onAfterCrashRestorationDone уже нужно выкинуть)
var NodeWindowSaved = NodeWindowBase.extend({
    init:function(chromeWindowObj, customType) { // customType заведён для NodeGroup
        // Fix for incorectly closured pre v0.4.34 builds
        if(chromeWindowObj) { // chromeWindowObj can be null there!! it is always present at list as dummy in this after super. but this is not this.chromeWindowObj !!!
            // TODO а херо это не в marks?! Тоже самое насчёт getNodeText()
            if     (chromeWindowObj['sa']) chromeWindowObj['crashDetectedDate'] = chromeWindowObj['sa']; // v33 so use it first, ignore all othere is present
            else if(chromeWindowObj['oa']) chromeWindowObj['crashDetectedDate'] = chromeWindowObj['oa'];
            else if(chromeWindowObj['la']) chromeWindowObj['crashDetectedDate'] = chromeWindowObj['la'];

            if     (chromeWindowObj['ta']) chromeWindowObj['closeDate'] = chromeWindowObj['ta']; // v33 so use it first, ignore all othere is present
            else if(chromeWindowObj['pa']) chromeWindowObj['closeDate'] = chromeWindowObj['pa'];
            else if(chromeWindowObj['ma']) chromeWindowObj['closeDate'] = chromeWindowObj['ma'];
            // note that i use there chromeWindowObj without this!
        }

        this._super( customType || NodeTypesEnum.SAVEDWINDOW, chromeWindowObj || {/*DUMMY*/}); // DUMMY chromeWindowObj предназначен чтоб не крешало например такое: if(this.chromeWindowObj.closedDuringCloseAllDate) и другие доступы к пропертям

        this.defaultTitle   = "Window"; //i18n
        this.defaultFavicon = "img/chrome-window-icon-gray.png";
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeWindowSaved(this.chromeWindowObj, this.type)).copyMarksAndCollapsedFrom(this) },

    getNodeText:function(isForEditPrompt) {
        var r = this._super(isForEditPrompt);

        if(!isForEditPrompt) {
            // TODO а херо это не в marks?!
            if(this.chromeWindowObj['closeDate'])
                r += " (closed " + new Date(this.chromeWindowObj['closeDate']).toDateString() + ")"; //i18n // Не юзаю toLocaleDateString() потому как само слово closed на англиском
            if(this.chromeWindowObj['crashDetectedDate'])
                r += " (crashed " + new Date(this.chromeWindowObj['crashDetectedDate']).toDateString() + ")"; //i18n
        }

        return r;
    },

    onNodeDblClicked:function(treeModel, portToViewThatRequestAction, isAlternativeRestore){
        if(treeModel.executeWaitedChromeOperations /*это активная сесия*/)
        {
            this._f_isWhantRequestNewWindowCreation = true; // Q: а он не может это понять по факту что у него NodeTabCreationWait или AttachWait появились? -
                                                            // A: НЕ МОЖЕТ!!! к примеру если это просто saved окно без субнод сейвед табов а тока с другими сейвед окнами - частая ситуация!

            var isSomeTabsScheduledToBeCreated = false;
            this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees( function(node) {
                if(node.set_f_isWhantRequestNewTabCreation) { // TODO Фактически это проверка if(node instanceof NodeTabSaved)
                    node.set_f_isWhantRequestNewTabCreation(isAlternativeRestore/*dontRestoreTabsWhichWasSavedOnLastWinSave*/); //note that "node" object will be removed of the tree hierarchy, after that method call
                    isSomeTabsScheduledToBeCreated = true;
                }

                return false; // Continue for all subnodes
            });

            if(!isSomeTabsScheduledToBeCreated)
                this._f_isWindowScheduledToActivationWithoutAnyTabs = true; // true если это пустой узел без сейвед табов (иначе undefined, как и в случае move операции),
                                                                            // в этом случае временный обект таб который всегда создайтся при создании нового окна не будет удалён,
                                                                            // так как нет таба оставить вместо него, и его надо оставить в дереве, а не прятать превентивно
                                                                            // как мы это делаем к примеру в случае move TabActive на корень или в SavedWin

            treeModel.executeWaitedChromeOperations([this]);
        }
        else // Это дерево записанной сесии, в нём невозможно создать активное окно
        {
            // TODO скопировать в активную сесию в корень последним элементом, и запросить оживление
            // (или послать такую месагу както иначе в backgroundPage - ведь мы тут не скорее всего будем в обычной странице - может через SharedWorkers, а может через contentScript & specialSharedDom )
        }
    },

    onAfterCrashRestorationDone:function() {
        if(!!this.chromeWindowObj.id) delete this.chromeWindowObj.id;
    },

    EOC:null
});

// Будет востановлено просто как Saved при deserialize
var NodeWindowSavedOnCloseAll = NodeWindowSaved.extend({
    init:function(chromeWindowObj) {
        chromeWindowObj['closeDate'] = Date.now();
        this._super(chromeWindowObj);
        this.additionalTextCss = "recentlySavedOnCloseAll";
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeWindowSavedOnCloseAll(this.chromeWindowObj)).copyMarksAndCollapsedFrom(this) },

    EOC:null
});

// Будет востановлено просто как Saved при deserialize
var NodeWindowSavedAfterCrash = NodeWindowSaved.extend({
    init:function(chromeWindowObj) {
        chromeWindowObj['crashDetectedDate'] = Date.now();
        this._super(chromeWindowObj);
        this.additionalTextCss = "recentlyCrashed";
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeWindowSavedAfterCrash(this.chromeWindowObj)).copyMarksAndCollapsedFrom(this) },

    EOC:null
});

var NodeGroup = NodeWindowSaved.extend({
    init:function() {
        this._super(null, NodeTypesEnum.GROUP);

        this.defaultTitle   = "Group"; //i18n
        this.defaultFavicon = "img/group-icon.png";
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeGroup()).copyMarksAndCollapsedFrom(this) },

    replaceSelfInTreeBy_mergeSubnodesAndMarks:function(replacer) {
        // Данный код при создании из группы окна подставляет ему прежнии Icon и Text, навсегда
        this.marks.customFavicon = this.getIcon();
        this.marks.customTitle   = this.getNodeText();
        return this._super(replacer); // Онaже и дёргнет observers чтоб сделать update view, для уже новой ноды
    },

    EOC:null
});

var NodeWindowActive = NodeWindowBase.extend({
    init:function(chromeWindowObj) {
        this._super(NodeTypesEnum.WINDOW, chromeWindowObj);

        this.defaultTitle   = "Window" + (this.chromeWindowObj.type === "normal" ? "" : " ("+this.chromeWindowObj.type+")"); //i18n
        this.defaultFavicon = "img/chrome-window-icon-blue.png";

        this.hoveringMenuActions[hoveringMenuCloseAction.id] = hoveringMenuCloseAction;

        this.isRelatedChromeWindowAlive = true;

        // this._f_lastKnownActiveTabId_zombieTabWorkaround = 0; // Не должно сливаться в базу или приводить к перерендерингу view
    },

    copyConstructor_withoutSubnodes:function() { return (new NodeWindowActive(this.chromeWindowObj)).copyMarksAndCollapsedFrom(this) },

    cloneForCopyInActiveTree_withoutSubnodes:function() { return (new NodeWindowSaved(this.chromeTabObj)).copyMarksAndCollapsedFrom(this) },

    calculateIsProtectedFromGoneOnClose: NodeActiveBase_calculateIsProtectedFromGoneOnClose,

    isAllOpenTabsProtectedFromGoneOnWindowClose:function() {
        var r =  !this.isOnRootSubnodesLevel() || this.calculateIsProtectedFromGoneOnClose();

        if(r) return true;

        forEachNodeInTree_skipSubnodesTraversalOnFalse__noChangesInTree(this.subnodes, function(nodeModel) {
            if( ((nodeModel.type !== NodeTypesEnum.TAB) || nodeModel.isCustomMarksPresent()) )
                r = true; // Нельзя просто присваивать r!!! так как после одного true этот метод может выполнится ещё раз и проверка вернёт false
            return !r; //continue if r == false

        });

        return r;
    },

    isAnOpenWindow:function() {
        return true;
    },

    isSavedOrOpenTabsOrganizer:function(forTabInChromeWindowId) {
        if(this.chromeWindowObj && this.chromeWindowObj.type && this.chromeWindowObj.type === "popup" && this.chromeWindowObj.id !== forTabInChromeWindowId/*для своих табов мы таки органайзер!*/)
            return false; // To prevent othere tabs moves or restoring in active popup window
                          // Кстате этого "this.isTabsOrganizer = false;" не стоит делать в NodeWindowBase
                          // Так как в этом случае NodeWindowSaved с таким окном не будет таб органайзером и при востановлении дабл кликом
                          // оно никогда не востанавливает себя а создаёт для себя дополнительное окно уровнем ниже
                          // В принципе это окей еслиб нода выглядела както иначе, но она остаётся выглядеть как типичное Saved окно,
                          // а таковым не будет являеться на самом деле (так как не будет являться TabsOrganizer) и это баг очевидно будет.

        return true;
    },

    isFocusedWindow:function() { return this.chromeWindowObj.focused; },

    setChromeWindowObjFocused:function(newFocusedState) {
        if(newFocusedState === this.chromeWindowObj.focused) return;

        var newChromeWindowObj = oneLevelObjectClone(this.chromeWindowObj); // Если изменим прямов chromeWindowObj то updateChromeWindowObj не сработает так как не увидет изменений.
        newChromeWindowObj.focused = newFocusedState;

        this.updateChromeWindowObj(newChromeWindowObj);

    },

    onNodeDblClicked: NodeWindowActive_focusThisWindow_withoutScrollToView,

    countSelf:function(statData) {
        statData['nodesCount']      = statData['nodesCount']      ? statData['nodesCount']+1      : 1;
        statData['activeWinsCount'] = statData['activeWinsCount'] ? statData['activeWinsCount']+1 : 1;
    },

    performChromeRemove:function (protectFromDeleteOnChromeRemovedEvent, storeCloseTime) {
        if(protectFromDeleteOnChromeRemovedEvent) {
            this.protectFromDeleteOnClose(storeCloseTime); // Этот флаг не скопируется при clone операции. что наверно и правильно

            this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees( function(node) {
                node.protectFromDeleteOnClose(storeCloseTime);
                node.setTheWasSavedOnWinCloseFlagForAlternativeRestore();
                return false; // Continue for all subnodes
            });
        }

        var this_chromeWindowObj = this.chromeWindowObj;
        if(true/*FASTFORFARDv3 localStorage['openSavedWindowsInOriginalPos']*/)
            chrome.windows.get(this_chromeWindowObj.id, {}, function(chromeWindowObj) {
                copyPositionAndSize(chromeWindowObj, this_chromeWindowObj); // Update position before save
                chrome.windows.remove(this_chromeWindowObj.id);
            });
        else
            chrome.windows.remove(this_chromeWindowObj.id);
    },

//        tree.findAllDescendantsForNode = function(parentNode) {
//            var r = [];
//            if(parentNode)
//                forEachNodeInTree(parentNode.subnodes, function(node) { r.push(node); });
//            return r;
//        };

    // return true from iterator to stop iteration, this function will return tab on which they stoped in this case, or null if they never was stope
    iterateOverOurOwnOpenTabNodes: function(f) {
        var tabIndexInHierarchy = 0;
        return this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees( function(node){
            if(node.type === NodeTypesEnum.TAB) return f(node, tabIndexInHierarchy++);
            return false; // continue search
        });
    },

    getWindowTabIndexOfOpenTabIftheyPlacedDirectlyAfterGivenNode:function(nodeModel) {
        var tabIndexInHierarchy = 0;
        this.findNodeInWindowSubtree_skipOnOthereWindowsSubtrees( function(node){
            if(node.type === NodeTypesEnum.TAB) tabIndexInHierarchy++; // Count all open tabs before we reach needed position
            if(nodeModel === node) return true; // Stop search

            return false; // continue search
        });

        return tabIndexInHierarchy;
    },

    setActiveTab: function(tabId) {
        var _this = this;
        // ZOMBI TAB WORKAROUND var isNewActiveTabFound = false;
        // ZOMBI TAB WORKAROUND var isLastKnownActiveTabStillPresentInHierarchyAsAlive = false;
        this.iterateOverOurOwnOpenTabNodes( function(openTabNode) {
            openTabNode.setChromeTabObjActive(openTabNode.chromeTabObj.id === tabId); // Надо бы было бы тут на самом деле вызвать chrome.tabs.update чтоб получить точное значение пропертей от хрома, но я не хочу тут всяких асинхронных вызовов

            // ZOMBI TAB WORKAROUND if(openTabNode.chromeTabObj.id === tabId) isNewActiveTabFound = true;
            // ZOMBI TAB WORKAROUND if(openTabNode.chromeTabObj.id === _this._f_lastKnownActiveTabId_zombieTabWorkaround) isLastKnownActiveTabStillPresentInHierarchyAsAlive = true;

            return false; // Iterate through all own tabs
        });

        // ZOMBI TAB WORKAROUND
        // ВЫКИНУТЬ НАХРЕН - УЖЕ НЕ НУЖНО ЭТО
        // Вынести воркэраунд за дерево! В background page. Дерево не должно принимать никаких решений на основе динамичной инфы запрошенной из chrome.
        // (хотя можно сразу бы было передать chromeWindowObj.tabs сюда - тогда да, можно бы было это разрешить.

        // воркераунд для zombiTabs кейса который появился в Chrome v26
        // стоит учесть что просто реплей на дереве которое востановлено но в новой сессии, или вообще вне контекста extensions уже и не сработает
        // если при этом происходил вот этот workaround
        // Это вообще касается любых методов которые дополнительно лазят в chrome обект к рантайм колекциям уникальным для сесси
        //        if(!isNewActiveTabFound) {
        //            if(isLastKnownActiveTabStillPresentInHierarchyAsAlive) {
        //                chrome.windows.get(_this.chromeWindowObj.id, {'populate':true}, function(chromeWindowObj){
        //                    // Ищем среди реально живых таб с id который мы видели как актив в этом окне прошлый раз (и этот таб таки есть в иерархии сейчас => onRemoved небыло)
        //                    var lastKnownActiveTabChromeTabObj = findById(chromeWindowObj.tabs, _this._f_lastKnownActiveTabId_zombieTabWorkaround);
        //                    var currentActiveTabChromeTabObj   = findById(chromeWindowObj.tabs, tabId);
        //
        //                    if(!lastKnownActiveTabChromeTabObj && currentActiveTabChromeTabObj) {
        //                        // Но в этом окне в хроме она таки небыла найдена (хотя есть в иерархии)
        //                        console.log("CERROR NOT SAT ZOMBITABATTACK", _this._f_lastKnownActiveTabId_zombieTabWorkaround,'->',tabId, _this.chromeWindowObj.id);
        //                        // getActiveSessionTreeModel()
        //                        _this.getTreeModelFromRoot().updateZombiTab(_this._f_lastKnownActiveTabId_zombieTabWorkaround, currentActiveTabChromeTabObj, _this.chromeWindowObj.id);
        //
        //                    } else {
        //                        console.error("ERROR NOT ! SAT 1", tabId, _this.chromeWindowObj.id); // TODO FULLRESCAN, НО это может происходит когда мы трешнули окно в дереве!! Какбы его назад не влупить
        //                    }
        //                });
        //            } else {
        //                console.error("ERROR NOT ! SAT 2", tabId, _this.chromeWindowObj.id); // TODO FULLRESCAN, НО это может происходит когда мы трешнули окно в дереве!! Какбы его назад не влупить
        //            }
        //
        //        } else {
        //            this._f_lastKnownActiveTabId_zombieTabWorkaround = tabId;
        //        }

    },

    reorderAndPerformReattachsAllTabsInChromeWindowAcordingToOrderInTabsOutlinerHierarchy: function() {
        var targetWinId = this.chromeWindowObj.id;

        this.iterateOverOurOwnOpenTabNodes( function(openTabNode, tabIndexInHierarchy) {
            openTabNode.requestСhromeToMoveTab(targetWinId, tabIndexInHierarchy);

            return false; // Iterate through all own tabs
        });
    },

    findAlifeTabInOwnTabsByIndex: function(chromeTabIndexInWindow) {
        return this.iterateOverOurOwnOpenTabNodes( function(openTabNode, tabIndexInHierarchy) {
            if(tabIndexInHierarchy === chromeTabIndexInWindow) return true;

            return false; // continue search
        });
    },

    onAlifeWindowClosedByChrome_removeSelfAndPromoteSubnodesInPlace_orConvertToSavedIfMarksOrTextNodesPresent: function () {
        if( this.subnodes.length > 0 || this.calculateIsProtectedFromGoneOnClose() )
        {
            this.replaceSelfInTreeBy_mergeSubnodesAndMarks( this._f_storeCloseTimeOnClose ? new NodeWindowSavedOnCloseAll(this.chromeWindowObj) : new NodeWindowSaved(this.chromeWindowObj) );
        }
        else
        {
            this.removeOwnTreeFromParent();
        }
    },

    supressUnexpectedIdErrorOnChromeRemovedEvent:function() {
        supressUnexpectedRemovedWindowIdErrorFor(this.chromeWindowObj.id);
    },

    fromChrome_onTabCreated:function (chromeTabObj, tryRelateNewTabToOpener /*TreeStyleTab*/) {
        var newTabNode = new NodeTabActive(chromeTabObj);

        var applyTreeStyleTabAlgorith = chromeTabObj.openerTabId && !isNewTab(chromeTabObj) && tryRelateNewTabToOpener; // NewTab пропускаем чтоб из них не образовывалась лесенка

        var openerTabNode = applyTreeStyleTabAlgorith ? this.findAlifeTabInOwnTabsById(chromeTabObj.openerTabId) : null;

        if(applyTreeStyleTabAlgorith && !openerTabNode)
            console.error("ERROR############# onTabCreated # Cannot find openerTabNode in window hierarchy. windowId: ",this.chromeWindowObj.id, "openerTabId:",chromeTabObj.openerTabId); // TODO FULLRESCAN

        // Разрешаем релейт на tabOpener только если это не конфликтует с индексом!!!
        // (опенер мог быть перемещён юзером и всть в Index позицию уже будет нельзя, возникнит рассинхронизация порядка табов в дереве и окне если позволить это)
        var indexInOpenerDirectSubnodes = -1;
        if(openerTabNode) {
            if(openerTabNode.subnodes.length === 0) {
                // раньше тут было просто indexInOpenerDirectSubnodes = 0; но это не правильно, надо проверять действительно ли мы так можем вставить таб не
                // рассинхронизировав порядок в дереве и табах
                // простой пример - если юзер все ноды руками отрелейтил в дереве, опенер остался без нод, но оставил порядок, следующая нода откроется таки после них, а не перед ними
                var chromeWindowTabIndexIfInsertedAfter = this.getWindowTabIndexOfOpenTabIftheyPlacedDirectlyAfterGivenNode(openerTabNode);
                if(chromeWindowTabIndexIfInsertedAfter === chromeTabObj.index) indexInOpenerDirectSubnodes = 0;
            } else {
                // Проверяем позиции вставки в первые субноды опенера, начиная с самой последней и к первой
                // Первую которая нам подойдёт возвращаем как точку вставки
                // Это надо для случаев когда юзер руками поставил несколько последних субнод опенеру левые опен табы (которые небыли оригинально его детьми)
                // в этом случае хром будет открывать новые табы перед ними, тоесть мы не можем тупо всегда в конец субнодов опенеру кидать новый таб
                for(var subnodesIndex = openerTabNode.subnodes.length-1; subnodesIndex >= 0; subnodesIndex--) {
                    var chromeWindowTabIndexIfInsertedAfter = this.getWindowTabIndexOfOpenTabIftheyPlacedDirectlyAfterGivenNode(openerTabNode.subnodes[subnodesIndex]);

                    if(chromeWindowTabIndexIfInsertedAfter === chromeTabObj.index) {
                        indexInOpenerDirectSubnodes = subnodesIndex+1;
                        break;
                    }
                }
            }
        }

        if(openerTabNode && indexInOpenerDirectSubnodes >= 0) {
            openerTabNode.insertSubnode(indexInOpenerDirectSubnodes, newTabNode);
        } else { // Просто вставляем узел так чтоб windowIndex соответствовал
            var nodeToShiftDown = this.findAlifeTabInOwnTabsByIndex(chromeTabObj.index);

            if(!nodeToShiftDown) // Первый таб
                this.insertAsLastSubnode(newTabNode); // В конец её списка
            else
                nodeToShiftDown.insertAsPreviousSibling(newTabNode);
        }

        this.fromChrome_onAlifeTabAppearInHierarchy();

        return newTabNode;
    },

    fromChrome_onAlifeTabAppearInHierarchy:function () {
         if(this.deleteEmptyTabIdAfterAnyMoveTabOrCreateTabSucceded !== undefined) // Can be 0, but very unlikely...
         {
             // rev 153 in main
             // chrome_closeEmptyTabInWindow(this.deleteEmptyTabIdAfterAnyMoveTabOrCreateTabSucceded, this.chromeWindowObj.id);
             chrome.tabs.remove(this.deleteEmptyTabIdAfterAnyMoveTabOrCreateTabSucceded);
             delete this.deleteEmptyTabIdAfterAnyMoveTabOrCreateTabSucceded;
         }
    },

    updateChromeWindowObjOrConvertToSavedIfNoActiveTabNodesCreated:function(chromeActiveWindowObjectsList, listOfWindowNodesThatMustBeConvertedToSaved) {
        var ourChromeWindowObjInActiveList = findById(chromeActiveWindowObjectsList, this.chromeWindowObj.id);

        if( ourChromeWindowObjInActiveList && !!ourChromeWindowObjInActiveList.haveActiveTabNodesInTree ) { // заполняется в NodeActiveTab во время сверки
            ourChromeWindowObjInActiveList.isUsedByNode = true;
            this.updateChromeWindowObj(ourChromeWindowObjInActiveList); // Не нужно, но на всякий случай, может тайтл сменился или selection или положение/размер
        } else {
            listOfWindowNodesThatMustBeConvertedToSaved.push(this);
        }

        return null;
    },

    EOC:null
});

// =====================================================================================================================
function NodeActiveBase_calculateIsProtectedFromGoneOnClose() {
    return this.isProtectedFromGoneOnCloseCache = !!this._f_convertToSavedOnClose || this.isCustomMarksPresent() || this.isSomethingExeptUnmarkedActiveTabPresentInDirectSubnodes();
}


function ActiveTree_executeWaitedChromeOperations(nodesTree) {

// TODO Подумать над usecase:
//        у юзера есть не созданные ещё окна из-за медленной востановления сессии, а он уже начал чота мовать табы на корень с целью создания новых окон.
//        Уже живые табы - такие окна должны создаваться в первую очредь. Тоесть окна для мувнутых табов должны создаваться сразу, без того чтоб их создание
//        откладывалось из-за того что очередь переполнена
//
//
    var _this_activetree = this;

    forEachNodeInTree_noChangesInTree(nodesTree, function(node) {

        // ждущие создания окна создаём
        if(Boolean(node.isSavedOrOpenTabsOrganizer()) && !Boolean(node.isRelatedChromeWindowAlive) && Boolean(node._f_isWhantRequestNewWindowCreation))
        {
            var waitingWin = node;
            waitingWin._f_isWhantRequestNewWindowCreation = false;

            _this_activetree.requestNewAlifeWindowForNode(waitingWin); // Мы вернёмся сюда опять, в ActiveTree_executeWaitedChromeOperations, из калбека, после создания окна - чтоб мовнуть или создать табы
        }

        // окнам имеющие табы желающие мувнуться выполняем chrome.tabs.move()
        if(Boolean(node.isSavedOrOpenTabsOrganizer()) && Boolean(node.isRelatedChromeWindowAlive) && Boolean(node._f_isWhantRequestTabsMove))
        {
            var targetWin = node;
            targetWin._f_isWhantRequestTabsMove = false;

            // Заказываем хрому move ВСЕХ табов в окне, начиная с индекса 0 (пропуская вложенные окна)
            // О конвертинге табов (waited в regular) позаботится fromChrome_onAttach
            targetWin.reorderAndPerformReattachsAllTabsInChromeWindowAcordingToOrderInTabsOutlinerHierarchy();
        }

        // Табы заказавшие inplacе создание в уже живом таб органайзере - заказываем их у хрома
        var relatedTabOrganizer;
        if(    Boolean(node._f_isWhantRequestNewTabCreation)
            && (relatedTabOrganizer = node.findFirstSavedOrOpenTabsOrganizerInPathToRoot())
            && relatedTabOrganizer.isRelatedChromeWindowAlive )
        {
            var waitingTab = node;

            waitingTab._f_isWhantRequestNewTabCreation = false;
            _this_activetree.requestNewAlifeTabForNode(relatedTabOrganizer, waitingTab);
        }

    });
}
// acording to rev153 in main
//function chrome_closeEmptyTabInWindow(tabId, windowId) {
//    chrome.tabs.get(tabId, function(tabToDelete_chromeTabObj) {
//        if(tabToDelete_chromeTabObj.url == "chrome://newtab/" && tabToDelete_chromeTabObj.windowId == windowId)
//            chrome.tabs.remove(tabToDelete_chromeTabObj.id);
//    });
//}

function chrome_deleteLastEmptyTabInWindow(windowId) {
    chrome.tabs.getAllInWindow(windowId, function(tabsList) {
        if(tabsList.length > 0)
        {
            var tabToDelete = tabsList[tabsList.length-1];
            if(tabToDelete.url === "chrome://newtab/")
                chrome.tabs.remove(tabToDelete.id);
        }
    });
}

function chrome_openUrlInNewWindow(url) {
var createData =  {
        'url': url,
        'type': 'normal', //TODO - try 'popup', 'panel', google "The 'panel' type creates a popup unless the '--enable-panels' flag is set."
        'left':450, // 0 is not work for unknown reasons
        'top':1, // 0 is not work for unknown reasons
        'width':900,
        'focused':true
    };
    chrome.windows.create(createData);
}

// ---------------------------------------------------------------------

var hoveringMenuCloseAction     = { 'id' : "closeAction"  ,    'performAction' : CloseAction_performAction  };
var hoveringMenuDeleteAction    = { 'id' : "deleteAction" ,    'performAction' : DeleteAction_performAction };
var hoveringMenuEditTitleAction = { 'id' : "editTitleAction" , 'performAction' : EditTitle_performAction };
var hoveringMenuSetCursorAction = { 'id' : "setCursorAction" , 'performAction' : SetCursor_performAction };


function performClose(node, protectFromDeleteOnChromeRemovedEvent) {
    node.performChromeRemove(protectFromDeleteOnChromeRemovedEvent);
    if(node.colapsed) { // Если нода свёрнуто то делаем эту операцию для всех подузлов
        forEachNodeInTree_noChangesInTree(node.subnodes, function(node){
            node.performChromeRemove(protectFromDeleteOnChromeRemovedEvent);
        });
    }
}

function CloseAction_performAction(node, portToViewThatRequestAction) {
    performClose(node, true); // В случае колaпснутого узла выполнить close для всех подузлов
}

function DeleteAction_performAction(node, portToViewThatRequestAction) {
    performClose(node, false); // В случае колaпснутого узла выполнить close без protectFromDelete для всех подузлов

    var deletedHierarchy;

    if(node.colapsed) {
        deletedHierarchy = node.deleteHierarchy_MoveCursor();
    } else {
        deletedHierarchy = node.removeSelfAndPromoteSubnodesInPlace();
    }

    // Supress error messages about not found in tree chromeRemoved tabs & windows (and, in future, windows rescan) for removed nodes
    deletedHierarchy.supressUnexpectedIdErrorOnChromeRemovedEvent();
    forEachNodeInTree_noChangesInTree(deletedHierarchy.subnodes, function(node){
        node.supressUnexpectedIdErrorOnChromeRemovedEvent();
    });
}

function EditTitle_performAction(node, portToViewThatRequestAction) {
    node.editTitle(portToViewThatRequestAction);
}

function SetCursor_performAction(node, portToViewThatRequestAction) {
    requestCaller_setCursorToNodeOrToFirstCollapsedParent(portToViewThatRequestAction, node, false);
    //node.setCursorHereOrToFirstCollapsedParent(treeView.globalViewId_ICursorOwner);
}

// =====================================================================================================================
// Поддержка драг кнопок in Main toolbar
// =====================================================================================================================

// Минимальный интерфейс для ActionLinkModelBase который позволит ей участвовать в логике дропа:
// subnodes - moveCopyHierarchy итерирует по субнодах и для них тоже вызывает дроп
// moveToActiveTree(dropTarget) - это непосредственно момент дропа будет, для обычных нод должен вернуть новый dropTarget для субнод. но если субнод нет, то можно вернуть null
// removeOwnTreeFromParent()    - это вызовется по завершению дропа
// thisHierarchyRequireTabsOrganizerInActiveTree() - если вернёт true в парентах точки дропа будет подготовлено окно
//
// ActionLinkModelBase создаёт заданную ноду в момент дропа. Нахрена это сделано вместо передачи непосредственно самих моделей в логику дропа правда не ясно,
// по памяти это помойму ничего не экономит. Разве что ActionLinkModelBase имеет postInsertAction - которого нет у обычной ноды.
// возможно что это сделанно так как в рамках View, которое вообще ничерта не знает о модели, сложно (невозможно) создавать вообще модели нод.
// Но View и не надо этого делать вообщето, она должна это попросить у модели дерева/бекграунд страницы
var ActionLinkModelBase = Class.extend({
    init:function(nodeConstructor, postInsertAction){
        this.nodeConstructor = nodeConstructor;
        this.postInsertAction = postInsertAction;
        this.dataForNodeConstructor = null;

        this.subnodes = [];
        this.newNode = null;

        this.idMVC = "noidmvc_thisis_ActionLinkModelBase"; // чтоб не выкидывало false в isDropAlloved()
    },

    setDataForNodeConstructor:function(str) {
        this.dataForNodeConstructor = str;
    },

    copyConstructor_withoutSubnodes:function() {
        // TODO вот тут творится жопа - происходит запоминание новой ноды, вставленной где просили, для того чтоб позже ей выполнить performAfterDropAction
        // При всё при этом это хак, ибо мы играем роль просто иерархии для копирования в новое место а не иерархии В НОВОМ МЕСТЕ
        return this.newNode = this.nodeConstructor(this.dataForNodeConstructor);
    },

    cloneForCopyInActiveTree_withoutSubnodes:function() {
        return this.copyConstructor_withoutSubnodes();
    },

    isNotCoveredByWindowActiveTabsPresentInHierarchy:function() {
        return false;
    },

    removeOwnTreeFromParent:function() {
        /*do nothing*/
    },

//    notifyObservers:function(message, insertedNode/*это только для fromModel_onCopyPlacedDuringMove_TransferCursor месаги актуальный параметр*/) {
//        if(message === "fromModel_onCopyPlacedDuringMove_TransferCursor") {
//            insertedNode.setCursorHereOrToFirstCollapsedParent(вот тока мы тут не знаем какое окно нас вставляет, поэтому будем это делать в performAfterDropAction)
//        }
//
//        Можно бы было и тут курсор переставлять, всё что надо это перед дропом актион линк (в момент создания ActionLinkModelBase) запомнит TreeView
//        в который оно вставляется (от там есть)
//    },

    performAfterDropAction:function(port) {
        if(this.postInsertAction) this.postInsertAction(this.newNode, port, this.dataForNodeConstructor); // раньше это делали прямо в moveToActiveTree, но для NodeText это приводило к тому что DropFeedback горел пока было promt окно

        // Устанавливаем курсок на себя в окне что инициировало операцию (хотя по хорошуму это должно бы было происходить в notifyObservers выше, смотри там комент)
        this.newNode.setCursorHereOrToFirstCollapsedParent(port);

        this.newNode = null; // на всякий случай
    },

    performAfterDropActionForDragedModelHierarchy:function(port) {
        this.performAfterDropAction(port);
        for(var i = 0; i < this.subnodes.length; i++)
            this.subnodes[i].performAfterDropActionForDragedModelHierarchy(port);
    }
});

async function getOption(optionName) {
    return (await chrome.storage.local.get(optionName))[optionName];
}
