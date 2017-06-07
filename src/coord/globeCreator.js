var Globe = require('./globe/Globe');
var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var ViewGL = require('../core/ViewGL');
var retrieve = require('../util/retrieve');

function resizeGlobe(globeModel, api) {
    // Use left/top/width/height
    var boxLayoutOption = globeModel.getBoxLayoutParams();

    var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
        width: api.getWidth(),
        height: api.getHeight()
    });

    // Flip Y
    viewport.y = api.getHeight() - viewport.y - viewport.height;

    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, api.getDevicePixelRatio());

    this.radius = globeModel.get('globeRadius');

    var outerRadius = globeModel.get('globeOuterRadius');
    if (this.altitudeAxis) {
        this.altitudeAxis.setExtent(0, outerRadius - this.radius);
    }
}

var globeCreator = {

    dimensions: Globe.prototype.dimensions,

    create: function (ecModel, api) {

        var globeList = [];

        ecModel.eachComponent('globe', function (globeModel) {

            // FIXME
            globeModel.__viewGL = globeModel.__viewGL || new ViewGL();

            var globe = new Globe();
            globe.viewGL = globeModel.__viewGL;

            globeModel.coordinateSystem = globe;
            globe.model = globeModel;
            globeList.push(globe);

            // Inject resize
            globe.resize = resizeGlobe;
            globe.resize(globeModel, api);
        });

        var altitudeDataExtent = [];
        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'globe') {
                var globeModel = seriesModel.getReferringComponents('globe')[0];
                if (!globeModel) {
                    globeModel = ecModel.getComponent('globe');
                }

                if (!globeModel) {
                    throw new Error('globe "' + retrieve.firstNotNull(
                        seriesModel.get('globe3DIndex'),
                        seriesModel.get('globe3DId'),
                        0
                    ) + '" not found');
                }

                var coordSys = globeModel.coordinateSystem;

                seriesModel.coordinateSystem = coordSys;

                // Get altitude data extent.
                var globeIndex = globeModel.componentIndex;
                var data = seriesModel.getData();
                if (data.dimensions[2]) {
                    // TODO Encoding can specify which dimension will be encoded to altitude
                    var dataExtent = data.getDataExtent(data.dimensions[2]);
                    altitudeDataExtent[globeIndex] = altitudeDataExtent[globeIndex] || [Infinity, -Infinity];
                    altitudeDataExtent[globeIndex][0] = Math.min(
                        altitudeDataExtent[globeIndex][0], dataExtent[0]
                    );
                    altitudeDataExtent[globeIndex][1] = Math.max(
                        altitudeDataExtent[globeIndex][1], dataExtent[1]
                    );
                }
            }
        });

        // Create altitude axis
        ecModel.eachComponent('globe', function (globeModel, idx) {
            var globe = globeModel.coordinateSystem;
            if (altitudeDataExtent[idx] && isFinite(altitudeDataExtent[idx][1] - altitudeDataExtent[idx][0])) {
                var scale = echarts.helper.createScale(
                    altitudeDataExtent[globeModel.componentIndex], {
                        type: 'value',
                        // PENDING
                        min: 'dataMin',
                        max: 'dataMax'
                    }
                );
                globe.altitudeAxis = new echarts.Axis('altitude', scale);
                // Resize again
                globe.resize(globeModel, api);
            }
        });

        return globeList;
    }
};

echarts.registerCoordinateSystem('globe', globeCreator);

module.exports = globeCreator;