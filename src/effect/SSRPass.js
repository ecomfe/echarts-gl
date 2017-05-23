var Matrix4 = require('qtek/lib/math/Matrix4');
var Vector3 = require('qtek/lib/math/Vector3');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var Pass = require('qtek/lib/compositor/Pass');
var Shader = require('qtek/lib/Shader');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var halton = require('./halton');

Shader.import(require('./SSR.glsl.js'));

function SSRPass(opt) {
    opt = opt || {};

    this._ssrPass = new Pass({
        fragment: Shader.source('ecgl.ssr.main'),
        clearColor: [0, 0, 0, 0]
    });
    this._blurPass1 = new Pass({
        fragment: Shader.source('ecgl.ssr.blur'),
        clearColor: [0, 0, 0, 0]
    });
    this._blurPass2 = new Pass({
        fragment: Shader.source('ecgl.ssr.blur'),
        clearColor: [0, 0, 0, 0]
    });

    this._ssrPass.setUniform('gBufferTexture1', opt.normalTexture);
    this._ssrPass.setUniform('gBufferTexture2', opt.depthTexture);

    this._blurPass1.setUniform('gBufferTexture1', opt.normalTexture);
    this._blurPass2.setUniform('gBufferTexture1', opt.normalTexture);

    this._blurPass2.material.shader.define('fragment', 'VERTICAL');
    this._blurPass2.material.shader.define('fragment', 'BLEND');

    this._texture1 = new Texture2D({
        type: Texture.HALF_FLOAT
    });
    this._texture2 = new Texture2D({
        type: Texture.HALF_FLOAT
    });

    this._frameBuffer = new FrameBuffer();
}

SSRPass.prototype.update = function (renderer, camera, sourceTexture, frame) {
    var width = renderer.getWidth();
    var height = renderer.getHeight();
    var texture1 = this._texture1;
    var texture2 = this._texture2;
    texture1.width = texture2.width = width;
    texture1.height = texture2.height = height;
    var frameBuffer = this._frameBuffer;

    var ssrPass = this._ssrPass;
    var blurPass1 = this._blurPass1;
    var blurPass2 = this._blurPass2;

    var viewInverseTranspose = new Matrix4();
    Matrix4.transpose(viewInverseTranspose, camera.worldTransform);

    ssrPass.setUniform('sourceTexture', sourceTexture);
    ssrPass.setUniform('projection', camera.projectionMatrix._array);
    ssrPass.setUniform('projectionInv', camera.invProjectionMatrix._array);
    ssrPass.setUniform('viewInverseTranspose', viewInverseTranspose._array);
    ssrPass.setUniform('nearZ', camera.near);
    ssrPass.setUniform('jitterOffset', frame / 30);

    var textureSize = [width, height];

    blurPass1.setUniform('textureSize', textureSize);
    blurPass2.setUniform('textureSize', textureSize);
    blurPass2.setUniform('sourceTexture', sourceTexture);

    frameBuffer.attach(texture2);
    frameBuffer.bind(renderer);
    ssrPass.render(renderer);

    frameBuffer.attach(texture1);
    blurPass1.setUniform('texture', texture2);
    blurPass1.render(renderer);

    frameBuffer.attach(texture2);
    blurPass2.setUniform('texture', texture1);
    blurPass2.render(renderer);
    frameBuffer.unbind(renderer);
};

SSRPass.prototype.getTargetTexture = function () {
    return this._texture2;
};

SSRPass.prototype.setParameter = function (name, val) {
    if (name === 'maxIteration') {
        this._ssrPass.material.shader.define('fragment', 'MAX_ITERATION', val);
    }
    else if (name === 'maxBinarySearchIteration') {
        this._ssrPass.material.shader.define('fragment', 'MAX_BINARY_SEARCH_ITERATION', val);
    }
    else {
        this._ssrPass.setUniform(name, val);
    }
};

SSRPass.prototype.dispose = function (gl) {
    this._texture1.dispose(gl);
    this._texture2.dispose(gl);
    this._frameBuffer.dispose(gl);
};

module.exports = SSRPass;