// ==UserScript==
// @name           Better MDN
// @description    Improves the MDN interface to not be terribad.
// @match          https://*/*
// @version        0.1
// ==/UserScript==

(function() {

console.log('Better MDN is loaded.');

var styleElement = document.createElement("style");
styleElement.setAttribute("id", "better-mdn-styles");
styleElement.setAttribute("class", "user-style");
styleElement.setAttribute("type", "text/css");

chrome.extension.sendMessage("getcss", function(response) {
    styleElement.appendChild(document.createTextNode(response));
    if (document.head) {
        document.head.appendChild(styleElement);
    } else {
        document.documentElement.appendChild(styleElement);
    }
});

function process_document() {
    // Move the nav outside of the article if we can.
    var nav = document.getElementById('article-nav');
    if (nav) {
        var parent = nav.parentNode;
        parent.removeChild(nav);
        parent.parentNode.insertBefore(nav, parent.nextSibling);
        parent.className += ' toc-after';
    }

    // Get ready for Prism
    var pres = document.getElementsByTagName('pre');
    for (var i = 0; i < pres.length; i++) {
        (function(e) {
            if (e.className.indexOf('brush:') === -1) {
                return;
            }
            var lang = e.className.substr(e.className.indexOf(': ') + 2);
            if (lang === 'js')
                lang = 'javascript';
            e.className = '';

            var c = document.createElement('code');
            c.className = 'language-' + lang;
            c.innerHTML = e.innerHTML;
            e.innerHTML = '';
            e.appendChild(c);
        })(pres[i]);
    }
}
process_document();

var headshorts = document.createElement('div');
headshorts.id = 'headshorts';
headshorts.innerHTML = [
'<span><kbd>T</kbd> <b>Search</b></span>',
'<span><kbd>U</kbd> <b>Parent</b></span>'
].join('\n');
document.querySelectorAll('#logo')[0].appendChild(headshorts);

function search(searchbox, results, dismiss) {
    var lastXHR;
    searchbox.addEventListener('keyup', function(e) {
        if (this.value.length < 3) {
            return;
        }
        results.className = 'results';

        if (lastXHR) {
            lastXHR.abort();
        }

        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var data = JSON.parse(xhr.responseText);
            results.innerHTML = data.slice(0, 20).map(function(d) {
                return [
                '<a href="' + d.url + '">',
                d.title,  // TODO: escape me
                '</a>'
                ].join('');
            }).join('');
        };
        var url = '/docs/get-documents?current_locale=en-US&term=' + encodeURIComponent(this.value);
        xhr.open('GET', url, true);
        lastXHR = xhr;
        xhr.send();
    });
}

function headSearch() {
    var sbox = document.createElement('input');
    sbox.type = 'search';
    sbox.id = 'bastasearch';
    document.querySelectorAll('#masthead .wrap')[0].appendChild(sbox);

    var results = document.createElement('div');
    results.id = 'bastasearch-results';
    document.body.appendChild(results);

    sbox.focus();

    function dismiss() {
        setTimeout(function() {
            sbox.parentNode.removeChild(sbox);
            document.body.removeChild(results);
        }, 1000);
    }

    sbox.addEventListener('blur', dismiss);
    sbox.addEventListener('click', function(e) {
        if (e.keyCode === 27) {
            dismiss();
        }
        e.preventDefault();
        e.stopPropagation();
    });
    search(sbox, results, dismiss);
}

function go_up() {
    var stack = window.location.pathname.substr(1).split('/');
    stack.pop();
    frag_load('/' + stack.join('/'));
}

window.addEventListener('keyup', function(e) {
    switch (e.keyCode) {
        case 84:
            console.log('search');
            headSearch();
            break;
        case 85:
            console.log('up');
            go_up();
            break;
    }
});

if (document.body.id === 'home') {
    var dsearch = document.createElement('div');
    dsearch.id = 'home-search';
    dsearch.innerHTML = '<h1>Search for <b>documentation</b></h1>' +
        '<input type="search" class="bastasearch" id="bastasearch" />' +
        '<div class="hs-results"></div>';


    document.getElementById('content-main').insertBefore(
        dsearch, document.getElementById('top-docs'));
    document.getElementById('bastasearch').addEventListener('click', headSearch);
}

var searches = document.querySelectorAll('input.bastasearch');
var searchresults = document.querySelectorAll('.hs-results');
for (var i = 0, el; el = searches[i++];) {
    search(el, searchresults[i]);
}


var RE_FRAG = /\<section id=\"content\"\>([\s\S]+)\<\/section\>\s+\<section id=\"footbar\"\>/i;
var RE_NAVTB = /\<section id=\"nav-toolbar\"\>([\s\S]+?)\<\/section\>/i;
var RE_TITLE = /\<title\>(.*)\<\/title\>/i;
var cache = {};
cache[window.location.href] = document.getElementById('content').innerHTML;
var title_cache = {};
title_cache[window.location.href] = document.title;
var bread_cache = {};
bread_cache[window.location.href] = document.getElementById('nav-toolbar').innerHTML;
function set_content(url, data, title, navbar, do_cache) {
    if (do_cache) {
        cache[url] = data;
        title_cache[url] = title;
        bread_cache[url] = navbar;
    }
    history.pushState({url: url}, title, url);
    document.title = title;

    var nav = document.getElementById('article-nav');
    if (nav) {
        nav.parentNode.removeChild(nav);
    }

    document.getElementById('content').innerHTML = data;
    document.getElementById('nav-toolbar').innerHTML = navbar;
    process_document();
    scroll(0, 0);
}
function frag_load(url) {
    console.log('Fragment loading: ', url);
    if (url in cache) {
        set_content(url, cache[url], title_cache[url], bread_cache[url]);
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        console.log('Loaded frag contents')
        var data = xhr.responseText;
        var innerData = data.match(RE_FRAG);
        if (!innerData) {
            window.location.href = url;
            return;
        }
        var title = data.match(RE_TITLE)[1].replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&');
        var navbar = data.match(RE_NAVTB);
        navbar = navbar ? navbar[1] : '';
        set_content(url, innerData[1], title, navbar, true);
    };
    xhr.onerror = function() {
        console.error('Frag error:', arguments);
        window.location.href = url;
    };
    xhr.open('GET', url, true);
    xhr.send();
}
window.addEventListener('click', function(e) {
    var at = e.srcElement;
    while (at) {
        if (at.nodeName === 'A') {
            break;
        }
        at = at.parentNode;
    }
    if (!at) {
        return;
    }

    var href = at.attributes.getNamedItem("href").value;
    if (href && href[0] === '#') {
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    frag_load(at.href);
});
window.addEventListener('popstate', function(e) {
    if (!e.state) {
        return;
    }
    var url = e.state.url;
    set_content(url, cache[url], title_cache[url], bread_cache[url]);
});

})();
