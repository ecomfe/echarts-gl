>ECharts-X 提供了使用 WebGL 绘制的 markPoint。并且在大部分配置项上兼容 [ECharts](http://echarts.baidu.com/doc/doc.html#SeriesMarkPoint)。

##Example - World Population
```javascript
var option = {
    title : {
        text: 'Gridded Population of the World (2000)',
        x:'center',
        y:'top',
        textStyle: {
            color: 'white'
        }
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
        name: 'World Population',
        type: 'map3d',
        mapType: 'world',
        mapBackgroundColor: '#005f99',
        // 地图的样式配置
        itemStyle: {
            normal: {
                borderColor: '#777'
            }
        },
        markPoint: {
            large: true,
            // Markpoint 呼吸动画
            effect: {
                show: true,
                shadowBlur: 0.4
            },
            // 异步获取的 Data
            data: populationData
        }
    }, {
        name: 
    }]
};
```

##MarkPoint Option

###symbol
```javascript
symbol: 'pin'
```
标注类型，同 ECharts，目前有 `circle`, `rectangle`, `triangle`, `diamond`, `emptyCircle`, `emptyRectangle`, `emptyTriangle`, `emptyDiamond` , `emptyCircle`, 只持使用 `image://url` 加载图片

###symbolSize
```javascript
symbolSize: 4
```
标注大小，要注意的是 ECharts-X 中的普通标注（`large:false`） symbolSize 并不是像素的大小，而是3D空间中的相对大小。`large:true` 时 symbolSize 对应的仍然是像素大小，而且不受缩放影响。

###large
```javascript
large: false
```
是否启用大规模标注模式

###effect
```javascript
effect: {
    show: false,
    shadowBlur: 0
}
```
标注的呼吸动画特效，`large:true`时有效，目前只支持 `shadowBlur` 配置项。 

###distance
```javascript
distance: 1
```
map3d 中 `distance` 表示标注离球体表面的距离。球体半径为 100。也可以细化到在 data 级别配置 `distance`。

###orientation
```javascript
orientation: ‘tangent’
```
标注在3D空间中的朝向，可以是标注所在表面(surface)的切线`tangent`或者法线`normal`。只有在`large:false`的时候有效

###orientationAngle
```javascript
orientationAngle: 0
```
偏离原先朝向的角度。

###itemStyle
```
itemStyle: {
    normal: {
        borderWidth: 1,
        borderColor: '#000',
        label: {
            show: false,
            position: 'inside',
            textStyle: {
                color: 'black'
            }
        }
    }
}
```
格式同 ECharts 中的 [itemStyle](http://echarts.baidu.com/doc/doc.html#ItemStyle)，目前尚不支持 emphasis 样式的配置。

###data
系列的标注数据, 详见<a href="http://echarts.baidu.com/doc/doc.html#SeriesMarkPoint">ECharts#SeriesMarkPoint</a>，注意 ECharts-X 中 3D 空间的标注坐标需要三个数值 x, y, z 指定。
