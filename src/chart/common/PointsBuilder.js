var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var spriteUtil = require('../../util/sprite');
var verticesSortMixin = require('../../util/geometry/verticesSortMixin');

// TODO gl_PointSize has max value.

graphicGL.Shader.import(require('text!./sdfSprite.glsl'));


function PointsBuilder(is2D) {
    // For fill parts.
    var geometry = new graphicGL.Geometry({
        dynamic: true,
        sortVertices: !is2D
    });
    echarts.util.extend(geometry, verticesSortMixin);
    geometry.createAttribute('color', 'float', 4, 'COLOR');
    geometry.createAttribute('strokeColor', 'float', 4);
    geometry.createAttribute('size', 'float', 1);

    var material = new graphicGL.Material({
        shader: graphicGL.createShader('ecgl.sdfSprite'),
        transparent: true,
        depthMask: false
    });
    material.shader.enableTexture('sprite');
    this._sdfTexture = new graphicGL.Texture2D({
        image: document.createElement('canvas'),
        flipY: false
    });

    material.set('sprite', this._sdfTexture);

    this._mesh = new graphicGL.Mesh({
        geometry: geometry,
        material: material,
        mode: graphicGL.Mesh.POINTS,
        // Render after axes
        renderOrder: 10
    });

    this.rootNode = new graphicGL.Node();
    this.rootNode.add(this._mesh);

    /**
     * @type {boolean}
     */
    this.is2D = is2D;
}

PointsBuilder.prototype = {

    constructor: PointsBuilder,

    update: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();

        var hasItemColor = false;
        var hasItemOpacity = false;
        for (var i = 0; i < data.count(); i++) {
            if (!hasItemColor && data.getItemVisual(i, 'color', true) != null) {
                hasItemColor = true;
            }
            if (!hasItemColor && data.getItemVisual(i, 'opacity', true) != null) {
                hasItemOpacity = true;
            }
        }
        var vertexColor = hasItemColor || hasItemOpacity;
        this._mesh.material.shader[vertexColor ? 'define' : 'unDefine']('both', 'VERTEX_COLOR');

        var symbolInfo = this._getSymbolInfo(data);
        var dpr = api.getDevicePixelRatio();

        // 50px is enough for sined distance function.
        // symbolInfo.maxSize;

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
        var itemStyle = seriesModel.getModel('itemStyle.normal').getItemStyle();
        itemStyle.fill = data.getVisual('color');

        var canvas = spriteUtil.createSymbolSDF(symbolInfo.type, symbolSize, 20, itemStyle, this._sdfTexture.image);

        var geometry = this._mesh.geometry;
        var points = data.getLayout('points');
        var attributes = geometry.attributes;
        attributes.position.init(data.count());
        attributes.size.init(data.count());
        if (vertexColor) {
            attributes.color.init(data.count());
        }
        var positionArr = attributes.position.value;
        var colorArr = attributes.color.value;

        var rgbaArr = [];
        var is2D = this.is2D;

        var pointSizeScale = canvas.width / symbolInfo.maxSize;

        var hasTransparentPoint = false;
        for (var i = 0; i < data.count(); i++) {
            var i4 = i * 4;
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

            if (vertexColor) {
                if (!hasItemColor && hasItemOpacity) {
                    colorArr[i4++] = colorArr[i4++] = colorArr[i4++] = 1;
                    colorArr[i4] = data.getItemVisual(i, 'opacity');
                    if (colorArr[i4] < 0.99) {
                        hasTransparentPoint = true;
                    }
                }
                else {
                    var color = data.getItemVisual(i, 'color');
                    var opacity = data.getItemVisual(i, 'opacity');
                    graphicGL.parseColor(color, rgbaArr);
                    rgbaArr[3] *= opacity;
                    attributes.color.set(i, rgbaArr);
                    if (rgbaArr[3] < 0.99) {
                        hasTransparentPoint = true;
                    }
                }
            }

            var symbolSize = data.getItemVisual(i, 'symbolSize');
            symbolSize = (symbolSize instanceof Array
                ? Math.max(symbolSize[0], symbolSize[1]) : symbolSize);

            // Scale point size because canvas has margin.
            attributes.size.value[i] = symbolSize * dpr * pointSizeScale;
        }

        geometry.dirty();

        // Update material.
        var blendFunc = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
        var material = this._mesh.material;
        material.blend = blendFunc;

        material.set('lineWidth', itemStyle.lineWidth / canvas.width * canvas.width * dpr);

        var fillColor = vertexColor ? [1, 1, 1, 1] : graphicGL.parseColor(itemStyle.fill);
        var strokeColor = graphicGL.parseColor(itemStyle.stroke);
        material.set('color', fillColor);
        material.set('strokeColor', strokeColor);

        if (hasTransparentPoint
            // Stroke is transparent
            || (itemStyle.lineWidth && strokeColor[3] < 0.99)
            // Fill is transparent
            || fillColor[3] < 0.99
        ) {
            material.transparent = true;
            material.depthMask = false;
            geometry.sortVertices = !is2D;
        }
        else {
            material.transparent = false;
            material.depthMask = true;
            geometry.sortVertices = false;
        }
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

    _getSymbolInfo: function (data) {
        var symbolAspect = 1;
        var differentSymbolAspect = false;
        var symbolType = data.getItemVisual(0, 'symbol') || 'circle';
        var differentSymbolType = false;
        var maxSymbolSize = 0;

        data.each(function (idx) {
            var symbolSize = data.getItemVisual(idx, 'symbolSize');
            var currentSymbolType = data.getItemVisual(idx, 'symbol');
            var currentSymbolAspect;
            if (!(symbolSize instanceof Array)) {
                currentSymbolAspect = 1;
                maxSymbolSize = Math.max(symbolSize, maxSymbolSize);
            }
            else {
                currentSymbolAspect = symbolSize[0] / symbolSize[1];
                maxSymbolSize = Math.max(Math.max(symbolSize[0], symbolSize[1]), maxSymbolSize);
            }
            if (__DEV__) {
                if (Math.abs(currentSymbolAspect - symbolAspect) > 0.05) {
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