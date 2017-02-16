var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');

var Lines3DGeometry = require('../../util/geometry/Lines3D');

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

        this._mesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({
                expandLine: true
            })
        });
    },

    render: function (grid3DModel, ecModel, api) {

        var cartesian = grid3DModel.coordinateSystem;

        var control = this._control;
        control.setCamera(cartesian.viewGL.camera);

        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);
    },

    _renderAxis: function () {

    }
});