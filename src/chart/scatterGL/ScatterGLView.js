var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var ViewGL = require('../../core/ViewGL');

var Points2DMesh = require('../common/PointsMesh');

echarts.extendChartView({

    type: 'scatterGL',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');

        this.viewGL.add(this.groupGL);

        var mesh = new Points2DMesh({
            is2D: true
        });
        this._pointsMesh = mesh;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsMesh);

        this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());

        this._pointsMesh.updateData(seriesModel, ecModel, api);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._pointsMesh.updateLayout(seriesModel, ecModel, api);
    },

    _updateCamera: function (width, height, dpr) {
        this.viewGL.setViewport(0, 0, width, height, dpr);
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