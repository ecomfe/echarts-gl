import echarts from 'echarts/lib/echarts';

var defaultOption = {
    show: true,

    grid3DIndex: 0,
    // 反向坐标轴
    inverse: false,

    // 坐标轴名字
    name: '',
    // 坐标轴名字位置
    nameLocation: 'middle',

    nameTextStyle: {
        fontSize: 16
    },
    // 文字与轴线距离
    nameGap: 20,

    axisPointer: {},

    axisLine: {},
    // 坐标轴小标记
    axisTick: {},
    axisLabel: {},
    // 分隔区域
    splitArea: {}
};

var categoryAxis = echarts.util.merge({
    // 类目起始和结束两端空白策略
    boundaryGap: true,
    // splitArea: {
        // show: false
    // },
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
    },
    axisPointer: {
        label: {
            show: false
        }
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
    splitNumber: 5,
    // Minimum interval
    // minInterval: null

    axisPointer: {
        label: {
        }
    }
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

export default {
    categoryAxis3D: categoryAxis,
    valueAxis3D: valueAxis,
    timeAxis3D: timeAxis,
    logAxis3D: logAxis
};