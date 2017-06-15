var Mapbox = require('./mapbox/Mapbox');
var echarts = require('echarts/lib/echarts');
var retrieve = require('../util/retrieve');
var graphicGL = require('../util/graphicGL');
var ViewGL = require('../core/ViewGL');

function resizeMapbox(mapboxModel, api) {
    var width = api.getWidth();
    var height = api.getHeight();
    var dpr = api.getDevicePixelRatio();
    this.viewGL.setViewport(0, 0, width, height, dpr);

    this.width = width;
    this.height = height;

    this.altitudeScale = mapboxModel.get('altitudeScale');

    this.boxHeight = mapboxModel.get('boxHeight');
    // this.updateTransform();
}

var mapboxCreator = {


    dimensions: Mapbox.prototype.dimensions,

    create: function (ecModel, api) {
        var mapboxList = [];

        ecModel.eachComponent('mapbox', function (mapboxModel) {
            var viewGL = mapboxModel.__viewGL;
            if (!viewGL) {
                viewGL = mapboxModel.__viewGL = new ViewGL();
                viewGL.setRootNode(new graphicGL.Node());
            }

            var mapboxCoordSys = new Mapbox();
            mapboxCoordSys.viewGL = mapboxModel.__viewGL;
            // Inject resize
            mapboxCoordSys.resize = resizeMapbox;
            mapboxCoordSys.resize(mapboxModel, api);

            mapboxList.push(mapboxCoordSys);

            mapboxModel.coordinateSystem = mapboxCoordSys;

            mapboxCoordSys.setCameraOption(
                mapboxModel.getMapboxCameraOption()
            );
        });

        var altitudeDataExtent = [];
        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'mapbox') {
                var mapboxModel = seriesModel.getReferringComponents('mapbox')[0];
                if (!mapboxModel) {
                    mapboxModel = ecModel.getComponent('mapbox');
                }

                if (!mapboxModel) {
                    throw new Error('mapbox "' + retrieve.firstNotNull(
                        seriesModel.get('mapboxIndex'),
                        seriesModel.get('mapboxId'),
                        0
                    ) + '" not found');
                }

                seriesModel.coordinateSystem = mapboxModel.coordinateSystem;

                if (mapboxModel.get('boxHeight') === 'auto') {
                    return;
                }

                var data = seriesModel.getData();
                var mapboxIndex = mapboxModel.componentIndex;
                var altDim = seriesModel.coordDimToDataDim('alt')[0];
                if (altDim) {
                    var dataExtent = data.getDataExtent(altDim);
                    altitudeDataExtent[mapboxIndex] = altitudeDataExtent[mapboxIndex] || [Infinity, -Infinity];
                    altitudeDataExtent[mapboxIndex][0] = Math.min(
                        altitudeDataExtent[mapboxIndex][0], dataExtent[0]
                    );
                    altitudeDataExtent[mapboxIndex][1] = Math.max(
                        altitudeDataExtent[mapboxIndex][1], dataExtent[1]
                    );
                }
            }
        });

        ecModel.eachComponent('mapbox', function (mapboxModel, idx) {
            if (altitudeDataExtent[idx] && isFinite(altitudeDataExtent[idx][1] - altitudeDataExtent[idx][0])) {
                mapboxModel.coordinateSystem.altitudeExtent = altitudeDataExtent[idx];
            }
        });

        return mapboxList;
    }
};


echarts.registerCoordinateSystem('mapbox', mapboxCreator);

module.exports = mapboxCreator;