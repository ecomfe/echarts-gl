(function () {

    var CREDIT = '# ECharts v' + echarts.version + '\n'
            + '# http://echarts.baidu.com/\n';

    function quantizeArr(out, arr, precision) {
        out[0] = Math.round(arr[0] * precision) / precision;
        out[1] = Math.round(arr[1] * precision) / precision;
        out[2] = Math.round(arr[2] * precision) / precision;
    }

    function textureFromVertexColor(geometry) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var colorAttr = geometry.attributes.color;
        var texcoordAttr = geometry.attributes.texcoord0;

        var width = Math.round(Math.sqrt(geometry.vertexCount));
        var height = Math.ceil(geometry.vertexCount / width);

        canvas.width = width;
        canvas.height = height;
        var imgData = ctx.createImageData(width, height);
        var col = [];
        var uv = [];

        var texcoordsArr = texcoordAttr && texcoordAttr.value;
        if (!texcoordsArr) {
            texcoordsArr = new Float32Array(geometry.vertexCount * 2);
            for (var i = 0; i < geometry.vertexCount; i++) {
                var x = i % width;
                var y = Math.floor(i / width);
                texcoordsArr[i * 2] = x / (width - 1);
                // Flip y
                texcoordsArr[i * 2 + 1] = y / (height - 1);
            }
        }

        // FIXME
        for (var i = 0; i < geometry.vertexCount; i++) {
            colorAttr.get(i, col);
            if (col[3] == null) {
                col[3] = 1;
            }

            var x = Math.round(uv[0] * (width - 1));
            var y = height - 1 - Math.round(uv[1] * (height - 1));

            var idx4 = (y * width + x) * 4;
            for (var k = 0; k < 4; k++) {
                imgData.data[idx4 + k] = col[k] * 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        return {
            image: canvas,
            texcoords: texcoordsArr
        };
    }

    function convertImage(map, textureLib, outName) {
        var image = map.image;
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);

        textureLib.__count__ = textureLib.__count__ = {};
        var count = textureLib.__count__[outName] = textureLib.__count__[outName] || 0;

        if (count > 0) {
            outName += outName + '_' + count;
        }
        textureLib.__count__[outName]++;
        textureLib[map.__GUID__] = {
            data: canvas.toDataURL(),
            file: outName + '.png'
        };
    }

    function convertTexture(material, textureName, textureLib, outLib, outName) {
        var map = material.get(textureName);
        if (map && map.image) {
            if (!textureLib[map.__GUID__]) {
                convertImage(map, textureLib, outName);
            }
            outLib[outName] = textureLib[map.__GUID__].file;
        }
    }

    function phongFromRoughness(r) {
        if (r == null) {
            r = 1;
        }
        return Math.pow(1000.0, 1 - r);
    }

    function getMaterialParameters(material, textureLib) {
        var obj = {};
        obj['Kd'] = (material.get('color') || [1, 1, 1]).slice(0, 3).join(' ');
        // TODO
        obj['Ks'] = [1, 1, 1].join(' ');
        obj['Ns'] = phongFromRoughness(material.get('roughness'));
        convertTexture(material, 'diffuseMap', textureLib, obj, 'map_Kd');
        // convertTexture(material, 'bumpMap', textureLib, obj, 'bump');
        
        // Physically-based Rendering extension.
        if (material.shader.name === 'ecgl.realistic') {
            convertTexture(material, 'normalMap', textureLib, obj, 'norm');
            if (material.get('metalness') != null) {
                obj['Pm'] = material.get('metalness');
            }
            if (material.get('roughness') != null) {
                obj['Pr'] = material.get('roughness');
            }
            convertTexture(material, 'roughnessMap', textureLib, obj, 'map_Pr');
            convertTexture(material, 'metalnessMap', textureLib, obj, 'map_Pm');
        }
        return obj;
    }
    
    /**
     * @param {ECharts} echartsInstance
     * @param {Object} componentQuery
     * @param {string} componentQuery.mainType
     * @param {string} [componentQuery.subType]
     * @param {number} [componentQuery.index]
     * @param {string} [componentQuery.id]
     * @param {string} [componentQuery.name]
     * @param {Object} [opts]
     * @param {boolean} [opts.storeVertexColorInTexture=true]
     * @param {string} [opts.mtllib='']
     */
    echarts.exportGL2OBJ = function (chartInstance, componentQuery, opts) {
        opts = opts || {};
        opts.storeVertexColorInTexture = opts.storeVertexColorInTexture || false;
        opts.mtllib = opts.mtllib || 'material';

        var componentModel = chartInstance.getModel().queryComponents(componentQuery)[0];
        if (!componentModel) {
            throw new Error('Unkown component.');
        }
        var coordSys = componentModel.coordinateSystem;
        var view = componentQuery.mainType === 'series'
            ? chartInstance.getViewOfSeriesModel(componentModel)
            : chartInstance.getViewOfComponentModel(componentModel);
        
        if (!view.__ecgl__) {
            throw new Error('exportGL2OBJ only support GL components.');
        }

        var viewGL = (coordSys && coordSys.viewGL) || view.viewGL;
        var objStr = CREDIT;
        objStr += 'mtllib ' + opts.mtllib + '.mtl\n';

        var materialLib = {};
        var matCount = 0;
        var textureLib = {};
        var indexStart = 1;
        viewGL.scene.traverse(function (mesh) {
            if (mesh.geometry && mesh.geometry.vertexCount) {
                var materialName = 'mat_' + matCount++;
                objStr += 'o ' + mesh.name + '\n';

                materialLib[materialName] = getMaterialParameters(mesh.material, textureLib);

                var vStr = [];
                var vtStr = [];
                var vnStr = [];

                var geometry = mesh.geometry;
                var positionAttr = geometry.attributes.position;
                var colorAttr = geometry.attributes.color;
                var normalAttr = geometry.attributes.normal;
                var texcoordAttr = geometry.attributes.texcoord0;

                mesh.updateWorldTransform();
                var normalMat = mesh.worldTransform.clone().invert().transpose();

                var pos = new echarts.graphicGL.Vector3();
                var nor = new echarts.graphicGL.Vector3();
                var col = [];
                var uv = [];

                var hasTexcoord = !!(texcoordAttr && texcoordAttr.value);
                var hasNormal = !!(normalAttr && normalAttr.value);
                var hasColor = !!(colorAttr && colorAttr.value);

                var tmp = [];
                for (var i = 0; i < geometry.vertexCount; i++) {
                    positionAttr.get(i, pos._array);

                    echarts.graphicGL.Vector3.transformMat4(pos, pos, mesh.worldTransform);

                    // PENDING
                    quantizeArr(tmp, pos._array, 1e5);
                    var vItem = 'v ' + tmp.join(' ');
                    if (hasColor && !opts.storeVertexColorInTexture) {
                        colorAttr.get(i, col);
                        quantizeArr(col, col, 1e3);
                        vItem += ' ' + col.join(' ');
                    }
                    vStr.push(vItem);

                    if (hasNormal) {
                        normalAttr.get(i, nor._array);
                        echarts.graphicGL.Vector3.transformMat4(nor, nor, normalMat);
                        echarts.graphicGL.Vector3.normalize(nor, nor);
                        quantizeArr(tmp, nor._array, 1e3);
                        vnStr.push('vn ' + tmp.join(' '));
                    }
                    if (hasTexcoord) {
                        texcoordAttr.get(i, uv);
                        vtStr.push('vt ' + uv.join(' '));
                    }
                }
                if (opts.storeVertexColorInTexture && hasColor) {
                    var res = textureFromVertexColor(geometry);
                    var tex = new echarts.graphicGL.Texture2D({
                        image: res.image
                    });
                    convertImage(tex, textureLib, 'map_Kd');
                    materialLib[materialName]['map_Kd'] = textureLib[tex.__GUID__].file;

                    if (!hasTexcoord) {
                        for (var i = 0; i < res.texcoords.length;) {
                            var u = res.texcoords[i++];
                            var v = res.texcoords[i++];
                            vtStr.push('vt ' + u + ' ' + v);
                        }
                    }
                }

                var fStr = [];
                var indices = [];
                for (var i = 0; i < geometry.triangleCount; i++) {
                    geometry.getTriangleIndices(i, indices);
                    // Start from 1
                    for (var k = 0; k < 3; k++) {
                        indices[k] += indexStart;
                        var idx = indices[k];
                        if (hasTexcoord) {
                            indices[k] += '/' + idx;
                        }
                        if (hasNormal) {
                            if (!hasTexcoord) {
                                indices[k] += '/';
                            }
                            indices[k] += '/' + idx;
                        }
                    }

                    fStr.push('f ' + indices.join(' '));
                }

                objStr += vStr.join('\n') + '\n'
                    + vnStr.join('\n') + '\n'
                    + vtStr.join('\n') + '\n'
                    + 'usemtl ' + materialName + '\n'
                    + fStr.join('\n') + '\n';

                indexStart += geometry.vertexCount;
            }
        });

        var mtlStr = [
            CREDIT
        ];
        for (var matName in materialLib) {
            var material = materialLib[matName];
            mtlStr.push('newmtl ' + matName);
            for (var key in material) {
                var val = material[key];
                mtlStr.push(key + ' ' + val);
            }
        }

        var textures = [];
        for (var key in textureLib) {
            if (key !== '__count__') {
                textures.push(textureLib[key]);
            }
        }

        return {
            obj: objStr,
            mtl: mtlStr.join('\n'),
            textures: textures
        };
    };
})();