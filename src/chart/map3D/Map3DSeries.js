var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../../component/common/componentViewControlMixin');
var componentPostEffectMixin = require('../../component/common/componentPostEffectMixin');
var componentLightMixin = require('../../component/common/componentLightMixin');
var componentShadingMixin = require('../../component/common/componentShadingMixin');
var geo3DModelMixin = require('../../coord/geo3D/geo3DModelMixin');
var formatUtil = require('../../util/format');
var formatTooltip = require('../common/formatTooltip');

var Map3DModel = echarts.extendSeriesModel({

    type: 'series.map3D',

    layoutMode: 'box',

    coordinateSystem: null,

    visualColorAccessPath: 'itemStyle.areaColor',

    optionUpdated: function (newOpt) {
        newOpt = newOpt || {};
        var coordSysType = this.get('coordinateSystem');
        if (coordSysType == null || coordSysType === 'geo3D') {
            return;
        }

        if (__DEV__) {
            var propsNeedToCheck = [
                'left', 'top', 'width', 'height',
                'boxWidth', 'boxDepth', 'boxHeight',
                'light', 'viewControl', 'postEffect', 'temporalSuperSampling',
                'environment', 'groundPlane'
            ];
            var ignoredProperties = [];
            propsNeedToCheck.forEach(function (propName) {
                if (newOpt[propName] != null) {
                    ignoredProperties.push(propName);
                }
            });
            if (ignoredProperties.length) {
                console.warn(
                    'Property %s in map3D series will be ignored if coordinate system is %s',
                    ignoredProperties.join(', '), coordSysType
                );
            }
        }

        if (this.get('groundPlane.show')) {
            // Force disable groundPlane if map3D has other coordinate systems.
            this.option.groundPlane.show = false;
        }
    },

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

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
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
        var text = formatUtil.getFormattedLabel(this, dataIndex, status);
        if (text == null) {
            text = this.getData().getName(dataIndex);
        }
        return text;
    },

    defaultOption: {
        // Support geo3D, mapbox
        coordinateSystem: 'geo3D',
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