var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var Lines3DGeometry = require('../../util/geometry/Lines3D');

graphicGL.Shader.import(require('text!../../util/shader/lines3D.glsl'));

module.exports = echarts.extendChartView({

    type: 'line3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var line3DMesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({
                useNativeLine: false
            }),
            material: new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.meshLines3D')
            }),
            // Render after axes
            renderOrder: 10
        });

        this._line3DMesh = line3DMesh;

        this._api = api;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._line3DMesh);

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
            // TODO
            // var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'unDefine';
            // this._line3DMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }
        this._doRender(seriesModel, api);

        this._data = seriesModel.getData();
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
            // if (!data.hasValue(idx)) {
            //     return;
            // }
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
            retrieve.firstNotNull(seriesModel.get('lineStyle.width'), 1),
            true
        );

        lineMesh.geometry.dirty();
        lineMesh.geometry.updateBoundingBox();

        var material = lineMesh.material;
        material.transparent = hasTransparent;
        material.depthMask = !hasTransparent;
        lineMesh.geometry.sortTriangles = hasTransparent;

        this._initHandler(seriesModel, api);
    },

    _initHandler: function (seriesModel, api) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;
        var lineMesh = this._line3DMesh;

        var lastDataIndex = -1;
        lineMesh.off('mousemove');
        lineMesh.off('mouseout');
        lineMesh.on('mousemove', function (e) {
            var value = coordSys.pointToData(e.point._array);
            var dataIndex = data.indexOfNearest('x', value[0]);
            if (dataIndex !== lastDataIndex) {
                this._downplay(lastDataIndex);
                this._highlight(dataIndex);

                api.dispatchAction({
                    type: 'grid3DShowAxisPointer',
                    value: [data.get('x', dataIndex), data.get('y', dataIndex), data.get('z', dataIndex)]
                });
            }

            lastDataIndex = dataIndex;
        }, this);
        lineMesh.on('mouseout', function (e) {
            this._downplay(lastDataIndex);
            lastDataIndex = -1;
            api.dispatchAction({
                type: 'grid3DHideAxisPointer'
            });
        }, this);
    },

    _highlight: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }
        // var barIndex = this._barIndexOfData[dataIndex];
        // if (barIndex < 0) {
        //     return;
        // }

        // var itemModel = data.getItemModel(dataIndex);
        // var emphasisItemStyleModel = itemModel.getModel('emphasis.itemStyle');
        // var emphasisColor = emphasisItemStyleModel.get('color');
        // var emphasisOpacity = emphasisItemStyleModel.get('opacity');
        // if (emphasisColor == null) {
        //     var color = data.getItemVisual(dataIndex, 'color');
        //     emphasisColor = echarts.color.lift(color, -0.4);
        // }
        // if (emphasisOpacity == null) {
        //     emphasisOpacity = data.getItemVisual(dataIndex, 'opacity');
        // }
        // var colorArr = graphicGL.parseColor(emphasisColor);
        // colorArr[3] *= emphasisOpacity;

    },

    _downplay: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }
        // var barIndex = this._barIndexOfData[dataIndex];
        // if (barIndex < 0) {
        //     return;
        // }

        // var color = data.getItemVisual(dataIndex, 'color');
        // var opacity = data.getItemVisual(dataIndex, 'opacity');

        // var colorArr = graphicGL.parseColor(color);
        // colorArr[3] *= opacity;
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});