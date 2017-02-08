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
                shader: new graphicGL.Shader({
                    vertex: graphicGL.Shader.source('ecgl.points.vertex'),
                    fragment: graphicGL.Shader.source('ecgl.points.fragment')
                }),
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
        this._updateCamera(api.getWidth(), api.getHeight());

        var data = seriesModel.getData();
        var geometry = this._pointsMesh.geometry;

        var attributes = geometry.attributes;
        attributes.position.init(data.count());
        // attributes.color.init(data.count());
        attributes.size.init(data.count());

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

        var dpr = api.getZr().painter.dpr;
        maxSymbolSize *= dpr;
        var symbolSize = [];
        if (symbolAspect > 1) {
            symbolSize[0] = maxSymbolSize;
            symbolSize[1] = maxSymbolSize / symbolAspect;
        }
        else {
            symbolSize[1] = maxSymbolSize;
            symbolSize[0] = maxSymbolSize * symbolAspect;
        }

        // TODO, Not support different style(color, opacity) of data.
        // TODO, shadowOffsetX, shadowOffsetY may not work well.
        var itemStyle = seriesModel.getModel('itemStyle.normal').getItemStyle();
        var sprite = spriteUtil.createSymbolSprite(symbolType, symbolSize, itemStyle, this._symbolTexture.image);
        var margin = sprite.margin;
        var diffX = (margin.right - margin.left) / 2;
        var diffY = (margin.bottom - margin.top) / 2;
        var diffSize = Math.max(margin.right + margin.left, margin.top + margin.bottom);

        var points = data.getLayout('points');
        for (var i = 0; i < points.length / 2; i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            attributes.position.value[i3] = points[i2] + diffX;
            attributes.position.value[i3 + 1] = points[i2 + 1] + diffY;
            attributes.position.value[i3 + 2] = -10;

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