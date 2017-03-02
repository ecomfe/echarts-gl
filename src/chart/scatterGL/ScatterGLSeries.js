var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.scatterGL',

    dependencies: ['grid', 'polar', 'geo', 'singleAxis'],

    getInitialData: function () {
        return echarts.helper.createList(this);
    },

    defaultOption: {
        coordinateSystem: 'cartesian2d',
        zlevel: 10,

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Polar coordinate system
        // polarIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,

        symbol: 'circle',
        symbolSize: 10,          // 图形大小，半宽（半径）参数，当图形为方向或菱形则总宽度为symbolSize * 2
        // symbolRotate: null,  // 图形旋转控制

        // Support source-over, lighter
        blendMode: 'source-over',

        itemStyle: {
            normal: {
                opacity: 0.8
                // color: 各异
            }
        }

    }
});