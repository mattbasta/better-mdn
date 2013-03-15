function get(url) {
    // Booooo! synchronous XHR! :( :(
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    return xhr.responseText;
}

chrome.extension.onMessage.addListener(
  function(msg, sender, postMessage) {
    switch (msg) {
        case 'getcss':
            postMessage(get('style.css') + get('prism.css'));
            break;
        case 'getprismjs':
            postMessage(get('prism.js'));
            break;
    }
});