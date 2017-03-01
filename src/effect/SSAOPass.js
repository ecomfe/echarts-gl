var Matrix4 = require('qtek/lib/math/Matrix4');
var Vector3 = require('qtek/lib/math/Vector3');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var Pass = require('qtek/lib/compositor/Pass');
var Shader = require('qtek/lib/Shader');
var FrameBuffer = require('qtek/lib/FrameBuffer');

Shader.import(require('text!./SSAO.glsl'));

function generateNoiseData(size) {
    var data = new Uint8Array(size * size * 4);
    var n = 0;
    var v3 = new Vector3();
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            v3.set(Math.random() * 2 - 1, Math.random() * 2 - 1, 0).normalize();
            data[n++] = (v3.x * 0.5 + 0.5) * 255;
            data[n++] = (v3.y * 0.5 + 0.5) * 255;
            data[n++] = 0;
            data[n++] = 255;
        }
    }
    return data;
}

function generateNoiseTexture(size) {
    return new Texture2D({
        pixels: generateNoiseData(size),
        wrapS: Texture.REPEAT,
        wrapT: Texture.REPEAT,
        width: size,
        height: size
    });
}

function generateKernel(size) {
    var kernel = new Float32Array(size * 3);
    var v3 = new Vector3();
    for (var i = 0; i < size; i++) {
        v3.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
            .normalize().scale(Math.random());
        kernel[i * 3] = v3.x;
        kernel[i * 3 + 1] = v3.y;
        kernel[i * 3 + 2] = v3.z;
    }
    return kernel;
}

function SSAOPass(opt) {
    opt = opt || {};

    this._ssaoPass = new Pass({
        fragment: Shader.source('ecgl.ssao.estimate')
    });
    this._blendPass = new Pass({
        fragment: Shader.source('ecgl.ssao.blur')
    });
    this._framebuffer = new FrameBuffer();
    this._ssaoTexture = new Texture2D();

    this._targetTexture = new Texture2D({
        type: Texture.HALF_FLOAT
    });

    this._depthTexture = opt.depthTexture;

    this.setNoiseSize(4);
    this.setKernelSize(opt.kernelSize || 16);
    this.setParameter('blurSize', Math.round(opt.blurSize || 4));
    if (opt.radius != null) {
        this.setParameter('radius', opt.radius);
    }
    if (opt.power != null) {
        this.setParameter('power', opt.power);
    }
}

SSAOPass.prototype.setDepthTexture = function (depthTex) {
    this._depthTexture = depthTex;
};

SSAOPass.prototype.update = function (renderer, camera, frame) {
    var width = renderer.getWidth();
    var height = renderer.getHeight();

    var ssaoPass = this._ssaoPass;

    ssaoPass.setUniform('kernel', this._kernels[frame % this._kernels.length]);
    ssaoPass.setUniform('depthTex', this._depthTexture);
    ssaoPass.setUniform('depthTexSize', [this._depthTexture.width, this._depthTexture.height]);

    var viewInverseTranspose = new Matrix4();
    Matrix4.transpose(viewInverseTranspose, camera.worldTransform);

    ssaoPass.setUniform('projection', camera.projectionMatrix._array);
    ssaoPass.setUniform('projectionInv', camera.invProjectionMatrix._array);
    ssaoPass.setUniform('viewInverseTranspose', viewInverseTranspose._array);

    var ssaoTexture = this._ssaoTexture;
    if (width !== ssaoTexture.width || height !== ssaoTexture.height) {
        ssaoTexture.width = width;
        ssaoTexture.height = height;
        ssaoTexture.dirty();
    }
    this._framebuffer.attach(ssaoTexture);
    this._framebuffer.bind(renderer);
    renderer.gl.clearColor(1, 1, 1, 1);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
    ssaoPass.render(renderer);
    this._framebuffer.unbind(renderer);
};

SSAOPass.prototype.getTargetTexture = function () {
    return this._targetTexture;
}

SSAOPass.prototype.blend = function (renderer, sourceTexture) {
    var blendPass = this._blendPass;
    var width = this._depthTexture.width;
    var height = this._depthTexture.height;

    var targetTexture = this._targetTexture;
    if (sourceTexture.width !== targetTexture.width
        || sourceTexture.height !== targetTexture.height
    ) {
        targetTexture.width = sourceTexture.width;
        targetTexture.height = sourceTexture.height;
        targetTexture.dirty();
    }
    this._framebuffer.attach(targetTexture);
    this._framebuffer.bind(renderer);

    blendPass.setUniform('textureSize', [width, height]);
    blendPass.setUniform('ssaoTexture', this._ssaoTexture);
    blendPass.setUniform('sourceTexture', sourceTexture);
    blendPass.render(renderer);

    this._framebuffer.unbind(renderer);
};

SSAOPass.prototype.setParameter = function (name, val) {
    if (name === 'noiseTexSize') {
        this.setNoiseSize(val);
    }
    else if (name === 'kernelSize') {
        this.setKernelSize(val);
    }
    else if (name === 'blurSize') {
        this._blendPass.material.shader.define('fragment', 'BLUR_SIZE', val);
    }
    else if (name === 'ssaoIntensity') {
        this._blendPass.material.set('ssaoIntensity', val);
    }
    else {
        this._ssaoPass.setUniform(name, val);
    }
};

SSAOPass.prototype.setKernelSize = function (size) {
    this._ssaoPass.material.shader.define('fragment', 'KERNEL_SIZE', size);
    this._kernels = this._kernels || [];
    for (var i = 0; i < 20; i++) {
        this._kernels[i] = generateKernel(size);
    }
};

SSAOPass.prototype.setNoiseSize = function (size) {
    var texture = this._ssaoPass.getUniform('noiseTex');
    if (!texture) {
        texture = generateNoiseTexture(size);
        this._ssaoPass.setUniform('noiseTex', generateNoiseTexture(size));
    }
    else {
        texture.data = generateNoiseData(size);
        texture.width = texture.height = size;
        texture.dirty();
    }

    this._ssaoPass.setUniform('noiseTexSize', [size, size]);
};

module.exports = SSAOPass;