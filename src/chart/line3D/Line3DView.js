import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import retrieve from '../../util/retrieve';
import Lines3DGeometry from '../../util/geometry/Lines3D';
import Matrix4 from 'claygl/src/math/Matrix4';
import Vector3 from 'claygl/src/math/Vector3';
import lineContain from 'zrender/lib/contain/line';
import glmatrix from 'claygl/src/dep/glmatrix';

import lines3DGLSL from '../../util/shader/lines3D.glsl.js';

var vec3 = glmatrix.vec3;

graphicGL.Shader.import(lines3DGLSL);

export default echarts.extendChartView({

    type: 'line3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        this._api = api;
    },

    render: function (seriesModel, ecModel, api) {
        var tmp = this._prevLine3DMesh;
        this._prevLine3DMesh = this._line3DMesh;
        this._line3DMesh = tmp;

        if (!this._line3DMesh) {
            this._line3DMesh = new graphicGL.Mesh({
                geometry: new Lines3DGeometry({
                    useNativeLine: false,
                    sortTriangles: true
                }),
                material: new graphicGL.Material({
                    shader: graphicGL.createShader('ecgl.meshLines3D')
                }),
                // Render after axes
                renderOrder: 10
            });
            this._line3DMesh.geometry.pick = this._pick.bind(this);
        }

        this.groupGL.remove(this._prevLine3DMesh);
        this.groupGL.add(this._line3DMesh);

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            // TODO
            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            this._line3DMesh.material[methodName]('fragment', 'SRGB_DECODE');
        }
        this._doRender(seriesModel, api);

        this._data = seriesModel.getData();

        this._camera = coordSys.viewGL.camera;

        this.updateCamera();

        this._updateAnimation(seriesModel);
    },

    updateCamera: function () {
        this._updateNDCPosition();
    },

    _doRender: function (seriesModel, api) {
        var data = seriesModel.getData();
        var lineMesh = this._line3DMesh;

        lineMesh.geometry.resetOffset();

        var points = data.getLayout('points');

        var colorArr = [];
        var vertexColors = new Float32Array(points.length / 3 * 4);
        var colorOffset = 0;
        var hasTransparent = false;

        data.each(function (idx) {
            var color = data.getItemVisual(idx, 'color');
            var opacity = data.getItemVisual(idx, 'opacity');
            if (opacity == null) {
                opacity = 1;
            }

            graphicGL.parseColor(color, colorArr);
            colorArr[3] *= opacity;
            vertexColors[colorOffset++] = colorArr[0];
            vertexColors[colorOffset++] = colorArr[1];
            vertexColors[colorOffset++] = colorArr[2];
            vertexColors[colorOffset++] = colorArr[3];

            if (colorArr[3] < 0.99) {
                hasTransparent = true;
            }
        });

        lineMesh.geometry.setVertexCount(
            lineMesh.geometry.getPolylineVertexCount(points)
        );
        lineMesh.geometry.setTriangleCount(
            lineMesh.geometry.getPolylineTriangleCount(points)
        );

        lineMesh.geometry.addPolyline(
            points, vertexColors,
            retrieve.firstNotNull(seriesModel.get('lineStyle.width'), 1)
        );

        lineMesh.geometry.dirty();
        lineMesh.geometry.updateBoundingBox();

        var material = lineMesh.material;
        material.transparent = hasTransparent;
        material.depthMask = !hasTransparent;

        var debugWireframeModel = seriesModel.getModel('debug.wireframe');
        if (debugWireframeModel.get('show')) {
            lineMesh.geometry.createAttribute('barycentric', 'float', 3);
            lineMesh.geometry.generateBarycentric();
            lineMesh.material.set('both', 'WIREFRAME_TRIANGLE');
            lineMesh.material.set(
                'wireframeLineColor', graphicGL.parseColor(
                    debugWireframeModel.get('lineStyle.color') || 'rgba(0,0,0,0.5)'
                )
            );
            lineMesh.material.set(
                'wireframeLineWidth', retrieve.firstNotNull(
                    debugWireframeModel.get('lineStyle.width'), 1
                )
            );
        }
        else {
            lineMesh.material.set('both', 'WIREFRAME_TRIANGLE');
        }

        this._points = points;

        this._initHandler(seriesModel, api);
    },

    _updateAnimation: function (seriesModel) {
        graphicGL.updateVertexAnimation(
            [['prevPosition', 'position'],
            ['prevPositionPrev', 'positionPrev'],
            ['prevPositionNext', 'positionNext']],
            this._prevLine3DMesh,
            this._line3DMesh,
            seriesModel
        );
    },

    _initHandler: function (seriesModel, api) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;
        var lineMesh = this._line3DMesh;

        var lastDataIndex = -1;

        lineMesh.seriesIndex = seriesModel.seriesIndex;

        lineMesh.off('mousemove');
        lineMesh.off('mouseout');
        lineMesh.on('mousemove', function (e) {
            var value = coordSys.pointToData(e.point.array);
            var dataIndex = data.indicesOfNearest('x', value[0])[0];
            if (dataIndex !== lastDataIndex) {
                // this._downplay(lastDataIndex);
                // this._highlight(dataIndex);

                api.dispatchAction({
                    type: 'grid3DShowAxisPointer',
                    value: [data.get('x', dataIndex), data.get('y', dataIndex), data.get('z', dataIndex)]
                });

                lineMesh.dataIndex = dataIndex;
            }


            lastDataIndex = dataIndex;
        }, this);
        lineMesh.on('mouseout', function (e) {
            // this._downplay(lastDataIndex);
            lastDataIndex = -1;
            lineMesh.dataIndex = -1;
            api.dispatchAction({
                type: 'grid3DHideAxisPointer'
            });
        }, this);
    },

    // _highlight: function (dataIndex) {
    //     var data = this._data;
    //     if (!data) {
    //         return;
    //     }

    // },

    // _downplay: function (dataIndex) {
    //     var data = this._data;
    //     if (!data) {
    //         return;
    //     }
    // },

    _updateNDCPosition: function () {

        var worldViewProjection = new Matrix4();
        var camera = this._camera;
        Matrix4.multiply(worldViewProjection, camera.projectionMatrix, camera.viewMatrix);

        var positionNDC = this._positionNDC;
        var points = this._points;
        var nPoints = points.length / 3;
        if (!positionNDC || positionNDC.length / 2 !== nPoints) {
            positionNDC = this._positionNDC = new Float32Array(nPoints * 2);
        }
        var pos = [];
        for (var i = 0; i < nPoints; i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            pos[0] = points[i3];
            pos[1] = points[i3 + 1];
            pos[2] = points[i3 + 2];
            pos[3] = 1;

            vec3.transformMat4(pos, pos, worldViewProjection.array);
            positionNDC[i2] = pos[0] / pos[3];
            positionNDC[i2 + 1] = pos[1] / pos[3];
        }
    },

    _pick: function (x, y, renderer, camera, renderable, out) {
        var positionNDC = this._positionNDC;
        var seriesModel = this._data.hostModel;
        var lineWidth = seriesModel.get('lineStyle.width');

        var dataIndex = -1;
        var width = renderer.viewport.width;
        var height = renderer.viewport.height;

        var halfWidth = width * 0.5;
        var halfHeight = height * 0.5;
        x = (x + 1) * halfWidth;
        y = (y + 1) * halfHeight;

        for (var i = 1; i < positionNDC.length / 2; i++) {
            var x0 = (positionNDC[(i - 1) * 2] + 1) * halfWidth;
            var y0 = (positionNDC[(i - 1) * 2 + 1] + 1) * halfHeight;
            var x1 = (positionNDC[i * 2] + 1) * halfWidth;
            var y1 = (positionNDC[i * 2 + 1] + 1) * halfHeight;

            if (lineContain.containStroke(x0, y0, x1, y1, lineWidth, x, y)) {
                var dist0 = (x0 - x) * (x0 - x) + (y0 - y) * (y0 - y);
                var dist1 = (x1 - x) * (x1 - x) + (y1 - y) * (y1 - y);
                // Nearest point.
                dataIndex = dist0 < dist1 ? (i - 1) : i;
            }
        }

        if (dataIndex >= 0) {
            var i3 = dataIndex * 3;
            var point = new Vector3(
                this._points[i3],
                this._points[i3 + 1],
                this._points[i3 + 2]
            );

            out.push({
                dataIndex: dataIndex,
                point: point,
                pointWorld: point.clone(),
                target: this._line3DMesh,
                distance: this._camera.getWorldPosition().dist(point)
            });
        }
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});