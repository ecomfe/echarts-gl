var echarts = require('echarts/lib/echarts');

require('./graphGL/GraphGLSeries');
require('./graphGL/GraphGLView');

echarts.registerVisual(echarts.util.curry(
    require('echarts/lib/visual/symbol'), 'graphGL', 'circle', null
));

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'graphGL'
));

echarts.registerVisual(function (ecModel) {
    var paletteScope = {};
    ecModel.eachSeriesByType('graphGL', function (seriesModel) {
        var categoriesData = seriesModel.getCategoriesData();
        var data = seriesModel.getData();

        var categoryNameIdxMap = {};

        categoriesData.each(function (idx) {
            var name = categoriesData.getName(idx);
            categoryNameIdxMap[name] = idx;

            var itemModel = categoriesData.getItemModel(idx);
            var color = itemModel.get('itemStyle.color')
                || seriesModel.getColorFromPalette(name, paletteScope);
            categoriesData.setItemVisual(idx, 'color', color);
        });

        // Assign category color to visual
        if (categoriesData.count()) {
            data.each(function (idx) {
                var model = data.getItemModel(idx);
                var category = model.getShallow('category');
                if (category != null) {
                    if (typeof category === 'string') {
                        category = categoryNameIdxMap[category];
                    }
                    if (!data.getItemVisual(idx, 'color', true)) {
                        data.setItemVisual(
                            idx, 'color',
                            categoriesData.getItemVisual(category, 'color')
                        );
                    }
                }
            });
        }
    });
});

echarts.registerVisual(function (ecModel) {
    ecModel.eachSeriesByType('graphGL', function (seriesModel) {
        var graph = seriesModel.getGraph();
        var edgeData = seriesModel.getEdgeData();

        var colorQuery = 'lineStyle.color'.split('.');
        var opacityQuery = 'lineStyle.opacity'.split('.');

        edgeData.setVisual('color', seriesModel.get(colorQuery));
        edgeData.setVisual('opacity', seriesModel.get(opacityQuery));

        edgeData.each(function (idx) {
            var itemModel = edgeData.getItemModel(idx);
            var edge = graph.getEdgeByIndex(idx);
            // Edge visual must after node visual
            var color = itemModel.get(colorQuery);
            var opacity = itemModel.get(opacityQuery);
            switch (color) {
                case 'source':
                    color = edge.node1.getVisual('color');
                    break;
                case 'target':
                    color = edge.node2.getVisual('color');
                    break;
            }

            edge.setVisual('color', color);
            edge.setVisual('opacity', opacity);
        });
    });
});

echarts.registerAction({
    type: 'graphGLStartLayout',
    event: 'graphgllayoutstarted',
    update: 'series.graphGL:startLayout'
}, function () {});

echarts.registerAction({
    type: 'graphGLStopLayout',
    event: 'graphgllayoutstopped',
    update: 'series.graphGL:stopLayout'
}, function () {});