/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

// "cdId"                         - нет субнод
// "cdId@dId&dId&dId&dId&dId&dId" - субноды закодированы прямо тут
// "cdId#sdId"                    - субноды закодированы в sdId, изменений небыло
// "cdId#sdId#sops"               - субноды закодированы в sdId + изменения
// return [subnodesDids, subnodesBaseKnotDid if present, subnodesBaseKnotContent if present, cdid]
// Полный аналог Python метода getKnotSubnodes - синхронить любые изменения
function getKnotSubnodes(knotDidStr, knotContent, allKnots) {
    var subnodesDids = [];
    var subnodesBaseKnotDid = null;
    var subnodesBaseKnotContent = null;

    try {
        var did_subnodes = knotContent.split('@');

        if( did_subnodes.length == 2 ) // Субноды просто тут закодированы
            return [ did_subnodes[1].split('&'), null, null, did_subnodes[0] ];

        var did_subnodesBaseDid_subnodesChanges = knotContent.split('#');
        var cdid = did_subnodesBaseDid_subnodesChanges[0];

        if(did_subnodes.length == 1 && did_subnodesBaseDid_subnodesChanges.length == 1) // Нет субнод
            return [ [], null, null, cdid ];

        if(did_subnodesBaseDid_subnodesChanges.length >= 2) { // Субноды закодированы относительно другого knot
            subnodesBaseKnotDid = did_subnodesBaseDid_subnodesChanges[1];
            subnodesBaseKnotContent = allKnots[subnodesBaseKnotDid];
            subnodesDids /*subnodesDids, _, _, _*/ = getKnotSubnodes(subnodesBaseKnotDid, subnodesBaseKnotContent, allKnots)[0];
        }

        if(did_subnodesBaseDid_subnodesChanges.length == 3) // Субноды закодированы относительно другого knot + к ним есть изменения
            subnodesDids = SybnodesChangesMonitor_restoreSubnodesList(/*baseSubnodesArray*/subnodesDids, /* changes_str*/did_subnodesBaseDid_subnodesChanges[2]);

    } catch(e) {
//        log.error('IndexError getKnotSubnodes - knot - allKnots[%s] :=: %s; baseKnot -  allKnots[%s] :=: %s;' % (knotDidStr, knotContent, subnodesBaseKnotDid, subnodesBaseKnotContent))
//        import sys
//        exc_info = sys.exc_info()
//        raise exc_info[1], None, exc_info[2] # We raise same exception but with original traceback
    }

    return  [subnodesDids, subnodesBaseKnotDid, subnodesBaseKnotContent, cdid]
}


function restoreTreeStructure(rootDId, dId, allKnots, ret_entrysCdidsListInOrderOfAppearence, ret_entrysCdidsToNodesMap) {
    var knotContent = allKnots[dId];



    var knotData = getKnotSubnodes(dId, knotContent, allKnots);
    var subnodesDIds = knotData[0]; // Востановленные
    var sdid         = knotData[1];
    var sdidKnot     = knotData[2];
    var cdid         = knotData[3];

    var restoredNode = deserializeKnot(rootDId, dId, knotContent, cdid, sdid, sdidKnot);

    ret_entrysCdidsListInOrderOfAppearence.push(cdid);
    ret_entrysCdidsToNodesMap[cdid] = restoredNode;

    for(var i = 0; i < subnodesDIds.length; i++)
        restoredNode.insertSubnode(i, restoreTreeStructure(rootDId, subnodesDIds[i], allKnots, ret_entrysCdidsListInOrderOfAppearence, ret_entrysCdidsToNodesMap), true );

    return restoredNode;
}

// Полный аналог deserializeNode
function deserializeKnot(rootDId, knotDId, knotContent, cdId, sdId, sdIdKnot){
    var serializedNodeData = {};

    if(knotDId === rootDId) {
        serializedNodeData['data'] = {'treeId':"none", 'nextDId':0};
        serializedNodeData['type'] = NodeTypesEnum.SESSION;
    } else {
        serializedNodeData['data'] = {'note':knotContent}; // Temporal text notes to hold the place till real node content arrive
        serializedNodeData['type'] = NodeTypesEnum.TEXTNOTE;
    }

    serializedNodeData['dId']       = knotDId;
    serializedNodeData['cdId']      = cdId;
    serializedNodeData['sdId']      = sdId;
    serializedNodeData['sdIdKnot']  = sdIdKnot;

    return deserializeNode(serializedNodeData)
}

// Функция обратная к serializeNodeBodyContent_forDiff
function deserializeEntry(entryData) {
//    var normalserialize = this.serialize(); // TODO фигня и куча лишнего
////           Тут проблема короче, сериалайз надо полностью переписывать на новый, с учотом таблиц элементов зареференсеных по внешним ключам
////           вариант без этого - парсить тут возвращённое значение, но это не ООП + при смене логики/введении новых нод-полей тут прийдётс тоже чтото менять, плохо
//
//    var r = [ NodesTypesEnumStr2Num[ this.type ] * (this.colapsed ? -1 : 1) // The type is negative if collapsed
//            , normalserialize['data'] //TODO куча лишней лабуды
//          //, optional {marks}, see next line
//            ];
//
//    if(normalserialize['marks']) r.push(normalserialize['marks']);
//    // WARNING - больше опциональных полей тут быть не может...
//
//    return JSON.stringify(r);

    try {
        var entryDataAsJSO = JSON.parse(entryData);

        var serializedNodeData = {};
        serializedNodeData['type']     = NodesTypesEnumNum2Str[ Math.abs(entryDataAsJSO[0]) ];
        serializedNodeData['colapsed'] = !!(entryDataAsJSO[0] < 0);
        serializedNodeData['data']     = entryDataAsJSO[1];
        serializedNodeData['marks']    = entryDataAsJSO[2];

        return deserializeNode(serializedNodeData)
    } catch (e) {
        console.error("ENTRY DESERIALIZE ERROR", e, entryData);
        return new NodeNote({'note':"ENTRY DESERIALIZE ERROR:"+e +entryData});
    }
}

var dummyTreePersistenceManager = {
    registerTree:function(tree){},
    treeUpdated:function(){},
    saveNow:function(){}
};

function buildTreeModel(rootDid, allKnots, ret_entrysCdidsListInOrderOfAppearence, ret_entrysCdidsToNodesMap) {
    var rootNode = restoreTreeStructure(rootDid, rootDid, allKnots, ret_entrysCdidsListInOrderOfAppearence, ret_entrysCdidsToNodesMap );
    // var rootNode = new NodeSession();
    // rootNode.insertSubnode( 0, new NodeNote( {'note':"#1"}) );
    // rootNode.insertSubnode( 1, new NodeNote( {'note':"#2"}) );

    return extentToTreeModel([rootNode], dummyTreePersistenceManager);
}

function setEntry(node, serializedEntryBody) {
    if(!node || !node.parent /*скипаем SESSION*/ /*TODO а почему скипаем?*/ ) return;

    node.replaceSelfInTreeBy_mergeSubnodesAndMarks( deserializeEntry(serializedEntryBody) );
    // TODO Ох это дорогая операция!!! Особенно если View уже подключен и есть сабноды. Да и marks на мержить никчему - нужна полная замена.
    // TODO !!! И вообще на время этой опреции надо дерево отключать с DOM (крайне спорно, полная вставка и перерендер дерева похоже стоит мне визуально сильно дороже апдейта узлов)
    // TODO И плохо что это зануляет dids!!!! вверх по иерархии -> короче надо вводить новый метод. Который хотябы dids не трогает
    // и вообще копирует в новый узел
    // dId, cdId, sdId, sdIdKnot;
    // replaceEntry_historyViewClient
}

function createTreeView(window_, treeModel, thisTreeTabIndex, bottomMainPanelHeight) {
    var treeView = new TreeView( window_, treeModel, thisTreeTabIndex, bottomMainPanelHeight, false/*enableContextMenu*/);
    return treeView.currentSessionRowDom;
}

window['buildTreeModel']   = buildTreeModel;
window['createTreeView']   = createTreeView;

window['setEntry'] = setEntry;

