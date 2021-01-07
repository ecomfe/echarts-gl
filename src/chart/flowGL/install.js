import FlowGLSeries from './FlowGLSeries';
import FlowGLView from './FlowGLView';

export function install(registers) {
    registers.registerChartView(FlowGLView);
    registers.registerSeriesModel(FlowGLSeries);
}