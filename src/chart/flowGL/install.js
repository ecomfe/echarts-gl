// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import FlowGLSeries from './FlowGLSeries';
import FlowGLView from './FlowGLView';

export function install(registers) {
    registers.registerChartView(FlowGLView);
    registers.registerSeriesModel(FlowGLSeries);
}