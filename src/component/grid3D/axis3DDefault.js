var echarts = require('echarts/lib/echarts');

var defaultOption = {
    show: true,

    grid3DIndex: 0,
    // 反向坐标轴
    inverse: false,

    // 坐标轴名字，默认为空
    name: '',
    // 坐标轴名字位置，支持'start' | 'middle' | 'end'
    nameLocation: 'middle',
    // 坐标轴名字旋转，degree。
    nameRotate: null, // Adapt to axis rotate, when nameLocation is 'middle'.

    // 坐标轴文字样式，默认取全局样式
    nameTextStyle: {
        fontSize: 16
    },
    // 文字与轴线距离
    nameGap: 20,

    // 坐标轴线
    axisLine: {
        // 默认显示，属性show控制显示与否
        show: true,
        // 属性lineStyle控制线条样式
        lineStyle: {
            color: '#333',
            width: 3,
            type: 'solid'
        }
    },
    // 坐标轴小标记
    axisTick: {
        // 属性show控制显示与否，默认显示
        show: true,
        // 控制小标记是否在grid里
        inside: false,
        // 属性length控制线长
        length: 3,
        // 属性lineStyle控制线条样式
        lineStyle: {
            width: 1
        }
    },
    // 坐标轴文本标签，详见axis.axisLabel
    axisLabel: {
        show: true,
        // 控制文本标签是否在grid里
        inside: false,
        rotate: 0,
        margin: 8,
        // formatter: null,
        // 其余属性默认使用全局文本样式，详见TEXTSTYLE
        textStyle: {
            fontSize: 12
        }
    },
    // 分隔线
    splitLine: {
        // 默认显示，属性show控制显示与否
        show: true,
        // 属性lineStyle（详见lineStyle）控制线条样式
        lineStyle: {
            color: ['#ccc'],
            width: 1,
            type: 'solid'
        }
    },
    // 分隔区域
    splitArea: {
        // 默认不显示，属性show控制显示与否
        show: false,
        // 属性areaStyle（详见areaStyle）控制区域样式
        areaStyle: {
            color: ['rgba(250,250,250,0.3)','rgba(200,200,200,0.3)']
        }
    }
};

var categoryAxis = echarts.util.merge({
    // 类目起始和结束两端空白策略
    boundaryGap: true,
    // splitArea: {
        // show: false
    // },
    splitLine: {
        show: true
    },
    // 坐标轴小标记
    axisTick: {
        // If tick is align with label when boundaryGap is true
        // Default with axisTick
        alignWithLabel: false,
        interval: 'auto'
    },
    // 坐标轴文本标签，详见axis.axisLabel
    axisLabel: {
        interval: 'auto'
    }
}, defaultOption);

var valueAxis = echarts.util.merge({
    // 数值起始和结束两端空白策略
    boundaryGap: [0, 0],
    // 最小值, 设置成 'dataMin' 则从数据中计算最小值
    // min: null,
    // 最大值，设置成 'dataMax' 则从数据中计算最大值
    // max: null,
    // 脱离0值比例，放大聚焦到最终_min，_max区间
    // scale: false,
    // 分割段数，默认为5
    splitNumber: 4
    // Minimum interval
    // minInterval: null
}, defaultOption);

// FIXME
var timeAxis = echarts.util.defaults({
    scale: true,
    min: 'dataMin',
    max: 'dataMax'
}, valueAxis);
var logAxis = echarts.util.defaults({
    logBase: 10
}, valueAxis);
logAxis.scale = true;

module.exports = {
    categoryAxis: categoryAxis,
    valueAxis: valueAxis,
    timeAxis: timeAxis,
    logAxis: logAxis
};