import Mapbox3D from './mapbox3D/Mapbox3D';
import echarts from 'echarts/lib/echarts';
import retrieve from '../util/retrieve';
import graphicGL from '../util/graphicGL';
import ViewGL from '../core/ViewGL';

function resizeMapbox3D(mapbox3DModel, api) {
    var width = api.getWidth();
    var height = api.getHeight();
    var dpr = api.getDevicePixelRatio();
    this.viewGL.setViewport(0, 0, width, height, dpr);

    this.width = width;
    this.height = height;

    this.altitudeScale = mapbox3DModel.get('altitudeScale');

    this.boxHeight = mapbox3DModel.get('boxHeight');
    // this.updateTransform();
}


function updateMapbox(ecModel, api) {

    if (this.model.get('boxHeight') === 'auto') {
        return;
    }

    var altitudeDataExtent = [Infinity, -Infinity]

    ecModel.eachSeries(function (seriesModel) {
        if (seriesModel.coordinateSystem !== this) {
            return;
        }

        // Get altitude data extent.
        var data = seriesModel.getData();
        var altDim = seriesModel.coordDimToDataDim('alt')[0];
        if (altDim) {
            // TODO altitiude is in coords of lines.
            var dataExtent = data.getDataExtent(altDim, true);
            altitudeDataExtent[0] = Math.min(
                altitudeDataExtent[0], dataExtent[0]
            );
            altitudeDataExtent[1] = Math.max(
                altitudeDataExtent[1], dataExtent[1]
            );
        }
    }, this);
    if (altitudeDataExtent && isFinite(altitudeDataExtent[1] - altitudeDataExtent[0])) {
        this.altitudeExtent = altitudeDataExtent;
    }
}

var mapbox3DCreator = {


    dimensions: Mapbox3D.prototype.dimensions,

    create: function (ecModel, api) {
        var mapbox3DList = [];

        ecModel.eachComponent('mapbox3D', function (mapbox3DModel) {
            var viewGL = mapbox3DModel.__viewGL;
            if (!viewGL) {
                viewGL = mapbox3DModel.__viewGL = new ViewGL();
                viewGL.setRootNode(new graphicGL.Node());
            }

            var mapbox3DCoordSys = new Mapbox3D();
            mapbox3DCoordSys.viewGL = mapbox3DModel.__viewGL;
            // Inject resize
            mapbox3DCoordSys.resize = resizeMapbox3D;
            mapbox3DCoordSys.resize(mapbox3DModel, api);

            mapbox3DList.push(mapbox3DCoordSys);

            mapbox3DModel.coordinateSystem = mapbox3DCoordSys;
            mapbox3DCoordSys.model = mapbox3DModel;

            mapbox3DCoordSys.setCameraOption(mapbox3DModel.getMapboxCameraOption());

            mapbox3DCoordSys.update = updateMapbox;
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'mapbox3D') {
                var mapbox3DModel = seriesModel.getReferringComponents('mapbox3D')[0];
                if (!mapbox3DModel) {
                    mapbox3DModel = ecModel.getComponent('mapbox3D');
                }

                if (!mapbox3DModel) {
                    throw new Error('mapbox3D "' + retrieve.firstNotNull(
                        seriesModel.get('mapbox3DIndex'),
                        seriesModel.get('mapbox3DId'),
                        0
                    ) + '" not found');
                }

                seriesModel.coordinateSystem = mapbox3DModel.coordinateSystem;
            }
        });

        return mapbox3DList;
    }
};


echarts.registerCoordinateSystem('mapbox3D', mapbox3DCreator);

export default mapbox3DCreator;