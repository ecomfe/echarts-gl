var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var spriteUtil = require('../../util/sprite');

var CurveAnimatingPointsGeometry = require('./CurveAnimatingPointsGeometry');

graphicGL.Shader.import(require('text!./shader/curveAnimatingPoints.glsl'));

module.exports = graphicGL.Mesh.extend(function () {

    var material = new graphicGL.Material({
        shader: new graphicGL.Shader({
            vertex: graphicGL.Shader.source('ecgl.curveAnimatingPoints.vertex'),
            fragment: graphicGL.Shader.source('ecgl.curveAnimatingPoints.fragment')
        }),
        transparent: true,
        depthMask: false
    });
    material.shader.enableTexture('sprite');
    var texture = new graphicGL.Texture2D({
        image: document.createElement('canvas')
    });
    material.set('sprite', texture);

    return {
        geometry: new CurveAnimatingPointsGeometry({
            dynamic: true
        }),
        material: material,

        mode: graphicGL.Mesh.POINTS,

        _spriteTexture: texture
    };
}, {

    setData: function (data, api) {
        var seriesModel = data.hostModel;
        var geometry = this.geometry;

        var effectModel = seriesModel.getModel('effect');
        var symbolType = effectModel.get('symbol');
        var size = effectModel.get('symbolSize') * api.getDevicePixelRatio();

        spriteUtil.createSymbolSprite(symbolType, size, {
            fill: '#fff'
        }, this._spriteTexture.image);
        this._spriteTexture.dirty();

        geometry.reset();

        var vertexCount = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            vertexCount += geometry.getPointVertexCount(pts[0], pts[1], pts[2], pts[3]);
        });
        geometry.setVertexCount(vertexCount);

        var colorArr = [];
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            var opacity = data.getItemVisual(idx, 'opacity');
            var color = data.getItemVisual(idx, 'color');

            if (opacity == null) {
                opacity = 1;
            }
            colorArr = echarts.color.parse(color, colorArr);
            colorArr[0] /= 255; colorArr[1] /= 255; colorArr[2] /= 255;
            colorArr[3] *= opacity;

            geometry.addPoint(pts[0], pts[1], pts[2], pts[3], size, colorArr);
        });

        geometry.dirty();
    },

    setScale: function (scale) {
        this.geometry.scale = scale;
    },

    setAnimationPercent: function (percent) {
        this.material.set('percent', percent);
    }
});