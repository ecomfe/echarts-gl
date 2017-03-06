var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var BarsGeometry = require('../../util/geometry/Bars3DGeometry');
var ZRTextureAtlasSurface = require('../../util/ZRTextureAtlasSurface');
var LabelsMesh = require('../../util/mesh/LabelsMesh');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

function getShader(shading) {
    var shader = graphicGL.createShader('ecgl.' + shading);
    shader.define('both', 'VERTEX_COLOR');
    return shader;
}

var LABEL_NORMAL_SHOW_BIT = 1;
var LABEL_EMPHASIS_SHOW_BIT = 2;

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


        this._labelsMesh = new LabelsMesh({
            renderOrder: 11
        });

        this._labelTextureSurface = new ZRTextureAtlasSurface(
            1024, 1024, api.getDevicePixelRatio(), function () {
                api.getZr().refresh();
            }
        );
        this._labelsMesh.material.set('textureAtlas', this._labelTextureSurface.getTexture());
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._barMesh);
        this.groupGL.add(this._labelsMesh);

        var coordSys = seriesModel.coordinateSystem;
        this._doRender(seriesModel, api);
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);

            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'unDefine';
            this._barMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

        this._data = seriesModel.getData();

        this._labelsVisibilitiesBits = new Uint8Array(this._data.count());
        var normalLabelVisibilityQuery = ['label', 'normal', 'show'];
        var emphasisLabelVisibilityQuery = ['label', 'emphasis', 'show'];
        var data = this._data;
        data.each(function (idx) {
            var itemModel = data.getItemModel(idx);
            var normalVisibility = itemModel.get(normalLabelVisibilityQuery);
            var emphasisVisibility = itemModel.get(emphasisLabelVisibilityQuery);
            if (emphasisVisibility == null) {
                emphasisVisibility = normalVisibility;
            }
            var bit = (normalVisibility ? LABEL_NORMAL_SHOW_BIT : 0)
                | (emphasisVisibility ? LABEL_EMPHASIS_SHOW_BIT : 0);
            this._labelsVisibilitiesBits[idx] = bit;
        }, false, this);

        this._updateLabels();

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
                console.warn('Unkonw shading ' + shading);
            }
            barMesh.material = this._materials.lambert;
        }
        if (shading === 'realistic') {
            var matModel = seriesModel.getModel('realisticMaterial');
            var matOpt = {
                roughness: retrieve.firstNotNull(matModel.get('roughness'), 0.5),
                metalness: matModel.get('metalness') || 0
            };
            barMesh.material.set(matOpt);
        }

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

        // Seperate opaque and transparent bars.
        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                return;
            }
            var color = data.getItemVisual(idx, 'color');

            var opacity = data.getItemVisual(idx, 'opacity');
            if (opacity == null) {
                opacity = 1;
            }

            echarts.color.parse(color, colorArr);
            colorArr[3] *= opacity;
            vertexColors[colorOffset++] = colorArr[0] / 255;
            vertexColors[colorOffset++] = colorArr[1] / 255;
            vertexColors[colorOffset++] = colorArr[2] / 255;
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

        barMesh.off('mouseover');
        barMesh.off('mouseout');
        barMesh.on('mouseover', function (e) {
            var dataIndex = barMesh.geometry.getDataIndexOfVertex(e.triangle[0]);
            this._highlight(dataIndex);
            this._updateLabels([dataIndex]);
        }, this);
        barMesh.on('mouseout', function (e) {
            var dataIndex = barMesh.geometry.getDataIndexOfVertex(e.triangle[0]);
            this._downplay(dataIndex);
            this._updateLabels();
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
        var emphasisModel = itemModel.getModel('itemStyle.emphasis');
        var emphasisColor = emphasisModel.get('color');
        var emphasisOpacity = emphasisModel.get('opacity');
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

    _updateLabels: function (highlightDataIndices) {

        highlightDataIndices = highlightDataIndices || [];

        var hasHighlightData = highlightDataIndices.length > 0;
        var highlightDataIndicesMap = {};
        for (var i = 0; i < highlightDataIndices.length; i++) {
            highlightDataIndicesMap[highlightDataIndices[i]] = true;
        }

        this._labelsMesh.geometry.convertToDynamicArray(true);
        this._labelTextureSurface.clear();

        var normalLabelQuery = ['label', 'normal'];
        var emphasisLabelQuery = ['label', 'emphasis'];
        var seriesModel = this._data.hostModel;
        var data = this._data;
        var labelPos = vec3.create();

        var seriesLabelModel = seriesModel.getModel(normalLabelQuery);
        var seriesLabelEmphasisModel = seriesModel.getModel(emphasisLabelQuery, seriesLabelModel);

        data.each(function (dataIndex) {
            var isEmphasis = false;
            if (hasHighlightData && highlightDataIndicesMap[dataIndex]) {
                isEmphasis = true;
            }
            var ifShow = this._labelsVisibilitiesBits[dataIndex]
                & (isEmphasis ? LABEL_EMPHASIS_SHOW_BIT : LABEL_NORMAL_SHOW_BIT);
            if (!ifShow) {
                return;
            }

            var itemModel = data.getItemModel(dataIndex);
            var labelModel = itemModel.getModel(
                isEmphasis ? emphasisLabelQuery : normalLabelQuery,
                isEmphasis ? seriesLabelEmphasisModel : seriesLabelModel
            );
            var distance = labelModel.get('distance');
            var textStyleModel = labelModel.getModel('textStyle');

            var dpr = this._api.getDevicePixelRatio();
            var text = retrieve.firstNotNull(
                seriesModel.getFormattedLabel(name, isEmphasis ? 'emphasis' : 'normal'),
                data.get('z', dataIndex)
            );
            var textEl = new echarts.graphic.Text({
                style: {
                    text: text,
                    font: textStyleModel.getFont(),
                    fill: textStyleModel.get('color') || data.getItemVisual(dataIndex, 'color'),
                    stroke: textStyleModel.get('borderColor'),
                    lineWidth: textStyleModel.get('borderWidth') / dpr,
                    textAlign: 'left',
                    textVerticalAlign: 'top'
                }
            });
            var rect = textEl.getBoundingRect();
            var layout = data.getItemLayout(dataIndex);
            var start = layout[0];
            var dir = layout[1];
            var height = layout[2][1];
            vec3.scaleAndAdd(labelPos, start, dir, distance + height);

            var coords = this._labelTextureSurface.add(textEl);

            this._labelsMesh.geometry.addSprite(
                 labelPos, [rect.width * dpr, rect.height * dpr], coords,
                'center', 'bottom'
            );
        }, false, this);

        this._labelsMesh.geometry.convertToTypedArray();
        this._labelsMesh.geometry.dirty();
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});