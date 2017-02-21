var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');

graphicGL.Shader.import(require('text!../../util/shader/albedo.glsl'));
graphicGL.Shader.import(require('text!../../util/shader/lambert.glsl'));

echarts.extendChartView({

    type: 'surface',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var lambertMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.lambert')
        });
        var albedoMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.albedo')
        });
        lambertMaterial.shader.define('both', 'VERTEX_COLOR');

        this._lambertMaterial = lambertMaterial;
        this._albedoMaterial = albedoMaterial;
        var mesh = new graphicGL.Mesh({
            geometry: new graphicGL.Geometry(),
            material: lambertMaterial,
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

        if (shading === 'albedo') {
            this._surfaceMesh.material = this._albedoMaterial;
        }
        else if (shading === 'lambert') {
            this._surfaceMesh.material = this._lambertMaterial;
        }
        else {
            if (__DEV__) {
                console.error('Unkown shading %s', shading);
            }
            this._surfaceMesh.material = this._lambertMaterial;
        }

        var geometry = this._surfaceMesh.geometry;

        var isParametric = seriesModel.get('parametric');
        var dataShape = this._getDataShape(data, isParametric);

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

        if (shading === 'lambert') {
            geometry.generateVertexNormals();
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