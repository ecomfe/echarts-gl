var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var spriteUtil = require('../../util/sprite');
var PointsMesh = require('./PointsMesh');
var LabelsBuilder = require('../../component/common/LabelsBuilder');
var Matrix4 = require('qtek/lib/math/Matrix4');
var TooltipHelper = require('./TooltipHelper');

var SDF_RANGE = 20;

function isSymbolSizeSame(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}
// TODO gl_PointSize has max value.
function PointsBuilder(is2D, api) {

    this._mesh = new PointsMesh({
        // Render after axes
        renderOrder: 10
    });

    this.rootNode = new graphicGL.Node();
    this.rootNode.add(this._mesh);

    /**
     * @type {boolean}
     */
    this.is2D = is2D;

    this._labelsBuilder = new LabelsBuilder(256, 256, api);

    // Give a large render order.
    this._labelsBuilder.getMesh().renderOrder = 100;
    this.rootNode.add(this._labelsBuilder.getMesh());

    this._api = api;

    this._spriteImageCanvas = document.createElement('canvas');

    this._tooltip = new TooltipHelper(api);
}

PointsBuilder.prototype = {

    constructor: PointsBuilder,

    update: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();

        var symbolInfo = this._getSymbolInfo(data);
        var dpr = api.getDevicePixelRatio();

        symbolInfo.maxSize = Math.min(symbolInfo.maxSize * 2, 200);

        var symbolSize = [];
        if (symbolInfo.aspect > 1) {
            symbolSize[0] = symbolInfo.maxSize;
            symbolSize[1] = symbolInfo.maxSize / symbolInfo.aspect;
        }
        else {
            symbolSize[1] = symbolInfo.maxSize;
            symbolSize[0] = symbolInfo.maxSize * symbolInfo.aspect;
        }

        // TODO image symbol
        var itemStyle = seriesModel.getModel('itemStyle').getItemStyle();

        // In case invalid data.
        symbolSize[0] = symbolSize[0] || 1;
        symbolSize[1] = symbolSize[1] || 1;

        if (this._symbolType !== symbolInfo.type || !isSymbolSizeSame(this._symbolSize, symbolSize)
        || this._lineWidth !== itemStyle.lineWidth
        ) {
            spriteUtil.createSymbolSprite(symbolInfo.type, symbolSize, {
                fill: '#fff',
                lineWidth: itemStyle.lineWidth,
                stroke: 'transparent',
                shadowColor: 'transparent',
                marginBias: 10
            }, this._spriteImageCanvas);

            spriteUtil.createSDFFromCanvas(
                this._spriteImageCanvas, 32, SDF_RANGE,
                this._mesh.material.get('sprite').image
            );

            this._symbolType = symbolInfo.type;
            this._symbolSize = symbolSize;
            this._lineWidth = itemStyle.lineWidth;
        }

        var geometry = this._mesh.geometry;
        var points = data.getLayout('points');
        var attributes = geometry.attributes;
        attributes.position.init(data.count());
        attributes.size.init(data.count());
        attributes.color.init(data.count());
        var positionArr = attributes.position.value;

        var rgbaArr = [];
        var is2D = this.is2D;

        var pointSizeScale = this._spriteImageCanvas.width / symbolInfo.maxSize * dpr;

        var hasTransparentPoint = false;
        for (var i = 0; i < data.count(); i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            if (is2D) {
                positionArr[i3] = points[i2];
                positionArr[i3 + 1] = points[i2 + 1];
                positionArr[i3 + 2] = -10;
            }
            else {
                positionArr[i3] = points[i3];
                positionArr[i3 + 1] = points[i3 + 1];
                positionArr[i3 + 2] = points[i3 + 2];
            }

            var color = data.getItemVisual(i, 'color');
            var opacity = data.getItemVisual(i, 'opacity');
            graphicGL.parseColor(color, rgbaArr);
            rgbaArr[3] *= opacity;
            attributes.color.set(i, rgbaArr);
            if (rgbaArr[3] < 0.99) {
                hasTransparentPoint = true;
            }

            var symbolSize = data.getItemVisual(i, 'symbolSize');
            symbolSize = (symbolSize instanceof Array
                ? Math.max(symbolSize[0], symbolSize[1]) : symbolSize);

            // NaN pointSize may have strange result.
            if (isNaN(symbolSize)) {
                symbolSize = 0;
            }
            // Scale point size because canvas has margin.
            attributes.size.value[i] = symbolSize * pointSizeScale;
        }

        this._mesh.sizeScale = pointSizeScale;

        geometry.dirty();

        // Update material.
        var blendFunc = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
        var material = this._mesh.material;
        material.blend = blendFunc;

        material.set('lineWidth', itemStyle.lineWidth / SDF_RANGE);

        var strokeColor = graphicGL.parseColor(itemStyle.stroke);
        material.set('color', [1, 1, 1, 1]);
        material.set('strokeColor', strokeColor);

        if (this.is2D) {
            material.transparent = true;
            material.depthMask = false;
            material.depthTest = false;
            geometry.sortVertices = false;
        }
        else {
            // Because of symbol texture, we always needs it be transparent.
            material.depthTest = true;
            material.transparent = true;
            material.depthMask = false;
            geometry.sortVertices = true;
        }

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            this._mesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

        this._updateHandler(seriesModel, ecModel, api);

        // TODO scatterGL
        if (!is2D) {
            this._labelsBuilder.updateData(data);

            this._labelsBuilder.getLabelPosition = function (dataIndex, positionDesc, distance) {
                var idx3 = dataIndex * 3;
                var pos = [points[idx3], points[idx3 + 1], points[idx3 + 2]];
                return pos;
            };

            this._labelsBuilder.getLabelDistance = function (dataIndex, positionDesc, distance) {
                var size = geometry.attributes.size.get(dataIndex) / pointSizeScale;
                return size / 2 + distance;
            };
            this._labelsBuilder.updateLabels();
        }

        this._api = api;
    },

    _updateHandler: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        var pointsMesh = this._mesh;

        var lastDataIndex = -1;
        var isCartesian3D = seriesModel.coordinateSystem
            && seriesModel.coordinateSystem.type === 'cartesian3D';

        var grid3DModel;
        if (isCartesian3D) {
            grid3DModel = seriesModel.coordinateSystem.model;
        }

        pointsMesh.off('mousemove');
        pointsMesh.off('mouseout');
        pointsMesh.on('mousemove', function (e) {
            var dataIndex = e.vertexIndex;
            this.highlight(data, dataIndex);
            if (dataIndex !== lastDataIndex) {
                this.downplay(data, lastDataIndex);
                this.highlight(data, dataIndex);
                this._labelsBuilder.updateLabels([dataIndex]);

                if (isCartesian3D) {
                    api.dispatchAction({
                        type: 'grid3DShowAxisPointer',
                        value: [data.get('x', dataIndex), data.get('y', dataIndex), data.get('z', dataIndex)],
                        grid3DIndex: grid3DModel.componentIndex
                    });
                }
            }

            this._tooltip.updateTooltip(seriesModel, dataIndex, e.offsetX, e.offsetY);

            lastDataIndex = dataIndex;
        }, this);
        pointsMesh.on('mouseout', function (e) {
            this.downplay(data, e.vertexIndex);
            this._labelsBuilder.updateLabels();
            lastDataIndex = -1;

            if (isCartesian3D) {
                api.dispatchAction({
                    type: 'grid3DHideAxisPointer',
                    grid3DIndex: grid3DModel.componentIndex
                });
            }
            this._tooltip.hideTooltip();
        }, this);
    },

    updateView: function (camera) {
        var worldViewProjection = new Matrix4();
        Matrix4.mul(worldViewProjection, camera.viewMatrix, this._mesh.worldTransform);
        Matrix4.mul(worldViewProjection, camera.projectionMatrix, worldViewProjection);

        this._mesh.updateNDCPosition(worldViewProjection, this.is2D, this._api);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        var positionArr = this._mesh.geometry.attributes.position.value;
        var points = data.getLayout('points');
        if (this.is2D) {
            for (var i = 0; i < points.length / 2; i++) {
                var i3 = i * 3;
                var i2 = i * 2;
                positionArr[i3] = points[i2];
                positionArr[i3 + 1] = points[i2 + 1];
            }
        }
        else {
            for (var i = 0; i < points.length; i++) {
                positionArr[i] = points[i];
            }
        }
        this._mesh.geometry.dirty();
    },

    highlight: function (data, dataIndex) {
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

        this._mesh.geometry.attributes.color.set(dataIndex, colorArr);
        this._mesh.geometry.dirtyAttribute('color');

        this._api.getZr().refresh();
    },

    downplay: function (data, dataIndex) {
        var color = data.getItemVisual(dataIndex, 'color');
        var opacity = data.getItemVisual(dataIndex, 'opacity');

        var colorArr = graphicGL.parseColor(color);
        colorArr[3] *= opacity;

        this._mesh.geometry.attributes.color.set(dataIndex, colorArr);
        this._mesh.geometry.dirtyAttribute('color');

        this._api.getZr().refresh();
    },

    setPositionTexture: function (texture) {
        this._mesh.material.set('positionTexture', texture);
        this._mesh.material.shader[
            texture ? 'enableTexture' : 'disableTexture'
        ]('positionTexture');
    },

    getPointsMesh: function () {
        return this._mesh;
    },

    _getSymbolInfo: function (data) {
        var symbolAspect;
        var differentSymbolAspect = false;
        var symbolType = data.getItemVisual(0, 'symbol') || 'circle';
        var differentSymbolType = false;
        var maxSymbolSize = 0;

        data.each(function (idx) {
            var symbolSize = data.getItemVisual(idx, 'symbolSize');
            var currentSymbolType = data.getItemVisual(idx, 'symbol');
            var currentSymbolAspect;
            if (!(symbolSize instanceof Array)) {
                // Ignore NaN value.
                if (isNaN(symbolSize)) {
                    return;
                }

                currentSymbolAspect = 1;
                maxSymbolSize = Math.max(symbolSize, maxSymbolSize);
            }
            else {
                currentSymbolAspect = symbolSize[0] / symbolSize[1];
                maxSymbolSize = Math.max(Math.max(symbolSize[0], symbolSize[1]), maxSymbolSize);
            }
            if (__DEV__) {
                if (symbolAspect != null && Math.abs(currentSymbolAspect - symbolAspect) > 0.05) {
                    differentSymbolAspect = true;
                }
                if (currentSymbolType !== symbolType) {
                    differentSymbolType = true;
                }
            }
            symbolType = currentSymbolType;
            symbolAspect = currentSymbolAspect;
        });

        if (__DEV__) {
            if (differentSymbolAspect) {
                console.warn('Different symbol width / height ratio will be ignored.');
            }
            if (differentSymbolType) {
                console.warn('Different symbol type will be ignored.');
            }
        }

        return {
            maxSize: maxSymbolSize,
            type: symbolType,
            aspect: symbolAspect
        };
    }
};

module.exports = PointsBuilder;