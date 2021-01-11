// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import LinesGLSeries from './LinesGLSeries';
import LinesGLView from './LinesGLView';

export function install(registers) {
    registers.registerChartView(LinesGLView);
    registers.registerSeriesModel(LinesGLSeries);
}