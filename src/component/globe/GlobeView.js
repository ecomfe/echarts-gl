import * as echarts from 'echarts/lib/echarts';

import graphicGL from '../../util/graphicGL';
import OrbitControl from '../../util/OrbitControl';
import SceneHelper from '../common/SceneHelper';

import sunCalc from '../../util/sunCalc';
import retrieve from '../../util/retrieve';

import utilShaderCode from 'claygl/src/shader/source/util.glsl.js';
import atmosphereShaderCode from './atmosphere.glsl.js';

graphicGL.Shader['import'](utilShaderCode);
graphicGL.Shader['import'](atmosphereShaderCode);

export default echarts.ComponentView.extend({

    type: 'globe',

    __ecgl__: true,

    _displacementScale: 0,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        /**
         * @type {clay.geometry.Sphere}
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
         * @type {clay.geometry.Plane}
         */
        this._planeGeometry = new graphicGL.PlaneGeometry();

        /**
         * @type {clay.geometry.Mesh}
         */
        this._earthMesh = new graphicGL.Mesh({
            renderNormal: true
        });

        /**
         * @type {clay.geometry.Mesh}
         */
        this._atmosphereMesh = new graphicGL.Mesh();
        this._atmosphereGeometry = new graphicGL.SphereGeometry({
            widthSegments: 80,
            heightSegments: 40
        });
        this._atmosphereMaterial = new graphicGL.Material({
            shader: new graphicGL.Shader(
                graphicGL.Shader.source('ecgl.atmosphere.vertex'),
                graphicGL.Shader.source('ecgl.atmosphere.fragment')
            ),
            transparent: true
        });
        this._atmosphereMesh.geometry = this._atmosphereGeometry;
        this._atmosphereMesh.material = this._atmosphereMaterial;
        this._atmosphereMesh.frontFace = graphicGL.Mesh.CW;

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper();
        this._sceneHelper.initLight(this._lightRoot);

        this.groupGL.add(this._atmosphereMesh);
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
        coordSys.viewGL.setPostEffect(globeModel.getModel('postEffect'), api);
        coordSys.viewGL.setTemporalSuperSampling(globeModel.getModel('temporalSuperSampling'));

        var earthMesh = this._earthMesh;

        earthMesh.geometry = this._sphereGeometry;

        var shadingPrefix = 'ecgl.' + shading;
        if (!earthMesh.material || earthMesh.material.shader.name !== shadingPrefix) {
            earthMesh.material = graphicGL.createMaterial(shadingPrefix);
        }

        graphicGL.setMaterialFromModel(
            shading, earthMesh.material, globeModel, api
        );
        ['roughnessMap', 'metalnessMap', 'detailMap', 'normalMap'].forEach(function (texName) {
            var texture = earthMesh.material.get(texName);
            if (texture) {
                texture.flipY = false;
            }
        });

        earthMesh.material.set('color', graphicGL.parseColor(
            globeModel.get('baseColor')
        ));

        // shrink a little
        var scale = coordSys.radius * 0.99;
        earthMesh.scale.set(scale, scale, scale);

        if (globeModel.get('atmosphere.show')) {
            earthMesh.material.define('both', 'ATMOSPHERE_ENABLED');
            this._atmosphereMesh.invisible = false;
            this._atmosphereMaterial.setUniforms({
                glowPower: globeModel.get('atmosphere.glowPower') || 6.0,
                glowColor: globeModel.get('atmosphere.color') || '#ffffff'
            });
            earthMesh.material.setUniforms({
                glowPower: globeModel.get('atmosphere.innerGlowPower') || 2.0,
                glowColor: globeModel.get('atmosphere.color') || '#ffffff'
            });
            var offset = globeModel.get('atmosphere.offset') || 5;
            this._atmosphereMesh.scale.set(scale + offset, scale + offset, scale + offset);
        }
        else {
            earthMesh.material.undefine('both', 'ATMOSPHERE_ENABLED');
            this._atmosphereMesh.invisible = true;
        }

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

        earthMesh.material[globeModel.get('postEffect.enable') ? 'define' : 'undefine']('fragment', 'SRGB_DECODE');

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
                        autoUpdateTextureStatus: false,
                        shader: graphicGL.createShader('ecgl.lambert'),
                        transparent: true,
                        depthMask: false
                    });
                    overlayMesh.__lambertMaterial = overlayMesh.material;
                }
                else { // color
                    overlayMesh.material = overlayMesh.__colorMaterial || new graphicGL.Material({
                        autoUpdateTextureStatus: false,
                        shader: graphicGL.createShader('ecgl.color'),
                        transparent: true,
                        depthMask: false
                    });
                    overlayMesh.__colorMaterial = overlayMesh.material;
                }
                // overlay should be transparent if texture is not loaded yet.
                overlayMesh.material.enableTexture('diffuseMap');

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
        earthMaterial.define('fragment', 'LAYER_DIFFUSEMAP_COUNT', layerDiffuseTextures.length);
        earthMaterial.define('fragment', 'LAYER_EMISSIVEMAP_COUNT', layerEmissiveTextures.length);

        earthMaterial.set('layerDiffuseMap', layerDiffuseTextures);
        earthMaterial.set('layerDiffuseIntensity', layerDiffuseIntensity);
        earthMaterial.set('layerEmissiveMap', layerEmissiveTextures);
        earthMaterial.set('layerEmissionIntensity', layerEmissionIntensity);

        var debugWireframeModel = globeModel.getModel('debug.wireframe');
        if (debugWireframeModel.get('show')) {
            earthMaterial.define('both', 'WIREFRAME_TRIANGLE');
            var color = graphicGL.parseColor(
                debugWireframeModel.get('lineStyle.color') || 'rgba(0,0,0,0.5)'
            );
            var width = retrieve.firstNotNull(
                debugWireframeModel.get('lineStyle.width'), 1
            );
            earthMaterial.set('wireframeLineWidth', width);
            earthMaterial.set('wireframeLineColor', color);
        }
        else {
            earthMaterial.undefine('both', 'WIREFRAME_TRIANGLE');
        }
    },

    _updateViewControl: function (globeModel, api) {
        var coordSys = globeModel.coordinateSystem;
        // Update camera
        var viewControlModel = globeModel.getModel('viewControl');

        var camera = coordSys.viewGL.camera;
        var self = this;

        function makeAction() {
            return {
                type: 'globeChangeCamera',
                alpha: control.getAlpha(),
                beta: control.getBeta(),
                distance: control.getDistance() - coordSys.radius,
                center: control.getCenter(),
                from: self.uid,
                globeId: globeModel.id
            };
        }

        // Update control
        var control = this._control;
        control.setViewGL(coordSys.viewGL);

        var coord = viewControlModel.get('targetCoord');
        var alpha, beta;
        if (coord != null) {
            beta = coord[0] + 90;
            alpha = coord[1];
        }

        control.setFromViewControlModel(viewControlModel, {
            baseDistance: coordSys.radius,
            alpha: alpha,
            beta: beta
        });

        control.off('update');
        control.on('update', function () {
            api.dispatchAction(makeAction());
        });
    },

    _displaceVertices: function (globeModel, api) {
        var displacementQuality = globeModel.get('displacementQuality');
        var showDebugWireframe = globeModel.get('debug.wireframe.show');
        var globe = globeModel.coordinateSystem;

        if (!globeModel.isDisplacementChanged()
            && displacementQuality === this._displacementQuality
            && showDebugWireframe === this._showDebugWireframe
        ) {
            return;
        }

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

        this._doDisplaceVertices(geometry, globe);

        if (showDebugWireframe) {
            geometry.generateBarycentric();
        }
    },

    _doDisplaceVertices: function (geometry, globe) {
        var positionArr = geometry.attributes.position.value;
        var uvArr = geometry.attributes.texcoord0.value;

        var originalPositionArr = geometry.__originalPosition;
        if (!originalPositionArr || originalPositionArr.length !== positionArr.length) {
            originalPositionArr = new Float32Array(positionArr.length);
            originalPositionArr.set(positionArr);
            geometry.__originalPosition = originalPositionArr;
        }

        var width = globe.displacementWidth;
        var height = globe.displacementHeight;
        var data = globe.displacementData;

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
            var scale = data ? data[idx] : 0;

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
        var pos = sunCalc.getPosition(echarts.number.parseDate(time), 0, 0);
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