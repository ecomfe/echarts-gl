// Just for temporarily mobile debug.

(function () {

    var infoDom;
    var msgs = [];

    var count = 0;

    /**
     * @param {string|Object|Array} msg
     */
    window.facePrint = function () {
        if (!infoDom) {
            infoDom = createInfoDom();
        }

        var msg = [];

        for (var i = 0; i < arguments.length; i++) {
            var item = arguments[i];
            if (isObject(item)) {
                item = window.facePrint.objToStr(item);
            }
            msg.push(item);
        }
        msg = msg.join('\t');

        msgs.push(encodeHTML(msg));
        count++;

        if (msgs.length > 30) {
            msgs.shift();
        }

        var str = '';
        // Make some change in view, otherwise user may
        // be not aware that log is still printing.
        for (var i = 0; i < msgs.length; i++) {
            str += '<span style="background:#555;margin: 0 3px;padding: 0 2px;color:yellow;">'
                + (count - msgs.length + i) + '</span>' + msgs[i] + '<br />';
        }
        infoDom.innerHTML = str;

        console.log.apply(console, arguments);

    };

    window.facePrint.objToStr = function (obj) {
        var msgArr = [];
        for (var key in obj) {
            msgArr.push(key + '=' + obj[key]);
        }
        return msgArr.join(', ');
    };

    function createInfoDom() {
        var dom = document.createElement('div');

        dom.style.cssText = [
            'position: fixed',
            'top: 0',
            'max-width: 300px',
            'min-width: 150px',
            'min-height: 14px',
            'line-height: 14px',
            'z-index: 2147483647',
            'color: #fff',
            'font-size: 9px',
            'background: rgba(0,0,0,0.3)',
            'word-break:break-all',
            'word-wrap:break-word'
        ].join(';') + ';';

        document.body.appendChild(dom);

        return dom;
    }

    function encodeHTML(source) {
        return source == null
            ? ''
            : String(source)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
    }

    function isObject(value) {
        // Avoid a V8 JIT bug in Chrome 19-20.
        // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
        var type = typeof value;
        return type === 'function' || (!!value && type == 'object');
    }

})();