import echarts from 'echarts/lib/echarts';

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('surface', function (surfaceModel) {
        var cartesian = surfaceModel.coordinateSystem;
        if (!cartesian || cartesian.type !== 'cartesian3D') {
            if (__DEV__) {
                console.error('Surface chart only support cartesian3D coordinateSystem');
            }
        }
        var data = surfaceModel.getData();
        var points = new Float32Array(3 * data.count());
        var nanPoint = [NaN, NaN, NaN];

        if (cartesian && cartesian.type === 'cartesian3D') {
            var coordDims = cartesian.dimensions;
            var dims = coordDims.map(function (coordDim) {
                return surfaceModel.coordDimToDataDim(coordDim)[0];
            });
            data.each(dims, function (x, y, z, idx) {
                var pt;
                if (!data.hasValue(idx)) {
                    pt = nanPoint;
                }
                else {
                    pt = cartesian.dataToPoint([x, y, z]);
                }
                points[idx * 3] = pt[0];
                points[idx * 3 + 1] = pt[1];
                points[idx * 3 + 2] = pt[2];
            });
        }
        data.setLayout('points', points);
    });
});