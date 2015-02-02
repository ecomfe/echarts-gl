> ECharts 提供了使用 WebGL 绘制的 markLine。并且在大部分配置项上兼容 [ECharts](http://echarts.baidu.com/doc/doc.html#SeriesMarkLine)。

##Simple Example - From north to south
```javascript
var option = {
    series: [{
        markLine: [{
            data: [{
                geoCoord: [0, -89]
            }, {
                geoCoord: [0, 89]
            }]
        }]
    }]
};
```

或者你可以查看使用 markLine 可视化全球飞行路线的[示例](../../example/map3d_flights.html)

##MarkLine Option

###effect
```javascript
effect: {
    show: false,
    scaleSize: 2
}
```
markLine 动画效果配置

###distance
```javascript
distance: 1
```
map3d 中 `distance` 表示标注离球体表面的距离。球体半径为 100。也可以细化到在 data 级别配置 `distance`。

###itemStyle
```
itemStyle: {
    normal: {
        // 线的颜色默认是取 legend 的颜色
        // color: null
        // 线宽，这里线宽是屏幕的像素大小
        width: 1
        // 线的透明度
        opacity: 0.2
    }
}
```

ECharts-X 中 `markLine` 的 `itemStyle` 目前不支持 `emphasis` 的样式。


###data