var webpack = require('webpack');
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

module.exports = (env, options) => {
    return {
        plugins: [
            new CaseSensitivePathsPlugin({})
        ],
        entry: {
            'echarts-gl': __dirname + '/src/export/all.js'
        },
        optimization: {
            concatenateModules: true
        },
        output: {
            libraryTarget: 'umd',
            library: ['echarts-gl'],
            path: __dirname + '/dist',
            filename: options.mode === 'production' ? '[name].min.js' : '[name].js'
        },
        externals: {
            'echarts/lib/echarts': 'echarts'
        }
    };
};