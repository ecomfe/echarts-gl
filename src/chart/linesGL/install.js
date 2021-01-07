import LinesGLSeries from './LinesGLSeries';
import LinesGLView from './LinesGLView';

export function install(registers) {
    registers.registerChartView(LinesGLView);
    registers.registerSeriesModel(LinesGLSeries);
}