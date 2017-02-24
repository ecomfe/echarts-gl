var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

var Grid3DModel = echarts.extendComponentModel({

    type: 'grid3D',

    dependencies: ['xAxis3D', 'yAxis3D', 'zAxis3D'],

    defaultOption: {

        zlevel: 10,

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        // Dimension of grid3D
        boxWidth: 100,
        boxHeight: 100,
        boxDepth: 100,

        light: {
            main: {
                // Alpha angle for top-down rotation
                // Positive to rotate to top.
                alpha: 30,
                // beta angle for left-right rotation
                // Positive to rotate to right.
                beta: 40
            },
            ambient: {
                intensity: 0.4
            }
        },

        viewControl: {
            autoRotate: false,

            // Distance to the surface of grid3D.
            distance: 200,

            // Min distance to the surface of grid3D
            minDistance: 40,
            // Max distance to the surface of grid3D
            maxDistance: 400
        }
    }
});

echarts.util.merge(Grid3DModel.prototype, componentViewControlMixin);
echarts.util.merge(Grid3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Grid3DModel.prototype, componentLightMixin);

module.exports = Grid3DModel;

