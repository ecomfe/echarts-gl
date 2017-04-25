var echarts = require('echarts/lib/echarts');
var formatUtil = require('../../util/format');
var formatTooltip = require('../common/formatTooltip');

var Scatter3DSeries = echarts.extendSeriesModel({

    type: 'series.scatter3D',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'itemStyle.color',

    getInitialData: function (option, ecModel) {
        var dimensions = echarts.helper.completeDimensions(['x', 'y', 'z'], option.data, {
            defaultNames: ['x', 'y', 'z', 'value']
        });
        var data = new echarts.List(dimensions, this);
        data.initData(option.data);
        return data;
    },

    getFormattedLabel: function (dataIndex, status, dataType, dimIndex) {
        var text = formatUtil.getFormattedLabel(this, dataIndex, status, dataType, dimIndex);
        if (text == null) {
            var data = this.getData();
            var lastDim = data.dimensions[data.dimensions.length - 1];
            text = data.get(lastDim, dataIndex);
        }
        return text;
    },

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: -10,

        // Cartesian coordinate system
        grid3DIndex: 0,

        globeIndex: 0,

        symbol: 'circle',
        symbolSize: 10,

        // Distance to the globe, when coordinate system is globe
        distanceToGlobe: 1.5,

        // Distance to the geo3D, when coordinate system is geo3D
        distanceToGeo3D: 0.5,

        // Support source-over, lighter
        blendMode: 'source-over',

        label: {
            show: false,
            position: 'right',
            // Screen space distance
            distance: 5,

            textStyle: {
                fontSize: 14,
                color: '#000',
                borderColor: '#fff',
                borderWidth: 1
            }
        },

        itemStyle: {
            opacity: 0.8
        },

        emphasis: {
            label: {
                show: true
            }
        },

        animationDurationUpdate: 500
    }
});