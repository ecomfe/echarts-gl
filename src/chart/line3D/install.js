// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import Line3DSeries from './Line3DSeries';
import Line3DView from './Line3DView';

export function install(registers) {
    registers.registerChartView(Line3DView);
    registers.registerSeriesModel(Line3DSeries);

    registers.registerLayout(function (ecModel, api) {
        ecModel.eachSeriesByType('line3D', function (seriesModel) {
            var data = seriesModel.getData();
            var coordSys = seriesModel.coordinateSystem;

            if (coordSys) {
                if (coordSys.type !== 'cartesian3D') {
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('line3D needs cartesian3D coordinateSystem');
                    }
                    return;
                }
                var points = new Float32Array(data.count() * 3);

                var item = [];
                var out = [];

                var coordDims = coordSys.dimensions;
                var dims = coordDims.map(function (coordDim) {
                    return seriesModel.coordDimToDataDim(coordDim)[0];
                });

                if (coordSys) {
                    data.each(dims, function (x, y, z, idx) {
                        item[0] = x;
                        item[1] = y;
                        item[2] = z;

                        coordSys.dataToPoint(item, out);
                        points[idx * 3] = out[0];
                        points[idx * 3 + 1] = out[1];
                        points[idx * 3 + 2] = out[2];
                    });
                }
                data.setLayout('points', points);
            }
        });
    });
}