// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import * as echarts from 'echarts/lib/echarts';

import GraphGLSeries from './GraphGLSeries';
import GraphGLView from './GraphGLView';

function normalize(a) {
    if (!(a instanceof Array)) {
        a = [a, a];
    }
    return a;
}
export function install(registers) {

    registers.registerChartView(GraphGLView);
    registers.registerSeriesModel(GraphGLSeries);

    registers.registerVisual(function (ecModel) {
        const paletteScope = {};
        ecModel.eachSeriesByType('graphGL', function (seriesModel) {
            var categoriesData = seriesModel.getCategoriesData();
            var data = seriesModel.getData();

            var categoryNameIdxMap = {};

            categoriesData.each(function (idx) {
                var name = categoriesData.getName(idx);
                // Add prefix to avoid conflict with Object.prototype.
                categoryNameIdxMap['ec-' + name] = idx;
                var itemModel = categoriesData.getItemModel(idx);

                var style = itemModel.getModel('itemStyle').getItemStyle();
                if (!style.fill) {
                    // Get color from palette.
                    style.fill = seriesModel.getColorFromPalette(name, paletteScope);
                }
                categoriesData.setItemVisual(idx, 'style', style);

                var symbolVisualList = ['symbol', 'symbolSize', 'symbolKeepAspect'];

                for (let i = 0; i < symbolVisualList.length; i++) {
                    var symbolVisual = itemModel.getShallow(symbolVisualList[i], true);
                    if (symbolVisual != null) {
                        categoriesData.setItemVisual(idx, symbolVisualList[i], symbolVisual);
                    }
                }
            });

            // Assign category color to visual
            if (categoriesData.count()) {
                data.each(function (idx) {
                    var model = data.getItemModel(idx);
                    let categoryIdx = model.getShallow('category');
                    if (categoryIdx != null) {
                        if (typeof categoryIdx === 'string') {
                            categoryIdx = categoryNameIdxMap['ec-' + categoryIdx];
                        }

                        var categoryStyle = categoriesData.getItemVisual(categoryIdx, 'style');
                        var style = data.ensureUniqueItemVisual(idx, 'style');
                        echarts.util.extend(style, categoryStyle);

                        var visualList = ['symbol', 'symbolSize', 'symbolKeepAspect'];

                        for (let i = 0; i < visualList.length; i++) {
                            data.setItemVisual(
                                idx, visualList[i],
                                categoriesData.getItemVisual(categoryIdx, visualList[i])
                            );
                        }
                    }
                });
            }
        });
    });

    registers.registerVisual(function (ecModel) {

        ecModel.eachSeriesByType('graphGL', function (seriesModel) {
            var graph = seriesModel.getGraph();
            var edgeData = seriesModel.getEdgeData();
            var symbolType = normalize(seriesModel.get('edgeSymbol'));
            var symbolSize = normalize(seriesModel.get('edgeSymbolSize'));

            edgeData.setVisual('drawType', 'stroke');

            // var colorQuery = ['lineStyle', 'color'];
            // var opacityQuery = ['lineStyle', 'opacity'];

            edgeData.setVisual('fromSymbol', symbolType && symbolType[0]);
            edgeData.setVisual('toSymbol', symbolType && symbolType[1]);
            edgeData.setVisual('fromSymbolSize', symbolSize && symbolSize[0]);
            edgeData.setVisual('toSymbolSize', symbolSize && symbolSize[1]);

            edgeData.setVisual('style', seriesModel.getModel('lineStyle').getLineStyle());

            edgeData.each(function (idx) {
                var itemModel = edgeData.getItemModel(idx);
                var edge = graph.getEdgeByIndex(idx);
                var symbolType = normalize(itemModel.getShallow('symbol', true));
                var symbolSize = normalize(itemModel.getShallow('symbolSize', true));
                // Edge visual must after node visual
                var style = itemModel.getModel('lineStyle').getLineStyle();

                var existsStyle = edgeData.ensureUniqueItemVisual(idx, 'style');
                echarts.util.extend(existsStyle, style);

                switch (existsStyle.stroke) {
                    case 'source': {
                        var nodeStyle = edge.node1.getVisual('style');
                        existsStyle.stroke = nodeStyle && nodeStyle.fill;
                        break;
                    }
                    case 'target': {
                        var nodeStyle = edge.node2.getVisual('style');
                        existsStyle.stroke = nodeStyle && nodeStyle.fill;
                        break;
                    }
                }

                symbolType[0] && edge.setVisual('fromSymbol', symbolType[0]);
                symbolType[1] && edge.setVisual('toSymbol', symbolType[1]);
                symbolSize[0] && edge.setVisual('fromSymbolSize', symbolSize[0]);
                symbolSize[1] && edge.setVisual('toSymbolSize', symbolSize[1]);
            });
        });
    });

    registers.registerAction({
        type: 'graphGLRoam',
        event: 'graphglroam',
        update: 'series.graphGL:roam'
    }, function (payload, ecModel) {
        ecModel.eachComponent({
            mainType: 'series', query: payload
        }, function (componentModel) {
            componentModel.setView(payload);
        });
    });

    function noop() {}

    registers.registerAction({
        type: 'graphGLStartLayout',
        event: 'graphgllayoutstarted',
        update: 'series.graphGL:startLayout'
    }, noop);

    registers.registerAction({
        type: 'graphGLStopLayout',
        event: 'graphgllayoutstopped',
        update: 'series.graphGL:stopLayout'
    }, noop);

    registers.registerAction({
        type: 'graphGLFocusNodeAdjacency',
        event: 'graphGLFocusNodeAdjacency',
        update: 'series.graphGL:focusNodeAdjacency'
    }, noop);


    registers.registerAction({
        type: 'graphGLUnfocusNodeAdjacency',
        event: 'graphGLUnfocusNodeAdjacency',
        update: 'series.graphGL:unfocusNodeAdjacency'
    }, noop);
}