var echarts = require('echarts/lib/echarts');
var componentShadingMixin = require('../../component/common/componentShadingMixin');

var SurfaceSeries = echarts.extendSeriesModel({

    type: 'series.surface',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'areaStyle.color',

    getInitialData: function (option, ecModel) {
        var data = option.data;

        function validateDimension(dimOpts) {
            return !(isNaN(dimOpts.min) || isNaN(dimOpts.max) || isNaN(dimOpts.step));
        }

        function getPrecision(dimOpts) {
            var getPrecision = echarts.number.getPrecisionSafe;
            return Math.max(
                getPrecision(dimOpts.min), getPrecision(dimOpts.max), getPrecision(dimOpts.step)
            ) + 1;
        }

        if (!data) {
            data = [];

            if (!option.parametric) {
                // From surface equation
                var surfaceEquation = option.surfaceEquation || {};
                var xOpts = surfaceEquation.x || {};
                var yOpts = surfaceEquation.y || {};

                ['x', 'y'].forEach(function (dim) {
                    if (!validateDimension(surfaceEquation[dim])) {
                        if (__DEV__) {
                            console.error('Invalid surfaceEquation.%s', dim);
                        }
                        return;
                    }
                });
                if (typeof surfaceEquation.z !== 'function') {
                    if (__DEV__) {
                        console.error('surfaceEquation.z needs to be function');
                    }
                    return;
                }
                var xPrecision = getPrecision(xOpts);
                var yPrecision = getPrecision(yOpts);
                for (var y = yOpts.min; y < yOpts.max + yOpts.step * 0.999; y += yOpts.step) {
                    for (var x = xOpts.min; x < xOpts.max + xOpts.step * 0.999; x += xOpts.step) {
                        var x2 = echarts.number.round(Math.min(x, xOpts.max), xPrecision);
                        var y2 = echarts.number.round(Math.min(y, yOpts.max), yPrecision);
                        var z = surfaceEquation.z(x2, y2);
                        data.push([x2, y2, z]);
                    }
                }
            }
            else {
                var parametricSurfaceEquation = option.parametricSurfaceEquation || {};
                var uOpts = parametricSurfaceEquation.u || {};
                var vOpts = parametricSurfaceEquation.v || {};

                ['u', 'v'].forEach(function (dim) {
                    if (!validateDimension(parametricSurfaceEquation[dim])) {
                        if (__DEV__) {
                            console.error('Invalid parametricSurfaceEquation.%s', dim);
                        }
                        return;
                    }
                });
                ['x', 'y', 'z'].forEach(function (dim) {
                    if (typeof parametricSurfaceEquation[dim] !== 'function') {
                        if (__DEV__) {
                            console.error('parametricSurfaceEquation.%s needs to be function', dim);
                        }
                        return;
                    }
                });

                var uPrecision = getPrecision(uOpts);
                var vPrecision = getPrecision(vOpts);
                // TODO array intermediate storage is needless.
                for (var v = vOpts.min; v < vOpts.max + vOpts.step * 0.999; v += vOpts.step) {
                    for (var u = uOpts.min; u < uOpts.max + uOpts.step * 0.999; u += uOpts.step) {
                        var u2 = echarts.number.round(Math.min(u, uOpts.max), uPrecision);
                        var v2 = echarts.number.round(Math.min(v, vOpts.max), vPrecision);
                        var x = parametricSurfaceEquation.x(u2, v2);
                        var y = parametricSurfaceEquation.y(u2, v2);
                        var z = parametricSurfaceEquation.z(u2, v2);
                        data.push([x, y, z, u2, v2]);
                    }
                }
            }
        }

        var dims = ['x', 'y', 'z'];
        if (option.parametric) {
            dims.push('u', 'v');
        }
        dims = echarts.helper.completeDimensions(dims, option.data);

        var list = new echarts.List(dims, this);
        list.initData(data);

        return list;
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: -10,

        // Cartesian coordinate system
        grid3DIndex: 0,

        // Surface needs lambert shading to show the difference
        shading: 'lambert',

        // If parametric surface
        parametric: false,

        wireframe: {
            show: true,

            lineStyle: {
                color: '#222',
                width: 1
            }
        },
        /**
         * Generate surface data from z = f(x, y) equation
         */
        surfaceEquation: {
            // [min, max, step]
            x: {
                min: -1,
                max: 1,
                step: 0.1
            },
            y: {
                min: -1,
                max: 1,
                step: 0.1
            },
            z: null
        },

        parametricSurfaceEquation: {
            // [min, max, step]
            u: {
                min: -1,
                max: 1,
                step: 0.1
            },
            v: {
                min: -1,
                max: 1,
                step: 0.1
            },
            // [x, y, z] = f(x, y)
            x: null,
            y: null,
            z: null
        },

        areaStyle: {
            // Color
        }
    }
});

echarts.util.merge(SurfaceSeries.prototype, componentShadingMixin);

module.exports = SurfaceSeries;