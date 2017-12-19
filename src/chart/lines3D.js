import echarts from 'echarts/lib/echarts';

import './lines3D/lines3DLayout';

import './lines3D/Lines3DView';
import './lines3D/Lines3DSeries';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('lines3D'));


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