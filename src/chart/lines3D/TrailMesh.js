import * as echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';

import TrailGeometry from './TrailGeometry';
import { getItemVisualColor, getItemVisualOpacity } from '../../util/visual';

import trailGLSL from './shader/trail.glsl.js';

graphicGL.Shader.import(trailGLSL);

export default graphicGL.Mesh.extend(function () {

    var material = new graphicGL.Material({
        shader: new graphicGL.Shader({
            vertex: graphicGL.Shader.source('ecgl.trail.vertex'),
            fragment: graphicGL.Shader.source('ecgl.trail.fragment')
        }),
        transparent: true,
        depthMask: false
    });

    // texture saving the keypoints.
    var pointsTexture = new graphicGL.Texture2D({
        type: graphicGL.Texture.FLOAT,
        minFilter: graphicGL.Texture.NEAREST,
        magFilter: graphicGL.Texture.NEAREST,
        width: 1024
    });

    return {
        geometry: new TrailGeometry({
            dynamic: true
        }),
        material: material,
        culling: false,
        $ignorePicking: true,

        _pointsTexture: pointsTexture
    };
}, {

    setData: function (data, api) {
        var seriesModel = data.hostModel;
        var geometry = this.geometry;

        var effectModel = seriesModel.getModel('effect');
        var size = effectModel.get('trailWidth') * api.getDevicePixelRatio();
        var trailLength = effectModel.get('trailLength');

        geometry.trailLength = trailLength;
        this.material.set('trailLength', trailLength);

        geometry.reset();

        var vertexCount = 0;
        var triangleCount = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            vertexCount += geometry.getCurveVertexCount(pts[0], pts[1], pts[2], pts[3]);
            triangleCount += geometry.getCurveTriangleCount(pts[0], pts[1], pts[2], pts[3]);
        });
        geometry.setVertexCount(vertexCount);
        geometry.setTriangleCount(triangleCount);

        var colorArr = [];
        var textureWidth = this._pointsTexture.width;
        var textureHeight = Math.ceil(data.count() / (textureWidth / 4));
        var pointsTexture = this._pointsTexture;
        pointsTexture.height = textureHeight;

        if (!(pointsTexture.pixels && pointsTexture.pixels.length === textureWidth * textureHeight * 4)) {
            pointsTexture.pixels = new Float32Array(textureWidth * textureHeight * 4);
        }
        var pixels = pointsTexture.pixels;

        var effectColor = effectModel.get('trailColor');
        var effectOpacity = effectModel.get('trailOpacity');
        var hasEffectColor = effectColor != null;
        var hasEffectOpacity = effectOpacity != null;

        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            var opacity = hasEffectOpacity ? effectOpacity : getItemVisualOpacity(data, idx);
            var color = getItemVisualColor(data, idx);

            if (opacity == null) {
                opacity = 1;
            }
            colorArr = graphicGL.parseColor(hasEffectColor ? effectColor : color, colorArr);
            colorArr[3] *= opacity;

            var u = idx * 4 % textureWidth / (textureWidth - 1);
            var v = Math.floor(idx * 4 / textureWidth) / (textureHeight - 1) || 0;

            for (var k = 0; k < 4; k++) {
                pixels[(idx * 4 + k) * 4] = pts[k][0];
                pixels[(idx * 4 + k) * 4 + 1] = pts[k][1];
                pixels[(idx * 4 + k) * 4 + 2] = pts[k][2];
            }

            geometry.addCurveTrail(
                pts[0], pts[1], pts[2], pts[3], [u, v], size, colorArr
            );
        });

        this.material.set('pointsTexture', pointsTexture);

        pointsTexture.dirty();

        geometry.dirty();
    },

    setScale: function (scale) {
        this.geometry.scale = scale;
    },

    setAnimationPercent: function (percent) {
        this.material.set('percent', percent);
    }
});