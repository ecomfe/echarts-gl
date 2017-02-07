var PROD = process.argv.indexOf('-p') >= 0;

module.exports = {
    entry: {
        'echarts-gl': __dirname + '/index.js'
    },
    output: {
        libraryTarget: 'umd',
        library: ['echarts-gl'],
        path: __dirname + '/dist',
        filename: PROD ? '[name].min.js' : '[name].js'
    },
    externals: {
        'echarts/lib/echarts': 'echarts'
    }
};