var echarts = require('echarts/lib/echarts');

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
                position: [0.6, 0.6, 1],
                color: '#fff',
                intensity: 1.0
            },
            ambient: {
                color: '#fff',
                intensity: 0.4
            }
        },

        postEffect: {
            enable: false,

            bloom: {
                enable: true,
                intensity: 0.1
            },

            FXAA: {
                // Enable fxaa will cause grid label blurry
                enable: false
            }
        },
        // Temporal super sampling when the picture is still.
        temporalSuperSampling: {
            enable: false
        },

        viewControl: {

            // perspective, orthographic
            projection: 'perspective',

            // If rotate on on init
            autoRotate: false,

            // Start rotating after still for a given time
            // default is 3 seconds
            autoRotateAfterStill: 3,

            // Distance to the surface of globe.
            distance: 150,

            // Min distance to the surface of globe
            minDistance: 40,
            // Max distance to the surface of globe
            maxDistance: 400,

            // Alpha angle for top-down rotation
            // Positive to rotate to top.
            alpha: 0,
            // beta angle for left-right rotation
            // Positive to rotate to right.
            beta: 0
        }
    },

    setView: function (opts) {
        opts = opts || {};
        this.option.viewControl = this.option.viewControl || {};
        if (opts.alpha != null) {
            this.option.viewControl.alpha = opts.alpha;
        }
        if (opts.beta != null) {
            this.option.viewControl.beta = opts.beta;
        }
        if (opts.distance != null) {
            this.option.viewControl.distance = opts.distance;
        }
    }
});

module.exports = Grid3DModel;

