import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import ViewGL from '../../core/ViewGL';
import Lines2DGeometry from '../../util/geometry/Lines2D';
import GLViewHelper from '../common/GLViewHelper';

import retrieve from '../../util/retrieve';

echarts.extendChartView({

    type: 'linesGL',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');
        this.viewGL.add(this.groupGL);

        this._glViewHelper = new GLViewHelper(this.viewGL);

        this._nativeLinesShader = graphicGL.createShader('ecgl.lines3D');
        this._meshLinesShader = graphicGL.createShader('ecgl.meshLines3D');

        this._linesMeshes = [];
        this._currentStep = 0;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();
        this._glViewHelper.reset(seriesModel, api);

        var linesMesh = this._linesMeshes[0];
        if (!linesMesh) {
            linesMesh = this._linesMeshes[0] = this._createLinesMesh(seriesModel);
        }
        this._linesMeshes.length = 1;

        this.groupGL.add(linesMesh);
        this._updateLinesMesh(seriesModel, linesMesh, 0, seriesModel.getData().count());

        this.viewGL.setPostEffect(seriesModel.getModel('postEffect'), api);
    },

    incrementalPrepareRender: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();
        this._glViewHelper.reset(seriesModel, api);

        this._currentStep = 0;

        this.viewGL.setPostEffect(seriesModel.getModel('postEffect'), api);
    },

    incrementalRender: function (params, seriesModel, ecModel, api) {
        var linesMesh = this._linesMeshes[this._currentStep];
        if (!linesMesh) {
            linesMesh = this._createLinesMesh(seriesModel);
            this._linesMeshes[this._currentStep] = linesMesh;
        }
        this._updateLinesMesh(seriesModel, linesMesh, params.start, params.end);
        this.groupGL.add(linesMesh);
        api.getZr().refresh();

        this._currentStep++;
    },

    updateTransform: function (seriesModel, ecModel, api) {
        if (seriesModel.coordinateSystem.getRoamTransform) {
            this._glViewHelper.updateTransform(seriesModel, api);
        }
    },

    _createLinesMesh: function (seriesModel) {
        var linesMesh = new graphicGL.Mesh({
            $ignorePicking: true,
            material: new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.lines3D'),
                transparent: true,
                depthMask: false,
                depthTest: false
            }),
            geometry: new Lines2DGeometry({
                segmentScale: 10,
                useNativeLine: true,
                dynamic: false
            }),
            mode: graphicGL.Mesh.LINES,
            culling: false
        });

        return linesMesh;
    },

    _updateLinesMesh: function (seriesModel, linesMesh, start, end) {
        var data = seriesModel.getData();
        linesMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
        var curveness = seriesModel.get('lineStyle.curveness') || 0;
        var isPolyline = seriesModel.get('polyline');
        var geometry = linesMesh.geometry;
        var coordSys = seriesModel.coordinateSystem;

        var lineWidth = retrieve.firstNotNull(seriesModel.get('lineStyle.width'), 1);

        if (lineWidth > 1) {
            if (linesMesh.material.shader !== this._meshLinesShader) {
                linesMesh.material.attachShader(this._meshLinesShader);
            }
            linesMesh.mode = graphicGL.Mesh.TRIANGLES;
        }
        else {
            if (linesMesh.material.shader !== this._nativeLinesShader) {
                linesMesh.material.attachShader(this._nativeLinesShader);
            }
            linesMesh.mode = graphicGL.Mesh.LINES;
        }

        start = start || 0;
        end = end || data.count();

        geometry.resetOffset();
        var vertexCount = 0;
        var triangleCount = 0;
        var p0 = [];
        var p1 = [];
        var p2 = [];
        var p3 = [];

        var lineCoords = [];

        var t = 0.3;
        var t2 = 0.7;

        function updateBezierControlPoints() {
            p1[0] = (p0[0] * t2 + p3[0] * t) - (p0[1] - p3[1]) * curveness;
            p1[1] = (p0[1] * t2 + p3[1] * t) - (p3[0] - p0[0]) * curveness;
            p2[0] = (p0[0] * t + p3[0] * t2) - (p0[1] - p3[1]) * curveness;
            p2[1] = (p0[1] * t + p3[1] * t2) - (p3[0] - p0[0]) * curveness;
        }
        if (isPolyline || curveness !== 0) {
            for (var idx = start; idx < end; idx++) {
                if (isPolyline) {
                    var count = seriesModel.getLineCoordsCount(idx);
                    vertexCount += geometry.getPolylineVertexCount(count);
                    triangleCount += geometry.getPolylineTriangleCount(count);
                }
                else {
                    seriesModel.getLineCoords(idx, lineCoords);
                    this._glViewHelper.dataToPoint(coordSys, lineCoords[0], p0);
                    this._glViewHelper.dataToPoint(coordSys, lineCoords[1], p3);
                    updateBezierControlPoints();

                    vertexCount += geometry.getCubicCurveVertexCount(p0, p1, p2, p3);
                    triangleCount += geometry.getCubicCurveTriangleCount(p0, p1, p2, p3);
                }
            }
        }
        else {
            var lineCount = end - start;
            vertexCount += lineCount * geometry.getLineVertexCount();
            triangleCount += lineCount * geometry.getLineVertexCount();
        }
        geometry.setVertexCount(vertexCount);
        geometry.setTriangleCount(triangleCount);

        var dataIndex = start;
        var colorArr = [];
        for (var idx = start; idx < end; idx++) {
            graphicGL.parseColor(data.getItemVisual(dataIndex, 'color'), colorArr);
            var opacity = retrieve.firstNotNull(data.getItemVisual(dataIndex, 'opacity'), 1);
            colorArr[3] *= opacity;

            var count = seriesModel.getLineCoords(idx, lineCoords);
            for (var k = 0; k < count; k++) {
                this._glViewHelper.dataToPoint(coordSys, lineCoords[k], lineCoords[k]);
            }

            if (isPolyline) {
                geometry.addPolyline(lineCoords, colorArr, lineWidth, 0, count);
            }
            else if (curveness !== 0) {
                p0 = lineCoords[0];
                p3 = lineCoords[1];
                updateBezierControlPoints();
                geometry.addCubicCurve(p0, p1, p2, p3, colorArr, lineWidth);
            }
            else {
                geometry.addPolyline(lineCoords, colorArr, lineWidth, 0, 2);
            }
            dataIndex++;
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});