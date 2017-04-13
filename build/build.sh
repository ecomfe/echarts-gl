basePath=$(cd `dirname $0`; pwd)
cd ${basePath}/../
rm -r dist

node build/glsl2js.js

./node_modules/.bin/webpack
./node_modules/.bin/webpack -p