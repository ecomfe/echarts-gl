// NormalPass will generate normal and depth data.

// TODO Animation
import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import Shader from 'claygl/src/Shader';
import FrameBuffer from 'claygl/src/FrameBuffer';
import Material from 'claygl/src/Material';
import Pass from 'claygl/src/compositor/Pass';
import textureUtil from 'claygl/src/util/texture';

import normalGLSL from '../util/shader/normal.glsl.js';
Shader.import(normalGLSL);

function attachTextureToSlot(renderer, program, symbol, texture, slot) {
    var gl = renderer.gl;
    program.setUniform(gl, '1i', symbol, slot);

    gl.activeTexture(gl.TEXTURE0 + slot);
    // Maybe texture is not loaded yet;
    if (texture.isRenderable()) {
        texture.bind(renderer);
    }
    else {
        // Bind texture to null
        texture.unbind(renderer);
    }
}

// TODO Use globalShader insteadof globalMaterial?
function getBeforeRenderHook (renderer, defaultNormalMap, defaultBumpMap, defaultRoughnessMap, normalMaterial) {

    var previousNormalMap;
    var previousBumpMap;
    var previousRoughnessMap;
    var previousRenderable;
    var gl = renderer.gl;

    return function (renderable, normalMaterial, prevNormalMaterial) {
        // Material not change
        if (previousRenderable && previousRenderable.material === renderable.material) {
            return;
        }

        var material = renderable.material;
        var program = renderable.__program;

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

        var useBumpMap = !!bumpMap && material.isTextureEnabled('bumpMap');
        var useRoughnessMap = !!roughnessMap && material.isTextureEnabled('roughnessMap');
        var doubleSide = material.isDefined('fragment', 'DOUBLE_SIDED');

        bumpMap = bumpMap || defaultBumpMap;
        roughnessMap = roughnessMap || defaultRoughnessMap;

        if (prevNormalMaterial !== normalMaterial) {
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
            program.setUniform(gl, '1f', 'roughness', roughness);

            if (previousNormalMap !== normalMap) {
                attachTextureToSlot(renderer, program, 'normalMap', normalMap, 0);
            }
            if (previousBumpMap !== bumpMap && bumpMap) {
                attachTextureToSlot(renderer, program, 'bumpMap', bumpMap, 1);
            }
            if (previousRoughnessMap !== roughnessMap && roughnessMap) {
                attachTextureToSlot(renderer, program, 'roughnessMap', roughnessMap, 2);
            }
            if (uvRepeat != null) {
                program.setUniform(gl, '2f', 'uvRepeat', uvRepeat);
            }
            if (uvOffset != null) {
                program.setUniform(gl, '2f', 'uvOffset', uvOffset);
            }
            if (detailUvRepeat != null) {
                program.setUniform(gl, '2f', 'detailUvRepeat', detailUvRepeat);
            }
            if (detailUvOffset != null) {
                program.setUniform(gl, '2f', 'detailUvOffset', detailUvOffset);
            }
            program.setUniform(gl, '1i', 'useBumpMap', +useBumpMap);
            program.setUniform(gl, '1i', 'useRoughnessMap', +useRoughnessMap);
            program.setUniform(gl, '1i', 'doubleSide', +doubleSide);
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
        shader: new Shader(
            Shader.source('ecgl.normal.vertex'),
            Shader.source('ecgl.normal.fragment')
        )
    });
    this._normalMaterial.enableTexture(['normalMap', 'bumpMap', 'roughnessMap']);

    this._defaultNormalMap = textureUtil.createBlank('#000');
    this._defaultBumpMap = textureUtil.createBlank('#000');
    this._defaultRoughessMap = textureUtil.createBlank('#000');


    this._debugPass = new Pass({
        fragment: Shader.source('clay.compositor.output')
    });
    this._debugPass.setUniform('texture', this._normalTex);
    this._debugPass.material.undefine('fragment', 'OUTPUT_ALPHA');
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
    var normalMaterial = this._normalMaterial;

    depthTexture.width = width;
    depthTexture.height = height;
    normalTexture.width = width;
    normalTexture.height = height;

    var opaqueList = scene.getRenderList(camera).opaque;

    this._framebuffer.bind(renderer);
    renderer.gl.clearColor(0, 0, 0, 0);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT | renderer.gl.DEPTH_BUFFER_BIT);
    renderer.gl.disable(renderer.gl.BLEND);

    renderer.renderPass(opaqueList, camera, {
        getMaterial: function () {
            return normalMaterial;
        },
        ifRender: function (object) {
            return object.renderNormal;
        },
        beforeRender: getBeforeRenderHook(
            renderer, this._defaultNormalMap, this._defaultBumpMap, this._defaultRoughessMap, this._normalMaterial
        ),
        sort: renderer.opaqueSortCompare
    });
    this._framebuffer.unbind(renderer);
};

NormalPass.prototype.renderDebug = function (renderer) {
    this._debugPass.render(renderer);
};

NormalPass.prototype.dispose = function (renderer) {
    this._depthTex.dispose(renderer);
    this._normalTex.dispose(renderer);
}

export default NormalPass;