define(function (require) {

    'use strict';

    var Layer3D = require('../core/Layer3D');

    var Base3D = function () {

        var zlevel = this.getZlevelBase();

        this.baseLayer = new Layer3D(zlevel, this.zr.painter);

        this.zr.painter.insertLayer(zlevel, this.baseLayer);

        this.zr.animation.bind('frame', this.onframe, this);
    };

    Base3D.prototype = {

        constructor: Base3D,

        onframe: function () {},

        dispose: function () {
            this.zr.animation.unbind('frame', this.onframe);
        }
    };

    return Base3D;
});