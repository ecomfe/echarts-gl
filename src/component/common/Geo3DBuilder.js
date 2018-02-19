import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import earcut from '../../util/earcut';
import LinesGeo from '../../util/geometry/Lines3D';
import retrieve from '../../util/retrieve';
import glmatrix from 'claygl/src/dep/glmatrix';
import trianglesSortMixin from '../../util/geometry/trianglesSortMixin';
import LabelsBuilder from './LabelsBuilder';
import lines3DGLSL from '../../util/shader/lines3D.glsl.js';

var vec3 = glmatrix.vec3;

graphicGL.Shader.import(lines3DGLSL);

function Geo3DBuilder(api) {

    this.rootNode = new graphicGL.Node();

    // Cache triangulation result
    this._triangulationResults = {};

    this._shadersMap = graphicGL.COMMON_SHADERS.reduce(function (obj, shaderName) {
        obj[shaderName] = graphicGL.createShader('ecgl.' + shaderName);
        return obj;
    }, {});

    this._linesShader = graphicGL.createShader('ecgl.meshLines3D');

    var groundMaterials = {};
    graphicGL.COMMON_SHADERS.forEach(function (shading) {
        groundMaterials[shading] = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.' + shading)
        });
    });
    this._groundMaterials = groundMaterials;

    this._groundMesh = new graphicGL.Mesh({
        geometry: new graphicGL.PlaneGeometry({ dynamic: true }),
        castShadow: false,
        renderNormal: true,
        $ignorePicking: true
    });
    this._groundMesh.rotation.rotateX(-Math.PI / 2);

    this._labelsBuilder = new LabelsBuilder(512, 512, api);

    // Give a large render order.
    this._labelsBuilder.getMesh().renderOrder = 100;
    this._labelsBuilder.getMesh().material.depthTest = false;

    this.rootNode.add(this._labelsBuilder.getMesh());

    this._initMeshes();

    this._api = api;
}

Geo3DBuilder.prototype = {

    constructor: Geo3DBuilder,

    // Which dimension to extrude. Y or Z
    extrudeY: true,

    update: function (componentModel, ecModel, api, start, end) {

        var data = componentModel.getData();

        if (start == null) {
            start = 0;
        }
        if (end == null) {
            end = data.count();
        }

        this._startIndex = start;
        this._endIndex = end - 1;

        this._triangulation(componentModel, start, end);

        var shader = this._getShader(componentModel.get('shading'));

        this._prepareMesh(componentModel, shader, api, start, end);

        this.rootNode.updateWorldTransform();

        this._updateRegionMesh(componentModel, api, start, end);

        var coordSys = componentModel.coordinateSystem;
        // PENDING
        if (coordSys.type === 'geo3D') {
            this._updateGroundPlane(componentModel, coordSys, api);
        }

        var self = this;
        this._labelsBuilder.updateData(data, start, end);
        this._labelsBuilder.getLabelPosition = function (dataIndex, positionDesc, distance) {
            var name = data.getName(dataIndex);

            var center;
            var height = distance;
            if (coordSys.type === 'geo3D') {
                var region = coordSys.getRegion(name);
                if (!region) {
                    return [NaN, NaN, NaN];
                }
                center = region.center;
                var pos = coordSys.dataToPoint([center[0], center[1], height]);
                return pos;
            }
            else {
                var tmp = self._triangulationResults[dataIndex - self._startIndex];
                var center = self.extrudeY ? [
                    (tmp.max[0] + tmp.min[0]) / 2,
                    tmp.max[1] + height,
                    (tmp.max[2] + tmp.min[2]) / 2
                ] : [
                    (tmp.max[0] + tmp.min[0]) / 2,
                    (tmp.max[1] + tmp.min[1]) / 2,
                    tmp.max[2] + height
                ];
            }
        };

        this._data = data;

        this._labelsBuilder.updateLabels();

        this._updateDebugWireframe(componentModel);

        // Reset some state.
        this._lastHoverDataIndex = 0;
    },

    _initMeshes: function () {
        var self = this;
        function createPolygonMesh() {
            var mesh = new graphicGL.Mesh({
                name: 'Polygon',
                material: new graphicGL.Material({
                    shader: self._shadersMap.lambert
                }),
                geometry: new graphicGL.Geometry({
                    sortTriangles: true,
                    dynamic: true
                }),
                // TODO Disable culling
                culling: false,
                ignorePicking: true,
                // Render normal in normal pass
                renderNormal: true
            });
            echarts.util.extend(mesh.geometry, trianglesSortMixin);
            return mesh;
        }

        var polygonMesh = createPolygonMesh();

        var linesMesh = new graphicGL.Mesh({
            material: new graphicGL.Material({
                shader: this._linesShader
            }),
            castShadow: false,
            ignorePicking: true,
            $ignorePicking: true,
            geometry: new LinesGeo({
                useNativeLine: false
            })
        });

        this.rootNode.add(polygonMesh);
        this.rootNode.add(linesMesh);

        polygonMesh.material.define('both', 'VERTEX_COLOR');
        polygonMesh.material.define('fragment', 'DOUBLE_SIDED');

        this._polygonMesh = polygonMesh;
        this._linesMesh = linesMesh;

        this.rootNode.add(this._groundMesh);
    },

    _getShader: function (shading) {
        var shader = this._shadersMap[shading];
        if (!shader) {
            if (__DEV__) {
                console.warn('Unkown shading ' + shading);
            }
            // Default use lambert shader.
            shader = this._shadersMap.lambert;
        }
        shader.__shading = shading;
        return shader;
    },

    _prepareMesh: function (componentModel, shader, api, start, end) {
        var polygonVertexCount = 0;
        var polygonTriangleCount = 0;
        var linesVertexCount = 0;
        var linesTriangleCount = 0;
        // TODO Lines
        for (var idx = start; idx < end; idx++) {
            var polyInfo = this._getRegionPolygonInfo(idx);
            var lineInfo = this._getRegionLinesInfo(idx, componentModel, this._linesMesh.geometry);
            polygonVertexCount += polyInfo.vertexCount;
            polygonTriangleCount += polyInfo.triangleCount;
            linesVertexCount += lineInfo.vertexCount;
            linesTriangleCount += lineInfo.triangleCount;
        }

        var polygonMesh = this._polygonMesh;
        var polygonGeo = polygonMesh.geometry;
        ['position', 'normal', 'texcoord0', 'color'].forEach(function (attrName) {
            polygonGeo.attributes[attrName].init(polygonVertexCount);
        });
        polygonGeo.indices = polygonVertexCount > 0xffff ? new Uint32Array(polygonTriangleCount * 3) : new Uint16Array(polygonTriangleCount * 3);

        if (polygonMesh.material.shader !== shader) {
            polygonMesh.material.attachShader(shader, true);
        }
        graphicGL.setMaterialFromModel(shader.__shading, polygonMesh.material, componentModel, api);

        if (linesVertexCount > 0) {
            this._linesMesh.geometry.resetOffset();
            this._linesMesh.geometry.setVertexCount(linesVertexCount);
            this._linesMesh.geometry.setTriangleCount(linesTriangleCount);
        }

        // Indexing data index from vertex index.
        this._dataIndexOfVertex = new Uint32Array(polygonVertexCount);
        // Indexing vertex index range from data index
        this._vertexRangeOfDataIndex = new Uint32Array((end - start) * 2);
    },

    _updateRegionMesh: function (componentModel, api, start, end) {

        var data = componentModel.getData();

        var vertexOffset = 0;
        var triangleOffset = 0;

        // Materials configurations.
        var hasTranparentRegion = false;

        var polygonMesh = this._polygonMesh;
        var linesMesh = this._linesMesh;

        for (var dataIndex = start; dataIndex < end; dataIndex++) {
            // Get bunch of visual properties.
            var regionModel = componentModel.getRegionModel(dataIndex);
            var itemStyleModel = regionModel.getModel('itemStyle');
            var color = itemStyleModel.get('color');
            var opacity = retrieve.firstNotNull(itemStyleModel.get('opacity'), 1.0);

            // Use visual color if it is encoded by visualMap component
            var visualColor = data.getItemVisual(dataIndex, 'color', true);
            if (visualColor != null && data.hasValue(dataIndex)) {
                color = visualColor;
            }
            // Set color, opacity to visual for label usage.
            data.setItemVisual(dataIndex, 'color', color);
            data.setItemVisual(dataIndex, 'opacity', opacity);

            color = graphicGL.parseColor(color);
            var borderColor = graphicGL.parseColor(itemStyleModel.get('borderColor'));

            color[3] *= opacity;
            borderColor[3] *= opacity;

            var isTransparent = color[3] < 0.99;

            polygonMesh.material.set('color', [1,1,1,1]);
            hasTranparentRegion = hasTranparentRegion || isTransparent;

            var regionHeight = retrieve.firstNotNull(regionModel.get('height', true), componentModel.get('regionHeight'));

            var newOffsets = this._updatePolygonGeometry(
                componentModel, polygonMesh.geometry, dataIndex, regionHeight,
                vertexOffset, triangleOffset, color
            );

            for (var i = vertexOffset; i < newOffsets.vertexOffset; i++) {
                this._dataIndexOfVertex[i] = dataIndex;
            }
            this._vertexRangeOfDataIndex[(dataIndex - start) * 2] = vertexOffset;
            this._vertexRangeOfDataIndex[(dataIndex - start) * 2 + 1] = newOffsets.vertexOffset;

            vertexOffset = newOffsets.vertexOffset;
            triangleOffset = newOffsets.triangleOffset;

            // Update lines.
            var lineWidth = itemStyleModel.get('borderWidth');
            var hasLine = lineWidth > 0;
            if (hasLine) {
                lineWidth *= api.getDevicePixelRatio();
                this._updateLinesGeometry(
                    linesMesh.geometry, componentModel, dataIndex, regionHeight, lineWidth,
                    componentModel.coordinateSystem.transform
                );
            }
            linesMesh.invisible = !hasLine;
            linesMesh.material.set({
                color: borderColor
            });
        }

        var polygonMesh = this._polygonMesh;
        polygonMesh.material.transparent = hasTranparentRegion;
        polygonMesh.material.depthMask = !hasTranparentRegion;
        polygonMesh.geometry.updateBoundingBox();

        polygonMesh.frontFace = this.extrudeY ? graphicGL.Mesh.CCW : graphicGL.Mesh.CW;

        // Update tangents
        if (polygonMesh.material.get('normalMap')) {
            polygonMesh.geometry.generateTangents();
        }

        polygonMesh.seriesIndex = componentModel.seriesIndex;

        polygonMesh.on('mousemove', this._onmousemove, this);
        polygonMesh.on('mouseout', this._onmouseout, this);
    },

    _updateDebugWireframe: function (componentModel) {
        var debugWireframeModel = componentModel.getModel('debug.wireframe');

        // TODO Unshow
        if (debugWireframeModel.get('show')) {
            var color = graphicGL.parseColor(
                debugWireframeModel.get('lineStyle.color') || 'rgba(0,0,0,0.5)'
            );
            var width = retrieve.firstNotNull(
                debugWireframeModel.get('lineStyle.width'), 1
            );

            // TODO  Will cause highlight wrong
            var mesh = this._polygonMesh;
            mesh.geometry.generateBarycentric();
            mesh.material.define('both', 'WIREFRAME_TRIANGLE');
            mesh.material.set('wireframeLineColor', color);
            mesh.material.set('wireframeLineWidth', width);
        }
    },

    _onmousemove: function (e) {
        var dataIndex = this._dataIndexOfVertex[e.triangle[0]];
        if (dataIndex == null) {
            dataIndex = -1;
        }
        if (dataIndex !== this._lastHoverDataIndex) {
            this.downplay(this._lastHoverDataIndex);
            this.highlight(dataIndex);
            this._labelsBuilder.updateLabels([dataIndex]);
        }
        this._lastHoverDataIndex = dataIndex;
        this._polygonMesh.dataIndex = dataIndex;
    },

    _onmouseout: function (e) {
        if (e.target) {
            this.downplay(this._lastHoverDataIndex);
            this._lastHoverDataIndex = -1;
            this._polygonMesh.dataIndex = -1;
        }

        this._labelsBuilder.updateLabels([]);
    },

    _updateGroundPlane: function (componentModel, geo3D, api) {
        var groundModel = componentModel.getModel('groundPlane', componentModel);
        this._groundMesh.invisible = !groundModel.get('show', true);
        if (this._groundMesh.invisible) {
            return;
        }

        var shading = componentModel.get('shading');
        var material = this._groundMaterials[shading];
        if (!material) {
            if (__DEV__) {
                console.warn('Unkown shading ' + shading);
            }
            material = this._groundMaterials.lambert;
        }

        graphicGL.setMaterialFromModel(shading, material, groundModel, api);
        if (material.get('normalMap')) {
            this._groundMesh.geometry.generateTangents();
        }

        this._groundMesh.material = material;
        this._groundMesh.material.set('color', graphicGL.parseColor(groundModel.get('color')));

        this._groundMesh.scale.set(geo3D.size[0], geo3D.size[2], 1);
    },

    _triangulation: function (componentModel, start, end) {
        this._triangulationResults = [];

        var minAll = [Infinity, Infinity, Infinity];
        var maxAll = [-Infinity, -Infinity, -Infinity];

        var coordSys = componentModel.coordinateSystem;

        for (var idx = start; idx < end; idx++) {
            var polygons = [];
            var polygonCoords = componentModel.getRegionPolygonCoords(idx);
            for (var i = 0; i < polygonCoords.length; i++) {
                var exterior = polygonCoords[i].exterior;
                var interiors = polygonCoords[i].interiors;
                var points = [];
                var holes = [];
                if (exterior.length < 3) {
                    continue;
                }
                var offset = 0;
                for (var j = 0; j < exterior.length; j++) {
                    var p = exterior[j];
                    points[offset++] = p[0];
                    points[offset++] = p[1];
                }

                for (var j = 0; j < interiors.length; j++) {
                    if (interiors[j].length < 3) {
                        continue;
                    }
                    var startIdx = points.length / 2;
                    for (var k = 0; k < interiors[j].length; k++) {
                        var p = interiors[j][k];
                        points.push(p[0]);
                        points.push(p[1]);
                    }

                    holes.push(startIdx);
                }
                var triangles = earcut(points, holes);

                var points3 = new Float64Array(points.length / 2 * 3);
                var pos = [];
                var min = [Infinity, Infinity, Infinity];
                var max = [-Infinity, -Infinity, -Infinity];
                var off3 = 0;
                for (var j = 0; j < points.length;) {
                    vec3.set(pos, points[j++], 0, points[j++]);
                    if (coordSys && coordSys.transform) {
                        vec3.transformMat4(pos, pos, coordSys.transform);
                    }
                    vec3.min(min, min, pos);
                    vec3.max(max, max, pos);
                    points3[off3++] = pos[0];
                    points3[off3++] = pos[1];
                    points3[off3++] = pos[2];
                }
                vec3.min(minAll, minAll, min);
                vec3.max(maxAll, maxAll, max);
                polygons.push({
                    points: points3,
                    indices: triangles,
                    min: min,
                    max: max
                });
            }
            this._triangulationResults.push(polygons);
        }

        this._geoBoundingBox = [minAll, maxAll];
    },

    /**
     * Get region vertex and triangle count
     */
    _getRegionPolygonInfo: function (idx) {

        var polygons = this._triangulationResults[idx - this._startIndex];

        var sideVertexCount = 0;
        var sideTriangleCount = 0;

        for (var i = 0; i < polygons.length; i++) {
            sideVertexCount += polygons[i].points.length / 3;
            sideTriangleCount += polygons[i].indices.length / 3;
        }

        var vertexCount = sideVertexCount * 2 + sideVertexCount * 4;
        var triangleCount = sideTriangleCount * 2 + sideVertexCount * 2;

        return {
            vertexCount: vertexCount,
            triangleCount: triangleCount
        };
    },

    _updatePolygonGeometry: function (
        componentModel, geometry, dataIndex, regionHeight,
        vertexOffset, triangleOffset, color
    ) {
        // FIXME
        var projectUVOnGround = componentModel.get('projectUVOnGround');

        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var texcoordAttr = geometry.attributes.texcoord0;
        var colorAttr = geometry.attributes.color;
        var polygons = this._triangulationResults[dataIndex - this._startIndex];

        var hasColor = colorAttr.value && color;

        var indices = geometry.indices;

        var extrudeCoordIndex = this.extrudeY ? 1 : 2;
        var sideCoordIndex = this.extrudeY ? 2 : 1;

        var scale = [
            this.rootNode.worldTransform.x.len(),
            this.rootNode.worldTransform.y.len(),
            this.rootNode.worldTransform.z.len()
        ];

        var min = vec3.mul([], this._geoBoundingBox[0], scale);
        var max = vec3.mul([], this._geoBoundingBox[1], scale);
        var maxDimSize = Math.max(max[0] - min[0], max[2] - min[2]);

        function addVertices(polygon, y, insideOffset) {
            var points = polygon.points;

            var pointsLen = points.length;
            var currentPosition = [];
            var uv = [];

            for (var k = 0; k < pointsLen; k += 3) {
                currentPosition[0] = points[k];
                currentPosition[extrudeCoordIndex] = y;
                currentPosition[sideCoordIndex] = points[k + 2];

                uv[0] = (points[k] * scale[0] - min[0]) / maxDimSize;
                uv[1] = (points[k + 2] * scale[sideCoordIndex] - min[2]) / maxDimSize;

                positionAttr.set(vertexOffset, currentPosition);
                if (hasColor) {
                    colorAttr.set(vertexOffset, color);
                }
                texcoordAttr.set(vertexOffset++, uv);
            }
        }

        function buildTopBottom(polygon, y, insideOffset) {

            var startVertexOffset = vertexOffset;

            addVertices(polygon, y, insideOffset);

            var len = polygon.indices.length;
            for (var k = 0; k < len; k++) {
                indices[triangleOffset * 3 + k] = polygon.indices[k] + startVertexOffset;
            }
            triangleOffset += polygon.indices.length / 3;
        }

        var normalTop = this.extrudeY ? [0, 1, 0] : [0, 0, 1];
        var normalBottom = vec3.negate([], normalTop);
        for (var p = 0; p < polygons.length; p++) {
            var startVertexOffset = vertexOffset;
            var polygon = polygons[p];
            // BOTTOM
            buildTopBottom(polygon, 0, 0);
            // TOP
            buildTopBottom(polygon, regionHeight, 0);

            var ringVertexCount = polygon.points.length / 3;
            for (var v = 0; v < ringVertexCount; v++) {
                normalAttr.set(startVertexOffset + v, normalBottom);
                normalAttr.set(startVertexOffset + v + ringVertexCount, normalTop);
            }

            var quadToTriangle = [0, 3, 1, 1, 3, 2];

            var quadPos = [[], [], [], []];
            var a = [];
            var b = [];
            var normal = [];
            var uv = [];
            var len = 0;
            for (var v = 0; v < ringVertexCount; v++) {
                var next = (v + 1) % ringVertexCount;

                var dx = (polygon.points[next * 3] - polygon.points[v * 3]) * scale[0];
                var dy = (polygon.points[next * 3 + 2] - polygon.points[v * 3 + 2]) * scale[sideCoordIndex];
                var sideLen = Math.sqrt(dx * dx + dy * dy);

                // 0----1
                // 3----2
                for (var k = 0; k < 4; k++) {
                    var isCurrent = (k === 0 || k === 3);
                    var idx3 = (isCurrent ? v : next) * 3;
                    quadPos[k][0] = polygon.points[idx3];
                    quadPos[k][extrudeCoordIndex] = k > 1 ? regionHeight : 0;
                    quadPos[k][sideCoordIndex] = polygon.points[idx3 + 2];

                    positionAttr.set(vertexOffset + k, quadPos[k]);

                    if (projectUVOnGround) {
                        uv[0] = (polygon.points[idx3] * scale[0] - min[0]) / maxDimSize;
                        uv[1] = (polygon.points[idx3 + 2] * scale[sideCoordIndex] - min[sideCoordIndex]) / maxDimSize;
                    }
                    else {
                        uv[0] = (isCurrent ? len : (len + sideLen)) / maxDimSize;
                        uv[1] = (quadPos[k][extrudeCoordIndex] * scale[extrudeCoordIndex] - min[extrudeCoordIndex])  / maxDimSize;
                    }
                    texcoordAttr.set(vertexOffset + k, uv);
                }
                vec3.sub(a, quadPos[1], quadPos[0]);
                vec3.sub(b, quadPos[3], quadPos[0]);
                vec3.cross(normal, a, b);
                vec3.normalize(normal, normal);

                for (var k = 0; k < 4; k++) {
                    normalAttr.set(vertexOffset + k, normal);
                    if (hasColor) {
                        colorAttr.set(vertexOffset + k, color);
                    }
                }

                for (var k = 0; k < 6; k++) {
                    indices[triangleOffset * 3 + k] = quadToTriangle[k] + vertexOffset;
                }

                vertexOffset += 4;
                triangleOffset += 2;

                len += sideLen;
            }
        }

        geometry.dirty();

        return {
            vertexOffset: vertexOffset,
            triangleOffset: triangleOffset
        };
    },

    _getRegionLinesInfo: function (idx, componentModel, geometry) {
        var vertexCount = 0;
        var triangleCount = 0;

        var regionModel = componentModel.getRegionModel(idx);
        var itemStyleModel = regionModel.getModel('itemStyle');

        var lineWidth = itemStyleModel.get('borderWidth');
        if (lineWidth > 0) {
            var polygonCoords = componentModel.getRegionPolygonCoords(idx);
            polygonCoords.forEach(function (coords) {
                var exterior = coords.exterior;
                var interiors = coords.interiors;
                vertexCount += geometry.getPolylineVertexCount(exterior);
                triangleCount += geometry.getPolylineTriangleCount(exterior);
                for (var i = 0; i < interiors.length; i++) {
                    vertexCount += geometry.getPolylineVertexCount(interiors[i]);
                    triangleCount += geometry.getPolylineTriangleCount(interiors[i]);
                }
            }, this);
        }

        return {
            vertexCount: vertexCount,
            triangleCount: triangleCount
        };

    },

    _updateLinesGeometry: function (geometry, componentModel, dataIndex, regionHeight, lineWidth, transform) {
        function convertToPoints3(polygon) {
            var points = new Float64Array(polygon.length * 3);
            var offset = 0;
            var pos = [];
            for (var i = 0; i < polygon.length; i++) {
                pos[0] = polygon[i][0];
                // Add a offset to avoid z-fighting
                pos[1] = regionHeight + 0.1;
                pos[2] = polygon[i][1];

                if (transform) {
                    vec3.transformMat4(pos, pos, transform);
                }

                points[offset++] = pos[0];
                points[offset++] = pos[1];
                points[offset++] = pos[2];
            }
            return points;
        }

        var whiteColor = [1, 1, 1, 1];
        var coords = componentModel.getRegionPolygonCoords(dataIndex);
        coords.forEach(function (geo) {
            var exterior = geo.exterior;
            var interiors = geo.interiors;

            geometry.addPolyline(convertToPoints3(exterior), whiteColor, lineWidth);

            for (var i = 0; i < interiors.length; i++) {
                geometry.addPolyline(convertToPoints3(interiors[i]), whiteColor, lineWidth);
            }
        });
    },

    highlight: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }

        var itemModel = data.getItemModel(dataIndex);
        var emphasisItemStyleModel = itemModel.getModel('emphasis.itemStyle');
        var emphasisColor = emphasisItemStyleModel.get('color');
        var emphasisOpacity = retrieve.firstNotNull(
            emphasisItemStyleModel.get('opacity'),
            data.getItemVisual(dataIndex, 'opacity'),
            1
        );
        if (emphasisColor == null) {
            var color = data.getItemVisual(dataIndex, 'color');
            emphasisColor = echarts.color.lift(color, -0.4);
        }
        if (emphasisOpacity == null) {
            emphasisOpacity = data.getItemVisual(dataIndex, 'opacity');
        }
        var colorArr = graphicGL.parseColor(emphasisColor);
        colorArr[3] *= emphasisOpacity;

        this._setColorOfDataIndex(data, dataIndex, colorArr);
    },

    downplay: function (dataIndex) {

        var data = this._data;
        if (!data) {
            return;
        }

        var color = data.getItemVisual(dataIndex, 'color');
        var opacity = retrieve.firstNotNull(data.getItemVisual(dataIndex, 'opacity'), 1);

        var colorArr = graphicGL.parseColor(color);
        colorArr[3] *= opacity;

        this._setColorOfDataIndex(data, dataIndex, colorArr);
    },

    _setColorOfDataIndex: function (data, dataIndex, colorArr) {
        if (dataIndex < this._startIndex && dataIndex > this._endIndex) {
            return;
        }
        dataIndex -= this._startIndex;
        for (var i = this._vertexRangeOfDataIndex[dataIndex * 2]; i < this._vertexRangeOfDataIndex[dataIndex * 2 + 1]; i++) {
            this._polygonMesh.geometry.attributes.color.set(i, colorArr);
        }
        this._polygonMesh.geometry.dirty();
        this._api.getZr().refresh();
    }
};

export default Geo3DBuilder;