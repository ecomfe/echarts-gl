var echarts = require('echarts/lib/echarts');

echarts.extendSeriesModel({

    type: 'series.flowGL',

    dependencies: ['geo', 'grid', 'bmap'],

    visualColorAccessPath: 'itemStyle.color',

    getInitialData: function (option, ecModel) {
        var coordSysDimensions = echarts.getCoordinateSystemDimensions(this.get('coordinateSystem')) || ['x', 'y'];
        if (__DEV__) {
            if (coordSysDimensions.length > 2) {
                throw new Error('flowGL can only be used on 2d coordinate systems.')    
            }
        }
        coordSysDimensions.push('vx', 'vy');
        var dimensions = echarts.helper.completeDimensions(coordSysDimensions, option.data, {
            encodeDef: this.get('encode'),
            dimsDef: this.get('dimensions')
        });
        var data = new echarts.List(dimensions, this);
        data.initData(option.data);
        return data;
    },

    defaultOption: {
        coordinateSystem: 'cartesian2d',
        zlevel: 10
    }
});