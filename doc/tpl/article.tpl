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
        <main id="main">
            <nav id="nav" class="sidebar affix">
                <ul class="top">
                <!-- for: ${articleList} as ${item} -->
                    <!-- if: ${item.title} === ${article.title} -->
                    <li class="current">
                    <!-- else -->
                    <li>
                    <!-- /if -->
                        <a href="${item.url}">${item.title}</a>
                    </li>
                <!-- /for -->
                </ul>
            </nav>
            <article id="article">
                <h1>${article.title}</h1>
                {{articleHtml}}
            </article>
        </main>

        <!-- import: footer -->

        <script src="../../lib/jquery.min.js"></script>
        <script src="../../lib/affix.js"></script>
        <script src="../../lib/prettify/prettify.js"></script>

        <link rel="stylesheet" href="../../lib/prettify/github.css">

        <script>
            $('#nav').affix({
                offset: {
                    top: 60,
                    bottom: 40
                }
            });

            $('pre').addClass('.prettyprint');

            prettyPrint();

            var $currentNav = $('#nav>ul>li.current');

            var $currentNavSub = $('<ul></ul>').appendTo($currentNav);
            $('#article h2, #article h3').each(function (idx, $el) {
                var padding = 0;
                switch ($el.tagName.toLowerCase()) {
                    case 'h2':
                        padding = 20;
                        break;
                    case 'h3':
                        padding = 30;
                        break;
                    case 'h4':
                        padding = 40;
                        break;
                    case 'h5':
                        padding = 50;
                        break;
                }

                $el = $($el);
                var title = $el.html();
                $el.prepend('<a name="' + title + '"></a>');
                
                $('<li><a href="#' + title + '">' + title + '</a></li>')
                    .appendTo($currentNavSub)
                    .find('a').css('padding-left', padding + 'px');
            });
        </script>
    </body>
</head>
</html>