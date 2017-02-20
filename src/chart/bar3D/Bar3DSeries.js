var echarts = require('echarts/lib/echarts');

module.exports = echarts.extendSeriesModel({

    type: 'series.bar3D',

    dependencies: ['globe'],

    getInitialData: function (option, ecModel) {
        var data = new echarts.List(['x', 'y', 'z'], this);
        data.initData(option.data);
        return data;
    },

    defaultOption: {

        coordinateSystem: 'cartesian3D',

        globeIndex: 0,

        xAxis3DIndex: 0,
        yAxis3DIndex: 0,
        zAxis3DIndex: 0,

        zlevel: 10,

        // Bar width and depth
        // barSize: [1, 1],

        // On grid plane when coordinateSystem is cartesian3D
        onGridPlane: 'xy',

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