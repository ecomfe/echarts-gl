import graphicGL from '../../util/graphicGL';
import Skybox from 'claygl/src/plugin/Skybox';
import echarts from 'echarts/lib/echarts';

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
         * @type {clay.light.Directional}
         */
        this.mainLight = new graphicGL.DirectionalLight({
            shadowBias: 0.005
        });

        /**
         * @type {clay.light.Ambient}
         */
        this.ambientLight = new graphicGL.AmbientLight();

        rootNode.add(this.mainLight);
        rootNode.add(this.ambientLight);
    },

    dispose: function () {
        if (this._lightRoot) {
            this._lightRoot.remove(this.mainLight);
            this._lightRoot.remove(this.ambientLight);
        }
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
                        // Use prefitered cubemap
                        if (self._isSkyboxFromAmbientCubemap) {
                            self._skybox.setEnvironmentMap(lights.specular.cubemap);
                        }

                        api.getZr().refresh();
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
            self._skybox = self._skybox || new Skybox();
            return self._skybox;
        }

        var skybox = getSkybox();
        if (environmentUrl && environmentUrl !== 'none') {
            if (environmentUrl === 'auto') {
                this._isSkyboxFromAmbientCubemap = true;
                // Use environment in ambient cubemap
                if (this._currentCubemapLights) {
                    var cubemap = this._currentCubemapLights.specular.cubemap;
                    skybox.setEnvironmentMap(cubemap);
                    if (this._scene) {
                        skybox.attachScene(this._scene);
                    }
                    skybox.material.set('lod', 3);
                }
                else if (this._skybox) {
                    this._skybox.detachScene();
                }
            }
            // Is gradient or color string
            else if ((typeof environmentUrl === 'object' && environmentUrl.colorStops)
                || (typeof environmentUrl === 'string' && echarts.color.parse(environmentUrl))
            ) {
                this._isSkyboxFromAmbientCubemap = false;
                var texture = new graphicGL.Texture2D({
                    anisotropic: 8,
                    flipY: false
                });
                skybox.setEnvironmentMap(texture);
                var canvas = texture.image = document.createElement('canvas');
                canvas.width = canvas.height = 16;
                var ctx = canvas.getContext('2d');
                var rect = new echarts.graphic.Rect({
                    shape: { x: 0, y: 0, width: 16, height: 16 },
                    style: { fill: environmentUrl }
                });
                rect.brush(ctx);

                skybox.attachScene(this._scene);
            }
            else {
                this._isSkyboxFromAmbientCubemap = false;
                // Panorama
                var texture = graphicGL.loadTexture(environmentUrl, api, {
                    anisotropic: 8,
                    flipY: false
                });
                skybox.setEnvironmentMap(texture);

                skybox.attachScene(this._scene);
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
                this._skybox.material[srgbDefineMethod]('fragment', 'SRGB_DECODE');
            }
            else {
                this._skybox.material.undefine('fragment', 'SRGB_DECODE');
            }
            // var ambientCubemapUrl = environmentUrl === 'auto'
            //     ? componentModel.get('light.ambientCubemap.texture')
            //     : environmentUrl;
        }
    }
};

export default SceneHelper;