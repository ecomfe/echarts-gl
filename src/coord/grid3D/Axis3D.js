var echarts = require('echarts/lib/echarts');

function Axis3D(dim, scale, extent) {

    echarts.Axis.call(this, dim, scale, extent);
}

Axis3D.prototype = {
    constructor: Axis3D
};

echarts.util.inherits(Axis3D, echarts.Axis);

module.exports = Axis3D;