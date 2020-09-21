import * as echarts from 'echarts/esm/echarts';

import './bar3D/bar3DLayout';

import './bar3D/Bar3DView';
import './bar3D/Bar3DSeries';

echarts.registerProcessor(function (ecModel, api) {
    ecModel.eachSeriesByType('bar3d', function (seriesModel) {
        var data = seriesModel.getData();
        data.filterSelf(function (idx) {
            return data.hasValue(idx);
        });
    });
});