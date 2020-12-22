var webpack = require('webpack');
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

module.exports = (env, options) => {
    return {
        plugins: [
            new CaseSensitivePathsPlugin({}),
            new webpack.DefinePlugin({
                'typeof __DEV__': JSON.stringify('boolean'),
                __DEV__: options.mode === 'production' ? false : true
            })
        ],
        entry: {
            'echarts-gl': __dirname + '/index.js'
        },
        output: {
            libraryTarget: 'umd',
            library: ['echarts-gl'],
            path: __dirname + '/dist',
            filename: options.mode === 'production' ? '[name].min.js' : '[name].js'
        },
        externals: {
            'echarts/esm/echarts': 'echarts'
        }
    };
};