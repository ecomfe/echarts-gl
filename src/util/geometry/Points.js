/**
 * Geometry collecting cloud points data
 *
 * @module echarts-x/util/geometry/Points
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {
    
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');

    /**
     * @constructor
     * @alias module:echarts-x/util/geometry/Points
     * @extends qtek.DynamicGeometry
     */
    var PointsGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                size: new Geometry.Attribute('size', 'float', 1, '', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true)
            }
        }
    },
    /** @lends module:echarts-x/util/geometry/Points.prototype */
    {

        /**
         * Clear all points
         */
        clearPoints: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.color.value.length = 0;
            attributes.size.value.length = 0;
        },

        /**
         * Add a point
         * @param {qtek.math.Vector3} position
         * @param {Array.<number>} color
         * @param {number} size
         */
        addPoint: function (position, color, size) {
            var attributes = this.attributes;

            attributes.position.value.push(position._array);
            attributes.color.value.push(color);
            attributes.size.value.push(size);
        }
    });

    return PointsGeometry;
});