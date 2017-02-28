var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

var Geo3DModel = echarts.extendComponentModel({

    type: 'geo3D',

    layoutMode: 'box',

    coordinateSystem: null,

    optionUpdated: function () {
        var option = this.option;
        var self = this;

        this._optionModelMap = (option.regions || []).reduce(function (obj, regionOpt) {
            if (regionOpt.name) {
                obj[regionOpt.name] = new echarts.Model(regionOpt, self);
            }
            return obj;
        }, {});

        // this.updateSelectedMap(option.regions);
    },

    getRegionModel: function (name) {
        return this._optionModelMap[name] || new echarts.Model(null, this);
    },

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

        groundPlane: {
            show: false,
            color: '#aaa'
        },

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
        },

        // itemStyle: {},
        // height,
        // label: {}
        regions: [],

        // light
        // postEffect
        // temporalSuperSampling
        // viewControl

        itemStyle: {
            normal: {
                areaColor: '#fff'
            }
        }
    }
});

echarts.util.merge(Geo3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Geo3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Geo3DModel.prototype, componentLightMixin);

module.exports = Geo3DModel;