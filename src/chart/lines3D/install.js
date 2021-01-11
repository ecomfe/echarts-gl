// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import lines3DLayout from './lines3DLayout';
import Lines3DSeries from './Lines3DSeries';
import Lines3DView from './Lines3DView';

export function install(registers) {
    registers.registerChartView(Lines3DView);
    registers.registerSeriesModel(Lines3DSeries);

    registers.registerLayout(lines3DLayout);

    registers.registerAction({
        type: 'lines3DPauseEffect',
        event: 'lines3deffectpaused',
        update: 'series.lines3D:pauseEffect'
    }, function () {});

    registers.registerAction({
        type: 'lines3DResumeEffect',
        event: 'lines3deffectresumed',
        update: 'series.lines3D:resumeEffect'
    }, function () {});

    registers.registerAction({
        type: 'lines3DToggleEffect',
        event: 'lines3deffectchanged',
        update: 'series.lines3D:toggleEffect'
    }, function () {});
}