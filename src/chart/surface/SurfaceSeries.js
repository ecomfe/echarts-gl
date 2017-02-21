var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.surface',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'areaStyle.normal.color',

    getInitialData: function (option, ecModel) {
        var data = option.data;

        function validateDimension(dimOpts) {
            return !(isNaN(dimOpts.min) || isNaN(dimOpts.max) || isNaN(dimOpts.step));
        }

        if (!data) {
            data = [];

            if (!option.parametric) {
                // From surface equation
                var surfaceEquation = option.surfaceEquation || {};
                var xOpts = surfaceEquation.x || {};
                var yOpts = surfaceEquation.y || {};

                if (!validateDimension(xOpts)) {
                    if (__DEV__) {
                        console.error('Invalid surfaceEquation.x');
                    }
                    return;
                }
                if (!validateDimension(yOpts)) {
                    if (__DEV__) {
                        console.error('Invalid surfaceEquation.y');
                    }
                    return;
                }
                if (typeof surfaceEquation.z !== 'function') {
                    if (__DEV__) {
                        console.error('surfaceEquation.z needs to be function');
                    }
                    return;
                }

                for (var y = yOpts.min; y <= yOpts.max; y += yOpts.step) {
                    for (var x = xOpts.min; x <= xOpts.max; x += xOpts.step) {
                        var z = surfaceEquation.z(x, y);
                        data.push([x, y, z]);
                    }
                }
            }
            else {
                var parametricSurfaceEquation = option.parametricSurfaceEquation || {};
                var uOpts = parametricSurfaceEquation.u || {};
                var vOpts = parametricSurfaceEquation.v || {};

                if (!validateDimension(uOpts)) {
                    if (__DEV__) {
                        console.error('Invalid parametricSurfaceEquation.u');
                    }
                    return;
                }
                if (!validateDimension(vOpts)) {
                    if (__DEV__) {
                        console.error('Invalid parametricSurfaceEquation.v');
                    }
                    return;
                }
                if (typeof parametricSurfaceEquation.f !== 'function') {
                    if (__DEV__) {
                        console.error('parametricSurfaceEquation.f needs to be function');
                    }
                    return;
                }

                for (var v = vOpts.min; v <= vOpts.max; v += vOpts.step) {
                    for (var u = uOpts.min; u <= uOpts.max; u += uOpts.step) {
                        var pt = parametricSurfaceEquation.f(u, v);
                        pt.push(u);
                        pt.push(v);
                        data.push(pt);
                    }
                }
            }
        }

        var dims = ['x', 'y', 'z'];
        if (option.parametric) {
            dims.push('u', 'v');
        }
        // Check row and column

        var list = new echarts.List(dims, this);
        list.initData(data);

        return list;
    },

    defaultOption: {
        coordinateSystem: 'cartesian3D',
        zlevel: 10,

        // Cartesian coordinate system
        xAxis3DIndex: 0,
        yAxis3DIndex: 0,
        zAxis3DIndex: 0,

        // Surface needs lambert shading to show the tangents
        shading: 'lambert',
        // If parametric surface
        parametric: false,
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
            f: null
        },

        areaStyle: {
            normal: {
            }
        }
    }
});