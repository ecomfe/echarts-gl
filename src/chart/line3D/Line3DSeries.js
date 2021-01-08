import * as echarts from 'echarts/lib/echarts';
import formatTooltip from '../common/formatTooltip';
import createList from '../common/createList';

var Line3DSeries = echarts.SeriesModel.extend({

    type: 'series.line3D',

    dependencies: ['grid3D'],

    visualStyleAccessPath: 'lineStyle',
    visualDrawType: 'stroke',

    getInitialData: function (option, ecModel) {
        return createList(this);
    },

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: -10,

        // Cartesian coordinate system
        grid3DIndex: 0,

        lineStyle: {
            width: 2
        },

        animationDurationUpdate: 500
    }
});

export default Line3DSeries;