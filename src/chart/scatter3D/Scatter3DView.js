import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import retrieve from '../../util/retrieve';
import format from '../../util/format';

import PointsBuilder from '../common/PointsBuilder';

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

    highlight: function (seriesModel, ecModel, api, payload) {
        this._toggleStatus('highlight', seriesModel, ecModel, api, payload);
    },

    downplay: function (seriesModel, ecModel, api, payload) {
        this._toggleStatus('downplay', seriesModel, ecModel, api, payload);
    },

    _toggleStatus: function (status, seriesModel, ecModel, api, payload) {
        var data = seriesModel.getData();
        var dataIndex = retrieve.queryDataIndex(data, payload);

        var pointsBuilder = this._pointsBuilder;
        if (dataIndex != null) {
            echarts.util.each(format.normalizeToArray(dataIndex), function (dataIdx) {
                status === 'highlight' ? pointsBuilder.highlight(data, dataIdx) : pointsBuilder.downplay(data, dataIdx);
            }, this);
        }
        else {
            data.each(function (dataIdx) {
                status === 'highlight' ? pointsBuilder.highlight(data, dataIdx) : pointsBuilder.downplay(data, dataIdx);
            });
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});