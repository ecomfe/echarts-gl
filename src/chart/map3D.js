import echarts from 'echarts/lib/echarts';
import Geo3D from '../coord/geo3D/Geo3D';

import './map3D/Map3DSeries';
import './map3D/Map3DView';

import geo3DCreator from '../coord/geo3DCreator';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(echarts.util.curry(opacityVisual, 'map3D'));

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

function transformPolygon(poly, mapboxCoordSys) {
    var newPoly = [];
    for (var k = 0; k < poly.length; k++) {
        newPoly.push(mapboxCoordSys.dataToPoint(poly[k]));
    }
    return newPoly;
}

function transformGeo3DOnMapbox(geo3D, mapboxCoordSys) {
    for (var i = 0; i < geo3D.regions.length; i++) {
        var region = geo3D.regions[i];
        for (var k = 0; k < region.geometries.length; k++) {
            var geo = region.geometries[k];
            var interiors = geo.interiors;
            geo.exterior = transformPolygon(geo.exterior, mapboxCoordSys);
            if (interiors && interiors.length) {
                for (var m = 0; m < interiors.length; m++) {
                    geo.interiors[m] = transformPolygon(interiors[m], mapboxCoordSys);
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
            var geo3D = geo3DCreator.createGeo3D(seriesModel);
            geo3D.extrudeY = false;
            transformGeo3DOnMapbox(geo3D, seriesModel.coordinateSystem);

            seriesModel.getData().setLayout('geo3D', geo3D);
        }
    });
});