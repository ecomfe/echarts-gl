var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');

echarts.extendComponentView({
    type: 'xAxis3D'
});
echarts.extendComponentView({
    type: 'yAxis3D'
});
echarts.extendComponentView({
    type: 'zAxis3D'
});

module.exports = echarts.extendComponentView({

    type: 'grid3D',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();
    },

    render: function (grid3DModel, ecModel, api) {

        var cartesian = grid3DModel.coordinateSystem;

    },

    _renderAxis: function () {

    }
});