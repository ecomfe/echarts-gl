import Pass from 'claygl/src/compositor/Pass';
import Geometry from 'claygl/src/Geometry';
import Mesh from 'claygl/src/Mesh';
import Material from 'claygl/src/Material';
import Shader from 'claygl/src/Shader';
import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import OrthoCamera from 'claygl/src/camera/Orthographic';
import PlaneGeometry from 'claygl/src/geometry/Plane';

import FrameBuffer from 'claygl/src/FrameBuffer';
import Line2DGeometry from './Line2D';
// import TemporalSS from '../../effect/TemporalSuperSampling';

import vectorFieldParticleGLSL from './vectorFieldParticle.glsl.js';

Shader['import'](vectorFieldParticleGLSL);

function createSpriteCanvas(size) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

// import spriteUtil from '../../util/sprite';

var VectorFieldParticleSurface = function () {

    /**
     * @type {number}
     */
    this.motionBlurFactor = 0.99;
    /**
     * Vector field lookup image
     * @type {clay.Texture2D}
     */
    this.vectorFieldTexture = new Texture2D({
        type: Texture.FLOAT,
        // minFilter: Texture.NEAREST,
        // magFilter: Texture.NEAREST,
        flipY: false
    });

    /**
     * Particle life range
     * @type {Array.<number>}
     */
    this.particleLife = [5, 20];

    this._particleType = 'point';

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
     * @type {clay.Texture2D}
     */
    this._thisFrameTexture = null;

    this._particlePass = null;
    this._spawnTexture = null;
    this._particleTexture0 = null;
    this._particleTexture1 = null;

    this._particlePointsMesh = null;

    this._surfaceFrameBuffer = null;

    this._elapsedTime = 0.0;

    this._scene = null;
    this._camera = null;

    this._lastFrameTexture = null;

    // this._temporalSS = new TemporalSS(50);

    // this._antialising = false;

    this._supersampling = 1;

    this._downsampleTextures = [];

    this._width = 512;
    this._height = 512;

    this.init();
};

VectorFieldParticleSurface.prototype = {

    constructor: VectorFieldParticleSurface,

    init: function () {
        var parameters = {
            type: Texture.FLOAT,
            minFilter: Texture.NEAREST,
            magFilter: Texture.NEAREST,
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

        this._downsamplePass = new Pass({
            fragment: Shader.source('clay.compositor.downsample')
        });

        var particlePointsMesh = new Mesh({
            // Render after last frame full quad
            renderOrder: 10,
            material: new Material({
                shader: new Shader(
                    Shader.source('ecgl.vfParticle.renderPoints.vertex'),
                    Shader.source('ecgl.vfParticle.renderPoints.fragment')
                )
            }),
            mode: Mesh.POINTS,
            geometry: new Geometry({
                dynamic: true,
                mainAttribute: 'texcoord0'
            })
        });
        var particleLinesMesh = new Mesh({
            // Render after last frame full quad
            renderOrder: 10,
            material: new Material({
                shader: new Shader(
                    Shader.source('ecgl.vfParticle.renderLines.vertex'),
                    Shader.source('ecgl.vfParticle.renderLines.fragment')
                )
            }),
            geometry: new Line2DGeometry(),
            culling: false
        });
        var lastFrameFullQuad = new Mesh({
            material: new Material({
                shader: new Shader(
                    Shader.source('ecgl.color.vertex'),
                    Shader.source('ecgl.color.fragment')
                )
                // DO NOT BLEND Blend will multiply alpha
                // transparent: true
            }),
            geometry: new PlaneGeometry()
        });
        lastFrameFullQuad.material.enableTexture('diffuseMap');

        this._particlePointsMesh = particlePointsMesh;
        this._particleLinesMesh = particleLinesMesh;
        this._lastFrameFullQuadMesh = lastFrameFullQuad;

        this._camera = new OrthoCamera();
        this._thisFrameTexture = new Texture2D();
        this._lastFrameTexture = new Texture2D();
    },

    setParticleDensity: function (width, height) {
        var nVertex = width * height;

        var spawnTextureData = new Float32Array(nVertex * 4);
        var off = 0;
        var lifeRange = this.particleLife;
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++, off++) {
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

        if (this._particleType === 'line') {
            this._setLineGeometry(width, height);
        }
        else {
            this._setPointsGeometry(width, height);
        }

        this._spawnTexture.width = width;
        this._spawnTexture.height = height;
        this._spawnTexture.pixels = spawnTextureData;

        this._particleTexture0.width = this._particleTexture1.width = width;
        this._particleTexture0.height = this._particleTexture1.height = height;

        this._particlePass.setUniform('textureSize', [width, height]);
    },

    _setPointsGeometry: function (width, height) {
        var nVertex = width * height;
        var geometry = this._particlePointsMesh.geometry;
        var attributes = geometry.attributes;
        attributes.texcoord0.init(nVertex);

        var off = 0;
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++, off++) {
                attributes.texcoord0.value[off * 2] = i / width;
                attributes.texcoord0.value[off * 2 + 1] = j / height;
            }
        }
        geometry.dirty();
    },

    _setLineGeometry: function (width, height) {
        var nLine = width * height;
        var geometry = this._getParticleMesh().geometry;
        geometry.setLineCount(nLine);
        geometry.resetOffset();
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                geometry.addLine([i / width, j / height]);
            }
        }
        geometry.dirty();
    },

    _getParticleMesh: function () {
        return this._particleType === 'line' ? this._particleLinesMesh : this._particlePointsMesh;
    },

    update: function (renderer, api, deltaTime, firstFrame) {
        var particleMesh = this._getParticleMesh();
        var frameBuffer = this._frameBuffer;
        var particlePass = this._particlePass;

        if (firstFrame) {
            this._updateDownsampleTextures(renderer, api);
        }

        particleMesh.material.set('size', this._particleSize * this._supersampling);
        particleMesh.material.set('color', this.particleColor);
        particlePass.setUniform('speedScaling', this.particleSpeedScaling);

        frameBuffer.attach(this._particleTexture1);
        particlePass.setUniform('firstFrameTime', firstFrame ? (this.particleLife[1] + this.particleLife[0]) / 2 : 0);
        particlePass.setUniform('particleTexture', this._particleTexture0);
        particlePass.setUniform('deltaTime', deltaTime);
        particlePass.setUniform('elapsedTime', this._elapsedTime);
        particlePass.render(renderer, frameBuffer);

        particleMesh.material.set('particleTexture', this._particleTexture1);
        particleMesh.material.set('prevParticleTexture', this._particleTexture0);

        frameBuffer.attach(this._thisFrameTexture);
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        var lastFrameFullQuad = this._lastFrameFullQuadMesh;
        lastFrameFullQuad.material.set('diffuseMap', this._lastFrameTexture);
        lastFrameFullQuad.material.set('color', [1, 1, 1, this.motionBlurFactor]);

        this._camera.update(true);
        renderer.renderPass([lastFrameFullQuad, particleMesh], this._camera);
        frameBuffer.unbind(renderer);

        this._downsample(renderer);

        this._swapTexture();

        this._elapsedTime += deltaTime;
    },

    _downsample: function (renderer) {
        var downsampleTextures = this._downsampleTextures;
        if (downsampleTextures.length === 0) {
            return;
        }
        var current = 0;
        var sourceTexture = this._thisFrameTexture;
        var targetTexture = downsampleTextures[current];

        while (targetTexture) {
            this._frameBuffer.attach(targetTexture);
            this._downsamplePass.setUniform('texture', sourceTexture);
            this._downsamplePass.setUniform('textureSize', [sourceTexture.width, sourceTexture.height]);
            this._downsamplePass.render(renderer, this._frameBuffer);

            sourceTexture = targetTexture;
            targetTexture = downsampleTextures[++current];
        }
    },

    getSurfaceTexture: function () {
        var downsampleTextures = this._downsampleTextures;
        return downsampleTextures.length > 0
            ? downsampleTextures[downsampleTextures.length - 1]
            : this._lastFrameTexture;
    },

    setRegion: function (region) {
        this._particlePass.setUniform('region', region);
    },

    resize: function (width, height) {
        this._lastFrameTexture.width = width * this._supersampling;
        this._lastFrameTexture.height = height * this._supersampling;
        this._thisFrameTexture.width = width * this._supersampling;
        this._thisFrameTexture.height = height * this._supersampling;

        this._width = width;
        this._height = height;
    },

    setParticleSize: function (size) {
        var particleMesh = this._getParticleMesh();
        if (size <= 2) {
            particleMesh.material.disableTexture('spriteTexture');
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
        particleMesh.material.enableTexture('spriteTexture');
        particleMesh.material.set('spriteTexture', this._spriteTexture);

        this._particleSize = size;
    },

    setGradientTexture: function (gradientTexture) {
        var material = this._getParticleMesh().material;
        material[gradientTexture ? 'enableTexture' : 'disableTexture']('gradientTexture');
        material.setUniform('gradientTexture', gradientTexture);
    },

    setColorTextureImage: function (colorTextureImg, api) {
        var material = this._getParticleMesh().material;
        material.setTextureImage('colorTexture', colorTextureImg, api, {
            flipY: true
        });
    },

    setParticleType: function (type) {
        this._particleType = type;
    },

    clearFrame: function (renderer) {
        var frameBuffer = this._frameBuffer;
        frameBuffer.attach(this._lastFrameTexture);
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        frameBuffer.unbind(renderer);
    },

    setSupersampling: function (supersampling) {
        this._supersampling = supersampling;
        this.resize(this._width, this._height);
    },

    _updateDownsampleTextures: function (renderer, api) {
        var downsampleTextures = this._downsampleTextures;
        var upScale = Math.max(Math.floor(Math.log(this._supersampling / api.getDevicePixelRatio()) / Math.log(2)), 0);
        var scale = 2;
        var width = this._width * this._supersampling;
        var height = this._height * this._supersampling;
        for (var i = 0; i < upScale; i++) {
            downsampleTextures[i] = downsampleTextures[i] || new Texture2D();
            downsampleTextures[i].width = width / scale;
            downsampleTextures[i].height = height / scale;
            scale *= 2;
        }
        for (;i < downsampleTextures.length; i++) {
            downsampleTextures[i].dispose(renderer);
        }
        downsampleTextures.length = upScale;
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

        renderer.disposeGeometry(this._particleLinesMesh.geometry);
        renderer.disposeGeometry(this._particlePointsMesh.geometry);
        renderer.disposeGeometry(this._lastFrameFullQuadMesh.geometry);

        if (this._spriteTexture) {
            renderer.disposeTexture(this._spriteTexture);
        }

        this._particlePass.dispose(renderer);
        this._downsamplePass.dispose(renderer);

        this._downsampleTextures.forEach(function (texture) {
            texture.dispose(renderer);
        });
    }
};

export default VectorFieldParticleSurface;