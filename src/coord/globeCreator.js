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

    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, api.getDevicePixelRatio());

    this.radius = globeModel.get('globeRadius');
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
            globeList.push(globe);

            // Inject resize
            globe.resize = resizeGlobe;
            globe.resize(globeModel, api);
        });

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
            }
        });

        return globeList;
    }
};

echarts.registerCoordinateSystem('globe', globeCreator);

module.exports = globeCreator;