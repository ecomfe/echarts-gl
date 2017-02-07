var echarts = require('echarts/lib/echarts');

module.exports = echarts.extendSeriesModel({

    type: 'series.bar3d',

    dependencies: ['globe3d'],

    getInitialData: function (option, ecModel) {
        var data = new echarts.List(['x', 'y', 'z'], this);
        data.initData(option.data);
        return data;
    },

    defaultOption: {

        coordinateSystem: 'globe',

        globeIndex: 0,

        zlevel: 10,

        // Bar width and depth
        barSize: [1, 1],

        // Shading of globe
        // 'color', 'lambert'
        // TODO, 'realastic', 'toon'
        shading: 'color',

        // If coordinateSystem is globe, value will be mapped
        // from minHeight to maxHeight
        minHeight: 0,
        maxHeight: 100,

        itemStyle: {
            normal: {
                opacity: 1
            }
        }
    }
});