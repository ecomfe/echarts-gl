var echarts = require('echarts/lib/echarts');

require('./lines3D/lines3DLayout');

require('./lines3D/Lines3DView');
require('./lines3D/Lines3DSeries');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'lines3D'
));


echarts.registerAction({
    type: 'lines3DPauseEffect',
    event: 'lines3deffectpaused',
    update: 'series.lines3D:pauseEffect'
}, function () {});

echarts.registerAction({
    type: 'lines3DResumeEffect',
    event: 'lines3deffectresumed',
    update: 'series.lines3D:resumeEffect'
}, function () {});

echarts.registerAction({
    type: 'lines3DToggleEffect',
    event: 'lines3deffectchanged',
    update: 'series.lines3D:toggleEffect'
}, function () {});