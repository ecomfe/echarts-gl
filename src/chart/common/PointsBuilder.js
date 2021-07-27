import * as echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import spriteUtil from '../../util/sprite';
import PointsMesh from './PointsMesh';
import LabelsBuilder from '../../component/common/LabelsBuilder';
import Matrix4 from 'claygl/src/math/Matrix4';
import retrieve from '../../util/retrieve';
import { getItemVisualColor, getItemVisualOpacity } from '../../util/visual';
import { getVisualColor, getVisualOpacity } from '../../util/visual';

var SDF_RANGE = 20;

var Z_2D = -10;

function isSymbolSizeSame(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}
// TODO gl_PointSize has max value.
function PointsBuilder(is2D, api) {
    this.rootNode = new graphicGL.Node();

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

    this._startDataIndex = 0;
    this._endDataIndex = 0;

    this._sizeScale = 1;
}

PointsBuilder.prototype = {

    constructor: PointsBuilder,

    /**
     * If highlight on over
     */
    highlightOnMouseover: true,

    update: function (seriesModel, ecModel, api, start, end) {
        // Swap barMesh
        var tmp = this._prevMesh;
        this._prevMesh = this._mesh;
        this._mesh = tmp;

        var data = seriesModel.getData();

        if (start == null) {
            start = 0;
        }
        if (end == null) {
            end = data.count();
        }
        this._startDataIndex = start;
        this._endDataIndex = end - 1;

        if (!this._mesh) {
            var material = this._prevMesh && this._prevMesh.material;
            this._mesh = new PointsMesh({
                // Render after axes
                renderOrder: 10,
                // FIXME
                frustumCulling: false
            });
            if (material) {
                this._mesh.material = material;
            }
        }
        var material = this._mesh.material;
        var geometry = this._mesh.geometry;
        var attributes = geometry.attributes;

        this.rootNode.remove(this._prevMesh);
        this.rootNode.add(this._mesh);

        this._setPositionTextureToMesh(this._mesh, this._positionTexture);

        var symbolInfo = this._getSymbolInfo(seriesModel, start, end);
        var dpr = api.getDevicePixelRatio();

        // TODO image symbol
        var itemStyle = seriesModel.getModel('itemStyle').getItemStyle();
        var largeMode = seriesModel.get('large');

        var pointSizeScale = 1;
        if (symbolInfo.maxSize > 2) {
            pointSizeScale = this._updateSymbolSprite(seriesModel, itemStyle, symbolInfo, dpr);
            material.enableTexture('sprite');
        }
        else {
            material.disableTexture('sprite');
        }

        attributes.position.init(end - start);
        var rgbaArr = [];
        if (largeMode) {
            material.undefine('VERTEX_SIZE');
            material.undefine('VERTEX_COLOR');

            var color = getVisualColor(data);
            var opacity = getVisualOpacity(data);
            graphicGL.parseColor(color, rgbaArr);
            rgbaArr[3] *= opacity;

            material.set({
                color: rgbaArr,
                'u_Size': symbolInfo.maxSize * this._sizeScale
            });
        }
        else {
            material.set({
                color: [1, 1, 1, 1]
            });
            material.define('VERTEX_SIZE');
            material.define('VERTEX_COLOR');
            attributes.size.init(end - start);
            attributes.color.init(end - start);
            this._originalOpacity = new Float32Array(end - start);
        }

        var points = data.getLayout('points');

        var positionArr = attributes.position.value;

        var hasTransparentPoint = false;

        for (var i = 0; i < end - start; i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            if (this.is2D) {
                positionArr[i3] = points[i2];
                positionArr[i3 + 1] = points[i2 + 1];
                positionArr[i3 + 2] = Z_2D;
            }
            else {
                positionArr[i3] = points[i3];
                positionArr[i3 + 1] = points[i3 + 1];
                positionArr[i3 + 2] = points[i3 + 2];
            }

            if (!largeMode) {
                var color = getItemVisualColor(data, i);
                var opacity = getItemVisualOpacity(data, i);
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
                attributes.size.value[i] = symbolSize * pointSizeScale * this._sizeScale;

                // Save the original opacity for recover from fadeIn.
                this._originalOpacity[i] = rgbaArr[3];
            }

        }

        this._mesh.sizeScale = pointSizeScale;

        geometry.updateBoundingBox();
        geometry.dirty();

        // Update material.
        this._updateMaterial(seriesModel, itemStyle);

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            material[methodName]('fragment', 'SRGB_DECODE');
        }

        if (!largeMode) {
            this._updateLabelBuilder(seriesModel, start, end);
        }

        this._updateHandler(seriesModel, ecModel, api);

        this._updateAnimation(seriesModel);

        this._api = api;
    },

    getPointsMesh: function () {
        return this._mesh;
    },

    updateLabels: function (highlightDataIndices) {
        this._labelsBuilder.updateLabels(highlightDataIndices);
    },

    hideLabels: function () {
        this.rootNode.remove(this._labelsBuilder.getMesh());
    },

    showLabels: function () {
        this.rootNode.add(this._labelsBuilder.getMesh());
    },

    dispose: function () {
        this._labelsBuilder.dispose();
    },

    _updateSymbolSprite: function (seriesModel, itemStyle, symbolInfo, dpr) {
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

        // In case invalid data.
        symbolSize[0] = symbolSize[0] || 1;
        symbolSize[1] = symbolSize[1] || 1;

        if (this._symbolType !== symbolInfo.type
            || !isSymbolSizeSame(this._symbolSize, symbolSize)
            || this._lineWidth !== itemStyle.lineWidth
        ) {
            spriteUtil.createSymbolSprite(symbolInfo.type, symbolSize, {
                fill: '#fff',
                lineWidth: itemStyle.lineWidth,
                stroke: 'transparent',
                shadowColor: 'transparent',
                minMargin: Math.min(symbolSize[0] / 2, 10)
            }, this._spriteImageCanvas);

            spriteUtil.createSDFFromCanvas(
                this._spriteImageCanvas, Math.min(this._spriteImageCanvas.width, 32), SDF_RANGE,
                this._mesh.material.get('sprite').image
            );

            this._symbolType = symbolInfo.type;
            this._symbolSize = symbolSize;
            this._lineWidth = itemStyle.lineWidth;
        }
        return this._spriteImageCanvas.width / symbolInfo.maxSize * dpr;

    },

    _updateMaterial: function (seriesModel, itemStyle) {
        var blendFunc = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
        var material = this._mesh.material;
        material.blend = blendFunc;

        material.set('lineWidth', itemStyle.lineWidth / SDF_RANGE);

        var strokeColor = graphicGL.parseColor(itemStyle.stroke);
        material.set('strokeColor', strokeColor);

        // Because of symbol texture, we always needs it be transparent.
        material.transparent = true;
        material.depthMask = false;
        material.depthTest = !this.is2D;
        material.sortVertices = !this.is2D;
    },

    _updateLabelBuilder: function (seriesModel, start, end) {
        var data =seriesModel.getData();
        var geometry = this._mesh.geometry;
        var positionArr = geometry.attributes.position.value;
        var start = this._startDataIndex;
        var pointSizeScale = this._mesh.sizeScale;
        this._labelsBuilder.updateData(data, start, end);

        this._labelsBuilder.getLabelPosition = function (dataIndex, positionDesc, distance) {
            var idx3 = (dataIndex - start) * 3;
            return [positionArr[idx3], positionArr[idx3 + 1], positionArr[idx3 + 2]];
        };

        this._labelsBuilder.getLabelDistance = function (dataIndex, positionDesc, distance) {
            var size = geometry.attributes.size.get(dataIndex - start) / pointSizeScale;
            return size / 2 + distance;
        };
        this._labelsBuilder.updateLabels();

    },

    _updateAnimation: function (seriesModel) {
        graphicGL.updateVertexAnimation(
            [['prevPosition', 'position'],
            ['prevSize', 'size']],
            this._prevMesh,
            this._mesh,
            seriesModel
        );
    },

    _updateHandler: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        var pointsMesh = this._mesh;
        var self = this;

        var lastDataIndex = -1;
        var isCartesian3D = seriesModel.coordinateSystem
            && seriesModel.coordinateSystem.type === 'cartesian3D';

        var grid3DModel;
        if (isCartesian3D) {
            grid3DModel = seriesModel.coordinateSystem.model;
        }

        pointsMesh.seriesIndex = seriesModel.seriesIndex;

        pointsMesh.off('mousemove');
        pointsMesh.off('mouseout');

        pointsMesh.on('mousemove', function (e) {
            var dataIndex = e.vertexIndex + self._startDataIndex;
            if (dataIndex !== lastDataIndex) {
                if (this.highlightOnMouseover) {
                    this.downplay(data, lastDataIndex);
                    this.highlight(data, dataIndex);
                    this._labelsBuilder.updateLabels([dataIndex]);
                }

                if (isCartesian3D) {
                    api.dispatchAction({
                        type: 'grid3DShowAxisPointer',
                        value: [
                            data.get(seriesModel.coordDimToDataDim('x')[0], dataIndex),
                            data.get(seriesModel.coordDimToDataDim('y')[0], dataIndex),
                            data.get(seriesModel.coordDimToDataDim('z')[0], dataIndex)
                        ],
                        grid3DIndex: grid3DModel.componentIndex
                    });
                }
            }

            pointsMesh.dataIndex = dataIndex;
            lastDataIndex = dataIndex;
        }, this);
        pointsMesh.on('mouseout', function (e) {
            var dataIndex = e.vertexIndex + self._startDataIndex;
            if (this.highlightOnMouseover) {
                this.downplay(data, dataIndex);
                this._labelsBuilder.updateLabels();
            }
            lastDataIndex = -1;
            pointsMesh.dataIndex = -1;

            if (isCartesian3D) {
                api.dispatchAction({
                    type: 'grid3DHideAxisPointer',
                    grid3DIndex: grid3DModel.componentIndex
                });
            }
        }, this);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        if (!this._mesh) {
            return;
        }

        var positionArr = this._mesh.geometry.attributes.position.value;
        var points = data.getLayout('points');
        if (this.is2D) {
            for (var i = 0; i < points.length / 2; i++) {
                var i3 = i * 3;
                var i2 = i * 2;
                positionArr[i3] = points[i2];
                positionArr[i3 + 1] = points[i2 + 1];
                positionArr[i3 + 2] = Z_2D;
            }
        }
        else {
            for (var i = 0; i < points.length; i++) {
                positionArr[i] = points[i];
            }
        }
        this._mesh.geometry.dirty();

        api.getZr().refresh();
    },

    updateView: function (camera) {
        if (!this._mesh) {
            return;
        }

        var worldViewProjection = new Matrix4();
        Matrix4.mul(worldViewProjection, camera.viewMatrix, this._mesh.worldTransform);
        Matrix4.mul(worldViewProjection, camera.projectionMatrix, worldViewProjection);

        this._mesh.updateNDCPosition(worldViewProjection, this.is2D, this._api);
    },

    highlight: function (data, dataIndex) {
        if (dataIndex > this._endDataIndex || dataIndex < this._startDataIndex) {
            return;
        }
        var itemModel = data.getItemModel(dataIndex);
        var emphasisItemStyleModel = itemModel.getModel('emphasis.itemStyle');
        var emphasisColor = emphasisItemStyleModel.get('color');
        var emphasisOpacity = emphasisItemStyleModel.get('opacity');
        if (emphasisColor == null) {
            var color = getItemVisualColor(data, dataIndex);
            emphasisColor = echarts.color.lift(color, -0.4);
        }
        if (emphasisOpacity == null) {
            emphasisOpacity = getItemVisualOpacity(data, dataIndex);
        }
        var colorArr = graphicGL.parseColor(emphasisColor);
        colorArr[3] *= emphasisOpacity;

        this._mesh.geometry.attributes.color.set(dataIndex - this._startDataIndex, colorArr);
        this._mesh.geometry.dirtyAttribute('color');

        this._api.getZr().refresh();
    },

    downplay: function (data, dataIndex) {
        if (dataIndex > this._endDataIndex || dataIndex < this._startDataIndex) {
            return;
        }
        var color = getItemVisualColor(data, dataIndex);
        var opacity = getItemVisualOpacity(data, dataIndex);

        var colorArr = graphicGL.parseColor(color);
        colorArr[3] *= opacity;

        this._mesh.geometry.attributes.color.set(dataIndex - this._startDataIndex, colorArr);
        this._mesh.geometry.dirtyAttribute('color');

        this._api.getZr().refresh();
    },

    fadeOutAll: function (fadeOutPercent) {
        if (this._originalOpacity) {
            var geo = this._mesh.geometry;
            for (var i = 0; i < geo.vertexCount; i++) {
                var fadeOutOpacity = this._originalOpacity[i] * fadeOutPercent;
                geo.attributes.color.value[i * 4 + 3] = fadeOutOpacity;
            }
            geo.dirtyAttribute('color');

            this._api.getZr().refresh();
        }
    },

    fadeInAll: function () {
        this.fadeOutAll(1);
    },

    setPositionTexture: function (texture) {
        if (this._mesh) {
            this._setPositionTextureToMesh(this._mesh, texture);
        }

        this._positionTexture = texture;
    },

    removePositionTexture: function () {
        this._positionTexture = null;
        if (this._mesh) {
            this._setPositionTextureToMesh(this._mesh, null);
        }
    },

    setSizeScale: function (sizeScale) {
        if (sizeScale !== this._sizeScale) {
            if (this._mesh) {
                var originalSize = this._mesh.material.get('u_Size');
                this._mesh.material.set('u_Size', originalSize / this._sizeScale * sizeScale);

                var attributes = this._mesh.geometry.attributes;
                if (attributes.size.value) {
                    for (var i = 0; i < attributes.size.value.length; i++) {
                        attributes.size.value[i] = attributes.size.value[i] / this._sizeScale * sizeScale;
                    }
                }
            }
            this._sizeScale = sizeScale;
        }
    },

    _setPositionTextureToMesh: function (mesh, texture) {
        if (texture) {
            mesh.material.set('positionTexture', texture);
        }
        mesh.material[
            texture ? 'enableTexture' : 'disableTexture'
        ]('positionTexture');
    },

    _getSymbolInfo: function (seriesModel, start, end) {
        if (seriesModel.get('large')) {
            var symbolSize = retrieve.firstNotNull(seriesModel.get('symbolSize'), 1);
            var maxSymbolSize;
            var symbolAspect;
            if (symbolSize instanceof Array) {
                maxSymbolSize = Math.max(symbolSize[0], symbolSize[1]);
                symbolAspect = symbolSize[0] / symbolSize[1];
            }
            else {
                maxSymbolSize = symbolSize;
                symbolAspect = 1;
            }
            return {
                maxSize: symbolSize,
                type: seriesModel.get('symbol'),
                aspect: symbolAspect
            }
        }
        var data = seriesModel.getData();
        var symbolAspect;
        var differentSymbolAspect = false;
        var symbolType = data.getItemVisual(0, 'symbol') || 'circle';
        var differentSymbolType = false;
        var maxSymbolSize = 0;

        for (var idx = start; idx < end; idx++) {
            var symbolSize = data.getItemVisual(idx, 'symbolSize');
            var currentSymbolType = data.getItemVisual(idx, 'symbol');
            var currentSymbolAspect;
            if (!(symbolSize instanceof Array)) {
                // Ignore NaN value.
                if (isNaN(symbolSize)) {
                    continue;
                }

                currentSymbolAspect = 1;
                maxSymbolSize = Math.max(symbolSize, maxSymbolSize);
            }
            else {
                currentSymbolAspect = symbolSize[0] / symbolSize[1];
                maxSymbolSize = Math.max(Math.max(symbolSize[0], symbolSize[1]), maxSymbolSize);
            }
            if (process.env.NODE_ENV !== 'production') {
                if (symbolAspect != null && Math.abs(currentSymbolAspect - symbolAspect) > 0.05) {
                    differentSymbolAspect = true;
                }
                if (currentSymbolType !== symbolType) {
                    differentSymbolType = true;
                }
            }
            symbolType = currentSymbolType;
            symbolAspect = currentSymbolAspect;
        }

        if (process.env.NODE_ENV !== 'production') {
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

export default PointsBuilder;
