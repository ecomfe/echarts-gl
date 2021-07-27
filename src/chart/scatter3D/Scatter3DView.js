import * as echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import retrieve from '../../util/retrieve';
import format from '../../util/format';

import PointsBuilder from '../common/PointsBuilder';

export default echarts.ChartView.extend({

    type: 'scatter3D',

    hasSymbolVisual: true,

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        this._pointsBuilderList = [];
        this._currentStep = 0;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();
        if (!seriesModel.getData().count()) {
            return;
        }

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            this._camera = coordSys.viewGL.camera;

            var pointsBuilder = this._pointsBuilderList[0];
            if (!pointsBuilder) {
                pointsBuilder = this._pointsBuilderList[0] = new PointsBuilder(false, api);
            }
            this._pointsBuilderList.length = 1;

            this.groupGL.add(pointsBuilder.rootNode);
            pointsBuilder.update(seriesModel, ecModel, api);
            pointsBuilder.updateView(coordSys.viewGL.camera);
        }
        else {
            if (process.env.NODE_ENV !== 'production') {
                throw new Error('Invalid coordinate system');
            }
        }
    },

    incrementalPrepareRender: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            this._camera = coordSys.viewGL.camera;
        }
        else {
            if (process.env.NODE_ENV !== 'production') {
                throw new Error('Invalid coordinate system');
            }
        }

        this.groupGL.removeAll();
        this._currentStep = 0;
    },

    incrementalRender: function (params, seriesModel, ecModel, api) {
        // TODO Sort transparency.
        if (params.end <= params.start) {
            return;
        }
        var pointsBuilder = this._pointsBuilderList[this._currentStep];
        if (!pointsBuilder) {
            pointsBuilder = new PointsBuilder(false, api);
            this._pointsBuilderList[this._currentStep] = pointsBuilder;
        }
        this.groupGL.add(pointsBuilder.rootNode);

        pointsBuilder.update(seriesModel, ecModel, api, params.start, params.end);
        pointsBuilder.updateView(seriesModel.coordinateSystem.viewGL.camera);

        this._currentStep++;
    },

    updateCamera: function () {
        this._pointsBuilderList.forEach(function (pointsBuilder) {
            pointsBuilder.updateView(this._camera);
        }, this);
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

        var isHighlight = status === 'highlight';
        if (dataIndex != null) {
            echarts.util.each(format.normalizeToArray(dataIndex), function (dataIdx) {
                for (var i = 0; i < this._pointsBuilderList.length; i++) {
                    var pointsBuilder = this._pointsBuilderList[i];
                    isHighlight ? pointsBuilder.highlight(data, dataIdx) : pointsBuilder.downplay(data, dataIdx);
                }
            }, this);
        }
        else {
            // PENDING, OPTIMIZE
            data.each(function (dataIdx) {
                for (var i = 0; i < this._pointsBuilderList.length; i++) {
                    var pointsBuilder = this._pointsBuilderList[i];
                    isHighlight ? pointsBuilder.highlight(data, dataIdx) : pointsBuilder.downplay(data, dataIdx);
                }
            });
        }
    },

    dispose: function () {
        this._pointsBuilderList.forEach(function (pointsBuilder) {
            pointsBuilder.dispose();
        });
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});