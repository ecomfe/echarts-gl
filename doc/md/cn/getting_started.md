ECharts-X 的定位是 ECharts 的扩展，因此在使用和配置项上跟 ECharts 上尽量保持一致，可以使用 ECharts 中的组件比如`legend`, `dataRange`。也可以和 ECharts 中的折柱饼图混搭（这个暂时还未支持）。

##获取 ECharts-X


##引入 ECharts-X

##A Simple Example

```javascript
var chart = echarts.init(document.getElementById('main'));

chart.setOption({
    title: {
        text: 'A Simple Example'
    },
    series: [{
        type: 'map3d',
        // Empty data
        data: [{}]
    }]
})
```

##访问示例代码

##判断浏览器是否支持 WebGL

ECharts-X 需要浏览器支持 WebGL，目前流行的 PC 浏览器中支持 WebGL 的有 Chrome, Firefox, Safari, IE11。移动浏览器支持的较少，iOS 8中的 Safari 是支持的。

可以通过以下脚本判断浏览器是否支持 WebGL

```javascript
try {
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        throw;
    }
} catch (e) {
    // 浏览器不支持 WebGL
}
```

如果浏览器不支持 WebGL, `map3d`可以降级到使用 ECharts 的 `map`。