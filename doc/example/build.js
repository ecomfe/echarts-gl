var fs = require('fs');

var config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

var tpl = fs.readFileSync(config.template || 'example.tpl', 'utf-8');

config.examples.forEach(function (exampleItem) {
    var code = fs.readFileSync(exampleItem.codeUrl, 'utf-8');

    var html = tpl.replace('{{title}}', exampleItem.title)
        .replace('{{code}}', code);

    fs.writeFileSync(exampleItem.name + '.html', html, 'utf-8');
});