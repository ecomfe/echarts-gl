var echarts = require('echarts/lib/echarts');
var Vector3 = require('qtek/lib/math/Vector3');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;
var cartesian3DLayout = require('./cartesian3DLayout');

function globeLayout(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var extent = data.getDataExtent('z', true);
    var heightExtent = [seriesModel.get('minHeight'), seriesModel.get('maxHeight')];
    var isZeroExtent = Math.abs(extent[1] - extent[0]) < 1e-10;
    var barSize = seriesModel.get('barSize');
    if (barSize == null) {
        var perimeter = coordSys.radius * Math.PI * 2;
        // PENDING, data density
        barSize = [
            perimeter / 720,
            perimeter / 720
        ];
    }
    else if (!echarts.util.isArray(barSize)) {
        barSize = [barSize, barSize];
    }
    data.each(['x', 'y', 'z'], function (lng, lat, val, idx) {
        var height = isZeroExtent ? heightExtent[1] : echarts.number.linearMap(val, extent, heightExtent);
        var start = coordSys.dataToPoint([lng, lat, 0]);
        var end = coordSys.dataToPoint([lng, lat, height]);
        var dir = vec3.sub([], end, start);
        var size = [barSize[0], height, barSize[1]];
        data.setItemLayout(idx, [start, dir, size]);
    });

    data.setLayout('orient', Vector3.UP._array);
}

function geo3DLayout(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var extent = data.getDataExtent('z', true);
    var heightExtent = [seriesModel.get('minHeight'), seriesModel.get('maxHeight')];
    var isZeroExtent = Math.abs(extent[1] - extent[0]) < 1e-10;
    var barSize = seriesModel.get('barSize');
    if (barSize == null) {
        var size = Math.min(coordSys.size[0], coordSys.size[2]);
        // PENDING, data density
        barSize = [
            size / Math.sqrt(data.count()),
            size / Math.sqrt(data.count())
        ];
    }
    else if (!echarts.util.isArray(barSize)) {
        barSize = [barSize, barSize];
    }
    var dir = [0, 1, 0];
    data.each(['x', 'y', 'z'], function (lng, lat, val, idx) {
        var height = isZeroExtent ? heightExtent[1] : echarts.number.linearMap(val, extent, heightExtent);
        var start = coordSys.dataToPoint([lng, lat, 0]);
        var size = [barSize[0], height, barSize[1]];
        data.setItemLayout(idx, [start, dir, size]);
    });

    data.setLayout('orient', [1, 0, 0]);
}

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('bar3D', function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;
        var coordSysType = coordSys && coordSys.type;
        if (coordSysType === 'globe') {
            globeLayout(seriesModel, coordSys);
        }
        else if (coordSysType === 'cartesian3D') {
            cartesian3DLayout(seriesModel, coordSys);
        }
        else if (coordSysType === 'geo3D') {
            geo3DLayout(seriesModel, coordSys);
        }
        else {
            if (__DEV__) {
                if (!coordSys) {
                    console.error('bar3D does\'nt have coordinate system.');
                }
                else {
                    console.error('bar3D does\'nt support coordinate system ' + coordSys.type);
                }
            }
        }
    });
});