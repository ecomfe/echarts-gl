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

                // TODO array intermediate storage is needless.
                for (var v = vOpts.min; v <= vOpts.max; v += vOpts.step) {
                    for (var u = uOpts.min; u <= uOpts.max; u += uOpts.step) {
                        var x = parametricSurfaceEquation.x(u, v);
                        var y = parametricSurfaceEquation.y(u, v);
                        var z = parametricSurfaceEquation.z(u, v);
                        data.push([x, y, z, u, v]);
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

        // Surface needs lambert shading to show the difference
        shading: 'lambert',

        realisticMaterial: {
            roughness: 0.5,
            metalness: 0
        },
        // If parametric surface
        parametric: false,

        /**
         * If flip surface normals
         */
        flipNormals: 'auto',

        wireframe: {
            show: true,
            lineWidth: 1,
            lineColor: '#222'
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
            normal: {
                // Color
            }
        }
    }
});