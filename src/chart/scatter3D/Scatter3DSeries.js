var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.scatter3D',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'itemStyle.color',

    getInitialData: function (option, ecModel) {
        var dimensions = echarts.helper.completeDimensions(['x', 'y', 'z'], option.data);
        var data = new echarts.List(dimensions, this);
        data.initData(option.data);
        return data;
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: -10,

        // Cartesian coordinate system
        xAxis3DIndex: 0,
        yAxis3DIndex: 0,
        zAxis3DIndex: 0,

        globeIndex: 0,

        symbol: 'circle',
        symbolSize: 10,

        // Distance to the globe, when coordinate system is globe
        distanceToGlobe: 1.5,

        // Distance to the geo3D, when coordinate system is geo3D
        distanceToGeo3D: 0.5,

        // Support source-over, lighter
        blendMode: 'source-over',

        itemStyle: {
            opacity: 0.8
        }
    }
});