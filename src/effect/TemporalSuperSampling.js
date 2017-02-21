// Temporal Super Sample for static Scene
var halton = require('./halton');
var Pass = require('qtek/lib/compositor/Pass');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var Texture2D = require('qtek/lib/Texture2D');
var Shader = require('qtek/lib/Shader');

function TemporalSuperSampling () {
    var haltonSequence = [];

    for (var i = 0; i < 20; i++) {
        haltonSequence.push([
            halton(i, 2), halton(i, 3)
        ]);
    }

    this._haltonSequence = haltonSequence;

    this._frame = 0;

    this._sourceTex = new Texture2D();
    this._sourceFb = new FrameBuffer({
        depthBuffer: false
    });
    this._sourceFb.attach(this._sourceTex);

    // Frame texture before temporal supersampling
    this._prevFrameTex = new Texture2D();
    this._outputTex = new Texture2D();

    var blendPass = this._blendPass = new Pass({
        fragment: Shader.source('qtek.compositor.blend')
    });
    blendPass.material.shader.disableTexturesAll();
    blendPass.material.shader.enableTexture(['texture1', 'texture2']);

    this._blendFb = new FrameBuffer({
        depthBuffer: false
    });

    this._outputPass = new Pass({
        fragment: Shader.source('qtek.compositor.output')
    });
}

TemporalSuperSampling.prototype = {

    constructor: TemporalSuperSampling,

    /**
     * Jitter camera projectionMatrix
     * @parma {qtek.Renderer} renderer
     * @param {qtek.Camera} camera
     */
    jitterProjection: function (renderer, camera) {
        var width = renderer.getWidth();
        var height = renderer.getHeight();

        var offset = this._haltonSequence[this._frame];
        camera.projectionMatrix._array[8] += (offset[0] * 2.0 - 1.0) / width;
        camera.projectionMatrix._array[9] += (offset[1] * 2.0 - 1.0) / height;
    },

    /**
     * Reset accumulating frame
     */
    resetFrame: function () {
        this._frame = 0;
    },

    /**
     * Get source framebuffer for usage
     */
    getSourceFrameBuffer: function () {
        return this._sourceFb;
    },

    resize: function (width, height) {
        if (this._sourceTex.width !== width || this._sourceTex.height !== height) {

            this._prevFrameTex.width = width;
            this._prevFrameTex.height = height;

            this._outputTex.width = width;
            this._outputTex.height = height;

            this._sourceTex.width = width;
            this._sourceTex.height = height;

            this._prevFrameTex.dirty();
            this._outputTex.dirty();
            this._sourceTex.dirty();
        }
    },

    isFinished: function () {
        return this._frame >= this._haltonSequence.length;
    },

    render: function (renderer) {
        var blendPass = this._blendPass;
        if (this._frame === 0) {
            // Direct output
            blendPass.setUniform('weight1', 0);
            blendPass.setUniform('weight2', 1);
        }
        else {
            blendPass.setUniform('weight1', 0.9);
            blendPass.setUniform('weight2', 0.1);
        }
        blendPass.setUniform('texture1', this._prevFrameTex);
        blendPass.setUniform('texture2', this._sourceTex);

        this._blendFb.attach(this._outputTex);
        this._blendFb.bind(renderer);
        blendPass.render(renderer);
        this._blendFb.unbind(renderer);

        this._outputPass.setUniform('texture', this._outputTex);
        this._outputPass.render(renderer);

        // Swap texture
        var tmp = this._prevFrameTex;
        this._prevFrameTex = this._outputTex;
        this._outputTex = tmp;

        this._frame++;
    },

    dispose: function (gl) {
        this._sourceFb.dispose(gl);
        this._blendFb.dispose(gl);
        this._prevFrameTex.dispose(gl);
        this._outputTex.dispose(gl);
        this._sourceTex.dispose(gl);
        this._outputPass.dispose(gl);
        this._blendPass.dispose(gl);
    }
};

module.exports = TemporalSuperSampling;