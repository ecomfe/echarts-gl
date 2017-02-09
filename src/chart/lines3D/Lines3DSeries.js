var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.lines3D',

    dependencies: ['globe'],

    visualColorAccessPath: 'lineStyle.normal.color',

    getInitialData: function (option, ecModel) {
        var lineData = new echarts.List(['value'], this);
        lineData.hasItemOption = false;
        lineData.initData(option.data, [], function (dataItem, dimName, dataIndex, dimIndex) {
            // dataItem is simply coords
            if (dataItem instanceof Array) {
                return NaN;
            }
            else {
                lineData.hasItemOption = true;
                var value = dataItem.value;
                if (value != null) {
                    return value instanceof Array ? value[dimIndex] : value;
                }
            }
        });

        return lineData;
    },

    defaultOption: {

        coordinateSystem: 'globe',

        globeIndex: 0,

        zlevel: 10,

        polyline: false,

        effect: {
            symbol: 'circle',
            show: false,
            period: 4,
            symbolSize: 4
        },

        // Support source-over, lighter
        blendMode: 'source-over',

        lineStyle: {
            normal: {
                // color
                // opacity
            }
        }
    }
});