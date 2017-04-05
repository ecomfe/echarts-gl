var graphicGL = require('../../util/graphicGL');
var Skybox = require('qtek/lib/plugin/Skybox');
var Skydome = require('qtek/lib/plugin/Skydome');
var echarts = require('echarts/lib/echarts');

function SceneHelper() {
}

SceneHelper.prototype = {
    constructor: SceneHelper,

    setScene: function (scene) {
        this._scene = scene;

        if (this._skybox) {
            this._skybox.attachScene(this._scene);
        }
    },

    initLight: function (rootNode) {
        this._lightRoot = rootNode;
        /**
         * @type {qtek.light.Directional}
         */
        this.mainLight = new graphicGL.DirectionalLight({
            shadowBias: 0.005
        });

        /**
         * @type {qtek.light.Ambient}
         */
        this.ambientLight = new graphicGL.AmbientLight();

        rootNode.add(this.mainLight);
        rootNode.add(this.ambientLight);
    },

    updateLight: function (componentModel) {

        var mainLight = this.mainLight;
        var ambientLight = this.ambientLight;

        var lightModel = componentModel.getModel('light');
        var mainLightModel = lightModel.getModel('main');
        var ambientLightModel = lightModel.getModel('ambient');

        mainLight.intensity = mainLightModel.get('intensity');
        ambientLight.intensity = ambientLightModel.get('intensity');
        mainLight.color = graphicGL.parseColor(mainLightModel.get('color')).slice(0, 3);
        ambientLight.color = graphicGL.parseColor(ambientLightModel.get('color')).slice(0, 3);

        var alpha = mainLightModel.get('alpha') || 0;
        var beta = mainLightModel.get('beta') || 0;
        mainLight.position.setArray(graphicGL.directionFromAlphaBeta(alpha, beta));
        mainLight.lookAt(graphicGL.Vector3.ZERO);

        mainLight.castShadow = mainLightModel.get('shadow');
        mainLight.shadowResolution = graphicGL.getShadowResolution(mainLightModel.get('shadowQuality'));
    },

    updateAmbientCubemap: function (renderer, componentModel, api) {
        var ambientCubemapModel = componentModel.getModel('light.ambientCubemap');

        var textureUrl = ambientCubemapModel.get('texture');
        if (textureUrl) {
            this._cubemapLightsCache = this._cubemapLightsCache || {};
            var lights = this._cubemapLightsCache[textureUrl];
            if (!lights) {
                var self = this;
                lights = this._cubemapLightsCache[textureUrl]
                    = graphicGL.createAmbientCubemap(ambientCubemapModel.option, renderer, api, function () {
                        if (self._skybox instanceof Skybox) {
                            self._skybox.setEnvironmentMap(lights.specular.cubemap);
                        }
                    });
            }
            this._lightRoot.add(lights.diffuse);
            this._lightRoot.add(lights.specular);

            this._currentCubemapLights = lights;
        }
        else if (this._currentCubemapLights) {
            this._lightRoot.remove(this._currentCubemapLights.diffuse);
            this._lightRoot.remove(this._currentCubemapLights.specular);
            this._currentCubemapLights = null;
        }
    },

    updateSkybox: function (renderer, componentModel, api) {
        var environmentUrl = componentModel.get('environment');

        var self = this;
        function getSkybox() {
            if (!(self._skybox instanceof Skybox)) {
                if (self._skybox) {
                    self._skybox.dispose(renderer.gl);
                }
                self._skybox = new Skybox();
            }
            return self._skybox;
        }
        function getSkydome() {
            if (!(self._skybox instanceof Skydome)) {
                if (self._skybox) {
                    self._skybox.dispose(renderer.gl);
                }
                self._skybox = new Skydome();
            }
            return self._skybox;
        }

        if (environmentUrl && environmentUrl !== 'none') {
            if (environmentUrl === 'auto') {
                // Use environment in ambient cubemap
                if (this._currentCubemapLights) {
                    var skybox = getSkybox();
                    var cubemap = this._currentCubemapLights.specular.cubemap;
                    skybox.setEnvironmentMap(cubemap);
                    if (this._scene) {
                        skybox.attachScene(this._scene);
                    }
                    skybox.material.set('lod', 2);
                }
                else if (this._skybox) {
                    this._skybox.detachScene();
                }
            }
            // Is gradient or color string
            else if ((typeof environmentUrl === 'object' && environmentUrl.colorStops)
                || (typeof environmentUrl === 'string' && echarts.color.parse(environmentUrl))
            ) {
                var skydome = getSkydome();
                var texture = new graphicGL.Texture2D({
                    anisotropic: 8,
                    flipY: false
                });
                skydome.setEnvironmentMap(texture);
                var canvas = texture.image = document.createElement('canvas');
                canvas.width = canvas.height = 16;
                var ctx = canvas.getContext('2d');
                var rect = new echarts.graphic.Rect({
                    shape: { x: 0, y: 0, width: 16, height: 16 },
                    style: { fill: environmentUrl }
                });
                rect.brush(ctx);

                skydome.attachScene(this._scene);
            }
            else {
                // Panorama
                var skydome = getSkydome();
                var texture = graphicGL.loadTexture(environmentUrl, api, {
                    anisotropic: 8,
                    flipY: false
                });
                skydome.setEnvironmentMap(texture);

                skydome.attachScene(this._scene);
            }
        }
        else {
            if (this._skybox) {
                this._skybox.detachScene(this._scene);
            }
            this._skybox = null;
        }

        var coordSys = componentModel.coordinateSystem;
        if (this._skybox) {
            if (coordSys && coordSys.viewGL
                && environmentUrl !== 'auto'
                && !(environmentUrl.match && environmentUrl.match(/.hdr$/))
            ) {
                var srgbDefineMethod = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
                this._skybox.material.shader[srgbDefineMethod]('fragment', 'SRGB_DECODE');
            }
            else {
                this._skybox.material.shader.undefine('fragment', 'SRGB_DECODE');
            }
        }
    }
};

module.exports = SceneHelper;