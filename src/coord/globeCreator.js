var Globe = require('./globe/Globe');
var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var ViewGL = require('../core/ViewGL');

function resizeGlobe(globeModel, api) {
    // Use left/top/width/height
    var boxLayoutOption = globeModel.getBoxLayoutParams();

    var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
        width: api.getWidth(),
        height: api.getHeight()
    });

    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);

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
                var globeIndex = seriesModel.get('globeIndex');
                var coordSys = globeList[globeIndex];

                if (!coordSys) {
                    console.warn('globe %s not exists', globeIndex);
                }

                seriesModel.coordinateSystem = coordSys;
            }
        });
    }
};

echarts.registerCoordinateSystem('globe', globeCreator);

module.exports = globeCreator;