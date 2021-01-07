import * as echarts from 'echarts/lib/echarts';
import componentShadingMixin from '../../component/common/componentShadingMixin';
import formatUtil from '../../util/format';
import formatTooltip from '../common/formatTooltip';
import createList from '../common/createList';

var Bar3DSeries = echarts.SeriesModel.extend({

    type: 'series.bar3D',

    dependencies: ['globe'],

    visualStyleAccessPathvisu: 'itemStyle',

    getInitialData: function (option, ecModel) {
        return createList(this);
    },

    getFormattedLabel: function (dataIndex, status, dataType, dimIndex) {
        var text = formatUtil.getFormattedLabel(this, dataIndex, status, dataType, dimIndex);
        if (text == null) {
            text = this.getData().get('z', dataIndex);
        }
        return text;
    },

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

    defaultOption: {

        coordinateSystem: 'cartesian3D',

        globeIndex: 0,

        grid3DIndex: 0,

        zlevel: -10,

        // bevelSize, 0 has no bevel
        bevelSize: 0,
        // higher is smoother
        bevelSmoothness: 2,

        // Bar width and depth
        // barSize: [1, 1],

        // On grid plane when coordinateSystem is cartesian3D
        onGridPlane: 'xy',

        // Shading of globe
        shading: 'color',

        minHeight: 0,

        itemStyle: {
            opacity: 1
        },

        label: {
            show: false,
            distance: 2,
            textStyle: {
                fontSize: 14,
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: 3,
                borderRadius: 3
            }
        },

        emphasis: {
            label: {
                show: true
            }
        },

        animationDurationUpdate: 500
    }
});

echarts.util.merge(Bar3DSeries.prototype, componentShadingMixin);

export default Bar3DSeries;