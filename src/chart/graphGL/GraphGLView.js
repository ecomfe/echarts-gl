var echarts = require('echarts/lib/echarts');
var layoutUtil = require('echarts/lib/util/layout');
var graphicGL = require('../../util/graphicGL');
var ViewGL = require('../../core/ViewGL');
var Lines2DGeometry = require('../../util/geometry/Lines2D');
var retrieve = require('../../util/retrieve');
var ForceAtlas2GPU = require('./ForceAtlas2GPU');
var ForceAtlas2 = require('./ForceAtlas2');
var requestAnimationFrame = require('zrender/lib/animation/requestAnimationFrame');
var vec2 = require('qtek/lib/dep/glmatrix').vec2;

var Roam2DControl = require('../../util/Roam2DControl');

var PointsBuilder = require('../common/PointsBuilder');

graphicGL.Shader.import(require('../../util/shader/lines2D.glsl.js'));

var globalLayoutId = 1;

echarts.extendChartView({

    type: 'graphGL',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();
        this.viewGL = new ViewGL('orthographic');

        this.viewGL.add(this.groupGL);

        this._pointsBuilder = new PointsBuilder(true, api);

        // Mesh used during force directed layout.
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

        // Mesh used after force directed layout.
        this._edgesMesh = new graphicGL.Mesh({
            material: new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.meshLines2D'),
                transparent: true,
                depthMask: false,
                depthTest: false
            }),
            geometry: new Lines2DGeometry({
                useNativeLine: false,
                dynamic: true
            }),
            culling: false
        });

        this._layoutId = 0;

        this._control = new Roam2DControl({
            zr: api.getZr(),
            viewGL: this.viewGL
        });
        this._control.setTarget(this.groupGL);
        this._control.init();


        this._clickHandler = this._clickHandler.bind(this);
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._pointsBuilder.rootNode);

        this._model = seriesModel;
        this._api = api;

        this._initLayout(seriesModel, ecModel, api);

        this._pointsBuilder.update(seriesModel, ecModel, api);

        if (!(this._forceLayoutInstance instanceof ForceAtlas2GPU)) {
            this.groupGL.remove(this._forceEdgesMesh);
        }

        this._updateCamera(seriesModel, api);

        this._control.off('update');
        this._control.on('update', function () {
            api.dispatchAction({
                type: 'graphGLRoam',
                seriesId: seriesModel.id,
                zoom: this._control.getZoom(),
                offset: this._control.getOffset()
            });

            this._pointsBuilder.updateView(this.viewGL.camera);
        }, this);

        this._control.setZoom(retrieve.firstNotNull(seriesModel.get('zoom'), 1));
        this._control.setOffset(seriesModel.get('offset') || [0, 0]);

        var mesh = this._pointsBuilder.getPointsMesh();
        mesh.off('mousemove', this._mousemoveHandler);
        mesh.off('mouseout', this._mouseOutHandler, this);
        api.getZr().off('click', this._clickHandler);

        this._pointsBuilder.highlightOnMouseover = true;
        if (seriesModel.get('focusNodeAdjacency')) {
            var focusNodeAdjacencyOn = seriesModel.get('focusNodeAdjacencyOn');
            if (focusNodeAdjacencyOn === 'click') {
                api.getZr().on('click', this._clickHandler);
            }
            else if (focusNodeAdjacencyOn === 'mouseover') {
                mesh.on('mousemove', this._mousemoveHandler, this);
                mesh.on('mouseout', this._mouseOutHandler, this);

                this._pointsBuilder.highlightOnMouseover = false;
            }
            else {
                if (__DEV__) {
                    console.warn('Unkown focusNodeAdjacencyOn value \s' + focusNodeAdjacencyOn);
                }
            }
        }

        // Reset
        this._lastMouseOverDataIndex = -1;
    },

    _clickHandler: function (e) {
        if (this._layouting) {
            return;
        }
        var dataIndex = this._pointsBuilder.getPointsMesh().dataIndex;
        if (dataIndex >= 0) {
            this._api.dispatchAction({
                type: 'graphGLFocusNodeAdjacency',
                seriesId: this._model.id,
                dataIndex: dataIndex
            });
        }
        else {
            this._api.dispatchAction({
                type: 'graphGLUnfocusNodeAdjacency',
                seriesId: this._model.id
            });
        }
    },

    _mousemoveHandler: function (e) {
        if (this._layouting) {
            return;
        }
        var dataIndex = this._pointsBuilder.getPointsMesh().dataIndex;
        if (dataIndex >= 0) {
            if (dataIndex !== this._lastMouseOverDataIndex) {
                this._api.dispatchAction({
                    type: 'graphGLFocusNodeAdjacency',
                    seriesId: this._model.id,
                    dataIndex: dataIndex
                });
            }
        }
        else {
            this._mouseOutHandler(e);
        }

        this._lastMouseOverDataIndex = dataIndex;
    },

    _mouseOutHandler: function (e) {
        if (this._layouting) {
            return;
        }

        this._api.dispatchAction({
            type: 'graphGLUnfocusNodeAdjacency',
            seriesId: this._model.id
        });

        this._lastMouseOverDataIndex = -1;
    },

    _updateForceEdgesGeometry: function (edges, seriesModel) {
        var geometry = this._forceEdgesMesh.geometry;

        var edgeData = seriesModel.getEdgeData();
        var offset = 0;
        var layoutInstance = this._forceLayoutInstance;
        var vertexCount = edgeData.count() * 2;
        geometry.attributes.node.init(vertexCount);
        geometry.attributes.color.init(vertexCount);
        edgeData.each(function (idx) {
            var edge = edges[idx];
            geometry.attributes.node.set(offset, layoutInstance.getNodeUV(edge.node1));
            geometry.attributes.node.set(offset + 1, layoutInstance.getNodeUV(edge.node2));

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

    _updateEdgesGeometry: function (edges) {

        var geometry = this._edgesMesh.geometry;
        var edgeData = this._model.getEdgeData();
        var points = this._model.getData().getLayout('points');

        geometry.resetOffset();
        geometry.setVertexCount(edges.length * geometry.getLineVertexCount());
        geometry.setTriangleCount(edges.length * geometry.getLineTriangleCount());

        var p0 = [];
        var p1 = [];

        var lineWidthQuery = ['lineStyle', 'width'];

        this._originalEdgeColors = new Float32Array(edgeData.count() * 4);
        this._edgeIndicesMap = new Float32Array(edgeData.count());
        for (var i = 0; i < edges.length; i++) {
            var edge = edges[i];
            var idx1 = edge.node1 * 2;
            var idx2 = edge.node2 * 2;
            p0[0] = points[idx1];
            p0[1] = points[idx1 + 1];
            p1[0] = points[idx2];
            p1[1] = points[idx2 + 1];

            var color = edgeData.getItemVisual(edge.dataIndex, 'color');
            var colorArr = graphicGL.parseColor(color);
            colorArr[3] *= retrieve.firstNotNull(edgeData.getItemVisual(edge.dataIndexi, 'opacity'), 1);
            var itemModel = edgeData.getItemModel(edge.dataIndexi);
            var lineWidth = retrieve.firstNotNull(itemModel.get(lineWidthQuery), 1) * this._api.getDevicePixelRatio();

            geometry.addLine(p0, p1, colorArr, lineWidth);
            
            for (var k = 0; k < 4; k++) {
                this._originalEdgeColors[edge.dataIndex * 4 + k] = colorArr[k];
            }
            this._edgeIndicesMap[edge.dataIndex] = i;
        }

        geometry.dirty();
    },

    _updateForceNodesGeometry: function (nodeData) {
        var pointsMesh = this._pointsBuilder.getPointsMesh();
        var pos = [];
        for (var i = 0; i < nodeData.count(); i++) {
            this._forceLayoutInstance.getNodeUV(i, pos);
            pointsMesh.geometry.attributes.position.set(i, pos);
        }
        pointsMesh.geometry.dirty('position');
    },

    _initLayout: function (seriesModel, ecModel, api) {
        var layout = seriesModel.get('layout');
        var graph = seriesModel.getGraph();

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
        this.stopLayout(seriesModel, ecModel, api);

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
                if (nodeData.hasItemOption) {
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
                    if (!isNaN(nodeWeightRange[0])) {
                        mass = nodeWeightRange[0];
                    }
                    else {
                        mass = 1;
                    }
                }
                nodes.push({
                    x: x, y: y, mass: mass, size: nodeData.getItemVisual(dataIndex, 'symbolSize')
                });
            });
            nodeData.setLayout('points', layoutPoints);

            graph.eachEdge(function (edge) {
                var dataIndex = edge.dataIndex;
                var value = nodeData.get('value', dataIndex);
                var weight = echarts.number.linearMap(value, edgeDataExtent, edgeWeightRange);
                if (isNaN(weight)) {
                    if (!isNaN(edgeWeightRange[0])) {
                        weight = edgeWeightRange[0];
                    }
                    else {
                        weight = 1;
                    }
                }
                edges.push({
                    node1: nodesIndicesMap[edge.node1.id],
                    node2: nodesIndicesMap[edge.node2.id],
                    weight: weight,
                    dataIndex: dataIndex
                });
            });
            if (!layoutInstance) {
                var isGPU = layoutModel.get('GPU');
                if (this._forceLayoutInstance) {
                    if ((isGPU && !(this._forceLayoutInstance instanceof ForceAtlas2GPU))
                        || (!isGPU && !(this._forceLayoutInstance instanceof ForceAtlas2))
                    ) {
                        // Mark to dispose
                        this._forceLayoutInstanceToDispose = this._forceLayoutInstance;
                    }
                }
                layoutInstance = this._forceLayoutInstance = isGPU
                    ? new ForceAtlas2GPU()
                    : new ForceAtlas2();
            }
            layoutInstance.initData(nodes, edges);
            layoutInstance.updateOption(layoutModel.option);

            // Update lines geometry after first layout;
            this._updateForceEdgesGeometry(layoutInstance.getEdges(), seriesModel);
            this._updatePositionTexture();

            api.dispatchAction({
                type: 'graphGLStartLayout'
            });
        }
        else {
            var layoutPoints = new Float32Array(nodeData.count() * 2);
            graph.eachNode(function (node) {
                var dataIndex = node.dataIndex;
                var x;
                var y;
                if (nodeData.hasItemOption) {
                    var itemModel = nodeData.getItemModel(dataIndex);
                    x = itemModel.get('x');
                    y = itemModel.get('y');
                }
                layoutPoints[offset * 2] = x;
                layoutPoints[offset * 2 + 1] = y;
            });
            nodeData.setLayout('points', layoutPoints);

            // TODO
        }
    },

    _updatePositionTexture: function () {
        var positionTex = this._forceLayoutInstance.getNodePositionTexture();
        this._pointsBuilder.setPositionTexture(positionTex);
        this._forceEdgesMesh.material.set('positionTex', positionTex);
    },

    startLayout: function (seriesModel, ecModel, api, payload) {
        var viewGL = this.viewGL;
        var api = this._api;
        var layoutInstance = this._forceLayoutInstance;
        var data = this._model.getData();
        var layoutModel = this._model.getModel('forceAtlas2');

        this.groupGL.remove(this._edgesMesh);
        this.groupGL.add(this._forceEdgesMesh);

        if (!this._forceLayoutInstance) {
            return;
        }

        this._updateForceNodesGeometry(seriesModel.getData());

        var self = this;
        var layoutId = this._layoutId = globalLayoutId++;
        var stopThreshold = layoutModel.getShallow('stopThreshold');
        var steps = layoutModel.getShallow('steps');
        var doLayout = function (layoutId) {
            if (layoutId !== self._layoutId) {
                return;
            }
            if (layoutInstance.isFinished(viewGL.layer.renderer, stopThreshold)) {
                api.dispatchAction({
                    type: 'graphGLStopLayout'
                });
                api.dispatchAction({
                    type: 'graphGLFinishLayout',
                    points: data.getLayout('points')
                });
                return;
            }

            // console.time('layout');
            layoutInstance.update(viewGL.layer.renderer, steps, function () {
            // console.timeEnd('layout');
                self._updatePositionTexture();
                // Position texture will been swapped. set every time.
                api.getZr().refresh();

                requestAnimationFrame(function () {
                    doLayout(layoutId);
                });
            });
        };

        requestAnimationFrame(function () {
            if (self._forceLayoutInstanceToDispose) {
                self._forceLayoutInstanceToDispose.dispose(viewGL.layer.renderer);
                self._forceLayoutInstanceToDispose = null;
            }
            doLayout(layoutId);
        });

        this._layouting = true;
    },

    stopLayout: function (seriesModel, ecModel, api, payload) {
        this._layoutId = 0;
        this.groupGL.remove(this._forceEdgesMesh);
        this.groupGL.add(this._edgesMesh);

        if (!this._forceLayoutInstance) {
            return;
        }

        if (!this.viewGL.layer) {
            return;
        }

        var points = this._forceLayoutInstance.getNodePosition(this.viewGL.layer.renderer);

        this._model.getData().setLayout('points', points);

        this._updateEdgesGeometry(this._forceLayoutInstance.getEdges());

        this._pointsBuilder.removePositionTexture();

        this._pointsBuilder.updateLayout(seriesModel, ecModel, api);

        this._pointsBuilder.updateView(this.viewGL.camera);

        this._api.getZr().refresh();

        this._layouting = false;
    },

    focusNodeAdjacency: function (seriesModel, ecModel, api, payload) {

        var data = this._model.getData();

        this._downplayAll();
        
        var dataIndex = payload.dataIndex;

        var graph = data.graph;

        var focusNodes = [];
        var node = graph.getNodeByIndex(dataIndex);
        focusNodes.push(node);
        node.edges.forEach(function (edge) {
            if (edge.dataIndex < 0) {
                return;
            }
            edge.node1 !== node && focusNodes.push(edge.node1);
            edge.node2 !== node && focusNodes.push(edge.node2);
        }, this);

        this._pointsBuilder.fadeOutAll(0.05);
        this._fadeOutEdgesAll(0.05);

        focusNodes.forEach(function (node) {
            this._pointsBuilder.highlight(data, node.dataIndex);
        }, this);

        this._pointsBuilder.updateLabels(focusNodes.map(function (node) {
            return node.dataIndex;
        }));

        var focusEdges = [];
        node.edges.forEach(function (edge) {
            if (edge.dataIndex >= 0) {
                this._highlightEdge(edge.dataIndex);
                focusEdges.push(edge);
            }
        }, this);

        this._focusNodes = focusNodes;
        this._focusEdges = focusEdges;
    },

    unfocusNodeAdjacency: function (seriesModel, ecModel, api, payload) {

        this._downplayAll();

        this._pointsBuilder.fadeInAll();
        this._fadeInEdgesAll();

        this._pointsBuilder.updateLabels();
    },

    _highlightEdge: function (dataIndex) {
        var itemModel = this._model.getEdgeData().getItemModel(dataIndex);
        var emphasisColor =  graphicGL.parseColor(itemModel.get('emphasis.lineStyle.color') || itemModel.get('lineStyle.color'));
        var emphasisOpacity = retrieve.firstNotNull(itemModel.get('emphasis.lineStyle.opacity'), itemModel.get('lineStyle.opacity'), 1);
        emphasisColor[3] *= emphasisOpacity;
        
        this._edgesMesh.geometry.setItemColor(this._edgeIndicesMap[dataIndex], emphasisColor);
    },

    _downplayAll: function () {
        if (this._focusNodes) {
            this._focusNodes.forEach(function (node) {
                this._pointsBuilder.downplay(this._model.getData(), node.dataIndex);
            }, this);
        }
        if (this._focusEdges) {
            this._focusEdges.forEach(function (edge) {
                this._downplayEdge(edge.dataIndex);
            }, this);
        }
    },

    _downplayEdge: function (dataIndex) {
        var color = this._getColor(dataIndex, []);
        this._edgesMesh.geometry.setItemColor(this._edgeIndicesMap[dataIndex], color);
    },

    _setEdgeFade: (function () {
        var color = [];
        return function (dataIndex, percent) {
            this._getColor(dataIndex, color);
            color[3] *= percent;
            this._edgesMesh.geometry.setItemColor(this._edgeIndicesMap[dataIndex], color);
        };
    })(),

    _getColor: function (dataIndex, out) {
        for (var i = 0; i < 4; i++) {
            out[i] = this._originalEdgeColors[dataIndex * 4 + i];
        }
        return out;
    },

    _fadeOutEdgesAll: function (percent) {
        var graph = this._model.getData().graph;

        graph.eachEdge(function (edge) {
            this._setEdgeFade(edge.dataIndex, percent);
        }, this);
    },

    _fadeInEdgesAll: function () {
        this._fadeOutEdgesAll(1);
    },

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
        camera.bottom = height + min[1];
        camera.right = width + min[0];
        camera.near = 0;
        camera.far = 100;
    },

    dispose: function () {
        var renderer = this.viewGL.layer.renderer;
        if (this._forceLayoutInstance) {
            this._forceLayoutInstance.dispose(renderer);
        }
        this.groupGL.removeAll();

        this.stopLayout();
    },

    remove: function () {
        this.groupGL.removeAll();
        this._control.dispose();
    }
});