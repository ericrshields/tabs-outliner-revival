"use strict";

class BackgroundCommunicationInterface {
    #port = chrome.runtime.connect({name: "viewport"});

    constructor() {
        this.#port.onMessage.addListener(function(msg) {
            console.log("this.#port.onMessage");
            console.log(msg);
        });
    }

    test() {
        this.#port.postMessage({data:"test"});
    }
}

