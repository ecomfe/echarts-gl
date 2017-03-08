var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');

var PointsBuilder = require('../common/PointsBuilder');

echarts.extendChartView({

    type: 'scatter3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var pointsBuilder = new PointsBuilder(false, api);
        this._pointsBuilder = pointsBuilder;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsBuilder.rootNode);

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);

            this._pointsBuilder.update(seriesModel, ecModel, api);
            this._pointsBuilder.updateView(coordSys.viewGL.camera);

            this._camera = coordSys.viewGL.camera;
        }
        else {
            if (__DEV__) {
                throw new Error('Invalid coordinate system');
            }
        }
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._pointsBuilder.updateLayout(seriesModel, ecModel, api);
        this._pointsBuilder.updateView(this._camera);
    },

    updateCamera: function () {
        this._pointsBuilder.updateView(this._camera);
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});