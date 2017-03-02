var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

function isPointsNaN(pt) {
    return isNaN(pt[0]) || isNaN(pt[1]) || isNaN(pt[2]);
}

echarts.extendChartView({

    type: 'surface',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var materials = {};
        ['lambert', 'color', 'realistic'].forEach(function (shading) {
            materials[shading] = new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.' + shading)
            });
            materials[shading].shader.define('both', 'VERTEX_COLOR');
            materials[shading].shader.define('fragment', 'DOUBLE_SIDE');
        });

        this._materials = materials;

        var mesh = new graphicGL.Mesh({
            geometry: new graphicGL.Geometry({
                dynamic: true
            }),
            material: materials.lambert,
            culling: false
        });
        mesh.geometry.createAttribute('barycentric', 'float', 4, null),

        this._surfaceMesh = mesh;
        this.groupGL.add(this._surfaceMesh);
    },

    render: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        var shading = seriesModel.get('shading');
        var data = seriesModel.getData();

        if (this._materials[shading]) {
            this._surfaceMesh.material = this._materials[shading];
        }
        else {
            if (__DEV__) {
                console.error('Unkown shading %s', shading);
            }
            this._surfaceMesh.material = this._materials.lambert;
        }
        if (shading === 'realistic') {
            var matModel = seriesModel.getModel('realisticMaterial');
            this._surfaceMesh.material.set({
                roughness: retrieve.firstNotNull(matModel.get('roughness'), 0.5),
                metalness: matModel.get('metalness') || 0
            });
        }

        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'unDefine';
            this._surfaceMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

        var geometry = this._surfaceMesh.geometry;

        var isParametric = seriesModel.get('parametric');

        var dataShape = this._getDataShape(data, isParametric);

        var wireframeModel = seriesModel.getModel('wireframe');
        var wireframeLineWidth = wireframeModel.get('lineWidth');
        var showWireframe = wireframeModel.get('show') && wireframeLineWidth > 0;
        this._updateGeometry(geometry, seriesModel, dataShape, showWireframe);

        var material = this._surfaceMesh.material;
        if (showWireframe) {
            material.shader.define('WIREFRAME_QUAD');
            material.set('wireframeLineWidth', wireframeLineWidth);
            material.set('wireframeLineColor', graphicGL.parseColor(wireframeModel.get('lineColor')).slice(0, 3));
        }
        else {
            material.shader.unDefine('WIREFRAME_QUAD');
        }
    },

    _updateGeometry: function (geometry, seriesModel, dataShape, showWireframe) {

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
        var barycentricAttr = geometry.attributes.barycentric;
        var colorAttr = geometry.attributes.color;
        var row = dataShape.row;
        var column = dataShape.column;
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

        var quadToTriangle = [0, 3, 1, 1, 3, 2];
        // 3----2
        // 0----1
        // Make sure pixels on 1---3 edge will not have all channel 0.
        // And pixels on four edges have at least one channel 0.
        var quadBarycentric = [
            [1, 1, 0, 0],
            [0, 0, 1, 1],
            [1, 0, 0, 1],
            [1, 1, 0, 0]
        ];

        var faces = geometry.faces = new (geometry.vertexCount > 0xffff ? Uint32Array : Uint16Array)((row - 1) * (column - 1) * 6);
        var getQuadIndices = function (i, j, out) {
            out[1] = i * column + j;
            out[0] = i * column + j + 1;
            out[3] = (i + 1) * column + j + 1;
            out[2] = (i + 1) * column + j;
        };
        if (needsSplitQuad) {
            var quadIndices = [];
            var pos = [];
            var faceOffset = 0;

            if (needsNormal) {
                normalAttr.init(geometry.vertexCount);
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
                var rgbaArr = graphicGL.parseColor(data.getItemVisual(i, 'color'));
                for (var k = 0; k < 4; k++) {
                    vertexColors[i * 4 + k] = rgbaArr[k];
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
                        faces[faceOffset++] = quadToTriangle[k] + vertexOffset;
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
                // Split normal and colors, write to the attributes.
                var rgbaArr = [];
                for (var i = 0; i < vertexNormals.length / 3; i++) {
                    getFromArray(vertexNormals, i, normal);
                    vec3.normalize(normal, normal);
                    vertexNormals[i * 3] = normal[0];
                    vertexNormals[i * 3 + 1] = normal[1];
                    vertexNormals[i * 3 + 2] = normal[2];
                }
                for (var i = 0; i < row - 1; i++) {
                    for (var j = 0; j < column - 1; j++) {
                        var dataIndex = i * (column - 1) + j;
                        var vertexOffset = dataIndex * 4;
                        getQuadIndices(i, j, quadIndices);
                        for (var k = 0; k < 4; k++) {
                            getFromArray(vertexNormals, quadIndices[k], normal);
                            for (var m = 0; m < 4; m++) {
                                rgbaArr[m] = vertexColors[quadIndices[k] * 4 + m];
                            }
                            normalAttr.set(vertexOffset + k, normal);
                            colorAttr.set(vertexOffset + k, rgbaArr);
                        }
                        dataIndex++;
                    }
                }
            }
        }
        else {
            for (var i = 0; i < data.count(); i++) {
                // TODO Opacity
                var rgbaArr = graphicGL.parseColor(data.getItemVisual(i, 'color'));
                colorAttr.set(i, rgbaArr);
            }
            var quadIndices = [];
            // Faces
            var cursor = 0;
            for (var i = 0; i < row - 1; i++) {
                for (var j = 0; j < column - 1; j++) {

                    getQuadIndices(i, j, quadIndices);

                    for (var k = 0; k < 6; k++) {
                        faces[cursor++] = quadIndices[quadToTriangle[k]];
                    }
                }
            }
            if (needsNormal) {
                geometry.generateVertexNormals();
            }
        }

        geometry.updateBoundingBox();
        geometry.dirty();
    },

    _getDataShape: function (data, isParametric) {

        var prevX = -Infinity;
        var rowCount = 0;
        var columnCount = 0;
        var prevColumnCount = 0;

        var rowDim = isParametric ? 'u' : 'x';

        // Check data format
        for (var i = 0; i < data.count(); i++) {
            var x = data.get(rowDim, i);
            if (x < prevX) {
                if (prevColumnCount && prevColumnCount !== columnCount) {
                    if (__DEV__) {
                        throw new Error('Invalid data. data should be a row major 2d array.')
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

        return {
            row: rowCount + 1,
            column: columnCount
        };
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});