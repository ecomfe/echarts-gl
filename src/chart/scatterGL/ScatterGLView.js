import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import ViewGL from '../../core/ViewGL';
import PointsBuilder from '../common/PointsBuilder';

import GLViewHelper from '../common/GLViewHelper';

echarts.extendChartView({

    type: 'scatterGL',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');

        this.viewGL.add(this.groupGL);

        this._pointsBuilderList = [];
        this._currentStep = 0;

        this._glViewHelper = new GLViewHelper(this.viewGL);
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();
        this._glViewHelper.reset(seriesModel, api);

        var pointsBuilder = this._pointsBuilderList[0];
        if (!pointsBuilder) {
            pointsBuilder = this._pointsBuilderList[0] = new PointsBuilder(true, api);
        }
        this._pointsBuilderList.length = 1;

        this.groupGL.add(pointsBuilder.rootNode);

        this._removeTransformInPoints(seriesModel.getData().getLayout('points'));
        pointsBuilder.update(seriesModel, ecModel, api);
    },

    incrementalPrepareRender: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();
        this._glViewHelper.reset(seriesModel, api);

        this._currentStep = 0;
    },

    incrementalRender: function (params, seriesModel, ecModel, api) {
        var pointsBuilder = this._pointsBuilderList[this._currentStep];
        if (!pointsBuilder) {
            pointsBuilder = new PointsBuilder(true, api);
            this._pointsBuilderList[this._currentStep] = pointsBuilder;
        }
        this.groupGL.add(pointsBuilder.rootNode);

        this._removeTransformInPoints(seriesModel.getData().getLayout('points'));
        pointsBuilder.update(seriesModel, ecModel, api, params.start, params.end);

        this._currentStep++;
    },

    updateTransform: function (seriesModel, ecModel, api) {
        if (seriesModel.coordinateSystem.transform) {
            this._glViewHelper.updateTransform(seriesModel, api);
        }
    },

    _removeTransformInPoints: function (points) {
        var pt = [];
        for (var i = 0; i < points.length; i += 2) {
            pt[0] = points[i];
            pt[1] = points[i + 1];
            this._glViewHelper.removeTransformInPoint(pt);
            points[i] = pt[0];
            points[i + 1] = pt[1];
        }
    },


    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});