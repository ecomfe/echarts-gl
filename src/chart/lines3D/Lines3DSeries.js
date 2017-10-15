import echarts from 'echarts/lib/echarts';

echarts.extendSeriesModel({

    type: 'series.lines3D',

    dependencies: ['globe'],

    visualColorAccessPath: 'lineStyle.color',

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

        geo3DIndex: 0,

        zlevel: -10,

        polyline: false,

        effect: {
            show: false,
            period: 4,
            // Trail width
            trailWidth: 4,
            trailLength: 0.2,

            spotIntensity: 6
        },

        silent: true,

        // Support source-over, lighter
        blendMode: 'source-over',

        lineStyle: {
            width: 1,
            opacity: 0.5
            // color
        }
    }
});