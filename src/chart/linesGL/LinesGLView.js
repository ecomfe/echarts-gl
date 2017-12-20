import echarts from 'echarts/lib/echarts';
import matrix from 'zrender/lib/core/matrix';
import graphicGL from '../../util/graphicGL';
import ViewGL from '../../core/ViewGL';
import Lines2DGeometry from '../../util/geometry/Lines2D';

import retrieve from '../../util/retrieve';

echarts.extendChartView({

    type: 'linesGL',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');
        this.viewGL.add(this.groupGL);

        this._coordSysTransform = matrix.create();

        this._nativeLinesShader = graphicGL.createShader('ecgl.lines3D');
        this._meshLinesShader = graphicGL.createShader('ecgl.meshLines3D');
    },

    _reset: function (seriesModel, api) {
        this.groupGL.removeAll();
        this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());
        this._setCameraTransform(matrix.create());

        if (seriesModel.coordinateSystem.transform) {
            matrix.copy(this._coordSysTransform, seriesModel.coordinateSystem.transform);
        }
    },

    render: function (seriesModel, ecModel, api) {
        this._reset(seriesModel, api);

        if (!this._linesMesh) {
            this._linesMesh = this._createLinesMesh(seriesModel);
        }
        this.groupGL.add(this._linesMesh);
        this._udpateLinesMesh(seriesModel, this._linesMesh, 0, seriesModel.getData().count());

        // Remove all incremental meshes.
        this._incrementalLinesMeshes = [];
    },

    incrementalPrepareRender: function (seriesModel, ecModel, api) {
        this._reset(seriesModel, api);

        this._incrementalLinesMeshes = this._incrementalLinesMeshes || [];
        this._currentFrame = 0;
    },

    incrementalRender: function (params, seriesModel, ecModel, api) {
        var linesMesh = this._incrementalLinesMeshes[this._currentFrame];
        if (!linesMesh) {
            linesMesh = this._createLinesMesh(seriesModel);
            this._incrementalLinesMeshes[this._currentFrame] = linesMesh;
        }
        this._udpateLinesMesh(seriesModel, linesMesh, params.start, params.end);
        this.groupGL.add(linesMesh);
        api.getZr().refresh();

        this._currentFrame++;
    },

    updateLayout: function (seriesModel, ecModel, api) {
        var coordinateSystem = seriesModel.coordinateSystem;

        if (coordinateSystem.transform) {
            var diffTransform = matrix.create();
            matrix.invert(diffTransform, coordinateSystem.transform);
            matrix.mul(diffTransform, this._coordSysTransform, diffTransform);

            this._setCameraTransform(diffTransform);

            api.getZr().refresh();
        }
        else {
            // Can only render again.
            this.render(seriesModel, ecModel, api);
        }
    },

    incrementalPrepareLayout: function (seriesModel, ecModel, api) {
        if (seriesModel.coordinateSystem.transform) {
            this.updateLayout(seriesModel, ecModel, api);
            return {
                noProgress: true
            };
        }
        else {
            this.incrementalPrepareRender(seriesModel, ecModel, api);
        }
    },

    incrementalLayout: function (params, seriesModel, ecModel, api) {
        this.incrementalRender(params, seriesModel, ecModel, api);
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

    _udpateLinesMesh: function (seriesModel, linesMesh, start, end) {
        var data = seriesModel.getData();
        linesMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
        var curveness = seriesModel.get('lineStyle.curveness') || 0;
        var isPolyline = seriesModel.get('polyline');
        var geometry = linesMesh.geometry;

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
                    var count = seriesModel.getLineCoords(idx, lineCoords);
                    vertexCount += geometry.getPolylineVertexCount(count);
                    triangleCount += geometry.getPolylineTriangleCount(count);
                }
                else {
                    seriesModel.getLineCoords(idx, lineCoords);
                    seriesModel.coordinateSystem.dataToPoint(lineCoords[0], p0);
                    seriesModel.coordinateSystem.dataToPoint(lineCoords[1], p3);
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
                seriesModel.coordinateSystem.dataToPoint(lineCoords[k], lineCoords[k]);
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

    _setCameraTransform: function (m) {
        var camera = this.viewGL.camera;
        camera.position.set(m[4], m[5], 0);
        camera.scale.set(
            Math.sqrt(m[0] * m[0] + m[1] * m[1]),
            Math.sqrt(m[2] * m[2] + m[3] * m[3]),
            1
        );
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