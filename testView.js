document.getElementById('testBtn').onclick = function() {
    console.log(chrome. extension.getBackgroundPage());
    window.chrome. extension.getBackgroundPage().backgroundFunctionCallTest();
};


// Messaging testing (beg) ---------------------------------------------------------------------------------------------------------------------
function setChildTextNode(elementId, text) {
  document.getElementById(elementId).innerText = text;
}

var bigArray = [];
for(var i = 0; i <= 62000; i++) {
    //bigArray.push({a:"sdgnaselkvhalkerhtblisewrhbtilehsrltbiherlibhtueirht",b:34523553,d:i,c:"sdfgsdfgsfdgsdfgsdgsdsdfgsdfgdfgdgdfgdf"});
                                                 // 292msec
    //bigArray.push({a:"",b:34523553,d:i,c:""}); //2mb 111msec
}

(function(){
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('#testMessage').addEventListener(
        'click', testMessage);
    document.querySelector('#testConnect').addEventListener(
        'click', testConnect);
  });
})();

// Tests the roundtrip time of sendMessage().
function testMessage() {
   setChildTextNode("resultsRequest", "running...");

    console.time('testMessage');
    const timeStart = performance.now();


    chrome.runtime.sendMessage({counter: i}, function handler(response) {
      if (response.counter < 1000) {
        chrome.runtime.sendMessage({counter: response.counter, payload:bigArray}, handler);
      } else {
        const timeEnd = performance.now();
        console.timeEnd('testMessage');
        var usec = (timeEnd-timeStart) / response.counter;
        setChildTextNode("resultsRequest", usec + "msec");
      }
    });
}

// Tests the roundtrip time of Port.postMessage() after opening a channel.
function testConnect() {
    setChildTextNode("resultsConnect", "running...");

    console.time('testConnect');
    console.time('testConnect_SendFinished');
    const timeStart = performance.now();

//    var port = chrome.runtime.connect({name: "knockknock"});
//    port.postMessage({counter: 1, source:"page"});
//    port.onMessage.addListener(function getResp(response) {
//        console.log("p " + response.source);
//      if (response.counter < 100) {
//        port.postMessage({counter: response.counter, source:"page", payload:bigArray});
//      } else {
//        const timeEnd = performance.now();
//        console.timeEnd('testConnect');
//        var usec = (timeEnd-timeStart) / response.counter;
//        setChildTextNode("resultsConnect", usec + "msec");
//      }
//    });

    var port = chrome.runtime.connect({name: "knockknock"});

    port.onMessage.addListener(function getResp(response) {
        console.log("p " + response.source);

        if(response.end) {
            const timeEnd = performance.now();
            console.timeEnd('testConnect');
            var usec = (timeEnd-timeStart) / response.counter;
            setChildTextNode("resultsConnect", usec + "msec");
        }
    });


    for(var i = 0; i < 100; i++)
        port.postMessage({counter: i, source:"page", payload:bigArray});

    port.postMessage({counter: i, source:"page",  end:true });
    console.timeEnd('testConnect_SendFinished');



}


// Messaging testing (end) ---------------------------------------------------------------------------------------------------------------------