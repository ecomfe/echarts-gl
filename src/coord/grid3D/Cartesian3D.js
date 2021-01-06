import * as echarts from 'echarts/lib/echarts';
import Cartesian from 'echarts/lib/coord/cartesian/Cartesian';

function Cartesian3D(name) {

    Cartesian.call(this, name);

    this.type = 'cartesian3D';

    this.dimensions = ['x', 'y', 'z'];

    this.size = [0, 0, 0];
}

Cartesian3D.prototype = {

    constructor: Cartesian3D,


    model: null,

    containPoint: function (point) {
        return this.getAxis('x').contain(point[0])
            && this.getAxis('y').contain(point[2])
            && this.getAxis('z').contain(point[1]);
    },

    containData: function (data) {
        return this.getAxis('x').containData(data[0])
            && this.getAxis('y').containData(data[1])
            && this.getAxis('z').containData(data[2]);
    },

    dataToPoint: function (data, out, clamp) {
        out = out || [];
        out[0] = this.getAxis('x').dataToCoord(data[0], clamp);
        out[2] = this.getAxis('y').dataToCoord(data[1], clamp);
        out[1] = this.getAxis('z').dataToCoord(data[2], clamp);
        return out;
    },

    pointToData: function (point, out, clamp) {
        out = out || [];
        out[0] = this.getAxis('x').coordToData(point[0], clamp);
        out[1] = this.getAxis('y').coordToData(point[2], clamp);
        out[2] = this.getAxis('z').coordToData(point[1], clamp);
        return out;
    }
};

echarts.util.inherits(Cartesian3D, Cartesian);

export default Cartesian3D;