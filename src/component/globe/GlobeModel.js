var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');
var componentShadingMixin = require('../common/componentShadingMixin');


function defaultId(option, idx) {
    option.id = option.id || option.name || (idx + '');
}
var GlobeModel = echarts.extendComponentModel({

    type: 'globe',

    layoutMode: 'box',

    coordinateSystem: null,

    init: function () {
        GlobeModel.superApply(this, 'init', arguments);

        echarts.util.each(this.option.layers, function (layerOption, idx) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
            defaultId(layerOption);
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

        globeRadius: 100,

        // Shading of globe
        shading: 'lambert',

        // Extend light
        light: {
            // Main sun light
            main: {
                // Time, default it will use system time
                time: ''
            },
            // Emission from emissive layers
            emission: {
                intensity: 1
            }
        },

        // light
        // postEffect
        // temporalSuperSampling

        viewControl: {
            autoRotate: true
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
    }
});

echarts.util.merge(GlobeModel.prototype, componentViewControlMixin);
echarts.util.merge(GlobeModel.prototype, componentPostEffectMixin);
echarts.util.merge(GlobeModel.prototype, componentLightMixin);
echarts.util.merge(GlobeModel.prototype, componentShadingMixin);

module.exports = GlobeModel;