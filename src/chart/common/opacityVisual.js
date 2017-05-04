module.exports = function (seriesType, ecModel, api) {
    ecModel.eachSeriesByType(seriesType, function (seriesModel) {
        var data = seriesModel.getData();
        var opacityAccessPath = seriesModel.visualColorAccessPath.split('.');
        opacityAccessPath[opacityAccessPath.length - 1] ='opacity';

        var opacity = seriesModel.get(opacityAccessPath);

        data.setVisual('opacity', opacity == null ? 1 : opacity);

        if (data.hasItemOption) {
            data.each(function (idx) {
                var itemModel = data.getItemModel(idx);
                var opacity = itemModel.get(opacityAccessPath);
                if (opacity != null) {
                    data.setItemVisual(idx, 'opacity', opacity);
                }
            });
        }
    });
};