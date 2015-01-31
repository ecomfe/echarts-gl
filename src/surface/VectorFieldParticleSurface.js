/**
 * Surface with vector field particles
 *
 * @module echarts-x/surface/VectorFieldParticleSurface
 */

define(function (require) {
    
    var Pass = require('qtek/compositor/Pass');
    var StaticGeometry = require('qtek/StaticGeometry');
    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/Texture2D');
    var glenum = require('qtek/core/glenum');
    var OrthoCamera = require('qtek/camera/Orthographic');
    var Scene = require('qtek/Scene');

    var FrameBuffer = require('qtek/FrameBuffer');

    var spriteUtil = require('../util/sprite');
    /**
     * @constructor
     * @alias module:echarts-x/surface/VectorFieldParticleSurface
     */
    var VectorFieldParticleSurface = function (renderer) {

        this.renderer = renderer;

        /**
         * @type {number}
         */
        this.motionBlurFactor = 0.99;
        /**
         * Vector field lookup image
         * @type {qtek.Texture2D}
         */
        this.vectorFieldTexture = null;

        /**
         * Particle life range
         * @type {Array.<number>}
         */
        this.particleLife = [10, 20];

        /**
         * @type {number}
         */
        this.particleSizeScaling = 1;

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
        this.surfaceTexture = null;

        /**
         * @type {qtek.Mesh}
         */
        this.surfaceMesh = null;

        this._particlePass = null;
        this._spawnTexture = null;
        this._particleTexture0 = null;
        this._particleTexture1 = null;

        this._particleMesh = null;

        this._frameBuffer = null;

        this._elapsedTime = 0.0;

        this._scene = null;
        this._camera = null;

        this._motionBlurPass = null;
        this._thisFrameTexture = null;
        this._lastFrameTexture = null;
    };

    VectorFieldParticleSurface.prototype = {

        constructor: VectorFieldParticleSurface,

        init: function (width, height) {
            var geometry = new StaticGeometry({
                mainAttribute: 'texcoord0'
            });
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

            var parameters = {
                width: width,
                height: height,
                type: glenum.FLOAT,
                minFilter: glenum.NEAREST,
                magFilter: glenum.NEAREST,
                wrapS: glenum.REPEAT,
                wrapT: glenum.REPEAT,
                useMipmap: false
            }
            this._spawnTexture = new Texture2D(parameters);
            this._spawnTexture.pixels = spawnTextureData;

            this._particleTexture0 = new Texture2D(parameters);
            this._particleTexture1 = new Texture2D(parameters);

            this._frameBuffer = new FrameBuffer();
            this._particlePass = new Pass({
                fragment: Shader.source('ecx.vfParticle.particle.fragment')
            });
            this._particlePass.setUniform('velocityTexture', this.vectorFieldTexture);
            this._particlePass.setUniform('spawnTexture', this._spawnTexture);
            this._particlePass.setUniform('speedScaling', this.particleSpeedScaling);

            this._motionBlurPass = new Pass({
                fragment: Shader.source('ecx.motionBlur.fragment')
            });
            this._motionBlurPass.setUniform('percent', this.motionBlurFactor);

            var particleMesh = new Mesh({
                material: new Material({
                    shader: new Shader({
                        vertex: Shader.source('ecx.vfParticle.renderPoints.vertex'),
                        fragment: Shader.source('ecx.vfParticle.renderPoints.fragment')
                    })
                }),
                mode: glenum.POINTS,
                geometry: geometry
            });
            particleMesh.material.set('spriteTexture', new Texture2D({
                image: spriteUtil.makeSimpleSprite(128)
            }));
            particleMesh.material.set(
                'sizeScaling', this.particleSizeScaling * this.renderer.getDevicePixelRatio()
            );
            particleMesh.material.set('color', this.particleColor);

            this._particleMesh = particleMesh;

            this._scene = new Scene();
            this._scene.add(this._particleMesh);
            this._camera = new OrthoCamera();
            if (! this.surfaceTexture) {
                this.surfaceTexture = new Texture2D({
                    width: 1024,
                    height: 1024
                });
            }

            var surfaceWidth = this.surfaceTexture.width;
            var surfaceHeight = this.surfaceTexture.height;
            this._lastFrameTexture = new Texture2D({
                width: surfaceWidth,
                height: surfaceHeight
            });
            this._thisFrameTexture = new Texture2D({
                width: surfaceWidth,
                height: surfaceHeight
            });
        },

        update: function (deltaTime) {
            var frameBuffer = this._frameBuffer;
            var particlePass = this._particlePass;
            var motionBlurPass = this._motionBlurPass;
            particlePass.attachOutput(this._particleTexture1);
            particlePass.setUniform('particleTexture', this._particleTexture0);
            particlePass.setUniform('deltaTime', deltaTime);
            particlePass.setUniform('elapsedTime', this._elapsedTime);
            particlePass.render(this.renderer, frameBuffer);
            this._particleMesh.material.set('particleTexture', this._particleTexture1);

            frameBuffer.attach(this.renderer.gl, this._thisFrameTexture);
            frameBuffer.bind(this.renderer);
            this.renderer.render(this._scene, this._camera);
            frameBuffer.unbind(this.renderer);

            motionBlurPass.attachOutput(this.surfaceTexture);
            motionBlurPass.setUniform('lastFrame', this._lastFrameTexture);
            motionBlurPass.setUniform('thisFrame', this._thisFrameTexture);
            motionBlurPass.render(this.renderer, frameBuffer);

            this._swapTexture();

            if (this.surfaceMesh) {
                this.surfaceMesh.material.set('diffuseMap', this.surfaceTexture)
            }

            this._elapsedTime += deltaTime;
        },

        _swapTexture: function () {
            var tmp = this._particleTexture0;
            this._particleTexture0 = this._particleTexture1;
            this._particleTexture1 = tmp;

            var tmp = this.surfaceTexture;
            this.surfaceTexture = this._lastFrameTexture;
            this._lastFrameTexture = tmp;
        },

        dispose: function () {
            var renderer = this.renderer;
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
    }

    return VectorFieldParticleSurface;
});