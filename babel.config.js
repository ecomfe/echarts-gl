module.exports = {
    plugins: [
        ['babel-plugin-module-resolver', {
            alias: {
                'echarts/esm': 'echarts/lib',
                'zrender/esm': 'zrender/lib',
                'echarts/echarts.blank': 'echarts/index.blank'
            }
        }],
        ['@babel/plugin-transform-modules-commonjs', {
            noInterop: true
        }]
    ]
};