define(function (require) {
    var CodeMirror = require('lib/codemirror/codemirror');
    var ec = require('echarts');
    require('echarts-x');
    require('echarts/chart/map');
    require('echarts-x/chart/map3d');
    require('lib/codemirror/mode/javascript');

    var myChart = null;
    var currentRuningFunc = null;

    $('#editor textarea').val($('#code-source').text());
    // Init code mirror
    var editor = CodeMirror.fromTextArea(
        $('#editor textarea')[0],
        {
            lineNumbers: true,
            mode: 'javascript'
        }
    );
    editor.setOption('theme', 'twilight');

    function runCode(code) {
        currentRuningFunc = new Function('myChart', code);
        currentRuningFunc(myChart);
    };

    function update() {
        if (currentRuningFunc) {
            currentRuningFunc(myChart);
        }
    };

    function refresh() {
        if (myChart) {
            myChart.dispose();
        }
        myChart = ec.init(document.getElementById('viewport'));
        runCode(editor.doc.getValue());
    };

    $('#open-editor').click(function () {
        $('#editor').show();
        // Force editor to show
        editor.refresh();
    });

    $('#editor-close').click(function () {
        $('#editor').hide();
    });

    $('#editor-refresh').click(refresh);
    $('#editor-update').click(update);

    refresh();
});