import * as echarts from 'echarts/lib/echarts';

function Axis3D(dim, scale, extent) {

    echarts.Axis.call(this, dim, scale, extent);
}

Axis3D.prototype = {
    constructor: Axis3D,

    getExtentMin: function () {
        var extent = this._extent;
        return Math.min(extent[0], extent[1]);
    },

    getExtentMax: function () {
        var extent = this._extent;
        return Math.max(extent[0], extent[1]);
    },

    calculateCategoryInterval: function () {
        // TODO consider label length
        return Math.floor(this.scale.count() / 8);
    }
};

echarts.util.inherits(Axis3D, echarts.Axis);

export default Axis3D;