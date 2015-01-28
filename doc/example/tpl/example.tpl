<!Doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ECharts-X">
    <meta name="author" content="shenyi.914@gmail.com">
    <title>{{title}} Powered by ECharts-X</title>

    <link rel="shortcut icon" href="img/favicon.png">

    <link rel="stylesheet" href="css/example.css">
    <link rel="stylesheet" href="css/codemirror.css">
    <link rel="stylesheet" href="css/monokai.css">
    <link rel="stylesheet" href="css/twilight.css">
    <body>
        <header id="header">
            <h1>ECharts-X</h1>
            <div id="toolbar">
                <button id="open-editor">Code Editor</button>
            </div>
            <ul class="links">
                <li><a href="../index.html" target="_blank">Documentation</a></li>
                <li><a href="http://echarts.baidu.com/" target="_blank">ECharts</a></li>
                <li><a href="https://github.com/pissang/echarts-x/" target="_blank">Github</a></li>
            </ul>
        </header>
        <div id="main">
            <div id="viewport"></div>
        </div>
        <div id="editor">
            <textarea></textarea>
            <div id="editor-toolbar">
                <button id="editor-update">Update</button>
                <button id="editor-refresh">Refresh All</button>
                <button id="editor-close">Close</button>
            </div>
        </div>

<script type="text/x-javascript" id="code-source">
{{code}}
</script>

        <script src="lib/esl.js"></script>
        <script src="lib/jquery.min.js"></script>
        <script src="lib/codemirror/codemirror.js"></script>
        <script src="lib/codemirror/mode/javascript.js"></script>
        <script src="js/bootExample.js"></script>
    </body>
</head>
</html>