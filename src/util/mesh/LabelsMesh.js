import graphicGL from '../graphicGL';
import SpritesGeometry from '../geometry/Sprites';

import labelsGLSL from '../shader/labels.glsl.js';
graphicGL.Shader.import(labelsGLSL);

export default graphicGL.Mesh.extend(function () {
    var geometry = new SpritesGeometry({
        dynamic: true
    });
    var material = new graphicGL.Material({
        shader: graphicGL.createShader('ecgl.labels'),
        transparent: true,
        depthMask: false
    });

    return {
        geometry: geometry,
        material: material,
        culling: false,
        castShadow: false,
        ignorePicking: true
    };
});