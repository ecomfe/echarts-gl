var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
// var Triangulation = require('../../util/Triangulation');
var earcut = require('../../util/earcut');
var LinesGeo = require('../../util/geometry/Lines3D');
var retrieve = require('../../util/retrieve');
var glmatrix = require('qtek/lib/dep/glmatrix');
var trianglesSortMixin = require('../../util/geometry/trianglesSortMixin');
var LabelsBuilder = require('./LabelsBuilder');

var vec3 = glmatrix.vec3;

graphicGL.Shader.import(require('../../util/shader/lines3D.glsl.js'));

function Geo3DBuilder(api) {

    this.rootNode = new graphicGL.Node();

    this._currentMap = '';

    // Cache triangulation result
    this._triangulationResults = {};

    // this._triangulator = new Triangulation();

    this._shadersMap = graphicGL.COMMON_SHADERS.reduce(function (obj, shaderName) {
        obj[shaderName] = graphicGL.createShader('ecgl.' + shaderName);
        obj[shaderName].define('fragment', 'DOUBLE_SIDE');
        // obj[shaderName].define('both', 'WIREFRAME_TRIANGLE');
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
        geometry: new graphicGL.PlaneGeometry(),
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

    update: function (componentModel, ecModel, api) {
        var geo3D = componentModel.coordinateSystem;
        var enableInstancing = componentModel.get('instancing');
        if (
            geo3D.map !== this._currentMap
            || (enableInstancing && !this._polygonMesh)
            || (!enableInstancing && !this._polygonMeshesMap)
        ) {
            this._triangulation(geo3D);
            this._currentMap = geo3D.map;

            // Reset meshes
            this._initMeshes(componentModel);

            this.rootNode.add(this._labelsBuilder.getMesh());
        }

        var shader = this._getShader(componentModel.get('shading'));
        var srgbDefineMethod = geo3D.viewGL.isLinearSpace() ? 'define' : 'undefine';
        shader[srgbDefineMethod]('fragment', 'SRGB_DECODE');

        var data = componentModel.getData();


        if (enableInstancing) {
            this._prepareInstancingMesh(componentModel, shader, api);
        }
        this._updateRegionMesh(componentModel, shader, api, enableInstancing);

        this._updateGroundPlane(componentModel, api);
        this._groundMesh.material.shader[srgbDefineMethod]('fragment', 'SRGB_DECODE');

        this._labelsBuilder.updateData(data);
        this._labelsBuilder.getLabelPosition = function (dataIndex, positionDesc, distance) {
            var itemModel = data.getItemModel(dataIndex);
            var name = data.getName(dataIndex);
            var region = geo3D.getRegion(name);
            var center = region.center;

            var height = itemModel.get('height') + distance;
            return geo3D.dataToPoint([center[0], center[1], height]);
        };

        this._data = data;

        this._labelsBuilder.updateLabels();

        this._updateDebugWireframe(componentModel);
    },

    _prepareInstancingMesh: function (componentModel, shader, api) {
        var geo3D = componentModel.coordinateSystem;

        var vertexCount = 0;
        var triangleCount = 0;
        // TODO Lines
        geo3D.regions.forEach(function (region) {
            var info = this._getRegionPolygonGeoInfo(region);
            vertexCount += info.vertexCount;
            triangleCount += info.triangleCount;
        }, this);

        var polygonMesh = this._polygonMesh;
        var polygonGeo = polygonMesh.geometry;
        ['position', 'normal', 'texcoord0', 'color'].forEach(function (attrName) {
            polygonGeo.attributes[attrName].init(vertexCount);
        });

        polygonGeo.indices = vertexCount > 0xffff ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);

        if (polygonMesh.material.shader !== shader) {
            polygonMesh.material.attachShader(shader, true);
        }
    },

    _updateRegionMesh: function (componentModel, shader, api, instancing) {

        var data = componentModel.getData();
        var geo3D = componentModel.coordinateSystem;

        var vertexOffset = 0;
        var triangleOffset = 0;

        if (instancing) {
            // Materials configurations.
            graphicGL.setMaterialFromModel(shader.__shading, this._polygonMesh.material, componentModel, api);
        }
        var hasTranparentRegion = false;

        geo3D.regions.forEach(function (region) {
            var dataIndex = data.indexOfName(region.name);

            var polygonMesh = instancing ? this._polygonMesh : this._polygonMeshesMap[region.name];
            var linesMesh = instancing ? this._linesMesh : this._linesMeshesMap[region.name];
            if (polygonMesh.material.shader !== shader) {
                polygonMesh.material.attachShader(shader, true);
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
            if (!instancing) {
                // Materials configurations.
                graphicGL.setMaterialFromModel(shader.__shading, polygonMesh.material, regionModel, api);
                polygonMesh.material.set({ color: color });
                polygonMesh.material.transparent = isTransparent;
                polygonMesh.material.depthMask = !isTransparent;
            }
            else {
                polygonMesh.material.set('color', [1,1,1,1]);
            }
            hasTranparentRegion = hasTranparentRegion || isTransparent;

            var regionHeight = retrieve.firstNotNull(regionModel.get('height', true), geo3D.size[1]);

            if (instancing) {
                var newOffsets = this._updatePolygonGeometry(
                    componentModel, polygonMesh.geometry, region, regionHeight, vertexOffset, triangleOffset, color
                );
                vertexOffset = newOffsets.vertexOffset;
                triangleOffset = newOffsets.triangleOffset;
            }
            else {
                this._updatePolygonGeometry(
                    componentModel, polygonMesh.geometry, region, regionHeight
                );
            }

            // Update lines.
            // TODO INSTANCING LINES
            var lineWidth = itemStyleModel.get('borderWidth');
            var hasLine = lineWidth > 0;
            if (!instancing) {
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
            }

            if (!instancing) {
                // Move regions to center so they can be sorted right when material is transparent.
                this._moveRegionToCenter(polygonMesh, linesMesh, hasLine);
                // Bind events.
                polygonMesh.dataIndex = dataIndex;
                polygonMesh.seriesIndex = componentModel.seriesIndex;
                polygonMesh.on('mouseover', this._onmouseover, this);
                polygonMesh.on('mouseout', this._onmouseout, this);

                // Update tangents
                if (polygonMesh.material.get('normalMap')) {
                    polygonMesh.geometry.generateTangents();
                }
            }

        }, this);

        if (instancing) {
            var polygonMesh = this._polygonMesh;
            polygonMesh.material.transparent = hasTranparentRegion;
            polygonMesh.material.depthMask = !hasTranparentRegion;
            polygonMesh.geometry.updateBoundingBox();

            // Update tangents
            if (polygonMesh.material.get('normalMap')) {
                polygonMesh.geometry.generateTangents();
            }
        }
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

            var setWireframe = function (mesh) {
                mesh.geometry.generateBarycentric();
                mesh.material.shader.define('both', 'WIREFRAME_TRIANGLE');
                mesh.material.set('wireframeLineColor', color);
                mesh.material.set('wireframeLineWidth', width);
            }
            if (this._polygonMeshesMap) {
                componentModel.coordinateSystem.regions.forEach(function (region) {
                    setWireframe(this._polygonMeshesMap[region.name]);
                }, this);
            }
            else {
                setWireframe(this._polygonMesh);
            }
        }
    },

    _onmouseover: function (e) {
        if (e.target && e.target.dataIndex != null) {
            this.highlight(e.target.dataIndex);

            this._labelsBuilder.updateLabels([e.target.dataIndex]);
        }
    },

    _onmouseout: function (e) {
        if (e.target && e.target.dataIndex != null) {
            this.downplay(e.target.dataIndex);

            // TODO Merge with onmouseover
            if (!e.relatedTarget) {
                this._labelsBuilder.updateLabels();
            }
        }
    },

    _updateGroundPlane: function (componentModel, api) {
        var geo3D = componentModel.coordinateSystem;
        var groundModel = componentModel.getModel('groundPlane');

        var shading = componentModel.get('shading');
        var material = this._groundMaterials[shading];
        if (!material) {
            if (__DEV__) {
                console.warn('Unkown shading ' + shading);
            }
            material = this._groundMaterials.lambert;
        }

        graphicGL.setMaterialFromModel(shading, material, componentModel, api);
        if (material.get('normalMap')) {
            this._groundMesh.geometry.generateTangents();
        }

        this._groundMesh.material = material;
        this._groundMesh.material.set('color', graphicGL.parseColor(groundModel.get('color')));
        this._groundMesh.invisible = !groundModel.get('show');

        this._groundMesh.scale.set(geo3D.size[0], geo3D.size[2], 1);
    },

    _initMeshes: function (componentModel) {
        this.rootNode.removeAll();

        var geo3D = componentModel.coordinateSystem;
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

        function createLinesMesh(shader) {
            return new graphicGL.Mesh({
                material: new graphicGL.Material({
                    shader: shader
                }),
                castShadow: false,
                ignorePicking: true,
                geometry: new LinesGeo({
                    useNativeLine: false
                })
            });
        }

        if (!componentModel.get('instancing')) {
            var polygonMeshesMap = {};
            var linesMeshesMap = {};
            geo3D.regions.forEach(function (region) {
                polygonMeshesMap[region.name] = createPolygonMesh();
                linesMeshesMap[region.name] = createLinesMesh(this._linesShader);

                this.rootNode.add(polygonMeshesMap[region.name]);
                this.rootNode.add(linesMeshesMap[region.name]);
            }, this);
            this._polygonMeshesMap = polygonMeshesMap;
            this._linesMeshesMap = linesMeshesMap;
        }
        else {
            var polygonMesh = createPolygonMesh();
            var linesMesh = createLinesMesh(this._linesShader);
            this.rootNode.add(polygonMesh);
            this.rootNode.add(linesMesh);

            polygonMesh.material.shader.define('both', 'VERTEX_COLOR');

            this._polygonMesh = polygonMesh;
            this._linesMesh = linesMesh;

            this._polygonMeshesMap = null;
            this._linesMeshesMap = null;
        }

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

                var points3 = new Float32Array(points.length / 2 * 3);
                var pos = [];
                var min = [Infinity, Infinity, Infinity];
                var max = [-Infinity, -Infinity, -Infinity];
                var off3 = 0;
                for (var j = 0; j < points.length;) {
                    pos[0] = points[j++];
                    pos[1] = 0;
                    pos[2] = points[j++];
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
                    minAll: minAll,
                    maxAll: maxAll,
                    indices: triangles
                });
            }
            this._triangulationResults[region.name] = polygons;
        }, this);

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
        componentModel, geometry, region, regionHeight, vertexOffset, triangleOffset, color
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
        var instancing = vertexOffset != null;
        if (!instancing) {

            var geoInfo = this._getRegionPolygonGeoInfo(region);
            vertexOffset = triangleOffset = 0;

            positionAttr.init(geoInfo.vertexCount);
            normalAttr.init(geoInfo.vertexCount);
            texcoordAttr.init(geoInfo.vertexCount);
            indices = geometry.indices = geoInfo.vertexCount > 0xffff
                ? new Uint32Array(geoInfo.triangleCount * 3)
                : new Uint16Array(geoInfo.triangleCount * 3);
        }

        var min = polygons[0].minAll;
        var max = polygons[0].maxAll;
        var maxDimSize = Math.max(max[0] - min[0], max[2] - min[2]);

        function addVertices(polygon, y, insideOffset) {
            var points = polygon.points;

            var pointsLen = points.length;
            var currentPosition = [];
            var uv = [];

            for (var k = 0; k < pointsLen; k += 3) {
                currentPosition[0] = points[k];
                currentPosition[1] = y;
                currentPosition[2] = points[k + 2];

                uv[0] = (points[k] - min[0]) / maxDimSize;
                uv[1] = (points[k + 2] - min[2]) / maxDimSize;

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

        var normalTop = [0, 1, 0];
        var normalBottom = [0, -1, 0];
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

                var dx = polygon.points[next * 3] - polygon.points[v * 3];
                var dy = polygon.points[next * 3 + 2] - polygon.points[v * 3 + 2];
                var sideLen = Math.sqrt(dx * dx + dy * dy);

                // 0----1
                // 3----2
                for (var k = 0; k < 4; k++) {
                    var isCurrent = (k === 0 || k === 3);
                    var idx3 = (isCurrent ? v : next) * 3;
                    quadPos[k][0] = polygon.points[idx3];
                    quadPos[k][1] = k > 1 ? regionHeight : 0;
                    quadPos[k][2] = polygon.points[idx3 + 2];

                    positionAttr.set(vertexOffset + k, quadPos[k]);

                    if (projectUVOnGround) {
                        uv[0] = (polygon.points[idx3] - min[0]) / maxDimSize;
                        uv[1] = (polygon.points[idx3 + 2] - min[2]) / maxDimSize;
                    }
                    else {
                        uv[0] = (isCurrent ? len : (len + sideLen)) / maxDimSize;
                        uv[1] = (quadPos[k][1] - min[1]) / maxDimSize;
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

        if (!instancing) {
            geometry.updateBoundingBox();
        }

        geometry.dirty();

        return {
            vertexOffset: vertexOffset,
            triangleOffset: triangleOffset
        };
    },

    _getRegionLinesGeoInfo: function (region, geometry) {
        var vertexCount = 0;
        var triangleCount = 0;
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

        return {
            vertexCount: vertexCount,
            triangleCount: triangleCount
        };

    },

    _updateLinesGeometry: function (
        geometry, region, regionHeight, lineWidth, transform
    ) {

        var geoInfo = this._getRegionLinesGeoInfo(region, geometry);

        geometry.resetOffset();
        geometry.setVertexCount(geoInfo.vertexCount);
        geometry.setTriangleCount(geoInfo.triangleCount);

        function convertToPoints3(polygon) {
            var points = new Float32Array(polygon.length * 3);
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

        geometry.updateBoundingBox();
    },

    _moveRegionToCenter: function (polygonMesh, linesMesh, hasLine) {
        var polygonGeo = polygonMesh.geometry;
        var linesGeo = linesMesh.geometry;

        var bbox = polygonMesh.geometry.boundingBox;
        var cp = bbox.min.clone().add(bbox.max).scale(0.5);
        var offset = cp._array;

        bbox.min.sub(cp);
        bbox.max.sub(cp);

        var polygonPosArr = polygonGeo.attributes.position.value;
        for (var i = 0; i < polygonPosArr.length;) {
            polygonPosArr[i++] -= offset[0];
            polygonPosArr[i++] -= offset[1];
            polygonPosArr[i++] -= offset[2];
        }
        polygonMesh.position.copy(cp);

        if (hasLine) {
            linesGeo.boundingBox.min.sub(cp);
            linesGeo.boundingBox.max.sub(cp);

            var linesPosArr = linesGeo.attributes.position.value;
            for (var i = 0; i < linesPosArr.length;) {
                linesPosArr[i++] -= offset[0];
                linesPosArr[i++] -= offset[1];
                linesPosArr[i++] -= offset[2];
            }
            linesMesh.position.copy(cp);
        }
    },

    highlight: function (dataIndex) {
        var data = this._data;
        if (!data) {
            return;
        }

        var itemModel = data.getItemModel(dataIndex);
        var emphasisItemStyleModel = itemModel.getModel('emphasis.itemStyle');
        var emphasisColor = emphasisItemStyleModel.get('areaColor');
        var emphasisOpacity = emphasisItemStyleModel.get('opacity');
        if (emphasisColor == null) {
            var color = data.getItemVisual(dataIndex, 'color');
            emphasisColor = echarts.color.lift(color, -0.4);
        }
        if (emphasisOpacity == null) {
            emphasisOpacity = data.getItemVisual(dataIndex, 'opacity');
        }
        var colorArr = graphicGL.parseColor(emphasisColor);
        colorArr[3] *= emphasisOpacity;

        var polygonMesh = this._polygonMeshesMap[data.getName(dataIndex)];
        if (polygonMesh) {
            var material = polygonMesh.material;
            material.set('color', colorArr);
        }

        this._api.getZr().refresh();
    },

    downplay: function (dataIndex) {

        var data = this._data;
        if (!data) {
            return;
        }

        var color = data.getItemVisual(dataIndex, 'color');
        var opacity = data.getItemVisual(dataIndex, 'opacity');

        var colorArr = graphicGL.parseColor(color);
        colorArr[3] *= opacity;

        var polygonMesh = this._polygonMeshesMap[data.getName(dataIndex)];
        if (polygonMesh) {
            var material = polygonMesh.material;
            material.set('color', colorArr);
        }

        this._api.getZr().refresh();
    }
};

module.exports = Geo3DBuilder;