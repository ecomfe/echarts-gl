import echarts from 'echarts/lib/echarts';
import componentShadingMixin from '../../component/common/componentShadingMixin';
import formatTooltip from '../common/formatTooltip';
import createList from '../common/createList';

var SurfaceSeries = echarts.extendSeriesModel({

    type: 'series.surface',

    dependencies: ['globe', 'grid3D', 'geo3D'],

    visualColorAccessPath: 'itemStyle.color',

    formatTooltip: function (dataIndex) {
        return formatTooltip(this, dataIndex);
    },

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
                var equation = option.equation || {};
                var xOpts = equation.x || {};
                var yOpts = equation.y || {};

                ['x', 'y'].forEach(function (dim) {
                    if (!validateDimension(equation[dim])) {
                        if (__DEV__) {
                            console.error('Invalid equation.%s', dim);
                        }
                        return;
                    }
                });
                if (typeof equation.z !== 'function') {
                    if (__DEV__) {
                        console.error('equation.z needs to be function');
                    }
                    return;
                }
                var xPrecision = getPrecision(xOpts);
                var yPrecision = getPrecision(yOpts);
                for (var y = yOpts.min; y < yOpts.max + yOpts.step * 0.999; y += yOpts.step) {
                    for (var x = xOpts.min; x < xOpts.max + xOpts.step * 0.999; x += xOpts.step) {
                        var x2 = echarts.number.round(Math.min(x, xOpts.max), xPrecision);
                        var y2 = echarts.number.round(Math.min(y, yOpts.max), yPrecision);
                        var z = equation.z(x2, y2);
                        data.push([x2, y2, z]);
                    }
                }
            }
            else {
                var parametricEquation = option.parametricEquation || {};
                var uOpts = parametricEquation.u || {};
                var vOpts = parametricEquation.v || {};

                ['u', 'v'].forEach(function (dim) {
                    if (!validateDimension(parametricEquation[dim])) {
                        if (__DEV__) {
                            console.error('Invalid parametricEquation.%s', dim);
                        }
                        return;
                    }
                });
                ['x', 'y', 'z'].forEach(function (dim) {
                    if (typeof parametricEquation[dim] !== 'function') {
                        if (__DEV__) {
                            console.error('parametricEquation.%s needs to be function', dim);
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
                        var x = parametricEquation.x(u2, v2);
                        var y = parametricEquation.y(u2, v2);
                        var z = parametricEquation.z(u2, v2);
                        data.push([x, y, z, u2, v2]);
                    }
                }
            }
        }

        var dims = ['x', 'y', 'z'];
        if (option.parametric) {
            dims.push('u', 'v');
        }
        var list = createList(this, dims);
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
                color: 'rgba(0,0,0,0.5)',
                width: 1
            }
        },
        /**
         * Generate surface data from z = f(x, y) equation
         */
        equation: {
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

        parametricEquation: {
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

        itemStyle: {
            // Color
        },

        animationDurationUpdate: 500
    }
});

echarts.util.merge(SurfaceSeries.prototype, componentShadingMixin);

export default SurfaceSeries;