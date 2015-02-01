<!Doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ECharts-X">
    <meta name="author" content="shenyi.914@gmail.com">
    <title>Examples - Powered by ECharts-X</title>

    <link rel="shortcut icon" href="img/favicon.png">

    <link rel="stylesheet" href="css/common.css">
    <link rel="stylesheet" href="css/example_entry.css">
    <body>
        <header id="header">
            <h1><a href="index.html">ECharts-X</a></h1>
            <ul class="links">
                <li>
                    <a href="cn/article/getting_started.html" target="_blank">Documentation</a>
                </li>
                <li><a href="example.html" class="active" target="_blank">Examples</a></li>
                <li><a href="https://github.com/pissang/echarts-x/" target="_blank">Github</a></li>
                <li><a href="http://echarts.baidu.com/" target="_blank">ECharts</a></li>
            </ul>
        </header>
        <main id="main">
            <nav id='nav' class="sidebar affix">
                <ul class="top">
                <!-- for: ${exampleAllTypes} as ${exampleType} -->
                    <li>
                        <a href="#${exampleType.type}">${exampleType.typeTitle}</a>
                    </li>
                <!-- /for -->
                </ul>
            </nav>
            <article id="examples">
                <h1>Examples</h1>
                <!-- for: ${exampleAllTypes} as ${exampleType} -->
                <section>
                    <a name="${exampleType.type}"></a>
                    <h3>${exampleType.typeTitle}</h3>
                    <ul>
                        <!-- for: ${exampleType.examples} as ${example}-->
                        <li>
                            <a name="${example.name}" href="${example.url}" target="_blank">
                                <img src="${example.thumb}" alt="">
                            </a>
                            <h5>${example.title}</h5>
                        </li>
                        <!-- /for -->
                    </ul>
                    <div style="clear:both;"></div>
                </section>
                <!-- /for -->
            </article>
        </main>

        <!-- import: footer -->

        <script src="lib/jquery.min.js"></script>
        <script src="lib/affix.js"></script>

        <script>
            $('#nav').affix({
                offset: {
                    top: 60,
                    bottom: 200
                }
            });
        </script>
    </body>
</head>
</html>