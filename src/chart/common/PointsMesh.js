var graphicGL = require('../../util/graphicGL');
var verticesSortMixin = require('../../util/geometry/verticesSortMixin');
var echarts = require('echarts/lib/echarts');

graphicGL.Shader.import(require('text!./sdfSprite.glsl'));

var PointsMesh = graphicGL.Mesh.extend(function () {
    var geometry = new graphicGL.Geometry({
        dynamic: true
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

    var sdfTexture = new graphicGL.Texture2D({
        image: document.createElement('canvas'),
        flipY: false
    });
    material.set('sprite', sdfTexture);

    return {
        geometry: geometry,
        material: material,
        mode: graphicGL.Mesh.POINTS
    };
})

module.exports = PointsMesh;