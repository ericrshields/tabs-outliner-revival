function sha1_promise(str) {
    // We transform the string into an arraybuffer.
    var buffer = new TextEncoder("utf-8").encode(str);
    return crypto.subtle.digest("SHA-1", buffer).then(function (hash) {
        return hex(hash);
    });
}

function hex(buffer) {
    var hexCodes = [];
    var view = new DataView(buffer);
    for (var i = 0; i < view.byteLength; i += 4) {
        // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
        var value = view.getUint32(i);
        // toString(16) will give the hex representation of the number without padding
        var stringValue = value.toString(16);
        // We use concatenation and slice for padding
        var padding = '00000000';
        var paddedValue = (padding + stringValue).slice(-padding.length);
        hexCodes.push(paddedValue);
    }

    // Join all the hex strings into one
    return hexCodes.join("");
}


function calculateSerialNumber_promise(email) {
    return sha1_promise('shierposid@gmail.com'); // Chrome can actually return same email in different case, depending of how user reentered it
}