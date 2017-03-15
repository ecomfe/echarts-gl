var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var graphicGL = require('../../util/graphicGL');
var ViewGL = require('../../core/ViewGL');
var Lines2DGeometry = require('../../util/geometry/Lines2D');
var retrieve = require('../../util/retrieve');
var ForceAtlas2GPU = require('./ForceAtlas2GPU');
var requestAnimationFrame = require('zrender/lib/animation/requestAnimationFrame');
var vec2 = require('qtek/lib/dep/glmatrix').vec2;

var PointsBuilder = require('../common/PointsBuilder');

graphicGL.Shader.import(require('text!../../util/shader/lines2D.glsl'));

var globalLayoutId = 1;

echarts.extendChartView({

    type: 'graphGL',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');

        this.viewGL.add(this.groupGL);

        this._pointsBuilder = new PointsBuilder(true, api);

        this._forceEdgesMesh = new graphicGL.Mesh({
            material: new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.forceAtlas2.edges'),
                transparent: true,
                depthMask: false,
                depthTest: false
            }),
            geometry: new graphicGL.Geometry({
                attributes: {
                    node: new graphicGL.Geometry.Attribute('node', 'float', 2),
                    color: new graphicGL.Geometry.Attribute('color', 'float', 4, 'COLOR')
                },
                dynamic: true,
                mainAttribute: 'node'
            }),
            renderOrder: -1,
            mode: graphicGL.Mesh.LINES
        });

        this._layoutId = 0;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsBuilder.rootNode);

        this._initLayout(seriesModel, ecModel, api);

        this._pointsBuilder.update(seriesModel, ecModel, api);

        if (!(this._forceLayoutInstance instanceof ForceAtlas2GPU)) {
            this.groupGL.remove(this._forceEdgesMesh);
        }

        this._updateCamera(seriesModel, api);
    },

    _updateForceEdgesGeometry: function (nodesIndicesMap, seriesModel) {
        var geometry = this._forceEdgesMesh.geometry;

        var edgeData = seriesModel.getEdgeData();
        var offset = 0;
        var layoutInstance = this._forceLayoutInstance;
        var vertexCount = edgeData.count() * 2;
        geometry.attributes.node.init(vertexCount);
        geometry.attributes.color.init(vertexCount);
        seriesModel.getGraph().eachEdge(function (edge) {
            geometry.attributes.node.set(offset, layoutInstance.getNodeUV(nodesIndicesMap[edge.node1.id]));
            geometry.attributes.node.set(offset + 1, layoutInstance.getNodeUV(nodesIndicesMap[edge.node2.id]));

            var color = edgeData.getItemVisual(edge.dataIndex, 'color');
            var colorArr = graphicGL.parseColor(color);
            colorArr[3] *= retrieve.firstNotNull(
                edgeData.getItemVisual(edge.dataIndex, 'opacity'), 1
            );
            geometry.attributes.color.set(offset, colorArr);
            geometry.attributes.color.set(offset + 1, colorArr);

            offset += 2;
        });
        geometry.dirty();
    },

    _updateForceNodesGeometry: function (nodeData) {
        var pointsMesh = this._pointsBuilder.getPointsMesh();
        var pos = [];
        for (var i = 0; i < nodeData.count(); i++) {
            pointsMesh.geometry.attributes.position.get(i, pos);
            this._forceLayoutInstance.getNodeUV(i, pos);
            pointsMesh.geometry.attributes.position.set(i, pos);
        }
        pointsMesh.geometry.dirty();
    },

    _initLayout: function (seriesModel, ecModel, api) {
        var layout = seriesModel.get('layout');
        var graph = seriesModel.getGraph();
        var viewGL = this.viewGL;

        var boxLayoutOption = seriesModel.getBoxLayoutParams();
        var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
            width: api.getWidth(),
            height: api.getHeight()
        });

        if (layout === 'force') {
            if (__DEV__) {
                console.warn('Currently only forceAtlas2 layout supported.');
            }
            layout = 'forceAtlas2';
        }
        // Stop previous layout
        this._stopLayout();

        var nodeData = seriesModel.getData();
        var edgeData = seriesModel.getData();
        if (layout === 'forceAtlas2') {
            var layoutModel = seriesModel.getModel('forceAtlas2');
            var layoutInstance = this._forceLayoutInstance;
            var nodes = [];
            var edges = [];

            var nodeDataExtent = nodeData.getDataExtent('value');
            var edgeDataExtent = edgeData.getDataExtent('value');

            var edgeWeightRange = retrieve.firstNotNull(layoutModel.get('edgeWeight'), 1.0);
            var nodeWeightRange = retrieve.firstNotNull(layoutModel.get('nodeWeight'), 1.0);
            if (typeof edgeWeightRange === 'number') {
                edgeWeightRange = [edgeWeightRange, edgeWeightRange];
            }
            if (typeof nodeWeightRange === 'number') {
                nodeWeightRange = [nodeWeightRange, nodeWeightRange];
            }

            var offset = 0;
            var nodesIndicesMap = {};

            var layoutPoints = new Float32Array(nodeData.count() * 2);
            graph.eachNode(function (node) {
                var dataIndex = node.dataIndex;
                var value = nodeData.get('value', dataIndex);
                var x;
                var y;
                if (nodeData.hasItemoption) {
                    var itemModel = nodeData.getItemModel(dataIndex);
                    x = itemModel.get('x');
                    y = itemModel.get('y');
                }
                if (x == null) {
                    // Random in rectangle
                    x = viewport.x + Math.random() * viewport.width;
                    y = viewport.y + Math.random() * viewport.height;
                }
                layoutPoints[offset * 2] = x;
                layoutPoints[offset * 2 + 1] = y;

                nodesIndicesMap[node.id] = offset++;
                var mass = echarts.number.linearMap(value, nodeDataExtent, nodeWeightRange);
                if (isNaN(mass)) {
                    mass = 1;
                }
                nodes.push({
                    x: x, y: y, mass: mass
                });
            });
            nodeData.setLayout('points', layoutPoints);

            graph.eachEdge(function (edge) {
                var dataIndex = edge.dataIndex;
                var value = nodeData.get('value', dataIndex);
                var weight = echarts.number.linearMap(value, edgeDataExtent, edgeWeightRange);
                if (isNaN(weight)) {
                    weight = 1;
                }
                edges.push({
                    node1: nodesIndicesMap[edge.node1.id],
                    node2: nodesIndicesMap[edge.node2.id],
                    weight: weight
                });
            });
            if (!layoutInstance) {
                layoutInstance = this._forceLayoutInstance = new ForceAtlas2GPU();
            }
            layoutInstance.initData(nodes, edges);
            layoutInstance.updateOption(layoutModel.option);

            var self = this;
            var layoutId = this._layoutId = globalLayoutId++;
            var doLayout = function (layoutId) {
                if (layoutId !== self._layoutId) {
                    return;
                }
                for (var i = 0; i < layoutModel.getShallow('steps'); i++) {
                    layoutInstance.step(viewGL.layer.renderer);
                }
                // Position texture will been swapped. set every time.
                var positionTex = layoutInstance.getNodePositionTexture();
                self._pointsBuilder.setPositionTexture(positionTex);
                self._forceEdgesMesh.material.set('positionTex', positionTex);
                api.getZr().refresh();

                requestAnimationFrame(function () {
                    doLayout(layoutId);
                });
            };

            requestAnimationFrame(function () {
                doLayout(layoutId);
                // Update lines geometry after first layout;
                self.groupGL.add(self._forceEdgesMesh);
                self._updateForceEdgesGeometry(nodesIndicesMap, seriesModel);
                self._updateForceNodesGeometry(nodeData);
            });
        }
        else {
            var layoutPoints = new Float32Array(nodeData.count() * 2);
            graph.eachNode(function (node) {
                var dataIndex = node.dataIndex;
                var x;
                var y;
                if (nodeData.hasItemoption) {
                    var itemModel = nodeData.getItemModel(dataIndex);
                    x = itemModel.get('x');
                    y = itemModel.get('y');
                }
                layoutPoints[offset * 2] = x;
                layoutPoints[offset * 2 + 1] = y;
            });
            nodeData.setLayout('points', layoutPoints);
        }
    },

    _stopLayout: function () {
        this._layoutId = 0;
    },

    // updateLayout: function (seriesModel, ecModel, api) {
    //     this._pointsBuilder.updateLayout(seriesModel, ecModel, api);
    // },

    _updateCamera: function (seriesModel, api) {
        this.viewGL.setViewport(0, 0, api.getWidth(), api.getHeight(), api.getDevicePixelRatio());
        var camera = this.viewGL.camera;
        var nodeData = seriesModel.getData();
        var points = nodeData.getLayout('points');
        var min = vec2.create(Infinity, Infinity);
        var max = vec2.create(-Infinity, -Infinity);
        var pt = [];
        for (var i = 0; i < points.length;) {
            pt[0] = points[i++];
            pt[1] = points[i++];
            vec2.min(min, min, pt);
            vec2.max(max, max, pt);
        }
        // Scale a bit
        var width = max[0] - min[0];
        var height = max[1] - min[1];
        width *= 1.4;
        height *= 1.4;
        min[0] -= width * 0.2;
        min[1] -= height * 0.2;

        camera.left = min[0];
        camera.top = min[1];
        camera.bottom = height;
        camera.right = width;
        camera.near = 0;
        camera.far = 100;
    },

    dispose: function () {
        var renderer = this.viewGL.layer.renderer;
        if (this._forceLayoutInstance) {
            this._forceLayoutInstance.dispose(renderer);
        }
        this.groupGL.removeAll();

        this._stopLayout();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});