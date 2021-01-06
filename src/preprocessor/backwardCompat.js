import * as echarts from 'echarts/lib/echarts';

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

function removeTextStyleInAxis(axesOpt) {
    if (!axesOpt) {
        return;
    }
    if (!(axesOpt instanceof Array)) {
        axesOpt = [axesOpt];
    }
    echarts.util.each(axesOpt, function (axisOpt) {
        if (axisOpt.axisLabel) {
            var labelOpt = axisOpt.axisLabel;
            Object.assign(labelOpt, labelOpt.textStyle);
            labelOpt.textStyle = null;
        }
    });
}

export default function (option) {
    echarts.util.each(option.series, function (series) {
        if (echarts.util.indexOf(GL_SERIES, series.type) >= 0) {
            convertNormalEmphasisForEach(series);

            // Compatitable with original mapbox
            if (series.coordinateSystem === 'mapbox') {
                series.coordinateSystem = 'mapbox3D';
                option.mapbox3D = option.mapbox;
            }
        }
    });

    removeTextStyleInAxis(option.xAxis3D);
    removeTextStyleInAxis(option.yAxis3D);
    removeTextStyleInAxis(option.zAxis3D);
    removeTextStyleInAxis(option.grid3D);

    convertNormalEmphasis(option.geo3D);
};