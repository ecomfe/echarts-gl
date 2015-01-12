define('text', function() {

    var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];

    function createXhr() {
        //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
        var xhr, i, progId;
        if (typeof XMLHttpRequest !== "undefined") {
            return new XMLHttpRequest();
        } else if (typeof ActiveXObject !== "undefined") {
            for (i = 0; i < 3; i += 1) {
                progId = progIds[i];
                try {
                    xhr = new ActiveXObject(progId);
                } catch (e) {}

                if (xhr) {
                    progIds = [progId];  // so faster next time
                    break;
                }
            }
        }

        return xhr;
    };

    return {
        load: function(resourceId, req, load, config) {

            var xhr = createXhr();
            var url = req.toUrl(resourceId);
            xhr.open('GET', url, true);

            xhr.onreadystatechange = function(evt) {
                if (xhr.readyState == 4) {
                    if (status > 399 && status < 600) {
                        load(null);
                    } else {
                        load(xhr.responseText);
                    }
                }
            }
            xhr.send(null);
        }
    }
})