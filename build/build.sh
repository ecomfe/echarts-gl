basePath=$(cd `dirname $0`; pwd)
cd ${basePath}/../
rm -r dist

./node_modules/.bin/webpack
./node_modules/.bin/webpack -p