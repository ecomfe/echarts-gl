// NormalPass will generate normal and depth data.

// TODO Animation
import Texture2D from 'qtek/src/Texture2D';
import Texture from 'qtek/src/Texture';
import Shader from 'qtek/src/Shader';
import FrameBuffer from 'qtek/src/FrameBuffer';
import Material from 'qtek/src/Material';
import Shader from 'qtek/src/Shader';
import Pass from 'qtek/src/compositor/Pass';
import textureUtil from 'qtek/src/util/texture';

import normalGLSL from '../util/shader/normal.glsl.js';
Shader.import(normalGLSL);

function attachTextureToSlot(gl, shader, symbol, texture, slot) {
    shader.setUniform(gl, '1i', symbol, slot);

    gl.activeTexture(gl.TEXTURE0 + slot);
    // Maybe texture is not loaded yet;
    if (texture.isRenderable()) {
        texture.bind(gl);
    }
    else {
        // Bind texture to null
        texture.unbind(gl);
    }
}

// TODO Use globalShader insteadof globalMaterial?
function getBeforeRenderHook (gl, defaultNormalMap, defaultBumpMap, defaultRoughnessMap, normalMaterial) {

    var previousNormalMap;
    var previousBumpMap;
    var previousRoughnessMap;
    var previousRenderable;

    return function (renderable, prevMaterial, prevShader) {
        // Material not change
        if (previousRenderable && previousRenderable.material === renderable.material) {
            return;
        }

        var material = renderable.material;

        var roughness = material.get('roughness');
        if (roughness == null) {
            roughness = 1;
        }

        var normalMap = material.get('normalMap') || defaultNormalMap;
        var roughnessMap = material.get('roughnessMap');
        var bumpMap = material.get('bumpMap');
        var uvRepeat = material.get('uvRepeat');
        var uvOffset = material.get('uvOffset');
        var detailUvRepeat = material.get('detailUvRepeat');
        var detailUvOffset = material.get('detailUvOffset');

        var useBumpMap = !!bumpMap && material.shader.isTextureEnabled('bumpMap');
        var useRoughnessMap = !!roughnessMap && material.shader.isTextureEnabled('roughnessMap');
        var doubleSide = material.shader.isDefined('fragment', 'DOUBLE_SIDED');

        bumpMap = bumpMap || defaultBumpMap;
        roughnessMap = roughnessMap || defaultRoughnessMap;

        if (prevMaterial !== normalMaterial) {
            normalMaterial.set('normalMap', normalMap);
            normalMaterial.set('bumpMap', bumpMap);
            normalMaterial.set('roughnessMap', roughnessMap);
            normalMaterial.set('useBumpMap', useBumpMap);
            normalMaterial.set('useRoughnessMap', useRoughnessMap);
            normalMaterial.set('doubleSide', doubleSide);
            uvRepeat != null && normalMaterial.set('uvRepeat', uvRepeat);
            uvOffset != null && normalMaterial.set('uvOffset', uvOffset);
            detailUvRepeat != null && normalMaterial.set('detailUvRepeat', detailUvRepeat);
            detailUvOffset != null && normalMaterial.set('detailUvOffset', detailUvOffset);

            normalMaterial.set('roughness', roughness);
        }
        else {
            normalMaterial.shader.setUniform(gl, '1f', 'roughness', roughness);

            if (previousNormalMap !== normalMap) {
                attachTextureToSlot(gl, normalMaterial.shader, 'normalMap', normalMap, 0);
            }
            if (previousBumpMap !== bumpMap && bumpMap) {
                attachTextureToSlot(gl, normalMaterial.shader, 'bumpMap', bumpMap, 1);
            }
            if (previousRoughnessMap !== roughnessMap && roughnessMap) {
                attachTextureToSlot(gl, normalMaterial.shader, 'roughnessMap', roughnessMap, 2);
            }
            if (uvRepeat != null) {
                normalMaterial.shader.setUniform(gl, '2f', 'uvRepeat', uvRepeat);
            }
            if (uvOffset != null) {
                normalMaterial.shader.setUniform(gl, '2f', 'uvOffset', uvOffset);
            }
            if (detailUvRepeat != null) {
                normalMaterial.shader.setUniform(gl, '2f', 'detailUvRepeat', detailUvRepeat);
            }
            if (detailUvOffset != null) {
                normalMaterial.shader.setUniform(gl, '2f', 'detailUvOffset', detailUvOffset);
            }
            normalMaterial.shader.setUniform(gl, '1i', 'useBumpMap', +useBumpMap);
            normalMaterial.shader.setUniform(gl, '1i', 'useRoughnessMap', +useRoughnessMap);
            normalMaterial.shader.setUniform(gl, '1i', 'doubleSide', +doubleSide);
        }

        previousNormalMap = normalMap;
        previousBumpMap = bumpMap;
        previousRoughnessMap = roughnessMap;

        previousRenderable = renderable;
    };
}

function NormalPass(opt) {
    opt = opt || {};

    this._depthTex = new Texture2D({
        format: Texture.DEPTH_COMPONENT,
        type: Texture.UNSIGNED_INT
    });
    this._normalTex = new Texture2D({
        type: Texture.HALF_FLOAT
    });

    this._framebuffer = new FrameBuffer();
    this._framebuffer.attach(this._normalTex);
    this._framebuffer.attach(this._depthTex, FrameBuffer.DEPTH_ATTACHMENT);

    this._normalMaterial = new Material({
        shader: new Shader({
            vertex: Shader.source('ecgl.normal.vertex'),
            fragment: Shader.source('ecgl.normal.fragment')
        })
    });
    this._normalMaterial.shader.enableTexture(['normalMap', 'bumpMap', 'roughnessMap']);

    this._defaultNormalMap = textureUtil.createBlank('#000');
    this._defaultBumpMap = textureUtil.createBlank('#000');
    this._defaultRoughessMap = textureUtil.createBlank('#000');


    this._debugPass = new Pass({
        fragment: Shader.source('qtek.compositor.output')
    });
    this._debugPass.setUniform('texture', this._normalTex);
    this._debugPass.material.shader.undefine('fragment', 'OUTPUT_ALPHA');
}

NormalPass.prototype.getDepthTexture = function () {
    return this._depthTex;
};

NormalPass.prototype.getNormalTexture = function () {
    return this._normalTex;
};

NormalPass.prototype.update = function (renderer, scene, camera) {

    var width = renderer.getWidth();
    var height = renderer.getHeight();

    var depthTexture = this._depthTex;
    var normalTexture = this._normalTex;

    depthTexture.width = width;
    depthTexture.height = height;
    normalTexture.width = width;
    normalTexture.height = height;

    var opaqueQueue = scene.opaqueQueue;

    var oldIfRenderObject = renderer.ifRenderObject;
    var oldBeforeRenderObject = renderer.beforeRenderObject;
    renderer.ifRenderObject = function (object) {
        return object.renderNormal;
    };

    renderer.beforeRenderObject = getBeforeRenderHook(
        renderer.gl, this._defaultNormalMap, this._defaultBumpMap, this._defaultRoughessMap, this._normalMaterial
    );
    this._framebuffer.bind(renderer);
    renderer.gl.clearColor(0, 0, 0, 0);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT | renderer.gl.DEPTH_BUFFER_BIT);
    renderer.gl.disable(renderer.gl.BLEND);
    renderer.renderQueue(opaqueQueue, camera, this._normalMaterial);
    this._framebuffer.unbind(renderer);

    renderer.ifRenderObject = oldIfRenderObject;
    renderer.beforeRenderObject = oldBeforeRenderObject;
};

NormalPass.prototype.renderDebug = function (renderer) {
    this._debugPass.render(renderer);
};

NormalPass.prototype.dispose = function (renderer) {
    this._depthTex.dispose(renderer);
    this._normalTex.dispose(renderer);
}

export default NormalPass;