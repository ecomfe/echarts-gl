# ECHARTS-GL

<a href="http://echarts.baidu.com">
    <img style="vertical-align: top;" src="./asset/logo.png?raw=true" alt="logo" height="50px">
</a>



ECharts-GL is an extension pack of [echarts](http://echarts.baidu.com), which providing 3D plots, globe visualization and WebGL acceleration.


## Docs

+ [Option Manual](https://ecomfe.github.io/echarts-doc/public/cn/option-gl.html)

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

## Dependencies

Built on top of

+ [ECharts](https://github.com/ecomfe/echarts)

+ Canvas library [zrender](https://github.com/ecomfe/zrender)

+ WebGL library [qtek](https://github.com/pissang/qtek)。

## License

ECharts-GL is available under the BSD license.