var Geo3D = require('./geo3D/Geo3D');
var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var ViewGL = require('../core/ViewGL');

function resizeGeo3D(geo3DModel, api) {
    // Use left/top/width/height
    var boxLayoutOption = geo3DModel.getBoxLayoutParams();

    var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
        width: api.getWidth(),
        height: api.getHeight()
    });

    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, api.getDevicePixelRatio());

    var geoRect = this.getGeoBoundingRect();
    var aspect = geoRect.width / geoRect.height * 0.75;

    var width = geo3DModel.get('boxWidth');
    var depth = geo3DModel.get('boxDepth');
    var height = geo3DModel.get('boxHeight');
    if (height == null) {
        height = 5;
    }
    if (isNaN(width) && isNaN(depth)) {
        // Default to have 100 width
        width = 100;
    }
    if (isNaN(depth)) {
        depth = width / aspect;
    }
    else if (isNaN(width)) {
        width = depth / aspect;
    }

    this.setSize(width, height, depth);
}


if (__DEV__) {
    var mapNotExistsError = function (name) {
        console.error('Map ' + name + ' not exists. You can download map file on http://echarts.baidu.com/download-map.html');
    };
}

var geo3DCreator = {

    dimensions: Geo3D.prototype.dimensions,

    create: function (ecModel, api) {

        var geo3DList = [];

        if (!echarts.getMap) {
            throw new Error('geo3D component depends on geo component')
        }

        ecModel.eachComponent('geo3D', function (geo3DModel, idx) {

            var name = geo3DModel.get('map');
            var mapData = echarts.getMap(name);
            if (__DEV__) {
                if (!mapData) {
                    mapNotExistsError(name);
                }
            }

            // FIXME
            geo3DModel.__viewGL = geo3DModel.__viewGL || new ViewGL();


            var geo3D = new Geo3D(
                name + idx, name,
                mapData && mapData.geoJson, mapData && mapData.specialAreas,
                geo3DModel.get('nameMap')
            );
            geo3D.viewGL = geo3DModel.__viewGL;

            geo3DModel.coordinateSystem = geo3D;
            geo3DList.push(geo3D);

            // Inject resize
            geo3D.resize = resizeGeo3D;
            geo3D.resize(geo3DModel, api);
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'geo3D') {
                var geo3DIndex = seriesModel.get('geo3DIndex');
                var coordSys = geo3DList[geo3DIndex];

                if (!coordSys) {
                    console.warn('geo3D %s not exists', geo3DIndex);
                }

                seriesModel.coordinateSystem = coordSys;
            }
        });
    }
};

echarts.registerCoordinateSystem('geo3D', geo3DCreator);

module.exports = geo3DCreator;