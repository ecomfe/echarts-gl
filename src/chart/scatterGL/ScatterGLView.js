import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import ViewGL from '../../core/ViewGL';

import PointsBuilder from '../common/PointsBuilder';

echarts.extendChartView({

    type: 'scatterGL',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');

        this.viewGL.add(this.groupGL);

        this._pointsBuilder = new PointsBuilder(true, api);
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsBuilder.rootNode);

        this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());

        this._pointsBuilder.update(seriesModel, ecModel, api);
        this._pointsBuilder.updateView(this.viewGL.camera);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._pointsBuilder.updateLayout(seriesModel, ecModel, api);
        this._pointsBuilder.updateView(this.viewGL.camera);
    },

    _updateCamera: function (width, height, dpr) {
        // TODO, left, top, right, bottom
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