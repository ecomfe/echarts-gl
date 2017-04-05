var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var BarsGeometry = require('../../util/geometry/Bars3DGeometry');
var LabelsBuilder = require('../../component/common/LabelsBuilder');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

function getShader(shading) {
    var shader = graphicGL.createShader('ecgl.' + shading);
    shader.define('both', 'VERTEX_COLOR');
    return shader;
}

module.exports = echarts.extendChartView({

    type: 'bar3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var barMesh = new graphicGL.Mesh({
            geometry: new BarsGeometry(),

            // Render after axes
            renderOrder: 10
        });

        var materials = {};
        graphicGL.COMMON_SHADERS.forEach(function (shading) {
            materials[shading] = new graphicGL.Material({
                shader: getShader(shading)
            });
        });

        this._materials = materials;
        this._barMesh = barMesh;

        this._api = api;

        this._labelsBuilder = new LabelsBuilder(256, 256, api);
        var self = this;
        this._labelsBuilder.getLabelPosition = function (dataIndex, position, distance) {
            if (self._data) {
                var layout = self._data.getItemLayout(dataIndex);
                var start = layout[0];
                var dir = layout[1];
                var height = layout[2][1];
                return vec3.scaleAndAdd([], start, dir, distance + height);
            }
            else {
                return [0, 0];
            }
        };

        // Give a large render order.
        this._labelsBuilder.getMesh().renderOrder = 100;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._barMesh);
        this.groupGL.add(this._labelsBuilder.getMesh());

        var coordSys = seriesModel.coordinateSystem;
        this._doRender(seriesModel, api);
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);

            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            this._barMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

        this._data = seriesModel.getData();

        this._labelsBuilder.updateData(this._data);

        this._labelsBuilder.updateLabels();
    },

    _doRender: function (seriesModel, api) {
        var data = seriesModel.getData();
        var shading = seriesModel.get('shading');
        var enableNormal = shading !== 'color';
        var self = this;
        var barMesh = this._barMesh;

        if (this._materials[shading]) {
            barMesh.material = this._materials[shading];
        }
        else {
            if (__DEV__) {
                console.warn('Unkown shading ' + shading);
            }
            barMesh.material = this._materials.lambert;
        }
        graphicGL.setMaterialFromModel(
            shading, barMesh.material, seriesModel, api
        );

        barMesh.geometry.enableNormal = enableNormal;

        barMesh.geometry.resetOffset();

        // Bevel settings
        var bevelSize = seriesModel.get('bevelSize');
        var bevelSegments = seriesModel.get('bevelSmoothness');
        barMesh.geometry.bevelSegments = bevelSegments;

        barMesh.geometry.bevelSize = bevelSize;

        var colorArr = [];
        var vertexColors = new Float32Array(data.count() * 4);
        var colorOffset = 0;
        var barCount = 0;
        var hasTransparent = false;

        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                return;
            }
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

            if (colorArr[3] > 0) {
                barCount++;
            }
            if (colorArr[3] < 0.99) {
                hasTransparent = true;
            }
        });

        barMesh.geometry.setBarCount(barCount);

        var orient = data.getLayout('orient');

        // Map of dataIndex and barIndex.
        var barIndexOfData = this._barIndexOfData = new Int32Array(data.count());
        var barCount = 0;
        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                barIndexOfData[idx] = -1;
                return;
            }
            var layout = data.getItemLayout(idx);
            var start = layout[0];
            var dir = layout[1];
            var size = layout[2];

            var idx4 = idx * 4;
            colorArr[0] = vertexColors[idx4++];
            colorArr[1] = vertexColors[idx4++];
            colorArr[2] = vertexColors[idx4++];
            colorArr[3] = vertexColors[idx4++];
            if (colorArr[3] > 0) {
                self._barMesh.geometry.addBar(start, dir, orient, size, colorArr, idx);
            }

            barIndexOfData[idx] = barCount++;
        });

        barMesh.geometry.dirty();
        barMesh.geometry.updateBoundingBox();

        var material = barMesh.material;
        material.transparent = hasTransparent;
        material.depthMask = !hasTransparent;
        barMesh.geometry.sortTriangles = hasTransparent;

        this._initHandler(seriesModel, api);
    },

    _initHandler: function (seriesModel, api) {
        var data = seriesModel.getData();
        var barMesh = this._barMesh;
        var isCartesian3D = seriesModel.coordinateSystem.type === 'cartesian3D';

        var lastDataIndex = -1;
        barMesh.off('mousemove');
        barMesh.off('mouseout');
        barMesh.on('mousemove', function (e) {
            var dataIndex = barMesh.geometry.getDataIndexOfVertex(e.triangle[0]);
            if (dataIndex !== lastDataIndex) {
                this._downplay(lastDataIndex);
                this._highlight(dataIndex);
                this._labelsBuilder.updateLabels([dataIndex]);

                if (isCartesian3D) {
                    api.dispatchAction({
                        type: 'grid3DShowAxisPointer',
                        value: [data.get('x', dataIndex), data.get('y', dataIndex), data.get('z', dataIndex)]
                    });
                }
            }

            lastDataIndex = dataIndex;
        }, this);
        barMesh.on('mouseout', function (e) {
            this._downplay(lastDataIndex);
            this._labelsBuilder.updateLabels();
            lastDataIndex = -1;

            if (isCartesian3D) {
                api.dispatchAction({
                    type: 'grid3DHideAxisPointer'
                });
            }
        }, this);
    },

    _highlight: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }
        var barIndex = this._barIndexOfData[dataIndex];
        if (barIndex < 0) {
            return;
        }

        var itemModel = data.getItemModel(dataIndex);
        var emphasisItemStyleModel = itemModel.getModel('emphasis.itemStyle');
        var emphasisColor = emphasisItemStyleModel.get('color');
        var emphasisOpacity = emphasisItemStyleModel.get('opacity');
        if (emphasisColor == null) {
            var color = data.getItemVisual(dataIndex, 'color');
            emphasisColor = echarts.color.lift(color, -0.4);
        }
        if (emphasisOpacity == null) {
            emphasisOpacity = data.getItemVisual(dataIndex, 'opacity');
        }
        var colorArr = graphicGL.parseColor(emphasisColor);
        colorArr[3] *= emphasisOpacity;

        this._barMesh.geometry.setColor(barIndex, colorArr);

        this._api.getZr().refresh();
    },

    _downplay: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }
        var barIndex = this._barIndexOfData[dataIndex];
        if (barIndex < 0) {
            return;
        }

        var color = data.getItemVisual(dataIndex, 'color');
        var opacity = data.getItemVisual(dataIndex, 'opacity');

        var colorArr = graphicGL.parseColor(color);
        colorArr[3] *= opacity;

        this._barMesh.geometry.setColor(barIndex, colorArr);

        this._api.getZr().refresh();
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});