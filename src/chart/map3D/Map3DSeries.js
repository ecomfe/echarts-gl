var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../../component/common/componentViewControlMixin');
var componentPostEffectMixin = require('../../component/common/componentPostEffectMixin');
var componentLightMixin = require('../../component/common/componentLightMixin');

var Map3DModel = echarts.extendSeriesModel({

    type: 'series.map3D',

    layoutMode: 'box',

    coordinateSystem: null,

    getInitialData: function (option) {
        var dimensions = echarts.helper.completeDimensions(['value'], option.data);
        var list = new echarts.List(dimensions, this);
        list.initData(option.data);

        var regionModelMap = {};
        list.each(function (idx) {
            var name = list.getName(idx);
            var itemModel = list.getItemModel(idx);
            regionModelMap[name] = itemModel;
        });

        this._regionModelMap = regionModelMap;

        return list;
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
        var idx = this.getData().indexOfName(name);
        return Map3DModel.superCall(this, 'getFormattedLabel', idx, status);
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

        label: {
            normal: {
                show: false,
                // Distance in 3d space.
                distance: 0.3,

                backgroundColor: 'transparent',
                borderColor: '#000',
                borderWidth: 0,
                // Padding in px
                padding: [2, 3],

                textStyle: {
                    color: '#000'
                }
            }
        },
        // labelLine

        viewControl: {
            alpha: 40,
            beta: 0,
            distance: 100
        },

        // itemStyle: {},
        // height,
        // label: {}
        data: null,

        // light
        // postEffect
        // temporalSuperSampling
        // viewControl

        itemStyle: {
            normal: {
                areaColor: '#fff',
                borderWidth: 0,
                borderColor: '#333'
            }
        }
    }
});

echarts.util.merge(Map3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Map3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Map3DModel.prototype, componentLightMixin);

module.exports = Map3DModel;