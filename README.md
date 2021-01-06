# ECHARTS-GL

ECharts-GL is an extension pack of [Apache ECharts (incubating)](http://echarts.apache.org/), which providing 3D plots, globe visualization and WebGL acceleration.


## Docs

+ [Option Manual](https://echarts.apache.org/zh/option-gl.html)

+ [Gallery](http://gallery.echartsjs.com/explore.html#tags=echarts-gl)

## Installing

Use npm and webpack

```bash
npm install echarts
npm install echarts-gl
```

```js
require('echarts');
require('echarts-gl');
```

Use in script.
```html
<script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-gl/dist/echarts-gl.min.js"></script>
```

NOTE:

ECharts GL 2.x is compatible with ECharts 5.x.
ECharts GL 1.x is compatible with ECharts 4.x.

## Basic Usage

```js
var chart = echarts.init(document.getElementById('main'));
chart.setOption({
    grid3D: {},
    xAxis3D: {},
    yAxis3D: {},
    zAxis3D: {},
    series: [{
        type: 'scatter3D',
        symbolSize: 50,
        data: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
        itemStyle: {
            opacity: 1
        }
    }]
})
```

## License

ECharts-GL is available under the BSD license.
