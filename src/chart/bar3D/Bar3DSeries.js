var echarts = require('echarts/lib/echarts');
var componentShadingMixin = require('../../component/common/componentShadingMixin');
var formatUtil = require('../../util/format');
var formatTooltip = require('../common/formatTooltip');

var Bar3DSeries = echarts.extendSeriesModel({

    type: 'series.bar3D',

    dependencies: ['globe'],

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
            text = this.getData().get('z', dataIndex);
        }
        return text;
    },

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

    defaultOption: {

        coordinateSystem: 'cartesian3D',

        globeIndex: 0,

        grid3DIndex: 0,

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

        minHeight: 0,

        itemStyle: {
            opacity: 1
        },

        label: {
            show: false,
            distance: 2,
            textStyle: {
                fontSize: 20,
                borderWidth: 1,
                borderColor: '#fff'
            }
        },

        emphasis: {
            label: {
                show: true
            }
        },

        animationDurationUpdate: 500
    }
});

echarts.util.merge(Bar3DSeries.prototype, componentShadingMixin);

module.exports = Bar3DSeries;