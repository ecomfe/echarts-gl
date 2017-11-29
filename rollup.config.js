import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
    input: 'src/echarts-gl.js',
    plugins: [
        commonjs(),
        nodeResolve()
    ],
    // sourceMap: true,
    output: [
        {
            format: 'umd',
            name: 'echarts-gl',
            file: 'dist/echarts-gl.js',
            paths: {
                'echarts/lib/echarts': 'echarts'
            },
            external: ['echarts']
        }
    ]
};