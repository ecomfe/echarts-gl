var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var viewGL = require('../../core/ViewGL');
var spriteUtil = require('../../util/sprite');

graphicGL.Shader.import(require('text!../../util/shader/points.glsl'));

echarts.extendChartView({

    type: 'scatterGL',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new viewGL('orthographic');

        this.viewGL.add(this.groupGL);

        var mesh = new graphicGL.Mesh({
            material: new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.points'),
                transparent: true,
                depthMask: false
            }),
            geometry: new graphicGL.Geometry({
                dynamic: true
            }),
            mode: graphicGL.Mesh.POINTS
        });
        mesh.geometry.createAttribute('color', 'float', 4, 'COLOR');
        mesh.geometry.createAttribute('size', 'float', 1);
        mesh.material.shader.enableTexture('sprite');

        this.groupGL.add(mesh);

        this._pointsMesh = mesh;

        this._symbolTexture = new graphicGL.Texture2D({
            image: document.createElement('canvas')
        });
        mesh.material.set('sprite', this._symbolTexture);
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsMesh);

        this._updateCamera(api.getWidth(), api.getHeight());

        var data = seriesModel.getData();
        var geometry = this._pointsMesh.geometry;

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
        this._pointsMesh.material.shader[vertexColor ? 'define' : 'unDefine']('both', 'VERTEX_COLOR');

        this._pointsMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;

        var symbolInfo = this._getSymbolInfo(data);
        var dpr = api.getDevicePixelRatio();
        // TODO arc is not so accurate in chrome, scale it a bit ?.
        symbolInfo.maxSize *= dpr;
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
        // TODO, shadowOffsetX, shadowOffsetY may not work well.
        var itemStyle = seriesModel.getModel('itemStyle.normal').getItemStyle();
        var margin = spriteUtil.getMarginByStyle(itemStyle);
        if (hasItemColor) {
            itemStyle.fill = '#ffffff';
            if (margin.right || margin.left || margin.bottom || margin.top) {
                if (__DEV__) {
                    console.warn('shadowColor, borderColor will be ignored if data has different colors');
                }
                ['stroke', 'shadowColor'].forEach(function (key) {
                    itemStyle[key] = '#ffffff';
                });
            }
        }
        spriteUtil.createSymbolSprite(symbolInfo.type, symbolSize, itemStyle, this._symbolTexture.image);
        document.body.appendChild(this._symbolTexture.image);

        var diffX = (margin.right - margin.left) / 2;
        var diffY = (margin.bottom - margin.top) / 2;
        var diffSize = Math.max(margin.right + margin.left, margin.top + margin.bottom);

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
        for (var i = 0; i < data.count(); i++) {
            var i4 = i * 4;
            var i3 = i * 3;
            var i2 = i * 2;
            positionArr[i3] = points[i2] + diffX;
            positionArr[i3 + 1] = points[i2 + 1] + diffY;
            positionArr[i3 + 2] = -10;

            if (vertexColor) {
                if (!hasItemColor && hasItemOpacity) {
                    colorArr[i4++] = colorArr[i4++] = colorArr[i4++] = 1;
                    colorArr[i4] = data.getItemVisual(i, 'opacity');
                }
                else {
                    var color = data.getItemVisual(i, 'color');
                    var opacity = data.getItemVisual(i, 'opacity');
                    echarts.color.parse(color, rgbaArr);
                    rgbaArr[0] /= 255; rgbaArr[1] /= 255; rgbaArr[2] /= 255;
                    rgbaArr[3] *= opacity;
                    attributes.color.set(i, rgbaArr);
                }
            }

            var symbolSize = data.getItemVisual(i, 'symbolSize');

            attributes.size.value[i] = ((symbolSize instanceof Array
                ? Math.max(symbolSize[0], symbolSize[1]) : symbolSize) + diffSize) * dpr;
        }

        geometry.dirty();
    },

    updateLayout: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        var positionArr = this._pointsMesh.geometry.attributes.position.value;
        var points = data.getLayout('points');
        for (var i = 0; i < points.length / 2; i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            positionArr[i3] = points[i2];
            positionArr[i3 + 1] = points[i2 + 1];
        }
        this._pointsMesh.geometry.dirty();
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
    },

    _updateCamera: function (width, height) {
        this.viewGL.setViewport(0, 0, width, height);
        var camera = this.viewGL.camera;
        camera.left = camera.top = 0;
        camera.bottom = height;
        camera.right = width;
        camera.near = 0;
        camera.far = 100;
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});