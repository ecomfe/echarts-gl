var echarts = require('echarts/lib/echarts');
var createGraphFromNodeEdge = require('./createGraphFromNodeEdge');

var GraphSeries = echarts.extendSeriesModel({

    type: 'series.graphGL',

    visualColorAccessPath: 'itemStyle.color',

    init: function (option) {
        GraphSeries.superApply(this, 'init', arguments);

        // Provide data for legend select
        this.legendDataProvider = function () {
            return this._categoriesData;
        };

        this._updateCategoriesData();
    },

    mergeOption: function (option) {
        GraphSeries.superApply(this, 'mergeOption', arguments);

        this._updateCategoriesData();
    },

    getInitialData: function (option, ecModel) {
        var edges = option.edges || option.links || [];
        var nodes = option.data || option.nodes || [];
        var self = this;

        if (nodes && edges) {
            return createGraphFromNodeEdge(nodes, edges, this, true, beforeLink).data;
        }

        function beforeLink(nodeData, edgeData) {
            // Overwrite nodeData.getItemModel to
            nodeData.wrapMethod('getItemModel', function (model) {
                var categoriesModels = self._categoriesModels;
                var categoryIdx = model.getShallow('category');
                var categoryModel = categoriesModels[categoryIdx];
                if (categoryModel) {
                    categoryModel.parentModel = model.parentModel;
                    model.parentModel = categoryModel;
                }
                return model;
            });

            var edgeLabelModel = self.getModel('edgeLabel');
            // For option `edgeLabel` can be found by label.xxx.xxx on item mode.
            var fakeSeriesModel = new echarts.Model(
                { label: edgeLabelModel.option },
                edgeLabelModel.parentModel,
                ecModel
            );

            edgeData.wrapMethod('getItemModel', function (model) {
                model.customizeGetParent(edgeGetParent);
                return model;
            });

            function edgeGetParent(path) {
                path = this.parsePath(path);
                return (path && path[0] === 'label')
                    ? fakeSeriesModel
                    : this.parentModel;
            }
        }
    },

    /**
     * @return {module:echarts/data/Graph}
     */
    getGraph: function () {
        return this.getData().graph;
    },

    /**
     * @return {module:echarts/data/List}
     */
    getEdgeData: function () {
        return this.getGraph().edgeData;
    },

    /**
     * @return {module:echarts/data/List}
     */
    getCategoriesData: function () {
        return this._categoriesData;
    },

    /**
     * @override
     */
    formatTooltip: function (dataIndex, multipleSeries, dataType) {
        if (dataType === 'edge') {
            var nodeData = this.getData();
            var params = this.getDataParams(dataIndex, dataType);
            var edge = nodeData.graph.getEdgeByIndex(dataIndex);
            var sourceName = nodeData.getName(edge.node1.dataIndex);
            var targetName = nodeData.getName(edge.node2.dataIndex);

            var html = [];
            sourceName != null && html.push(sourceName);
            targetName != null && html.push(targetName);
            html = echarts.format.encodeHTML(html.join(' > '));

            if (params.value) {
                html += ' : ' + echarts.format.encodeHTML(params.value);
            }
            return html;
        }
        else { // dataType === 'node' or empty
            return GraphSeries.superApply(this, 'formatTooltip', arguments);
        }
    },

    _updateCategoriesData: function () {
        var categories = (this.option.categories || []).map(function (category) {
            // Data must has value
            return category.value != null ? category : echarts.util.extend({
                value: 0
            }, category);
        });
        var categoriesData = new echarts.List(['value'], this);
        categoriesData.initData(categories);

        this._categoriesData = categoriesData;

        this._categoriesModels = categoriesData.mapArray(function (idx) {
            return categoriesData.getItemModel(idx, true);
        });
    },

    setZoom: function (zoom) {
        this.option.zoom = zoom;
    },

    setCenter: function (center) {
        this.option.center = center;
    },

    isAnimationEnabled: function () {
        return GraphSeries.superCall(this, 'isAnimationEnabled')
            // Not enable animation when do force layout
            && !(this.get('layout') === 'force' && this.get('force.layoutAnimation'));
    },

    defaultOption: {
        zlevel: 0,
        z: 2,

        legendHoverLink: true,

        // Only support forceAtlas2
        layout: 'forceAtlas2',

        // Configuration of force directed layout
        forceAtlas2: {
            initLayout: null,

            steps: 1,

            // Stop threshold, 0 never stop.
            stopThreshold: 2,

            repulsionByDegree: true,
            linLogMode: false,
            strongGravityMode: false,
            gravity: 1.0,
            scaling: 1.0,

            edgeWeightInfluence: 1.0,

            // Edge weight range.
            edgeWeight: [1, 4],
            // Node weight range.
            nodeWeight: [1, 4],

            jitterTolerence: 0.1,
            preventOverlap: false,
            gravityCenter: null
        },

        focusNodeAdjacency: false,

        left: 'center',
        top: 'center',
        // right: null,
        // bottom: null,
        // width: '80%',
        // height: '80%',

        symbol: 'circle',
        symbolSize: 5,

        roam: false,

        // Default on center of graph
        center: null,

        zoom: 1,

        // categories: [],

        // data: []
        // Or
        // nodes: []
        //
        // links: []
        // Or
        // edges: []

        label: {
            show: false,
            formatter: '{b}',
            position: 'right'
        },

        itemStyle: {},

        lineStyle: {
            color: '#aaa',
            width: 1,
            opacity: 0.5
        },

        emphasis: {
            label: {
                show: true
            }
        }
    }
});

module.exports = GraphSeries;