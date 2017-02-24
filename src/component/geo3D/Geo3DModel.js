var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

function defaultId(option, idx) {
    option.id = option.id || option.name || (idx + '');
}
var Geo3DModel = echarts.extendComponentModel({

    type: 'geo3D',

    layoutMode: 'box',

    coordinateSystem: null,

    init: function () {
        Geo3DModel.superApply(this, 'init', arguments);

        echarts.util.each(this.option.layers, function (layerOption, idx) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
            defaultId(layerOption);
        }, this);
    },

    mergeOption: function (option) {
        // TODO test
        var oldLayers = this.option.layers;
        this.option.layers = null;
        Geo3DModel.superApply(this, 'mergeOption', arguments);

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

        zlevel: 10,

        flat: false,

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',


        // Shading of globe
        // 'color', 'lambert', 'realistic'
        // TODO, 'toon'
        shading: 'color',

        realisticMaterial: {
            roughness: 0.5,
            metalness: 0
        }

        // light
        // postEffect
        // temporalSuperSampling
        // viewControl
    }
});

echarts.util.merge(Geo3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Geo3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Geo3DModel.prototype, componentLightMixin);

module.exports = Geo3DModel;