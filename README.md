# ECHARTS-GL

<a href="http://echarts.apache.org/">
    <img style="vertical-align: top;" src="./asset/logo.png?raw=true" alt="logo" height="50px">
</a>


ECharts-GL is an extension pack of [Apache ECharts](http://echarts.apache.org/), which providing 3D plots, globe visualization and WebGL acceleration.


## Docs

+ [Option Manual](https://ecomfe.github.io/echarts-doc/public/cn/option-gl.html)

+ [Gallery](https://echarts.apache.org/explore.html#tags=echarts-gl)

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

You can also use the released bundle. Which is [Universal Module Definition](https://github.com/umdjs/umd), supports AMD, CommonJS and vanilla environments.

For example, load it by script tag.
```html
<script src="dist/echarts.min.js"></script>
<script src="dist/echarts-gl.min.js"></script>
```

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

## Dependencies

Built on top of

+ [ECharts](https://github.com/apache/echarts)

+ Canvas library [zrender](https://github.com/ecomfe/zrender)

+ WebGL library [qtek](https://github.com/pissang/qtek)。

## License

ECharts-GL is available under the BSD license.
