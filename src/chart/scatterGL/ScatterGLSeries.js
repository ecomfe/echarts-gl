import echarts from 'echarts/lib/echarts';

echarts.extendSeriesModel({

    type: 'series.scatterGL',

    dependencies: ['grid', 'polar', 'geo', 'singleAxis'],

    visualColorAccessPath: 'itemStyle.color',

    getInitialData: function () {
        return echarts.helper.createList(this);
    },

    defaultOption: {
        coordinateSystem: 'cartesian2d',
        zlevel: 10,

        progressive: 1e5,
        progressiveThreshold: 1e5,

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Polar coordinate system
        // polarIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,

        large: false,

        symbol: 'circle',
        symbolSize: 10,

        // symbolSize scale when zooming.
        zoomScale: 0,

        // Support source-over, lighter
        blendMode: 'source-over',

        itemStyle: {
            opacity: 0.8
        },


        postEffect: {
            enable: false,
            colorCorrection: {
                exposure: 0,
                brightness: 0,
                contrast: 1,
                saturation: 1,
                enable: true
            }
        }

    }
});