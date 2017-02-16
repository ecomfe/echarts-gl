var echarts = require('echarts/lib/echarts');
var createAxis3DModel = require('./createAxis3DModel');

var Axis3DModel = echarts.extendComponentModel({

    type: 'cartesian3DAxis',

    axis: null,

    /**
     * @override
     */
    getCoordSysModel: function () {
        return this.ecModel.queryComponents({
            mainType: 'grid',
            index: this.option.gridIndex,
            id: this.option.gridId
        })[0];
    }
});

echarts.helper.mixinAxisModelCommonMethods(Axis3DModel);

function getAxisType(axisDim, option) {
    // Default axis with data is category axis
    return option.type || (option.data ? 'category' : 'value');
}

createAxis3DModel('x', Axis3DModel, getAxisType, {
    axisLine: {
        lineStyle: {
            color: '#f00'
        }
    }
});
createAxis3DModel('y', Axis3DModel, getAxisType, {
    axisLine: {
        lineStyle: {
            color: '#0f0'
        }
    }
});
createAxis3DModel('z', Axis3DModel, getAxisType, {
    axisLine: {
        lineStyle: {
            color: '#00f'
        }
    }
});