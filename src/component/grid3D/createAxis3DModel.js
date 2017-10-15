import echarts from 'echarts/lib/echarts';
import axisDefault from './axis3DDefault';

var AXIS_TYPES = ['value', 'category', 'time', 'log'];
/**
 * Generate sub axis model class
 * @param {string} dim 'x' 'y' 'radius' 'angle' 'parallel'
 * @param {module:echarts/model/Component} BaseAxisModelClass
 * @param {Function} axisTypeDefaulter
 * @param {Object} [extraDefaultOption]
 */
export default function (dim, BaseAxisModelClass, axisTypeDefaulter, extraDefaultOption) {

    echarts.util.each(AXIS_TYPES, function (axisType) {

        BaseAxisModelClass.extend({

            type: dim + 'Axis3D.' + axisType,

            mergeDefaultAndTheme: function (option, ecModel) {

                var themeModel = ecModel.getTheme();
                echarts.util.merge(option, themeModel.get(axisType + 'Axis'));
                echarts.util.merge(option, this.getDefaultOption());

                option.type = axisTypeDefaulter(dim, option);
            },

            defaultOption: echarts.util.merge(
                echarts.util.clone(axisDefault[axisType + 'Axis']),
                extraDefaultOption || {},
                true
            )
        });
    });

    // TODO
    BaseAxisModelClass.superClass.registerSubTypeDefaulter(
        dim + 'Axis3D',
        echarts.util.curry(axisTypeDefaulter, dim)
    );
};