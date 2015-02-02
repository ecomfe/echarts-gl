> ECharts-X 中的柱形标注 markBar 是从 markPoint 衍生出来，除了 markPoint 能够展示的颜色和大小维度，在三维空间中使用柱形扩展了高度维度来表示数据的大小。比如下面示例中通过柱形的高度表示同一份人口密度分布数据，跟使用 markPoint 仅通过颜色区分相比更加直观和清晰。

##Example - World Population
```javascript
option = {
    title : {
        text: 'Gridded Population of the World (2000)',
        x:'center',
        y:'top',
        textStyle: {
            color: 'white'
        }
    },
    tooltip: {
        formatter: '{b}'
    },
    dataRange: {
        min: 0,
        max: max,
        text:['High','Low'],
        realtime: false,
        calculable : true,
        color: ['red','yellow','lightskyblue']
    },
    series: [{
        type: 'map3d',
        mapType: 'world',
        mapBackgroundColor: 'rgba(0, 150, 200, 0.5)',
        data: [{}],
        itemStyle: {
            normal: {
                areaStyle: {
                    color: 'rgba(0, 150, 200, 0.8)'
                },
                borderColor: '#777'
            }
        },
        markBar: {
            barSize: 0.6,
            data: populationData
        },
        autoRotate: true,
    }]
}
```

##Mark Bar Option

###barSize
```javascript
barSize: 1
```
柱形的宽。对应 markPoint 中的 `symbolSize`。可以细化到在 data 级别配置 `barSize`。

###distance
```javascript
distance: 1
```
map3d 中 `distance` 表示标注离球体表面的距离。球体半径为 100。也可以细化到在 data 级别配置 `distance`。

###data
data 配置详见 <a href="./markpoint.html">markPoint</a>。跟 markPoint 相比 markBar 的 data 可以使用 barHeight 配置柱形高度。如下：

###itemStyle
markBar 的 itemStyle 只支持配置颜色 `color`

```javascript
var data = [{
    geoCoord: [-70, 30],
    barHeight: 10,
    barSize: 1.2
}]
```