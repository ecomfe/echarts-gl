import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import retrieve from '../../util/retrieve';
import glmatrix from 'claygl/src/dep/glmatrix';
import trianglesSortMixin from '../../util/geometry/trianglesSortMixin';

var vec3 = glmatrix.vec3;

function isPointsNaN(pt) {
    return isNaN(pt[0]) || isNaN(pt[1]) || isNaN(pt[2]);
}

echarts.extendChartView({

    type: 'surface',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
    },

    render: function (seriesModel, ecModel, api) {
        // Swap surfaceMesh
        var tmp = this._prevSurfaceMesh;
        this._prevSurfaceMesh = this._surfaceMesh;
        this._surfaceMesh = tmp;

        if (!this._surfaceMesh) {
            this._surfaceMesh = this._createSurfaceMesh();
        }

        this.groupGL.remove(this._prevSurfaceMesh);
        this.groupGL.add(this._surfaceMesh);

        var coordSys = seriesModel.coordinateSystem;
        var shading = seriesModel.get('shading');
        var data = seriesModel.getData();

        var shadingPrefix = 'ecgl.' + shading;
        if (!this._surfaceMesh.material || this._surfaceMesh.material.shader.name !== shadingPrefix) {
            this._surfaceMesh.material = graphicGL.createMaterial(shadingPrefix, ['VERTEX_COLOR', 'DOUBLE_SIDED']);
        }

        graphicGL.setMaterialFromModel(
            shading, this._surfaceMesh.material, seriesModel, api
        );

        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            this._surfaceMesh.material[methodName]('fragment', 'SRGB_DECODE');
        }

        var isParametric = seriesModel.get('parametric');

        var dataShape = seriesModel.get('dataShape');
        if (!dataShape) {
            dataShape = this._getDataShape(data, isParametric);
            if (__DEV__) {
                if (seriesModel.get('data')) {
                    console.warn('dataShape is not provided. Guess it is ', dataShape);
                }
            }
        }

        var wireframeModel = seriesModel.getModel('wireframe');
        var wireframeLineWidth = wireframeModel.get('lineStyle.width');
        var showWireframe = wireframeModel.get('show') && wireframeLineWidth > 0;
        this._updateSurfaceMesh(this._surfaceMesh, seriesModel, dataShape, showWireframe);

        var material = this._surfaceMesh.material;
        if (showWireframe) {
            material.define('WIREFRAME_QUAD');
            material.set('wireframeLineWidth', wireframeLineWidth);
            material.set('wireframeLineColor', graphicGL.parseColor(wireframeModel.get('lineStyle.color')));
        }
        else {
            material.undefine('WIREFRAME_QUAD');
        }

        this._initHandler(seriesModel, api);

        this._updateAnimation(seriesModel);
    },

    _updateAnimation: function (seriesModel) {
        graphicGL.updateVertexAnimation(
            [['prevPosition', 'position'],
            ['prevNormal', 'normal']],
            this._prevSurfaceMesh,
            this._surfaceMesh,
            seriesModel
        );
    },

    _createSurfaceMesh: function () {
        var mesh = new graphicGL.Mesh({
            geometry: new graphicGL.Geometry({
                dynamic: true,
                sortTriangles: true
            }),
            shadowDepthMaterial: new graphicGL.Material({
                shader: new graphicGL.Shader(graphicGL.Shader.source('ecgl.sm.depth.vertex'), graphicGL.Shader.source('ecgl.sm.depth.fragment'))
            }),
            culling: false,
            // Render after axes
            renderOrder: 10,
            // Render normal in normal pass
            renderNormal: true
        });
        mesh.geometry.createAttribute('barycentric', 'float', 4);
        mesh.geometry.createAttribute('prevPosition', 'float', 3);
        mesh.geometry.createAttribute('prevNormal', 'float', 3);

        echarts.util.extend(mesh.geometry, trianglesSortMixin);

        return mesh;
    },

    _initHandler: function (seriesModel, api) {
        var data = seriesModel.getData();
        var surfaceMesh = this._surfaceMesh;

        var coordSys = seriesModel.coordinateSystem;

        function getNearestPointIdx(triangle, point) {
            var nearestDist = Infinity;
            var nearestIdx = -1;
            var pos = [];
            for (var i = 0; i < triangle.length; i++) {
                surfaceMesh.geometry.attributes.position.get(triangle[i], pos);
                var dist = vec3.dist(point.array, pos);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIdx = triangle[i];
                }
            }
            return nearestIdx;
        }

        surfaceMesh.seriesIndex = seriesModel.seriesIndex;

        var lastDataIndex = -1;

        surfaceMesh.off('mousemove');
        surfaceMesh.off('mouseout');
        surfaceMesh.on('mousemove', function (e) {
            var idx = getNearestPointIdx(e.triangle, e.point);
            if (idx >= 0) {
                var point = [];
                surfaceMesh.geometry.attributes.position.get(idx, point);
                var value = coordSys.pointToData(point);

                var minDist = Infinity;
                var dataIndex = -1;
                var item = [];
                for (var i = 0; i < data.count(); i++) {
                    item[0] = data.get('x', i);
                    item[1] = data.get('y', i);
                    item[2] = data.get('z', i);
                    var dist = vec3.squaredDistance(item, value);
                    if (dist < minDist) {
                        dataIndex = i;
                        minDist = dist;
                    }
                }

                if (dataIndex !== lastDataIndex) {
                    api.dispatchAction({
                        type: 'grid3DShowAxisPointer',
                        value: value
                    });
                }

                lastDataIndex = dataIndex;
                surfaceMesh.dataIndex = dataIndex;
            }
            else {
                surfaceMesh.dataIndex = -1;
            }
        }, this);
        surfaceMesh.on('mouseout', function (e) {
            lastDataIndex = -1;
            surfaceMesh.dataIndex = -1;

            api.dispatchAction({
                type: 'grid3DHideAxisPointer'
            });
        }, this);
    },

    _updateSurfaceMesh: function (surfaceMesh, seriesModel, dataShape, showWireframe) {

        var geometry = surfaceMesh.geometry;
        var data = seriesModel.getData();
        var pointsArr = data.getLayout('points');

        var invalidDataCount = 0;
        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                invalidDataCount++;
            }
        });
        var needsSplitQuad = invalidDataCount || showWireframe;

        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var texcoordAttr = geometry.attributes.texcoord0;
        var barycentricAttr = geometry.attributes.barycentric;
        var colorAttr = geometry.attributes.color;
        var row = dataShape[0];
        var column = dataShape[1];
        var shading = seriesModel.get('shading');
        var needsNormal = shading !== 'color';

        if (needsSplitQuad) {
            // TODO, If needs remove the invalid points, or set color transparent.
            var vertexCount = (row - 1) * (column - 1) * 4;
            positionAttr.init(vertexCount);
            if (showWireframe) {
                barycentricAttr.init(vertexCount);
            }
        }
        else {
            positionAttr.value = new Float32Array(pointsArr);
        }
        colorAttr.init(geometry.vertexCount);
        texcoordAttr.init(geometry.vertexCount);

        var quadToTriangle = [0, 3, 1, 1, 3, 2];
        // 3----2
        // 0----1
        // Make sure pixels on 1---3 edge will not have channel 0.
        // And pixels on four edges have at least one channel 0.
        var quadBarycentric = [
            [1, 1, 0, 0],
            [0, 1, 0, 1],
            [1, 0, 0, 1],
            [1, 0, 1, 0]
        ];

        var indices = geometry.indices = new (geometry.vertexCount > 0xffff ? Uint32Array : Uint16Array)((row - 1) * (column - 1) * 6);
        var getQuadIndices = function (i, j, out) {
            out[1] = i * column + j;
            out[0] = i * column + j + 1;
            out[3] = (i + 1) * column + j + 1;
            out[2] = (i + 1) * column + j;
        };

        var isTransparent = false;

        if (needsSplitQuad) {
            var quadIndices = [];
            var pos = [];
            var faceOffset = 0;

            if (needsNormal) {
                normalAttr.init(geometry.vertexCount);
            }
            else {
                normalAttr.value = null;
            }

            var pts = [[], [], []];
            var v21 = [], v32 = [];
            var normal = vec3.create();

            var getFromArray = function (arr, idx, out) {
                var idx3 = idx * 3;
                out[0] = arr[idx3];
                out[1] = arr[idx3 + 1];
                out[2] = arr[idx3 + 2];
                return out;
            };
            var vertexNormals = new Float32Array(pointsArr.length);
            var vertexColors = new Float32Array(pointsArr.length / 3 * 4);

            for (var i = 0; i < data.count(); i++) {
                if (data.hasValue(i)) {
                    var rgbaArr = graphicGL.parseColor(data.getItemVisual(i, 'color'));
                    var opacity = data.getItemVisual(i, 'opacity');
                    rgbaArr[3] *= opacity;
                    if (rgbaArr[3] < 0.99) {
                        isTransparent = true;
                    }
                    for (var k = 0; k < 4; k++) {
                        vertexColors[i * 4 + k] = rgbaArr[k];
                    }
                }
            }
            var farPoints = [1e7, 1e7, 1e7];
            for (var i = 0; i < row - 1; i++) {
                for (var j = 0; j < column - 1; j++) {
                    var dataIndex = i * (column - 1) + j;
                    var vertexOffset = dataIndex * 4;

                    getQuadIndices(i, j, quadIndices);

                    var invisibleQuad = false;
                    for (var k = 0; k < 4; k++) {
                        getFromArray(pointsArr, quadIndices[k], pos);
                        if (isPointsNaN(pos)) {
                            // Quad is invisible if any point is NaN
                            invisibleQuad = true;
                        }
                    }

                    for (var k = 0; k < 4; k++) {
                        if (invisibleQuad) {
                            // Move point far away
                            positionAttr.set(vertexOffset + k, farPoints);
                        }
                        else {
                            getFromArray(pointsArr, quadIndices[k], pos);
                            positionAttr.set(vertexOffset + k, pos);
                        }
                        if (showWireframe) {
                            barycentricAttr.set(vertexOffset + k, quadBarycentric[k]);
                        }
                    }
                    for (var k = 0; k < 6; k++) {
                        indices[faceOffset++] = quadToTriangle[k] + vertexOffset;
                    }
                    // Vertex normals
                    if (needsNormal && !invisibleQuad) {
                        for (var k = 0; k < 2; k++) {
                            var k3 = k * 3;

                            for (var m = 0; m < 3; m++) {
                                var idx = quadIndices[quadToTriangle[k3] + m];
                                getFromArray(pointsArr, idx, pts[m]);
                            }

                            vec3.sub(v21, pts[0], pts[1]);
                            vec3.sub(v32, pts[1], pts[2]);
                            vec3.cross(normal, v21, v32);
                            // Weighted by the triangle area
                            for (var m = 0; m < 3; m++) {
                                var idx3 = quadIndices[quadToTriangle[k3] + m] * 3;
                                vertexNormals[idx3] = vertexNormals[idx3] + normal[0];
                                vertexNormals[idx3 + 1] = vertexNormals[idx3 + 1] + normal[1];
                                vertexNormals[idx3 + 2] = vertexNormals[idx3 + 2] + normal[2];
                            }
                        }
                    }

                }
            }
            if (needsNormal) {
                for (var i = 0; i < vertexNormals.length / 3; i++) {
                    getFromArray(vertexNormals, i, normal);
                    vec3.normalize(normal, normal);
                    vertexNormals[i * 3] = normal[0];
                    vertexNormals[i * 3 + 1] = normal[1];
                    vertexNormals[i * 3 + 2] = normal[2];
                }
            }
            // Split normal and colors, write to the attributes.
            var rgbaArr = [];
            var uvArr = [];
            for (var i = 0; i < row - 1; i++) {
                for (var j = 0; j < column - 1; j++) {
                    var dataIndex = i * (column - 1) + j;
                    var vertexOffset = dataIndex * 4;

                    getQuadIndices(i, j, quadIndices);
                    for (var k = 0; k < 4; k++) {
                        for (var m = 0; m < 4; m++) {
                            rgbaArr[m] = vertexColors[quadIndices[k] * 4 + m];
                        }
                        colorAttr.set(vertexOffset + k, rgbaArr);

                        if (needsNormal) {
                            getFromArray(vertexNormals, quadIndices[k], normal);
                            normalAttr.set(vertexOffset + k, normal);
                        }

                        var idx = quadIndices[k];
                        uvArr[0] = (idx % column) / (column - 1);
                        uvArr[1] = Math.floor(idx / column) / (row - 1);
                        texcoordAttr.set(vertexOffset + k, uvArr);
                    }
                    dataIndex++;
                }
            }
        }
        else {
            var uvArr = [];
            for (var i = 0; i < data.count(); i++) {
                uvArr[0] = (i % column) / (column - 1);
                uvArr[1] = Math.floor(i / column) / (row - 1);
                var rgbaArr = graphicGL.parseColor(data.getItemVisual(i, 'color'));
                var opacity = data.getItemVisual(i, 'opacity');
                rgbaArr[3] *= opacity;
                if (rgbaArr[3] < 0.99) {
                    isTransparent = true;
                }
                colorAttr.set(i, rgbaArr);
                texcoordAttr.set(i, uvArr);
            }
            var quadIndices = [];
            // Triangles
            var cursor = 0;
            for (var i = 0; i < row - 1; i++) {
                for (var j = 0; j < column - 1; j++) {

                    getQuadIndices(i, j, quadIndices);

                    for (var k = 0; k < 6; k++) {
                        indices[cursor++] = quadIndices[quadToTriangle[k]];
                    }
                }
            }
            if (needsNormal) {
                geometry.generateVertexNormals();
            }
            else {
                normalAttr.value = null;
            }
        }
        if (surfaceMesh.material.get('normalMap')) {
            geometry.generateTangents();
        }


        geometry.updateBoundingBox();
        geometry.dirty();

        surfaceMesh.material.transparent = isTransparent;
        surfaceMesh.material.depthMask = !isTransparent;
    },

    _getDataShape: function (data, isParametric) {

        var prevX = -Infinity;
        var rowCount = 0;
        var columnCount = 0;
        var prevColumnCount = 0;

        var mayInvalid = false;

        var rowDim = isParametric ? 'u' : 'x';
        var dataCount = data.count();
        // Check data format
        for (var i = 0; i < dataCount; i++) {
            var x = data.get(rowDim, i);
            if (x < prevX) {
                if (prevColumnCount && prevColumnCount !== columnCount) {
                    if (__DEV__) {
                        mayInvalid = true;
                    }
                }
                // A new row.
                prevColumnCount = columnCount;
                columnCount = 0;
                rowCount++;
            }
            prevX = x;
            columnCount++;
        }
        if (!rowCount || columnCount === 1) {
            mayInvalid = true;
        }
        if (!mayInvalid) {
            return [rowCount + 1, columnCount];
        }

        var rows = Math.floor(Math.sqrt(dataCount));
        while (rows > 0) {
            if (Math.floor(dataCount / rows) === dataCount / rows) { // Can be divided
                return [rows, dataCount / rows];
            }
            rows--;
        }

        // Bailout
        rows = Math.floor(Math.sqrt(dataCount));
        return [rows, rows];
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});