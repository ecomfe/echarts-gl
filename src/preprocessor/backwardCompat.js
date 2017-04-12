var echarts = require('echarts/lib/echarts');

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
        convertNormalEmphasisForEach(series);
    });

    convertNormalEmphasis(option.geo3D);
};