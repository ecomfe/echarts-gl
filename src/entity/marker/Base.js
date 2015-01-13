/**
 * Marker base class. All the markers will be rendered in WebGL
 * 
 * @module echarts-x/entity/marker/Base
 * @author Yi Shen(https://github.com/pissang)
 */

define(function (require) {

    /**
     * @constructor
     * @alias module:echarts-x/entity/marker/Base
     * @param {module:echarts-x/chart/base3d} chart
     */
    var MarkerBase = function (chart) {
        this.chart = chart;
    };

    /**
     * Set marker series and prepare the geometry data
     * @param {Object} series
     * @param {number} seriesIndex
     */
    MarkerBase.prototype.setSeries = function (series, seriesIndex) {};

    /**
     * Clear marker geometry data
     */
    MarkerBase.prototype.clear = function () {};

    /**
     * Callback of each frame
     * @param  {number} deltaTime frame time in milleseconds
     */
    MarkerBase.prototype.onframe = function (deltaTime) {};

    /**
     * Get marker root scene node
     * @return {qtek.Node}
     */
    MarkerBase.prototype.getSceneNode = function () {};

    /**
     * Disipose all the markers in a single series
     */
    MarkerBase.prototype.dispose = function () {
        var renderer = this.chart.baseLayer.renderer;
        renderer.dispose(this.getSceneNode(), true, true);
    }

    return MarkerBase;
});