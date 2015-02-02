ECharts-X 的定位是 ECharts 的扩展，因此在使用和配置项上跟 ECharts 上尽量保持一致，可以使用 ECharts 中的组件比如`legend`, `dataRange`。也可以和 ECharts 中的折柱饼图混搭。不过当然在引入 ECharts-X 前需要先引入 ECharts，如果之前没有使用过 ECharts，可以先去了解 ECharts 的[入门教程](http://echarts.baidu.com/doc/start.html)，或者看看 ECharts 的诸多[示例](http://echarts.baidu.com/doc/example.html)。

##获取 ECharts-X

你可以从多种途径获取 ECharts-X，最简单的方式就是[点这下载]()。

跟 ECharts 一样， ECharts-X 也托管在 [GitHub](https://github.com/pissang/echarts-x) 上，你可以直接下载最新的 [Release](https://github.com/pissang/echarts-x/releases) 版本。或者如果想要一直保持代码是最新的，你也可以直接从 clone 下来出整个代码仓库。

##引入 ECharts-X

ECharts-X 也是使用 [echarts-optimizer](https://github.com/ecomfe/echarts-optimizer) 构建，因此引入方式同 ECharts 相同。关于如何在项目中引入 ECharts 可以参见 [引入ECharts](http://echarts.baidu.com/doc/doc.html#引入ECharts)。里面描述了三种不同的引入方式，ECharts-X 目前只支持模块化包引入和模块化单文件引入，标签单文件引入还不支持。

###模块化包引入
除了 [ECharts](https://github.com/ecomfe/echarts) 和 [ZRender](https://github.com/ecomfe/zrender), ECharts-X 还依赖 WebGL 库 [qtek](https://github.com/pissang/qtek)，同样的你可以下载最新的 release 版本，或者使用 git 工具 clone 整个 [qtek](https://github.com/pissang/qtek)。

把这三个依赖库加上 [ECharts-X](https://github.com/pissang/echarts-x) 下载下来后，我们这里先假设你把这四个项目的目录放在一个目录 `project/dep` 下，而 `index.html` 放在 `project` 下，那么可以如下配置 `esl` 或者 `requirejs` 的 `packages`:

```javascript
require.config({
    packages: [{
        name: 'echarts',
        location: 'dep/echarts/src',
        main: 'echarts'
    }, {
        name: 'zrender',
        location: 'dep/zrender/src',
        main: 'zrender'
    }, {
        name: 'qtek',
        location: 'dep/qtek/src',
        // 这里需要是 qtek.amd, 如果是 qtek 会
        // 引入所有 qtek 的模块，回导致项目体积过大
        main: 'qtek.amd'
    }, {
        name: 'echarts-x',
        location: 'dep/echarts-x/src',
        main: 'echarts-x'
    }]
})
```

###模块化单文件引入(推荐)

打包好后的单文件在 `build` 目录下

```javascript
<body>
    <div id="main"></div>
    <!-- 必须要先引入 ECharts 主文件 -->
    <script src="dep/echarts/build/echarts.js"></script>
    <!-- 引入 ECharts-X 主文件 --> 
    <script src="dep/echarts-x/build/echarts-x.js"></script>
    
    <script type="text/javascript">
        // 配置后续加载的各种 chart 配置 config
        require.config({
            paths: {
                'echarts': 'dep/echarts/build',
                'echarts-x': 'dep/echarts-x/build'
            }
        });
        
        // 然后就可以动态加载图表进行绘制啦
        require([
            'echarts',
            'echarts-x',
            // ECharts-X 中 map3d 的地图绘制基于 ECharts 中的 map。
            'echarts/chart/map',
            'echarts/chart/map3d'
        ], function (ec) {
            // 跟 ECharts 一样的方式初始化
            var myChart = ec.init(document.getElementById('main'));
            ...
        })
    </script>
</body>
```

尽管跟 ECharts 相比看起来麻烦了很多，但是如果你了解 amd 规范的加载器，或者之前有用 ECharts 做过开发的话，相信你很快就能上手了。


##A Simple Example

引入 ECharts 后就可以写一个简单的例子了。文章开头提过 ECharts-X 的使用方式跟 ECharts 是一样的，这里不再赘述，如下代码就可以画出一个简单的地球啦。

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

更多的示例可以访问[示例代码](../../example.html)


##判断浏览器是否支持 WebGL

ECharts-X 需要浏览器支持 WebGL，目前流行的 PC 浏览器中支持 WebGL 的有 Chrome, Firefox, Safari, IE11。移动浏览器支持的较少，iOS 8中的 Safari 是支持的。

默认 ECharts-X 在不支持 WebGL 的环境中会提示浏览器不支持WebGL，这个提示的样式可以通过 class `.ecx-nowebgl` 配置。

但是如果在引入 ECharts-X 前就要判断浏览器是否支持 WebGL, 可以使用下面的脚本：

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