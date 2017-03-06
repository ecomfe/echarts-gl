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

        this._regionModelMap = (option.regions || []).reduce(function (obj, regionOpt) {
            if (regionOpt.name) {
                obj[regionOpt.name] = new echarts.Model(regionOpt, self);
            }
            return obj;
        }, {});

        // this.updateSelectedMap(option.regions);
    },

    getRegionModel: function (name) {
        return this._regionModelMap[name] || new echarts.Model(null, this);
    },

    /**
     * Format label
     * @param {string} name Region name
     * @param {string} [status='normal'] 'normal' or 'emphasis'
     * @return {string}
     */
    getFormattedLabel: function (name, status) {
        var regionModel = this.getRegionModel(name);
        var formatter = regionModel.get('label.' + status + '.formatter');
        var params = {
            name: name
        };
        if (typeof formatter === 'function') {
            params.status = status;
            return formatter(params);
        }
        else if (typeof formatter === 'string') {
            var serName = params.seriesName;
            return formatter.replace('{a}', serName != null ? serName : '');
        }
    },

    defaultOption: {

        show: true,

        zlevel: -10,

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

        label: {
            show: false,
            // Distance in 3d space.
            distance: 2,

            textStyle: {
                color: '#000'
            }
        },
        // labelLine

        // itemStyle: {},
        // height,
        // label: {}
        regions: [],

        // light
        // postEffect
        // temporalSuperSampling
        // viewControl

        itemStyle: {
            areaColor: '#fff',
            borderWidth: 0,
            borderColor: '#333'
        }
    }
});

echarts.util.merge(Geo3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Geo3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Geo3DModel.prototype, componentLightMixin);

module.exports = Geo3DModel;