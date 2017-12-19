var PROD = process.argv.indexOf('-p') >= 0;
var webpack = require('webpack');
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

module.exports = {
    plugins: [
        // new webpack.optimize.ModuleConcatenationPlugin(),
        new CaseSensitivePathsPlugin({}),
        new webpack.DefinePlugin({
            'typeof __DEV__': JSON.stringify('boolean'),
            __DEV__: PROD ? false : true
        })
    ],
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