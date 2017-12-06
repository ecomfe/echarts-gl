import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import earcut from '../../util/earcut';
import LinesGeo from '../../util/geometry/Lines3D';
import retrieve from '../../util/retrieve';
import glmatrix from 'qtek/src/dep/glmatrix';
import trianglesSortMixin from '../../util/geometry/trianglesSortMixin';
import LabelsBuilder from './LabelsBuilder';
import lines3DGLSL from '../../util/shader/lines3D.glsl.js';

var vec3 = glmatrix.vec3;

graphicGL.Shader.import(lines3DGLSL);

function Geo3DBuilder(api) {

    this.rootNode = new graphicGL.Node();

    this._currentMap = '';

    // Cache triangulation result
    this._triangulationResults = {};

    this._shadersMap = graphicGL.COMMON_SHADERS.reduce(function (obj, shaderName) {
        obj[shaderName] = graphicGL.createShader('ecgl.' + shaderName);
        obj[shaderName].define('fragment', 'DOUBLE_SIDED');
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

    this._labelsBuilder = new LabelsBuilder(1024, 1024, api);

    // Give a large render order.
    this._labelsBuilder.getMesh().renderOrder = 100;
    this._labelsBuilder.getMesh().material.depthTest = false;

    this._api = api;
}

Geo3DBuilder.prototype = {

    constructor: Geo3DBuilder,

    // Which dimension to extrude. Y or Z
    extrudeY: true,

    update: function (componentModel, geo3D, ecModel, api) {
        this._triangulation(geo3D);
        if (geo3D.map !== this._currentMap) {
            this._currentMap = geo3D.map;

            // Reset meshes
            this._initMeshes(componentModel, geo3D);

            this.rootNode.add(this._labelsBuilder.getMesh());
        }

        var shader = this._getShader(componentModel.get('shading'));

        var data = componentModel.getData();

        this._prepareMesh(componentModel, geo3D, shader, api);

        this.rootNode.updateWorldTransform();
        
        this._updateRegionMesh(componentModel, geo3D, shader, api);

        this._updateGroundPlane(componentModel, geo3D, api);

        this._labelsBuilder.updateData(data);
        this._labelsBuilder.getLabelPosition = function (dataIndex, positionDesc, distance) {
            var name = data.getName(dataIndex);
            var region = geo3D.getRegion(name);
            var center = region.center;

            var height = distance;
            return geo3D.dataToPoint([center[0], center[1], height]);
        };

        this._data = data;

        this._labelsBuilder.updateLabels();

        this._updateDebugWireframe(componentModel, geo3D);

        // Reset some state.
        this._lastHoverDataIndex = 0;
    },

    _prepareMesh: function (componentModel, geo3D, shader, api) {
        var polygonVertexCount = 0;
        var polygonTriangleCount = 0;
        var linesVertexCount = 0;
        var linesTriangleCount = 0;
        // TODO Lines
        geo3D.regions.forEach(function (region) {
            var polyInfo = this._getRegionPolygonGeoInfo(region);
            var lineInfo = this._getRegionLinesGeoInfo(region, componentModel, this._linesMesh.geometry);
            polygonVertexCount += polyInfo.vertexCount;
            polygonTriangleCount += polyInfo.triangleCount;
            linesVertexCount += lineInfo.vertexCount;
            linesTriangleCount += lineInfo.triangleCount;
        }, this);

        var polygonMesh = this._polygonMesh;
        var polygonGeo = polygonMesh.geometry;
        ['position', 'normal', 'texcoord0', 'color'].forEach(function (attrName) {
            polygonGeo.attributes[attrName].init(polygonVertexCount);
        });
        polygonGeo.indices = polygonVertexCount > 0xffff ? new Uint32Array(polygonTriangleCount * 3) : new Uint16Array(polygonTriangleCount * 3);

        if (polygonMesh.material.shader !== shader) {
            polygonMesh.material.attachShader(shader, true);
        }

        if (linesVertexCount > 0) {
            this._linesMesh.geometry.resetOffset();
            this._linesMesh.geometry.setVertexCount(linesVertexCount);
            this._linesMesh.geometry.setTriangleCount(linesTriangleCount);
        }

        // Indexing data index from vertex index.
        this._dataIndexOfVertex = new Uint32Array(polygonVertexCount);
        // Indexing vertex index range from data index
        this._vertexRangeOfDataIndex = new Uint32Array(geo3D.regions.length * 2);
    },

    _updateRegionMesh: function (componentModel, geo3D, shader, api) {

        var data = componentModel.getData();

        var vertexOffset = 0;
        var triangleOffset = 0;

        // Materials configurations.
        graphicGL.setMaterialFromModel(shader.__shading, this._polygonMesh.material, componentModel, api);
        var hasTranparentRegion = false;

        var nameIndicesMap = {};
        data.each(function (idx) {
            nameIndicesMap[data.getName(idx)] = idx;
        });

        var polygonMesh = this._polygonMesh;
        var linesMesh = this._linesMesh;
        if (polygonMesh.material.shader !== shader) {
            polygonMesh.material.attachShader(shader, true);
        }

        geo3D.regions.forEach(function (region) {
            var dataIndex = nameIndicesMap[region.name];
            if (dataIndex == null) {
                dataIndex = -1;
            }

            // Get bunch of visual properties.
            var regionModel = componentModel.getRegionModel(region.name);
            var itemStyleModel = regionModel.getModel('itemStyle');
            var color = itemStyleModel.get('areaColor');
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
                componentModel, polygonMesh.geometry, region, regionHeight,
                vertexOffset, triangleOffset, color
            );

            for (var i = vertexOffset; i < newOffsets.vertexOffset; i++) {
                this._dataIndexOfVertex[i] = dataIndex;
            }
            this._vertexRangeOfDataIndex[dataIndex * 2] = vertexOffset;
            this._vertexRangeOfDataIndex[dataIndex * 2 + 1] = newOffsets.vertexOffset;

            vertexOffset = newOffsets.vertexOffset;
            triangleOffset = newOffsets.triangleOffset;

            // Update lines.
            var lineWidth = itemStyleModel.get('borderWidth');
            var hasLine = lineWidth > 0;
            if (hasLine) {
                lineWidth *= api.getDevicePixelRatio();
                this._updateLinesGeometry(
                    linesMesh.geometry, region, regionHeight, lineWidth, geo3D.transform
                );
            }
            linesMesh.invisible = !hasLine;
            linesMesh.material.set({
                color: borderColor
            });
        }, this);

        var polygonMesh = this._polygonMesh;
        polygonMesh.material.transparent = hasTranparentRegion;
        polygonMesh.material.depthMask = !hasTranparentRegion;
        polygonMesh.geometry.updateBoundingBox();

        // Update tangents
        if (polygonMesh.material.get('normalMap')) {
            polygonMesh.geometry.generateTangents();
        }

        polygonMesh.seriesIndex = componentModel.seriesIndex;

        polygonMesh.on('mousemove', this._onmousemove, this);
        polygonMesh.on('mouseout', this._onmouseout, this);
    },

    _updateDebugWireframe: function (componentModel, geo3D) {
        var debugWireframeModel = componentModel.getModel('debug.wireframe');

        // TODO Unshow
        if (debugWireframeModel.get('show')) {
            var color = graphicGL.parseColor(
                debugWireframeModel.get('lineStyle.color') || 'rgba(0,0,0,0.5)'
            );
            var width = retrieve.firstNotNull(
                debugWireframeModel.get('lineStyle.width'), 1
            );

            var setWireframe = function (mesh) {
                mesh.geometry.generateBarycentric();
                mesh.material.shader.define('both', 'WIREFRAME_TRIANGLE');
                mesh.material.set('wireframeLineColor', color);
                mesh.material.set('wireframeLineWidth', width);
            }
            if (this._polygonMeshesMap) {
                geo3D.regions.forEach(function (region) {
                    setWireframe(this._polygonMeshesMap[region.name]);
                }, this);
            }
            else {
                setWireframe(this._polygonMesh);
            }
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
            
        }
        this._lastHoverDataIndex = dataIndex;
        this._polygonMesh.dataIndex = dataIndex;
    },

    _onmouseover: function (e) {
        if (e.target) {
            var dataIndex = e.target.eventData
                ? this._data.indexOfName(e.target.eventData.name)
                : e.target.dataIndex;
            if (dataIndex != null) {
                this.highlight(dataIndex);
                this._labelsBuilder.updateLabels([dataIndex]);
            }
        }
    },

    _onmouseout: function (e) {
        if (e.target) {
            this.downplay(this._lastHoverDataIndex);
            this._lastHoverDataIndex = -1;
            this._polygonMesh.dataIndex = -1;
        }
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

    _initMeshes: function (componentModel, geo3D) {
        this.rootNode.removeAll();

        var shader = this._getShader(componentModel.get('shading'));

        function createPolygonMesh() {
             var mesh = new graphicGL.Mesh({
                material: new graphicGL.Material({
                    shader: shader
                }),
                culling: false,
                geometry: new graphicGL.Geometry({
                    sortTriangles: true,
                    dynamic: true
                }),
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
            $ignorePicking: true,
            geometry: new LinesGeo({
                useNativeLine: false
            })
        });

        this.rootNode.add(polygonMesh);
        this.rootNode.add(linesMesh);

        polygonMesh.material.shader.define('both', 'VERTEX_COLOR');

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

    _triangulation: function (geo3D) {
        this._triangulationResults = {};
        // var triangulator = this._triangulator;

        var minAll = [Infinity, Infinity, Infinity];
        var maxAll = [-Infinity, -Infinity, -Infinity];
        geo3D.regions.forEach(function (region) {
            var polygons = [];
            for (var i = 0; i < region.geometries.length; i++) {
                var exterior = region.geometries[i].exterior;
                var interiors = region.geometries[i].interiors;
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
                    if (interiors[j].length.length < 3) {
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
                // triangulator.triangulate(points, holes);
                // points = triangulator.points;
                var triangles = earcut(points, holes);

                var points3 = new Float64Array(points.length / 2 * 3);
                var pos = [];
                var min = [Infinity, Infinity, Infinity];
                var max = [-Infinity, -Infinity, -Infinity];
                var off3 = 0;
                for (var j = 0; j < points.length;) {
                    vec3.set(pos, points[j++], 0, points[j++]);
                    vec3.transformMat4(pos, pos, geo3D.transform);
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
                    indices: triangles
                });
            }
            this._triangulationResults[region.name] = polygons;
        }, this);

        this._geoBoundingBox = [minAll, maxAll];
    },

    /**
     * Get region vertex and triangle count
     */
    _getRegionPolygonGeoInfo: function (region) {

        var polygons = this._triangulationResults[region.name];

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
        componentModel, geometry, region, regionHeight,
        vertexOffset, triangleOffset, color
    ) {
        // FIXME
        var projectUVOnGround = componentModel.get('projectUVOnGround');

        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var texcoordAttr = geometry.attributes.texcoord0;
        var colorAttr = geometry.attributes.color;
        var polygons = this._triangulationResults[region.name];

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

            for (var k = 0; k < polygon.indices.length; k++) {
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

    _getRegionLinesGeoInfo: function (region, componentModel, geometry) {
        var vertexCount = 0;
        var triangleCount = 0;

        var regionModel = componentModel.getRegionModel(region.name);
        var itemStyleModel = regionModel.getModel('itemStyle');

        var lineWidth = itemStyleModel.get('borderWidth');
        if (lineWidth > 0) {
            region.geometries.forEach(function (geo) {
                var exterior = geo.exterior;
                var interiors = geo.interiors;
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

    _updateLinesGeometry: function (geometry, region, regionHeight, lineWidth, transform) {
        function convertToPoints3(polygon) {
            var points = new Float64Array(polygon.length * 3);
            var offset = 0;
            var pos = [];
            for (var i = 0; i < polygon.length; i++) {
                pos[0] = polygon[i][0];
                // Add a offset to avoid z-fighting
                pos[1] = regionHeight + 0.1;
                pos[2] = polygon[i][1];
                vec3.transformMat4(pos, pos, transform);

                points[offset++] = pos[0];
                points[offset++] = pos[1];
                points[offset++] = pos[2];
            }
            return points;
        }

        var whiteColor = [1, 1, 1, 1];
        region.geometries.forEach(function (geo) {
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
        var emphasisColor = emphasisItemStyleModel.get('areaColor');
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
        for (var i = this._vertexRangeOfDataIndex[dataIndex * 2]; i < this._vertexRangeOfDataIndex[dataIndex * 2 + 1]; i++) {
            this._polygonMesh.geometry.attributes.color.set(i, colorArr);
            this._polygonMesh.geometry.dirty();
        }
        this._api.getZr().refresh();
    }
};

export default Geo3DBuilder;