import echarts from 'echarts/lib/echarts';
import formatUtil from '../../util/format';
import formatTooltip from '../common/formatTooltip';

echarts.extendSeriesModel({

    type: 'series.scatter3D',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'itemStyle.color',

    getInitialData: function (option, ecModel) {
        var coordSysDimensions = echarts.getCoordinateSystemDimensions(this.get('coordinateSystem')) || ['x', 'y', 'z'];
        var dimensions = echarts.helper.completeDimensions(coordSysDimensions, option.data, {
            encodeDef: this.get('encode'),
            dimsDef: this.get('dimensions')
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
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: 3,
                borderRadius: 3
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