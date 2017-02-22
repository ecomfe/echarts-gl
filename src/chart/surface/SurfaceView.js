var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

echarts.extendChartView({

    type: 'surface',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var materials = {};
        ['lambert', 'albedo', 'realastic'].forEach(function (shading) {
            materials[shading] = new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.' + shading)
            });
            materials[shading].shader.define('both', 'VERTEX_COLOR');
        });

        this._materials = materials;

        var mesh = new graphicGL.Mesh({
            geometry: new graphicGL.Geometry(),
            material: materials.lambert,
            culling: false
        });

        this._surfaceMesh = mesh;
        this.groupGL.add(this._surfaceMesh);
    },

    render: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
        }

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

        var geometry = this._surfaceMesh.geometry;

        var isParametric = seriesModel.get('parametric');

        var dataShape = this._getDataShape(data, isParametric);

        this._updateGeometry(geometry, seriesModel, dataShape);
    },

    _updateGeometry: function (geometry, seriesModel, dataShape) {
        var data = seriesModel.getData();
        var points = data.getLayout('points');
        var offset = 0;
        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var colorAttr = geometry.attributes.color;
        positionAttr.value = new Float32Array(points);
        normalAttr.init(geometry.vertexCount);
        colorAttr.init(geometry.vertexCount);
        for (var i = 0; i < dataShape.row; i++) {
            for (var j = 0; j < dataShape.column; j++) {
                var rgbaArr = graphicGL.parseColor(data.getItemVisual(offset, 'color'));
                colorAttr.set(offset++, rgbaArr);
            }
        }

        var faces = [];
        // Faces
        for (var i = 0; i < dataShape.row - 1; i++) {
            for (var j = 0; j < dataShape.column - 1; j++) {
                var i2 = i * dataShape.column + j;
                var i1 = i * dataShape.column + j + 1;
                var i4 = (i + 1) * dataShape.column + j + 1;
                var i3 = (i + 1) * dataShape.column + j;

                faces.push([i1, i4, i2], [i2, i4, i3]);
            }
        }
        geometry.initFacesFromArray(faces);

        if (seriesModel.get('shading') === 'lambert') {
            geometry.generateVertexNormals();
            // Flip inside normals
            // PENDING better algorithm ?

            var isParametric = seriesModel.get('parametric');
            var center = [0, 0, 0];
            if (isParametric) {
                center = new graphicGL.Vector3();
                geometry.updateBoundingBox();
                var bbox = geometry.boundingBox;
                center.add(bbox.min).add(bbox.max).scale(0.5);
                center = center._array;
            }
            var normal = [];
            var pos = [];
            var up = [0, 1, 0];
            for (var i = 0; i < geometry.vertexCount; i++) {
                normalAttr.get(i, normal);
                if (isParametric) {
                    positionAttr.get(i, pos);
                    vec3.sub(pos, pos, center);
                    if (vec3.dot(normal, pos) < 0) {
                        vec3.negate(normal, normal);
                        normalAttr.set(i, normal);
                    }
                }
                else {
                    // Always face up
                    if (vec3.dot(normal, up) < 0) {
                        vec3.negate(normal, normal);
                        normalAttr.set(i, normal);
                    }
                }
            }
        }
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