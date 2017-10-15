import echarts from 'echarts/lib/echarts';
import createAxis3DModel from './createAxis3DModel';

var Axis3DModel = echarts.extendComponentModel({

    type: 'cartesian3DAxis',

    axis: null,

    /**
     * @override
     */
    getCoordSysModel: function () {
        return this.ecModel.queryComponents({
            mainType: 'grid3D',
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
    name: 'X'
});
createAxis3DModel('y', Axis3DModel, getAxisType, {
    name: 'Y'
});
createAxis3DModel('z', Axis3DModel, getAxisType, {
    name: 'Z'
});