import * as echarts from 'echarts/lib/echarts';

var Axis3DModel = echarts.ComponentModel.extend({

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

export default Axis3DModel;