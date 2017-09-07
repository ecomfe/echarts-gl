var Pass = require('qtek/lib/compositor/Pass');
var StaticGeometry = require('qtek/lib/StaticGeometry');
var Mesh = require('qtek/lib/Mesh');
var Material = require('qtek/lib/Material');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var OrthoCamera = require('qtek/lib/camera/Orthographic');
var Scene = require('qtek/lib/Scene');

var FrameBuffer = require('qtek/lib/FrameBuffer');

Shader['import'](require('./vectorFieldParticle.glsl.js'));

// var spriteUtil = require('../../util/sprite');

var VectorFieldParticleSurface = function () {

    /**
     * @type {number}
     */
    this.motionBlurFactor = 0.9;
    /**
     * Vector field lookup image
     * @type {qtek.Texture2D}
     */
    this.vectorFieldTexture = new Texture2D({
        type: Texture.FLOAT,
        flipY: false
    });

    /**
     * Particle life range
     * @type {Array.<number>}
     */
    this.particleLife = [10, 20];

    /**
     * @type {number}
     */
    this.particleSize = 1;

    /**
     * @type {Array.<number>}
     */
    this.particleColor = [1, 1, 1, 1];

    /**
     * @type {number}
     */
    this.particleSpeedScaling = 1.0;

    /**
     * @type {qtek.Texture2D}
     */
    this._surfaceTexture = null;

    /**
     * @type {qtek.Mesh}
     */
    this.surfaceMesh = null;

    this._particlePass = null;
    this._spawnTexture = null;
    this._particleTexture0 = null;
    this._particleTexture1 = null;

    this._particleMesh = null;

    this._surfaceFrameBuffer = null;

    this._elapsedTime = 0.0;

    this._scene = null;
    this._camera = null;

    this._motionBlurPass = null;
    this._thisFrameTexture = null;
    this._lastFrameTexture = null;

    this.init();
};

VectorFieldParticleSurface.prototype = {

    constructor: VectorFieldParticleSurface,

    init: function () {
        var geometry = new StaticGeometry({
            mainAttribute: 'texcoord0'
        });
        var parameters = {
            type: Texture.FLOAT,
            minFilter: Texture.NEAREST,
            magFilter: Texture.NEAREST,
            wrapS: Texture.REPEAT,
            wrapT: Texture.REPEAT,
            useMipmap: false
        };
        this._spawnTexture = new Texture2D(parameters);

        this._particleTexture0 = new Texture2D(parameters);
        this._particleTexture1 = new Texture2D(parameters);

        this._frameBuffer = new FrameBuffer({
            depthBuffer: false
        });
        this._particlePass = new Pass({
            fragment: Shader.source('ecgl.vfParticle.particle.fragment')
        });
        this._particlePass.setUniform('velocityTexture', this.vectorFieldTexture);
        this._particlePass.setUniform('spawnTexture', this._spawnTexture);

        this._motionBlurPass = new Pass({
            fragment: Shader.source('qtek.compositor.blend')
        });
        this._motionBlurPass.material.shader.disableTexturesAll();
        this._motionBlurPass.material.shader.enableTexture(['texture1', 'texture2']);
        this._motionBlurPass.setUniform('weight1', this.motionBlurFactor);
        this._motionBlurPass.setUniform('weight2', 1);

        var particleMesh = new Mesh({
            material: new Material({
                shader: new Shader({
                    vertex: Shader.source('ecgl.vfParticle.renderPoints.vertex'),
                    fragment: Shader.source('ecgl.vfParticle.renderPoints.fragment')
                })
            }),
            mode: Mesh.POINTS,
            geometry: geometry
        });
        // particleMesh.material.set('spriteTexture', new Texture2D({
        //     image: spriteUtil.makeSimpleSprite(128)
        // }));

        this._particleMesh = particleMesh;

        this._scene = new Scene();
        this._scene.add(this._particleMesh);
        this._camera = new OrthoCamera();
        if (!this._surfaceTexture) {
            this._surfaceTexture = new Texture2D({
                width: 1024,
                height: 1024,
                flipY: false
            });
        }

        var surfaceWidth = this._surfaceTexture.width;
        var surfaceHeight = this._surfaceTexture.height;
        this._lastFrameTexture = new Texture2D({
            width: surfaceWidth,
            height: surfaceHeight
        });
        this._thisFrameTexture = new Texture2D({
            width: surfaceWidth,
            height: surfaceHeight
        });
    },

    setParticleDensity: function (width, height) {
        var geometry = this._particleMesh.geometry;
        var nVertex = width * height;
        var attributes = geometry.attributes;
        attributes.texcoord0.init(nVertex);

        var spawnTextureData = new Float32Array(nVertex * 4);
        var off = 0;
        var lifeRange = this.particleLife;
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++, off++) {
                attributes.texcoord0.value[off * 2] = i / width;
                attributes.texcoord0.value[off * 2 + 1] = j / height;
                // x position, range [0 - 1]
                spawnTextureData[off * 4] = Math.random();
                // y position, range [0 - 1]
                spawnTextureData[off * 4 + 1] = Math.random();
                // Some property
                spawnTextureData[off * 4 + 2] = Math.random();
                var life = (lifeRange[1] - lifeRange[0]) * Math.random() + lifeRange[0];
                // Particle life
                spawnTextureData[off * 4 + 3] = life;
            }
        }

        this._spawnTexture.width = width;
        this._spawnTexture.height = height;
        this._spawnTexture.pixels = spawnTextureData;

        this._particleTexture0.width = this._particleTexture1.width = width;
        this._particleTexture0.height = this._particleTexture1.height = height;
    },

    update: function (renderer, deltaTime) {
        var particleMesh = this._particleMesh;
        var frameBuffer = this._frameBuffer;
        var particlePass = this._particlePass;
        var motionBlurPass = this._motionBlurPass;

        particleMesh.material.set(
            'size', this.particleSize * renderer.getDevicePixelRatio()
        );
        particleMesh.material.set('color', this.particleColor);
        particlePass.setUniform('speedScaling', this.particleSpeedScaling);

        frameBuffer.attach(this._particleTexture1);
        particlePass.setUniform('particleTexture', this._particleTexture0);
        particlePass.setUniform('deltaTime', deltaTime);
        particlePass.setUniform('elapsedTime', this._elapsedTime);
        particlePass.render(renderer, frameBuffer);
        particleMesh.material.set('particleTexture', this._particleTexture1);

        frameBuffer.attach(this._thisFrameTexture);
        frameBuffer.bind(renderer);
        renderer.render(this._scene, this._camera);
        frameBuffer.unbind(renderer);

        frameBuffer.attach(this._surfaceTexture);
        motionBlurPass.setUniform('texture1', this._lastFrameTexture);
        motionBlurPass.setUniform('texture2', this._thisFrameTexture);
        motionBlurPass.render(renderer, frameBuffer);

        this._swapTexture();

        if (this.surfaceMesh) {
            this.surfaceMesh.material.set('diffuseMap', this._surfaceTexture);
        }

        this._elapsedTime += deltaTime;
    },

    getSurfaceTexture: function () {
        return this._surfaceTexture;
    },

    resize: function (width, height) {
        this._surfaceTexture.width = width;
        this._surfaceTexture.height = height;
        this._lastFrameTexture.width = width;
        this._lastFrameTexture.height = height;
        this._thisFrameTexture.width = width;
        this._thisFrameTexture.height = height;
    },

    _swapTexture: function () {
        var tmp = this._particleTexture0;
        this._particleTexture0 = this._particleTexture1;
        this._particleTexture1 = tmp;

        var tmp = this._surfaceTexture;
        this._surfaceTexture = this._lastFrameTexture;
        this._lastFrameTexture = tmp;
    },

    dispose: function (renderer) {
        renderer.disposeFrameBuffer(this._frameBuffer);
        // Dispose textures
        renderer.disposeTexture(this.vectorFieldTexture);
        renderer.disposeTexture(this._spawnTexture);
        renderer.disposeTexture(this._particleTexture0);
        renderer.disposeTexture(this._particleTexture1);
        renderer.disposeTexture(this._thisFrameTexture);
        renderer.disposeTexture(this._lastFrameTexture);

        renderer.disposeScene(this._scene);
    }
};

module.exports = VectorFieldParticleSurface;