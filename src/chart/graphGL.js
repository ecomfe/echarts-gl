var echarts = require('echarts/lib/echarts');

var ForceAtlas2GPU = require('./graphGL/ForceAtlas2GPU');

require('./graphGL/GraphGLSeries');
require('./graphGL/GraphGLView');

echarts.registerVisual(echarts.util.curry(
    require('echarts/lib/visual/symbol'), 'graphGL', 'circle', null
));

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'graphGL'
));