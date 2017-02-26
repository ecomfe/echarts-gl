var graphicGL = require('../../util/graphicGL');

function LightHelper(rootNode) {
    this.initLight();

    this._root = rootNode;

    rootNode.add(this.mainLight);
    rootNode.add(this.ambientLight);
}

LightHelper.prototype = {
    constructor: LightHelper,

    initLight: function () {
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
                lights = this._cubemapLightsCache[textureUrl]
                    = graphicGL.createAmbientCubemap(ambientCubemapModel.option, renderer, api);
            }
            this._root.add(lights.diffuse);
            this._root.add(lights.specular);

            this._currentCubemapLights = lights;
        }
        else if (this._currentCubemapLights) {
            this._root.remove(this._currentCubemapLights.diffuse);
            this._root.remove(this._currentCubemapLights.specular);
            this._currentCubemapLights = null;
        }
    }
};

module.exports = LightHelper;