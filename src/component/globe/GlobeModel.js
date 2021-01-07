import * as echarts from 'echarts/lib/echarts';
import componentViewControlMixin from '../common/componentViewControlMixin';
import componentPostEffectMixin from '../common/componentPostEffectMixin';
import componentLightMixin from '../common/componentLightMixin';
import componentShadingMixin from '../common/componentShadingMixin';


function defaultId(option, idx) {
    option.id = option.id || option.name || (idx + '');
}
var GlobeModel = echarts.ComponentModel.extend({

    type: 'globe',

    layoutMode: 'box',

    coordinateSystem: null,

    init: function () {
        GlobeModel.superApply(this, 'init', arguments);

        echarts.util.each(this.option.layers, function (layerOption, idx) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
            defaultId(layerOption, idx);
        }, this);
    },

    mergeOption: function (option) {
        // TODO test
        var oldLayers = this.option.layers;
        this.option.layers = null;
        GlobeModel.superApply(this, 'mergeOption', arguments);

        function createLayerMap(layers) {
            return echarts.util.reduce(layers, function (obj, layerOption, idx) {
                defaultId(layerOption, idx);
                obj[layerOption.id] = layerOption;
                return obj;
            }, {});
        }
        if (oldLayers && oldLayers.length) {
            var newLayerMap = createLayerMap(option.layers);
            var oldLayerMap = createLayerMap(oldLayers);
            for (var id in newLayerMap) {
                if (oldLayerMap[id]) {
                    echarts.util.merge(oldLayerMap[id], newLayerMap[id], true);
                }
                else {
                    oldLayers.push(option.layers[id]);
                }
            }
            // Copy back
            this.option.layers = oldLayers;
        }
        // else overwrite

        // Set default
        echarts.util.each(this.option.layers, function (layerOption) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
        }, this);
    },

    optionUpdated: function () {
        this.updateDisplacementHash();
    },

    defaultLayerOption: {
        show: true,
        type: 'overlay'
    },

    defaultOption: {

        show: true,

        zlevel: -10,

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        environment: 'auto',

        baseColor: '#fff',

        // Base albedo texture
        baseTexture: '',

        // Height texture for bump mapping and vertex displacement
        heightTexture: '',

        // Texture for vertex displacement, default use heightTexture
        displacementTexture: '',
        // Scale of vertex displacement, available only if displacementTexture is set.
        displacementScale: 0,

        // Detail of displacement. 'low', 'medium', 'high', 'ultra'
        displacementQuality: 'medium',

        // Globe radius
        globeRadius: 100,

        // Globe outer radius. Which is max of altitude.
        globeOuterRadius: 150,

        // Shading of globe
        shading: 'lambert',

        // Extend light
        light: {
            // Main sun light
            main: {
                // Time, default it will use system time
                time: ''
            }
        },

        // atmosphere
        atmosphere: {
            show: false,
            offset: 5,
            color: '#ffffff',
            glowPower: 6.0,
            innerGlowPower: 2.0
        },

        // light
        // postEffect
        // temporalSuperSampling

        viewControl: {
            autoRotate: true,

            panSensitivity: 0,

            targetCoord: null
        },


        // {
        //     show: true,
        //     name: 'cloud',
        //     type: 'overlay',
        //     shading: 'lambert',
        //     distance: 10,
        //     texture: ''
        // }
        // {
        //     type: 'blend',
        //     blendTo: 'albedo'
        //     blendType: 'source-over'
        // }

        layers: []
    },

    setDisplacementData: function (data, width, height) {
        this.displacementData = data;
        this.displacementWidth = width;
        this.displacementHeight = height;
    },

    getDisplacementTexture: function () {
        return this.get('displacementTexture') || this.get('heightTexture');
    },

    getDisplacemenScale: function () {
        var displacementTexture = this.getDisplacementTexture();
        var displacementScale = this.get('displacementScale');
        if (!displacementTexture || displacementTexture === 'none') {
            displacementScale = 0;
        }
        return displacementScale;
    },

    hasDisplacement: function () {
        return this.getDisplacemenScale() > 0;
    },

    _displacementChanged: true,

    _displacementScale: 0,

    updateDisplacementHash: function () {
        var displacementTexture = this.getDisplacementTexture();
        var displacementScale = this.getDisplacemenScale();

        this._displacementChanged =
            this._displacementTexture !== displacementTexture
            || this._displacementScale !== displacementScale;

        this._displacementTexture = displacementTexture;
        this._displacementScale = displacementScale;
    },

    isDisplacementChanged: function () {
        return this._displacementChanged;
    }
});

echarts.util.merge(GlobeModel.prototype, componentViewControlMixin);
echarts.util.merge(GlobeModel.prototype, componentPostEffectMixin);
echarts.util.merge(GlobeModel.prototype, componentLightMixin);
echarts.util.merge(GlobeModel.prototype, componentShadingMixin);

export default GlobeModel;