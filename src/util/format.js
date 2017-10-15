import echarts from 'echarts/lib/echarts';

var formatUtil = {};
formatUtil.getFormattedLabel = function (seriesModel, dataIndex, status, dataType, dimIndex) {
    status = status || 'normal';
    var data = seriesModel.getData(dataType);
    var itemModel = data.getItemModel(dataIndex);

    var params = seriesModel.getDataParams(dataIndex, dataType);
    if (dimIndex != null && (params.value instanceof Array)) {
        params.value = params.value[dimIndex];
    }

    var formatter = itemModel.get(status === 'normal' ? ['label', 'formatter'] : ['emphasis', 'label', 'formatter']);
    if (formatter == null) {
        formatter = itemModel.get(['label', 'formatter']);
    }
    var text;
    if (typeof formatter === 'function') {
        params.status = status;
        text = formatter(params);
    }
    else if (typeof formatter === 'string') {
        text = echarts.format.formatTpl(formatter, params);
    }
    return text;
};

/**
 * If value is not array, then convert it to array.
 * @param  {*} value
 * @return {Array} [value] or value
 */
formatUtil.normalizeToArray = function (value) {
    return value instanceof Array
        ? value
        : value == null
        ? []
        : [value];
};

export default formatUtil;