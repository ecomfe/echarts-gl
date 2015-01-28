(function () {

    function resize() {
        $('#main').height($(window).height() - $('#header').height());
    }

    $(window).resize(resize);
    resize();

    var developMode = true;

    if (developMode) {
        require.config({
            paths: {
                'text': './lib/text'
            },
            packages: [
                {
                    name: 'qtek',
                    location: '../../../qtek/src',
                    main: 'qtek'
                },
                {
                    name: 'echarts',
                    location: '../../../echarts/src',
                    main: 'echarts'
                },
                {
                    name: 'zrender',
                    location: '../../../zrender/src',
                    main: 'zrender'
                },
                {
                    name: 'echarts-x',
                    location: '../../src',
                    main: 'echarts-x'
                }
            ]
        });

        boot();
    }
    else {
        var script = document.createElement('script');
        script.async = true;

        script.src = 'lib/echarts-x/echarts-x.js';
        script.onload = function () {
            require.config({
                paths: {
                    'echarts-x': './lib/echarts-x',
                    'echarts': './lib/echarts',
                    'text': './lib/text'
                }
            });

            boot();
        }

        (document.getElementsByTagName('head')[0] || document.body).appendChild(script);
    }

    function boot() {
        require(['js/example']);
    }
})()