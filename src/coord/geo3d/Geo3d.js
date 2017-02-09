var echarts = require('echarts/lib/echarts');

function Geo3D() {
    this._rect = new echarts.graphic.BoundingRect();
}

Geo3D.prototype = {

    constructor: Geo3D,

    setBoundingRect: function (x, y, width, height) {
        var rect = this._rect;
        rect.x = x;
        rect.y = y;
        rect.width = width;
        rect.height = height;
    },

    getBoundingRect: function () {
        return this._rect;
    },

    dataToPoint: function (data) {

    },

    pointToData: function (point) {
    }
};

module.exports = Geo3D;