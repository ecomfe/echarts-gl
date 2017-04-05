var echarts = require('echarts/lib/echarts');
var componentViewControlMixin = require('../common/componentViewControlMixin');
var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

var Grid3DModel = echarts.extendComponentModel({

    type: 'grid3D',

    dependencies: ['xAxis3D', 'yAxis3D', 'zAxis3D'],

    defaultOption: {

        show: true,

        zlevel: -10,

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        environment: 'auto',

        // Dimension of grid3D
        boxWidth: 100,
        boxHeight: 100,
        boxDepth: 100,

        // Common axis options.
        axisPointer: {
            show: true,
            lineStyle: {
                color: 'rgba(0, 0, 0, 0.8)',
                width: 1
            },

            label: {
                show: true,
                // (dimValue: number, value: Array) => string
                formatter: null,

                margin: 8,
                // backgroundColor: '#ffbd67',
                // borderColor: '#000',
                // borderWidth: 0,

                textStyle: {
                    // borderColor: '#fff',
                    // borderWidth: 3,
                    fontSize: 16
                    // Default with lineStyle.color
                    // color: '#000'
                }
            }
        },

        axisLine: {
            show: true,
            lineStyle: {
                color: '#333',
                width: 2,
                type: 'solid'
            }
        },

        axisTick: {
            show: true,
            inside: false,
            length: 3,
            lineStyle: {
                width: 1
            }
        },
        axisLabel: {
            show: true,
            inside: false,
            rotate: 0,
            margin: 8,
            textStyle: {
                fontSize: 12
            }
        },
        splitLine: {
            show: true,
            lineStyle: {
                color: ['#ccc'],
                width: 1,
                type: 'solid'
            }
        },
        splitArea: {
            show: false,
            areaStyle: {
                color: ['rgba(250,250,250,0.3)','rgba(200,200,200,0.3)']
            }
        },

        // Light options
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
            // Small damping for precise control.
            // damping: 0.1,

            // Alpha angle for top-down rotation
            // Positive to rotate to top.
            alpha: 5,
            // beta angle for left-right rotation
            // Positive to rotate to right.
            beta: 40,

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

