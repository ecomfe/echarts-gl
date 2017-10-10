var Pass = require('qtek/lib/compositor/Pass');
var StaticGeometry = require('qtek/lib/StaticGeometry');
var Mesh = require('qtek/lib/Mesh');
var Material = require('qtek/lib/Material');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var OrthoCamera = require('qtek/lib/camera/Orthographic');
var Scene = require('qtek/lib/Scene');
var PlaneGeometry = require('qtek/lib/geometry/Plane');

var FrameBuffer = require('qtek/lib/FrameBuffer');

Shader['import'](require('./vectorFieldParticle.glsl.js'));
Shader['import'](require('qtek/lib/shader/source/compositor/fxaa.essl'));

function createSpriteCanvas(size) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

// var spriteUtil = require('../../util/sprite');

var VectorFieldParticleSurface = function () {

    /**
     * @type {number}
     */
    this.motionBlurFactor = 0.99;
    /**
     * Vector field lookup image
     * @type {qtek.Texture2D}
     */
    this.vectorFieldTexture = new Texture2D({
        type: Texture.FLOAT,
        minFilter: Texture.NEAREST,
        magFilter: Texture.NEAREST,
        flipY: false
    });

    /**
     * Particle life range
     * @type {Array.<number>}
     */
    this.particleLife = [5, 20];

    /**
     * @type {number}
     */
    this._particleSize = 1;

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
    this._thisFrameTexture = null;

    this._particlePass = null;
    this._spawnTexture = null;
    this._particleTexture0 = null;
    this._particleTexture1 = null;

    this._particleMesh = null;

    this._surfaceFrameBuffer = null;

    this._elapsedTime = 0.0;

    this._scene = null;
    this._camera = null;

    this._lastFrameTexture = null;

    this._antialisedTexture = null;

    this.init();
};

VectorFieldParticleSurface.prototype = {

    constructor: VectorFieldParticleSurface,

    init: function () {
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

        var particleMesh = new Mesh({
            // Render after last frame full quad
            renderOrder: 10,
            material: new Material({
                shader: new Shader({
                    vertex: Shader.source('ecgl.vfParticle.renderPoints.vertex'),
                    fragment: Shader.source('ecgl.vfParticle.renderPoints.fragment')
                })
            }),
            mode: Mesh.POINTS,
            geometry: new StaticGeometry({
                dynamic: true,
                mainAttribute: 'texcoord0'
            })
        });
        var lastFrameFullQuad = new Mesh({
            material: new Material({
                shader: new Shader({
                    vertex: Shader.source('ecgl.color.vertex'),
                    fragment: Shader.source('ecgl.color.fragment')
                })
                // DO NOT BLEND Blend will multiply alpha
                // transparent: true
            }),
            geometry: new PlaneGeometry()
        });
        lastFrameFullQuad.material.shader.enableTexture('diffuseMap');

        this._particleMesh = particleMesh;
        this._lastFrameFullQuadMesh = lastFrameFullQuad;

        this._scene = new Scene();
        this._scene.add(this._particleMesh);
        this._scene.add(lastFrameFullQuad);
        
        this._camera = new OrthoCamera();
        this._thisFrameTexture = new Texture2D();
        this._lastFrameTexture = new Texture2D();
        this._antialisedTexture = new Texture2D();

        this._fxaaPass = new Pass({
            fragment: Shader.source('qtek.compositor.fxaa')
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
        geometry.dirty();

        this._spawnTexture.width = width;
        this._spawnTexture.height = height;
        this._spawnTexture.pixels = spawnTextureData;

        this._particleTexture0.width = this._particleTexture1.width = width;
        this._particleTexture0.height = this._particleTexture1.height = height;

        this._particlePass.setUniform('textureSize', [width, height]);
    },

    update: function (renderer, deltaTime, firstFrame) {
        var particleMesh = this._particleMesh;
        var frameBuffer = this._frameBuffer;
        var particlePass = this._particlePass;
        var fxaaPass = this._fxaaPass;

        particleMesh.material.set(
            'size', this._particleSize * renderer.getDevicePixelRatio()
        );
        particleMesh.material.set('color', this.particleColor);
        particlePass.setUniform('speedScaling', this.particleSpeedScaling);

        frameBuffer.attach(this._particleTexture1);
        particlePass.setUniform('firstFrameTime', firstFrame ? (this.particleLife[1] + this.particleLife[0]) / 2 : 0);
        particlePass.setUniform('particleTexture', this._particleTexture0);
        particlePass.setUniform('deltaTime', deltaTime);
        particlePass.setUniform('elapsedTime', this._elapsedTime);
        particlePass.render(renderer, frameBuffer);
        particleMesh.material.set('particleTexture', this._particleTexture1);

        frameBuffer.attach(this._thisFrameTexture);
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        this._lastFrameFullQuadMesh.material.set('diffuseMap', this._lastFrameTexture);
        this._lastFrameFullQuadMesh.material.set('color', [1, 1, 1, this.motionBlurFactor]);
        renderer.render(this._scene, this._camera);
        frameBuffer.unbind(renderer);

        frameBuffer.attach(this._antialisedTexture);
        fxaaPass.setUniform('texture', this._thisFrameTexture);
        fxaaPass.render(renderer, frameBuffer);

        this._swapTexture();

        this._elapsedTime += deltaTime;
    },

    getSurfaceTexture: function () {
        return this._antialisedTexture;
    },

    setRegion: function (region) {
        this._particlePass.setUniform('region', region);
    },

    resize: function (width, height) {
        this._lastFrameTexture.width = width;
        this._lastFrameTexture.height = height;
        this._thisFrameTexture.width = width;
        this._thisFrameTexture.height = height;
        this._antialisedTexture.width = width;
        this._antialisedTexture.height = height;
    },

    setParticleSize: function (size) {
        var particleMesh = this._particleMesh;
        if (size <= 2) {
            particleMesh.material.shader.disableTexture('spriteTexture');
            particleMesh.material.transparent = false;
            return;
        }
        if (!this._spriteTexture) {
            this._spriteTexture = new Texture2D();
        }
        if (!this._spriteTexture.image || this._spriteTexture.image.width !== size) {
            this._spriteTexture.image = createSpriteCanvas(size);
            this._spriteTexture.dirty();
        }
        particleMesh.material.transparent = true;
        particleMesh.material.shader.enableTexture('spriteTexture');
        particleMesh.material.set('spriteTexture', this._spriteTexture);

        this._particleSize = size;
    },

    setGradientTexture: function (gradientTexture) {
        var material = this._particleMesh.material;
        material.shader[gradientTexture ? 'enableTexture' : 'disableTexture']('gradientTexture');
        material.setUniform('gradientTexture', gradientTexture);
    },

    setColorTextureImage: function (colorTextureImg, api) {
        var material = this._particleMesh.material;
        material.setTextureImage('colorTexture', colorTextureImg, api, {
            flipY: true
        });
    },

    clearFrame: function (renderer) {
        var frameBuffer = this._frameBuffer;
        frameBuffer.attach(this._lastFrameTexture);
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        frameBuffer.unbind(renderer);
    },

    _swapTexture: function () {
        var tmp = this._particleTexture0;
        this._particleTexture0 = this._particleTexture1;
        this._particleTexture1 = tmp;

        var tmp = this._thisFrameTexture;
        this._thisFrameTexture = this._lastFrameTexture;
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
        renderer.disposeTexture(this._antialisedTexture);

        if (this._spriteTexture) {
            renderer.disposeTexture(this._spriteTexture);
        }

        renderer.disposeScene(this._scene);
    }
};

module.exports = VectorFieldParticleSurface;