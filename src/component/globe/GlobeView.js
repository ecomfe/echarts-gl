var echarts = require('echarts/lib/echarts');

var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');

var sunCalc = require('../../util/sunCalc');

function createBlankCanvas() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = canvas.height = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);

    return ctx;
}


graphicGL.Shader.import(require('text!../../util/shader/albedo.glsl'));
graphicGL.Shader.import(require('text!../../util/shader/lambert.glsl'));

module.exports = echarts.extendComponentView({

    type: 'globe',

    _displacementScale: 0,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        this._blankTexture = new graphicGL.Texture2D({
            image: createBlankCanvas()
        });
        /**
         * @type {qtek.Shader}
         * @private
         */
        var lambertShader = new graphicGL.Shader({
            vertex: graphicGL.Shader.source('ecgl.lambert.vertex'),
            fragment: graphicGL.Shader.source('ecgl.lambert.fragment')
        });
        this._lambertMaterial = new graphicGL.Material({
            shader: lambertShader
        });

        /**
         * @type {qtek.Shader}
         * @private
         */
        var albedoShader = new graphicGL.Shader({
            vertex: graphicGL.Shader.source('ecgl.albedo.vertex'),
            fragment: graphicGL.Shader.source('ecgl.albedo.fragment')
        });
        this._albedoMaterial = new graphicGL.Material({
            shader: albedoShader
        });

        /**
         * @type {qtek.geometry.Sphere}
         * @private
         */
        this._sphereGeometry = new graphicGL.SphereGeometry({
            widthSegments: 200,
            heightSegments: 100,
            dynamic: true
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

        /**
         * @type {qtek.light.Directional}
         */
        this._sunLight = new graphicGL.DirectionalLight();

        /**
         * @type {qtek.light.Ambient}
         */
        this._ambientLight = new graphicGL.AmbientLight();

        this.groupGL.add(this._earthMesh);
        this.groupGL.add(this._ambientLight);
        this.groupGL.add(this._sunLight);

        this._control = new OrbitControl({
            zr: api.getZr()
        });

        this._control.init();
    },

    render: function (globeModel, ecModel, api) {
        var coordSys = globeModel.coordinateSystem;
        var shading = globeModel.get('shading');

        // Add self to scene;
        coordSys.viewGL.add(this.groupGL);

        var earthMesh = this._earthMesh;

        earthMesh.geometry = this._sphereGeometry;

        if (shading === 'color') {
            earthMesh.material = this._albedoMaterial;
        }
        else if (shading === 'lambert') {
            earthMesh.material = this._lambertMaterial;
        }
        else {
            console.warn('Unkonw shading ' + shading);
            earthMesh.material = this._albedoMaterial;
        }

        earthMesh.scale.set(coordSys.radius, coordSys.radius, coordSys.radius);

        earthMesh.setTextureImage('diffuseMap', globeModel.get('baseTexture'), api, {
            flipY: false,
            anisotropic: 8
        });

        // Update bump map
        earthMesh.setTextureImage('bumpMap', globeModel.get('heightTexture'), api, {
            flipY: false,
            anisotropic: 8
        });

        this._updateLight(globeModel, api);

        this._displaceVertices(globeModel, api);

        // Update camera
        var viewControlModel = globeModel.getModel('viewControl');

        var camera = coordSys.viewGL.camera;

        var position = viewControlModel.get('position');
        var quaternion = viewControlModel.get('quaternion');
        if (position != null) {
            camera.position.setArray(position);
        }
        else {
            camera.position.z = coordSys.radius
                + viewControlModel.get('distance');
        }
        if (quaternion != null) {
            camera.lookAt(graphicGL.Vector3.ZERO);
        }

        function makeAction() {
            return {
                type: 'globeUpdateCamera',
                position: camera.position.toArray(),
                quaternion: camera.rotation.toArray(),
                from: this.uid,
                globeId: globeModel.id
            };
        }
        api.dispatchAction(makeAction());

        // Update control
        var control = this._control;
        control.setCamera(camera);

        control.autoRotate = viewControlModel.get('autoRotate');
        control.autoRotateAfterStill = viewControlModel.get('autoRotateAfterStill');

        control.minDistance = viewControlModel.get('minDistance') + coordSys.radius;
        control.maxDistance = viewControlModel.get('maxDistance') + coordSys.radius;

        control.setDistance(viewControlModel.get('distance') + coordSys.radius);

        control.off('update');
        control.on('update', function () {
            api.dispatchAction(makeAction());
        });
    },

    _displaceVertices: function (globeModel, api) {
        var displacementTextureValue = globeModel.get('displacementTexture') || globeModel.get('heightTexture');
        var displacementScale = globeModel.get('displacementScale');

        if (!displacementTextureValue || displacementTextureValue === 'none') {
            displacementScale = 0;
        }
        if (displacementScale === this._displacementScale) {
            return;
        }
        this._displacementScale = displacementScale;

        var geometry = this._sphereGeometry;

        var img;
        if (graphicGL.isImage(displacementTextureValue)) {
            img = displacementTextureValue;
            this._doDisplaceVertices(geometry, img, displacementScale);
        }
        else {
            img = new Image();
            var self = this;
            img.onload = function () {
                self._doDisplaceVertices(geometry, img, displacementScale);
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
    },

    _updateLight: function (globeModel, api) {
        var earthMesh = this._earthMesh;

        var sunLight = this._sunLight;
        var ambientLight = this._ambientLight;

        var lightModel = globeModel.getModel('light');
        sunLight.intensity = lightModel.get('sunIntensity');
        ambientLight.intensity = lightModel.get('ambientIntensity');

        // Put sun in the right position
        var time = lightModel.get('time') || new Date();

        // http://en.wikipedia.org/wiki/Azimuth
        var pos = sunCalc.getPosition(Date.parse(time), 0, 0);
        var r0 = Math.cos(pos.altitude);
        // FIXME How to calculate the y ?
        sunLight.position.y = -r0 * Math.cos(pos.azimuth);
        sunLight.position.x = Math.sin(pos.altitude);
        sunLight.position.z = r0 * Math.sin(pos.azimuth);
        sunLight.lookAt(earthMesh.getWorldPosition());

    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});