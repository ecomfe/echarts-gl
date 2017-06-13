var echarts = require('echarts/lib/echarts');
var formatTooltip = require('../common/formatTooltip');

var Line3DSeries = echarts.extendSeriesModel({

    type: 'series.line3D',

    dependencies: ['grid3D'],

    visualColorAccessPath: 'lineStyle.color',

    getInitialData: function (option, ecModel) {
        var dimensions = echarts.helper.completeDimensions(['x', 'y', 'z'], option.data, {
            encodeDef: this.get('encode'),
            dimsDef: this.get('dimensions')
        });
        var data = new echarts.List(dimensions, this);
        data.initData(option.data);
        return data;
    },

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: -10,

        // Cartesian coordinate system
        grid3DIndex: 0,

        lineStyle: {
            width: 2
        },

        animationDurationUpdate: 500
    }
});

module.exports = Line3DSeries;