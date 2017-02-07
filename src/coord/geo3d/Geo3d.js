var echarts = require('echarts/lib/echarts');

function Geo3d() {
    this._rect = new echarts.graphic.BoundingRect();
}

Geo3d.prototype = {

    constructor: Geo3d,

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

module.exports = Geo3d;