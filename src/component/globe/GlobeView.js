var echarts = require('echarts/lib/echarts');

var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var SceneHelper = require('../common/SceneHelper');

var sunCalc = require('../../util/sunCalc');
var retrieve = require('../../util/retrieve');

module.exports = echarts.extendComponentView({

    type: 'globe',

    __ecgl__: true,

    _displacementScale: 0,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        var materials = {};
        graphicGL.COMMON_SHADERS.forEach(function (shading) {
            materials[shading] = new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.' + shading)
            });
        });

        this._materials = materials;

        /**
         * @type {qtek.geometry.Sphere}
         * @private
         */
        this._sphereGeometry = new graphicGL.SphereGeometry({
            widthSegments: 200,
            heightSegments: 100,
            dynamic: true
        });
        this._overlayGeometry = new graphicGL.SphereGeometry({
            widthSegments: 80,
            heightSegments: 40
        });

        /**
         * @type {qtek.geometry.Plane}
         */
        this._planeGeometry = new graphicGL.PlaneGeometry();

        /**
         * @type {qtek.geometry.Mesh}
         */
        this._earthMesh = new graphicGL.Mesh({
            name: 'earth'
        });

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper();
        this._sceneHelper.initLight(this._lightRoot);

        this.groupGL.add(this._earthMesh);

        this._control = new OrbitControl({
            zr: api.getZr()
        });

        this._control.init();

        this._layerMeshes = {};
    },

    render: function (globeModel, ecModel, api) {
        var coordSys = globeModel.coordinateSystem;
        var shading = globeModel.get('shading');

        // Always have light.
        coordSys.viewGL.add(this._lightRoot);

        if (globeModel.get('show')) {
            // Add self to scene;
            coordSys.viewGL.add(this.groupGL);
        }
        else {
            coordSys.viewGL.remove(this.groupGL);
        }

        this._sceneHelper.setScene(coordSys.viewGL.scene);

        // Set post effect
        coordSys.viewGL.setPostEffect(globeModel.getModel('postEffect'));
        coordSys.viewGL.setTemporalSuperSampling(globeModel.getModel('temporalSuperSampling'));

        var earthMesh = this._earthMesh;

        earthMesh.geometry = this._sphereGeometry;

        if (this._materials[shading]) {
            earthMesh.material = this._materials[shading];
        }
        else {
            if (__DEV__) {
                console.warn('Unkown shading ' + shading);
            }
            earthMesh.material = this._materials.lambert;
        }
        if (shading === 'realistic') {
            var matModel = globeModel.getModel('realisticMaterial');
            earthMesh.material.set({
                roughness: retrieve.firstNotNull(matModel.get('roughness'), 0.5),
                metalness: matModel.get('metalness') || 0
            });
        }

        earthMesh.material.set('color', graphicGL.parseColor(
            globeModel.get('baseColor')
        ));

        earthMesh.scale.set(coordSys.radius, coordSys.radius, coordSys.radius);

        var diffuseTexture = earthMesh.material.setTextureImage('diffuseMap', globeModel.get('baseTexture'), api, {
            flipY: false,
            anisotropic: 8
        });
        if (diffuseTexture && diffuseTexture.surface) {
            diffuseTexture.surface.attachToMesh(earthMesh);
        }

        // Update bump map
        var bumpTexture = earthMesh.material.setTextureImage('bumpMap', globeModel.get('heightTexture'), api, {
            flipY: false,
            anisotropic: 8
        });
        if (bumpTexture && bumpTexture.surface) {
            bumpTexture.surface.attachToMesh(earthMesh);
        }

        earthMesh.material.shader[globeModel.get('postEffect.enable') ? 'define' : 'undefine']('fragment', 'SRGB_DECODE');

        this._updateLight(globeModel, api);

        this._displaceVertices(globeModel, api);

        this._updateViewControl(globeModel, api);

        this._updateLayers(globeModel, api);
    },

    afterRender: function (globeModel, ecModel, api, layerGL) {
        // Create ambient cubemap after render because we need to know the renderer.
        // TODO
        var renderer = layerGL.renderer;

        this._sceneHelper.updateAmbientCubemap(renderer, globeModel, api);

        this._sceneHelper.updateSkybox(renderer, globeModel, api);
    },


    _updateLayers: function (globeModel, api) {
        var coordSys = globeModel.coordinateSystem;
        var layers = globeModel.get('layers');

        var lastDistance = coordSys.radius;
        var layerDiffuseTextures = [];
        var layerDiffuseIntensity = [];

        var layerEmissiveTextures = [];
        var layerEmissionIntensity = [];
        echarts.util.each(layers, function (layerOption) {
            var layerModel = new echarts.Model(layerOption);
            var layerType = layerModel.get('type');

            var texture = graphicGL.loadTexture(layerModel.get('texture'), api, {
                flipY: false,
                anisotropic: 8
            });
            if (texture.surface) {
                texture.surface.attachToMesh(this._earthMesh);
            }

            if (layerType === 'blend') {
                var blendTo = layerModel.get('blendTo');
                var intensity = retrieve.firstNotNull(layerModel.get('intensity'), 1.0);
                if (blendTo === 'emission') {
                    layerEmissiveTextures.push(texture);
                    layerEmissionIntensity.push(intensity);
                }
                else { // Default is albedo
                    layerDiffuseTextures.push(texture);
                    layerDiffuseIntensity.push(intensity);
                }
            }
            else { // Default use overlay
                var id = layerModel.get('id');
                var overlayMesh = this._layerMeshes[id];
                if (!overlayMesh) {
                    overlayMesh = this._layerMeshes[id] = new graphicGL.Mesh({
                        geometry: this._overlayGeometry,
                        castShadow: false,
                        ignorePicking: true
                    });
                }
                var shading = layerModel.get('shading');
                if (shading === 'lambert') {
                    overlayMesh.material = overlayMesh.__lambertMaterial || new graphicGL.Material({
                        shader: graphicGL.createShader('ecgl.lambert'),
                        transparent: true,
                        depthMask: false
                    });
                    overlayMesh.__lambertMaterial = overlayMesh.material;
                }
                else { // color
                    overlayMesh.material = overlayMesh.__colorMaterial || new graphicGL.Material({
                        shader: graphicGL.createShader('ecgl.color'),
                        transparent: true,
                        depthMask: false
                    });
                    overlayMesh.__colorMaterial = overlayMesh.material;
                }
                // overlay should be transparet if texture is not loaded yet.
                overlayMesh.material.shader.enableTexture('diffuseMap');

                var distance = layerModel.get('distance');
                // Based on distance of last layer
                var radius = lastDistance + (distance == null ? coordSys.radius / 100 : distance);
                overlayMesh.scale.set(radius, radius, radius);

                lastDistance = radius;

                // FIXME Exists blink.
                var blankTexture = this._blankTexture || (this._blankTexture = graphicGL.createBlankTexture('rgba(255, 255, 255, 0)'));
                overlayMesh.material.set('diffuseMap', blankTexture);

                graphicGL.loadTexture(layerModel.get('texture'), api, {
                    flipY: false,
                    anisotropic: 8
                }, function (texture) {
                    if (texture.surface) {
                        texture.surface.attachToMesh(overlayMesh);
                    }
                    overlayMesh.material.set('diffuseMap', texture);
                    api.getZr().refresh();
                });

                layerModel.get('show') ? this.groupGL.add(overlayMesh) : this.groupGL.remove(overlayMesh);
            }
        }, this);

        var earthMaterial = this._earthMesh.material;
        earthMaterial.shader.define('fragment', 'LAYER_DIFFUSEMAP_COUNT', layerDiffuseTextures.length);
        earthMaterial.shader.define('fragment', 'LAYER_EMISSIVEMAP_COUNT', layerEmissiveTextures.length);

        earthMaterial.set('layerDiffuseMap', layerDiffuseTextures);
        earthMaterial.set('layerDiffuseIntensity', layerDiffuseIntensity);
        earthMaterial.set('layerEmissiveMap', layerEmissiveTextures);
        earthMaterial.set('layerEmissionIntensity', layerEmissionIntensity);

        var debugWireframeModel = globeModel.getModel('debug.wireframe');
        if (debugWireframeModel.get('show')) {
            earthMaterial.shader.define('both', 'WIREFRAME_TRIANGLE');
            var color = graphicGL.parseColor(
                debugWireframeModel.get('lineStyle.color')
            );
            var width = retrieve.firstNotNull(
                debugWireframeModel.get('lineStyle.width'), 1
            );
            earthMaterial.set('wireframeLineWidth', width);
            earthMaterial.set('wireframeLineColor', color);
        }
        else {
            earthMaterial.shader.undefine('both', 'WIREFRAME_TRIANGLE');
        }
    },

    _updateViewControl: function (globeModel, api) {
        var coordSys = globeModel.coordinateSystem;
        // Update camera
        var viewControlModel = globeModel.getModel('viewControl');

        var camera = coordSys.viewGL.camera;

        function makeAction() {
            return {
                type: 'globeChangeCamera',
                alpha: control.getAlpha(),
                beta: control.getBeta(),
                distance: control.getDistance() - coordSys.radius,
                from: this.uid,
                globeId: globeModel.id
            };
        }

        // Update control
        var control = this._control;
        control.setCamera(camera);
        control.setViewGL(coordSys.viewGL);

        control.setFromViewControlModel(viewControlModel, coordSys.radius);

        control.off('update');
        control.on('update', function () {
            api.dispatchAction(makeAction());
        });
    },

    _displaceVertices: function (globeModel, api) {
        var displacementTextureValue = globeModel.get('displacementTexture') || globeModel.get('heightTexture');
        var displacementScale = globeModel.get('displacementScale');
        var displacementQuality = globeModel.get('displacementQuality');
        var showDebugWireframe = globeModel.get('debug.wireframe.show');

        if (!displacementTextureValue || displacementTextureValue === 'none') {
            displacementScale = 0;
        }

        if (displacementScale === this._displacementScale
            && displacementQuality === this._displacementQuality
            && showDebugWireframe === this._showDebugWireframe
        ) {
            return;
        }

        this._displacementScale = displacementScale;
        this._displacementQuality = displacementQuality;
        this._showDebugWireframe = showDebugWireframe;

        var geometry = this._sphereGeometry;

        var widthSegments = ({
            low: 100,
            medium: 200,
            high: 400,
            ultra: 800
        })[displacementQuality] || 200;
        var heightSegments = widthSegments / 2;
        if (geometry.widthSegments !== widthSegments || showDebugWireframe) {
            geometry.widthSegments = widthSegments;
            geometry.heightSegments = heightSegments;
            geometry.build();
        }

        var img;

        if (graphicGL.isImage(displacementTextureValue)) {
            img = displacementTextureValue;
            this._doDisplaceVertices(geometry, img, displacementScale);
            if (showDebugWireframe) {
                geometry.generateBarycentric();
            }
        }
        else {
            img = new Image();
            var self = this;
            img.onload = function () {
                self._doDisplaceVertices(geometry, img, displacementScale);
                if (showDebugWireframe) {
                    geometry.generateBarycentric();
                }
            };
            img.src = displacementTextureValue;
        }
    },

    _doDisplaceVertices: function (geometry, img, displacementScale) {
        var positionArr = geometry.attributes.position.value;
        var uvArr = geometry.attributes.texcoord0.value;

        var originalPositionArr = geometry.__originalPosition;
        if (!originalPositionArr || originalPositionArr.length !== positionArr.length) {
            originalPositionArr = new Float32Array(positionArr.length);
            originalPositionArr.set(positionArr);
            geometry.__originalPosition = originalPositionArr;
        }

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var width = img.width;
        var height = img.height;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        var rgbaArr = ctx.getImageData(0, 0, width, height).data;

        for (var i = 0; i < geometry.vertexCount; i++) {
            var i3 = i * 3;
            var i2 = i * 2;
            var x = originalPositionArr[i3 + 1];
            var y = originalPositionArr[i3 + 2];
            var z = originalPositionArr[i3 + 3];

            var u = uvArr[i2++];
            var v = uvArr[i2++];

            var j = Math.round(u * (width - 1));
            var k = Math.round(v * (height - 1));
            var idx = k * width + j;
            var scale = rgbaArr[idx * 4] / 255 * displacementScale;

            positionArr[i3 + 1] = x + x * scale;
            positionArr[i3 + 2] = y + y * scale;
            positionArr[i3 + 3] = z + z * scale;
        }

        geometry.generateVertexNormals();
        geometry.dirty();

        geometry.updateBoundingBox();
    },

    _updateLight: function (globeModel, api) {
        var earthMesh = this._earthMesh;

        this._sceneHelper.updateLight(globeModel);
        var mainLight = this._sceneHelper.mainLight;

        // Put sun in the right position
        var time = globeModel.get('light.main.time') || new Date();

        // http://en.wikipedia.org/wiki/Azimuth
        var pos = sunCalc.getPosition(Date.parse(time), 0, 0);
        var r0 = Math.cos(pos.altitude);
        // FIXME How to calculate the y ?
        mainLight.position.y = -r0 * Math.cos(pos.azimuth);
        mainLight.position.x = Math.sin(pos.altitude);
        mainLight.position.z = r0 * Math.sin(pos.azimuth);
        mainLight.lookAt(earthMesh.getWorldPosition());
    },

    dispose: function (ecModel, api) {
        this.groupGL.removeAll();
        this._control.dispose();
    }
});