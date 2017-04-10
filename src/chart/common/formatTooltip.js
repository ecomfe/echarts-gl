var echarts = require('echarts/lib/echarts');

module.exports = function (seriesModel, dataIndex) {
    function formatArrayValue(value) {
        var data = seriesModel.getData();
        var result = [];
        var coordSys = seriesModel.coordinateSystem;
        var customDimensions = seriesModel.get('dimensions') || [];
        var coordSysDimensions = (coordSys && coordSys.dimensions) || [];
        var dataDimensions = data.dimensions;

        echarts.util.each(value, function (val, idx) {
            var dimInfo = data.getDimensionInfo(idx);
            var dimType = dimInfo && dimInfo.type;
            var dimName = customDimensions[idx] || coordSysDimensions[idx] || dataDimensions[idx];
            var valStr;

            if (dimType === 'ordinal') {
                valStr = val + '';
            }
            else if (dimType === 'time') {
                valStr = echarts.format.formatTime('yyyy/MM/dd hh:mm:ss', val);
            }
            else {
                valStr = echarts.format.addCommas(val);
            }

            valStr && result.push(echarts.format.encodeHTML(dimName + ': ' + valStr));
        });

        return result.join('<br />');
    }

    var data = seriesModel.getData();

    var value = seriesModel.getRawValue(dataIndex);
    var formattedValue = echarts.util.isArray(value)
        ? formatArrayValue(value)
        : echarts.format.encodeHTML(echarts.format.addCommas(value));
    var name = data.getName(dataIndex);

    var color = data.getItemVisual(dataIndex, 'color');
    if (echarts.util.isObject(color) && color.colorStops) {
        color = (color.colorStops[0] || {}).color;
    }
    color = color || 'transparent';

    var colorEl = '<span style="display:inline-block;margin-right:5px;'
        + 'border-radius:10px;width:9px;height:9px;background-color:' + echarts.format.encodeHTML(color) + '"></span>';

    var seriesName = seriesModel.name;
    // FIXME
    if (seriesName === '\0-') {
        // Not show '-'
        seriesName = '';
    }
    return (seriesName && (colorEl + echarts.format.encodeHTML(seriesName) + '<br />'))
            + (name && (name + '<br />'))
            + formattedValue;
};