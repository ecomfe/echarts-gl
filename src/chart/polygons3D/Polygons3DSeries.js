import * as echarts from 'echarts/lib/echarts';
import componentShadingMixin from '../../component/common/componentShadingMixin';

function transformPolygon(coordSys, poly) {
    var ret = [];
    for (var i = 0; i < poly.length; i++) {
        ret.push(coordSys.dataToPoint(poly[i]));
    }
    return ret;
}

var Polygons3DSeries = echarts.SeriesModel.extend({

    type: 'series.polygons3D',

    getRegionModel: function (idx) {
        return this.getData().getItemModel(idx);
    },

    getRegionPolygonCoords: function (idx) {
        var coordSys = this.coordinateSystem;
        var itemModel = this.getData().getItemModel(idx);
        var coords = itemModel.option instanceof Array
            ? itemModel.option : itemModel.getShallow('coords');
        if (!itemModel.get('multiPolygon')) {
            coords = [coords];
        }
        // TODO Validate
        var out = [];
        for (var i = 0; i < coords.length; i++) {
            // TODO Convert here ?
            var interiors = [];
            for (var k = 1; k < coords[i].length; k++) {
                interiors.push(transformPolygon(coordSys, coords[i][k]));
            }
            out.push({
                exterior: transformPolygon(coordSys, coords[i][0]),
                interiors: interiors
            });
        }
        return out;
    },

    getInitialData: function (option) {
        var polygonsData = new echarts.List(['value'], this);
        polygonsData.hasItemOption = false;
        polygonsData.initData(option.data, [], function (dataItem, dimName, dataIndex, dimIndex) {
            // dataItem is simply coords
            if (dataItem instanceof Array) {
                return NaN;
            }
            else {
                polygonsData.hasItemOption = true;
                var value = dataItem.value;
                if (value != null) {
                    return value instanceof Array ? value[dimIndex] : value;
                }
            }
        });

        return polygonsData;
    },

    defaultOption: {

        show: true,

        data: null,

        multiPolygon: false,

        progressiveThreshold: 1e3,
        progressive: 1e3,

        zlevel: -10,

        label: {
            show: false,
            // Distance in 3d space.
            distance: 2,

            textStyle: {
                fontSize: 20,
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: 3,
                borderRadius: 4
            }
        },

        itemStyle: {
            color: '#fff',
            borderWidth: 0,
            borderColor: '#333'
        },

        emphasis: {
            itemStyle: {
                color: '#639fc0'
            },
            label: {
                show: true
            }
        }
    }
});

echarts.util.merge(Polygons3DSeries.prototype, componentShadingMixin);

export default Polygons3DSeries;