module.exports = function (api) {

    this.updateTooltip = function (seriesModel, dataIndex, x, y) {
        if (dataIndex >= 0) {
            this.showTooltip(seriesModel, dataIndex, x, y);
        }
        else {
            this.hideTooltip();
        }
    };

    this.showTooltip = function (seriesModel, dataIndex, x, y) {
        var params = seriesModel.getDataParams(dataIndex);
        var defaultHTML = seriesModel.formatTooltip(dataIndex);

        api.dispatchAction({
            type: 'showTip',
            x: x,
            y: y,
            tooltip: {
                formatterParams: params,
                content: defaultHTML
            }
        });
    };

    this.hideTooltip = function () {
        api.dispatchAction({
            type: 'hideTip'
        });
    };
};