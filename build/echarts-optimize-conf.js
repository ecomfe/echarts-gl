exports.modules = {
    main: {
        name: 'echarts-x/echarts-x',
        exclude: ['echarts', 'zrender']
    },
    parts: [
        {
            name: 'echarts-x/chart/map3d',
            exclude: ['echarts', 'zrender'],
            includeShallow: ['zrender/shape/ShapeBundle'],
            weight: 90
        }
    ]
};

exports.amd = {
    baseUrl: process.cwd(),
    packages: [{
        name: 'echarts-x',
        location: '../src',
        main: 'echarts-x'
    }, {
        name: 'echarts',
        location: '../../echarts/src',
        main: 'echarts'
    }, {
        name: 'zrender',
        location: '../../zrender/src',
        main: 'zrender'
    }, {
        name: 'qtek',
        location: '../../qtek/src',
        main: 'qtek.amd'
    }]
};

exports.name = 'echarts-x';
exports.includeEsl = false;