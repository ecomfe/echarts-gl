import retrieve from '../../util/retrieve';
import graphicGL from '../../util/graphicGL';
import ViewGL from '../../core/ViewGL';

export default function (serviceComponentType, ServiceCtor, afterCreate) {

    function resizeMapService3D(mapService3DModel, api) {
        var width = api.getWidth();
        var height = api.getHeight();
        var dpr = api.getDevicePixelRatio();
        this.viewGL.setViewport(0, 0, width, height, dpr);

        this.width = width;
        this.height = height;

        this.altitudeScale = mapService3DModel.get('altitudeScale');

        this.boxHeight = mapService3DModel.get('boxHeight');
        // this.updateTransform();
    }


    function updateService3D(ecModel, api) {

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

    return {


        dimensions: ServiceCtor.prototype.dimensions,

        create: function (ecModel, api) {
            var mapService3DList = [];

            ecModel.eachComponent(serviceComponentType, function (mapService3DModel) {
                var viewGL = mapService3DModel.__viewGL;
                if (!viewGL) {
                    viewGL = mapService3DModel.__viewGL = new ViewGL();
                    viewGL.setRootNode(new graphicGL.Node());
                }

                var mapService3DCoordSys = new ServiceCtor();
                mapService3DCoordSys.viewGL = mapService3DModel.__viewGL;
                // Inject resize
                mapService3DCoordSys.resize = resizeMapService3D;
                mapService3DCoordSys.resize(mapService3DModel, api);

                mapService3DList.push(mapService3DCoordSys);

                mapService3DModel.coordinateSystem = mapService3DCoordSys;
                mapService3DCoordSys.model = mapService3DModel;

                mapService3DCoordSys.update = updateService3D;
            });

            ecModel.eachSeries(function (seriesModel) {
                if (seriesModel.get('coordinateSystem') === serviceComponentType) {
                    var mapService3DModel = seriesModel.getReferringComponents(serviceComponentType).models[0];
                    if (!mapService3DModel) {
                        mapService3DModel = ecModel.getComponent(serviceComponentType);
                    }

                    if (!mapService3DModel) {
                        throw new Error(serviceComponentType + ' "' + retrieve.firstNotNull(
                            seriesModel.get(serviceComponentType + 'Index'),
                            seriesModel.get(serviceComponentType + 'Id'),
                            0
                        ) + '" not found');
                    }

                    seriesModel.coordinateSystem = mapService3DModel.coordinateSystem;
                }
            });

            afterCreate && afterCreate(mapService3DList, ecModel, api);

            return mapService3DList;
        }
    };
}
