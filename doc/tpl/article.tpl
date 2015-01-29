<!Doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ECharts-X">
    <meta name="author" content="shenyi.914@gmail.com">
    <title>ECharts-X</title>

    <link rel="shortcut icon" href="../../img/favicon.png">

    <link rel="stylesheet" href="../../css/common.css">
    <link rel="stylesheet" href="../../css/article.css">
    <body>
        <header id="header">
            <h1><a href="../../index.html">ECharts-X</a></h1>
            <ul class="links">
                <li class="active">
                    <a href="./getting_started.html" target="_blank">Documentation</a>
                </li>
                <li><a href="../../example.html" target="_blank">Examples</a></li>
                <li><a href="https://github.com/pissang/echarts-x/" target="_blank">Github</a></li>
                <li><a href="http://echarts.baidu.com/" target="_blank">ECharts</a></li>
            </ul>
        </header>
        <div id="main">
            <div id="nav">
                <h5>Menu</h5>
                <ul>
                <!-- for: ${articleList} as ${item} -->
                    <li class="article-title">
                        <a href="${item.url}">${item.title}</a>
                    </li>
                <!-- /for -->
                </ul>
            </div>
            <article id="article">
                <h1>${article.title}</h1>
                {{articleHtml}}
            </article>
        </div>

        <script src="../../lib/esl.js"></script>
        <script src="../../lib/jquery.min.js"></script>
    </body>
</head>
</html>