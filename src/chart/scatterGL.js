import echarts from 'echarts/lib/echarts';

import './scatterGL/ScatterGLSeries';
import './scatterGL/ScatterGLView';

import symbolVisual from 'echarts/lib/visual/symbol';
import opacityVisual from './common/opacityVisual';

echarts.registerVisual(symbolVisual('scatterGL', 'circle', null));

echarts.registerVisual(opacityVisual('scatterGL'));

echarts.registerLayout({
    seriesType: 'scatterGL',
    reset: function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;

        var progress;
        if (coordSys) {
            var dims = coordSys.dimensions;
            var pt = [];
            if (dims.length === 1) {
                progress = function (params, data) {
                    var points = new Float32Array((params.end - params.start) * 2);
                    for (var idx = params.start; idx < params.end; idx++) {
                        var offset = (idx - params.start) * 2;
                        var x = data.get(dims[0], idx);
                        var pt = coordSys.dataToPoint(x);
                        points[offset] = pt[0];
                        points[offset + 1] = pt[1];
                    }
                    data.setLayout('points', points);
                };
            }
            else if (dims.length === 2) {
                progress = function (params, data) {
                    var points = new Float32Array((params.end - params.start) * 2);
                    for (var idx = params.start; idx < params.end; idx++) {
                        var offset = (idx - params.start) * 2;
                        var x = data.get(dims[0], idx);
                        var y = data.get(dims[1], idx);
                        pt[0] = x;
                        pt[1] = y;

                        pt = coordSys.dataToPoint(pt);
                        points[offset] = pt[0];
                        points[offset + 1] = pt[1];
                    }
                    data.setLayout('points', points);
                };
            }
        }

        return { progress: progress };
    }
});