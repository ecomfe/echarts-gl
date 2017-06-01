var Mapbox = require('./mapbox/Mapbox');
var echarts = require('echarts/lib/echarts');
var retrieve = require('../util/retrieve');
var ViewGL = require('../core/ViewGL');

function resizeMapbox(mapboxModel, api) {
    var width = api.getWidth();
    var height = api.getHeight();
    var dpr = api.getDevicePixelRatio();
    this.viewGL.setViewport(0, 0, width, height, dpr);

    this.width = width * dpr;
    this.height = height * dpr;

    this.updateCamera();
}

var mapboxCreator = {

    dimensions: Mapbox.prototype.dimensions,

    create: function (ecModel, api) {
        var mapboxList = [];

        ecModel.eachComponent('mapbox', function (mapboxModel) {
            // FIXME
            mapboxModel.__viewGL = mapboxModel.__viewGL || new ViewGL();

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
            }
        });

        return mapboxList;
    }
};


echarts.registerCoordinateSystem('mapbox', mapboxCreator);

module.exports = mapboxCreator;