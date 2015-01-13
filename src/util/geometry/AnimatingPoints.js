/**
 * Geometry collecting animating cloud points data
 * 
 * @module echarts-x/util/geometry/AnimatingPoints
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {
    
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');

    /**
     * @constructor
     * @alias module:echarts-x/util/geometry/AnimatingPoints
     * @extends qtek.DynamicGeometry
     */
    var AnimatingPointsGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                size: new Geometry.Attribute('size', 'float', 1, '', true),
                delay: new Geometry.Attribute('delay', 'float', 1, '',true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true),
            }
        }
    },
    /** @lends module:echarts-x/util/geometry/AnimatingPoints.prototype */
    {

        /**
         * Clear all points
         */
        clearPoints: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.color.value.length = 0;
            attributes.size.value.length = 0;
            attributes.delay.value.length = 0;
        },

        /**
         * Add a point
         * @param {qtek.math.Vector3} position Point position
         * @param {Array.<number>} color Point color
         * @param {number} size Point size
         * @param {number} delayTime Each point has a different animation delay time to produce a random animation effect
         */
        addPoint: function (position, color, size, delayTime) {
            var attributes = this.attributes;

            attributes.position.value.push(position._array);
            attributes.color.value.push(color);
            attributes.size.value.push(size);
            attributes.delay.value.push(delayTime);
        }
    });

    return AnimatingPointsGeometry;
});