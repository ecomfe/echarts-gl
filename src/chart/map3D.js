var echarts = require('echarts/lib/echarts');
var Geo3D = require('../coord/geo3D/Geo3D');

require('./map3D/Map3DSeries');
require('./map3D/Map3DView');

require('../coord/geo3DCreator');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'map3D'
));

echarts.registerAction({
    type: 'map3DChangeCamera',
    event: 'map3dcamerachanged',
    update: 'series:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'series', subType: 'map3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});

if (__DEV__) {
    var mapNotExistsError = function (name) {
        console.error('Map ' + name + ' not exists. You can download map file on http://echarts.baidu.com/download-map.html');
    };
}

function createGeo3D(seriesModel) {
    if (!echarts.getMap) {
        throw new Error('geo3D component depends on geo component');
    }
    var name = seriesModel.get('map');
    var mapData = echarts.getMap(name);
    
    if (__DEV__) {
        if (!mapData) {
            mapNotExistsError(name);
        }
    }
    return new Geo3D(
        name, name,
        mapData && mapData.geoJson, mapData && mapData.specialAreas,
        seriesModel.get('nameMap')
    );
}

function transformPolygon(poly, mapboxCoordSys) {
    var pt = [];
    for (var k = 0; k < poly.length; k++) {
        mapboxCoordSys.dataToPoint(poly[k], pt);
        poly[k][0] = pt[0];
        poly[k][1] = pt[1];
    }
}

function transformGeo3DOnMapbox(geo3D, mapboxCoordSys) {
    for (var i = 0; i < geo3D.regions.length; i++) {
        var region = geo3D.regions[i];
        for (var k = 0; k < region.geometries.length; k++) {
            var geo = region.geometries[k];
            var interiors = geo.interiors;
            transformPolygon(geo.exterior, mapboxCoordSys);
            if (interiors && interiors.length) {
                for (var m = 0; m < interiors.length; m++) {
                    transformPolygon(interiors[m], mapboxCoordSys);
                }
            }
        }
        if (region.center) {
            region.center = mapboxCoordSys.dataToPoint(region.center);
        }
    }
}

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('map3D', function (seriesModel) {
        var coordSys = seriesModel.get('coordinateSystem');
        if (coordSys === 'mapbox') {
            var geo3D = createGeo3D(seriesModel);
            geo3D.extrudeY = false;
            transformGeo3DOnMapbox(geo3D, seriesModel.coordinateSystem);

            seriesModel.getData().setLayout('geo3D', geo3D);
        }
    });
});