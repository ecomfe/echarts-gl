var echarts = require('echarts/lib/echarts');

require('./scatter3D/Scatter3DSeries');
require('./scatter3D/Scatter3DView');

echarts.registerVisual(echarts.util.curry(
    require('echarts/lib/visual/symbol'), 'scatter3D', 'circle', null
));

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'scatter3D'
));

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('scatter3D', function (seriesModel) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;

        if (coordSys) {
            var dims = coordSys.dimensions;
            if (dims.length < 3) {
                if (__DEV__) {
                    console.error('scatter3D needs 3D coordinateSystem');
                }
                return;
            }
            var points = new Float32Array(data.count() * 3);

            var item = [];
            var out = [];

            var isGlobe = coordSys.type === 'globe';
            var isGeo3D = coordSys.type === 'geo3D';
            var distanceToGlobe = seriesModel.get('distanceToGlobe');
            var distanceToGeo3D = seriesModel.get('distanceToGeo3D');
            if (coordSys) {
                data.each(['x', 'y', 'z'], function (x, y, z, idx) {
                    item[0] = x;
                    item[1] = y;
                    if (isGlobe) {
                        // TODO Bump map
                        item[2] = distanceToGlobe;
                    }
                    else if (isGeo3D) {
                        // TODO Region height.
                        item[2] = coordSys.size[1] + distanceToGeo3D;
                    }
                    else {
                        item[2] = z;
                    }
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