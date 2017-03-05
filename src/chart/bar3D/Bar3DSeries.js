var echarts = require('echarts/lib/echarts');

module.exports = echarts.extendSeriesModel({

    type: 'series.bar3D',

    dependencies: ['globe'],

    getInitialData: function (option, ecModel) {
        var dimensions = echarts.helper.completeDimensions(['x', 'y', 'z'], option.data);
        var data = new echarts.List(dimensions, this);
        data.initData(option.data);
        return data;
    },

    defaultOption: {

        coordinateSystem: 'cartesian3D',

        globeIndex: 0,

        xAxis3DIndex: 0,
        yAxis3DIndex: 0,
        zAxis3DIndex: 0,

        zlevel: -10,

        // bevelSize, 0 has no bevel
        bevelSize: 0,
        // higher is smoother
        bevelSmoothness: 2,

        // Bar width and depth
        // barSize: [1, 1],

        // On grid plane when coordinateSystem is cartesian3D
        onGridPlane: 'xy',

        // Shading of globe
        shading: 'color',

        realisticMaterial: {
            roughness: 0.5,
            metalness: 0
        },

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