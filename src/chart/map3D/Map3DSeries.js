var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../../component/common/componentViewControlMixin');
var componentPostEffectMixin = require('../../component/common/componentPostEffectMixin');
var componentLightMixin = require('../../component/common/componentLightMixin');
var componentShadingMixin = require('../../component/common/componentShadingMixin');
var geo3DModelMixin = require('../../coord/geo3D/geo3DModelMixin');

var Map3DModel = echarts.extendSeriesModel({

    type: 'series.map3D',

    layoutMode: 'box',

    coordinateSystem: null,

    getInitialData: function (option) {
        option.data = this.getFilledRegions(option.data, option.map);

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
    getFormattedLabel: function (dataIndex, status) {
        var text = Map3DModel.superCall(this, 'getFormattedLabel', dataIndex, status);
        if (text == null) {
            text = this.getData().getName(dataIndex);
        }
        return text;
    },

    defaultOption: {

        // itemStyle: {},
        // height,
        // label: {}
        data: null
    }
});

echarts.util.merge(Map3DModel.prototype, geo3DModelMixin);

echarts.util.merge(Map3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Map3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Map3DModel.prototype, componentLightMixin);
echarts.util.merge(Map3DModel.prototype, componentShadingMixin);

module.exports = Map3DModel;