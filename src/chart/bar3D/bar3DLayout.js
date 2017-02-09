var echarts = require('echarts/lib/echarts');

function globeLayout(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var extent = data.getDataExtent('z', true);
    var heightExtent = [seriesModel.get('minHeight'), seriesModel.get('maxHeight')];
    var isZeroExtent = Math.abs(extent[1] - extent[0]) < 1e-10;
    data.each(['x', 'y', 'z'], function (lng, lat, val, idx) {
        var height = isZeroExtent ? heightExtent[1] : echarts.number.linearMap(val, extent, heightExtent);
        var start = coordSys.dataToPoint([lng, lat, 0]);
        var end = coordSys.dataToPoint([lng, lat, height]);
        data.setItemLayout(idx, [start, end]);
    });
}
echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('bar3D', function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys.type === 'globe') {
            globeLayout(seriesModel, coordSys);
        }
    });
});