import * as echarts from 'echarts/lib/echarts';
import { getItemVisualColor } from '../../util/visual';

function otherDimToDataDim (data, otherDim) {
    var dataDim = [];
    echarts.util.each(data.dimensions, function (dimName) {
        var dimItem = data.getDimensionInfo(dimName);
        var otherDims = dimItem.otherDims;
        var dimIndex = otherDims[otherDim];
        if (dimIndex != null && dimIndex !== false) {
            dataDim[dimIndex] = dimItem.name;
        }
    });
    return dataDim;
}

export default function (seriesModel, dataIndex, multipleSeries) {
    function formatArrayValue(value) {
        var vertially = true;

        var result = [];
        var tooltipDims = otherDimToDataDim(data, 'tooltip');

        tooltipDims.length
            ? echarts.util.each(tooltipDims, function (dimIdx) {
                setEachItem(data.get(dimIdx, dataIndex), dimIdx);
            })
            // By default, all dims is used on tooltip.
            : echarts.util.each(value, setEachItem);

        function setEachItem(val, dimIdx) {
            var dimInfo = data.getDimensionInfo(dimIdx);
            // If `dimInfo.tooltip` is not set, show tooltip.
            if (!dimInfo || dimInfo.otherDims.tooltip === false) {
                return;
            }
            var dimType = dimInfo.type;
            var valStr = (vertially ? '- ' + (dimInfo.tooltipName || dimInfo.name) + ': ' : '')
                + (dimType === 'ordinal'
                    ? val + ''
                    : dimType === 'time'
                    ? (multipleSeries ? '' : echarts.format.formatTime('yyyy/MM/dd hh:mm:ss', val))
                    : echarts.format.addCommas(val)
                );
            valStr && result.push(echarts.format.encodeHTML(valStr));
        }

        return (vertially ? '<br/>' : '') + result.join(vertially ? '<br/>' : ', ');
    }

    var data = seriesModel.getData();

    var value = seriesModel.getRawValue(dataIndex);
    var formattedValue = echarts.util.isArray(value)
        ? formatArrayValue(value) : echarts.format.encodeHTML(echarts.format.addCommas(value));
    var name = data.getName(dataIndex);

    var color = getItemVisualColor(data, dataIndex);
    if (echarts.util.isObject(color) && color.colorStops) {
        color = (color.colorStops[0] || {}).color;
    }
    color = color || 'transparent';

    var colorEl = echarts.format.getTooltipMarker(color);

    var seriesName = seriesModel.name;
    // FIXME
    if (seriesName === '\0-') {
        // Not show '-'
        seriesName = '';
    }
    seriesName = seriesName
        ? echarts.format.encodeHTML(seriesName) + (!multipleSeries ? '<br/>' : ': ')
        : '';
    return !multipleSeries
        ? seriesName + colorEl
            + (name
                ? echarts.format.encodeHTML(name) + ': ' + formattedValue
                : formattedValue
            )
        : colorEl + seriesName + formattedValue;
};