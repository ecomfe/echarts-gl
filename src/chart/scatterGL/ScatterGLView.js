var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var viewGL = require('../../core/ViewGL');

var Points2DMesh = require('../common/Points2DMesh');

echarts.extendChartView({

    type: 'scatterGL',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new viewGL('orthographic');

        this.viewGL.add(this.groupGL);

        var mesh = new Points2DMesh();
        this._pointsMesh = mesh;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsMesh);

        this._updateCamera(api.getWidth(), api.getHeight());

        this._pointsMesh.updateData(seriesModel, ecModel, api);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._pointsMesh.updateLayout(seriesModel, ecModel, api);
    },

    _updateCamera: function (width, height) {
        this.viewGL.setViewport(0, 0, width, height);
        var camera = this.viewGL.camera;
        camera.left = camera.top = 0;
        camera.bottom = height;
        camera.right = width;
        camera.near = 0;
        camera.far = 100;
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});