/**
 * Compatible with prevoius folder structure: `echarts/lib` exists in `node_modules`
 * (1) Build all files to CommonJS to `echarts/lib`.
 * (2) Remove __DEV__.
 * (3) Mount `echarts/src/export.js` to `echarts/lib/echarts.js`.
 */

const path = require('path');
const fsExtra = require('fs-extra');
const glob = require('glob');
const babel = require('@babel/core');

const srcDir = path.resolve(__dirname, '../src');
const libDir = path.resolve(__dirname, '../lib');


function prepublish () {

    fsExtra.removeSync(libDir);
    fsExtra.ensureDirSync(libDir);

    glob(srcDir, (files) => {
        files.forEach(file => {
            const code = fsExtra.readFileSync(file, 'utf-8');
            babel.transform(code, {
                plugins: [
                    ['@babel/plugin-transform-modules-commonjs', {
                        noInterop: true
                    }]
                ]
            });
        });
    });
}

prepublish();
