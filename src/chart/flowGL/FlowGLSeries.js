import * as echarts from 'echarts/lib/echarts';

export default echarts.SeriesModel.extend({

    type: 'series.flowGL',

    dependencies: ['geo', 'grid', 'bmap'],

    visualStyleAccessPath: 'itemStyle',

    getInitialData: function (option, ecModel) {
        var coordType = this.get('coordinateSystem');
        // TODO hotfix for the bug in echarts that get coord dimensions is undefined.
        var coordSysDimensions = coordType === 'geo' ? ['lng', 'lat']
            : (echarts.getCoordinateSystemDimensions(coordType) || ['x', 'y']);
        if (process.env.NODE_ENV !== 'production') {
            if (coordSysDimensions.length > 2) {
                throw new Error('flowGL can only be used on 2d coordinate systems.');
            }
        }
        coordSysDimensions.push('vx', 'vy');
        var dimensions = echarts.helper.createDimensions(this.getSource(), {
            coordDimensions: coordSysDimensions,
            encodeDefine: this.get('encode'),
            dimensionsDefine: this.get('dimensions')
        });
        var data = new echarts.List(dimensions, this);
        data.initData(this.getSource());
        return data;
    },

    defaultOption: {
        coordinateSystem: 'cartesian2d',
        zlevel: 10,

        supersampling: 1,
        // 128x128 particles
        particleType: 'point',

        particleDensity: 128,
        particleSize: 1,
        particleSpeed: 1,

        particleTrail: 2,

        colorTexture: null,

        gridWidth: 'auto',
        gridHeight: 'auto',

        itemStyle: {
            color: '#fff',
            opacity: 0.8
        }
    }
});