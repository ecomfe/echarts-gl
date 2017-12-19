import echarts from 'echarts/lib/echarts';

import './bar3D/bar3DLayout';

import './bar3D/Bar3DView';
import './bar3D/Bar3DSeries';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('bar3D'));

echarts.registerProcessor(function (ecModel, api) {
    ecModel.eachSeriesByType('bar3d', function (seriesModel) {
        var data = seriesModel.getData();
        data.filterSelf(function (idx) {
            return data.hasValue(idx);
        });
    });
});