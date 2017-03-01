var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var Triangulation = require('../../util/Triangulation');
var LinesGeo = require('../../util/geometry/Lines3D');
var retrieve = require('../../util/retrieve');
var glmatrix = require('qtek/lib/dep/glmatrix');
var LabelsMesh = require('../../util/mesh/LabelsMesh');
var ZRTextureAtlasSurface = require('../../util/ZRTextureAtlasSurface');

var vec3 = glmatrix.vec3;

graphicGL.Shader.import(require('text!../../util/shader/lines3D.glsl'));

var shadings = ['lambert', 'realistic', 'color'];

function Geo3DBuilder(api) {

    this.rootNode = new graphicGL.Node();

    this._currentMap = '';

    // Cache triangulation result
    this._triangulationResults = {};

    this._triangulator = new Triangulation();

    this._boxWidth;
    this._boxHeight;
    this._boxDepth;

    this._shadersMap = shadings.reduce(function (obj, shaderName) {
        obj[shaderName] = graphicGL.createShader('ecgl.' + shaderName);
        obj[shaderName].define('fragment', 'DOUBLE_SIDE');
        // obj[shaderName].define('both', 'WIREFRAME_TRIANGLE');
        return obj;
    }, {});

    this._linesShader = graphicGL.createShader('ecgl.meshLines3D');

    var groundMaterials = {};
    shadings.forEach(function (shading) {
        groundMaterials[shading] = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.' + shading)
        });
    });
    this._groundMaterials = groundMaterials;

    this._groundMesh = new graphicGL.Mesh({
        geometry: new graphicGL.PlaneGeometry(),
        castShadow: false
    });
    this._groundMesh.rotation.rotateX(-Math.PI / 2);
    this._groundMesh.scale.set(1000, 1000, 1);

    this._labelsMesh = new LabelsMesh();
    this._labelsMesh.material.depthMask = false;

    this._labelTextureSurface = new ZRTextureAtlasSurface(1024, 1024, api.getDevicePixelRatio());
    this._labelTextureSurface.onupdate = function () {
        api.getZr().refresh();
    };

    this._labelsMesh.material.set('textureAtlas', this._labelTextureSurface.getTexture());
}

Geo3DBuilder.prototype = {

    constructor: Geo3DBuilder,

    update: function (componentModel, ecModel, api) {
        var geo3D = componentModel.coordinateSystem;

        if (geo3D.map !== this._currentMap) {

            this._triangulation(geo3D);
            this._currentMap = geo3D.map;

            // Reset meshes
            this._initMeshes(componentModel);
        }

        // Update materials
        var realisticMaterialModel = componentModel.getModel('realisticMaterial');
        var roughness = retrieve.firstNotNull(realisticMaterialModel.get('roughness'), 0.5);
        var metalness = realisticMaterialModel.get('metalness') || 0;

        var shader = this._getShader(componentModel.get('shading'));
        var srgbDefineMethod = geo3D.viewGL.isLinearSpace() ? 'define' : 'unDefine';
        shader[srgbDefineMethod]('fragment', 'SRGB_DECODE');

        geo3D.regions.forEach(function (region) {
            var polygonMesh = this._polygonMeshes[region.name];
            var linesMesh = this._linesMeshes[region.name];
            if (polygonMesh.material.shader !== shader) {
                polygonMesh.material.attachShader(shader, true);
            }
            var regionModel = componentModel.getRegionModel(region.name);
            var itemStyleModel = regionModel.getModel('itemStyle.normal');
            var color = graphicGL.parseColor(itemStyleModel.get('areaColor'));

            if (componentModel.getData) {
                // series has data.
                var data = componentModel.getData();
                var idx = data.indexOfName(region.name);
                // Use visual color if it is encoded by visualMap component
                var visualColor = data.getItemVisual(idx, 'color', true);
                if (visualColor != null) {
                    color = graphicGL.parseColor(visualColor);
                }
            }

            var borderColor = graphicGL.parseColor(itemStyleModel.get('borderColor'));
            var opacity = retrieve.firstNotNull(itemStyleModel.get('opacity'), 1.0);;
            color[3] *= opacity;
            borderColor[3] *= opacity;
            polygonMesh.material.set({
                roughness: roughness,
                metalness: metalness,
                color: color
            });

            var lineWidth = itemStyleModel.get('borderWidth');
            var hasLine = lineWidth > 0;

            var regionHeight = retrieve.firstNotNull(regionModel.get('height', true), geo3D.size[1]);

            this._updatePolygonGeometry(polygonMesh.geometry, region, regionHeight);

            // Update lines.
            if (hasLine) {
                lineWidth *= api.getDevicePixelRatio();
                this._updateLinesGeometry(linesMesh.geometry, region, regionHeight, lineWidth, geo3D.transform);
            }
            linesMesh.invisible = !hasLine;
            linesMesh.material.set({
                color: borderColor
            });
        }, this);

        this._updateGroundPlane(componentModel);
        this._groundMesh.material.shader[srgbDefineMethod]('fragment', 'SRGB_DECODE');


        this._updateLabels(componentModel, api);
    },

    _updateGroundPlane: function (componentModel) {
        var groundModel = componentModel.getModel('groundPlane');
        var shading = componentModel.get('shading');
        var material = this._groundMaterials[shading];
        if (!material) {
            if (__DEV__) {
                console.warn('Unkonw shading ' + shading);
            }
            material = this._groundMaterials.lambert;
        }
        this._groundMesh.material = material;
        this._groundMesh.material.set('color', graphicGL.parseColor(groundModel.get('color')));
        this._groundMesh.invisible = !groundModel.get('show');
    },

    _initMeshes: function (componentModel) {
        this.rootNode.removeAll();

        var geo3D = componentModel.coordinateSystem;
        var polygonMeshesMap = {};
        var linesMeshesMap = {};
        var shader = this._getShader(componentModel.get('shading'));

        geo3D.regions.forEach(function (region) {
            polygonMeshesMap[region.name] = new graphicGL.Mesh({
                material: new graphicGL.Material({
                    shader: shader
                }),
                culling: false,
                geometry: new graphicGL.Geometry()
            });

            linesMeshesMap[region.name] = new graphicGL.Mesh({
                material: new graphicGL.Material({
                    shader: this._linesShader
                }),
                castShadow: false,
                ignorePicking: true,
                geometry: new LinesGeo({
                    useNativeLine: false
                })
            });

            this.rootNode.add(polygonMeshesMap[region.name]);
            this.rootNode.add(linesMeshesMap[region.name]);
        }, this);

        this._polygonMeshes = polygonMeshesMap;
        this._linesMeshes = linesMeshesMap;


        this.rootNode.add(this._groundMesh);
        this.rootNode.add(this._labelsMesh);
    },

    _getShader: function (shading) {
        var shader = this._shadersMap[shading];
        if (!shader) {
            if (__DEV__) {
                console.warn('Unkonw shading ' + shading);
            }
            // Default use lambert shader.
            shader = this._shadersMap.lambert;
        }
        return shader;
    },

    _triangulation: function (geo3D) {
        this._triangulationResults = {};
        var triangulator = this._triangulator;

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
                    var holePoints = [];
                    for (var k = 0; k < interiors[j].length; k++) {
                        var p = interiors[j][k];
                        holePoints.push(p[0]);
                        holePoints.push(p[1]);
                    }

                    holes.push(holePoints);
                }
                triangulator.triangulate(points, holes);
                points = triangulator.points;

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
                polygons.push({
                    points: points3,
                    min: min,
                    max: max,
                    indices: triangulator.triangles
                });
            }
            this._triangulationResults[region.name] = polygons;
        }, this);
    },

    _updateLabels: function (componentModel, api) {
        var geo3D = componentModel.coordinateSystem;
        var labelsMesh = this._labelsMesh;

        this._labelTextureSurface.clear();

        labelsMesh.geometry.convertToDynamicArray(true);

        geo3D.regions.forEach(function (region) {
            var name = region.name;
            var center = region.center;
            var regionModel = componentModel.getRegionModel(name);
            var labelModel = regionModel.getModel('label.normal');

            if (!labelModel.get('show')) {
                return;
            }

            var textStyleModel = labelModel.getModel('textStyle');
            var regionHeight = retrieve.firstNotNull(regionModel.get('height', true), geo3D.size[1]);
            var distance = labelModel.get('distance') || 0;

            var pos = [center[0], regionHeight + distance, center[1]];
            vec3.transformMat4(pos, pos, geo3D.transform);

            var text = retrieve.firstNotNull(
                componentModel.getFormattedLabel(name, 'normal'),
                name
            );
            var font = textStyleModel.getFont();
            var textEl = new echarts.graphic.Text({
                style: {
                    text: text,
                    textFont: font
                }
            });
            var rect = textEl.getBoundingRect();
            var padding = labelModel.get('padding') || 0;
            if (typeof padding === 'number') {
                // Vertical, Horizontal
                padding = [padding, padding];
            }
            var rectEl = new echarts.graphic.Rect({
                style: {
                    text: text,
                    textFont: font,
                    textPosition: 'inside',
                    textFill: textStyleModel.get('color') || '#000',
                    fill: labelModel.get('backgroundColor'),
                    stroke: labelModel.get('borderColor'),
                    lineWidth: labelModel.get('borderWidth') || 0,
                    // Needs transform text.
                    textTransform: true
                },
                shape: {
                    x: 0, y: 0,
                    width: padding[1] * 2 + rect.width,
                    height: padding[0] * 2 + rect.height
                }
            });
            var rect = rectEl.getBoundingRect();

            var coords = this._labelTextureSurface.add(rectEl);

            var dpr = api.getDevicePixelRatio();
            labelsMesh.geometry.addSprite(
                pos, [rect.width * dpr, rect.height * dpr], coords,
                'center', 'bottom'
            );
        }, this);

        labelsMesh.geometry.convertToTypedArray();
    },

    _updatePolygonGeometry: function (geometry, region, regionHeight) {
        var faces = this.faces;
        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var polygons = this._triangulationResults[region.name];

        var sideVertexCount = 0;
        var sideFaceCount = 0;

        for (var i = 0; i < polygons.length; i++) {
            sideVertexCount += polygons[i].points.length / 3;
            sideFaceCount += polygons[i].indices.length / 3;
        }

        var vertexCount = sideVertexCount * 2 + sideVertexCount * 4;
        var faceCount = sideFaceCount * 2 + sideVertexCount * 2;

        positionAttr.init(vertexCount);
        normalAttr.init(vertexCount);
        faces = geometry.faces = vertexCount > 0xffff ? new Uint32Array(faceCount * 3) : new Uint16Array(faceCount * 3);

        var vertexOffset = 0;
        var faceOffset = 0;

        function addVertices(polygon, y, insideOffset) {
            var nextPosition = [];
            var insidePosition = [];
            var normal = [];
            var a = [];
            var b = [];
            var points = polygon.points;

            var pointsLen = points.length;
            var prevPosition = [points[pointsLen - 3], y, points[pointsLen - 1]];
            var currentPosition = [points[0], y, points[2]];

            for (var k = 3; k <= pointsLen; k += 3) {
                nextPosition[0] = points[(k) % pointsLen];
                nextPosition[1] = y;
                nextPosition[2] = points[(k + 2) % pointsLen];

                vec3.sub(a, prevPosition, currentPosition);
                vec3.sub(b, nextPosition, currentPosition);
                vec3.add(normal, a, b);
                vec3.normalize(normal, normal);
                vec3.scaleAndAdd(insidePosition, currentPosition, normal, insideOffset);

                positionAttr.set(vertexOffset++, insidePosition);

                vec3.copy(prevPosition, currentPosition);
                vec3.copy(currentPosition, nextPosition);
            }
        }

        function buildTopBottom(polygon, y, insideOffset) {

            var startVertexOffset = vertexOffset;

            addVertices(polygon, y, insideOffset);

            var indices = polygon.indices;
            for (var k = 0; k < indices.length; k++) {
                faces[faceOffset * 3 + k] = indices[k] + startVertexOffset;
            }
            faceOffset += indices.length / 3;
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
            for (var v = 0; v < ringVertexCount; v++) {
                var next = (v + 1) % ringVertexCount;

                // 0----1
                // 3----2
                for (var k = 0; k < 4; k++) {
                    var idx3 = ((k === 0 || k === 3) ? v : next) * 3;
                    quadPos[k][0] = polygon.points[idx3];
                    quadPos[k][1] = k > 1 ? regionHeight : 0;
                    quadPos[k][2] = polygon.points[idx3 + 2];
                    positionAttr.set(vertexOffset + k, quadPos[k]);
                }
                vec3.sub(a, quadPos[1], quadPos[0]);
                vec3.sub(b, quadPos[3], quadPos[0]);
                vec3.cross(normal, a, b);
                vec3.normalize(normal, normal);

                for (var k = 0; k < 4; k++) {
                    normalAttr.set(vertexOffset + k, normal);
                }

                for (var k = 0; k < 6; k++) {
                    faces[faceOffset * 3 + k] = quadToTriangle[k] + vertexOffset;
                }

                vertexOffset += 4;
                faceOffset += 2;
            }
        }
        geometry.updateBoundingBox();
    },

    _updateLinesGeometry: function (geometry, region, regionHeight, lineWidth, transform) {
        var vertexCount = 0;
        var faceCount = 0;
        region.geometries.forEach(function (geo) {
            var exterior = geo.exterior;
            var interiors = geo.interiors;
            vertexCount += geometry.getPolylineVertexCount(exterior);
            faceCount += geometry.getPolylineFaceCount(exterior);
            for (var i = 0; i < interiors.length; i++) {
                vertexCount += geometry.getPolylineVertexCount(interiors[i]);
                faceCount += geometry.getPolylineFaceCount(interiors[i]);
            }
        }, this);

        geometry.resetOffset();
        geometry.setVertexCount(vertexCount);
        geometry.setFaceCount(vertexCount);

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
        };

        var whiteColor = [1, 1, 1, 1];
        region.geometries.forEach(function (geo) {
            var exterior = geo.exterior;
            var interiors = geo.interiors;

            geometry.addPolyline(convertToPoints3(exterior), whiteColor, lineWidth);

            for (var i = 0; i < interiors.length; i++) {
                geometry.addPolyline(convertToPoints3(interiors[i]), whiteColor, lineWidth);
            }
        });
    }
};

module.exports = Geo3DBuilder;