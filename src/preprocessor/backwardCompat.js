var echarts = require('echarts/lib/echarts');

var GL_SERIES = ['bar3D', 'line3D', 'map3D', 'scatter3D', 'surface', 'lines3D', 'scatterGL', 'scatter3D'];

function convertNormalEmphasis(option, optType) {
    if (option && option[optType] && (option[optType].normal || option[optType].emphasis)) {
        var normalOpt = option[optType].normal;
        var emphasisOpt = option[optType].emphasis;

        if (normalOpt) {
            option[optType] = normalOpt;
        }
        if (emphasisOpt) {
            option.emphasis = option.emphasis || {};
            option.emphasis[optType] = emphasisOpt;
        }
    }
}

function convertNormalEmphasisForEach(option) {
    convertNormalEmphasis(option, 'itemStyle');
    convertNormalEmphasis(option, 'lineStyle');
    convertNormalEmphasis(option, 'areaStyle');
    convertNormalEmphasis(option, 'label');
}

module.exports = function (option) {
    echarts.util.each(option.series, function (series) {
        if (echarts.util.indexOf(GL_SERIES, series.type) >= 0) {
            convertNormalEmphasisForEach(series);
        }
    });

    convertNormalEmphasis(option.geo3D);
};