/**
 * Base class for all 3d components
 *
 * @module echarts-x/component/base3d
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {

    'use strict';

    var ComponentBase = require('echarts/component/base');
    var Layer3D = require('../core/Layer3D');
    var zrUtil = require('zrender/tool/util');

    /**
     * @constructor
     * @alias module:echarts-x/component/base3d
     * @extends module:echarts/component/base
     */
    var Base3D = function (ecTheme, messageCenter, zr, option, myChart) {

        ComponentBase.call(this, ecTheme, messageCenter, zr, option, myChart);

        var zlevel = this.getZlevelBase();

        /**
         * @type {module:echarts-x/core/Layer3D}
         */
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

    zrUtil.inherits(Base3D, ComponentBase);

    return Base3D;
});