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

        // Support source-over, lighter
        blendMode: 'source-over',

        itemStyle: {
            opacity: 0.8
        }

    }
});