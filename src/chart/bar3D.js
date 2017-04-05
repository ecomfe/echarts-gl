var echarts = require('echarts/lib/echarts');

require('./bar3D/bar3DLayout');

require('./bar3D/Bar3DView');
require('./bar3D/Bar3DSeries');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'bar3D'
));

echarts.registerProcessor(function (ecModel, api) {
    ecModel.eachSeriesByType('bar3d', function (seriesModel) {
        var data = seriesModel.getData();
        data.filterSelf(function (idx) {
            return data.hasValue(idx);
        });
    });
});