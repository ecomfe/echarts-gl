var Geo3D = require('./geo3D/Geo3D');
var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var ViewGL = require('../core/ViewGL');
var retrieve = require('../util/retrieve');

function resizeGeo3D(geo3DModel, api) {
    // Use left/top/width/height
    var boxLayoutOption = geo3DModel.getBoxLayoutParams();

    var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
        width: api.getWidth(),
        height: api.getHeight()
    });

    // Flip Y
    viewport.y = api.getHeight() - viewport.y - viewport.height;

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

        function createGeo3D(componentModel, idx) {
            var name = componentModel.get('map');
            var mapData = echarts.getMap(name);
            if (__DEV__) {
                if (!mapData) {
                    mapNotExistsError(name);
                }
            }

            // FIXME
            componentModel.__viewGL = componentModel.__viewGL || new ViewGL();

            var geo3D = new Geo3D(
                name + idx, name,
                mapData && mapData.geoJson, mapData && mapData.specialAreas,
                componentModel.get('nameMap')
            );
            geo3D.viewGL = componentModel.__viewGL;

            componentModel.coordinateSystem = geo3D;
            geo3DList.push(geo3D);

            // Inject resize
            geo3D.resize = resizeGeo3D;
            geo3D.resize(componentModel, api);
        }

        ecModel.eachComponent('geo3D', function (geo3DModel, idx) {
            createGeo3D(geo3DModel, idx);
        });

        ecModel.eachSeriesByType('map3D', function (map3DModel, idx) {
            createGeo3D(map3DModel, idx);
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'geo3D') {
                var geo3DModel = seriesModel.getReferringComponents('geo3D')[0];
                if (!geo3DModel) {
                    geo3DModel = ecModel.getComponent('geo3D');
                }

                if (!geo3DModel) {
                    throw new Error('geo "' + retrieve.firstNotNull(
                        seriesModel.get('geo3DIndex'),
                        seriesModel.get('geo3DId'),
                        0
                    ) + '" not found');
                }

                seriesModel.coordinateSystem = geo3DModel.coordinateSystem;
            }
        });
    }
};

echarts.registerCoordinateSystem('geo3D', geo3DCreator);

module.exports = geo3DCreator;