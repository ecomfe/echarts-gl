var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.scatter3D',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    // Row count and column count of data.
    rowCount: 0,

    columnCount: 0,

    getInitialData: function (option, ecModel) {
        var data = option.data;
        if (!data) {
            data = [];
            // From surface equation
            var surfaceEquation = option.surfaceEquation || {};
            var xOpts = surfaceEquation.x || {};
            var yOpts = surfaceEquation.y || {};

            if (isNaN(xOpts.min) || isNaN(xOpts.max) || isNaN(xOpts.step)) {
                if (__DEV__) {
                    console.error('Invalid surfaceEquation.x');
                }
                return;
            }
            if (isNaN(yOpts.min) || isNaN(yOpts.max) || isNaN(yOpts.step)) {
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

            for (var y = 0; y <= yOpts.max; y += yOpts.step) {
                for (var x = 0; x <= xOpts.max; x += xOpts.step) {
                    var z = surfaceEquation.z(x, y);
                    data.push([x, y, z]);
                }
            }
        }

        // Check row and column

        var list = new echarts.List(['x', 'y', 'z'], this);
        list.initData(option.data);

        var prevX = -Infinity;
        var rowCount = 0;
        var columnCount = 0;
        var prevRowCount = 0;
        // Check data format
        for (var i = 0; i < list.count(); i++) {
            var x = list.get('x', i);
            if (x < prevX) {
                if (prevRowCount !== rowCount) {
                    if (__DEV__) {
                        console.error('Invalid data. data should be a row major 2d array.')
                    }
                    return;
                }
                // A new row.
                prevRowCount = rowCount;
                rowCount = 0;
                columnCount++;
            }
            prevX = x;
            rowCount++;
        }

        this.rowCount = rowCount;
        this.columnCount = columnCount;

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