var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');

var PointsMesh = require('../common/PointsMesh');

echarts.extendChartView({

    type: 'scatter3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var mesh = new PointsMesh({
            is2D: false
        });
        this._pointsMesh = mesh;
        this.groupGL.add(this._pointsMesh);
    },

    render: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
        }

        this._pointsMesh.updateData(seriesModel, ecModel, api);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._pointsMesh.updateLayout(seriesModel, ecModel, api);
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});