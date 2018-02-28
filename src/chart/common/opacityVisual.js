export default function (seriesType, ecModel, api) {
    return {
        seriesType: seriesType,
        reset: function (seriesModel, ecModel) {
            var data = seriesModel.getData();
            var opacityAccessPath = seriesModel.visualColorAccessPath.split('.');
            opacityAccessPath[opacityAccessPath.length - 1] ='opacity';

            var opacity = seriesModel.get(opacityAccessPath);

            data.setVisual('opacity', opacity == null ? 1 : opacity);

            function dataEach(data, idx) {
                var itemModel = data.getItemModel(idx);
                var opacity = itemModel.get(opacityAccessPath, true);
                if (opacity != null) {
                    data.setItemVisual(idx, 'opacity', opacity);
                }
            }

            return {
                dataEach: data.hasItemOption ? dataEach : null
            };
        }
    };
}