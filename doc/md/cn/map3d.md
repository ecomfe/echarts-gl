`map3d`类型提供了对全球数据的可视化，支持 ECharts 中`map`原有配置项的同时也加入了大量新的配置项。如果你之前使用过 ECharts 的`map`组件的话对下面的示例肯定不会陌生。

##Simple Example

```javascript
var option = {
    title: {
        show: true,
        text: 'Globe Visualization'
    },
    series: [{
        name: 'globe',
        type: 'map3d',
        // 底图配置
        baseLayer: {
            backgroundColor: '',
            backgroundImage: 'asset/earth.jpg',
        },
        // 表层（比如云层）配置
        surfaceLayers: [{
            type: 'texture',
            image: 'asset/clouds.png'
        }],
        // 地图绘制配置成只绘制轮廓线和标签
        itemStyle: {
            normal: {
                label: {
                    show: true
                },
                borderWidth: 1,
                borderColor: 'yellow',
                areaStyle: {
                    color: 'rgba(0, 0, 0, 0)'
                }
            }
        },
        // Empty data
        data: [{}]
    }]
}
```

##Series Option

系列配置项, 通用部分详见 [ECharts](http://echarts.baidu.com/doc/doc.html#Series)

###mapType

```javascript
mapType: 'world'
```

同 ECharts 中 map 的 mapType, 默认是 `world`。不建议使用其它类型。

###mapLocation

```javascript
mapLocation: {
    x: 0,
    y: 0,
    width: '100%',
    height: '100%'
}
```

同 ECharts 中 map 的 mapLocation，指定地球在视图中的位置。可以是绝对的像素坐标，也可以表示相对的百分比。

###autoRotate

地球是否在打开的时候自动旋转

###baseLayer
####backgroundColor

```javascript
backgroundColor: 'black'
```

底图背景色

####backgroundImage

```javascript
backgroundImage: 'none'
```

底图背景图片，覆盖在地图背景色上，可以是Image url，Image dom 或者 Canvas dom

####quality

```javascript
quality: 'medium'
```

底图贴图质量，即贴图的分辨率. 可选项：

`'high'`(4096 x 4096)

`'medium'`(2048 x 2048)

`'low'`(1024 x 1024)

也可以直接配置数值分辨率比如`512`。

###surfaceLayers

除了基于 ECharts map 的底层基本地图，map3d 可以分层绘制其它数据，比如风场的可视化。对于每一层有如下配置项:

####name

层名称

####type

层类型，可选项：

`'texture'` 普通从外部加载的纹理，可以选择该层的纹理图片，比如开头示例中的云层。

`'particle'` 粒子纹理，用来描绘向量场，例如风场和洋流。

####distance

层的高度

####image

仅在`type:'texture'` 时有效，指定外部加载的图片，可以是 url 或者 dom。

####size

```javascript
size: [2048, 1024]
```

层表面纹理的大小，默认为 2048 x 1024，注意部分用户环境的 GPU 不支持大于 2048 的纹理。

####particle

仅在`type:'particle'` 时有效，particle 的配置项如下

<table>
    <tr>
        <th>名称</th>
        <th>默认类型</th>
        <th>默认值</th>
        <th>描述</th>
    </tr>

    <tr>
        <td>vectorField</td>
        <td>Array | HTMLImageElement | HTMLCanvasElement</td>
        <td>无</td>
        <td>粒子的速度向量场。向量场有两种表示方法，可以是一个二维矩阵的数组，行表示从经度 -180 到经度 180，列表示从纬度 -90 到纬度 90，数组每一项为向量场的速度，可以是一个<code>[x, y]</code>数组，或者是一个<code>{x: x, y: y}</code>对象。x, y的值都需要归一化到 -1 到 1。除了二维矩阵，向量场也可以使用一个图片表示，例如下面 <a href="#fig-vector-field">Fig2</a> 就是一张风速的向量场图片。 </td>
    </tr>
    
    <tr>
        <td>color</td>
        <td>String</td>
        <td>`'#fff'`</td>
        <td>粒子颜色</td>
    </tr>
    <tr>
        <td>sizeScaling</td>
        <td>number</td>
        <td>`1`</td>
        <td>默认粒子大小从 0 到 1（取决于速度的大小），sizeScaling 描述粒子的缩放系数，例如 sizeScaling 值为 7 的时候粒子的大小就是 0 到 7。</td>
    </tr>
    <tr>
        <td>speedScaling</td>
        <td>number</td>
        <td>1</td>
        <td>速度缩放系数</td>
    </tr>
    <tr>
        <td>number</td>
        <td>number</td>
        <td>`65536`</td>
        <td>粒子数目，默认为`256 x 256`即`65536`。</td>
    </tr>
    <tr>
        <td>motionBlurFactor</td>
        <td>number</td>
        <td>`0.99`</td>
        <td>动态模糊系数，动态模糊效果会保存上一帧的图片乘上透明度系数即 motionBlurFactor 再与当前帧的图片混合。该系数越大则粒子运动的尾迹越长。</td>
    </tr>
</table>

<figure>
<a name="#fig-vector-field"></a>
<img src="../../img/article/vector_field.png" />
<figcaption>Fig2. Vector Field</figcaption>
</figure>

具体的示例可以参见[风场的可视化示例](../../example/map3d_wind.html)

<!-- ##Map 3D 中的分层 -->
