var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');
var componentShadingMixin = require('../common/componentShadingMixin');
var geo3DModelMixin = require('../../coord/geo3D/geo3DModelMixin');

var Geo3DModel = echarts.extendComponentModel({

    type: 'geo3D',

    layoutMode: 'box',

    coordinateSystem: null,

    optionUpdated: function () {
        var option = this.option;

        option.regions = this.getFilledRegions(option.regions, option.map);

        var dimensions = echarts.helper.completeDimensions(['value'], option.data);
        var list = new echarts.List(dimensions, this);
        list.initData(option.regions);

        var regionModelMap = {};
        list.each(function (idx) {
            var name = list.getName(idx);
            var itemModel = list.getItemModel(idx);
            regionModelMap[name] = itemModel;
        });

        this._regionModelMap = regionModelMap;

        this._data = list;
    },

    getData: function () {
        return this._data;
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
    getFormattedLabel: function (dataIndex, status) {
        var name = this._data.getName(dataIndex);
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
        else {
            return name;
        }
    },

    defaultOption: {

        // itemStyle: {},
        // height,
        // label: {}
        // realisticMaterial
        // baseTexture
        regions: []
    }
});

echarts.util.merge(Geo3DModel.prototype, geo3DModelMixin);

echarts.util.merge(Geo3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Geo3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Geo3DModel.prototype, componentLightMixin);
echarts.util.merge(Geo3DModel.prototype, componentShadingMixin);

module.exports = Geo3DModel;