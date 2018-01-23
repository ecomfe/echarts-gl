import echarts from 'echarts/lib/echarts';
import componentViewControlMixin from '../../component/common/componentViewControlMixin';
import componentPostEffectMixin from '../../component/common/componentPostEffectMixin';
import componentLightMixin from '../../component/common/componentLightMixin';
import componentShadingMixin from '../../component/common/componentShadingMixin';
import geo3DModelMixin from '../../coord/geo3D/geo3DModelMixin';
import formatUtil from '../../util/format';
import formatTooltip from '../common/formatTooltip';
import geo3DCreator from '../../coord/geo3DCreator';

function transformPolygon(mapbox3DCoordSys, poly) {
    var newPoly = [];
    for (var k = 0; k < poly.length; k++) {
        newPoly.push(mapbox3DCoordSys.dataToPoint(poly[k]));
    }
    return newPoly;
}

var Map3DSeries = echarts.extendSeriesModel({

    type: 'series.map3D',

    layoutMode: 'box',

    coordinateSystem: null,

    visualColorAccessPath: 'itemStyle.color',

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

        // Reset geo.
        this._geo = null;
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

    getRegionModel: function (idx) {
        var name = this.getData().getName(idx);
        return this._regionModelMap[name] || new echarts.Model(null, this);
    },

    getRegionPolygonCoords: function (idx) {
        var coordSys = this.coordinateSystem;
        var name = this.getData().getName(idx);
        if (coordSys.transform) {
            var region = coordSys.getRegion(name);
            return region ? region.geometries : [];
        }
        else {
            if (!this._geo) {
                this._geo = geo3DCreator.createGeo3D(this);
            }
            var region = this._geo.getRegion(name);
            var ret = [];
            for (var k = 0; k < region.geometries.length; k++) {
                var geo = region.geometries[k];
                var interiors = [];
                var exterior = transformPolygon(coordSys, geo.exterior);
                if (interiors && interiors.length) {
                    for (var m = 0; m < geo.interiors.length; m++) {
                        interiors.push(transformPolygon(coordSys, interiors[m]));
                    }
                }
                ret.push({
                    interiors: interiors,
                    exterior: exterior
                });
            }
            return ret;
        }
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
        // Support geo3D, mapbox, maptalks3D
        coordinateSystem: 'geo3D',
        // itemStyle: {},
        // height,
        // label: {}
        data: null
    }
});

echarts.util.merge(Map3DSeries.prototype, geo3DModelMixin);

echarts.util.merge(Map3DSeries.prototype, componentViewControlMixin);
echarts.util.merge(Map3DSeries.prototype, componentPostEffectMixin);
echarts.util.merge(Map3DSeries.prototype, componentLightMixin);
echarts.util.merge(Map3DSeries.prototype, componentShadingMixin);

export default Map3DSeries;