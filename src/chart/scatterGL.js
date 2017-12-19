import echarts from 'echarts/lib/echarts';

import './scatterGL/ScatterGLSeries';
import './scatterGL/ScatterGLView';

import symbolVisual from 'echarts/lib/visual/symbol';
import opacityVisual from './common/opacityVisual';

echarts.registerVisual(symbolVisual('scatterGL', 'circle', null));

echarts.registerVisual(opacityVisual('scatterGL'));

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('scatterGL', function (seriesModel) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;

        if (coordSys) {
            var dims = coordSys.dimensions;
            var points = new Float32Array(data.count() * 2);
            if (dims.length === 1) {
                data.each(dims[0], function (x, idx) {
                    var pt = coordSys.dataToPoint(x);
                    points[idx * 2] = pt[0];
                    points[idx * 2 + 1] = pt[1];
                });
            }
            else if (dims.length === 2) {
                var item = [];
                data.each(dims, function (x, y, idx) {
                    item[0] = x;
                    item[1] = y;

                    var pt = coordSys.dataToPoint(item);
                    points[idx * 2] = pt[0];
                    points[idx * 2 + 1] = pt[1];
                });
            }

            data.setLayout('points', points);
        }
    });
});