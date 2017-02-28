var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

var Geo3DModel = echarts.extendComponentModel({

    type: 'geo3D',

    layoutMode: 'box',

    coordinateSystem: null,

    defaultOption: {

        show: true,

        zlevel: 10,

        flat: false,

        // geoJson used by geo3D
        map: '',

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        boxWidth: 100,
        boxHeight: 3,
        boxDepth: 'auto',

        bevelSize: 0,
        bevelSmoothness: 1,

        // 'color', 'lambert', 'realistic'
        // TODO, 'toon'
        shading: 'lambert',

        realisticMaterial: {
            roughness: 0.5,
            metalness: 0
        },

        light: {
            main: {
                alpha: 40,
                beta: 30
            }
        },

        viewControl: {
            alpha: 40,
            beta: 0,
            distance: 100
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