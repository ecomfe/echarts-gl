import Geo3D from './geo3D/Geo3D';
import echarts from 'echarts/lib/echarts';
import layoutUtil from 'echarts/lib/util/layout';
import ViewGL from '../core/ViewGL';
import retrieve from '../util/retrieve';

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
    var aspect = geoRect.width / geoRect.height * (geo3DModel.get('aspectScale') || 0.75);

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

    this.regionHeight = geo3DModel.get('regionHeight');

    if (this.altitudeAxis) {
        this.altitudeAxis.setExtent(0, Math.max(height - this.regionHeight, 0));
    }
}

function updateGeo3D(ecModel, api) {

    var altitudeDataExtent = [Infinity, -Infinity];

    ecModel.eachSeries(function (seriesModel) {
        if (seriesModel.coordinateSystem !== this) {
            return;
        }
        if (seriesModel.type === 'series.map3D') {
            return;
        }
        // Get altitude data extent.
        var data = seriesModel.getData();
        var altDims = seriesModel.coordDimToDataDim('alt');
        var altDim = altDims && altDims[0];
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
    // Create altitude axis
    if (altitudeDataExtent && isFinite(altitudeDataExtent[1] - altitudeDataExtent[0])) {
        var scale = echarts.helper.createScale(
            altitudeDataExtent, {
                type: 'value',
                // PENDING
                min: 'dataMin',
                max: 'dataMax'
            }
        );
        this.altitudeAxis = new echarts.Axis('altitude', scale);
        // Resize again
        this.resize(this.model, api);
    }
}


if (__DEV__) {
    var mapNotExistsError = function (name) {
        console.error('Map ' + name + ' not exists. You can download map file on http://echarts.baidu.com/download-map.html');
    };
}


var idStart = 0;

var geo3DCreator = {

    dimensions: Geo3D.prototype.dimensions,

    create: function (ecModel, api) {

        var geo3DList = [];

        if (!echarts.getMap) {
            throw new Error('geo3D component depends on geo component');
        }

        function createGeo3D(componentModel, idx) {

            var geo3D = geo3DCreator.createGeo3D(componentModel);

            // FIXME
            componentModel.__viewGL = componentModel.__viewGL || new ViewGL();

            geo3D.viewGL = componentModel.__viewGL;

            componentModel.coordinateSystem = geo3D;
            geo3D.model = componentModel;

            geo3DList.push(geo3D);

            // Inject resize
            geo3D.resize = resizeGeo3D;
            geo3D.resize(componentModel, api);

            geo3D.update = updateGeo3D;
        }

        ecModel.eachComponent('geo3D', function (geo3DModel, idx) {
            createGeo3D(geo3DModel, idx);
        });

        ecModel.eachSeriesByType('map3D', function (map3DModel, idx) {
            var coordSys = map3DModel.get('coordinateSystem');
            if (coordSys == null) {
                coordSys = 'geo3D';
            }
            if (coordSys === 'geo3D') {
                createGeo3D(map3DModel, idx);
            }
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'geo3D') {
                if (seriesModel.type === 'series.map3D') {
                    return;
                }
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

        return geo3DList;
    },

    createGeo3D: function (componentModel) {

        var mapData = componentModel.get('map');
        var name;
        if (typeof mapData === 'string') {
            name = mapData;
            mapData = echarts.getMap(mapData);
        }
        else {
            if (mapData && mapData.features) {
                mapData = {
                    geoJson: mapData
                };
            }
        }
        if (__DEV__) {
            if (!mapData) {
                mapNotExistsError(mapData);
            }
            if (!mapData.geoJson.features) {
                throw new Error('Invalid GeoJSON for map3D');
            }
        }
        if (name == null) {
            name = 'GEO_ANONYMOUS_' + idStart++;
        }

        return new Geo3D(
            name + idStart++, name,
            mapData && mapData.geoJson, mapData && mapData.specialAreas,
            componentModel.get('nameMap')
        );
    }
};

echarts.registerCoordinateSystem('geo3D', geo3DCreator);

export default geo3DCreator;