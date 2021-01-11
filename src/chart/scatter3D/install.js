// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import Scatter3DSeries from './Scatter3DSeries';
import Scatter3DView from './Scatter3DView';

export function install(registers) {
    registers.registerChartView(Scatter3DView);
    registers.registerSeriesModel(Scatter3DSeries);

    registers.registerLayout({
        seriesType: 'scatter3D',
        reset: function (seriesModel) {
            var coordSys = seriesModel.coordinateSystem;

            if (coordSys) {
                var coordDims = coordSys.dimensions;
                if (coordDims.length < 3) {
                    if (process.env.NODE_ENV !== 'production') {
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
}