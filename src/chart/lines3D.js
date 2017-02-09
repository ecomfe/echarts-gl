var echarts = require('echarts/lib/echarts');

require('./lines3D/lines3DLayout');

require('./lines3D/Lines3DView');
require('./lines3D/Lines3DSeries');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'lines3D'
));
