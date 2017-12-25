import echarts from 'echarts/lib/echarts';

import './scatter3D/Scatter3DSeries';
import './scatter3D/Scatter3DView';

import symbolVisual from 'echarts/lib/visual/symbol';
import opacityVisual from './common/opacityVisual';
echarts.registerVisual(symbolVisual('scatter3D', 'circle', null));

echarts.registerVisual(opacityVisual('scatter3D'));

echarts.registerLayout({
    seriesType: 'scatter3D',
    reset: function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;

        if (coordSys) {
            var coordDims = coordSys.dimensions;
            if (coordDims.length < 3) {
                if (__DEV__) {
                    console.error('scatter3D needs 3D coordinateSystem');
                }
                return;
            }
            var dims = coordDims.map(function (coordDim) {
                return seriesModel.coordDimToDataDim(coordDim)[0];
            });

            var item = [];
            var out = [];

            return {
                progress: function (params, data) {
                    var points = new Float32Array((params.end - params.start) * 3);
                    for (var idx = params.start; idx < params.end; idx++) {
                        var idx3 = (idx - params.start) * 3;
                        item[0] = data.get(dims[0], idx);
                        item[1] = data.get(dims[1], idx);
                        item[2] = data.get(dims[2], idx);
                        coordSys.dataToPoint(item, out);
                        points[idx3] = out[0];
                        points[idx3 + 1] = out[1];
                        points[idx3 + 2] = out[2];
                    }
                    data.setLayout('points', points);
                }
            };
        }
    }
});