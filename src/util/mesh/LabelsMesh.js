var graphicGL = require('../graphicGL');
var SpritesGeometry = require('../geometry/Sprites');

graphicGL.Shader.import(require('text!../shader/labels3D.glsl'));

module.exports = graphicGL.Mesh.extend(function () {
    var geometry = new SpritesGeometry();
    var material = new graphicGL.Material({
        shader: graphicGL.createShader('ecgl.labels3D'),
        transparent: true,
        depthMask: false
    });

    return {
        geometry: geometry,
        material: material,
        culling: false
    };
});