var echarts = require('echarts/lib/echarts');

require('./bar3d/Bar3dSeries');
require('./bar3d/Bar3dView');

require('./bar3d/bar3dLayout');

echarts.registerProcessor(function (ecModel, api) {

    ecModel.eachSeriesByType('bar3d', function (seriesModel) {
        var data = seriesModel.getData();
        data.filterSelf(function (idx) {
            return data.hasValue(idx);
        });
    });
});